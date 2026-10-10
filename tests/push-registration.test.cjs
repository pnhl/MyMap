const test=require('node:test'),assert=require('node:assert/strict');
const {loadService}=require('./service-loader.cjs');
function setup({fire=false,gms=true,os='android',error=null}={}){
 let token='token-first',owner='owner';const calls=[],nativeOwners=[];
 const service=loadService('src/services/pushRegistration.ts',{'react-native':{Platform:{OS:os},NativeModules:{MyMapPush:{getAdmToken:async()=>token,setOwner:async value=>nativeOwners.push(value)}}},'expo-notifications':{AndroidImportance:{HIGH:4},setNotificationChannelAsync:async()=>{},getPermissionsAsync:async()=>({granted:true}),getExpoPushTokenAsync:async()=>{calls.push('expo');return{data:token};}},'expo-secure-store':{getItemAsync:async()=> 'installation'},'expo-crypto':{},'expo-constants':{expoConfig:{extra:{eas:{projectId:'project'}}}},'./auth':{getCurrentUser:async()=>({id:owner})},'./supabase':{supabase:{rpc:async(name,params)=>{calls.push({name,params});return{error:name.endsWith('_v2')?error:null};}}},'./platformLocation':{isAmazonLocationDevice:async()=>fire},'./nativeSdks':{googleServicesAvailable:()=>gms}});
 return{service,calls,nativeOwners,setToken:value=>{token=value;},setOwner:value=>{owner=value;}};
}
test('missing GMS never requests an Expo token; Fire registers only ADM with store ownership',async()=>{
 const missing=setup({gms:false});assert.equal(await missing.service.registerPushDelivery(),false);assert.equal(missing.calls.length,0);
 const fire=setup({fire:true,gms:false});assert.equal(await fire.service.registerPushDelivery(),true);assert.deepEqual(fire.calls.map(c=>c.params.p_provider),['adm']);assert.equal(fire.calls[0].params.p_store,'amazon');
});
test('token rotation re-registers within the cache window',async()=>{
 const f=setup({fire:true});await f.service.registerPushDelivery();await f.service.registerPushDelivery();assert.equal(f.calls.length,1);
 f.setToken('rotated');await f.service.registerPushDelivery();assert.equal(f.calls.length,2);assert.equal(f.calls[1].params.p_token,'rotated');
});
test('revocation invalidates an already queued registration and clears the native owner',async()=>{
 const f=setup({fire:true});const pending=f.service.registerPushDelivery();await f.service.revokePushDelivery();assert.equal(await pending,false);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].params.p_token,null);assert.equal(f.nativeOwners.at(-1),null);
});
test('Expo rollout fallback is limited to a missing v2 function; ADM never falls back',async()=>{
 const expo=setup({os:'ios',error:{code:'PGRST202'}});assert.equal(await expo.service.registerPushDelivery(),true);assert.equal(expo.calls.at(-1).name,'mm_register_push');
 const denied=setup({error:{code:'42501'}});await assert.rejects(denied.service.registerPushDelivery());assert.equal(denied.calls.filter(c=>typeof c==='object').length,1);
 const adm=setup({fire:true,error:{code:'PGRST202'}});await assert.rejects(adm.service.registerPushDelivery());assert.equal(adm.calls.length,1);
});
