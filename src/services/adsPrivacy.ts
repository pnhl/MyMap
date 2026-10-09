import {adsSdkAvailable} from './nativeSdks';
import {initializeAmazonPublisherServices} from './platformLocation';
import {env} from '../config/env';
import {recordAdDiagnostic} from './adDiagnostics';
let ready:Promise<boolean>|null=null;
export function resetAdsConsent(){ready=null;}
export function prepareAds():Promise<boolean>{
 if(!adsSdkAvailable())return Promise.resolve(false);
 const {default:mobileAds,AdsConsent}=require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
 // Private QA builds request Google's sample units on an emulator. They do not
 // depend on the publisher's live CMP setup. Release builds force this flag off.
 if(env.enableTestAds)return mobileAds().initialize().then(()=>true).catch(()=>false);
 if(!ready)ready=(async()=>{recordAdDiagnostic('consent','initializing','Đang kiểm tra quyền riêng tư quảng cáo.');let canRequest=false;let reason='SDK chưa cho phép yêu cầu quảng cáo.';try{const consent=await AdsConsent.gatherConsent();canRequest=consent.canRequestAds;}catch(error){reason=error instanceof Error?error.message:reason;canRequest=(await AdsConsent.getConsentInfo().catch(()=>null))?.canRequestAds||false;}
  if(!canRequest){recordAdDiagnostic('consent','blocked',reason);ready=null;return false;}
  await initializeAmazonPublisherServices(env.amazonApsAppId).catch(()=>false);
  await mobileAds().initialize();recordAdDiagnostic('consent','ready','SDK quảng cáo đã sẵn sàng.');return true;
 })().catch((error)=>{recordAdDiagnostic('consent','error',error instanceof Error?error.message:'Chưa khởi tạo được SDK.');ready=null;return false;});
 return ready;
}
