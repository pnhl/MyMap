package expo.modules.mymapcapabilities

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.Promise
import java.util.concurrent.atomic.AtomicBoolean

/** Use the guaranteed on-device recognizer only; EXTRA_PREFER_OFFLINE alone is not a guarantee. */
class SpeechInput {
  private val main=Handler(Looper.getMainLooper())
  private var cancellation:(()->Unit)?=null
  fun available(context:Context)=Build.VERSION.SDK_INT>=31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
  fun cancel(){main.post {cancellation?.invoke()}}
  fun listen(context:Context,language:String,promise:Promise){main.post {
    cancellation?.invoke()
    if(!available(context)){promise.reject("SPEECH_UNAVAILABLE","Thiết bị chưa có bộ nhận dạng giọng nói ngoại tuyến (Android 12 trở lên).",null);return@post}
    if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){promise.reject("SPEECH_PERMISSION","Cần quyền micro để tìm kiếm bằng giọng nói.",null);return@post}
    val done=AtomicBoolean(false)
    val recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
    var timeout:Runnable?=null
    fun finish(text:String?,reason:String?){
      if(!done.compareAndSet(false,true))return
      timeout?.let {main.removeCallbacks(it)}
      cancellation=null
      recognizer.cancel();recognizer.destroy()
      if(text!=null && text.isNotBlank())promise.resolve(mapOf("text" to text.take(300),"offline" to true))
      else promise.reject("SPEECH_RESULT",reason?:"Chưa nghe rõ. Hãy thử lại.",null)
    }
    cancellation={finish(null,"Đã dừng nhận dạng giọng nói.")}
    recognizer.setRecognitionListener(object:RecognitionListener {
      override fun onReadyForSpeech(params:Bundle?){}
      override fun onBeginningOfSpeech(){}
      override fun onRmsChanged(rmsdB:Float){}
      override fun onBufferReceived(buffer:ByteArray?){}
      override fun onEndOfSpeech(){}
      override fun onPartialResults(partialResults:Bundle?){}
      override fun onEvent(eventType:Int,params:Bundle?){}
      override fun onError(error:Int){finish(null,when(error){SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE,SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED->"Chưa cài dữ liệu giọng nói cho ngôn ngữ này.";SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS->"Chưa cấp quyền micro.";else->"Chưa nhận dạng được giọng nói. Hãy thử lại."})}
      override fun onResults(results:Bundle?){finish(results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull(),null)}
    })
    timeout=Runnable {finish(null,"Hết thời gian nghe. Hãy thử lại.")}
    main.postDelayed(timeout!!,15000)
    try{recognizer.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,language).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,false).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1).putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true))}
    catch(e:Exception){finish(null,"Không mở được bộ nhận dạng ngoại tuyến.")}
  }}
}
