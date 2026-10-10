const {withAndroidManifest,withDangerousMod,withXcodeProject,withInfoPlist}=require('expo/config-plugins');
const fs=require('node:fs'),path=require('node:path');
module.exports=config=>{
 const store=process.env.APP_STORE_TARGET||process.env.MYMAP_STORE;
 const inputs=require('../scripts/release-inputs.cjs').releaseInputs();
 config=withInfoPlist(config,c=>{c.modResults.UIBackgroundModes=['location','audio','processing','remote-notification'];c.modResults.MyMapReleaseInputs=inputs;return c;});
 config=withAndroidManifest(config,c=>{
  const app=c.modResults.manifest.application[0];
  app.$['android:allowBackup']='false';app.$['android:fullBackupContent']='@xml/mymap_backup_rules';app.$['android:dataExtractionRules']='@xml/mymap_data_extraction_rules';
  c.modResults.manifest.$['xmlns:tools']='http://schemas.android.com/tools';
  const removed=['android.permission.SYSTEM_ALERT_WINDOW','android.permission.READ_EXTERNAL_STORAGE','android.permission.WRITE_EXTERNAL_STORAGE','android.permission.ACTIVITY_RECOGNITION','com.android.launcher.permission.READ_SETTINGS','com.android.launcher.permission.WRITE_SETTINGS','com.android.launcher.permission.INSTALL_SHORTCUT','com.android.launcher.permission.UNINSTALL_SHORTCUT',...require('../config/android-permissions.json').removedBadges];
  c.modResults.manifest['uses-permission']=(c.modResults.manifest['uses-permission']||[]).filter(p=>!removed.includes(p.$['android:name']));
  for(const name of removed)c.modResults.manifest['uses-permission'].push({$:{'android:name':name,'tools:node':'remove'}});
  if(store==='amazon'){
   app.provider=(app.provider||[]).filter(p=>!String(p.$['android:name']).includes('MobileAdsInitProvider'));
   app.provider.push({$:{'android:name':'com.google.android.gms.ads.MobileAdsInitProvider','tools:node':'remove'}});
   for(const name of ['com.google.android.gms.permission.AD_ID','android.permission.ACCESS_ADSERVICES_AD_ID','android.permission.ACCESS_ADSERVICES_ATTRIBUTION','android.permission.ACCESS_ADSERVICES_TOPICS','com.google.android.c2dm.permission.RECEIVE'])c.modResults.manifest['uses-permission'].push({$:{'android:name':name,'tools:node':'remove'}});
   for(const name of ['com.google.firebase.messaging.FirebaseMessagingService','expo.modules.notifications.service.ExpoFirebaseMessagingService']){app.service=(app.service||[]).filter(s=>s.$['android:name']!==name);app.service.push({$:{'android:name':name,'tools:node':'remove'}});}
   app.receiver=(app.receiver||[]).filter(s=>s.$['android:name']!=='com.google.firebase.iid.FirebaseInstanceIdReceiver');app.receiver.push({$:{'android:name':'com.google.firebase.iid.FirebaseInstanceIdReceiver','tools:node':'remove'}});
   app['meta-data']=(app['meta-data']||[]).filter(m=>m.$['android:name']!=='firebase_messaging_auto_init_enabled');app['meta-data'].push({$:{'android:name':'firebase_messaging_auto_init_enabled','android:value':'false'}});
   const discovery='com.google.firebase.components.ComponentDiscoveryService';
   let service=app.service.find(s=>s.$['android:name']===discovery);
   if(!service){service={$:{'android:name':discovery}};app.service.push(service);}
   const registrars=['com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingRegistrar','com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingKtxRegistrar'];
   service['meta-data']=(service['meta-data']||[]).filter(m=>!registrars.includes(m.$['android:name']));
   service['meta-data'].push(...registrars.map(name=>({$:{'android:name':name,'tools:node':'remove'}})));
  }return c;
 });
 config=withDangerousMod(config,['android',async c=>{
  const dir=path.join(c.modRequest.platformProjectRoot,'app/src/main/res/xml');fs.mkdirSync(dir,{recursive:true});
  const excludes='<exclude domain="root" path="."/><exclude domain="file" path="."/><exclude domain="database" path="."/><exclude domain="sharedpref" path="."/><exclude domain="external" path="."/>';
  fs.writeFileSync(path.join(dir,'mymap_backup_rules.xml'),`<?xml version="1.0" encoding="utf-8"?><full-backup-content>${excludes}</full-backup-content>`);
  fs.writeFileSync(path.join(dir,'mymap_data_extraction_rules.xml'),`<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup disableIfNoEncryptionCapabilities="true">${excludes}</cloud-backup><device-transfer>${excludes}</device-transfer></data-extraction-rules>`);return c;
 }]);
 config=withDangerousMod(config,['android',async c=>{const dir=path.join(c.modRequest.platformProjectRoot,'app/src/main/assets');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'mymap-release-inputs.json'),JSON.stringify(inputs));return c;}]);
 for(const platform of ['ios','android'])config=withDangerousMod(config,[platform,async c=>{if(process.env.MYMAP_RELEASE==='true')require('../scripts/native-locks.cjs').sync('restore',platform,store);return c;}]);
 return withXcodeProject(config,c=>{
  require('./ios-release-settings.cjs')(c.modResults,config.version,config.ios.buildNumber);
  return c;
 });
};
