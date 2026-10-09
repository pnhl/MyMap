const fs=require('node:fs'),path=require('node:path');
function required(name){const v=process.env[name];if(!v)throw Error('Missing CI secret: '+name);return v;}
function write(name,data){fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,data,{mode:0o600});}
try{
 const target=process.argv[2];write('.env',required('MYMAP_PUBLIC_ENV'));
 if(target==='ios')write('GoogleService-Info.plist',Buffer.from(required('FIREBASE_IOS_PLIST_BASE64'),'base64'));
 else if(target==='android'){
  write('google-services.json',Buffer.from(required('FIREBASE_ANDROID_BASE64'),'base64'));
  write('.signing/release.keystore',Buffer.from(required('ANDROID_KEYSTORE_BASE64'),'base64'));
  const escape=value=>value.replace(/\\/g,'\\\\').replace(/\r/g,'\\r').replace(/\n/g,'\\n');
  write('.signing/release.properties',`storeFile=../../.signing/release.keystore\nstorePassword=${escape(required('ANDROID_KEYSTORE_PASSWORD'))}\nkeyAlias=${escape(required('ANDROID_KEY_ALIAS'))}\nkeyPassword=${escape(required('ANDROID_KEY_PASSWORD'))}\n`);
 }else throw Error('Choose ios or android');
 console.log('Restored private CI configuration without printing values.');
}catch(e){console.error(e.message);process.exitCode=1;}
