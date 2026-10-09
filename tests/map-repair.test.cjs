const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const prefs = {avoidFerries:false,avoidHighways:false,avoidUnpaved:false};
function load(relative, globals={}, mocks={}) {
  const filename=path.resolve(__dirname,'../src',relative);
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,Date,process:{env:{}},...globals,require:name=>{
    if(name in mocks)return mocks[name];
    if(name==='@react-native-async-storage/async-storage')return {getItem:async()=>null,setItem:async()=>{}};
    if(name==='./navigationPreferences')return {getNavigationPreferences:async()=>prefs};
    if(name.startsWith('.'))return load(path.relative(path.resolve(__dirname,'../src'),path.resolve(path.dirname(filename),name+'.ts')),globals,mocks);
    throw Error('Missing mock '+name);
  }},{filename});return module.exports;
}
function trace(n=220){return Array.from({length:n},(_,i)=>({latitude:10+i*.00005,longitude:106+Math.sin(i/8)*.0003,timestamp:1700000000000+i*5000,accuracy:8}));}
function matching(points){return {code:'Ok',matchings:[{geometry:{coordinates:points.map(p=>[p.longitude,p.latitude])}}]};}
test('matching processes every recorded point in overlapping batches without downsampling',async()=>{
  const received=[];
  const service=load('services/roadRouting.ts',{fetch:async url=>{const coords=url.split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));received.push(...coords);return {ok:true,json:async()=>({code:'Ok',matchings:[{geometry:{coordinates:coords}}]})};}});
  await service.matchTraveledRouteSegments(trace());
  assert.equal(new Set(received.map(p=>p.join(','))).size,220);
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function locationFixture(overrides={}){
  let publish,removed=0;
  const position={timestamp:Date.now(),coords:{latitude:10.7,longitude:106.7,accuracy:8}};
  const location={Accuracy:{High:4},requestForegroundPermissionsAsync:async()=>({granted:true}),hasServicesEnabledAsync:async()=>true,
    getLastKnownPositionAsync:async()=>position,getCurrentPositionAsync:async()=>position,
    watchPositionAsync:async(_,callback)=>{publish=callback;return {remove:()=>removed++};},...overrides};
  const service=load('services/sosLocation.ts',{}, {'expo-location':location,'./platformLocation':{getDeviceCurrentPosition:async()=>position,watchDevicePosition:(...args)=>location.watchPositionAsync(...args)}});
  return {service,position,getPublish:()=>publish,removed:()=>removed};
}
test('SOS starts automatically, publishes location updates and removes the watch on exit',async()=>{
  const fixture=locationFixture(),updates=[],errors=[];
  const stop=fixture.service.startAutoSosLocation(p=>updates.push(p),e=>errors.push(e));
  await tick();await tick();
  assert.ok(updates.length>0);
  fixture.getPublish()({...fixture.position,coords:{...fixture.position.coords,latitude:10.71}});
  assert.equal(updates.at(-1).latitude,10.71);
  stop();assert.equal(fixture.removed(),1);
  const count=updates.length;fixture.getPublish()(fixture.position);assert.equal(updates.length,count);
  assert.equal(errors.length,0);
});
test('SOS removes a late watch and never displays stale cached coordinates as current',async()=>{
  let resolveWatch,removed=0;
  const stale={timestamp:Date.now()-600000,coords:{latitude:10,longitude:106,accuracy:8}};
  const fixture=locationFixture({getLastKnownPositionAsync:async()=>stale,watchPositionAsync:()=>new Promise(r=>{resolveWatch=r;})});
  const updates=[];const stop=fixture.service.startAutoSosLocation(p=>updates.push(p),()=>{});
  await tick();assert.equal(updates.length,0);
  stop();resolveWatch({remove:()=>removed++});await tick();assert.equal(removed,1);
});
test('SOS respects denied permission and does not start a GPS watch',async()=>{
  let requested=0;
  const fixture=locationFixture({requestForegroundPermissionsAsync:async()=>({granted:false}),watchPositionAsync:async()=>{requested++;}});
  const errors=[];const stop=fixture.service.startAutoSosLocation(()=>assert.fail('no coordinates without permission'),e=>errors.push(e));
  await tick();stop();assert.equal(requested,0);assert.equal(errors.length,1);
});
test('native ad bridge forwards SDK failures, handles missing response IDs and patches idempotently',()=>{
  const {patchNativeAdFailures}=require('../scripts/native-ad-patch.cjs');
  const fixture=`import com.google.android.gms.ads.AdLoader\nval holder = NativeAdHolder(adUnitId, requestOptions)\nval responseId = nativeAd.responseInfo?.responseId ?: return@loadAd\nprivate inner class NativeAdHolder(private val adUnitId: String, private val requestOptions: ReadableMap) {\nprivate val adListener: AdListener = object : AdListener() {`;
  const patched=patchNativeAdFailures(fixture);
  assert.match(patched,/override fun onAdFailedToLoad/);assert.match(patched,/promise.reject\(code, error.message, details\)/);
  assert.doesNotMatch(patched,/return@loadAd/);assert.equal(patchNativeAdFailures(patched),patched);
});
test('trace gaps are separate lines and offline matching preserves bends',async()=>{
  const service=load('services/roadRouting.ts',{fetch:async()=>{throw Error('offline');}});
  const points=trace(6);points.slice(3).forEach(p=>p.timestamp+=600000);
  const segments=await service.matchTraveledRouteSegments(points);
  assert.deepEqual(JSON.parse(JSON.stringify(segments)),[points.slice(0,3).map(p=>[p.latitude,p.longitude]),points.slice(3).map(p=>[p.latitude,p.longitude])]);
});
test('all matching geometries survive and changing the tail cannot reuse a prefix cache',async()=>{
  let calls=0;
  const service=load('services/roadRouting.ts',{fetch:async()=>{calls++;return {ok:true,json:async()=>({code:'Ok',matchings:[{geometry:{coordinates:[[106,10],[106.001,10.001]]}},{geometry:{coordinates:[[106.002,10.002],[106.003,10.003]]}}]})};}});
  const points=trace(30);assert.equal((await service.matchTraveledRouteSegments(points)).length,2);
  const changed=points.map(p=>({...p}));changed[29].longitude+=.0001;
  await service.matchTraveledRouteSegments(changed);assert.equal(calls,2);
});
test('motorbike routing calls the API host and maneuver indices belong to each leg',async()=>{
  let host;
  const service=load('services/roadRouting.ts',{fetch:async url=>{host=new URL(url).hostname;return {ok:true,json:async()=>({trip:{summary:{length:2,time:200},legs:[{shape:{coordinates:[[106,10],[106.001,10.001]]},maneuvers:[{begin_shape_index:0}]},{shape:{coordinates:[[106.001,10.001],[106.002,10.002]]},maneuvers:[{begin_shape_index:1,type:4}]}]}})};}});
  const route=await service.fetchRoadRoute({latitude:10,longitude:106},{latitude:10.002,longitude:106.002},'motorbike',prefs);
  assert.equal(host,'valhalla1.openstreetmap.de');
  assert.deepEqual(JSON.parse(JSON.stringify(route.steps[1].position)),[10.002,106.002]);
});
test('Valhalla left turns, roundabouts and U-turns have the correct maneuver icons',async()=>{
  const service=load('services/roadRouting.ts',{fetch:async()=>({ok:true,json:async()=>({trip:{summary:{length:1,time:100},legs:[{shape:{coordinates:[[106,10],[106.001,10.001]]},maneuvers:[{type:1},{type:15},{type:26},{type:12},{type:8}]}]}})})});
  const route=await service.fetchRoadRoute({latitude:10,longitude:106},{latitude:10.001,longitude:106.001},'motorbike',prefs);
  assert.equal(route.steps[1].type,'turn');assert.equal(route.steps[1].modifier,'left');
  assert.equal(route.steps[2].type,'roundabout');assert.equal(route.steps[3].type,'uturn');
  assert.equal(route.steps[4].modifier,'straight');
});
