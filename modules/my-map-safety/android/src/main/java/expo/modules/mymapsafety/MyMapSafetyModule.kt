package expo.modules.mymapsafety

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.sqrt

private const val INCIDENT_EVENT = "onIncidentDetected"
private const val ACTIVITY_EVENT = "onActivityChanged"

class MyMapSafetyModule : Module(), SensorEventListener {
  private val sensorManager: SensorManager?
    get() = appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private val accelerometer: Sensor?
    get() = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

  private val gyroscope: Sensor?
    get() = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

  private val barometer: Sensor?
    get() = sensorManager?.getDefaultSensor(Sensor.TYPE_PRESSURE)

  private val stepDetector: Sensor?
    get() = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

  @Volatile private var running = false
  @Volatile private var crashThresholdG = 4.5
  @Volatile private var fallThresholdG = 3.2
  @Volatile private var cooldownMs = 30_000L

  private var lastTriggerElapsedMs = Long.MIN_VALUE
  private var lastFreeFallElapsedMs = Long.MIN_VALUE
  private var lastGyroAngularSpeed = 0.0
  private var lastPressureHpa = 1013.25
  private var altitudeDropDetected = false
  private var stepsCountSinceImpact = 0

  // Activity detection heuristic (Still / Walk / Run / Vehicle)
  @Volatile private var currentDetectedActivity = "STILL"
  private var recentGHistory = ArrayList<Double>()

  override fun definition() = ModuleDefinition {
    Name("MyMapSafety")

    Events(INCIDENT_EVENT, ACTIVITY_EVENT)

    AsyncFunction("isAvailable") {
      accelerometer != null
    }

    AsyncFunction("getAvailableSensors") {
      mapOf(
        "accelerometer" to (accelerometer != null),
        "gyroscope" to (gyroscope != null),
        "barometer" to (barometer != null),
        "stepDetector" to (stepDetector != null)
      )
    }

    AsyncFunction("startDetection") { crashThreshold: Double, fallThreshold: Double, cooldown: Double ->
      val manager = sensorManager ?: return@AsyncFunction false
      val accel = accelerometer ?: return@AsyncFunction false

      crashThresholdG = crashThreshold.coerceAtLeast(1.0)
      fallThresholdG = fallThreshold.coerceIn(1.0, crashThresholdG)
      cooldownMs = cooldown.toLong().coerceAtLeast(1_000L)
      lastTriggerElapsedMs = Long.MIN_VALUE
      lastFreeFallElapsedMs = Long.MIN_VALUE
      lastGyroAngularSpeed = 0.0
      stepsCountSinceImpact = 0
      altitudeDropDetected = false

      manager.unregisterListener(this@MyMapSafetyModule)

      // Register multi-sensors for precise discrimination
      running = manager.registerListener(this@MyMapSafetyModule, accel, SensorManager.SENSOR_DELAY_GAME)
      gyroscope?.let { manager.registerListener(this@MyMapSafetyModule, it, SensorManager.SENSOR_DELAY_GAME) }
      barometer?.let { manager.registerListener(this@MyMapSafetyModule, it, SensorManager.SENSOR_DELAY_NORMAL) }
      stepDetector?.let { manager.registerListener(this@MyMapSafetyModule, it, SensorManager.SENSOR_DELAY_NORMAL) }

      running
    }

    AsyncFunction("stopDetection") {
      stopDetection()
    }

    // --- Battery Optimization status / system settings ---
    AsyncFunction("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
      } else {
        true
      }
    }

