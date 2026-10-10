import { Platform } from 'react-native';
import {travelNative} from './travelPlatform';
import {setJourneyActivityTracking} from './journeyActivity';
import type {TrackingSnapshot} from '../types/parity';
import {getCurrentUser} from './auth';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import { LOCATION_TASK_NAME, persistLocations, flushLocationWrites, TRACKING_ERROR_KEY } from './backgroundLocationTask';
import {
  getDeviceCurrentPosition,
  shouldUsePlatformLocation,
  startPlatformLocationUpdates,
  watchDevicePosition,
} from './platformLocation';

export type BatteryProfile = 'battery_saver' | 'balanced' | 'high_accuracy' | 'adaptive_ai';
const PROFILE_KEY = 'mymap:battery-profile';
const TRACKING_MODE_KEY = 'mymap:tracking-mode';
const TRACKING_ENABLED_KEY = 'mymap:tracking-enabled';
export const TRACKING_SNAPSHOT_KEY='mymap:tracking-snapshot:v1';
async function publishTracking(enabled:boolean,mode:TrackingSnapshot['mode'],error:string|null=null){
 const snapshot:TrackingSnapshot={schema:1,owner:(await getCurrentUser())?.id||null,enabled,mode,updatedAt:Date.now(),error};
 await AsyncStorage.setItem(TRACKING_SNAPSHOT_KEY,JSON.stringify(snapshot));
 travelNative?.updateTrackingSnapshot?.(JSON.stringify(snapshot));
 setJourneyActivityTracking(enabled,snapshot);
}
let operations: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = operations.then(work);
  operations = next.catch(() => {});
  return next;
}

export type TrackingMode = 'background' | 'foreground';
export type TrackingStartResult = { mode: TrackingMode; firstPointSaved: boolean };

const profiles: Record<
  BatteryProfile,
  {
    accuracy: Location.Accuracy;
    distanceInterval: number;
    timeInterval: number;
    deferredUpdatesDistance: number;
    deferredUpdatesInterval: number;
  }
> = {
  battery_saver: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 25,
    timeInterval: 30_000,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
  },
  balanced: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 5,
    timeInterval: 5_000,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
  },
  high_accuracy: {
    accuracy: Location.Accuracy.Highest,
    distanceInterval: 3,
    timeInterval: 2_000,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
  },
  adaptive_ai: {
    // Motion sensing must never pause GPS while a journey is being recorded.
    accuracy: Location.Accuracy.High,
    distanceInterval: 5,
    timeInterval: 5_000,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 0,
  },
};

// Adaptive motion sensor tracking
let accelerometerSub: any = null;
let isUserStationary = false;
let foregroundLocationSub: Location.LocationSubscription | null = null;
let platformLocationStop: (() => Promise<void>) | null = null;

async function persistLocation(location: Location.LocationObject): Promise<boolean> {
  return persistLocations([location]);
}

export function startAdaptiveMotionListener(onStateChange?: (stationary: boolean) => void) {
  if (accelerometerSub) return;

  let samples: number[] = [];
  try {
    Accelerometer.setUpdateInterval(500);
    accelerometerSub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      samples.push(mag);
      if (samples.length > 20) samples.shift();

      if (samples.length >= 10) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
        const stationary = variance < 0.008; // threshold for stationary device
        if (stationary !== isUserStationary) {
          isUserStationary = stationary;
          if (onStateChange) onStateChange(stationary);
        }
      }
    });
  } catch {
    // sensor not supported
  }
}

export function stopAdaptiveMotionListener() {
  if (accelerometerSub && typeof accelerometerSub.remove === 'function') {
    accelerometerSub.remove();
    accelerometerSub = null;
  }
}

export function getIsStationary(): boolean {
  return isUserStationary;
}

export async function getBatteryProfile(): Promise<BatteryProfile> {
  const v = await AsyncStorage.getItem(PROFILE_KEY);
  return v === 'battery_saver' || v === 'high_accuracy' || v === 'adaptive_ai' ? v : 'balanced';
}

export async function setBatteryProfile(profile: BatteryProfile) {
  return serialize(async () => {
    await AsyncStorage.setItem(PROFILE_KEY, profile);
    if (await isTracking()) {
      const bg = await Location.getBackgroundPermissionsAsync();
      await configureTracking(bg.status === 'granted');
    }
  });
}

export async function requestTrackingPermissions(): Promise<{ backgroundGranted: boolean }> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) throw new Error('Dịch vụ vị trí đang tắt. Hãy bật GPS/Location Services.');
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Bạn chưa cấp quyền vị trí khi dùng ứng dụng.');
  if (fg.android?.accuracy === 'coarse') throw new Error('Hãy bật “Vị trí chính xác” cho MyMap để ghi đầy đủ quãng đường.');
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return { backgroundGranted: bg.status === 'granted' };
  } catch {
    // Fire OS and a number of Android builds do not expose the same background
    // permission flow. Foreground recording remains useful and must not fail.
    return { backgroundGranted: false };
  }
}

