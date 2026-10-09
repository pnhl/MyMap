import {TurboModuleRegistry} from 'react-native';
export function adsSdkAvailable(){return !!TurboModuleRegistry.get('RNGoogleMobileAdsModule');}
export function googleSignInAvailable(){return !!TurboModuleRegistry.get('RNGoogleSignin');}
