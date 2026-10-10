import {Platform,TurboModuleRegistry} from 'react-native';
import Native from '../../modules/my-map-capabilities';
export function googleServicesAvailable(){try{return Platform.OS!=='android'||Native?.runtimeCapabilities?.().gms===true;}catch{return false;}}
export function adsSdkAvailable(){return googleServicesAvailable()&&!!TurboModuleRegistry.get('RNGoogleMobileAdsModule');}
export function googleSignInAvailable(){return googleServicesAvailable()&&!!TurboModuleRegistry.get('RNGoogleSignin');}
