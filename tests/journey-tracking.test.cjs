const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tracking = fs.readFileSync(path.resolve(__dirname, '../src/services/locationTracking.ts'), 'utf8');
const background = fs.readFileSync(path.resolve(__dirname, '../src/services/backgroundLocationTask.ts'), 'utf8');
const platformFallback = fs.readFileSync(path.resolve(__dirname, '../src/services/platformLocation.ts'), 'utf8');
const androidFallback = fs.readFileSync(path.resolve(__dirname, '../android/app/src/main/java/com/pnhl/vibecoding/PlatformLocationModule.kt'), 'utf8');

test('starting a journey saves an immediate point and supports foreground fallback', () => {
  assert.match(tracking, /getCurrentPositionAsync/);
  assert.match(tracking, /persistLocation\(first\)/);
  assert.match(tracking, /watchPositionAsync/);
  assert.match(tracking, /backgroundGranted/);
  assert.match(tracking, /TrackingMode = 'background' \| 'foreground'/);
  assert.match(tracking, /isAmazonLocationDevice/);
  assert.match(platformFallback, /NativeModules\.PlatformLocation/);
  assert.match(androidFallback, /LocationManager\.GPS_PROVIDER/);
  assert.match(androidFallback, /Build\.MANUFACTURER/);
});

test('background recorder accepts coarse Fire OS fixes and preserves a stationary heartbeat', () => {
  assert.match(background, /c\.accuracy > 120/);
  assert.match(background, /10 \* 60 \* 1000/);
});
