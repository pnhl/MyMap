const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
async function download(input,output,expectedCommit){
 const raw=JSON.parse(fs.readFileSync(input)),records=Array.isArray(raw)?raw:[raw];
 const build=records.find(r=>r.status==='FINISHED'&&r.artifacts?.buildUrl);
 if(!build)throw Error('EAS did not return a finished artifact.');
 const expected=expectedCommit||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(build.gitCommitHash!==expected)throw Error('EAS artifact was built from a different or unreported commit.');
 const url=new URL(build.artifacts.buildUrl);if(url.protocol!=='https:')throw Error('Artifact download must use HTTPS.');
 fs.mkdirSync(path.dirname(output),{recursive:true});const response=await fetch(url,{signal:AbortSignal.timeout(600000)});
 if(!response.ok||!response.body)throw Error('EAS artifact download failed.');
 await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(output));
 const inputs=JSON.parse(execFileSync(process.platform==='win32'?'python':'python3',['scripts/read-artifact-inputs.py',output],{encoding:'utf8'}));
 const local=require('./release-inputs.cjs').releaseInputs();
 if(inputs.commit!==expected||inputs.lockfileSha256!==local.lockfileSha256)throw Error('Download input commit/lock mismatch.');
 fs.writeFileSync(output+'.provenance.json',JSON.stringify({...inputs,buildId:build.id,appVersion:build.appVersion,appBuildVersion:build.appBuildVersion},null,2));
 console.log('Downloaded '+path.basename(output)+' from verified source commit.');
}
if(require.main===module)download(process.argv[2],process.argv[3]).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={download};
