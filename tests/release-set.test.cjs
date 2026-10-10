const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {releaseInputs}=require('../scripts/release-inputs.cjs'),{assemble,KINDS}=require('../scripts/assemble-release-set.cjs');
test('input fingerprints change with public configuration without returning its values',()=>{
 const base=releaseInputs({}),changed=releaseInputs({EXPO_PUBLIC_SUPABASE_URL:'https://fixture.example.test'});
 assert.notEqual(base.publicConfigFingerprint,changed.publicConfigFingerprint);assert.ok(!JSON.stringify(changed).includes('fixture.example.test'));
 assert.equal(releaseInputs({APP_STORE_TARGET:'amazon'}).inputsFingerprint,releaseInputs({APP_STORE_TARGET:'play'}).inputsFingerprint,'Native store selector must not alter shared JS inputs');
});
test('release set requires five matching artifact inputs and hashes every artifact',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mymap-release-set-'));try{
 const inputs=releaseInputs(),files={};for(const kind of KINDS){files[kind]=path.join(dir,kind);fs.writeFileSync(files[kind],kind);fs.writeFileSync(files[kind]+'.provenance.json',JSON.stringify({...inputs,appVersion:inputs.version,appBuildVersion:String(inputs.build)}));}
 assert.equal(assemble(files,inputs).artifacts.length,5);assert.throws(()=>assemble({...files,'ios-unsigned':null},inputs),/unsigned IPA/);
 const sidecar=files.amazon+'.provenance.json';const p=JSON.parse(fs.readFileSync(sidecar));p.publicConfigFingerprint='0'.repeat(64);fs.writeFileSync(sidecar,JSON.stringify(p));assert.throws(()=>assemble(files,inputs),/input mismatch/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
