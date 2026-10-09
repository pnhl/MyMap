const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
const fix = () => ({timestamp:Date.now(),coords:{latitude:10.7,longitude:106.7,accuracy:8,speed:0,heading:0,altitude:null}});

function fixture({amazon=false,network=true,failFused=false,granted=true}={}) {
  let nativeCallback, callback, change, removed=0, nativeStopped=0, listeners=0;
  const requests=[], nativeRequests=[];
  const native={isAmazonDevice:async()=>amazon,startUpdates:async(...args)=>nativeRequests.push(args),stopUpdates:async()=>{nativeStopped++;}};
  const state={currentState:'active',addEventListener:(_,cb)=>{change=cb;listeners++;return {remove:()=>listeners--};}};
  const location={Accuracy:{Balanced:3,High:4,Highest:5},getProviderStatusAsync:async()=>({gpsAvailable:true,networkAvailable:network}),
    getForegroundPermissionsAsync:async()=>({granted}),hasServicesEnabledAsync:async()=>true,
    watchPositionAsync:async(options,cb)=>{requests.push(options);if(failFused)throw Error('Google location settings unavailable');callback=cb;return {remove:()=>removed++};}};
  const mocks={'expo-location':location,'react-native':{AppState:state,Platform:{OS:'android'},NativeModules:{PlatformLocation:native},
    NativeEventEmitter:class {addListener(_,cb){nativeCallback=cb;return {remove(){nativeCallback=undefined;}};}}}};
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('src/services/platformLocation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>mocks[name],Date,Symbol,Map,Promise,setTimeout,clearTimeout});
  return {service:module.exports,requests,nativeRequests,removed:()=>removed,nativeStopped:()=>nativeStopped,listeners:()=>listeners,
    deliver:()=>callback(fix()),deliverNative:()=>nativeCallback({...fix().coords,timestamp:Date.now()}),
    state:async value=>{state.currentState=value;change(value);await tick();await tick();}};
}

test('two Fire OS consumers share GPS; exiting one screen cannot stop the other',async()=>{
  const f=fixture({amazon:true}),first=[],second=[];
  const stopA=await f.service.startPlatformLocationUpdates(1200,2,p=>first.push(p));
  const stopB=await f.service.startPlatformLocationUpdates(1200,2,p=>second.push(p));
  assert.equal(f.nativeRequests.length,1);
  await stopA();await tick();f.deliverNative();
  assert.equal(first.length,0);assert.equal(second.length,1);assert.equal(f.nativeStopped(),0);
  await stopB();await tick();assert.equal(f.nativeStopped(),1);assert.equal(f.listeners(),0);
});

test('GPS-only Android bypasses Google accuracy dialogs and receives native coordinates',async()=>{
  const f=fixture({network:false}),positions=[];
  const watch=await f.service.watchNavigationPosition(p=>positions.push(p));
  assert.equal(f.requests.length,0);assert.equal(f.nativeRequests.length,1);
  f.deliverNative();assert.equal(positions[0].coords.latitude,10.7);
  watch.remove();await tick();assert.equal(f.nativeStopped(),1);
});

test('a Google provider error falls back to system GPS without changing location settings',async()=>{
  const f=fixture({failFused:true}),positions=[];
  const watch=await f.service.watchNavigationPosition(p=>positions.push(p));
  assert.equal(f.requests[0].mayShowUserSettingsDialog,false);
  assert.equal(f.nativeRequests.length,1);f.deliverNative();assert.equal(positions.length,1);
  watch.remove();await tick();
});

test('native fallback never bypasses app location permission',async()=>{
  const f=fixture({failFused:true,granted:false});
  await assert.rejects(f.service.watchNavigationPosition(()=>{}),/Google location/);
  await tick();assert.equal(f.nativeRequests.length,0);assert.equal(f.listeners(),0);
});

test('switching to another app releases the foreground watcher and resumes once on return',async()=>{
  const f=fixture();const watch=await f.service.watchNavigationPosition(()=>{});
  await f.state('background');assert.equal(f.removed(),1);
  await f.state('active');assert.equal(f.requests.length,2);
  await f.state('active');assert.equal(f.requests.length,2);
  watch.remove();await tick();assert.equal(f.removed(),2);
});

test('single-fix timeout removes its GPS request even if no satellite fix arrives',async()=>{
  const f=fixture();
  await assert.rejects(f.service.getDeviceCurrentPosition({timeoutMs:15}),/GPS/);
  await tick();assert.equal(f.removed(),1);assert.equal(f.listeners(),0);
});

test('a simultaneous one-shot reuses a live watch; finishing it preserves navigation',async()=>{
  const f=fixture(),navigation=[];
  const watch=await f.service.watchDevicePosition({accuracy:4,timeInterval:1000,distanceInterval:0},p=>navigation.push(p));
  const position=f.service.getDeviceCurrentPosition({timeoutMs:200});
  await tick();f.deliver();assert.equal((await position).coords.latitude,10.7);await tick();
  assert.equal(f.requests.length,1);assert.equal(f.removed(),0);
  f.deliver();assert.equal(navigation.length,2);
  watch.remove();await tick();assert.equal(f.removed(),1);
});
