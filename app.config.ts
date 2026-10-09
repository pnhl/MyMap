/// <reference types="node" />
import type {ConfigContext, ExpoConfig} from 'expo/config';
import {existsSync, readFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
// Config is evaluated before some Expo commands load dotenv. CI/EAS-provided
// variables retain precedence; this reads the ignored local file silently.
if(existsSync('./.env'))loadEnvFile('./.env');
const release = JSON.parse(readFileSync('./release.json', 'utf8'));
const TEST_ANDROID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_IOS = 'ca-app-pub-3940256099942544~1458002511';
export default ({config}: ConfigContext): ExpoConfig => {
 const store = process.env.MYMAP_STORE || 'development', production = process.env.MYMAP_RELEASE === 'true', amazon = store === 'amazon';
 const iosAds = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID, androidAds = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
 if(production && process.env.EXPO_PUBLIC_ENABLE_TEST_ADS === 'true')throw Error('Release must disable test ads.');
 const adId = store === 'ios' ? iosAds : store === 'play' ? androidAds : undefined;
 if(production && !amazon && (!adId || adId.includes('3940256099942544') || !/^ca-app-pub-\d{16}~\d{10}$/.test(adId)))throw Error('Set the real AdMob application ID for this release platform.');
 const schemes = Array.isArray(config.scheme)?config.scheme:config.scheme?[config.scheme]:[];
 const managed=['react-native-google-mobile-ads','@react-native-firebase/app','@react-native-firebase/auth','expo-apple-authentication','expo-build-properties','expo-widgets','./plugins/withMyMapAndroid.ts'];
 const plugins=(config.plugins||[]).filter(p=>!managed.includes((Array.isArray(p)?p[0]:p)||''));
 let oauth:{androidClientId?:string;webClientId?:string}={};
 const androidFirebase=process.env.GOOGLE_SERVICES_JSON || './google-services.json';
 if(existsSync(androidFirebase)){
  const json=JSON.parse(readFileSync(androidFirebase,'utf8'));
  const client=json.client?.find((c:any)=>c.client_info?.android_client_info?.package_name===release.applicationId);
  oauth={androidClientId:client?.oauth_client?.find((c:any)=>c.client_type===1)?.client_id,webClientId:client?.oauth_client?.find((c:any)=>c.client_type===3)?.client_id};
 }
 const iosFirebase=process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist', reversed=process.env.GOOGLE_IOS_REVERSED_CLIENT_ID;
 const widgets=process.env.MYMAP_ENABLE_WIDGETS !== 'false';
 const linkDomain=process.env.EXPO_PUBLIC_EMAIL_LINK_DOMAIN;
 if(linkDomain&&!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(linkDomain))throw Error('Email link domain must be a Firebase Hosting hostname.');
 return {
  ...config,name:config.name||'MyMap',slug:config.slug||'mymap',version:release.version,
  scheme:Array.from(new Set([...schemes,'mymap',release.applicationId,...(reversed?[reversed]:[])])),extra:{...config.extra,firebaseOAuth:oauth,...(process.env.EAS_PROJECT_ID?{eas:{...config.extra?.eas,projectId:process.env.EAS_PROJECT_ID}}:{})},
  android:{...config.android,package:release.applicationId,versionCode:release.build,allowBackup:false,...(linkDomain?{intentFilters:[...(config.android?.intentFilters||[]),{action:'VIEW',autoVerify:true,category:['BROWSABLE','DEFAULT'],data:[{scheme:'https',host:linkDomain,pathPrefix:'/__/auth/links'}]}]}:{}),...(existsSync(androidFirebase)?{googleServicesFile:androidFirebase}:production?{}:{googleServicesFile:undefined})},
  ios:{...config.ios,bundleIdentifier:release.applicationId,buildNumber:String(release.build),usesAppleSignIn:true,
   ...(linkDomain?{associatedDomains:Array.from(new Set([...(config.ios?.associatedDomains||[]),'applinks:'+linkDomain]))}:{}),
   ...(existsSync(iosFirebase)?{googleServicesFile:iosFirebase}:{}),
   infoPlist:{...config.ios?.infoPlist,NSFaceIDUsageDescription:'MyMap dùng Face ID khi bạn bật khóa ứng dụng hoặc mở dữ liệu riêng tư.',
    NSLocationAlwaysUsageDescription:'MyMap dùng vị trí nền để ghi hành trình bạn đã bật, kể cả khi khóa màn hình. Bạn có thể dừng ghi trong ứng dụng.',
    NSSpeechRecognitionUsageDescription:'MyMap nhận dạng giọng nói trên thiết bị khi bạn chủ động tìm địa điểm bằng giọng nói.',
    UIApplicationShortcutItems:[{UIApplicationShortcutItemType:'mymap.sos',UIApplicationShortcutItemTitle:'Mở SOS',UIApplicationShortcutItemIconType:'UIApplicationShortcutIconTypeAlarm'},{UIApplicationShortcutItemType:'mymap.smart',UIApplicationShortcutItemTitle:'Ghi hành trình',UIApplicationShortcutItemIconType:'UIApplicationShortcutIconTypeLocation'},{UIApplicationShortcutItemType:'mymap.camera',UIApplicationShortcutItemTitle:'Chụp khoảnh khắc',UIApplicationShortcutItemIconType:'UIApplicationShortcutIconTypeCapturePhoto'}],
    UIBackgroundModes:['location','audio','processing'],BGTaskSchedulerPermittedIdentifiers:['com.expo.modules.backgroundtask.processing'],NSSupportsLiveActivities:widgets,
   },entitlements:{...config.ios?.entitlements,'com.apple.developer.game-center':true}},
  plugins:[...plugins,['@react-native-firebase/app',{ios:{useFrameworks:'static',disableSPM:true}}],'@react-native-firebase/auth','expo-apple-authentication',
   ['expo-build-properties',{ios:{useFrameworks:'static',deploymentTarget:'16.4'}}],
   './plugins/withMyMapAndroid.ts','./plugins/with-release-security.cjs',
   ['./plugins/with-ios-companions.cjs',{watch:process.env.MYMAP_ENABLE_WATCH!=='false',carPlay:process.env.MYMAP_ENABLE_CARPLAY==='true'}],
   ...(widgets?[['expo-widgets',{groupIdentifier:'group.com.pnhl.vibecoding',widgets:[{name:'MyMapMomentWidget',displayName:'Khoảnh khắc MyMap',description:'Khoảnh khắc bạn đã chọn chia sẻ.',ios:{supportedFamilies:['systemSmall','systemMedium']}}]}] as any]:[]),
   ...(!amazon?[['react-native-google-mobile-ads',{androidAppId:androidAds||TEST_ANDROID,iosAppId:iosAds||TEST_IOS}]] as any:[]),
  ],
 };
};
