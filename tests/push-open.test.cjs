const test=require('node:test'),assert=require('node:assert/strict');
const {loadService}=require('./service-loader.cjs');
test('warm ADM taps open while already active and reject another owner',async()=>{
 let listener,pending=null;const opened=[];
 const service=loadService('src/services/notificationDelivery.ts',{'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})},DeviceEventEmitter:{addListener:(_name,callback)=>{listener=callback;return{remove(){listener=null;}};}}},'expo-notifications':{addNotificationResponseReceivedListener:()=>({remove(){}}),getLastNotificationResponseAsync:async()=>null},'@react-native-async-storage/async-storage':{getItem:async()=>null,setItem:async()=>{}},'./auth':{getCurrentUser:async()=>({id:'owner'}),subscribeAuthState:()=>()=>{}},'./supabase':{},'./pushRegistration':{registerPushDelivery:async()=>false,consumeNativePushOpen:async()=>{const value=pending;pending=null;return value;}}},{setInterval:()=>0,clearInterval:()=>{}});
 const stop=service.startNotificationDelivery(data=>opened.push(data));await new Promise(setImmediate);
 pending={owner:'other',callId:'private'};listener();await new Promise(setImmediate);assert.equal(opened.length,0);
 pending={owner:'owner',callId:'call'};listener();await new Promise(setImmediate);assert.equal(opened.length,1);assert.equal(opened[0].callId,'call');stop();assert.equal(listener,null);
});
