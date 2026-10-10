// Copies source only. Never copies ignored env/Firebase/signing files or reuses credentials.
const fs=require('node:fs'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
const root=process.cwd(),directory=path.join(root,'.local','parity-'+Date.now());
const store=process.argv[2]||'amazon';if(!['play','amazon'].includes(store))throw Error('Choose play or amazon fixture.');
const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of names){if(!fs.existsSync(name)||!fs.statSync(name).isFile())continue;
 if(/(^|\/)(?:\.env(?:\..*)?|google-services\.json|GoogleService-Info\.plist|credentials\.json|api_key\.txt)$|\.(?:keystore|jks|p12|p8|mobileprovision)$/i.test(name)&&!name.endsWith('.env.example'))throw Error('Refusing private tracked file: '+name);
 const dest=path.join(directory,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(name,dest);
}
fs.symlinkSync(path.join(root,'node_modules'),path.join(directory,'node_modules'),process.platform==='win32'?'junction':'dir');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(?:PATH|SystemRoot|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE|NUMBER_OF_PROCESSORS|JAVA_HOME|ANDROID_HOME|ANDROID_SDK_ROOT)$/i.test(k)));
Object.assign(env,{APP_STORE_TARGET:store,MYMAP_STORE:store,MYMAP_RELEASE:'false',EXPO_NO_DOTENV:'1',CI:'1',EAS_BUILD:'false',MYMAP_RELEASE_COMMIT:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),RNLLAMA_SKIP_POSTINSTALL:'1'});
for(const args of [['scripts/prepare-native-test-config.cjs'],['node_modules/expo/bin/cli','prebuild','--platform','android','--no-install']]){
 const result=spawnSync(process.execPath,args,{cwd:directory,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
// Exercise the reviewed locks/checksums in CI as well as production builds.
for(const [saved,target]of [[`config/native-locks/${store}/app.lockfile`,'android/app/gradle.lockfile'],[`config/native-locks/${store}/verification-metadata.xml`,'android/gradle/verification-metadata.xml']]){
 if(!fs.existsSync(path.join(root,saved)))throw Error('Missing fixture dependency lock: '+saved);
 const dest=path.join(directory,target);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,saved),dest);
}
fs.writeFileSync(path.join(root,'.local/parity-workspace.json'),JSON.stringify({directory},null,2));
console.log('Credential-free native fixture: '+directory);
