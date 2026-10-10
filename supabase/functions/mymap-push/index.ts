import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createPushHandler} from './handler.ts';
import {createAdmSender} from './adm.ts';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const client=createClient(Deno.env.get('SUPABASE_URL')||'',key,{auth:{persistSession:false}});
function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
let admAccess='',admExpires=0;
const sendAdm=createAdmSender({fetch,accessToken:async()=>{
 if(admAccess&&Date.now()<admExpires)return admAccess;
 const clientId=Deno.env.get('ADM_CLIENT_ID'),secret=Deno.env.get('ADM_CLIENT_SECRET');if(!clientId||!secret)return '';
 const response=await fetch('https://api.amazon.com/auth/O2/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'messaging:push',client_id:clientId,client_secret:secret})});
 if(!response.ok)throw Error('adm_authorization_unavailable');const data=await response.json();if(typeof data.access_token!=='string')throw Error('adm_authorization_unavailable');admAccess=data.access_token;admExpires=Date.now()+Math.max(0,Number(data.expires_in||0)-60)*1000;return admAccess;
}});
Deno.serve(createPushHandler({
 authorize:req=>Boolean(key)&&equal(req.headers.get('Authorization')||'','Bearer '+key),
 claim:async()=>{const {data,error}=await client.rpc('mm_claim_push_jobs');if(error)throw Error('queue_unavailable');return data||[];},
 finish:async(job,result,ticket)=>{const {error}=await client.rpc('mm_finish_push_job',{p_job:job.id,p_lease:job.lease,p_result:result,p_ticket:ticket||null});if(error)throw Error('queue_unavailable');},
 fetch,sendAdm,accessToken:Deno.env.get('EXPO_ACCESS_TOKEN'),
}));
