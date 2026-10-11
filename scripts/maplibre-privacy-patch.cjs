// MapLibre 11.4.0 request diagnostics include Authorization values. Suppress
// debug output and sanitize errors at the native logging sinks on BOTH stores.
const fs=require('node:fs'),path=require('node:path');
function patchAndroid(source) {
 let count=0;
 const result=source.replace(/private fun (debugLog|errorLog)\(message: String\) \{[\s\S]*?\n    \}/g,(_,kind)=>{
  count++;
  return `private fun ${kind}(message: String) {\n        // MyMap privacy: never emit request URLs, headers or token values.\n${kind==='errorLog'?'        Log.e(TAG, "Map request transform failed")\n        jsLogger?.invoke("error", TAG, "Map request transform failed")\n':''}    }`;
 });
 if(count!==2)throw Error('MapLibre Android logging patch needs upstream review.');
 return result;
}
function patchIos(source) {
 let count=0;
 const result=source.replace(/- \(void\)(debugLog|errorLog):\(NSString \*\)message \{[\s\S]*?\n\}/g,(_,kind)=>{
  count++;
  return `- (void)${kind}:(NSString *)message {\n  // MyMap privacy: never emit request URLs, headers or token values.\n  (void)message;\n${kind==='errorLog'?'  NSLog(@"[TransformRequest] Map request transform failed");\n  if (self.logCallback) self.logCallback(@"error", @"TransformRequest", @"Map request transform failed");\n':''}}`;
 });
 if(count!==2)throw Error('MapLibre iOS logging patch needs upstream review.');
 return result;
}
function applyPatch(root=path.resolve(__dirname,'..')) {
 const directory=path.join(root,'node_modules/@maplibre/maplibre-react-native');
 if(JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8')).version!=='11.4.0')throw Error('Review MapLibre privacy patch before upgrading.');
 for(const [file,patch]of [
  ['android/src/main/java/org/maplibre/reactnative/modules/TransformRequestInterceptor.kt',patchAndroid],
  ['ios/modules/transform-request/MLRNTransformRequest.m',patchIos],
 ]){
  const target=path.join(directory,file),source=fs.readFileSync(target,'utf8'),updated=patch(source);
  if(updated!==source)fs.writeFileSync(target,updated);
 }
}
if(require.main===module){applyPatch();console.log('MapLibre native request logging privacy patch applied.');}
module.exports={patchAndroid,patchIos,applyPatch};
