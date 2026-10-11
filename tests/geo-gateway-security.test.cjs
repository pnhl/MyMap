const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const PROJECT = 'mymap-a3ae4';
const fixtureKeys = webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']);
const base64url = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
async function token(overrides = {}, header = {}) {
  const now = Math.floor(Date.now()/1000), keys = await fixtureKeys;
  const content = `${base64url({alg:'RS256',kid:'fixture-key',...header})}.${base64url({sub:'member-a',aud:PROJECT,iss:`https://securetoken.google.com/${PROJECT}`,iat:now-10,auth_time:now-10,exp:now+3600,firebase:{sign_in_provider:'password'},...overrides})}`;
  return `${content}.${Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(content))).toString('base64url')}`;
}
function loadWorker(fetchImplementation) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename); if (cache.has(filename)) return cache.get(filename);
    const module = {exports:{}}; cache.set(filename,module.exports);
    const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(compiled,{module,exports:module.exports,require:name=>load(path.resolve(path.dirname(filename),`${name}.ts`)),fetch:fetchImplementation,Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,AbortSignal,crypto:webcrypto,atob,btoa,Date,setTimeout,clearTimeout},{filename});
    return module.exports;
  }
  return load(path.resolve(__dirname,'../cloudflare/geo-gateway/src/index.ts'));
}
function namespace(Quota) {
  const objects = new Map();
  const storageById = new Map();
  return {
    idFromName:name=>name,
    get(id) {
      if (!objects.has(id)) {
        const data = storageById.get(id) || new Map(); storageById.set(id,data);
        let queue = Promise.resolve(), alarm = null;
        const storage = {get:async key=>data.get(key),put:async(key,value)=>data.set(key,structuredClone(value)),getAlarm:async()=>alarm,setAlarm:async value=>{alarm=value;},deleteAll:async()=>data.clear(),transaction(callback){const next=queue.then(()=>callback(storage));queue=next.catch(()=>{});return next;}};
        const object = new Quota({storage});
        objects.set(id,{fetch:(url,init)=>object.fetch(new Request(url,init))});
      }
      return objects.get(id);
    },
    evict(id) { objects.delete(id); },
  };
}
async function setup(provider) {
  const calls=[];
  const jwk=await webcrypto.subtle.exportKey('jwk',(await fixtureKeys).publicKey);jwk.kid='fixture-key';
  const loaded=loadWorker(async(input,init)=>{
    const url=new URL(String(input));calls.push({url,init});
    if(url.hostname==='www.googleapis.com')return Response.json({keys:[jwk]},{headers:{'Cache-Control':'public, max-age=3600'}});
    return provider?provider(url,init):Response.json({});
  });
  const env={FIREBASE_PROJECT_ID:PROJECT,GEO_QUOTA:namespace(loaded.GeoQuota),STADIA_KEY:{get:async()=>'fixture-stadia-private'},TOMTOM_KEY:'fixture-tomtom-private',MAPILLARY_TOKEN:{get:async()=>'fixture-mapillary-private'},GRAPHHOPPER_KEY:'fixture-graphhopper-private',CESIUM_ION_TOKEN:'fixture-cesium-private',ROUTING_PROVIDERS:'osrm'};
  const access=await token();
  async function request(url,options={}) {
    const {auth=access,...init}=options;
    return loaded.default.fetch(new Request(`https://gateway.example${url}`,{...init,headers:{...(auth?{Authorization:`Bearer ${auth}`} : {}),...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}}),env);
  }
  return {request,env,calls,loaded};
}
const routeBody=JSON.stringify({origin:{latitude:10,longitude:106},destination:{latitude:10.1,longitude:106.1},mode:'car'});

