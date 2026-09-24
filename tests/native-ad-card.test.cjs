const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src/components/NativeAdCard.tsx'),
  'utf8',
);

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
