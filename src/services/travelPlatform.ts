import {NativeModules, Platform} from 'react-native';
import {travelNative as iosTravel} from './iosTravel';
type SafetyState = {enabled: boolean; pendingAt: number; deadline: number; heightMeters: number; kind: string; emergencyNumber: string};
type TravelNative = {
 consumeTrackingShortcut?():Promise<string|null>;
 setTrackingIndicator?(enabled:boolean):void;
 getSpotubeInstallation(): Promise<{installed: boolean; packageName?: string}>;
 openSpotube(): Promise<boolean>;
 getAudioDocumentInfo(uri: string): Promise<{name: string | null; mimeType: string | null} | null>;
 openDialer(number: string): Promise<boolean>;
 startPlatformTracking(interval:number,distance:number):Promise<boolean>;
 stopPlatformTracking():Promise<boolean>;
 isPlatformTracking():Promise<boolean>;
 platformTrackingError():Promise<string|null>;
 configureSafety(enabled: boolean, number: string): Promise<boolean>;
 safetyState(): Promise<SafetyState>;
 userInteraction(): void;
 setForeground(active: boolean): void;
 dismissIncident(): void;
 playWarning(): void;
 updateCarState(json: string): void;
 getBuildInfo(): Promise<{channel:string; appstoreId:string}>;
};
export const travelNative: TravelNative | null = Platform.OS === 'android' ? NativeModules?.TravelPlatform || null : Platform.OS === 'ios' ? iosTravel : null;
export async function getSafetyState() {return travelNative?.safetyState() || {enabled:false,pendingAt:0,deadline:0,heightMeters:0,kind:'',emergencyNumber:'112'};}
export async function configureSafety(enabled: boolean, number: string) {
 if (!travelNative) throw new Error('Cần bản native có module cảm biến MyMap.');
 return travelNative.configureSafety(enabled, number);
}
