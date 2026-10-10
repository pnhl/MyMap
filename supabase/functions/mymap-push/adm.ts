export type AdmJob={token:string;owner:string;notificationId:string;callId?:string;roomId?:string};
export function createAdmSender(deps:{fetch:typeof fetch;accessToken:()=>Promise<string>}){
 return async(job:AdmJob):Promise<'provider_accepted'|'invalid'|'permanent'|'retry'>=>{
  const access=await deps.accessToken();if(!access)return 'retry';
  const response=await deps.fetch('https://api.amazon.com/messaging/registrations/'+encodeURIComponent(job.token)+'/messages',{
   method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+access,'Content-Type':'application/json','X-Amzn-Type-Version':'com.amazon.device.messaging.ADMMessage@1.0','X-Amzn-Accept-Type':'com.amazon.device.messaging.ADMSendResult@1.0'},
   body:JSON.stringify({data:{owner:job.owner,notificationId:job.notificationId,...(job.callId?{callId:job.callId}:{}),...(job.roomId?{roomId:job.roomId}:{})},expiresAfter:job.callId?60:3600,priority:'high',consolidationKey:job.notificationId})});
  if(response.ok)return 'provider_accepted';
  if(response.status===404||response.status===410)return 'invalid';
  if(response.status===400||response.status===413)return 'permanent';return 'retry';
 };
}
