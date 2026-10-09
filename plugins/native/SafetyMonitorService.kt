package com.pnhl.vibecoding

import android.app.*
import android.content.*
import android.hardware.*
import android.net.Uri
import android.os.*
import androidx.core.app.NotificationCompat
import kotlin.math.*

/** Suspected impacts only. A pressure descent must overlap free fall and an impact.
 * A phone drop is indistinguishable from a person falling; no medical reliability claim. */
class SafetyMonitorService : Service(), SensorEventListener {
 private val prefs get() = getSharedPreferences("mymap_travel", MODE_PRIVATE)
 private lateinit var sensors: SensorManager
 private val handler=Handler(Looper.getMainLooper())
 private val altitude=ArrayDeque<Pair<Long,Double>>()
 private var freeFallStarted=0L
 private var freeFallEnded=0L
 private var freeFallDuration=0L
 private var lastImpact=0L
 private var rotation=0.0
 private var wake: PowerManager.WakeLock?=null
 private val interaction = object: BroadcastReceiver() {override fun onReceive(c:Context?, i:Intent?) {prefs.edit().putLong("last_interaction",System.currentTimeMillis()).apply()}}
 private val poll=object:Runnable {override fun run() {
  val at=prefs.getLong("incident_at",0);val deadline=prefs.getLong("incident_deadline",0)
  if(at>0 && prefs.getLong("last_interaction",0)>at) clearIncident()
  else if(deadline>0 && System.currentTimeMillis()>=deadline) {
   // ACTION_CALL cannot call emergency numbers. Background activity launches may also be blocked.
   prefs.edit().remove("incident_deadline").apply()
   alert(true)
   if(prefs.getBoolean("foreground",false)) runCatching {startActivity(dialIntent().addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))}
   releaseWake()
  }
  handler.postDelayed(this,1000)
 }}
 override fun onBind(intent:Intent?):IBinder?=null
 override fun onCreate() {
  super.onCreate();sensors=getSystemService(SENSOR_SERVICE) as SensorManager
  val manager=getSystemService(NOTIFICATION_SERVICE) as NotificationManager
  if(Build.VERSION.SDK_INT>=26){
   manager.createNotificationChannel(NotificationChannel("mymap_safety","MyMap · phát hiện sự cố",NotificationManager.IMPORTANCE_LOW))
   manager.createNotificationChannel(NotificationChannel("mymap_incident","MyMap · cảnh báo khẩn cấp",NotificationManager.IMPORTANCE_HIGH).apply {enableVibration(true)})
  }
  val filter=IntentFilter(Intent.ACTION_USER_PRESENT)
  if(Build.VERSION.SDK_INT>=33)registerReceiver(interaction,filter,RECEIVER_NOT_EXPORTED) else registerReceiver(interaction,filter)
 }
 override fun onStartCommand(intent:Intent?, flags:Int,startId:Int):Int {
  if(intent?.action=="DISMISS") clearIncident()
  if(!prefs.getBoolean("safety_enabled",false)){stopSelf();return START_NOT_STICKY}
  startForeground(2101,NotificationCompat.Builder(this,"mymap_safety").setSmallIcon(android.R.drawable.ic_dialog_alert).setContentTitle("MyMap · Cảm biến an toàn đang bật").setContentText("Va chạm và rơi nghi ngờ · Chạm để quản lý").setContentIntent(appIntent()).setOngoing(true).build())
  sensors.unregisterListener(this)
  val remaining=prefs.getLong("incident_deadline",0)-System.currentTimeMillis()
  if(remaining>0 && wake?.isHeld!=true)acquireWake(remaining+10000)
  for(type in listOf(Sensor.TYPE_ACCELEROMETER,Sensor.TYPE_GYROSCOPE,Sensor.TYPE_PRESSURE)) sensors.getDefaultSensor(type)?.let {sensors.registerListener(this,it,if(type==Sensor.TYPE_PRESSURE)SensorManager.SENSOR_DELAY_NORMAL else SensorManager.SENSOR_DELAY_GAME)}
  handler.removeCallbacks(poll);handler.post(poll);return START_STICKY
 }
 override fun onSensorChanged(event:SensorEvent) {
  val now=SystemClock.elapsedRealtime()
  when(event.sensor.type) {
   Sensor.TYPE_PRESSURE -> {
    if(event.values[0]<300 || event.values[0]>1200 || event.accuracy==SensorManager.SENSOR_STATUS_UNRELIABLE)return
    val h=44330.0*(1-(event.values[0]/1013.25).pow(1/5.255))
    altitude.addLast(now to h);while(altitude.isNotEmpty() && now-altitude.first().first>8000)altitude.removeFirst()
   }
   Sensor.TYPE_GYROSCOPE -> {rotation=sqrt(event.values.sumOf {it.toDouble()*it})}
   Sensor.TYPE_ACCELEROMETER -> {
    val g=sqrt(event.values.sumOf {it.toDouble()*it})/SensorManager.GRAVITY_EARTH
    if(g<0.45) {if(freeFallStarted==0L)freeFallStarted=now;freeFallEnded=now;freeFallDuration=now-freeFallStarted;return}
    if(now-freeFallEnded>500)freeFallStarted=0L
    if(g<3.2 || now-lastImpact<30000 || prefs.getLong("incident_at",0)>0)return
    val freeFall=freeFallDuration>=180 && now-freeFallEnded<500
    val height=if(altitude.size>=3)altitude.maxOf {it.second}-altitude.last().second else 0.0
    val highFall=freeFall && height>20.0 && freeFallDuration>=800
    if(g<4.5 && !freeFall && rotation<2.2)return
    lastImpact=now
    val wall=System.currentTimeMillis()
    prefs.edit().putLong("incident_at",wall).putLong("incident_deadline",if(highFall)wall+300000 else 0).putFloat("incident_height",if(highFall)height.toFloat() else 0f).putString("incident_kind",if(highFall)"high_fall" else if(freeFall)"possible_fall" else "possible_crash").apply()
    if(highFall) acquireWake(310000)
    alert(false)
   }
  }
 }
 private fun dialIntent()=Intent(Intent.ACTION_DIAL,Uri.fromParts("tel",prefs.getString("emergency_number","112"),null)).putExtra("com.android.phone.ShowDialpad",true)
 private fun appIntent():PendingIntent=PendingIntent.getActivity(this,2101,packageManager.getLaunchIntentForPackage(packageName),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
 private fun alert(expired:Boolean) {
  val call=PendingIntent.getActivity(this,2102,dialIntent(),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  val cancel=PendingIntent.getService(this,2103,Intent(this,SafetyMonitorService::class.java).setAction("DISMISS"),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  val high=prefs.getString("incident_kind","")=="high_fall"
  (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(2102,NotificationCompat.Builder(this,"mymap_incident").setSmallIcon(android.R.drawable.ic_dialog_alert).setContentTitle(if(expired)"Cần trợ giúp khẩn cấp?" else "MyMap phát hiện sự cố nghi ngờ").setContentText(if(expired)"Mở số khẩn cấp · Bạn cần ấn Gọi" else if(high)"Rơi ước tính trên 20 m · Cảnh báo sau 5 phút không tương tác" else "Kiểm tra an toàn hoặc mở trình gọi điện").setContentIntent(appIntent()).setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_ALARM).addAction(android.R.drawable.ic_menu_call,"Mở số khẩn cấp",call).addAction(android.R.drawable.ic_menu_close_clear_cancel,"Tôi an toàn",cancel).setOngoing(!expired).build())
 }
 private fun clearIncident(){prefs.edit().remove("incident_at").remove("incident_deadline").apply();(getSystemService(NOTIFICATION_SERVICE) as NotificationManager).cancel(2102);releaseWake()}
 private fun releaseWake(){if(wake?.isHeld==true)wake?.release();wake=null}
 private fun acquireWake(duration:Long){releaseWake();val power=getSystemService(POWER_SERVICE) as PowerManager;wake=power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"MyMap:incident");wake?.acquire(duration)}
 override fun onAccuracyChanged(sensor:Sensor?,accuracy:Int){}
 override fun onDestroy(){handler.removeCallbacksAndMessages(null);sensors.unregisterListener(this);unregisterReceiver(interaction);releaseWake();super.onDestroy()}
}
