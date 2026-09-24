import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type * as Location from 'expo-location';

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

export async function getPlatformCurrentPosition(): Promise<Location.LocationObject | null> {
  if (!native) return null;
  const result = await Promise.race([
    native.getCurrentPosition(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Platform location timeout')), 10_000)),
  ]).catch(() => null);
  return result ? toExpoLocation(result) : null;
}

export async function startPlatformLocationUpdates(
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
