export type TrackingSnapshot={schema:1;owner:string|null;enabled:boolean;mode:'off'|'foreground'|'background';updatedAt:number;error:string|null};
export type NavigationSnapshot={schema:1;active:boolean;guidance?:{instruction?:string}|null;speed?:number|null;updatedAt:number;[key:string]:unknown};
export type RuntimeCapabilities={gms:boolean;locationProvider:'core-location'|'system';accelerometer:boolean;barometer:boolean;deviceCredential:boolean;dialer:boolean;local64Bit:boolean;totalBytes:number;ads:boolean;push:'apns'|'fcm'|'adm'|'unavailable'};
export type RecapRequest={schema:1;account:string;items:{uri:string;kind:'photo'|'video';label:string;durationMs:number}[]};
export type SafetyPhase='off'|'armed'|'pending'|'sos'|'queued';
export type SafetySnapshot={phase:SafetyPhase;incident:string|null;deadline:number;delivery:'none'|'queued'|'accepted'|'delivered'};
export type SafetyEvent={type:'enable'|'disable'|'cancel'}|{type:'incident';id:string;deadline:number}|{type:'confirm';online:boolean}|{type:'accepted'}|{type:'delivered'};
export function reduceSafety(state:SafetySnapshot,event:SafetyEvent):SafetySnapshot{
 switch(event.type){
  case 'disable':return {phase:'off',incident:null,deadline:0,delivery:'none'};
  case 'enable':return state.phase==='off'?{...state,phase:'armed'}:state;
  case 'incident':return state.phase==='armed'?{phase:'pending',incident:event.id,deadline:event.deadline,delivery:'none'}:state;
  case 'cancel':return state.phase==='pending'?{phase:'armed',incident:null,deadline:0,delivery:'none'}:state;
  case 'confirm':return state.phase==='pending'?{...state,phase:event.online?'sos':'queued',delivery:event.online?'none':'queued'}:state;
  case 'accepted':return state.phase==='queued'||state.phase==='sos'?{...state,phase:'sos',delivery:'accepted'}:state;
  case 'delivered':return state.phase==='sos'&&state.delivery==='accepted'?{...state,delivery:'delivered'}:state;
 }
}
export function parseNavigationSnapshot(json:string,now=Date.now()):NavigationSnapshot{
 const value=JSON.parse(json);if(typeof value.active!=='boolean')throw Error('Invalid navigation snapshot.');
 return {...value,schema:1,active:value.active,guidance:{...value.guidance,instruction:typeof value.guidance?.instruction==='string'?value.guidance.instruction.slice(0,500):undefined},speed:Number.isFinite(value.speed)&&value.speed>=0?value.speed:undefined,updatedAt:now};
}
