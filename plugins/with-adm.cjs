const {withAndroidManifest,withDangerousMod,withAppBuildGradle}=require('expo/config-plugins');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=config=>{
 if((process.env.APP_STORE_TARGET||process.env.MYMAP_STORE)!=='amazon'||process.env.MYMAP_ENABLE_ADM!=='true')return config;
 const jar=process.env.MYMAP_ADM_SDK_JAR,checksum=process.env.MYMAP_ADM_SDK_SHA256;
 if(!jar||!checksum||!fs.existsSync(jar)||crypto.createHash('sha256').update(fs.readFileSync(jar)).digest('hex')!==checksum)throw Error('ADM requires the reviewed official SDK JAR and matching SHA-256.');
 config=withAndroidManifest(config,c=>{const m=c.modResults.manifest,app=m.application[0],pkg=config.android.package;
  m.permission=[...(m.permission||[]),{$:{'android:name':pkg+'.permission.RECEIVE_ADM_MESSAGE','android:protectionLevel':'signature'}}];
  m['uses-permission']=[...(m['uses-permission']||[]),...['com.amazon.device.messaging.permission.RECEIVE',pkg+'.permission.RECEIVE_ADM_MESSAGE'].map(name=>({$:{'android:name':name}}))];
  app['uses-library']=[...(app['uses-library']||[]),{$:{'android:name':'com.amazon.device.messaging','android:required':'false'}}];
  app.service=[...(app.service||[]),{$:{'android:name':'.MyMapAdmJob','android:permission':'android.permission.BIND_JOB_SERVICE','android:exported':'false'}},{$:{'android:name':'.MyMapAdmLegacy','android:exported':'false'}}];
  app.receiver=[...(app.receiver||[]),{$:{'android:name':'.MyMapAdmReceiver','android:permission':'com.amazon.device.messaging.permission.SEND','android:exported':'true'},'intent-filter':[{action:['REGISTRATION','RECEIVE'].map(x=>({$:{'android:name':'com.amazon.device.messaging.intent.'+x}})),category:[{$:{'android:name':pkg}}]}]}];return c;
 });
 config=withDangerousMod(config,['android',async c=>{const root=c.modRequest.platformProjectRoot,dir=path.join(root,'app/src/amazon/java/com/pnhl/vibecoding');fs.mkdirSync(dir,{recursive:true});for(const name of fs.readdirSync(path.join(__dirname,'native/adm')))fs.copyFileSync(path.join(__dirname,'native/adm',name),path.join(dir,name));fs.mkdirSync(path.join(root,'app/libs'),{recursive:true});fs.copyFileSync(jar,path.join(root,'app/libs/amazon-device-messaging.jar'));
  if(process.env.MYMAP_ADM_API_KEY_FILE){fs.mkdirSync(path.join(root,'app/src/amazon/assets'),{recursive:true});fs.copyFileSync(process.env.MYMAP_ADM_API_KEY_FILE,path.join(root,'app/src/amazon/assets/api_key.txt'));}
  const rules=path.join(root,'app/proguard-rules.pro'),keep='-keep public class com.pnhl.vibecoding.MyMapAdm** { *; }';if(!fs.readFileSync(rules,'utf8').includes(keep))fs.appendFileSync(rules,'\n'+keep+'\n');return c;}]);
 return withAppBuildGradle(config,c=>{const dependency='dependencies { amazonCompileOnly files("libs/amazon-device-messaging.jar") }';if(!c.modResults.contents.includes(dependency))c.modResults.contents+='\n'+dependency+'\n';return c;});
};
