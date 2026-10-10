const test=require('node:test'),assert=require('node:assert/strict');
const {loadService}=require('./service-loader.cjs');
function setup(){
 const regions=[{id:'region',latitude:0,longitude:0,radius_m:100,notify_on_enter:true,notify_on_exit:true}];let watcher;
 const calls=[],configured=[],acked=[];
 const service=loadService('src/services/geofencing.ts',{'expo-location':{Accuracy:{High:4}},'expo-task-manager':{defineTask:()=>{}},'expo-notifications':{setNotificationHandler:()=>{},getPermissionsAsync:async()=>({granted:true}),scheduleNotificationAsync:async()=>{calls.push('notification');}},'./supabase':{supabase:{rpc:async(name,params)=>{calls.push(params);return{error:null};}}},'@react-native-async-storage/async-storage':{getItem:async()=>JSON.stringify({owner:'owner',regions})},'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},'./platformLocation':{isAmazonLocationDevice:async()=>true,watchDevicePosition:async(_options,next)=>{watcher=next;return{remove(){}};}},'./auth':{getCurrentUser:async()=>({id:'owner'}),subscribeAuthState:()=>()=>{}},'./nativeSafety':{},'./iosCompanions':{},'./travelPlatform':{travelNative:{configurePlaceRegions:async json=>configured.push(JSON.parse(json)),isPlatformTracking:async()=>true,pendingPlaceEvents:async()=>JSON.stringify([{id:'event',owner:'owner',alertId:'region',type:'enter',lat:0,lon:0}]),acknowledgePlaceEvent:async id=>acked.push(id)}}},{setInterval:()=>0,clearInterval:()=>{}});
 return{service,calls,configured,acked,point:coords=>watcher({coords})};
}
test('Fire restores owner-scoped native regions and acknowledges queued transitions only after server recording',async()=>{
 const f=setup(),stop=f.service.startFireGeofenceFallback();await new Promise(setImmediate);
 assert.equal(f.configured[0].owner,'owner');assert.equal(f.calls[0].p_event_type,'enter');assert.deepEqual(f.acked,['event']);stop();
});
test('foreground watcher yields transition ownership to the native background recorder',async()=>{
 const f=setup(),stop=f.service.startFireGeofenceFallback();await new Promise(setImmediate);const before=f.calls.length;
 f.point({latitude:0,longitude:0,accuracy:5});await new Promise(setImmediate);f.point({latitude:1,longitude:1,accuracy:5});await new Promise(setImmediate);
 assert.equal(f.calls.length,before);stop();
});
