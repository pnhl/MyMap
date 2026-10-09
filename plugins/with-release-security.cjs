const {withAndroidManifest,withDangerousMod,withXcodeProject}=require('expo/config-plugins');
const fs=require('node:fs'),path=require('node:path');
module.exports=config=>{
 config=withAndroidManifest(config,c=>{
  const app=c.modResults.manifest.application[0];
  app.$['android:allowBackup']='false';app.$['android:fullBackupContent']='@xml/mymap_backup_rules';app.$['android:dataExtractionRules']='@xml/mymap_data_extraction_rules';
  c.modResults.manifest.$['xmlns:tools']='http://schemas.android.com/tools';
  const removed=['android.permission.SYSTEM_ALERT_WINDOW','android.permission.READ_EXTERNAL_STORAGE','android.permission.WRITE_EXTERNAL_STORAGE','android.permission.ACTIVITY_RECOGNITION'];
  c.modResults.manifest['uses-permission']=(c.modResults.manifest['uses-permission']||[]).filter(p=>!removed.includes(p.$['android:name']));
  for(const name of removed)c.modResults.manifest['uses-permission'].push({$:{'android:name':name,'tools:node':'remove'}});
  if(process.env.MYMAP_STORE==='amazon'){
   for(const name of ['com.google.android.gms.permission.AD_ID','android.permission.ACCESS_ADSERVICES_AD_ID','android.permission.ACCESS_ADSERVICES_ATTRIBUTION','android.permission.ACCESS_ADSERVICES_TOPICS','com.google.android.c2dm.permission.RECEIVE'])c.modResults.manifest['uses-permission'].push({$:{'android:name':name,'tools:node':'remove'}});
   for(const name of ['com.google.firebase.messaging.FirebaseMessagingService','expo.modules.notifications.service.ExpoFirebaseMessagingService']){app.service=(app.service||[]).filter(s=>s.$['android:name']!==name);app.service.push({$:{'android:name':name,'tools:node':'remove'}});}
   app.receiver=(app.receiver||[]).filter(s=>s.$['android:name']!=='com.google.firebase.iid.FirebaseInstanceIdReceiver');app.receiver.push({$:{'android:name':'com.google.firebase.iid.FirebaseInstanceIdReceiver','tools:node':'remove'}});
   app['meta-data']=(app['meta-data']||[]).filter(m=>m.$['android:name']!=='firebase_messaging_auto_init_enabled');app['meta-data'].push({$:{'android:name':'firebase_messaging_auto_init_enabled','android:value':'false'}});
  }return c;
 });
 config=withDangerousMod(config,['android',async c=>{
  const dir=path.join(c.modRequest.platformProjectRoot,'app/src/main/res/xml');fs.mkdirSync(dir,{recursive:true});
  const excludes='<exclude domain="root" path="."/><exclude domain="file" path="."/><exclude domain="database" path="."/><exclude domain="sharedpref" path="."/><exclude domain="external" path="."/>';
  fs.writeFileSync(path.join(dir,'mymap_backup_rules.xml'),`<?xml version="1.0" encoding="utf-8"?><full-backup-content>${excludes}</full-backup-content>`);
  fs.writeFileSync(path.join(dir,'mymap_data_extraction_rules.xml'),`<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup disableIfNoEncryptionCapabilities="true">${excludes}</cloud-backup><device-transfer>${excludes}</device-transfer></data-extraction-rules>`);return c;
 }]);
 return withXcodeProject(config,c=>{
  for(const entry of Object.values(c.modResults.pbxXCBuildConfigurationSection()))if(entry&&typeof entry==='object'&&entry.name==='Release'&&entry.buildSettings){entry.buildSettings.ENABLE_DEBUG_DYLIB='NO';entry.buildSettings.CURRENT_PROJECT_VERSION=config.ios.buildNumber;entry.buildSettings.MARKETING_VERSION=config.version;}
  return c;
 });
};
