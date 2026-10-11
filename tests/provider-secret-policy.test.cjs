const test=require('node:test'),assert=require('node:assert/strict');
const {forbiddenPublicNames,assertPublicEnvironment,validatePublicEnvText}=require('../scripts/provider-secret-policy.cjs');
test('obsolete provider public names fail before accessing their values',()=>{
 for(const name of forbiddenPublicNames){const env={};Object.defineProperty(env,name,{enumerable:true,get(){throw Error('Value was read');}});assert.throws(()=>assertPublicEnvironment(env),/Server credential is forbidden/);}
 assert.throws(()=>assertPublicEnvironment({EXPO_PUBLIC_OTHER_API_KEY:''}),/Server credential/);
});
test('CI rejects private entries and credential-bearing URLs without echoing values',()=>{
 for(const query of ['api_key','key','access_token','client_secret','signature']){
  assert.throws(()=>validatePublicEnvText('EXPO_PUBLIC_OFFLINE_TILE_URL=https://tiles.example.test/{z}?'+query+'=fixture-private'),error=>/Credential-bearing/.test(error.message)&&!error.message.includes('fixture-private'));
 }
 assert.throws(()=>validatePublicEnvText('SERVER_KEY=fixture-private'),/public variables only/);
 assert.throws(()=>validatePublicEnvText('EXPO_PUBLIC_MAPLIBRE_STYLE_URL=https://fixture-private@example.test/style'),/Credential-bearing/);
 assert.throws(()=>assertPublicEnvironment({EXPO_PUBLIC_ROUTING_GATEWAY_URL:'http://example.test'}),/HTTPS/);
});
test('publishable identifiers, OAuth PKCE identifiers, public URLs and flags remain valid',()=>{
 const env={EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',EXPO_PUBLIC_ADMOB_ANDROID_APP_ID:'public-app-id',EXPO_PUBLIC_SPOTIFY_CLIENT_ID:'public-pkce-id',EXPO_PUBLIC_SPOTIFY_REDIRECT_URI:'mymap://callback',EXPO_PUBLIC_ENABLE_TEST_ADS:'false',EXPO_PUBLIC_ROUTING_GATEWAY_URL:'https://gateway.example.test',EXPO_PUBLIC_OSM_TILE_URL:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'};
 assert.doesNotThrow(()=>assertPublicEnvironment(env));
 assert.equal(validatePublicEnvText('EXPO_PUBLIC_ENABLE_TEST_ADS=false\n'),'EXPO_PUBLIC_ENABLE_TEST_ADS=false\n');
});
