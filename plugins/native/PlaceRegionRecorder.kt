package com.pnhl.vibecoding

import android.content.Context
import android.location.Location
import android.app.NotificationManager
import android.app.NotificationChannel
import android.app.PendingIntent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject

/** Evaluated only by the opt-in system GPS recorder. No GMS or new service. */
object PlaceRegionRecorder {
 private fun prefs(context:Context)=context.getSharedPreferences("mymap_travel",Context.MODE_PRIVATE)
 private fun owner():String?=try{val type=Class.forName("com.google.firebase.auth.FirebaseAuth");val auth=type.getMethod("getInstance").invoke(null);val user=type.getMethod("getCurrentUser").invoke(auth);if(user==null)null else Class.forName("com.google.firebase.auth.FirebaseUser").getMethod("getUid").invoke(user) as? String}catch(_:Exception){null}catch(_:LinkageError){null}
 @Synchronized fun configure(context:Context,json:String?){
  val p=prefs(context)
  if(json==null){p.edit().remove("place_regions").remove("place_region_states").apply();return}
  require(json.length<=32768)
  val value=JSONObject(json);require(value.getString("owner")==owner());require(value.getJSONArray("regions").length()<=20)
  if(p.getString("place_regions",null)!=json)p.edit().putString("place_regions",json).remove("place_region_states").apply()
 }
 @Synchronized fun pending(context:Context):String{
  val all=JSONArray(prefs(context).getString("place_region_events","[]"));val out=JSONArray();val current=owner()
  for(i in 0 until all.length()){val event=all.getJSONObject(i);if(event.optString("owner")==current)out.put(event)}
  return out.toString()
 }
 @Synchronized fun acknowledge(context:Context,id:String){
  val p=prefs(context);val all=JSONArray(p.getString("place_region_events","[]"));val out=JSONArray();val current=owner()
  for(i in 0 until all.length()){val event=all.getJSONObject(i);if(event.optString("id")!=id||event.optString("owner")!=current)out.put(event)}
  p.edit().putString("place_region_events",out.toString()).commit()
 }
 @Synchronized fun evaluate(context:Context,point:Location){
  if(BuildConfig.DISTRIBUTION_CHANNEL!="amazon")return
  val p=prefs(context);val raw=p.getString("place_regions",null)?:return
  runCatching{
   val config=JSONObject(raw);val current=config.getString("owner");if(current!=owner())return
   val regions=config.getJSONArray("regions");val states=JSONObject(p.getString("place_region_states","{}"));val events=JSONArray(p.getString("place_region_events","[]"))
   for(i in 0 until regions.length()){
    val region=regions.getJSONObject(i);val id=region.getString("id");val lat=region.getDouble("latitude");val lon=region.getDouble("longitude")
    if(!lat.isFinite()||lat !in -90.0..90.0||!lon.isFinite()||lon !in -180.0..180.0)continue
    val distance=FloatArray(1);Location.distanceBetween(point.latitude,point.longitude,lat,lon,distance)
    val radius=region.optDouble("radius_m",100.0).coerceIn(50.0,5000.0)
    if(kotlin.math.abs(distance[0]-radius)<=kotlin.math.max(25f,point.accuracy))continue
    val inside=distance[0]<radius;val had=states.has(id);val previous=states.optBoolean(id);states.put(id,inside)
    if(!had||previous==inside||!region.optBoolean(if(inside)"notify_on_enter" else "notify_on_exit"))continue
    val event=JSONObject().put("id",java.util.UUID.randomUUID().toString()).put("owner",current).put("alertId",id).put("type",if(inside)"enter" else "exit").put("lat",point.latitude).put("lon",point.longitude).put("at",point.time)
    if(events.length()>=1000){states.put(id,previous);p.edit().putString("place_region_error","Hàng đợi cảnh báo địa điểm đầy. Mở MyMap có mạng để đồng bộ.").apply();continue}
    events.put(event)
    // Persist transition/event before presenting. Server replay happens on resume.
    if(p.edit().putString("place_region_events",events.toString()).putString("place_region_states",states.toString()).remove("place_region_error").commit())notify(context,id,current,inside)
   }
   p.edit().putString("place_region_states",states.toString()).apply()
  }.onFailure{p.edit().putString("place_region_error","Chưa đánh giá được cảnh báo địa điểm.").apply()}
 }
 private fun notify(context:Context,id:String,current:String,inside:Boolean){
  if(current!=owner()||!NotificationManagerCompat.from(context).areNotificationsEnabled())return
  val manager=context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(NotificationChannel("mymap_places","MyMap · Địa điểm",NotificationManager.IMPORTANCE_DEFAULT))
  val launch=context.packageManager.getLaunchIntentForPackage(context.packageName)?:return
  val open=PendingIntent.getActivity(context,id.hashCode(),launch,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  manager.notify(id.hashCode(),NotificationCompat.Builder(context,"mymap_places").setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle(if(inside)"MyMap · Đã đến địa điểm" else "MyMap · Đã rời địa điểm").setContentText("Mở MyMap để xem cảnh báo địa điểm.").setContentIntent(open).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build())
 }
}
