import {Platform,NativeModules} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {getCurrentUser} from './auth';
import {supabase} from './supabase';
import {isAmazonLocationDevice} from './platformLocation';
import {googleServicesAvailable} from './nativeSdks';
type NativePush={getAdmToken():Promise<string|null>;setOwner(owner:string|null):Promise<boolean>;consumePushOpen():Promise<Record<string,unknown>|null>};
const nativePush=NativeModules?.MyMapPush as NativePush|undefined;
export async function consumeNativePushOpen(){return nativePush?.consumePushOpen()||null;}
let serial:Promise<unknown>=Promise.resolve(),registeredOwner:string|null=null,registeredToken:string|null=null,registeredAt=0,generation=0;
export function registerPushDelivery(){
 const epoch=generation;
 serial=serial.catch(()=>{}).then(async()=>{
  if(epoch!==generation)return false;
  const user=await getCurrentUser();if(!user||user.is_anonymous)return false;
  const fire=Platform.OS==='android'&&await isAmazonLocationDevice();
  if(Platform.OS==='android'&&!fire&&!googleServicesAvailable())return false;
  if(epoch!==generation||user.id!==(await getCurrentUser())?.id)return false;
  await nativePush?.setOwner(user.id);
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('mymap_remote',{name:'Tin nhắn và cuộc gọi MyMap',importance:Notifications.AndroidImportance.HIGH});
  const projectId=Constants.expoConfig?.extra?.eas?.projectId||Constants.easConfig?.projectId;
  if((!fire&&!projectId)||!(await Notifications.getPermissionsAsync()).granted)return false;
  let installation=await SecureStore.getItemAsync('mymap.push-installation.v1');
  if(!installation){installation=Crypto.randomUUID();await SecureStore.setItemAsync('mymap.push-installation.v1',installation);}
  const token=fire?await nativePush?.getAdmToken():(await Notifications.getExpoPushTokenAsync({projectId})).data;
  if(!token)return false;
  if(epoch!==generation||user.id!==(await getCurrentUser())?.id)return false;
  if(registeredOwner===user.id&&registeredToken===token&&Date.now()-registeredAt<3600000)return true;
  let {error}=await supabase.rpc('mm_register_push_v2',{p_installation:installation,p_token:token,p_provider:fire?'adm':'expo',p_store:fire?'amazon':Platform.OS==='ios'?'ios':'play'});
  // Keep the existing Expo registry working during the additive backend rollout.
  // Only a missing v2 function permits fallback; authorization/network errors do not.
  if(!fire&&error&&['PGRST202','42883'].includes(error.code))({error}=await supabase.rpc('mm_register_push',{p_installation:installation,p_token:token}));
  if(error)throw Error('Chưa đăng ký được thông báo đẩy. Hộp thư trong MyMap vẫn hoạt động.');
  registeredOwner=user.id;registeredToken=token;registeredAt=Date.now();return true;
 });return serial;
}
export async function revokePushDelivery(){
 generation++;
 await nativePush?.setOwner(null);
 await serial.catch(()=>{});await nativePush?.setOwner(null);const user=await getCurrentUser();if(!user)return;
 const installation=await SecureStore.getItemAsync('mymap.push-installation.v1');if(!installation)return;
 const {error}=await supabase.rpc('mm_register_push',{p_installation:installation,p_token:null});
 if(error)throw Error('Chưa gỡ được thông báo của thiết bị. Kiểm tra mạng rồi đăng xuất lại.');registeredOwner=null;registeredToken=null;
}
