package expo.modules.mymapcapabilities
import expo.modules.kotlin.Promise
/** Fire OS uses the RN GGUF engine and does not bundle the AICore dependency. */
class NanoAi {
 fun run(action:String,input:String,promise:Promise){if(action=="status")promise.resolve(mapOf("status" to "unavailable"))else promise.reject("AI_UNAVAILABLE","Gemini Nano không hỗ trợ bản Fire OS. Hãy chọn mô hình cục bộ.",null)}
 fun cancel(){}
 fun close(){}
}
