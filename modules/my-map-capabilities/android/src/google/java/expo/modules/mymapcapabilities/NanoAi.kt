package expo.modules.mymapcapabilities

import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect

/** AICore owns model downloads. No prompts or responses are persisted or logged. */
class NanoAi {
  private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Default)
  private var job:Job?=null
  @Synchronized fun run(action:String,input:String,promise:Promise) {
    if(job?.isActive==true){promise.reject("AI_BUSY","AI đang xử lý. Hãy dừng hoặc chờ hoàn tất.",null);return}
    job=scope.launch {
      var model:GenerativeModel?=null
      try {
        val engine=Generation.getClient();model=engine
        val status=withTimeout(15000){engine.checkStatus()}
        if(action=="status") {
          promise.resolve(mapOf("status" to when(status){FeatureStatus.AVAILABLE->"available";FeatureStatus.DOWNLOADABLE->"downloadable";FeatureStatus.DOWNLOADING->"downloading";else->"unavailable"}))
        } else if(action=="download") {
          if(status!=FeatureStatus.AVAILABLE&&status!=FeatureStatus.DOWNLOADABLE)throw IllegalStateException("Gemini Nano chưa khả dụng trên máy này.")
          if(status==FeatureStatus.DOWNLOADABLE)withTimeout(600000){engine.download().collect {update->if(update is DownloadStatus.DownloadFailed)throw update.e}}
          promise.resolve(mapOf("status" to if(engine.checkStatus()==FeatureStatus.AVAILABLE)"available" else "downloading"))
        } else {
          require(action=="generate"&&input.isNotBlank()&&input.length<=6000){"Nội dung cần 1–6.000 ký tự."}
          if(status!=FeatureStatus.AVAILABLE)throw IllegalStateException("Tải Gemini Nano trước khi sử dụng.")
          val response=withTimeout(60000){engine.generateContent(generateContentRequest(TextPart(input)){temperature=0.3f;maxOutputTokens=512})}
          val text=response.candidates.firstOrNull()?.text?.trim().orEmpty()
          if(text.isBlank())throw IllegalStateException("Mô hình chưa trả lời được yêu cầu này.")
          ensureActive();promise.resolve(text.take(10000))
        }
      }catch(e:TimeoutCancellationException){promise.reject("AI_TIMEOUT","AI chưa hoàn tất trong thời gian cho phép. Hãy thử nội dung ngắn hơn.",null)}
      catch(e:CancellationException){promise.reject("AI_CANCELED","Đã dừng AI.",null)}
      catch(e:Exception){promise.reject("AI_UNAVAILABLE","AI trên thiết bị chưa sẵn sàng hoặc đã đạt giới hạn sử dụng. Kiểm tra AICore/mô hình rồi thử lại.",null)}
      finally{model?.close()}
    }
  }
  @Synchronized fun cancel(){job?.cancel()}
  fun close(){scope.cancel()}
}
