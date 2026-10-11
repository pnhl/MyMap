const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {collectSecrets,metadata,upload,propertyValue}=require('../scripts/cloudflare-secrets.cjs');

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mymap-cloudflare-test-'));
  t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});
  fs.mkdirSync(path.join(root,'.signing'));
  fs.writeFileSync(path.join(root,'.env'),'EXPO_PUBLIC_SUPABASE_URL=https://project.example.test\n');
  fs.writeFileSync(path.join(root,'google-services.json'),JSON.stringify({client:[{client_info:{android_client_info:{package_name:'com.pnhl.vibecoding'}}}]}));
  fs.writeFileSync(path.join(root,'.signing/release.properties'),'storeFile=../../.signing/existing.p12\nstorePassword=existing-password\nkeyAlias=existing-alias\nkeyPassword=existing-key-password\n');
  fs.writeFileSync(path.join(root,'.signing/existing.p12'),'existing-key-bytes');
  const wrangler=path.join(root,'cloudflare/geo-gateway/node_modules/wrangler/bin/wrangler.js');
  fs.mkdirSync(path.dirname(wrangler),{recursive:true});fs.writeFileSync(wrangler,'');
  return root;
}

test('collection keeps exact existing signing key/passwords and reports absent iOS config without inventing it',t=>{
  const root=fixture(t),plan=collectSecrets(root),values=Object.fromEntries(plan.secrets.map(s=>[s.name,s.value]));
  assert.equal(Buffer.from(values.MYMAP_ANDROID_KEYSTORE_BASE64,'base64').toString(),'existing-key-bytes');
  assert.deepEqual(JSON.parse(values.MYMAP_ANDROID_SIGNING_JSON),{storePassword:'existing-password',keyAlias:'existing-alias',keyPassword:'existing-key-password'});
  assert.match(values.MYMAP_MOBILE_PUBLIC_ENV,/EXPO_PUBLIC_SUPABASE_URL/);
  assert.equal(values.MYMAP_MOBILE_BUILD_ENV,undefined);
  assert.ok(plan.missing.includes('GoogleService-Info.plist'));
  assert.doesNotMatch(JSON.stringify(metadata(plan)),/private-fixture-value|existing-password|project\.example/);
  assert.equal(propertyValue('storeFile=C\\:\\\\key.p12','storeFile'),'C:\\key.p12');
  assert.equal(propertyValue('storePassword=secret with trailing space ','storePassword'),'secret with trailing space ');
});

test('wrong Firebase package or oversized secret fails before any upload',t=>{
  const root=fixture(t);
  fs.writeFileSync(path.join(root,'google-services.json'),JSON.stringify({client:[]}));
  assert.throws(()=>collectSecrets(root),/package mismatch/);
  fs.writeFileSync(path.join(root,'.env'),'EXPO_PUBLIC_LARGE_FIXTURE='+('x'.repeat(65536)));
  assert.throws(()=>collectSecrets(root),/size limit/);
});

test('legacy public provider credentials cannot be imported or archived again',t=>{
  const root=fixture(t);
  fs.writeFileSync(path.join(root,'.env'),'EXPO_PUBLIC_'+'TOMTOM_TRAFFIC_KEY=private-fixture-value');
  assert.throws(()=>collectSecrets(root),error=>/Server credential/.test(error.message)&&!error.message.includes('private-fixture-value'));
});

test('uploads use stdin and fixed Cloudflare API; receipts exclude values and reruns preserve existing secrets',t=>{
  const root=fixture(t),plan=collectSecrets(root),config={accountId:'a'.repeat(32),storeId:'b'.repeat(32)};
  let calls=0;
  const run=(command,args,options)=>{
    const secret=plan.secrets[calls++];
    assert.equal(options.input,secret.value);
    assert.equal(args.includes('--value'),false);
    assert.equal(args.some(a=>a.includes(secret.value)),false);
    assert.equal(options.env.CLOUDFLARE_API_BASE_URL,'https://api.cloudflare.com/client/v4');
    assert.equal(options.env.WRANGLER_LOG_SANITIZE,'true');
    return {status:0,stdout:'Created secret! (ID: '+'c'.repeat(32)+')'};
  };
  upload({root,plan,config,run});
  assert.equal(calls,plan.secrets.length);
  const receipts=fs.readFileSync(path.join(root,'.local/cloudflare-secret-receipts.json'),'utf8');
  for(const secret of plan.secrets)assert.equal(receipts.includes(secret.value),false);
  upload({root,plan,config,run:()=>{throw Error('Must not overwrite existing secrets');}});
  assert.ok(fs.existsSync(path.join(root,'.signing/existing.p12')));
});

test('raw upstream errors cannot print submitted credentials',t=>{
  const root=fixture(t),plan=collectSecrets(root),config={accountId:'a'.repeat(32),storeId:'b'.repeat(32)};
  assert.throws(()=>upload({root,plan,config,run:()=>({status:1,stdout:'private-fixture-value',stderr:'existing-password'})}),error=>{
    assert.doesNotMatch(error.message,/private-fixture-value|existing-password/);return /upload failed/.test(error.message);
  });
});
