import MyMapSafety from '../../modules/my-map-safety';
import {initializeExtensions,extensionSnapshot,subscribeExtensions} from './extensionPreferences';
import {subscribeAuthState} from './auth';
export function startWearCompanion(){
 const native=MyMapSafety as unknown as {configureWearDevice?:(enabled:boolean)=>Promise<void>}|null;
 let alive=true;
 const configure=()=>{if(alive)void native?.configureWearDevice?.(extensionSnapshot().wearOs).catch(()=>{});};
 void initializeExtensions().then(configure);const prefs=subscribeExtensions(configure);
 const auth=subscribeAuthState((_event,session)=>{if(!session)void native?.configureWearDevice?.(false).catch(()=>{});else configure();});
 return()=>{alive=false;prefs();auth();void native?.configureWearDevice?.(false).catch(()=>{});};
}
