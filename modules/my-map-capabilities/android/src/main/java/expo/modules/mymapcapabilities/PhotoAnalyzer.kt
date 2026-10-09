package expo.modules.mymapcapabilities

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise

internal object PhotoAnalyzer {
  fun analyze(context: Context, value: String, promise: Promise) {
    var bitmap: Bitmap? = null
    try {
      val uri=Uri.parse(value)
      require(uri.scheme=="file" || uri.scheme=="content") { "Only local photos are accepted" }
      val bounds=BitmapFactory.Options().apply { inJustDecodeBounds=true }
      context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it,null,bounds) }
      require(bounds.outWidth>0&&bounds.outHeight>0) { "Invalid image" }
      var sample=1;while(bounds.outWidth/sample>2048 || bounds.outHeight/sample>2048)sample*=2
      val options=BitmapFactory.Options().apply { inSampleSize=sample }
      val source=context.contentResolver.openInputStream(uri).use { BitmapFactory.decodeStream(it,null,options) }?:error("Image decode failed")
      val orientation=context.contentResolver.openInputStream(uri).use { stream->if(stream!=null)ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION,1)else 1 }
      val matrix=Matrix().apply { when(orientation){2->setScale(-1f,1f);3->setRotate(180f);4->setScale(1f,-1f);5->{setRotate(90f);postScale(-1f,1f)};6->setRotate(90f);7->{setRotate(270f);postScale(-1f,1f)};8->setRotate(270f)} }
      val imageBitmap=if(orientation==1)source else Bitmap.createBitmap(source,0,0,source.width,source.height,matrix,true).also { if(it!==source)source.recycle() }
      bitmap=imageBitmap
      val tiny=Bitmap.createScaledBitmap(imageBitmap,9,8,true)
      fun gray(x:Int,y:Int):Int {val color=tiny.getPixel(x,y);return(Color.red(color)*299+Color.green(color)*587+Color.blue(color)*114)/1000}
      var hash=0L;for(y in 0..7)for(x in 0..7){hash=hash shl 1;if(gray(x,y)>gray(x+1,y))hash=hash or 1L}
      if(tiny!==imageBitmap)tiny.recycle()
      val dhash=java.lang.Long.toUnsignedString(hash,16).padStart(16,'0')
      val image=InputImage.fromBitmap(imageBitmap,0)
      val text=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      val labels=ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)
      text.process(image).addOnSuccessListener { recognized ->
        labels.process(image).addOnSuccessListener { result ->
          promise.resolve(mapOf("text" to recognized.text.take(20000),"labels" to result.filter { it.confidence>=0.6 }.take(12).map { mapOf("label" to it.text,"confidence" to it.confidence) },"dhash" to dhash,"provider" to "MLKit"))
        }.addOnFailureListener { promise.reject("PHOTO_LABELS",it.message,it) }.addOnCompleteListener { text.close();labels.close();imageBitmap.recycle() }
      }.addOnFailureListener { text.close();labels.close();imageBitmap.recycle();promise.reject("PHOTO_TEXT",it.message,it) }
    } catch(error: Exception) { bitmap?.recycle();promise.reject("PHOTO_ANALYSIS",error.message,error) }
  }
}
