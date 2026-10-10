package expo.modules.mymapcapabilities
import org.junit.Assert.*
import org.junit.Test
class GoogleServicesGateTest {
 @Test fun noGoogleClassesAtColdStart(){
  val noGoogle=object:ClassLoader(){override fun loadClass(name:String):Class<*>{if(name.startsWith("com.google."))throw ClassNotFoundException(name);return super.loadClass(name)}}
  assertFalse(GoogleServicesGate.available{noGoogle.loadClass("com.google.android.gms.common.GoogleApiAvailability");0})
 }
 @Test fun brokenNativeLinkageAndMissingServicesAreUnavailable(){
  assertFalse(GoogleServicesGate.available{throw NoClassDefFoundError("GMS absent")})
  assertFalse(GoogleServicesGate.available{1})
  assertTrue(GoogleServicesGate.available{0})
 }
}
