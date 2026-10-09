import {AppState} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCurrentUser,subscribeAuthState} from './auth';
import {supabase} from './supabase';
import {registerPushDelivery} from './pushRegistration';
// Polling also works on Fire OS without FCM. It runs only while the app is active.
// Persist the cursor per owner; never deliver a previous owner's private events.
export function startNotificationDelivery(onOpen:(data:Record<string,unknown>)=>void){
 let alive=true,busy=false,generation=0;
 async function poll(){
  if(!alive||busy||AppState.currentState!=='active')return;busy=true;const token=generation;
  try{
   const user=await getCurrentUser();if(!user||user.is_anonymous)return;
   void registerPushDelivery().catch(()=>{});
   const key='mymap.notification-cursor.v2:'+user.id,raw=await AsyncStorage.getItem(key);
   if(!raw){await AsyncStorage.setItem(key,JSON.stringify({at:new Date().toISOString(),id:'00000000-0000-0000-0000-000000000000'}));return;}
   const previous=JSON.parse(raw)as{at:string;id:string};
   if(!/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(previous.at)||!Number.isFinite(Date.parse(previous.at))||!/^[-a-f0-9]{36}$/i.test(previous.id)){await AsyncStorage.removeItem(key);return;}
   const {data,error}=await supabase.from('vc_notifications').select('id,created_at,payload,read_at').or(`created_at.gt.${previous.at},and(created_at.eq.${previous.at},id.gt.${previous.id})`).order('created_at',{ascending:true}).order('id',{ascending:true}).limit(50);
   if(error||!data)return;
   const granted=(await Notifications.getPermissionsAsync()).granted;
   for(const item of data){
    if(!alive||token!==generation||user.id!==(await getCurrentUser())?.id)return;
    const presented=granted?await Notifications.getPresentedNotificationsAsync():[];
    if(!item.read_at&&granted&&!presented.some(n=>n.request.content.data?.notificationId===item.id))await Notifications.scheduleNotificationAsync({identifier:'mymap-inbox:'+item.id,content:{title:'Thông báo MyMap',body:item.payload?.callId?'Bạn có lời mời tham gia cuộc gọi.':'Bạn có hoạt động mới. Mở MyMap để xem.',data:{...item.payload,owner:user.id,notificationId:item.id}},trigger:null});
    if(!alive||token!==generation||user.id!==(await getCurrentUser())?.id)return;
    await AsyncStorage.setItem(key,JSON.stringify({at:item.created_at,id:item.id}));
   }
  }catch{/* The server inbox retains events for a later retry. */}finally{busy=false;}
 }
 const auth=subscribeAuthState(()=>{generation++;void Notifications.dismissAllNotificationsAsync();void poll();});
 const openResponse=(r:Notifications.NotificationResponse)=>{
  const token=generation,data=r.notification.request.content.data||{};
  void getCurrentUser().then(u=>{if(alive&&token===generation&&u?.id===data.owner){onOpen(data);void Notifications.clearLastNotificationResponseAsync();}});
 };
 const response=Notifications.addNotificationResponseReceivedListener(openResponse);
 void Notifications.getLastNotificationResponseAsync().then(r=>{if(r)openResponse(r);}).catch(()=>{});
 const app=AppState.addEventListener('change',s=>{if(s==='active')void poll();});const timer=setInterval(()=>void poll(),15000);void poll();
 return()=>{alive=false;generation++;auth();response.remove();app.remove();clearInterval(timer);};
}
