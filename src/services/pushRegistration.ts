import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {getCurrentUser} from './auth';
import {supabase} from './supabase';
import {isAmazonLocationDevice} from './platformLocation';
let serial:Promise<unknown>=Promise.resolve(),registeredOwner:string|null=null,registeredAt=0;
export function registerPushDelivery(){
 serial=serial.catch(()=>{}).then(async()=>{
  if(Platform.OS==='android'&&await isAmazonLocationDevice())return false;
  const user=await getCurrentUser();if(!user||user.is_anonymous)return false;
  if(registeredOwner===user.id&&Date.now()-registeredAt<3600000)return true;
  const projectId=Constants.expoConfig?.extra?.eas?.projectId||Constants.easConfig?.projectId;
  if(!projectId||!(await Notifications.getPermissionsAsync()).granted)return false;
  let installation=await SecureStore.getItemAsync('mymap.push-installation.v1');
  if(!installation){installation=Crypto.randomUUID();await SecureStore.setItemAsync('mymap.push-installation.v1',installation);}
  const token=await Notifications.getExpoPushTokenAsync({projectId});
  if(user.id!==(await getCurrentUser())?.id)return false;
  const {error}=await supabase.rpc('mm_register_push',{p_installation:installation,p_token:token.data});
  if(error)throw Error('Chưa đăng ký được thông báo đẩy. Hộp thư trong MyMap vẫn hoạt động.');
  registeredOwner=user.id;registeredAt=Date.now();return true;
 });return serial;
}
export async function revokePushDelivery(){
 await serial.catch(()=>{});const user=await getCurrentUser();if(!user)return;
 const installation=await SecureStore.getItemAsync('mymap.push-installation.v1');if(!installation)return;
 const {error}=await supabase.rpc('mm_register_push',{p_installation:installation,p_token:null});
 if(error)throw Error('Chưa gỡ được thông báo của thiết bị. Kiểm tra mạng rồi đăng xuất lại.');registeredOwner=null;
}