test('health is public and never resolves a secret or calls an upstream',async()=>{
  const s=await setup();s.env.STADIA_KEY={get:async()=>{throw Error('must not resolve');}};
  const response=await s.request('/health',{auth:null});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,service:'mymap-geo-gateway'});assert.equal(s.calls.length,0);
  assert.equal((await s.request('/health?key=caller-secret',{auth:null})).status,400);
});
test('missing, forged, expired, wrong-project and anonymous Firebase tokens fail closed',async()=>{
  const s=await setup();
  const tokens=[null,'broken',await token({exp:Math.floor(Date.now()/1000)-1}),await token({aud:'different-project'}),await token({iss:'https://attacker.example'}),await token({firebase:{sign_in_provider:'anonymous'}}),await token({sub:''}),await token({}, {alg:'none'}),await token({}, {kid:'untrusted',jku:'https://attacker.example/jwks'})];
  const good=await token();tokens.push(`${good.slice(0,-12)}AAAAAAAAAAAA`);
  for(const auth of tokens){const response=await s.request('/route',{auth,method:'POST',body:routeBody});assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'private, no-store');}
  assert.ok(s.calls.every(call=>call.url.hostname==='www.googleapis.com'));
});
test('auth failures precede secret lookup and provider costs',async()=>{
  const s=await setup();s.env.GEO_QUOTA={idFromName(){throw Error('must not charge');}};s.env.TOMTOM_KEY={get(){throw Error('must not read');}};
  assert.equal((await s.request('/tomtom/search?query=coffee',{auth:null})).status,401);
  s.env.FIREBASE_PROJECT_ID='';assert.equal((await s.request('/route',{method:'POST',body:routeBody})).status,503);
});
test('CORS accepts explicit web origins and native requests and exposes Retry-After',async()=>{
  const s=await setup();s.env.ALLOWED_ORIGINS='https://app.example';
  assert.equal((await s.request('/health',{headers:{Origin:'https://evil.example'}})).status,403);
  const response=await s.request('/route',{auth:null,method:'OPTIONS',headers:{Origin:'https://app.example','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(response.status,204);assert.match(response.headers.get('Access-Control-Allow-Headers'),/Authorization/);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://app.example');
  assert.equal((await s.request('/health',{auth:null})).status,200);
});
test('path, method, query and bounded body allowlists reject injection before upstream fetch',async()=>{
  const s=await setup();
  for(const url of ['/proxy?url=https://evil.example','/tomtom/search?query=coffee&key=caller-secret','/tomtom/search?query=coffee&query=again','/stadia/tiles/not_a_style/0/0/0.png','/stadia/tiles/alidade_smooth/1/2/0.png','/mapillary/graph/123?fields=access_token','/mapillary/graph/map_features?fields=id&bbox=-180,-90,180,90','/mapillary/images/123?size=2048','/mapillary/graph/%31%32%33?fields=id','/cesium/terrain/1/0/0.terrain?v=https://evil.example'])assert.ok((await s.request(url)).status>=400,url);
  assert.equal((await s.request('/route',{method:'DELETE'})).status,405);
  assert.equal((await s.request('/route',{method:'POST',body:JSON.stringify({origin:{latitude:0,longitude:0,url:'https://evil.example'},destination:{latitude:1,longitude:1}})})).status,400);
  assert.equal((await s.request('/route',{method:'POST',body:' '.repeat(16385)})).status,413);
  assert.ok(s.calls.every(call=>call.url.hostname==='www.googleapis.com'));
});
test('durable quota is weighted, concurrent, survives eviction, and separates UIDs',async()=>{
  const s=await setup();
  const quota=s.env.GEO_QUOTA;
  const results=await Promise.all(Array.from({length:3},()=>quota.get('uid:v1:a').fetch('https://quota/consume',{method:'POST',body:JSON.stringify({cost:100})}).then(response=>response.json())));
  assert.equal(results.filter(result=>result.allowed).length,2);assert.ok(results.find(result=>!result.allowed).retryAfter>0);
  quota.evict('uid:v1:a');assert.equal((await (await quota.get('uid:v1:a').fetch('https://quota/consume',{method:'POST',body:JSON.stringify({cost:100})})).json()).allowed,false);
  assert.equal((await (await quota.get('uid:v1:b').fetch('https://quota/consume',{method:'POST',body:JSON.stringify({cost:100})})).json()).allowed,true);
});
test('quota failure is 429 with Retry-After and prevents provider calls',async()=>{
  const s=await setup();s.env.GEO_QUOTA={idFromName:name=>name,get:()=>({fetch:async()=>Response.json({allowed:false,retryAfter:42})})};
  const response=await s.request('/tomtom/search?query=coffee');assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'42');assert.match((await response.json()).error,/quota exceeded/);assert.ok(s.calls.every(call=>call.url.hostname==='www.googleapis.com'));
});
test('Stadia and traffic tiles use server bindings, fixed upstream hosts, no redirect or leaked headers',async()=>{
  const s=await setup((url,init)=>{assert.equal(init.redirect,'manual');return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png','Location':'https://provider.example/?key=fixture-stadia-private','Set-Cookie':'private=1'}});});
  const response=await s.request('/stadia/tiles/alidade_smooth_dark/0/0/0@2x.png');assert.equal(response.status,200);assert.equal(response.headers.get('Location'),null);assert.equal(response.headers.get('Set-Cookie'),null);
  assert.equal(s.calls.at(-1).url.hostname,'tiles.stadiamaps.com');assert.equal(s.calls.at(-1).url.searchParams.get('api_key'),'fixture-stadia-private');
  assert.equal((await s.request('/tomtom/traffic/tiles/0/0/0.png')).status,200);assert.equal(s.calls.at(-1).url.hostname,'api.tomtom.com');
});
test('provider redirect and credential-bearing errors are never reflected',async()=>{
  for(const status of [302,401,500]){
    const s=await setup(()=>new Response('fixture-tomtom-private https://provider/?key=fixture-tomtom-private',{status,headers:{Location:'https://evil.example'}}));
    const response=await s.request('/tomtom/search?query=coffee');assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/fixture|provider\/|evil/);
  }
  const s=await setup(()=>new Response('',{status:429,headers:{'Retry-After':'123'}}));const response=await s.request('/tomtom/search?query=coffee');assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'123');
});
test('JSON responses remove provider credentials, URL fields and signed paging URLs',async()=>{
  const s=await setup(()=>Response.json({results:[{id:'place',position:{lat:10,lon:106},poi:{name:'Coffee'},debug:'fixture-tomtom-private',api_key:'fixture-tomtom-private',website:'https://provider/?key=fixture-tomtom-private'}],paging:{next:'https://provider/?key=fixture-tomtom-private'}}));
  const response=await s.request('/tomtom/search?query=coffee');assert.equal(response.status,200);const text=await response.text();assert.doesNotMatch(text,/fixture-tomtom-private|https:\/\/provider|api_key|paging/);assert.match(text,/Coffee/);
});
test('Mapillary image metadata returns only authenticated gateway thumbnail URLs',async()=>{
  const s=await setup(()=>Response.json({id:'123',geometry:{type:'Point',coordinates:[106,10]},captured_at:12345,thumb_1024_url:'https://scontent.example.fbcdn.net/image.jpg?signed=private',creator:{username:'Alice'},paging:{next:'https://graph.mapillary.com?access_token=fixture-mapillary-private'}}));
  const response=await s.request('/mapillary/graph/123?fields=id,geometry,captured_at,thumb_1024_url,creator');assert.equal(response.status,200);const data=await response.json();assert.equal(data.thumb_1024_url,'https://gateway.example/mapillary/images/123?size=1024');assert.doesNotMatch(JSON.stringify(data),/signed|fixture|fbcdn|paging/);
  assert.equal(s.calls.at(-1).init.headers.Authorization,'OAuth fixture-mapillary-private');
});
test('Mapillary relay accepts only Graph-returned signed CDN images and blocks arbitrary destinations',async()=>{
  for(const imageUrl of ['http://scontent.fbcdn.net/x','https://evil.example/x','https://fbcdn.net.evil.example/x','https://user:pass@scontent.fbcdn.net/x']){
    const s=await setup(()=>Response.json({thumb_1024_url:imageUrl}));assert.equal((await s.request('/mapillary/images/123?size=1024')).status,502);assert.equal(s.calls.filter(call=>call.url.hostname!=='www.googleapis.com').length,1);
  }
  const s=await setup(url=>url.hostname==='graph.mapillary.com'?Response.json({thumb_1024_url:'https://scontent.example.fbcdn.net/x.jpg?signed=private'}):new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/jpeg'}}));
  const response=await s.request('/mapillary/images/123?size=1024');assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.equal(s.calls.at(-1).init.headers,undefined);
});
test('OSRM route normalization preserves guidance, lanes and alternatives',async()=>{
  const s=await setup(url=>{assert.equal(url.searchParams.get('steps'),'true');return Response.json({code:'Ok',routes:[{distance:100,duration:30,geometry:{coordinates:[[106,10],[106.1,10.1]]},legs:[{steps:[{distance:100,name:'Road',maneuver:{type:'turn',modifier:'left',location:[106,10]},intersections:[{lanes:[{indications:['left'],valid:true}]}]}]}]},{distance:110,duration:40,geometry:{coordinates:[[106,10],[106.2,10.2]]},legs:[]}]});});
  const response=await s.request('/route',{method:'POST',body:routeBody});assert.equal(response.status,200);const data=await response.json();assert.equal(data.steps[0].type,'turn');assert.deepEqual(data.steps[0].position,[10,106]);assert.equal(data.steps[0].lanes[0].valid,true);assert.equal(data.alternatives.length,1);
});
test('routing avoidance does not silently fall back to OSRM',async()=>{
  const s=await setup();const response=await s.request('/route',{method:'POST',body:JSON.stringify({...JSON.parse(routeBody),preferences:{avoidHighways:true}})});assert.equal(response.status,502);assert.ok(s.calls.every(call=>call.url.hostname==='www.googleapis.com'));
});
test('matrix, range and static inputs are bounded and forwarded using fixed provider options',async()=>{
  const s=await setup(url=>url.hostname==='tiles.stadiamaps.com'?new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/png'}}):Response.json({data:[],reachableRange:{center:{latitude:10,longitude:106},boundary:[]}}));
  assert.equal((await s.request('/tomtom/reachable-range',{method:'POST',body:JSON.stringify({origin:{latitude:10,longitude:106},minutes:15,mode:'motorbike'})})).status,200);assert.equal(s.calls.at(-1).url.searchParams.get('travelMode'),'motorcycle');
  const point={point:{latitude:10,longitude:106}};assert.equal((await s.request('/tomtom/matrix',{method:'POST',body:JSON.stringify({origins:[point],destinations:[point]})})).status,200);assert.equal(JSON.parse(s.calls.at(-1).init.body).options.traffic,'live');
  assert.equal((await s.request('/tomtom/matrix',{method:'POST',body:JSON.stringify({origins:Array(6).fill(point),destinations:[point]})})).status,400);
  assert.equal((await s.request('/stadia/static?center=10,106&zoom=14&size=600x400@2x')).status,200);assert.equal((await s.request('/stadia/static?center=10,106&zoom=14&size=99999x400')).status,400);
});
test('Cesium layer rewrites fixed-asset tiles without returning endpoint credentials',async()=>{
  const s=await setup(url=>url.hostname==='api.cesium.com'?Response.json({url:'https://assets.cesium.com/1/',accessToken:'fixture-ephemeral-private'}):Response.json({tilejson:'2.1.0',format:'quantized-mesh-1.0',version:'1',tiles:['https://assets.cesium.com/1/{z}/{x}/{y}.terrain?access_token=fixture-ephemeral-private'],parentUrl:'https://provider',debug:'fixture-ephemeral-private'}));
  const response=await s.request('/cesium/terrain/layer.json');assert.equal(response.status,200);const text=await response.text();assert.doesNotMatch(text,/fixture|accessToken|assets.cesium|parentUrl/);assert.match(text,/gateway.example\/cesium\/terrain/);
  assert.equal(s.calls.at(-1).init.headers.Authorization,'Bearer fixture-ephemeral-private');
});

test('Cesium geographic level zero includes the second column and forwards only allowed metadata extensions',async()=>{
  const s=await setup(url=>url.hostname==='api.cesium.com'?Response.json({url:'https://assets.cesium.com/1/',accessToken:'fixture-ephemeral-private'}):new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'application/vnd.quantized-mesh'}}));
  const response=await s.request('/cesium/terrain/0/1/0.terrain?v=1',{headers:{Accept:'application/vnd.quantized-mesh;extensions=metadata-octvertexnormals'}});
  assert.equal(response.status,200);assert.equal(s.calls.at(-1).url.pathname,'/1/0/1/0.terrain');assert.equal(s.calls.at(-1).url.searchParams.get('extensions'),'metadata-octvertexnormals');
  assert.equal((await s.request('/cesium/terrain/0/2/0.terrain')).status,400);
  assert.equal((await s.request('/cesium/terrain/0/0/0.terrain',{headers:{Accept:'application/vnd.quantized-mesh;extensions=secret'}})).status,400);
});
