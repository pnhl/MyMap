// Upload only to Cloudflare Secrets Store. Secret values never enter argv,
// stdout, receipts or Git; Wrangler receives them through an anonymous pipe.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {validatePublicEnvText} = require('./provider-secret-policy.cjs');

function propertyValue(source, key) {
  const raw = source.match(new RegExp('^\\s*'+key+'\\s*[=:]\\s*(.*)$','m'))?.[1];
  if (raw === undefined) throw Error('Signing configuration is missing '+key);
  return raw.replace(/\\u([0-9a-f]{4})|\\(.)/gi, (_, hex, char) =>
    hex ? String.fromCharCode(parseInt(hex,16)) : ({n:'\n',r:'\r',t:'\t',f:'\f'}[char] ?? char));
}

function collectSecrets(root, {iosPlist} = {}) {
  const secrets = [], missing = [];
  function add(name, value) {
    if (!value || !value.trim()) throw Error('Refusing empty secret: '+name);
    if (Buffer.byteLength(value)>65536) throw Error('Secret exceeds Cloudflare size limit: '+name);
    secrets.push({name,value});
  }
  const envPath = path.join(root,'.env');
  if (fs.existsSync(envPath)) {
    // Do not recreate the legacy archive containing public provider credentials.
    // Provider secrets are managed directly on Cloudflare, never through Expo.
    const source = validatePublicEnvText(fs.readFileSync(envPath,'utf8'));
    add('MYMAP_MOBILE_PUBLIC_ENV',source);
  } else missing.push('.env');
  const androidConfig = path.join(root,'google-services.json');
  if (fs.existsSync(androidConfig)) {
    const source = fs.readFileSync(androidConfig,'utf8');let config;
    try{config=JSON.parse(source);}catch{throw Error('Invalid Firebase Android configuration; contents were not printed');}
    if (!config.client?.some(c=>c.client_info?.android_client_info?.package_name==='com.pnhl.vibecoding')) throw Error('Firebase Android package mismatch');
    add('MYMAP_FIREBASE_ANDROID_JSON',source);
  } else missing.push('google-services.json');
  const iosConfig = iosPlist || path.join(root,'GoogleService-Info.plist');
  if (fs.existsSync(iosConfig)) {
    const source=fs.readFileSync(iosConfig,'utf8');
    if(!/<key>BUNDLE_ID<\/key>\s*<string>com\.pnhl\.vibecoding<\/string>/.test(source))throw Error('Firebase iOS bundle mismatch');
    add('MYMAP_FIREBASE_IOS_PLIST',source);
  }
  else missing.push('GoogleService-Info.plist');
  const propertiesPath = path.join(root,'.signing/release.properties');
  if (fs.existsSync(propertiesPath)) {
    const source = fs.readFileSync(propertiesPath,'utf8');
    const keystore = path.resolve(root,'android/app',propertyValue(source,'storeFile'));
    if (!fs.existsSync(keystore)) throw Error('Signing keystore is missing');
    const signing = {};
    for (const key of ['storePassword','keyAlias','keyPassword']) signing[key]=propertyValue(source,key);
    add('MYMAP_ANDROID_KEYSTORE_BASE64',fs.readFileSync(keystore).toString('base64'));
    add('MYMAP_ANDROID_SIGNING_JSON',JSON.stringify(signing));
  } else missing.push('.signing/release.properties');
  return {secrets,missing};
}

function metadata(plan) {
  return {secrets:plan.secrets.map(({name,value})=>({name,bytes:Buffer.byteLength(value)})),missing:plan.missing};
}

function upload({root,plan,config,run=spawnSync}) {
  if (!/^[a-f0-9]{32}$/.test(config.accountId) || !/^[a-f0-9]{32}$/.test(config.storeId)) throw Error('Invalid Cloudflare account/store ID');
  const cwd = path.join(root,'cloudflare/geo-gateway');
  const wrangler = path.join(cwd,'node_modules/wrangler/bin/wrangler.js');
  if (!fs.existsSync(wrangler)) throw Error('Install the pinned Cloudflare tooling with npm ci --prefix cloudflare/geo-gateway');
  const receiptsPath=path.join(root,'.local/cloudflare-secret-receipts.json');
  const previous=fs.existsSync(receiptsPath)?JSON.parse(fs.readFileSync(receiptsPath,'utf8')):null;
  const receipts=previous?.storeId===config.storeId?previous:{storeId:config.storeId,secrets:[]};
  const env={...process.env,CLOUDFLARE_ACCOUNT_ID:config.accountId,CLOUDFLARE_API_BASE_URL:'https://api.cloudflare.com/client/v4',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_SANITIZE:'true',WRANGLER_LOG:'log',NO_COLOR:'1'};
  for (const secret of plan.secrets) {
    if(receipts.secrets.some(item=>item.name===secret.name)) {
      console.log('Already uploaded; left unchanged: '+secret.name);continue;
    }
    const args=[wrangler,'secrets-store','secret','create',config.storeId,'--name',secret.name,'--scopes','workers','--comment','MyMap production configuration','--remote'];
    const result=run(process.execPath,args,{cwd,env,input:secret.value,encoding:'utf8',timeout:90000,maxBuffer:2*1024*1024});
    // Never print raw CLI errors: an upstream failure could echo a secret.
    if(result.status!==0) throw Error('Cloudflare upload failed for '+secret.name+'; check login/permissions and retry. Existing local files were preserved.');
    const id=result.stdout?.match(/Created secret[^\n]*ID:\s*([a-f0-9]{32})/i)?.[1];
    if(!id)throw Error('Cloudflare response could not be verified for '+secret.name+'; inspect remote metadata before retrying.');
    receipts.secrets.push({name:secret.name,id,uploadedAt:new Date().toISOString()});
    fs.mkdirSync(path.dirname(receiptsPath),{recursive:true});
    fs.writeFileSync(receiptsPath,JSON.stringify(receipts,null,2)+'\n',{mode:0o600});
    console.log('Stored on Cloudflare: '+secret.name);
  }
  return receipts;
}

if(require.main===module) {
  try {
    const root=path.resolve(__dirname,'..'), args=process.argv.slice(2);
    if(args.some(arg=>!['plan','upload'].includes(arg))) throw Error('Choose plan or upload');
    const plan=collectSecrets(root,{iosPlist:process.env.MYMAP_PRIVATE_IOS_PLIST});
    console.log(JSON.stringify(metadata(plan),null,2));
    if(args.includes('upload')) upload({root,plan,config:JSON.parse(fs.readFileSync(path.join(root,'config/cloudflare-secrets.json'),'utf8'))});
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
module.exports={collectSecrets,metadata,propertyValue,upload};
