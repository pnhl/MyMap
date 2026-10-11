const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patchAndroid,patchIos,applyPatch}=require('../scripts/maplibre-privacy-patch.cjs');
test('native transform log sinks suppress header/URL values while preserving header installation',()=>{
 const androidFile='node_modules/@maplibre/maplibre-react-native/android/src/main/java/org/maplibre/reactnative/modules/TransformRequestInterceptor.kt';
 const iosFile='node_modules/@maplibre/maplibre-react-native/ios/modules/transform-request/MLRNTransformRequest.m';
 const android=patchAndroid(fs.readFileSync(androidFile,'utf8')),ios=patchIos(fs.readFileSync(iosFile,'utf8'));
 assert.equal(patchAndroid(android),android);assert.equal(patchIos(ios),ios);
 for(const source of [android,ios]){
  const sinks=source.match(/(?:private fun (?:debugLog|errorLog)\(message: String\)|- \(void\)(?:debugLog|errorLog):\(NSString \*\)message) \{[\s\S]*?\n(?:    )?\}/g);
  assert.equal(sinks.length,2);
  for(const sink of sinks){assert.doesNotMatch(sink,/(?:Log\.[de]\(TAG, message|NSLog\(@"[^\n]+, message|invoke\([^\n]+message|logCallback\([^\n]+message)/);assert.match(sink,/MyMap privacy/);}
 }
 assert.match(android,/requestBuilder\.header\(config\.name, config\.value\)/);
 assert.match(ios,/\[request setValue:config\.value forHTTPHeaderField:config\.name\]/);
 assert.throws(()=>patchAndroid('changed upstream'),/upstream review/);
 assert.throws(()=>patchIos('changed upstream'),/upstream review/);
});
test('all native build entry points install the privacy patch before compiling',()=>{
 for(const file of ['app.config.ts','scripts/patch-android-dependencies.cjs','scripts/prepare-ios-ai.cjs'])assert.match(fs.readFileSync(file,'utf8'),/maplibre-privacy-patch\.cjs/);
 applyPatch();
});
