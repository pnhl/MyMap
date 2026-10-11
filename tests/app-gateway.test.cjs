const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {loadService}=require('./service-loader.cjs');
const base='https://gateway.example.test';
function fixture(fetch,options={}){
 const auth={currentUser:options.user===undefined?{uid:'owner-a',isAnonymous:false}:options.user},refreshes=[];
 const api=loadService('src/services/geoGateway.ts',{'../config/env':{env:{routingGatewayUrl:options.base||base}},'./firebase':{firebaseAuth:auth,getFirebaseIdToken:async force=>{refreshes.push(force);return force?'renewed-session':'current-session';}}},{fetch,Headers,URLSearchParams,AbortController,Response});
 return {api,auth,refreshes};
}
const ok=()=>new Response('{}',{status:200});
test('gateway rejects insecure bases, credential queries and path escape before fetching',async()=>{
 for(const address of ['http://gateway.example.test','https://user:password@gateway.example.test','https://gateway.example.test?token=credential']){
  const f=fixture(()=>assert.fail('invalid base fetched'),{base:address});await assert.rejects(f.api.gatewayFetch('/route'));
 }
 const f=fixture(()=>assert.fail('invalid path fetched'));
 for(const value of ['//other.example/route','/../route','/tomtom/%2fother','/route?key=credential','/route?url=https%3A%2F%2Fother.example','/unknown','/route#token'])await assert.rejects(f.api.gatewayFetch(value));
 assert.equal(f.api.isGatewayUrl(base+'.evil/route'),false);assert.equal(f.api.isGatewayUrl(base+'/route'),true);
});
test('signed-out and anonymous sessions never make credential-backed network requests',async()=>{
 for(const user of [null,{uid:'guest',isAnonymous:true}]){const f=fixture(()=>assert.fail('guest fetched'),{user});await assert.rejects(f.api.gatewayFetch('/route'),error=>error.status===401);}
});
test('one expired login token refreshes once, remains in headers and preserves request body',async()=>{
 const calls=[],f=fixture(async(url,init)=>{calls.push({url,init});return calls.length===1?new Response('',{status:401}):ok();});
 await f.api.gatewayFetch('/route',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.deepEqual(f.refreshes,[false,true]);assert.equal(calls.length,2);assert.equal(calls[0].url,base+'/route');assert.equal(calls[0].init.headers.Authorization,'Bearer current-session');assert.equal(calls[1].init.headers.Authorization,'Bearer renewed-session');assert.equal(calls[1].init.headers['content-type'],'application/json');assert.equal(calls[1].init.body,'{}');assert.equal(calls[1].init.redirect,'error');
});
test('persistent authentication rejection does not create an infinite token refresh loop',async()=>{
 let requests=0;const f=fixture(async()=>{requests++;return new Response('',{status:401});});await assert.rejects(f.api.gatewayFetch('/route'),error=>error.status===401);assert.equal(requests,2);
});
test('quota Retry-After suppresses repeated provider requests and stays scoped to the account',async()=>{
 let requests=0;const f=fixture(async()=>{requests++;return new Response('',{status:429,headers:{'Retry-After':'120'}});});
 await assert.rejects(f.api.gatewayFetch('/tomtom/search?query=cafe'),error=>error.status===429&&error.retryAfterSeconds===120);
 await assert.rejects(f.api.gatewayFetch('/tomtom/traffic/flow?point=21,105'),error=>error.status===429&&error.retryAfterSeconds>0);assert.equal(requests,1);
 f.auth.currentUser={uid:'owner-b',isAnonymous:false};await assert.rejects(f.api.gatewayFetch('/tomtom/search?query=cafe'));assert.equal(requests,2);
});
test('switching accounts during a response rejects old protected data',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;});const f=fixture(async()=>{await pending;return ok();});const request=f.api.gatewayFetch('/mapillary/graph/123?fields=id');await Promise.resolve();f.auth.currentUser={uid:'owner-b',isAnonymous:false};finish();await assert.rejects(request,error=>error.status===401);
});
test('cancellation propagates to the protected fetch without caching a response',async()=>{
 const f=fixture(async(_url,init)=>new Promise((resolve,reject)=>{if(init.signal.aborted)reject(new Error('aborted'));else init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});}));const controller=new AbortController(),request=f.api.gatewayFetch('/route',{signal:controller.signal});controller.abort();await assert.rejects(request,/aborted/);
});
test('WebView resource headers are scoped to gateway and public images bypass protected fetch',async()=>{
 const resources=loadService('src/services/gatewayWebResources.ts',{'../config/env':{env:{routingGatewayUrl:base}}}),calls=[];
 const context={URL:{createObjectURL:()=> 'blob:resource',revokeObjectURL:()=>{}},fetch:async(url,init)=>{calls.push({url,init});return{ok:true,blob:async()=>({})};}};
 vm.runInNewContext(resources.gatewayWebPrelude('runtime-login')+';globalThis.headersFor=resourceHeaders;globalThis.loadImage=loadResourceImage;',context);
 assert.equal(context.headersFor('https://tile.openstreetmap.org/1/1/1.png').Authorization,undefined);assert.equal(context.headersFor(base+'.evil/tile').Authorization,undefined);assert.equal(context.headersFor(base+'/stadia/tiles/style/1/1/1.png').Authorization,'Bearer runtime-login');
 const publicImage={};context.loadImage(publicImage,'https://cdn.example/photo.jpg');assert.equal(publicImage.src,'https://cdn.example/photo.jpg');assert.equal(calls.length,0);
 const protectedImage={};context.loadImage(protectedImage,base+'/mapillary/images/123?size=1024');await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].init.headers.Authorization,'Bearer runtime-login');assert.equal(calls[0].init.redirect,'error');assert.equal(protectedImage.src,'blob:resource');
});
test('session hook clears logout immediately, rejects late refresh and disposes refresh listeners',async()=>{
 let state,cleanup,tokenListener,foreground,resolveToken,removed=0,unsubscribed=0,cleared=0;
 const auth={currentUser:{uid:'owner-a',isAnonymous:false}},pending=new Promise(resolve=>{resolveToken=resolve;});
 const hook=loadService('src/hooks/useGatewaySession.ts',{
  react:{useState:initial=>{state=initial;return[state,next=>{state=typeof next==='function'?next(state):next;}];},useEffect:effect=>{cleanup=effect();}},
  'react-native':{AppState:{addEventListener:(_event,listener)=>{foreground=listener;return{remove:()=>removed++};}}},
  '@react-native-firebase/auth':{onIdTokenChanged:(_auth,listener)=>{tokenListener=listener;return()=>unsubscribed++;}},
  '../services/firebase':{firebaseAuth:auth,getFirebaseIdToken:()=>pending},'../config/env':{env:{routingGatewayUrl:base}},
 },{setInterval:()=>1,clearInterval:()=>cleared++});
 hook.useGatewaySession();auth.currentUser=null;tokenListener(null);assert.equal(state.token,'');resolveToken('old-login');await new Promise(resolve=>setImmediate(resolve));assert.equal(state.owner,'');assert.equal(state.token,'');foreground('active');cleanup();assert.equal(removed,1);assert.equal(unsubscribed,1);assert.equal(cleared,1);
});
