import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import { LOCATION_TASK_NAME } from './backgroundLocationTask';
import { insertLocationPoint } from '../db/database';
import {
  getPlatformCurrentPosition,
  isAmazonLocationDevice,
  startPlatformLocationUpdates,
} from './platformLocation';

export type BatteryProfile = 'battery_saver' | 'balanced' | 'high_accuracy' | 'adaptive_ai';
const PROFILE_KEY = 'mymap:battery-profile';
const TRACKING_MODE_KEY = 'mymap:tracking-mode';

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
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 100,
    timeInterval: 120_000,
    deferredUpdatesDistance: 250,
    deferredUpdatesInterval: 300_000,
  },
  balanced: {
    accuracy: Location.Accuracy.High,
    distanceInterval: 40,
    timeInterval: 60_000,
    deferredUpdatesDistance: 100,
    deferredUpdatesInterval: 120_000,
  },
  high_accuracy: {
    accuracy: Location.Accuracy.Highest,
    distanceInterval: 15,
    timeInterval: 20_000,
    deferredUpdatesDistance: 30,
    deferredUpdatesInterval: 45_000,
  },
  adaptive_ai: {
    // Adaptive mode starts with balanced and adjusts dynamically based on motion sensor
    accuracy: Location.Accuracy.High,
    distanceInterval: 30,
    timeInterval: 30_000,
    deferredUpdatesDistance: 50,
    deferredUpdatesInterval: 60_000,
  },
};

// Adaptive motion sensor tracking
let accelerometerSub: any = null;
let isUserStationary = false;
let foregroundLocationSub: Location.LocationSubscription | null = null;
let platformLocationStop: (() => Promise<void>) | null = null;

async function persistLocation(location: Location.LocationObject): Promise<boolean> {
  const c = location.coords;
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return false;
  await insertLocationPoint({
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy: c.accuracy ?? null,
    altitude: c.altitude ?? null,
    speed: c.speed ?? null,
    heading: c.heading ?? null,
    timestamp: Math.round(location.timestamp || Date.now()),
  });
  return true;
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
  await AsyncStorage.setItem(PROFILE_KEY, profile);
  if (await isTracking()) {
    await stopTracking();
    await startTracking();
  }
}

export async function requestTrackingPermissions(): Promise<{ backgroundGranted: boolean }> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) throw new Error('Dịch vụ vị trí đang tắt. Hãy bật GPS/Location Services.');
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Bạn chưa cấp quyền vị trí khi dùng ứng dụng.');
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return { backgroundGranted: bg.status === 'granted' };
  } catch {
    // Fire OS and a number of Android builds do not expose the same background
    // permission flow. Foreground recording remains useful and must not fail.
    return { backgroundGranted: false };
  }
}

export async function startTracking(): Promise<TrackingStartResult> {
  const { backgroundGranted } = await requestTrackingPermissions();
  const profile = await getBatteryProfile();
  const p = profiles[profile];
  const usePlatformLocation = await isAmazonLocationDevice();

  if (profile === 'adaptive_ai') {
    startAdaptiveMotionListener();
  } else {
    stopAdaptiveMotionListener();
  }

  // Save a point immediately so the user can see that recording has begun.
  // Previously the balanced profile could appear empty for 60 seconds / 40 m.
  let firstPointSaved = false;
  try {
    const first = usePlatformLocation
      ? await getPlatformCurrentPosition()
      : await Location.getCurrentPositionAsync({ accuracy: p.accuracy });
    if (!first) throw new Error('No platform location available');
    firstPointSaved = await persistLocation(first);
  } catch {
    const last = usePlatformLocation
      ? await getPlatformCurrentPosition()
      : await Location.getLastKnownPositionAsync().catch(() => null);
    if (last) firstPointSaved = await persistLocation(last);
  }

  let backgroundStarted = false;
  const alreadyBackground = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (!usePlatformLocation && backgroundGranted && !alreadyBackground) {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        ...p,
        pausesUpdatesAutomatically: profile === 'battery_saver',
        showsBackgroundLocationIndicator: profile === 'high_accuracy' || profile === 'adaptive_ai',
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
    } catch {
      // Fall through to the foreground watcher on devices without a compatible
      // background provider (including some Fire OS versions).
    }
  } else {
    backgroundStarted = alreadyBackground;
  }

  if (usePlatformLocation && !platformLocationStop) {
    platformLocationStop = await startPlatformLocationUpdates(
      Math.min(p.timeInterval, 15_000),
      Math.min(p.distanceInterval, 20),
      location => { void persistLocation(location).catch(() => {}); },
    );
  } else if (!usePlatformLocation && !foregroundLocationSub) {
    foregroundLocationSub = await Location.watchPositionAsync(
      {
        accuracy: p.accuracy,
        distanceInterval: Math.min(p.distanceInterval, 20),
        timeInterval: Math.min(p.timeInterval, 15_000),
      },
      location => { void persistLocation(location).catch(() => {}); },
    );
  }

  const mode: TrackingMode = backgroundStarted ? 'background' : 'foreground';
  await AsyncStorage.setItem(TRACKING_MODE_KEY, mode).catch(() => {});
  return { mode, firstPointSaved };
}

export async function stopTracking() {
  stopAdaptiveMotionListener();
  foregroundLocationSub?.remove();
  foregroundLocationSub = null;
  if (platformLocationStop) {
    await platformLocationStop();
    platformLocationStop = null;
  }
  const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  const started = registered && (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME));
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  await AsyncStorage.removeItem(TRACKING_MODE_KEY).catch(() => {});
}

export async function isTracking() {
  try {
    return Boolean(foregroundLocationSub) || Boolean(platformLocationStop) || await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return Boolean(foregroundLocationSub) || Boolean(platformLocationStop);
  }
}

export async function getTrackingMode(): Promise<TrackingMode | null> {
  if (!(await isTracking())) return null;
  const mode = await AsyncStorage.getItem(TRACKING_MODE_KEY);
  return mode === 'background' ? 'background' : 'foreground';
}
