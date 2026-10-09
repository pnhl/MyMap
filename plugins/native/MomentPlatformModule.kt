package com.pnhl.vibecoding

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.AbsoluteSizeSpan
import androidx.core.content.FileProvider
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.effect.StaticOverlaySettings
import androidx.media3.effect.TextOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.facebook.react.bridge.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

@UnstableApi
class MomentPlatformModule(private val app:ReactApplicationContext):ReactContextBaseJavaModule(app){
 override fun getName()="MomentPlatform"
 private var transformer:Transformer?=null
 private var exportPromise:Promise?=null
 private var output:File?=null
 private val main=Handler(Looper.getMainLooper())
 private fun privateFile(uri:String):File{
  val parsed=Uri.parse(uri)
  require(parsed.scheme=="file") {"Only app-private local media can be exported."}
  val f=File(requireNotNull(parsed.path)).canonicalFile
  require(listOf(app.filesDir,app.cacheDir).any{f.path.startsWith(it.canonicalPath+File.separator)}&&f.isFile){"Media is outside MyMap storage."}
  return f
 }
 @ReactMethod fun exportRecap(json:String,promise:Promise){main.post{
  if(transformer!=null){promise.reject("EXPORT_BUSY","A recap is already being exported.");return@post}
  try{
   val request=JSONObject(json);val account=request.getString("account")
   require(account.matches(Regex("[A-Za-z0-9_-]{1,128}"))) {"Invalid account storage key."}
   val inputs=request.getJSONArray("items");require(inputs.length() in 1..20)
   val items=ArrayList<EditedMediaItem>()
   for(i in 0 until inputs.length()){
    val data=inputs.getJSONObject(i);val f=privateFile(data.getString("uri"));val photo=data.getString("kind")=="photo"
    val duration=data.getLong("durationMs").coerceIn(100,10000)
    val media=MediaItem.Builder().setUri(Uri.fromFile(f))
    if(photo)media.setImageDurationMs(duration) else media.setClippingConfiguration(MediaItem.ClippingConfiguration.Builder().setEndPositionMs(duration).build())
    val label=SpannableString(data.optString("label").take(80))
    label.setSpan(ForegroundColorSpan(android.graphics.Color.WHITE),0,label.length,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    label.setSpan(AbsoluteSizeSpan(20,true),0,label.length,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    val settings=StaticOverlaySettings.Builder().setBackgroundFrameAnchor(-.88f,-.88f).setOverlayFrameAnchor(-1f,-1f).build()
    val overlay=OverlayEffect(listOf(TextOverlay.createStaticTextOverlay(label,settings)))
    val edited=EditedMediaItem.Builder(media.build()).setRemoveAudio(true).setFrameRate(24)
      .setEffects(Effects(emptyList(),listOf(Presentation.createForWidthAndHeight(720,1280,Presentation.LAYOUT_SCALE_TO_FIT),overlay))).build()
    items.add(edited)
   }
   val dir=File(app.filesDir,"mymap-recaps/$account").apply{mkdirs()};val file=File(dir,"MyMap-recap-${System.currentTimeMillis()}.mp4")
   output=file;exportPromise=promise
   val composition=Composition.Builder(EditedMediaItemSequence.withVideoFrom(items)).build()
   val export=Transformer.Builder(app).setVideoMimeType(MimeTypes.VIDEO_H264)
    .addListener(object:Transformer.Listener{
     override fun onCompleted(composition:Composition,result:ExportResult){transformer=null;output=null;exportPromise=null;promise.resolve(Uri.fromFile(file).toString())}
     override fun onError(composition:Composition,result:ExportResult,error:ExportException){file.delete();transformer=null;output=null;exportPromise=null;promise.reject("EXPORT_FAILED","Thiết bị chưa xuất được video tổng kết: ${error.message}",error)}
    }).build()
   transformer=export;export.start(composition,file.absolutePath)
  }catch(e:Exception){output?.delete();output=null;transformer=null;exportPromise=null;promise.reject("EXPORT_INVALID",e.message,e)}
 }}
 @ReactMethod fun cancelRecap(promise:Promise){main.post{transformer?.cancel();transformer=null;output?.delete();output=null;exportPromise?.reject("EXPORT_CANCELLED","Đã hủy xuất video.");exportPromise=null;promise.resolve(true)}}
 @ReactMethod fun shareFile(uri:String,promise:Promise){try{
  val f=privateFile(uri);val shared=FileProvider.getUriForFile(app,app.packageName+".moments.files",f)
  val type=if(f.extension=="mp4")"video/mp4" else "image/jpeg"
  val intent=Intent(Intent.ACTION_SEND).setType(type).putExtra(Intent.EXTRA_STREAM,shared).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  app.startActivity(Intent.createChooser(intent,"Chia sẻ khoảnh khắc").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));promise.resolve(true)
 }catch(e:Exception){promise.reject("SHARE_FAILED",e.message,e)}}
 @ReactMethod fun configureWidget(json:String,promise:Promise){try{
  val config=JSONObject(json);require(config.optString("url")=="https://uwlxysystowwnfvdmfzo.supabase.co")
  val prefs=MomentWidget.prefs(app);val old=JSONObject(prefs.getString("config","{}")?:"{}")
  if(old.optString("account")!=config.optString("account"))MomentWidget.clear(app)
  prefs.edit().putString("config",json).apply();MomentWidget.schedule(app);promise.resolve(true)
 }catch(e:Exception){promise.reject("WIDGET_CONFIG",e.message,e)}}
 @ReactMethod fun widgetConfig(promise:Promise){promise.resolve(MomentWidget.prefs(app).getString("config","{}"))}
 @ReactMethod fun setWidgetSnapshot(json:String,promise:Promise){try{
  val snapshot=JSONObject(json);privateFile(snapshot.getString("image"));MomentWidget.prefs(app).edit().putString("snapshot",json).apply();MomentWidget.render(app);promise.resolve(true)
 }catch(e:Exception){promise.reject("WIDGET_IMAGE",e.message,e)}}
 @ReactMethod fun clearWidget(promise:Promise){MomentWidget.clear(app);promise.resolve(true)}
 @ReactMethod fun refreshWidget(promise:Promise){MomentWidget.refresh(app);promise.resolve(true)}
 @ReactMethod fun pinWidget(promise:Promise){
  val manager=AppWidgetManager.getInstance(app)
  if(Build.VERSION.SDK_INT>=26&&manager.isRequestPinAppWidgetSupported){promise.resolve(manager.requestPinAppWidget(ComponentName(app,MomentWidget::class.java),null,null))}else promise.resolve(false)
 }
 override fun invalidate(){main.post{transformer?.cancel();transformer=null;output?.delete();output=null;exportPromise?.reject("EXPORT_CANCELLED","Ứng dụng đã đóng.");exportPromise=null};super.invalidate()}
}
