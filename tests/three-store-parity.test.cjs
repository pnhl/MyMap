const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name=>{if(Object.hasOwn(mocks,name))return mocks[name];throw Error('Unexpected native dependency: '+name);},m,m.exports);return m.exports;}
test('Fire without Google native modules renders login and ad facades without requiring their SDKs',()=>{
 const mocks={react:{createElement:()=>{throw Error('must remain hidden');}},'../services/nativeSdks':{googleSignInAvailable:()=>false,adsSdkAvailable:()=>false}};
 assert.equal(load('src/components/GoogleFirebaseButton.tsx',mocks).default({}),null);
 assert.equal(load('src/components/NativeAdCard.tsx',mocks).NativeAdCard({placement:'smart'}),null);
});
function accountMocks(user,link){return{'@react-native-async-storage/async-storage':{},'expo-apple-authentication':{},'expo-crypto':{},'../../modules/my-map-game-center':{},'./firebase':{firebaseAuth:{currentUser:user},waitForFirebaseAuth:async()=>{},firebaseSession:async()=>({user:{id:user.uid}})},'@react-native-firebase/auth':{EmailAuthProvider:{credential:(email,password)=>({email,password})},linkWithCredential:link,sendEmailVerification:async()=>{}}};}
test('portable email linking retains the Apple account UID and never creates another account',async()=>{
 const user={uid:'apple-owner',providerData:[{providerId:'apple.com'}]};let linked=false;
 const auth=load('src/services/auth.ts',accountMocks(user,async(owner,credential)=>{assert.equal(owner,user);assert.equal(credential.email,'user@example.test');linked=true;return{user};}));
 const result=await auth.linkAccountEmail(' USER@example.test ','long-password');assert.equal(result.user.id,user.uid);assert.equal(result.error,null);assert.equal(linked,true);
});
test('email collision and expired login never merge a different owner',async()=>{
 for(const code of ['auth/credential-already-in-use','auth/requires-recent-login']){
  const user={uid:'owner',providerData:[]};const auth=load('src/services/auth.ts',accountMocks(user,async()=>{throw{code};}));
  const result=await auth.linkAccountEmail('user@example.test','long-password');assert.equal(result.user,null);assert.ok(result.error);
 }
});
test('an account with an existing password cannot silently replace its credential',async()=>{
 const user={uid:'owner',providerData:[{providerId:'password'}]};let used=false;
 const auth=load('src/services/auth.ts',accountMocks(user,async()=>{used=true;}));assert.ok((await auth.linkAccountEmail('user@example.test','long-password')).error);assert.equal(used,false);
});
