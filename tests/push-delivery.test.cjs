const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('supabase/functions/mymap-push/handler.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleObject={exports:{}};vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports,Response,AbortSignal,JSON,Error});
const {createPushHandler}=moduleObject.exports;
const job={id:'job',lease:'lease',state:'queued',ticket:null,token:'ExpoPushToken[private]',notificationId:'event',owner:'firebase-owner',callId:'call',roomId:'room'};
test('push rejects unauthorized callers before claiming tokens or sending messages',async()=>{
 let used=0;const handler=createPushHandler({authorize:()=>false,claim:async()=>{used++;return[job];},fetch:async()=>{used++;},finish:async()=>{used++;}});
 assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);assert.equal(used,0);
});
test('push ignores caller-selected recipients and never sends private message text',async()=>{
 const sent=[],finished=[];const handler=createPushHandler({authorize:()=>true,claim:async()=>[job],fetch:async(url,init)=>{sent.push({url,payload:JSON.parse(init.body)});return new Response(JSON.stringify({data:[{status:'ok',id:'receipt'}]}));},finish:async(...args)=>finished.push(args)});
 const response=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({to:'attacker',body:'private chat'})}));
 assert.equal(response.status,200);assert.equal(sent[0].payload[0].to,job.token);assert.equal(sent[0].payload[0].data.owner,job.owner);assert.ok(!JSON.stringify(sent).includes('private chat'));assert.equal(finished[0][1],'accepted');assert.equal(finished[0][2],'receipt');
});
test('invalid device registration is revoked and receipts distinguish acceptance from delivery',async()=>{
 const result=[];const receipt={...job,state:'receipt',ticket:'ticket'};
 const handler=createPushHandler({authorize:()=>true,claim:async()=>[job,receipt],fetch:async url=>new Response(JSON.stringify(url.endsWith('/send')?{data:[{status:'error',details:{error:'DeviceNotRegistered'}}]}:{data:{ticket:{status:'ok'}}})),finish:async(j,state)=>result.push([j.state,state])});
 assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,200);assert.deepEqual(result,[['queued','invalid'],['receipt','delivered']]);
});
test('provider outage leaves leased jobs recoverable and never exposes tokens in errors',async()=>{
 let done=0;const handler=createPushHandler({authorize:()=>true,claim:async()=>[job],fetch:async()=>{throw Error(job.token);},finish:async()=>done++});
 const response=await handler(new Request('https://example.test',{method:'POST'}));assert.equal(response.status,503);assert.equal(done,0);assert.ok(!(await response.text()).includes(job.token));
});
