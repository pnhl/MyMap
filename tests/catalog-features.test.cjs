const{loadPinnedService}=require('./account-api-fixture.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const{loadService,memoryDatabase}=require('./service-loader.cjs');
const rules=loadService('src/utils/catalogRules.ts');
const media=loadService('src/utils/mediaInsights.ts');
const search=loadService('src/utils/globalSearch.ts',{'./mediaInsights':media});
const geo=loadService('src/utils/geo.ts');
const stats=loadService('src/utils/observedJourneyStats.ts',{'./geo':geo});
const{measuredConsumption}=loadService('src/utils/vehicleConsumption.ts');
const trip=name=>({name,mode:'motorbike',startsAt:Date.now(),stops:[{id:'a',name:'A',latitude:21,longitude:105,stayMinutes:0},{id:'b',name:'B',latitude:21.1,longitude:105.1,stayMinutes:15}],votes:{},favorite:false});
const vehicle={name:'Xe điện',fuel:'electric',odometerKm:50,consumptionPer100Km:15,unitPrice:3000,batteryKwh:60,reservePercent:15};
test('EV range excludes the reserve and never promises range with missing consumption',()=>{
 assert.equal(rules.remainingBatteryRange(vehicle,65),200);
 assert.equal(rules.remainingBatteryRange(vehicle,10),0);
 assert.equal(rules.remainingBatteryRange(vehicle,101),null);
 assert.equal(rules.remainingBatteryRange({...vehicle,consumptionPer100Km:0},80),null);
 assert.throws(()=>rules.validateVehicle({...vehicle,reservePercent:101}));
 assert.equal(rules.tripCost(vehicle,100000).amount,45000);
});
test('local date parser rejects calendar rollover and preserves entered time',()=>{
 assert.throws(()=>rules.parseLocalDateTime('2026-02-30 10:00'));
 assert.throws(()=>rules.parseLocalDateTime('2026-12-01 25:00'));
 const value='2026-10-08 12:45';assert.equal(rules.localDateTime(rules.parseLocalDateTime(value)),value);
});
test('events, reviews and expense splits validate real user input',()=>{
 const place={name:'Hồ Tây',latitude:21.06,longitude:105.82};
 rules.validateEvent({name:'Cuộc hẹn',note:'Cà phê',startsAt:1000,endsAt:2000,place});
 assert.throws(()=>rules.validateEvent({name:'Cuộc hẹn',note:'Cà phê',startsAt:2000,endsAt:1000,place}));
 assert.throws(()=>rules.validateReview({name:'Quán',note:'Đã ghé',rating:6,visitedAt:1000,place}));
 assert.throws(()=>rules.validateExpense({category:'fuel',amount:100,splitPeople:1.5,note:'',at:1000}));
 assert.throws(()=>rules.validateJournal({name:'Ngày vui',note:'',at:1000,place:null}));
});
test('measured consumption sums partial fills between full tanks, excluding the initial fill',()=>{
 const fill=(at,odometerKm,quantity,fullFill=true)=>({vehicleId:'car',category:'fuel',at,odometerKm,quantity,fullFill,amount:100});
 const r=measuredConsumption('car','fuel',[fill(1,100,40),fill(2,200,5,false),fill(3,300,10)]);
 assert.equal(r.per100Km,7.5);assert.equal(r.distanceKm,200);assert.equal(r.measuredUnits,15);assert.equal(r.intervals,1);
});
test('unknown fill amounts and odometer rollbacks do not produce invented consumption',()=>{
 const fill=(at,odometerKm,quantity,fullFill=true)=>({vehicleId:'car',category:'fuel',at,odometerKm,quantity,fullFill,amount:100});
 assert.equal(measuredConsumption('car','fuel',[fill(1,100,40),fill(2,200,undefined,false),fill(3,300,10)]).per100Km,null);
 assert.equal(measuredConsumption('car','fuel',[fill(1,300,40),fill(2,100,10)]).per100Km,null);
 assert.equal(measuredConsumption('other','fuel',[fill(1,100,40),fill(2,300,10)]).per100Km,null);
});
test('search folds Vietnamese accents, tolerates one edit and requires every query token',()=>{
 const entries=[{id:'1',title:'Hồ Tây',description:'Cà phê',terms:'biển hiệu 2026'},{id:'2',title:'Xe điện',description:'Sạc pin',terms:''}];
 assert.equal(search.searchEntries(entries,'ho tay')[0].id,'1');
 assert.equal(search.searchEntries(entries,'bien hieu')[0].id,'1');
 assert.equal(search.searchEntries(entries,'dienn')[0].id,'2');
 assert.equal(search.searchEntries(entries,'ho pin').length,0);
 assert.equal(search.searchEntries(entries,'  ').length,0);
});
test('similar photos compare only compatible providers and ignore malformed hashes',()=>{
 assert.equal(media.hashDistance('0000000000000000','ffffffffffffffff'),64);
 assert.equal(media.hashDistance('broken','0000000000000000'),Infinity);
 const sample=(photoId,provider,dhash)=>({photoId,provider,dhash,labels:[],text:''});
 const pairs=media.similarPhotos([sample(1,'MLKit','0000000000000000'),sample(2,'MLKit','0000000000000001'),sample(3,'Apple Vision','0000000000000001')]);
 assert.equal(pairs.length,1);assert.equal(pairs[0][2],1);
});
test('journey statistics never join an offline gap or impossible GPS jump',()=>{
 const p=(timestamp,latitude,accuracy=10)=>({timestamp,latitude,longitude:105,accuracy});
 assert.equal(stats.observedJourneyStats([p(0,21),p(3600000,21.001)]).distanceMeters,0);
 assert.equal(stats.observedJourneyStats([p(0,21),p(1000,22)]).distanceMeters,0);
 assert.equal(stats.observedJourneyStats([p(0,21),p(60000,21.001)]).observedMinutes,1);
 assert.equal(stats.observedJourneyStats([p(0,21),p(60000,21.001,1000)]).observedMinutes,0);
});
function catalogFixture(){
 const db=memoryDatabase(),user={id:'alice',is_anonymous:false},remote=[],calls=[];let onSave=async()=>({data:1,error:null}),onDelete=async()=>({error:null}),deleted=[];
 const query={select:()=>query,or:()=>query,order:()=>query,range:async()=>({data:remote,error:null})};
 const service=loadPinnedService('src/services/catalogStore.ts',{'../utils/catalogRules':rules,'expo-crypto':{randomUUID:()=>crypto.randomUUID()},'../db/database':{getDb:async()=>db},'./auth':{getCurrentUser:async()=>({...user})},'./supabase':{supabase:{from:()=>query,rpc:async(name,args)=>{calls.push(name);if(name==='mm_doc_deletions')return{data:deleted};if(name==='mm_identity')return{data:'canonical'};if(name==='mm_doc_save')return onSave(args);if(name==='mm_doc_delete')return onDelete(args);return{error:null};}}}});
 return{db,user,remote,calls,service,setSave:fn=>{onSave=fn;},setDelete:fn=>{onDelete=fn;},setDeleted:ids=>{deleted=ids;}};
}
test('catalog preserves edits made while an earlier version uploads',async()=>{
 const f=catalogFixture();try{
 const initial=await f.service.saveDocument('trip',trip('Trước'),undefined,{share:true});
 f.setSave(async()=>{await f.service.saveDocument('trip',trip('Sau'),initial);return{data:1};});
 await f.service.syncCatalog();const [current]=await f.service.listDocuments();
 assert.equal(current.data.name,'Sau');assert.equal(current.sync,'queued');assert.equal(current.version,1);
 }finally{f.db.close();}
});
test('catalog surfaces a version conflict without replacing the local edit',async()=>{
 const f=catalogFixture();try{await f.service.saveDocument('trip',trip('Trên máy'),undefined,{share:true});f.setSave(async()=>({error:{message:'version_conflict'}}));await f.service.syncCatalog();const[d]=await f.service.listDocuments();assert.equal(d.sync,'conflict');assert.equal(d.data.name,'Trên máy');}finally{f.db.close();}
});
test('server tombstones remove queued documents before they can upload again',async()=>{
 const f=catalogFixture();try{const d=await f.service.saveDocument('trip',trip('Đã xóa'),undefined,{share:true});f.setDeleted([d.id]);await f.service.syncCatalog();assert.equal((await f.service.listDocuments()).length,0);assert.ok(!f.calls.includes('mm_doc_save'));}finally{f.db.close();}
});
test('switching accounts during an upload does not write the result into the next account',async()=>{
 const f=catalogFixture();try{const d=await f.service.saveDocument('trip',trip('Alice'),undefined,{share:true});f.setSave(async()=>{f.user.id='bob';return{data:1};});await f.service.syncCatalog();assert.equal((await f.service.listDocuments()).length,0);f.user.id='alice';assert.equal((await f.service.listDocuments())[0].sync,'queued');await assert.rejects(f.service.saveDocument('trip',{}, {...d,account:'bob'}));}finally{f.db.close();}
});
test('emergency cards cannot be shared and Unicode payloads obey a byte budget',async()=>{
 const f=catalogFixture();try{await assert.rejects(f.service.saveDocument('emergency_card',{ciphertext:'sealed'},undefined,{share:true}));await assert.rejects(f.service.saveDocument('journal',{note:'ầ'.repeat(40000)}),/quá lớn/);}finally{f.db.close();}
});
test('offline document deletion stays hidden and retries deletion without another upload',async()=>{
 const f=catalogFixture();try{const d=await f.service.saveDocument('trip',trip('Xóa ngoại tuyến'),undefined,{share:true});f.setDelete(async()=>({error:{message:'offline'}}));await f.service.removeDocument(d);assert.equal((await f.service.listDocuments()).length,0);await f.service.syncCatalog();assert.equal((await f.service.pendingCatalogDeletes()).length,1);assert.ok(!f.calls.includes('mm_doc_save'));await assert.rejects(f.service.saveDocument('trip',trip('Không khôi phục'),d),/chờ xóa/);f.setDelete(async()=>({}));await f.service.syncCatalog();assert.equal((await f.service.pendingCatalogDeletes()).length,0);assert.equal((await f.service.listDocuments()).length,0);}finally{f.db.close();}
});
test('deleting a document during upload is applied after the upload acknowledgment',async()=>{
 const f=catalogFixture();try{const d=await f.service.saveDocument('trip',trip('Đang gửi'),undefined,{share:true});f.setSave(async()=>{await f.service.removeDocument(d);return{data:1};});await f.service.syncCatalog();assert.equal((await f.service.listDocuments()).length,0);assert.equal((await f.service.pendingCatalogDeletes()).length,0);assert.ok(f.calls.indexOf('mm_doc_delete')>f.calls.indexOf('mm_doc_save'));}finally{f.db.close();}
});
test('pending deletions and collaborator permissions belong to one account',async()=>{
 const f=catalogFixture();try{const d=await f.service.saveDocument('trip',trip('Alice'),undefined,{share:true});await assert.rejects(f.service.removeDocument({...d,owned:false}),/chủ sở hữu/);await f.service.removeDocument(d);f.user.id='bob';assert.equal((await f.service.pendingCatalogDeletes()).length,0);f.user.id='alice';assert.equal((await f.service.pendingCatalogDeletes()).length,1);}finally{f.db.close();}
});
test('malformed shared route payloads never become renderable local documents',async()=>{
 const f=catalogFixture();try{f.remote.push({id:'broken',kind:'trip',payload:{name:'Hỏng'},members:[],owner_id:'canonical',updated_at:new Date().toISOString(),version:1});await assert.rejects(f.service.syncCatalog(),/ngày đi|điểm dừng/);assert.equal((await f.service.listDocuments()).length,0);assert.throws(()=>rules.validateTrip({...trip('Trùng'),stops:[trip('A').stops[0],trip('A').stops[0]]}),/Điểm dừng/);}finally{f.db.close();}
});
test('device proofs detect coordinate edits, removed records, manifest edits and forged signatures',()=>{
 const {verify}=require('../scripts/verify-location-proof.cjs');const{privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});let previous='0'.repeat(64);const chain=[{latitude:21,longitude:105,timestamp:1000},{latitude:21.1,longitude:105.1,timestamp:2000}].map(point=>{const hash=crypto.createHash('sha256').update(previous+'\n'+JSON.stringify(point)).digest('hex');const item={point,previous,hash};previous=hash;return item;});const manifest={format:'mymap-proof-v1',algorithm:'SHA-256',count:chain.length,root:previous},manifestText=JSON.stringify(manifest);const bundle={manifest,manifestText,chain,algorithm:'ECDSA-P256-SHA256-SPKI-DER',publicKey:publicKey.export({type:'spki',format:'der'}).toString('base64'),signature:crypto.sign('sha256',Buffer.from(manifestText),privateKey).toString('base64')};assert.equal(verify(bundle),true);
 for(const change of[b=>{b.chain[0].point.latitude=22;},b=>b.chain.pop(),b=>{b.manifest.count=1;},b=>{b.signature=Buffer.alloc(72).toString('base64');}]){const altered=JSON.parse(JSON.stringify(bundle));change(altered);assert.equal(verify(altered),false);}
});
