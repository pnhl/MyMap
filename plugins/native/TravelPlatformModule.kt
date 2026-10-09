package com.pnhl.vibecoding

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.media.ToneGenerator
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import org.json.JSONObject

class TravelPlatformModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
 companion object {
  private var activeContext:java.lang.ref.WeakReference<ReactApplicationContext>?=null
  fun stopCarNavigation(){activeContext?.get()?.let{c->if(c.hasActiveReactInstance())c.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("carStopNavigation",null)}}
 }
 init {activeContext=java.lang.ref.WeakReference(context)}
 override fun getName() = "TravelPlatform"
 private val prefs get() = context.getSharedPreferences("mymap_travel", Context.MODE_PRIVATE)
 private fun spotubeLaunchIntent(): Intent? {
  // Spotube has no supported search deep link in v5. Only launch its own launcher.
  for (packageName in listOf("oss.krtirtho.spotube", "oss.krtirtho.spotube.nightly", "oss.krtirtho.spotube.dev")) {
   val intent = context.packageManager.getLaunchIntentForPackage(packageName)
   if (intent != null) return intent
  }
  return null
 }
 @ReactMethod fun getSpotubeInstallation(promise: Promise) {
  val intent = runCatching { spotubeLaunchIntent() }.getOrNull()
  promise.resolve(Arguments.createMap().apply {
   putBoolean("installed", intent != null)
   if (intent != null) putString("packageName", intent.component?.packageName ?: intent.`package`)
  })
 }
 @ReactMethod fun openSpotube(promise: Promise) {
  try {
   val intent = spotubeLaunchIntent()
   if (intent == null) { promise.resolve(false); return }
   context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
   promise.resolve(true)
  } catch (error: Exception) {
   promise.reject("SPOTUBE_OPEN", "Không thể mở Spotube trên thiết bị này.", error)
  }
 }
 @ReactMethod fun getAudioDocumentInfo(uriString: String, promise: Promise) {
  val uri = runCatching { Uri.parse(uriString) }.getOrNull()
  if (uriString.length > 4096 || uriString.contains('\u0000') || uri == null ||
      !uri.isHierarchical || uri.scheme !in listOf("content", "file")) {
   promise.reject("DOCUMENT_URI", "Đường dẫn tệp âm thanh không hợp lệ.")
   return
  }
  // A picker URI's final segment is often a document ID, not its filename.
  // Query only metadata using the picker grant; never request broader access.
  Thread({
   var name: String? = null
   var mimeType: String? = null
   if (uri.scheme == "content") {
    name = runCatching {
     context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (column >= 0 && cursor.moveToFirst()) cursor.getString(column) else null
     }
    }.getOrNull()
    mimeType = runCatching { context.contentResolver.getType(uri) }.getOrNull()
   } else {
    name = uri.path?.let { java.io.File(it).name }
    val extension = name?.substringAfterLast('.', "")?.lowercase()
    mimeType = extension?.let { MimeTypeMap.getSingleton().getMimeTypeFromExtension(it) }
   }
   promise.resolve(Arguments.createMap().apply {
    putString("name", name?.trim()?.replace('\u0000', ' ')?.take(512)?.takeIf { it.isNotEmpty() })
    putString("mimeType", mimeType?.trim()?.lowercase()?.take(180)?.takeIf { it.isNotEmpty() })
   })
  }, "MyMapAudioDocumentInfo").start()
 }
 @ReactMethod fun getBuildInfo(promise: Promise) {promise.resolve(Arguments.createMap().apply {putString("channel", BuildConfig.DISTRIBUTION_CHANNEL);putString("appstoreId", BuildConfig.AMAZON_APPSTORE_ID)})}
 @ReactMethod fun consumeTrackingShortcut(promise:Promise){val command=prefs.getString("tracking_shortcut",null);prefs.edit().remove("tracking_shortcut").commit();promise.resolve(command)}
 @ReactMethod fun setTrackingIndicator(enabled:Boolean){prefs.edit().putBoolean("tracking_indicator",enabled).apply()}
 @ReactMethod fun startPlatformTracking(interval:Double,distance:Double,promise:Promise){try{
  prefs.edit().putBoolean("platform_tracking",true).putLong("platform_interval",interval.toLong().coerceAtLeast(1000)).putFloat("platform_distance",distance.toFloat().coerceAtLeast(1f)).apply()
  ContextCompat.startForegroundService(context,Intent(context,PlatformTrackingService::class.java));promise.resolve(true)
 }catch(e:Exception){prefs.edit().putBoolean("platform_tracking",false).apply();promise.reject("PLATFORM_TRACKING",e.message,e)}}
 @ReactMethod fun stopPlatformTracking(promise:Promise){prefs.edit().putBoolean("platform_tracking",false).remove("platform_error").apply();context.stopService(Intent(context,PlatformTrackingService::class.java));promise.resolve(true)}
 @ReactMethod fun isPlatformTracking(promise:Promise){promise.resolve(prefs.getBoolean("platform_tracking",false)&&PlatformTrackingService.running)}
 @ReactMethod fun platformTrackingError(promise:Promise){promise.resolve(prefs.getString("platform_error",null))}
 @ReactMethod fun openDialer(number: String, promise: Promise) {
  val safe = number.trim().filter {it.isDigit() || it == '+'}
  if (safe.isBlank()) {promise.reject("NUMBER", "Số điện thoại không hợp lệ.");return}
  try {
   val intent = Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", safe, null)).putExtra("com.android.phone.ShowDialpad",true)
   val activity = context.currentActivity
   if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
   promise.resolve(true)
  } catch (e: Exception) {promise.reject("NO_DIALER", "Thiết bị không có trình gọi điện. Dùng điện thoại khác để gọi $safe.", e)}
 }
 @ReactMethod fun configureSafety(enabled: Boolean, number: String, promise: Promise) {
  try {
   val manager = context.getSystemService(Context.SENSOR_SERVICE) as android.hardware.SensorManager
   if (enabled && manager.getDefaultSensor(android.hardware.Sensor.TYPE_ACCELEROMETER) == null) throw IllegalStateException("Thiết bị thiếu cảm biến gia tốc.")
   val safe = number.filter {it.isDigit() || it == '+'}.ifBlank {"112"}
   prefs.edit().putBoolean("safety_enabled", enabled).putString("emergency_number", safe).apply()
   if (enabled) ContextCompat.startForegroundService(context, Intent(context, SafetyMonitorService::class.java))
   else {context.stopService(Intent(context, SafetyMonitorService::class.java));dismissIncident()}
   promise.resolve(true)
  } catch(e:Exception) {prefs.edit().putBoolean("safety_enabled",false).apply();promise.reject("SAFETY", e.message,e)}
 }
 @ReactMethod fun safetyState(promise: Promise) {promise.resolve(Arguments.createMap().apply {
  putBoolean("enabled",prefs.getBoolean("safety_enabled",false)); putDouble("pendingAt",prefs.getLong("incident_at",0).toDouble());putDouble("deadline",prefs.getLong("incident_deadline",0).toDouble());putDouble("heightMeters",prefs.getFloat("incident_height",0f).toDouble());putString("kind",prefs.getString("incident_kind", ""));putString("emergencyNumber",prefs.getString("emergency_number","112"))
 })}
 @ReactMethod fun userInteraction() {prefs.edit().putLong("last_interaction",System.currentTimeMillis()).apply()}
 @ReactMethod fun setForeground(active: Boolean) {prefs.edit().putBoolean("foreground",active).apply()}
 @ReactMethod fun dismissIncident() {prefs.edit().remove("incident_at").remove("incident_deadline").apply();(context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager).cancel(2102)}
 @ReactMethod fun playWarning() {Handler(Looper.getMainLooper()).post {runCatching {val tone=ToneGenerator(AudioManager.STREAM_NOTIFICATION,85);tone.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD,500);Handler(Looper.getMainLooper()).postDelayed({tone.release()},700)}}}
 @ReactMethod fun updateCarState(json: String) {runCatching {JSONObject(json);prefs.edit().putString("car_state",json).apply()}}
}
