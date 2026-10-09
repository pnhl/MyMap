package com.pnhl.vibecoding.wear
import android.app.Activity
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject
class MyMapWearActivity:Activity(){
 private lateinit var status:TextView
 override fun onCreate(state:Bundle?){super.onCreate(state);val layout=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(28,32,28,20)};status=TextView(this).apply{textSize=16f};val sos=Button(this).apply{text="Yêu cầu SOS";setOnClickListener{isEnabled=false;status.text="Đang kết nối điện thoại…";Wearable.getCapabilityClient(this@MyMapWearActivity).getCapability("mymap_phone",CapabilityClient.FILTER_REACHABLE).addOnSuccessListener{info->val node=info.nodes.firstOrNull();if(node==null){status.text="Không tìm thấy MyMap trên điện thoại. Bật tiện ích Wear OS và kết nối lại.";isEnabled=true}else Wearable.getMessageClient(this@MyMapWearActivity).sendMessage(node.id,"/mymap/sos",byteArrayOf(1)).addOnSuccessListener{status.text="Đã gửi yêu cầu. Xác nhận SOS trên điện thoại để gọi.";isEnabled=true}.addOnFailureListener{status.text="Chưa gửi được. Hãy dùng SOS trên điện thoại.";isEnabled=true}}.addOnFailureListener{status.text="Không kết nối được điện thoại.";isEnabled=true}}};layout.addView(status);layout.addView(sos);setContentView(layout)}
 override fun onResume(){super.onResume();val prefs=getSharedPreferences("alerts",MODE_PRIVATE);val at=prefs.getLong("timestamp",0);status.text=if(System.currentTimeMillis()-at<900000)prefs.getString("message","MyMap")else"MyMap · SOS\nCần điện thoại đã ghép đôi. Cảnh báo gần nhất tự hết hạn sau 15 phút."}
}
class MyMapWearListener:WearableListenerService(){
 override fun onMessageReceived(event:MessageEvent){if(event.path!="/mymap/alert"||event.data.size>2048)return;runCatching{val data=JSONObject(String(event.data,Charsets.UTF_8));val at=data.getLong("timestamp");if(kotlin.math.abs(System.currentTimeMillis()-at)>120000||data.getString("type") !in listOf("sos","geofence"))return;getSharedPreferences("alerts",MODE_PRIVATE).edit().putString("message",data.getString("message").take(240)).putLong("timestamp",at).apply();(getSystemService(VIBRATOR_SERVICE) as? Vibrator)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0,300,100,300),-1))}}
}
