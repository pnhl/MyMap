import { AppState, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type * as Location from 'expo-location';
import * as ExpoLocation from 'expo-location';

type NativeLocationPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
};

type PlatformLocationNative = {
  isAmazonDevice(): Promise<boolean>;
  initializeAmazonAds(appId: string): Promise<boolean>;
  getCurrentPosition(): Promise<NativeLocationPoint>;
  startUpdates(intervalMs: number, distanceMeters: number): Promise<boolean>;
  stopUpdates(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const native: PlatformLocationNative | null =
  Platform.OS === 'android' ? (NativeModules.PlatformLocation as PlatformLocationNative | undefined) ?? null : null;
const emitter = native ? new NativeEventEmitter(NativeModules.PlatformLocation) : null;

function toExpoLocation(point: NativeLocationPoint): Location.LocationObject {
  return {
    timestamp: point.timestamp || Date.now(),
    mocked: false,
    coords: {
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy,
      altitude: point.altitude,
      altitudeAccuracy: null,
      heading: point.heading,
      speed: point.speed,
    },
  };
}

export async function isAmazonLocationDevice(): Promise<boolean> {
  return native ? native.isAmazonDevice().catch(() => false) : false;
}

export async function initializeAmazonPublisherServices(appId: string): Promise<boolean> {
  if (!native || !appId.trim()) return false;
  return native.initializeAmazonAds(appId.trim()).catch(() => false);
}

export async function getPlatformCurrentPosition(): Promise<Location.LocationObject | null> {
  if (!native) return null;
  return getDeviceCurrentPosition().catch(() => null);
}

async function startNativeLocationUpdates(
  intervalMs: number,
  distanceMeters: number,
  onLocation: (location: Location.LocationObject) => void,
): Promise<() => Promise<void>> {
  if (!native || !emitter) throw new Error('Platform location module is unavailable');
  const subscription = emitter.addListener('platformLocation', (point: NativeLocationPoint) => {
    onLocation(toExpoLocation(point));
  });
  try {
    await native.startUpdates(intervalMs, distanceMeters);
  } catch (error) {
    subscription.remove();
    throw error;
  }
  return async () => {
    subscription.remove();
    await native.stopUpdates().catch(() => false);
  };
}

/** GPS can be on even when Google's network/accuracy provider is unavailable. */
export async function shouldUsePlatformLocation(): Promise<boolean> {
  if (!native) return false;
  if (await isAmazonLocationDevice()) return true;
  const status = await ExpoLocation.getProviderStatusAsync().catch(() => null);
  return status?.gpsAvailable === true && status.networkAvailable === false;
}

type Consumer = {
  options: Location.LocationOptions;
  onLocation: (location: Location.LocationObject) => void;
  onError?: (message: string) => void;
};
const consumers = new Map<symbol, Consumer>();
let source: (() => Promise<void>) | null = null;
let sourceKey = '';
let operations: Promise<unknown> = Promise.resolve();
let stateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

function publish(location: Location.LocationObject) {
  if (AppState.currentState != null && AppState.currentState !== 'active') return;
  for (const consumer of [...consumers.values()]) consumer.onLocation(location);
}
function publishError(message: string) {
  for (const consumer of [...consumers.values()]) consumer.onError?.(message);
}

function reconcile(): Promise<void> {
  const next = operations.then(async () => {
    // UI watchers must release their requests when another app is foreground.
    // Authorized journey recording has its own foreground service and stays on.
    const active = AppState.currentState === 'active' || AppState.currentState == null;
    const clients = active ? [...consumers.values()] : [];
    if (!clients.length) {
      if (source) await source();
      source = null;
      sourceKey = '';
      return;
    }
    const interval = Math.min(...clients.map(c => c.options.timeInterval ?? 5000));
    const distance = Math.min(...clients.map(c => c.options.distanceInterval ?? 5));
    const accuracy = Math.max(...clients.map(c => c.options.accuracy ?? ExpoLocation.Accuracy.High));
    const platform = await shouldUsePlatformLocation();
    const key = `${platform}:${interval}:${distance}:${accuracy}`;
    if (source && sourceKey === key) return;
    if (source) await source();
    source = null;
    sourceKey = '';
    if (platform) {
      source = await startNativeLocationUpdates(interval, distance, publish);
    } else {
      try {
        const watch = await ExpoLocation.watchPositionAsync({
          accuracy, timeInterval: interval, distanceInterval: distance,
          // Do not repeatedly request changes to global Google location settings.
          mayShowUserSettingsDialog: false,
        }, publish, publishError);
        source = async () => watch.remove();
      } catch (error) {
        // GMS/provider failure is distinct from missing app permission or GPS off.
        const permission = await ExpoLocation.getForegroundPermissionsAsync();
        if (!native || !permission.granted || !await ExpoLocation.hasServicesEnabledAsync()) throw error;
        source = await startNativeLocationUpdates(interval, distance, publish);
      }
    }
    sourceKey = key;
  });
  operations = next.catch(() => {});
  return next;
}

/** One foreground source with independently removable subscribers. */
export async function watchDevicePosition(
  options: Location.LocationOptions,
  onLocation: Consumer['onLocation'],
  onError?: Consumer['onError'],
): Promise<Location.LocationSubscription> {
  const id = Symbol('location-consumer');
  consumers.set(id, {options, onLocation, onError});
  if (!stateSubscription) stateSubscription = AppState.addEventListener('change', () => {
    void reconcile().catch(error => publishError(error instanceof Error ? error.message : String(error)));
  });
  const remove = () => {
    if (!consumers.delete(id)) return;
    if (!consumers.size) { stateSubscription?.remove(); stateSubscription = null; }
    void reconcile().catch(() => {});
  };
  try { await reconcile(); } catch (error) { remove(); throw error; }
  return {remove};
}

/** Bounded fix: timeout removes the request instead of abandoning an active GPS promise. */
export async function getDeviceCurrentPosition(
  options: Location.LocationOptions & {timeoutMs?: number} = {},
): Promise<Location.LocationObject> {
  const {timeoutMs = 10000, ...watchOptions} = options;
  return new Promise((resolve, reject) => {
    let finished = false;
    let subscription: Location.LocationSubscription | undefined;
    const finish = (position: Location.LocationObject | null, error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      subscription?.remove();
      if (position) resolve(position); else reject(error ?? new Error('Chưa nhận được tín hiệu GPS.'));
    };
    const timer = setTimeout(() => finish(null, new Error('Đang chờ tín hiệu GPS; dịch vụ vị trí có thể vẫn đang bật.')), timeoutMs);
    void watchDevicePosition({accuracy: ExpoLocation.Accuracy.High, timeInterval: 1000, distanceInterval: 0, ...watchOptions},
      position => { if (Date.now() - position.timestamp <= 120000) finish(position); },
      message => finish(null, new Error(message)),
    ).then(watch => { subscription = watch; if (finished) watch.remove(); }, error => finish(null, error));
  });
}

export async function startPlatformLocationUpdates(
  intervalMs: number, distanceMeters: number, onLocation: Consumer['onLocation'],
): Promise<() => Promise<void>> {
  const watch = await watchDevicePosition({timeInterval: intervalMs, distanceInterval: distanceMeters}, onLocation);
  return async () => watch.remove();
}

export function watchNavigationPosition(onLocation:Consumer['onLocation']):Promise<Location.LocationSubscription> {
  return watchDevicePosition({accuracy: ExpoLocation.Accuracy.High, timeInterval: 1200, distanceInterval: 2}, onLocation);
}
