package expo.modules.mymapcapabilities

import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import androidx.fragment.app.FragmentActivity
import androidx.core.content.ContextCompat
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.speech.tts.TextToSpeech
import android.util.Base64
import android.view.WindowManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.MessageDigest
import java.io.File
import android.net.Uri
import java.security.spec.ECGenParameterSpec
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MyMapCapabilitiesModule: Module() {
  private val speechInput=SpeechInput()
  private var nano:NanoAi?=null
  private fun gmsAvailable(context:Context):Boolean=GoogleServicesGate.available{
    val type=Class.forName("com.google.android.gms.common.GoogleApiAvailability")
    val instance=type.getMethod("getInstance").invoke(null)
    type.getMethod("isGooglePlayServicesAvailable",Context::class.java).invoke(instance,context) as Int
  }
  private fun nanoAvailable():Boolean {
    if(!BuildConfig.NANO_ENABLED||Build.VERSION.SDK_INT<26||appContext.reactContext?.let{gmsAvailable(it)}!=true)return false
    return try{appContext.reactContext?.packageManager?.getPackageInfo("com.google.android.aicore",0)!=null}catch(_:Exception){false}
  }
  private var speech: TextToSpeech? = null
  private var cancellation: CancellationSignal? = null
  private var speechGeneration=0
  private fun store() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
  @Synchronized private fun encryptionKey(): SecretKey {
    val existing = store().getKey("mymap.vault.v1",null)
    if(existing != null) return existing as SecretKey
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder("mymap.vault.v1",KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  private fun b64(bytes:ByteArray) = Base64.encodeToString(bytes,Base64.NO_WRAP)
  @Synchronized private fun signingKey(): java.security.PrivateKey {
    val alias="mymap.proof.v1"
    if(!store().containsAlias(alias))KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore").apply{
      initialize(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
        .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1")).setDigests(KeyProperties.DIGEST_SHA256).build())
    }.generateKeyPair()
    return store().getKey(alias,null) as java.security.PrivateKey
  }
  override fun definition() = ModuleDefinition {
    Name("MyMapCapabilities")
    Function("runtimeCapabilities") {
      val context=appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      val pm=context.packageManager
      // Reflection keeps Google classes out of the Fire startup linkage graph.
      val gms=gmsAvailable(context)
      val sensors=context.getSystemService(Context.SENSOR_SERVICE) as android.hardware.SensorManager
      val memory=ActivityManager.MemoryInfo();(context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
      val credential=BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL)==BiometricManager.BIOMETRIC_SUCCESS
      val dialer=android.content.Intent(android.content.Intent.ACTION_DIAL,Uri.parse("tel:112")).resolveActivity(pm)!=null
      val adm=try{val type=Class.forName("com.amazon.device.messaging.ADM");type.getMethod("isSupported").invoke(type.getConstructor(Context::class.java).newInstance(context)) as Boolean}catch(_:Exception){false}catch(_:LinkageError){false}
      mapOf("gms" to gms,"locationProvider" to "system","accelerometer" to (sensors.getDefaultSensor(android.hardware.Sensor.TYPE_ACCELEROMETER)!=null),"barometer" to (sensors.getDefaultSensor(android.hardware.Sensor.TYPE_PRESSURE)!=null),"deviceCredential" to credential,"dialer" to dialer,"local64Bit" to android.os.Process.is64Bit(),"totalBytes" to memory.totalMem.toDouble(),"ads" to (BuildConfig.NANO_ENABLED&&gms),"push" to if(BuildConfig.NANO_ENABLED&&gms) "fcm" else if(adm) "adm" else "unavailable")
    }
    // Stream the checksum in native code to avoid copying a ~500 MB model into JS memory.
    AsyncFunction("hashAiModel") { uri:String ->
      val context=appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      val parsed=Uri.parse(uri)
      require(parsed.scheme=="file") { "Invalid model URI" }
      val file=File(parsed.path ?: "").canonicalFile
      val directory=File(context.filesDir,"mymap/ai").canonicalFile
      require(file.parentFile==directory&&file.name.matches(Regex("model-[a-f0-9-]+\\.gguf"))&&file.isFile&&file.length() in 8L..786432000L) { "Invalid private model file" }
      val digest=MessageDigest.getInstance("SHA-256")
      file.inputStream().use { input -> val buffer=ByteArray(65536);var count=input.read(buffer);while(count>=0){if(count>0)digest.update(buffer,0,count);count=input.read(buffer)} }
      digest.digest().joinToString(""){"%02x".format(it.toInt() and 255)}
    }
    AsyncFunction("aiHardware") {
      val memory=ActivityManager.MemoryInfo()
      (appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager)?.getMemoryInfo(memory)
      mapOf("local64Bit" to android.os.Process.is64Bit(),"availableBytes" to memory.availMem.toDouble(),"totalBytes" to memory.totalMem.toDouble(),"nanoSupported" to nanoAvailable())
    }
    AsyncFunction("nanoAi") {action:String,input:String,promise:Promise ->
      if(!nanoAvailable()){if(action=="status")promise.resolve(mapOf("status" to "unavailable"))else promise.reject("AI_UNAVAILABLE","Máy này không có AICore tương thích. Hãy chọn mô hình cục bộ.",null)}
      else {if(nano==null)nano=NanoAi();nano!!.run(action,input,promise)}
    }
    AsyncFunction("stopAi") {nano?.cancel()}
    AsyncFunction("speechInputAvailable") {appContext.reactContext?.let {speechInput.available(it)} ?: false}
    AsyncFunction("recognizeSpeech") {language:String,promise:Promise ->
      val context=appContext.reactContext
      if(context==null)promise.reject("SPEECH_CONTEXT","Application context unavailable",null)else speechInput.listen(context,language,promise)
    }
    AsyncFunction("stopRecognition") {speechInput.cancel()}
    AsyncFunction("setPrivateScreen") { enabled:Boolean ->
      val activity=appContext.currentActivity
      activity?.runOnUiThread { if(enabled)activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
    }
    AsyncFunction("analyzePhoto") { uri:String,promise:Promise ->
      val context=appContext.reactContext
      if(context==null)promise.reject("PHOTO_CONTEXT","Application context unavailable",null)
      else PhotoAnalyzer.analyze(context,uri,promise)
    }
    AsyncFunction("authenticate") { reason:String, promise:Promise ->
      val activity=appContext.currentActivity
      if(activity !is FragmentActivity) { promise.resolve(false);return@AsyncFunction }
      activity.runOnUiThread {
        val settled=AtomicBoolean(false)
        fun finish(success:Boolean){if(settled.compareAndSet(false,true))promise.resolve(success)}
        val authenticators=BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if(BiometricManager.from(activity).canAuthenticate(authenticators)!=BiometricManager.BIOMETRIC_SUCCESS){finish(false);return@runOnUiThread}
        val prompt=BiometricPrompt(activity,ContextCompat.getMainExecutor(activity),object:BiometricPrompt.AuthenticationCallback(){
          override fun onAuthenticationSucceeded(result:BiometricPrompt.AuthenticationResult){finish(true)}
          override fun onAuthenticationError(code:Int,message:CharSequence){finish(false)}
        })
        prompt.authenticate(BiometricPrompt.PromptInfo.Builder().setTitle("MyMap").setDescription(reason.take(160)).setAllowedAuthenticators(authenticators).build())
      }
    }
    AsyncFunction("encrypt") { value:String ->
      val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,encryptionKey())
      b64(cipher.iv+cipher.doFinal(value.toByteArray(Charsets.UTF_8)))
    }
    AsyncFunction("decrypt") { value:String ->
      val bytes=Base64.decode(value,Base64.DEFAULT);require(bytes.size>=28){"Invalid vault payload"}
      val cipher=Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE,encryptionKey(),GCMParameterSpec(128,bytes.copyOfRange(0,12)))
      String(cipher.doFinal(bytes.copyOfRange(12,bytes.size)),Charsets.UTF_8)
    }
    AsyncFunction("sign") { value:String ->
      val alias="mymap.proof.v1"
      val signer=Signature.getInstance("SHA256withECDSA");signer.initSign(signingKey())
      signer.update(value.toByteArray(Charsets.UTF_8))
      mapOf("signature" to b64(signer.sign()),"publicKey" to b64(store().getCertificate(alias).publicKey.encoded),"algorithm" to "ECDSA-P256-SHA256-SPKI-DER")
    }
    AsyncFunction("speak") { text:String, language:String, promise:Promise ->
      val context=appContext.reactContext
      if(context==null){promise.resolve(false);return@AsyncFunction}
      Handler(Looper.getMainLooper()).post {
        val generation=++speechGeneration
        speech?.stop();speech?.shutdown()
        speech=TextToSpeech(context) { result ->
          if(generation!=speechGeneration){promise.resolve(false)}
          else {
            val engine=speech
            if(result!=TextToSpeech.SUCCESS || engine==null){promise.resolve(false)}
            else {
              val locale=Locale.forLanguageTag(language)
              val voice=engine.voices?.filter { it.locale.language==locale.language && !it.isNetworkConnectionRequired }
                ?.sortedByDescending { it.locale.country==locale.country }?.firstOrNull()
              promise.resolve(voice!=null && engine.setVoice(voice)==TextToSpeech.SUCCESS && engine.speak(text.take(1000),TextToSpeech.QUEUE_FLUSH,null,"mymap-guidance")==TextToSpeech.SUCCESS)
            }
          }
        }
      }
    }
    AsyncFunction("stopSpeaking") { Handler(Looper.getMainLooper()).post { speechGeneration++;speech?.stop() } }
    OnActivityEntersBackground {nano?.cancel();speechInput.cancel();cancellation?.cancel();speechGeneration++;speech?.stop()}
    OnDestroy {nano?.close();nano=null;speechInput.cancel();cancellation?.cancel();speech?.stop();speech?.shutdown();speech=null }
  }
}
