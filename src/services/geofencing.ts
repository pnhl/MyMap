import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {isAmazonLocationDevice,watchDevicePosition} from './platformLocation';
import {getCurrentUser,subscribeAuthState} from './auth';
import {notifyWearDevice} from './nativeSafety';
import {companionGeofenceHaptic} from './iosCompanions';
import {travelNative} from './travelPlatform';

export const GEOFENCE_TASK_NAME = 'mymap-place-geofence-v1';

type PlaceAlert = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  notify_on_enter: boolean;
  notify_on_exit: boolean;
};

const FIRE_REGIONS_KEY='mymap.fire-geofences.v1';
let fireWatcher:Location.LocationSubscription|null=null,fireGeneration=0;
export function distanceToRegion(lat:number,lon:number,region:PlaceAlert){
 const rad=Math.PI/180,dLat=(region.latitude-lat)*rad,dLon=(region.longitude-lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(lat*rad)*Math.cos(region.latitude*rad)*Math.sin(dLon/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
async function startFireRegions(owner:string,regions:PlaceAlert[]){
 fireWatcher?.remove();fireWatcher=null;const generation=++fireGeneration;
 await travelNative?.configurePlaceRegions?.(JSON.stringify({owner,regions}));
 if(!regions.length)return;
 const states=new Map<string,boolean>();let queue=Promise.resolve();
 const watcher=await watchDevicePosition({accuracy:Location.Accuracy.High,distanceInterval:20,timeInterval:10000},point=>{
  queue=queue.catch(()=>{}).then(async()=>{
   if(generation!==fireGeneration||AppState.currentState!=='active'||(await getCurrentUser())?.id!==owner)return;
   if(await travelNative?.isPlatformTracking())return; // Native recorder owns transitions while running.
   for(const region of regions){
    const radius=Math.max(50,Math.min(region.radius_m,5000)),distance=distanceToRegion(point.coords.latitude,point.coords.longitude,region),uncertainty=Math.max(25,point.coords.accuracy||0);
    if(Math.abs(distance-radius)<=uncertainty)continue;
    const inside=distance<radius,previous=states.get(region.id);states.set(region.id,inside);
    if(previous==null||previous===inside||!(inside?region.notify_on_enter:region.notify_on_exit))continue;
    if(generation!==fireGeneration||(await getCurrentUser())?.id!==owner)return;
    await supabase.rpc('vc_record_place_alert_event',{p_alert_id:region.id,p_event_type:inside?'enter':'exit',p_lat:point.coords.latitude,p_lon:point.coords.longitude});
    if((await Notifications.getPermissionsAsync()).granted)await Notifications.scheduleNotificationAsync({content:{title:inside?'MyMap · Đã đến địa điểm':'MyMap · Đã rời địa điểm',body:'Mở MyMap để xem cảnh báo địa điểm.',data:{type:'place_alert',alertId:region.id,owner}},trigger:null});
   }
  });
 });
 if(generation!==fireGeneration)watcher.remove();else fireWatcher=watcher;
}
export function startFireGeofenceFallback(){
 let alive=true;
 const restore=async()=>{if(!alive||!await isAmazonLocationDevice())return;const owner=(await getCurrentUser())?.id;const raw=await AsyncStorage.getItem(FIRE_REGIONS_KEY);if(!raw||!owner){await travelNative?.configurePlaceRegions?.(null);return;}const saved=JSON.parse(raw);if(saved.owner===owner)await startFireRegions(owner,saved.regions);else await travelNative?.configurePlaceRegions?.(null);};
 void restore().catch(()=>{});const auth=subscribeAuthState(()=>{fireGeneration++;fireWatcher?.remove();fireWatcher=null;void restore().catch(()=>{});});
 let flushing=false;
 const flush=async()=>{if(!alive||flushing||AppState.currentState!=='active'||!await isAmazonLocationDevice())return;flushing=true;try{
  const events=JSON.parse(await travelNative?.pendingPlaceEvents?.()||'[]') as {id:string;owner:string;alertId:string;type:string;lat:number;lon:number}[];
  for(const event of events){if(!alive||(await getCurrentUser())?.id!==event.owner)return;const {error}=await supabase.rpc('vc_record_place_alert_event',{p_alert_id:event.alertId,p_event_type:event.type,p_lat:event.lat,p_lon:event.lon});if(error)throw error;await travelNative?.acknowledgePlaceEvent?.(event.id);}
 }finally{flushing=false;}};
 const timer=setInterval(()=>void flush().catch(()=>{}),15000),app=AppState.addEventListener('change',s=>{if(s==='active'){void restore().catch(()=>{});void flush().catch(()=>{});}});void flush().catch(()=>{});
 return()=>{alive=false;fireGeneration++;fireWatcher?.remove();fireWatcher=null;auth();clearInterval(timer);app.remove();};
}

type GeofenceTaskEvent = {
  eventType: number;
  region: {
    identifier?: string;
    latitude: number;
    longitude: number;
  };
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const event = data as GeofenceTaskEvent;
  const eventType = event.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit';
  const alertId = event.region.identifier;
  if (!alertId) return;

  try {
    await supabase.rpc('vc_record_place_alert_event', {
      p_alert_id: alertId,
      p_event_type: eventType,
      p_lat: event.region.latitude,
      p_lon: event.region.longitude,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: eventType === 'enter' ? 'MyMap · Đã đến địa điểm' : 'MyMap · Đã rời địa điểm',
        body: 'Mở MyMap để xem chi tiết hoặc chia sẻ trạng thái an toàn.',
        data: { type: 'place_alert', alertId, eventType },
      },
      trigger: null,
    });
    void notifyWearDevice('geofence','MyMap · Cảnh báo địa điểm').catch(()=>{});
    void companionGeofenceHaptic('Cảnh báo địa điểm').catch(()=>{});
  } catch (e) {
    console.warn('MyMap geofence task failed', e);
  }
});

export async function syncGeofences() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Cần quyền vị trí để bật cảnh báo địa điểm.');
  const fire=await isAmazonLocationDevice();
  if(!fire){const bg = await Location.requestBackgroundPermissionsAsync();
   if (bg.status !== 'granted') throw new Error('Cần quyền vị trí nền để nhận cảnh báo khi app không mở.');}

  const { data, error } = await supabase
    .from('vc_place_alerts')
    .select('id,label,latitude,longitude,radius_m,notify_on_enter,notify_on_exit')
    .eq('is_enabled', true)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  if(fire){const owner=(await getCurrentUser())?.id;if(!owner)throw Error('Đăng nhập trước khi bật cảnh báo địa điểm.');const regions=(data??[])as PlaceAlert[];await AsyncStorage.setItem(FIRE_REGIONS_KEY,JSON.stringify({owner,regions}));await startFireRegions(owner,regions);return regions.length;}

  const regions = ((data ?? []) as PlaceAlert[]).map((a) => ({
    identifier: a.id,
    latitude: a.latitude,
    longitude: a.longitude,
    radius: Math.max(50, Math.min(a.radius_m, 5000)),
    notifyOnEnter: a.notify_on_enter,
    notifyOnExit: a.notify_on_exit,
  }));

  if (!regions.length) {
    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    return 0;
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  return regions.length;
}

export async function stopGeofences() {
  fireGeneration++;fireWatcher?.remove();fireWatcher=null;await AsyncStorage.removeItem(FIRE_REGIONS_KEY);
  if(await isAmazonLocationDevice()){await travelNative?.configurePlaceRegions?.(null);return;}
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
}
