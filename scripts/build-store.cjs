const {spawnSync}=require('node:child_process');
const {checkRelease}=require('./release-check.cjs');
const fs=require('node:fs'),path=require('node:path');
function run(command,args,env=process.env){const r=spawnSync(command,args,{stdio:'inherit',env,shell:process.platform==='win32'&&['npx','npm'].includes(command)});if(r.status!==0)throw Error(`${command} failed (${r.status}).`);}
async function main(){
 const target=process.argv[2];if(!['ios','play','amazon','all'].includes(target))throw Error('Choose ios, play, amazon or all.');
 const release=checkRelease();console.log(`Building ${release.version} (${release.build}) from ${release.commit}`);
 if(target==='ios'||target==='all')require('./native-locks.cjs').sync('check','ios');
 if(target==='play'||target==='all')require('./native-locks.cjs').sync('check','android','play');
 if(target==='amazon'||target==='all')require('./native-locks.cjs').sync('check','android','amazon');
 run('npm', ['run','typecheck']);run('npm',['test']);
 const profiles=target==='all'?['ios-store','ios-unsigned','android-play','android-apk','android-amazon']:target==='ios'?['ios-store','ios-unsigned']:target==='play'?['android-play','android-apk']:['android-amazon'];
 const artifacts={};fs.mkdirSync('.local/eas-results',{recursive:true});
 for(const profile of profiles){
  const platform=profile.startsWith('ios-')?'ios':'android';
  const result=spawnSync('npx',['--no-install','eas','build','--profile',profile,'--platform',platform,'--non-interactive','--wait','--json'],{stdio:['inherit','pipe','inherit'],encoding:'utf8',maxBuffer:16*1024*1024,shell:process.platform==='win32',env:{...process.env,MYMAP_RELEASE_COMMIT:release.commit}});
  if(result.status!==0)throw Error('EAS build failed for '+profile);
  const metadata=path.join('.local/eas-results',profile+'.json');fs.writeFileSync(metadata,result.stdout);
  const kind=profile==='ios-store'?'ios':profile==='ios-unsigned'?'ios-unsigned':profile==='android-play'?'aab':profile==='android-apk'?'play':'amazon';
  const file=path.join('dist/releases','build-'+release.build,kind+(kind.startsWith('ios')?'.ipa':kind==='aab'?'.aab':'.apk'));
  await require('./download-eas-artifact.cjs').download(metadata,file,release.commit);artifacts[kind]=file;
 }
 if(artifacts.aab)run(process.platform==='win32'?'python':'python3',['scripts/fetch-bundletool.py']);
 const verification=['scripts/verify-artifacts.py','--commit',release.commit];for(const [kind,file]of Object.entries(artifacts))verification.push('--'+kind,file);
 if(target==='all')verification.push('--complete');
 run(process.platform==='win32'?'python':'python3',verification,{...process.env,BUNDLETOOL_JAR:process.env.BUNDLETOOL_JAR||path.resolve('.local/bundletool.jar')});
 if(target==='all')fs.writeFileSync(path.join('dist/releases','build-'+release.build,'release-set.json'),JSON.stringify(require('./assemble-release-set.cjs').assemble(artifacts),null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
