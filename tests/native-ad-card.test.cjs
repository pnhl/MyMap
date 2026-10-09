const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src/components/NativeAdCardGoogle.tsx'),
  'utf8',
);
const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/services/adsPrivacy.ts'), 'utf8');
const androidSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'android/app/src/main/java/com/pnhl/vibecoding/PlatformLocationModule.kt'),
  'utf8',
);
const gradleSource = fs.readFileSync(path.resolve(__dirname, '..', 'android/app/build.gradle'), 'utf8');

test('native ad requests a landscape creative and renders registered media assets', () => {
  assert.match(source, /aspectRatio:\s*NativeMediaAspectRatio\.LANDSCAPE/);
  assert.match(source, /<NativeMediaView\s+resizeMode="cover"/);
  assert.match(source, /NativeAssetType\.HEADLINE/);
  assert.match(source, /NativeAssetType\.BODY/);
  assert.match(source, /NativeAssetType\.CALL_TO_ACTION/);
});

test('native ad keeps attribution visible, retries, and has no dismiss control', () => {
  assert.match(source, />ĐƯỢC TÀI TRỢ<\/Text>/);
  assert.doesNotMatch(source, /accessibilityLabel="Ẩn quảng cáo"/);
  assert.match(source, /setAttempt\(value => value \+ 1\)/);
  assert.match(source, /BannerAdSize\.ANCHORED_ADAPTIVE_BANNER/);
});

test('Amazon Publisher Services is packaged and initialized before Google Mobile Ads', () => {
  assert.match(gradleSource, /com\.amazon\.android:aps-sdk:12\.0\.1/);
  assert.match(gradleSource, /com\.amazon\.android:aps-admob-adapter:6\.0\.0/);
  assert.match(androidSource, /AdRegistration\.getInstance\(appId, context\.applicationContext\)/);
  assert.match(appSource, /initializeAmazonPublisherServices\(env\.amazonApsAppId\)/);
  assert.match(appSource, /await mobileAds\(\)\.initialize\(\)/);
});
