package com.pnhl.vibecoding

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import androidx.core.content.ContextCompat
import com.amazon.device.ads.AdRegistration
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class PlatformLocationModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LocationListener {
  private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
  private var listening = false

  override fun getName() = "PlatformLocation"

  @ReactMethod
  fun isAmazonDevice(promise: Promise) {
    val signature = listOf(Build.MANUFACTURER, Build.BRAND, Build.MODEL)
      .joinToString(" ")
      .lowercase()
    promise.resolve(BuildConfig.DISTRIBUTION_CHANNEL == "amazon" || signature.contains("amazon") || signature.contains("kindle"))
  }

  @ReactMethod
  fun initializeAmazonAds(appId: String, promise: Promise) {
    if (appId.isBlank()) {
      promise.resolve(false)
      return
    }
    runCatching {
      AdRegistration.getInstance(appId, context.applicationContext)
    }.onSuccess {
      promise.resolve(true)
    }.onFailure { error ->
      promise.reject("ERR_AMAZON_ADS_INIT", "Không thể khởi tạo Amazon Publisher Services.", error)
    }
  }

  private fun hasLocationPermission(): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  private fun enabledProviders(): List<String> =
    listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      .filter { runCatching { locationManager.isProviderEnabled(it) }.getOrDefault(false) }

  private fun locationMap(location: Location) = Arguments.createMap().apply {
    putDouble("latitude", location.latitude)
    putDouble("longitude", location.longitude)
    putDouble("accuracy", location.accuracy.toDouble())
    if (location.hasAltitude()) putDouble("altitude", location.altitude) else putNull("altitude")
    if (location.hasSpeed()) putDouble("speed", location.speed.toDouble()) else putNull("speed")
    if (location.hasBearing()) putDouble("heading", location.bearing.toDouble()) else putNull("heading")
    putDouble("timestamp", location.time.toDouble())
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun getCurrentPosition(promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject("ERR_LOCATION_PERMISSION", "Quyền vị trí chưa được cấp.")
      return
    }
    val providers = enabledProviders()
    if (providers.isEmpty()) {
      promise.reject("ERR_LOCATION_DISABLED", "GPS/Location đang tắt.")
      return
    }
    val latest = providers.mapNotNull { provider ->
      runCatching { locationManager.getLastKnownLocation(provider) }.getOrNull()
    }.maxByOrNull { it.time }
    if (latest != null && System.currentTimeMillis() - latest.time <= 120_000) {
      promise.resolve(locationMap(latest))
      return
    }

    val provider = providers.first()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      locationManager.getCurrentLocation(provider, null, context.mainExecutor) { location ->
        if (location != null) promise.resolve(locationMap(location))
        else promise.reject("ERR_LOCATION_UNAVAILABLE", "Không nhận được vị trí hiện tại.")
      }
    } else {
      val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) = promise.resolve(locationMap(location))
        override fun onProviderDisabled(provider: String) = Unit
        override fun onProviderEnabled(provider: String) = Unit
        @Deprecated("Deprecated in Android")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
      }
      locationManager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
    }
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun startUpdates(intervalMs: Double, distanceMeters: Double, promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject("ERR_LOCATION_PERMISSION", "Quyền vị trí chưa được cấp.")
      return
    }
    val providers = enabledProviders()
    if (providers.isEmpty()) {
      promise.reject("ERR_LOCATION_DISABLED", "GPS/Location đang tắt.")
      return
    }
    stopNativeUpdates()
    try {
      providers.forEach { provider ->
        locationManager.requestLocationUpdates(
          provider,
          intervalMs.toLong().coerceAtLeast(1_000L),
          distanceMeters.toFloat().coerceAtLeast(0f),
          this,
          Looper.getMainLooper(),
        )
      }
      listening = true
      promise.resolve(true)
    } catch (error: Exception) {
      // A later provider may fail after GPS was registered: release our listener.
      runCatching { locationManager.removeUpdates(this) }
      listening = false
      promise.reject("ERR_LOCATION_UNAVAILABLE", "Chưa nhận được nguồn vị trí của thiết bị.", error)
    }
  }

  @ReactMethod
  fun stopUpdates(promise: Promise) {
    stopNativeUpdates()
    promise.resolve(true)
  }

  override fun onLocationChanged(location: Location) {
    if (!context.hasActiveReactInstance()) return
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("platformLocation", locationMap(location))
  }

  override fun onProviderDisabled(provider: String) = Unit
  override fun onProviderEnabled(provider: String) = Unit
  @Deprecated("Deprecated in Android")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Double) = Unit

  private fun stopNativeUpdates() {
    if (listening) locationManager.removeUpdates(this)
    listening = false
  }

  override fun invalidate() {
    stopNativeUpdates()
    super.invalidate()
  }
}
