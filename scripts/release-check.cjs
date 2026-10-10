const fs=require('node:fs'),{execFileSync}=require('node:child_process');
function checkRelease({requireGit=true}={}){
 const release=JSON.parse(fs.readFileSync('release.json'));
 if(!/^\d+\.\d+\.\d+$/.test(release.version)||!Number.isSafeInteger(release.build)||release.build<38)throw Error('Invalid release version/build.');
 const pkg=JSON.parse(fs.readFileSync('package.json')),config=JSON.parse(fs.readFileSync('app.json')).expo;
 if(pkg.version!==release.version||config.version!==release.version||config.ios.buildNumber!==String(release.build)||config.android.versionCode!==release.build)throw Error('Update package/app mirror versions from release.json before committing.');
 let commit=null;
 if(requireGit){
  try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{
   if(process.env.EAS_BUILD==='true'&&/^[a-f0-9]{40}$/.test(process.env.EAS_BUILD_GIT_COMMIT_HASH||''))return {...release,commit:process.env.EAS_BUILD_GIT_COMMIT_HASH};
   throw Error('Build releases from a committed Git repository.');
  }
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit source changes before release builds.');
  const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  if(tracked.some(f=>/(^|\/)(google-services\.json|GoogleService-Info\.plist|\.env(?:\..*)?|credentials\.json|api_key\.txt)$|\.(jks|keystore|p12|p8|mobileprovision)$/i.test(f)&&!f.endsWith('.env.example')))throw Error('Private signing/configuration file is tracked. Remove it before release.');
 }
 return {...release,commit};
}
if(require.main===module){try{console.log(JSON.stringify(checkRelease({requireGit:!process.argv.includes('--source-only')})));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={checkRelease};
