const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loadService}=require('./service-loader.cjs');
const {reduceSafety,parseNavigationSnapshot}=loadService('src/types/parity.ts');
const off={phase:'off',incident:null,deadline:0,delivery:'none'};
test('cancelled incident cannot create offline SOS or later delivery',()=>{
 let s=reduceSafety(off,{type:'enable'});s=reduceSafety(s,{type:'incident',id:'fall',deadline:100});s=reduceSafety(s,{type:'cancel'});
 assert.equal(s.phase,'armed');s=reduceSafety(s,{type:'confirm',online:false});assert.equal(s.phase,'armed');assert.equal(s.delivery,'none');
 assert.equal(reduceSafety(s,{type:'delivered'}).delivery,'none');
});
test('offline SOS replay distinguishes local queue, server acceptance and receipt',()=>{
 let s=reduceSafety(reduceSafety(off,{type:'enable'}),{type:'incident',id:'fall',deadline:100});s=reduceSafety(s,{type:'confirm',online:false});assert.equal(s.phase,'queued');assert.equal(s.delivery,'queued');
 s=reduceSafety(s,{type:'accepted'});assert.equal(s.delivery,'accepted');assert.equal(reduceSafety(s,{type:'disable'}).phase,'off');
});
test('navigation contract preserves native route and sanitizes invalid speed',()=>{
 const n=parseNavigationSnapshot(JSON.stringify({active:true,coordinates:[[106,10]],speed:-1,guidance:{instruction:'Rẽ phải'}}),123);
 assert.equal(n.schema,1);assert.equal(n.speed,undefined);assert.equal(n.coordinates.length,1);assert.equal(n.updatedAt,123);assert.throws(()=>parseNavigationSnapshot('{"active":1}'),/Invalid/);
});
test('missing GMS disables Google SDK facades even when modules are linked in Google flavor',()=>{
 let touched=0;const facade=loadService('src/services/nativeSdks.ts',{'react-native':{Platform:{OS:'android'},TurboModuleRegistry:{get:()=>{touched++;throw Error('must not load native SDK');}}},'../../modules/my-map-capabilities':{default:{runtimeCapabilities:()=>({gms:false})},__esModule:true}});
 assert.equal(facade.googleSignInAvailable(),false);assert.equal(facade.adsSdkAvailable(),false);assert.equal(touched,0);
});
test('final iOS Release settings repair generated widget Onone without modifying Debug',()=>{
 const entries={release:{name:'Release',buildSettings:{SWIFT_OPTIMIZATION_LEVEL:'"-Onone"',ENABLE_DEBUG_DYLIB:'YES'}},debug:{name:'Debug',buildSettings:{SWIFT_OPTIMIZATION_LEVEL:'"-Onone"'}}};
 require('../plugins/ios-release-settings.cjs')({pbxXCBuildConfigurationSection:()=>entries},'1.0.4',38);
 assert.equal(entries.release.buildSettings.ENABLE_DEBUG_DYLIB,'NO');assert.equal(entries.release.buildSettings.SWIFT_OPTIMIZATION_LEVEL,'"-O"');assert.equal(entries.debug.buildSettings.SWIFT_OPTIMIZATION_LEVEL,'"-Onone"');
});
