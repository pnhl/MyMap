const {spawnSync}=require('node:child_process');
const {checkRelease}=require('./release-check.cjs');
function run(command,args,env=process.env){const r=spawnSync(command,args,{stdio:'inherit',env,shell:process.platform==='win32'&&command==='npx'});if(r.status!==0)throw Error(`${command} failed (${r.status}).`);}
function main(){
 const target=process.argv[2];if(!['ios','play','amazon','all'].includes(target))throw Error('Choose ios, play, amazon or all.');
 const release=checkRelease();console.log(`Building ${release.version} (${release.build}) from ${release.commit}`);
 run('npm', ['run','typecheck']);run('npm',['test']);
 const profiles=target==='all'?['ios-store','android-play','android-apk','android-amazon']:target==='ios'?['ios-store']:target==='play'?['android-play','android-apk']:['android-amazon'];
 for(const profile of profiles){const platform=profile==='ios-store'?'ios':'android';run('npx',['--yes','eas-cli','build','--profile',profile,'--platform',platform,'--non-interactive','--wait'],{...process.env,MYMAP_RELEASE_COMMIT:release.commit});}
 console.log('Download artifacts and run scripts/verify-artifacts.py before distributing. Unsigned iOS uses the macOS CI job.');
}
try{main();}catch(e){console.error(e.message);process.exitCode=1;}
