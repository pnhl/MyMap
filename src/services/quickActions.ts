import {requireOptionalNativeModule} from 'expo';
type Actions={consumeQuickAction():Promise<string|null>;addListener(event:'onQuickAction',fn:()=>void):{remove():void}};
const native=requireOptionalNativeModule<Actions>('MyMapTravel');
export function startQuickActions(open:(name:'SOS'|'Smart'|'MomentCamera')=>void){
 let active=true;
 const consume=()=>void native?.consumeQuickAction().then(value=>{if(!active)return;const name=value==='mymap.sos'?'SOS':value==='mymap.smart'?'Smart':value==='mymap.camera'?'MomentCamera':null;if(name)open(name);}).catch(()=>{});
 const listener=native?.addListener('onQuickAction',consume);consume();
 return()=>{active=false;listener?.remove();};
}
