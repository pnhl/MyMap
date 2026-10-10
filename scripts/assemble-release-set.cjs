const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {releaseInputs}=require('./release-inputs.cjs');
const KINDS=['ios','ios-unsigned','aab','play','amazon'];
function assemble(artifacts,inputs){
 if(KINDS.some(k=>!artifacts[k]))throw Error('Release set requires signed IPA, unsigned IPA, Play AAB, Google APK and Amazon APK.');
 inputs=inputs||JSON.parse(fs.readFileSync(artifacts.ios+'.provenance.json'));
 const expected=releaseInputs();if(inputs.commit!==expected.commit||inputs.lockfileSha256!==expected.lockfileSha256)throw Error('Release set source/lock mismatch.');
 const records=KINDS.map(kind=>{
  const file=artifacts[kind],provenance=JSON.parse(fs.readFileSync(file+'.provenance.json'));
  for(const key of ['commit','lockfileSha256','inputsFingerprint','publicConfigFingerprint'])if(provenance[key]!==inputs[key])throw Error('Artifact input mismatch: '+kind+' / '+key);
  if(provenance.appVersion!==inputs.version||String(provenance.appBuildVersion)!==String(inputs.build))throw Error('Artifact version mismatch: '+kind);
  return {kind,file:path.basename(file),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),provenance};
 });return {...inputs,artifacts:records};
}
if(require.main===module){try{const map=JSON.parse(fs.readFileSync(process.argv[2]));const set=assemble(map);const output=process.argv[3]||'dist/releases/release-set.json';fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(set,null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={assemble,KINDS};
