const test=require('node:test'),assert=require('node:assert/strict');
const {loadService}=require('./service-loader.cjs');
function setup(){
 const state={currentUser:{uid:'owner',providerData:[]}},calls=[];
 const sdk={GoogleAuthProvider:{credential:()=>({provider:'google'})},AppleAuthProvider:{credential:()=>({provider:'apple'})},PhoneAuthProvider:{credential:(id,code)=>({provider:'phone',id,code})},
 linkWithCredential:async(user,c)=>{calls.push(c);return{user};},signInWithCredential:async()=>{throw Error('Must not sign in while linking');},verifyPhoneNumber:()=>({on:(_event,next)=>next({state:'sent',verificationId:'verification'})})};
 const auth=loadService('src/services/auth.ts',{'@react-native-async-storage/async-storage':{},'@react-native-firebase/auth':sdk,'expo-apple-authentication':{isAvailableAsync:async()=>true,AppleAuthenticationScope:{FULL_NAME:0,EMAIL:1},signInAsync:async()=>({identityToken:'test'})},'expo-crypto':{randomUUID:()=> 'nonce',CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async()=> 'hash'},'./firebase':{firebaseAuth:state,waitForFirebaseAuth:async()=>{},firebaseSession:async()=>({user:{id:state.currentUser.uid}})},'../../modules/my-map-game-center':{}});
 return{auth,state,calls,sdk};
}
test('Google, Apple and phone link credentials retain the existing UID without sign-in',async()=>{
 const {auth,calls}=setup();
 assert.equal((await auth.signInWithGoogleToken('token',null,'owner')).user.id,'owner');
 assert.equal((await auth.signInWithApple(true)).user.id,'owner');
 assert.equal((await auth.sendPhoneLinkCode('+84901234567')).success,true);
 assert.equal((await auth.confirmPhoneLinkCode('123456')).user.id,'owner');
 assert.deepEqual(calls.map(c=>c.provider),['google','apple','phone']);
});
test('phone confirmation after an account switch cannot attach a credential to the new owner',async()=>{
 const {auth,state,calls}=setup();await auth.sendPhoneLinkCode('+84901234567');state.currentUser={uid:'other'};
 assert.ok((await auth.confirmPhoneLinkCode('123456')).error);assert.equal(calls.length,0);
});
test('provider credential collision stays an error and never falls back to signing in',async()=>{
 const {auth,sdk}=setup();sdk.linkWithCredential=async()=>{throw{code:'auth/credential-already-in-use'};};
 assert.ok((await auth.signInWithGoogleToken('token',null,'owner')).error);
});
