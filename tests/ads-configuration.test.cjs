const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadService} = require('./service-loader.cjs');
const defaults = require('../config/admob.json');

function runtime(values = {}) {
  return loadService('src/config/env.ts', {'../../config/admob.json': defaults}, {process:{env:values}}).env;
}
function config(store, values = {}) {
  const factory = loadService('app.config.ts', {
    'node:fs': {existsSync:()=>false, readFileSync:fs.readFileSync},
    'node:process': {loadEnvFile:()=>{throw Error('Tests must not load private environment files');}},
    './scripts/provider-secret-policy.cjs':require('../scripts/provider-secret-policy.cjs'),
    './scripts/maplibre-privacy-patch.cjs':{applyPatch:()=>{}},
  }, {process:{env:{MYMAP_STORE:store, MYMAP_RELEASE:'true', ...values}}}).default;
  return factory({config:JSON.parse(fs.readFileSync('app.json','utf8')).expo});
}

test('Android and Fire share the Android native unit; iOS uses its own unit without private env files', () => {
  const env = runtime();
  assert.equal(env.adMobAndroidAppId, 'ca-app-pub-9161074667002246~7998118867');
  assert.equal(env.adMobIosAppId, 'ca-app-pub-9161074667002246~3833345863');
  for (const placement of Object.keys(env.nativeAdUnitIds)) {
    assert.equal(env.nativeAdUnitIds[placement], 'ca-app-pub-9161074667002246/5866779544');
    assert.equal(env.iosNativeAdUnitIds[placement], 'ca-app-pub-9161074667002246/9233846353');
    assert.equal(env.bannerAdUnitIds[placement], '', 'Native IDs must never be used as banner IDs');
    assert.equal(env.iosBannerAdUnitIds[placement], '');
  }
  assert.equal(env.enableTestAds, false);
});

test('placement overrides remain platform specific', () => {
  const env = runtime({EXPO_PUBLIC_ADMOB_IOS_NATIVE_PROFILE_ID:' ios-unit ', EXPO_PUBLIC_ADMOB_NATIVE_SMART_ID:'android-unit'});
  assert.equal(env.iosNativeAdUnitIds.profile, 'ios-unit');
  assert.equal(env.nativeAdUnitIds.profile, defaults.android.nativeAdUnitId);
  assert.equal(env.nativeAdUnitIds.smart, 'android-unit');
  assert.equal(env.iosNativeAdUnitIds.smart, defaults.ios.nativeAdUnitId);
});

test('eligible release profiles configure Mobile Ads and reject sample application IDs', () => {
  for (const store of ['play','ios']) {
    const ads = config(store).plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
    assert.equal(ads[1].androidAppId, defaults.android.appId);
    assert.equal(ads[1].iosAppId, defaults.ios.appId);
    const key = store === 'ios' ? 'EXPO_PUBLIC_ADMOB_IOS_APP_ID' : 'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID';
    assert.throws(() => config(store, {[key]:'ca-app-pub-3940256099942544~3347511713'}), /real AdMob/);
    assert.throws(() => config(store, {EXPO_PUBLIC_ENABLE_TEST_ADS:'true'}), /disable test ads/);
  }
});

test('Fire excludes both Google Mobile Ads and Google Sign-In by default', () => {
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync('react-native.config.js','utf8'), {module,process:{env:{MYMAP_STORE:'amazon'}}});
  assert.equal(module.exports.dependencies['@react-native-google-signin/google-signin'].platforms.android, null);
  assert.equal(module.exports.dependencies['react-native-google-mobile-ads'].platforms.android, null);
  assert.ok(!config('amazon').plugins.some(p=>Array.isArray(p)&&p[0]==='react-native-google-mobile-ads'));
});
test('release rejects sample and known wrong-platform native units',()=>{
 for(const values of [{EXPO_PUBLIC_ADMOB_IOS_NATIVE_SMART_ID:defaults.android.nativeAdUnitId},{EXPO_PUBLIC_ADMOB_NATIVE_SMART_ID:defaults.ios.nativeAdUnitId},{EXPO_PUBLIC_ADMOB_NATIVE_SMART_ID:'ca-app-pub-3940256099942544/2247696110'}])assert.throws(()=>config('play',values),/wrong-platform/);
 assert.throws(()=>config('play',{APP_STORE_TARGET:'amazon'}),/Conflicting/);
});
