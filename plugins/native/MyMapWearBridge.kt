package com.pnhl.vibecoding
import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject
import java.util.concurrent.TimeUnit
object MyMapWearBridge {
 @JvmStatic fun notify(context:Context,type:String,message:String):Boolean {
  if(type !in listOf("sos","geofence"))return false
  val nodes=Tasks.await(Wearable.getCapabilityClient(context).getCapability("mymap_wear",CapabilityClient.FILTER_REACHABLE),3,TimeUnit.SECONDS).nodes
  val payload=JSONObject().put("type",type).put("message",message.take(240)).put("timestamp",System.currentTimeMillis()).toString().toByteArray(Charsets.UTF_8)
  var sent=false
  for(node in nodes.take(4))runCatching{Tasks.await(Wearable.getMessageClient(context).sendMessage(node.id,"/mymap/alert",payload),3,TimeUnit.SECONDS)}.onSuccess{sent=true}
  return sent
 }
}
class MyMapWearSOSService:WearableListenerService(){
 override fun onMessageReceived(event:MessageEvent){
  if(event.path!="/mymap/sos"||event.data.size>64||!getSharedPreferences("mymap_travel",MODE_PRIVATE).getBoolean("wear_enabled",false))return
  if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(this,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return
  val manager=getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  manager.createNotificationChannel(NotificationChannel("mymap-wear-sos","Yêu cầu SOS từ đồng hồ",NotificationManager.IMPORTANCE_HIGH))
  val pending=PendingIntent.getActivity(this,84,Intent(Intent.ACTION_VIEW,Uri.parse("mymap://sos")).setPackage(packageName),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  manager.notify(8401,NotificationCompat.Builder(this,"mymap-wear-sos").setSmallIcon(R.mipmap.ic_launcher).setContentTitle("MyMap · Yêu cầu SOS từ đồng hồ").setContentText("Mở SOS trên điện thoại để kiểm tra và xác nhận.").setContentIntent(pending).setAutoCancel(true).build())
 }
}
