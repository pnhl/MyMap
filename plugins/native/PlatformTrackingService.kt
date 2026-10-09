package com.pnhl.vibecoding

import android.Manifest
import android.annotation.SuppressLint
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.location.*
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/** System GPS recorder/fallback: SQLite, with no GMS or JS lifecycle dependency. */
class PlatformTrackingService:Service(),LocationListener{
 companion object {@Volatile var running=false}
 private lateinit var locations:LocationManager
 private val prefs get()=getSharedPreferences("mymap_travel",MODE_PRIVATE)
 private val worker=HandlerThread("MyMapGPS")
 private lateinit var writes:Handler
 private val pendingLock=Any()
 private val drain=Runnable {drainPending()}
 override fun onBind(intent:Intent?):IBinder?=null
 override fun onCreate(){super.onCreate();locations=getSystemService(LOCATION_SERVICE) as LocationManager;worker.start();writes=Handler(worker.looper)}
 @SuppressLint("MissingPermission")
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{
  if(!prefs.getBoolean("platform_tracking",false)||ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){stopSelf();return START_NOT_STICKY}
  if(Build.VERSION.SDK_INT>=26)(getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(NotificationChannel("mymap_platform_tracking","MyMap · Hành trình",NotificationManager.IMPORTANCE_LOW))
  val launch=PendingIntent.getActivity(this,2201,packageManager.getLaunchIntentForPackage(packageName),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  fun shortcut(url:String,id:Int)=PendingIntent.getActivity(this,id,Intent(Intent.ACTION_VIEW,android.net.Uri.parse(url)).setPackage(packageName),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  startForeground(2201,NotificationCompat.Builder(this,"mymap_platform_tracking").setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("MyMap đang ghi hành trình").setContentText("Vị trí được lưu riêng tư trên thiết bị của bạn.").setContentIntent(launch).setOngoing(true)
   .addAction(android.R.drawable.ic_menu_mylocation,"Ghi hành trình",shortcut("mymap://smart",2202))
   .addAction(android.R.drawable.ic_menu_camera,"Chụp nhanh",shortcut("mymap://camera",2203))
   .addAction(android.R.drawable.ic_dialog_alert,"SOS",shortcut("mymap://sos",2204)).build())
  val interval=prefs.getLong("platform_interval",5000);val distance=prefs.getFloat("platform_distance",5f)
  val providers=listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER).filter {runCatching{locations.isProviderEnabled(it)}.getOrDefault(false)}
  locations.removeUpdates(this)
  if(providers.isEmpty()){prefs.edit().putString("platform_error","Không có nguồn GPS hoặc vị trí mạng đang bật.").putBoolean("platform_tracking",false).apply();stopSelf();return START_NOT_STICKY}
  try {providers.forEach{locations.requestLocationUpdates(it,interval,distance,this,Looper.getMainLooper())};running=true;prefs.edit().remove("platform_error").apply()}
  catch(e:Exception){prefs.edit().putString("platform_error",e.message).putBoolean("platform_tracking",false).apply();stopSelf();return START_NOT_STICKY}
  writes.post(drain)
  return START_STICKY
 }
 override fun onLocationChanged(location:Location){
  if(!prefs.getBoolean("platform_tracking",false))return
  val p=Location(location)
  if(!p.latitude.isFinite()||!p.longitude.isFinite()||p.latitude !in -90.0..90.0||p.longitude !in -180.0..180.0||p.accuracy>120||p.accuracy<0)return
  // Commit before dispatching to the writer so process death cannot lose an accepted fix.
  synchronized(pendingLock){
   val pending=readPending()
   val item=JSONObject().put("lat",p.latitude).put("lon",p.longitude).put("accuracy",p.accuracy.toDouble()).put("time",p.time)
   if(p.hasAltitude())item.put("altitude",p.altitude)
   if(p.hasSpeed())item.put("speed",p.speed.toDouble())
   if(p.hasBearing())item.put("bearing",p.bearing.toDouble())
   pending.put(item)
   if(!prefs.edit().putString("platform_pending",pending.toString()).commit())prefs.edit().putString("platform_error","Chưa lưu được hàng đợi GPS. Kiểm tra dung lượng thiết bị.").apply()
  }
  writes.removeCallbacks(drain);writes.post(drain)
 }
 private fun readPending():JSONArray=runCatching{JSONArray(prefs.getString("platform_pending","[]"))}.getOrElse{prefs.edit().putString("platform_error","Hàng đợi GPS không đọc được.").apply();JSONArray()}
 private fun drainPending(){
  while(true){
   val item=synchronized(pendingLock){readPending().optJSONObject(0)}?:return
   val location=Location("mymap-pending").apply{
    latitude=item.getDouble("lat");longitude=item.getDouble("lon");accuracy=item.getDouble("accuracy").toFloat();time=item.getLong("time")
    if(item.has("altitude"))altitude=item.getDouble("altitude")
    if(item.has("speed"))speed=item.getDouble("speed").toFloat()
    if(item.has("bearing"))bearing=item.getDouble("bearing").toFloat()
   }
   if(!saveLocation(location)){if(worker.isAlive)writes.postDelayed(drain,5000);return}
   synchronized(pendingLock){val pending=readPending();pending.remove(0);prefs.edit().putString("platform_pending",pending.toString()).commit()}
  }
 }
 private fun saveLocation(p:Location):Boolean{
  val folder=File(filesDir,"SQLite");folder.mkdirs()
  var db:SQLiteDatabase?=null
  try{
   db=SQLiteDatabase.openDatabase(File(folder,"vibecoding.db").path,null,SQLiteDatabase.CREATE_IF_NECESSARY or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING)
   db.rawQuery("PRAGMA busy_timeout=5000",null).use{it.moveToFirst()}
   db.execSQL("CREATE TABLE IF NOT EXISTS location_points (id INTEGER PRIMARY KEY AUTOINCREMENT,latitude REAL NOT NULL,longitude REAL NOT NULL,accuracy REAL,altitude REAL,speed REAL,heading REAL,timestamp INTEGER NOT NULL UNIQUE)")
   db.rawQuery("SELECT latitude,longitude,accuracy,timestamp FROM location_points WHERE timestamp<=? ORDER BY timestamp DESC LIMIT 1",arrayOf(p.time.toString())).use{cursor->if(cursor.moveToFirst()){
    val previous=Location("saved").apply{latitude=cursor.getDouble(0);longitude=cursor.getDouble(1);accuracy=cursor.getFloat(2);time=cursor.getLong(3)}
    val dt=(p.time-previous.time)/1000.0
    if(dt<=0)return true
    val movement=p.distanceTo(previous)
    if(movement>100*dt+p.accuracy+previous.accuracy+120)return true
    if(movement<3 &&dt<60)return true
   }}
   db.execSQL("INSERT OR IGNORE INTO location_points(latitude,longitude,accuracy,altitude,speed,heading,timestamp) VALUES(?,?,?,?,?,?,?)",arrayOf<Any?>(p.latitude,p.longitude,p.accuracy,if(p.hasAltitude())p.altitude else null,if(p.hasSpeed())p.speed else null,if(p.hasBearing())p.bearing else null,p.time))
   prefs.edit().putLong("platform_last_saved",p.time).remove("platform_error").apply()
   return true
  }catch(e:Exception){prefs.edit().putString("platform_error", "Chưa lưu được GPS: ${e.message}").apply();return false}
  finally{db?.close()}
 }
 override fun onProviderEnabled(provider:String){}
 override fun onProviderDisabled(provider:String){
  val available=listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER).any{runCatching{locations.isProviderEnabled(it)}.getOrDefault(false)}
  if(available)prefs.edit().remove("platform_error").apply()
  else prefs.edit().putString("platform_error","GPS/Location đang tắt.").apply()
 }
 override fun onDestroy(){running=false;locations.removeUpdates(this);worker.quitSafely();super.onDestroy()}
}
