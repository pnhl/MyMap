// Syntax/manifest tests need CNG output on PRs, without access to production
// Firebase files. This fixture cannot connect to Firebase and is never used
// by a release build or included in Git.
const fs=require('node:fs'),release=require('../release.json');
if(process.env.MYMAP_RELEASE!=='false')throw Error('Native test fixture requires MYMAP_RELEASE=false.');
if(fs.existsSync('google-services.json'))throw Error('Refusing to overwrite an existing Firebase configuration.');
fs.writeFileSync('google-services.json',JSON.stringify({project_info:{project_number:'000000000000',project_id:'mymap-native-tests'},client:[{client_info:{mobilesdk_app_id:'1:000000000000:android:nativefixture',android_client_info:{package_name:release.applicationId}},api_key:[{current_key:'not-a-real-api-key'}],oauth_client:[]}],configuration_version:'1'}));
console.log('Created nonfunctional native test fixture; no production credentials used.');
