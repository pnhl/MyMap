package com.pnhl.vibecoding

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.RemoteViews
import androidx.work.*
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class MomentWidget:AppWidgetProvider(){
 override fun onUpdate(context:Context,manager:AppWidgetManager,ids:IntArray){render(context);schedule(context);refresh(context)}
 override fun onDeleted(context:Context,ids:IntArray){if(AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context,MomentWidget::class.java)).isEmpty())WorkManager.getInstance(context).cancelUniqueWork("mymap-moments-periodic")}
 companion object{
  fun prefs(c:Context)=c.getSharedPreferences("mymap_moment_widget",Context.MODE_PRIVATE)
  fun clear(c:Context){prefs(c).edit().remove("snapshot").apply();File(c.filesDir,"moment-widget-cover.jpg").delete();render(c)}
  fun render(c:Context){
   val manager=AppWidgetManager.getInstance(c);val ids=manager.getAppWidgetIds(ComponentName(c,MomentWidget::class.java))
   val data=runCatching{JSONObject(prefs(c).getString("snapshot","{}")?:"{}")}.getOrDefault(JSONObject())
   ids.forEach{id->
    val views=RemoteViews(c.packageName,R.layout.mymap_moment_widget)
    views.setTextViewText(R.id.moment_author,data.optString("author","MyMap"))
    views.setTextViewText(R.id.moment_caption,data.optString("caption","Mở MyMap để chọn khoảnh khắc"))
    val file=runCatching{File(Uri.parse(data.optString("image")).path?:"").canonicalFile}.getOrNull()
    if(file!=null&&file.isFile&&listOf(c.filesDir,c.cacheDir).any{file.path.startsWith(it.canonicalPath+File.separator)}){
     val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeFile(file.path,bounds)
     val options=BitmapFactory.Options().apply{inSampleSize=1;while(bounds.outWidth/inSampleSize>384||bounds.outHeight/inSampleSize>384)inSampleSize*=2}
     val bitmap=BitmapFactory.decodeFile(file.path,options);if(bitmap!=null)views.setImageViewBitmap(R.id.moment_image,bitmap)
    }else views.setImageViewResource(R.id.moment_image,R.mipmap.ic_launcher)
    val moment=data.optString("id");val url=if(moment.isNotBlank())"mymap://moment/$moment" else "mymap://moments"
    val open=Intent(c,MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    views.setOnClickPendingIntent(R.id.moment_widget_root,PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    val camera=Intent(c,MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse("mymap://camera"))
    views.setOnClickPendingIntent(R.id.moment_camera,PendingIntent.getActivity(c,id+100000,camera,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    manager.updateAppWidget(id,views)
   }
  }
  fun schedule(c:Context){
   if(AppWidgetManager.getInstance(c).getAppWidgetIds(ComponentName(c,MomentWidget::class.java)).isEmpty())return
   val job=PeriodicWorkRequestBuilder<MomentWidgetWorker>(15,TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
   WorkManager.getInstance(c).enqueueUniquePeriodicWork("mymap-moments-periodic",ExistingPeriodicWorkPolicy.KEEP,job)
  }
  fun refresh(c:Context){WorkManager.getInstance(c).enqueueUniqueWork("mymap-moments-refresh",ExistingWorkPolicy.KEEP,OneTimeWorkRequestBuilder<MomentWidgetWorker>().build())}
 }
}