async function configureTracking(backgroundGranted: boolean): Promise<TrackingMode> {
  const profile = await getBatteryProfile();
  const p = profiles[profile];
  let usePlatformLocation = await shouldUsePlatformLocation();

  if (profile === 'adaptive_ai') {
    startAdaptiveMotionListener();
  } else {
    stopAdaptiveMotionListener();
  }

  let backgroundStarted = false;
  if ((!backgroundGranted || usePlatformLocation) && await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  if (!usePlatformLocation) {
    if (platformLocationStop) { await platformLocationStop(); platformLocationStop = null; }
    if (travelNative && await travelNative.isPlatformTracking?.()) await travelNative.stopPlatformTracking();
  }
  if (!usePlatformLocation && backgroundGranted) {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        ...p,
        mayShowUserSettingsDialog: false,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService:
          Platform.OS === 'android'
            ? {
                notificationTitle: 'MyMap đang ghi hành trình',
                notificationBody: 'Vị trí được lưu riêng tư trên thiết bị của bạn.',
                killServiceOnDestroy: false,
              }
            : undefined,
      });
      backgroundStarted = true;
    } catch (error) {
      // Recover a failed Google provider with the system GPS foreground service;
      // never downgrade an authorized journey to a screen-only watcher.
      if (Platform.OS === 'android' && travelNative && await Location.hasServicesEnabledAsync()) {
        if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
        usePlatformLocation = true;
      } else {
        throw new Error(`Không thể bật ghi hành trình nền: ${error instanceof Error ? error.message : 'kiểm tra quyền vị trí và pin.'}`);
      }
    }
  }

  if (usePlatformLocation && travelNative) {
    foregroundLocationSub?.remove();
    foregroundLocationSub = null;
    if (platformLocationStop) {await platformLocationStop();platformLocationStop=null;}
    await travelNative.startPlatformTracking(p.timeInterval,p.distanceInterval);
    backgroundStarted=true;
  } else if (usePlatformLocation && !platformLocationStop) {
    platformLocationStop = await startPlatformLocationUpdates(
      Math.min(p.timeInterval, 15_000),
      Math.min(p.distanceInterval, 20),
      location => { void persistLocation(location).catch(() => {}); },
    );
  } else if (!usePlatformLocation && !backgroundStarted) {
    foregroundLocationSub?.remove();
    foregroundLocationSub = await watchDevicePosition(
      {
        accuracy: p.accuracy,
        distanceInterval: Math.min(p.distanceInterval, 20),
        timeInterval: Math.min(p.timeInterval, 15_000),
      },
      location => { void persistLocation(location).catch(() => {}); },
    );
  } else if (backgroundStarted) {
    foregroundLocationSub?.remove();
    foregroundLocationSub = null;
  }

  const mode: TrackingMode = backgroundStarted ? 'background' : 'foreground';
  await AsyncStorage.setItem(TRACKING_MODE_KEY, mode);
  return mode;
}

export function startTracking(): Promise<TrackingStartResult> {
  return serialize(async () => {
    const { backgroundGranted } = await requestTrackingPermissions();
    // Register continuous updates first; a cold GPS fix can take minutes.
    const mode = await configureTracking(backgroundGranted);
    await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'true');
    travelNative?.setTrackingIndicator?.(true);
    await publishTracking(true,mode);
    await AsyncStorage.removeItem(TRACKING_ERROR_KEY);
    let firstPointSaved = false;
    try {
      const first = await getDeviceCurrentPosition({accuracy:profiles[await getBatteryProfile()].accuracy,timeoutMs:4000});
      if (first && Date.now() - first.timestamp <= 120_000) firstPointSaved = await persistLocation(first);
    } catch {
      // The active recorder will supply the next fix. Do not insert an old
      // cached position from a previous journey into the current one.
    }
    return { mode, firstPointSaved };
  });
}

// Only recover a journey the user enabled. Permission checks here must not
// launch dialogs when the app returns to foreground or a headless task runs.
export function restoreTracking(): Promise<void> {
  return serialize(async () => {
    try {
      await flushLocationWrites();
      const enabled = await AsyncStorage.getItem(TRACKING_ENABLED_KEY);
      const registered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
      if (enabled === 'false' || (enabled !== 'true' && !registered)){await publishTracking(false,'off');return;}
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted' || fg.android?.accuracy === 'coarse' || !(await Location.hasServicesEnabledAsync())) {
        throw new Error('Hành trình bị ngắt. Hãy bật GPS và cấp quyền vị trí chính xác cho MyMap.');
      }
      const bg = await Location.getBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
      const mode=await configureTracking(bg.status === 'granted');
      await publishTracking(true,mode);
      await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'true');
      await AsyncStorage.removeItem(TRACKING_ERROR_KEY);
    } catch (error) {
      await AsyncStorage.setItem(TRACKING_ERROR_KEY, error instanceof Error ? error.message : 'Không thể khôi phục ghi hành trình.');
      await publishTracking(false,'off',error instanceof Error?error.message:'Ghi hành trình bị ngắt.');
    }
  });
}

export async function getTrackingError(): Promise<string | null> {
  return await travelNative?.platformTrackingError?.() || AsyncStorage.getItem(TRACKING_ERROR_KEY);
}

export function stopTracking(): Promise<void> {
  return serialize(async () => {
  await AsyncStorage.setItem(TRACKING_ENABLED_KEY, 'false');
  travelNative?.setTrackingIndicator?.(false);
  await publishTracking(false,'off');
  await travelNative?.stopPlatformTracking?.();
  stopAdaptiveMotionListener();
  foregroundLocationSub?.remove();
  foregroundLocationSub = null;
  if (platformLocationStop) {
    await platformLocationStop();
    platformLocationStop = null;
  }
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  await AsyncStorage.removeItem(TRACKING_MODE_KEY);
  await AsyncStorage.removeItem(TRACKING_ERROR_KEY);
  await flushLocationWrites();
  });
}

export async function isTracking() {
  try {
    return Boolean(foregroundLocationSub) || Boolean(platformLocationStop) || await travelNative?.isPlatformTracking?.() || await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return Boolean(foregroundLocationSub) || Boolean(platformLocationStop);
  }
}

export async function getTrackingMode(): Promise<TrackingMode | null> {
  if (!(await isTracking())) return null;
  return await travelNative?.isPlatformTracking?.() || await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false) ? 'background' : 'foreground';
}