    AsyncFunction("requestIgnoreBatteryOptimizations") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        // Open the standard system list instead of requesting a direct exemption.
        // Direct exemption needs a restricted permission and can make sideloaded
        // builds appear risky to device security scanners.
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        true
      } else {
        false
      }
    }

    // --- Foreground Service Control ---
    AsyncFunction("startForegroundTracking") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(context, MyMapForegroundService::class.java).apply {
        action = MyMapForegroundService.ACTION_START_TRACKING
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      true
    }

    AsyncFunction("stopForegroundTracking") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(context, MyMapForegroundService::class.java).apply {
        action = MyMapForegroundService.ACTION_STOP_TRACKING
      }
      context.startService(intent)
      true
    }

    // --- WorkManager Offline Sync Queue ---
    AsyncFunction("scheduleOfflineSync") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      SyncQueueWorker.schedulePeriodicSync(context)
      true
    }

    // --- Activity Recognition Status ---
    AsyncFunction("getDetectedActivity") {
      currentDetectedActivity
    }

    // --- Native WebP Hardware Compressor ---
    AsyncFunction("compressImageToWebP") { sourceUriString: String, quality: Int ->
      val context = appContext.reactContext ?: throw Exception("No react context")
      val targetQuality = quality.coerceIn(1, 100)
      
      val cleanPath = sourceUriString.replace("file://", "")
      val file = File(cleanPath)
      if (!file.exists()) {
        throw Exception("File does not exist: $cleanPath")
      }

      val bitmap = BitmapFactory.decodeFile(file.absolutePath)
        ?: throw Exception("Failed to decode bitmap from $cleanPath")

      val destFile = File(context.cacheDir, "mymap_opt_${System.currentTimeMillis()}.webp")
      FileOutputStream(destFile).use { out ->
        val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          Bitmap.CompressFormat.WEBP_LOSSY
        } else {
          @Suppress("DEPRECATION")
          Bitmap.CompressFormat.WEBP
        }
        bitmap.compress(format, targetQuality, out)
      }
      bitmap.recycle()

      destFile.absolutePath
    }

    // --- Native EXIF Coordinates Reader / Writer ---
    AsyncFunction("writeGeoExif") { filePath: String, lat: Double, lon: Double, altitude: Double?, timestampMs: Double? ->
      val cleanPath = filePath.replace("file://", "")
      val exif = ExifInterface(cleanPath)
      
      exif.setLatLong(lat, lon)
      if (altitude != null) {
        exif.setAltitude(altitude)
      }
      if (timestampMs != null) {
        val sdf = java.text.SimpleDateFormat("yyyy:MM:dd HH:mm:ss", java.util.Locale.US)
        exif.setAttribute(ExifInterface.TAG_DATETIME, sdf.format(java.util.Date(timestampMs.toLong())))
      }
      exif.saveAttributes()
      true
    }

    AsyncFunction("readGeoExif") { filePath: String ->
      val cleanPath = filePath.replace("file://", "")
      val exif = ExifInterface(cleanPath)
      val latLong = FloatArray(2)
      val hasLatLong = exif.getLatLong(latLong)
      val altitude = exif.getAltitude(0.0)

      if (hasLatLong) {
        mapOf(
          "hasLocation" to true,
          "latitude" to latLong[0].toDouble(),
          "longitude" to latLong[1].toDouble(),
          "altitude" to altitude
        )
      } else {
        mapOf("hasLocation" to false)
      }
    }

    // --- Wear OS Companion Bridge ---
    AsyncFunction("notifyWearDevice") { type: String, message: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val pattern = if (type == "sos") {
          longArrayOf(0, 300, 100, 300, 100, 500)
        } else {
          longArrayOf(0, 200, 100, 200)
        }
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
      } else {
        @Suppress("DEPRECATION")
        vibrator?.vibrate(500)
      }
      true
    }

    // --- Hardware Battery Status ---
    AsyncFunction("getBatteryStatus") {
      val context = appContext.reactContext
      if (context != null) {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as? android.os.BatteryManager
        val level = bm?.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 80
        val isCharging = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          bm?.isCharging ?: false
        } else {
          false
        }
        mapOf("level" to level, "isCharging" to isCharging)
      } else {
        mapOf("level" to 80, "isCharging" to false)
      }
    }

    OnDestroy {
      stopDetection()
    }
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (!running || event == null) return

    when (event.sensor.type) {
      Sensor.TYPE_GYROSCOPE -> {
        val gx = event.values[0].toDouble()
        val gy = event.values[1].toDouble()
        val gz = event.values[2].toDouble()
        lastGyroAngularSpeed = sqrt(gx * gx + gy * gy + gz * gz)
      }

      Sensor.TYPE_PRESSURE -> {
        val p = event.values[0].toDouble()
        // Altitude estimate: h = 44330 * (1 - (p / 1013.25)^(1/5.255))
        val currentAlt = 44330.0 * (1.0 - (p / 1013.25).pow(1.0 / 5.255))
        val prevAlt = 44330.0 * (1.0 - (lastPressureHpa / 1013.25).pow(1.0 / 5.255))
        if (abs(currentAlt - prevAlt) > 1.8) {
          altitudeDropDetected = true
        }
        lastPressureHpa = p
      }

      Sensor.TYPE_STEP_DETECTOR -> {
        stepsCountSinceImpact++
      }

      Sensor.TYPE_ACCELEROMETER -> {
        val x = event.values[0].toDouble()
        val y = event.values[1].toDouble()
        val z = event.values[2].toDouble()
        val totalAcc = sqrt(x * x + y * y + z * z)
        val peakG = totalAcc / SensorManager.GRAVITY_EARTH

        val now = SystemClock.elapsedRealtime()

        // 1. Detect Free-fall phase (Total G < 0.45 G)
        if (peakG < 0.45) {
          lastFreeFallElapsedMs = now
        }

        // 2. Activity recognition heuristic update
        recentGHistory.add(peakG)
        if (recentGHistory.size > 50) {
          recentGHistory.removeAt(0)
          updateActivityRecognition(recentGHistory)
        }

        // 3. Fall & Impact Evaluation with Mattress / Drop Discrimination
        if (peakG >= fallThresholdG) {
          val hadFreeFall = (now - lastFreeFallElapsedMs) in 50..800
          val hadHighRotation = lastGyroAngularSpeed > 2.2
          val hadHeightDrop = altitudeDropDetected

          // True Fall Criteria vs Mattress drop:
          // A phone simply tossed onto a bed/couch usually has no significant free-fall preceding or immediate rotational tumble followed by stillness.
          val isTrueImpact = (peakG >= crashThresholdG) || hadFreeFall || hadHighRotation || hadHeightDrop

          if (isTrueImpact) {
            if (lastTriggerElapsedMs != Long.MIN_VALUE && now - lastTriggerElapsedMs < cooldownMs) return
            lastTriggerElapsedMs = now

            val incidentType = if (peakG >= crashThresholdG) "possible_crash" else "possible_fall"
            sendEvent(
              INCIDENT_EVENT,
              mapOf(
                "type" to incidentType,
                "peakG" to peakG,
                "hadFreeFall" to hadFreeFall,
                "hadHighRotation" to hadHighRotation,
                "hadHeightDrop" to hadHeightDrop,
                "gyroRadPerSec" to lastGyroAngularSpeed,
                "timestamp" to System.currentTimeMillis(),
                "platform" to "android"
              )
            )

            // Reset transient flags
            altitudeDropDetected = false
            stepsCountSinceImpact = 0
          }
        }
      }
    }
  }

  private fun updateActivityRecognition(history: List<Double>) {
    var variance = 0.0
    val mean = history.average()
    for (v in history) {
      variance += (v - mean) * (v - mean)
    }
    variance /= history.size

    val newActivity = when {
      variance < 0.015 -> "STILL"
      variance in 0.015..0.12 -> "WALKING"
      variance in 0.12..0.45 -> "RUNNING"
      variance in 0.45..1.2 -> "ON_BICYCLE"
      else -> "IN_VEHICLE"
    }

    if (newActivity != currentDetectedActivity) {
      currentDetectedActivity = newActivity
      sendEvent(ACTIVITY_EVENT, mapOf("activity" to newActivity, "timestamp" to System.currentTimeMillis()))
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  private fun stopDetection() {
    running = false
    sensorManager?.unregisterListener(this)
  }
}
