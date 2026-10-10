package com.pnhl.vibecoding;
import android.app.*;
import android.content.*;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;

final class MyMapAdmDelivery {
 static void registered(Context context,String token){context.getSharedPreferences("mymap_push",0).edit().putString("token",token).apply();}
 static void message(Context context,Intent message){
  String owner=message.getStringExtra("owner"),id=message.getStringExtra("notificationId");
  if(owner==null||!owner.equals(context.getSharedPreferences("mymap_push",0).getString("owner",null))||id==null||!id.matches("[a-fA-F0-9-]{36}"))return;
  if(!NotificationManagerCompat.from(context).areNotificationsEnabled())return;
  String call=message.getStringExtra("callId"),room=message.getStringExtra("roomId");
  try{
   JSONObject data=new JSONObject().put("owner",owner).put("notificationId",id);
   if(call!=null&&call.matches("[a-fA-F0-9-]{36}"))data.put("callId",call);
   if(room!=null&&room.matches("[a-fA-F0-9-]{36}"))data.put("roomId",room);
   Intent launch=context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());if(launch==null)return;
   launch.putExtra("mymap_push",data.toString()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
   NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
   if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("mymap_remote","Tin nhắn và cuộc gọi MyMap",NotificationManager.IMPORTANCE_HIGH));
   PendingIntent open=PendingIntent.getActivity(context,id.hashCode(),launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   NotificationCompat.Builder notification=new NotificationCompat.Builder(context,"mymap_remote").setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Thông báo MyMap").setContentText(call!=null?"Bạn có lời mời tham gia cuộc gọi.":"Bạn có hoạt động mới. Mở MyMap để xem.").setContentIntent(open).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(call!=null?NotificationCompat.CATEGORY_CALL:NotificationCompat.CATEGORY_MESSAGE).setVisibility(NotificationCompat.VISIBILITY_PRIVATE);
   // Stable notification ID replaces duplicate ADM deliveries. No full-screen intent.
   manager.notify(id.hashCode(),notification.build());
  }catch(Exception ignored){/* Inbox remains authoritative; no payload/token logging. */}
 }
}
