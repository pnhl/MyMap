package com.pnhl.vibecoding

import android.content.Context
import com.facebook.react.bridge.*
import org.json.JSONObject

/** Common bridge has no hard reference to ADM/GMS and is safe at cold start. */
class MyMapPushModule(private val context:ReactApplicationContext):ReactContextBaseJavaModule(context){
 private var pendingOpen:String?=null
 init{context.addActivityEventListener(object:BaseActivityEventListener(){override fun onNewIntent(intent:android.content.Intent){pendingOpen=intent.getStringExtra("mymap_push")}})}
 override fun getName()="MyMapPush"
 private val prefs get()=context.getSharedPreferences("mymap_push",Context.MODE_PRIVATE)
 @ReactMethod fun setOwner(owner:String?,promise:Promise){prefs.edit().putString("owner",owner).apply();if(owner==null)(context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager).cancelAll();promise.resolve(true)}
 @ReactMethod fun getAdmToken(promise:Promise){
  try{
   if(BuildConfig.DISTRIBUTION_CHANNEL!="amazon"){promise.resolve(null);return}
   val type=Class.forName("com.amazon.device.messaging.ADM")
   val adm=type.getConstructor(Context::class.java).newInstance(context)
   val supported=type.getMethod("isSupported").invoke(adm) as Boolean
   if(!supported){promise.resolve(null);return}
   val token=type.getMethod("getRegistrationId").invoke(adm) as? String
   if(token==null)type.getMethod("startRegister").invoke(adm)
   promise.resolve(token)
  }catch(_:Exception){promise.resolve(null)}catch(_:LinkageError){promise.resolve(null)}
 }
 @ReactMethod fun consumePushOpen(promise:Promise){
  val intent=context.currentActivity?.intent
  val value=pendingOpen?:intent?.getStringExtra("mymap_push");pendingOpen=null;intent?.removeExtra("mymap_push")
  if(value==null){promise.resolve(null);return}
  try{val data=JSONObject(value);if(data.optString("owner")!=prefs.getString("owner",null)){promise.resolve(null);return}
   promise.resolve(Arguments.createMap().apply{for(key in listOf("owner","notificationId","callId","roomId"))if(data.has(key))putString(key,data.optString(key))})
  }catch(_:Exception){promise.resolve(null)}
 }
}
