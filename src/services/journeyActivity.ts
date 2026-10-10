import {Platform} from 'react-native';
import {parseNavigationSnapshot,type TrackingSnapshot,type NavigationSnapshot} from '../types/parity';
let tracking=false,navigation:NavigationSnapshot|null=null;
let operations:Promise<unknown>=Promise.resolve(),lastUpdate=0;
function update(){
 if(Platform.OS!=='ios')return;
 operations=operations.catch(()=>{}).then(async()=>{
  const {default:factory}=await import('../widgets/JourneyActivity');
  const current=factory.getInstances();
  if(!tracking&&!navigation?.active){await Promise.all(current.map(a=>a.end('immediate')));return;}
  const props={tracking,instruction:navigation?.active?navigation.guidance?.instruction||'Theo dõi hướng dẫn trong MyMap':'Vị trí đang được lưu riêng tư trên thiết bị.',speed:navigation?.active&&Number.isFinite(navigation.speed)?Math.round(navigation.speed!)+' km/h':''};
  const stale=new Date(Date.now()+120000);
  if(current.length){await current[0]!.update(props,stale);await Promise.all(current.slice(1).map(a=>a.end('immediate')));}else factory.start(props,'mymap://smart',stale);
 }).catch(()=>{/* ActivityKit may be unavailable or disabled by the owner. GPS continues. */});
}
export function setJourneyActivityTracking(enabled:boolean,snapshot?:TrackingSnapshot){tracking=snapshot? snapshot.enabled&&snapshot.mode!=='off'&&!snapshot.error:enabled;update();}
export function publishJourneyActivity(json:string){
 try{const next=parseNavigationSnapshot(json);const changed=Boolean(navigation?.active)!==Boolean(next.active);navigation=next;
  if(changed||Date.now()-lastUpdate>5000){lastUpdate=Date.now();update();}
 }catch{/* Ignore malformed native navigation snapshots. */}
}
