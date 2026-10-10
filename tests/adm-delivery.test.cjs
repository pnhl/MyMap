const test=require('node:test'),assert=require('node:assert/strict');
const {loadService}=require('./service-loader.cjs');
const {createAdmSender}=loadService('supabase/functions/mymap-push/adm.ts',{}, {AbortSignal});
test('ADM sends only generic owner routing metadata and treats provider acceptance separately',async()=>{
 let request;const sender=createAdmSender({accessToken:async()=> 'fixture-access',fetch:async(url,init)=>{request={url,body:JSON.parse(init.body)};return new Response('{}',{status:200});}});
 assert.equal(await sender({token:'fixture-token',owner:'alice',notificationId:'notification',callId:'call'}),'provider_accepted');
 assert.equal(request.body.expiresAfter,60);assert.equal(request.body.priority,'high');assert.equal(request.body.data.owner,'alice');assert.equal(request.body.data.callId,'call');assert.equal(request.body.data.body,undefined);
});
test('ADM distinguishes invalid registration, permanent payload and temporary outage without token logs',async()=>{
 for(const [status,want]of [[404,'invalid'],[410,'invalid'],[400,'permanent'],[413,'permanent'],[401,'retry'],[429,'retry'],[503,'retry']]){
  const sender=createAdmSender({accessToken:async()=> 'fixture-access',fetch:async()=>new Response('{}',{status})});assert.equal(await sender({token:'fixture-token',owner:'alice',notificationId:'event'}),want);
 }
});
