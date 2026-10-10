type Job={id:string;lease:string;state:'queued'|'receipt';ticket:string|null;token:string;provider?:'expo'|'adm';notificationId:string;owner:string;callId?:string;roomId?:string};
type Result={status?:string;id?:string;details?:{error?:string}};
type Dependencies={authorize:(request:Request)=>boolean;claim:()=>Promise<Job[]>;finish:(job:Job,result:string,ticket?:string)=>Promise<void>;fetch:typeof fetch;accessToken?:string;sendAdm?:(job:Job)=>Promise<string>};
export function createPushHandler(deps:Dependencies){return async(request:Request)=>{
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
 if(!deps.authorize(request))return reply(401,{error:'not_authorized'});
 try{
  const jobs=await deps.claim();let accepted=0,delivered=0;
  const headers:Record<string,string>={'Content-Type':'application/json',...(deps.accessToken?{Authorization:'Bearer '+deps.accessToken}:{})};
  for(const job of jobs.filter(j=>j.provider==='adm')){const result=deps.sendAdm?await deps.sendAdm(job):'retry';await deps.finish(job,result);if(result==='provider_accepted')accepted++;}
  const send=jobs.filter(j=>j.provider!=='adm'&&j.state==='queued'),receipts=jobs.filter(j=>j.provider!=='adm'&&j.state==='receipt'&&j.ticket);
  if(send.length){
   const response=await deps.fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers,signal:AbortSignal.timeout(15000),body:JSON.stringify(send.map(j=>({to:j.token,title:'Thông báo MyMap',body:j.callId?'Bạn có lời mời tham gia cuộc gọi.':'Bạn có hoạt động mới. Mở MyMap để xem.',sound:'default',priority:'high',ttl:j.callId?60:3600,channelId:'mymap_remote',data:{notificationId:j.notificationId,owner:j.owner,...(j.callId?{callId:j.callId}:{}),...(j.roomId?{roomId:j.roomId}:{})}})))});
   if(!response.ok)throw Error('provider_unavailable');const payload=await response.json();const results=Array.isArray(payload.data)?payload.data:[];
   for(let i=0;i<send.length;i++){const job=send[i]!,result=results[i] as Result|undefined;
    if(result?.status==='ok'&&result.id){await deps.finish(job,'accepted',result.id);accepted++;}
    else await deps.finish(job,result?.details?.error==='DeviceNotRegistered'?'invalid':result?.details?.error==='MessageTooBig'?'permanent':'retry');
   }
  }
  if(receipts.length){
   const response=await deps.fetch('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers,signal:AbortSignal.timeout(15000),body:JSON.stringify({ids:receipts.map(j=>j.ticket)})});
   if(!response.ok)throw Error('provider_unavailable');const payload=await response.json();
   for(const job of receipts){const result=payload.data?.[job.ticket!] as Result|undefined;
    if(result?.status==='ok'){await deps.finish(job,'delivered');delivered++;}
    else await deps.finish(job,result?.details?.error==='DeviceNotRegistered'?'invalid':result?.status==='error'&&result.details?.error!=='MessageRateExceeded'?'permanent':'retry');
   }
  }
  return reply(200,{accepted,delivered,claimed:jobs.length});
 }catch{return reply(503,{error:'push_temporarily_unavailable'});}
};}
