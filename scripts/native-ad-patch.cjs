// The installed native module never rejects its load promise on SDK failures.
// Keep the fix reproducible after npm install and fail loudly on an incompatible upstream change.
function patchNativeAdFailures(source) {
  if(source.includes('// MyMap: propagate native load failures'))return source;
  if(source.includes('override fun onAdFailedToLoad'))return source;
  const replace=(before,after)=>{if(!source.includes(before))throw Error('Native Ad bridge changed: '+before);source=source.replace(before,after);};
  replace('import com.google.android.gms.ads.AdLoader','import com.google.android.gms.ads.AdLoader\nimport com.google.android.gms.ads.LoadAdError');
  replace('val holder = NativeAdHolder(adUnitId, requestOptions)',`val holder = NativeAdHolder(adUnitId, requestOptions) { error ->
      // MyMap: propagate native load failures
      val details = Arguments.createMap()
      details.putInt("nativeCode", error.code)
      details.putString("domain", error.domain)
      details.putString("responseInfo", error.responseInfo?.toString())
      val code = ReactNativeGoogleMobileAdsCommon.getCodeAndMessageFromAdError(error)[0]
      promise.reject(code, error.message, details)
    }`);
  replace('val responseId = nativeAd.responseInfo?.responseId ?: return@loadAd',`val responseId = nativeAd.responseInfo?.responseId ?: java.util.UUID.randomUUID().toString()`);
  replace('private val requestOptions: ReadableMap) {','private val requestOptions: ReadableMap, private val failedListener: (LoadAdError) -> Unit) {');
  replace('private val adListener: AdListener = object : AdListener() {',`private val adListener: AdListener = object : AdListener() {
      override fun onAdFailedToLoad(error: LoadAdError) {
        failedListener(error)
      }`);
  return source;
}
module.exports={patchNativeAdFailures};
