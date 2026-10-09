import {AppState} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getCurrentUser,subscribeAuthState} from './auth';
import {supabase} from './supabase';
// Polling also works on Fire OS without FCM. It runs only while the app is active.
// Persist the cursor per owner; never deliver a previous owner's private events.
export function startNotificationDelivery(onOpen:(data:Record<string,unknown>)=>void){
 let alive=true,busy=false,generation=0;
 async function poll(){
  if(!alive||busy||AppState.currentState!=='active')return;busy=true;const token=generation;
  try{
   const user=await getCurrentUser();if(!user||user.is_anonymous)return;
   const key='mymap.notification-cursor.v1:'+user.id,previous=await AsyncStorage.getItem(key);
   if(!previous){await AsyncStorage.setItem(key,new Date().toISOString());return;}
   const {data,error}=await supabase.from('vc_notifications').select('id,created_at,payload,read_at').gt('created_at',previous).order('created_at',{ascending:true}).limit(50);
   if(error||!data)return;
   const granted=(await Notifications.getPermissionsAsync()).granted;
   for(const item of data){
    if(!alive||token!==generation||user.id!==(await getCurrentUser())?.id)return;
    if(!item.read_at&&granted)await Notifications.scheduleNotificationAsync({identifier:'mymap-inbox:'+item.id,content:{title:'Thông báo MyMap',body:item.payload?.callId?'Bạn có lời mời tham gia cuộc gọi.':'Bạn có hoạt động mới. Mở MyMap để xem.',data:{...item.payload,owner:user.id}},trigger:null});
    if(!alive||token!==generation||user.id!==(await getCurrentUser())?.id)return;
    await AsyncStorage.setItem(key,item.created_at);
   }
  }catch{/* The server inbox retains events for a later retry. */}finally{busy=false;}
 }
 const auth=subscribeAuthState(()=>{generation++;void Notifications.dismissAllNotificationsAsync();void poll();});
 const response=Notifications.addNotificationResponseReceivedListener(r=>{
  const token=generation,data=r.notification.request.content.data||{};
  void getCurrentUser().then(u=>{if(alive&&token===generation&&u?.id===data.owner)onOpen(data);});
 });
 const app=AppState.addEventListener('change',s=>{if(s==='active')void poll();});const timer=setInterval(()=>void poll(),15000);void poll();
 return()=>{alive=false;generation++;auth();response.remove();app.remove();clearInterval(timer);};
}
