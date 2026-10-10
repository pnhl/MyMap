const fs=require('node:fs'),{releaseInputs}=require('./release-inputs.cjs'),{execFileSync}=require('node:child_process');
const expected=releaseInputs();
for(const file of process.argv.slice(2)){
 if(!fs.existsSync(file))throw Error('Missing artifact for provenance.');
 const inputs=JSON.parse(execFileSync(process.platform==='win32'?'python':'python3',['scripts/read-artifact-inputs.py',file],{encoding:'utf8'}));
 if(inputs.commit!==expected.commit||inputs.lockfileSha256!==expected.lockfileSha256)throw Error('Artifact provenance source/lock mismatch.');
 fs.writeFileSync(file+'.provenance.json',JSON.stringify({...inputs,appVersion:inputs.version,appBuildVersion:String(inputs.build)},null,2));
}
