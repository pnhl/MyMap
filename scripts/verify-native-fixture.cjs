// Source/native evidence only: this does not replace signed artifact gates.
const fs=require('node:fs'),path=require('node:path');
const store=process.argv[2],root=process.argv[3]||JSON.parse(fs.readFileSync('.local/parity-workspace.json')).directory;
if(!['amazon','play'].includes(store))throw Error('Choose store.');
const flavor=store==='play'?'google':'amazon',variant=flavor+'Release';
const manifest=fs.readFileSync(path.join(root,`android/app/build/intermediates/merged_manifests/${variant}/process${flavor[0].toUpperCase()+flavor.slice(1)}ReleaseManifest/AndroidManifest.xml`),'utf8');
const policy=require('../config/android-permissions.json'),release=require('../release.json');
const permissions=[...manifest.matchAll(/<uses-permission\b[^>]*android:name="([^"]+)"/g)].map(x=>x[1]);
const allowed=new Set([...policy.common,...policy[store],release.applicationId+'.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION']);
const unexpected=permissions.filter(p=>!allowed.has(p));if(unexpected.length)throw Error('Unexpected merged permissions: '+unexpected.join(','));
for(const value of ['android:allowBackup="false"','@xml/mymap_data_extraction_rules','@xml/mymap_backup_rules'])if(!manifest.includes(value))throw Error('Missing merged protection: '+value);
if(/android:debuggable="true"/.test(manifest))throw Error('Release debuggable.');
if(store==='amazon')for(const name of ['MobileAdsInitProvider','ExpoFirebaseMessagingService','FirebaseMessagingService','FirebaseInstanceIdReceiver','FirebaseMessagingRegistrar','FirebaseMessagingKtxRegistrar','MyMapCarService','RNGoogleSignin'])if(manifest.includes(name))throw Error('Unsafe Fire initializer/component: '+name);
const report=fs.readFileSync(path.join(root,`modules/my-map-capabilities/android/build/test-results/test${flavor[0].toUpperCase()+flavor.slice(1)}ReleaseUnitTest/TEST-expo.modules.mymapcapabilities.GoogleServicesGateTest.xml`),'utf8');
if(!/tests="2"/.test(report)||! /failures="0" errors="0"/.test(report))throw Error('Native no-GMS unit tests failed or missing.');
console.log(JSON.stringify({store,nativeTests:2,mergedPermissions:permissions.length,backupDisabled:true,signatureTested:false,deviceColdStartTested:false}));
