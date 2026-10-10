const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {withStoreCredentials}=require('../scripts/eas-store-credentials.cjs');
test('EAS selects credentials by store, preserves existing inputs and cleans temporary staging on failure',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mymap-eas-fixture-'));
 try{
  for(const store of ['play','amazon']){const dir=path.join(root,'.signing',store);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'fixture.keystore'),'not-a-real-keystore');fs.writeFileSync(path.join(dir,'eas-credentials.json'),JSON.stringify({android:{keystore:{keystorePath:`.signing/${store}/fixture.keystore`,keystorePassword:'fixture-only',keyAlias:store,keyPassword:'fixture-only'}}}));}
  for(const store of ['play','amazon'])withStoreCredentials(store,()=>assert.equal(JSON.parse(fs.readFileSync(path.join(root,'credentials.json'))).android.keystore.keyAlias,store),root);
  assert.throws(()=>withStoreCredentials('play',()=>{throw Error('fixture failure');},root),/fixture failure/);assert.equal(fs.existsSync(path.join(root,'credentials.json')),false);
  fs.writeFileSync(path.join(root,'credentials.json'),'existing-private-input');assert.throws(()=>withStoreCredentials('amazon',()=>{},root),/Preserve/);assert.equal(fs.readFileSync(path.join(root,'credentials.json'),'utf8'),'existing-private-input');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
