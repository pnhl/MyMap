const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('persisted Expo location jobs have the Android boot permission in builds and prebuild configuration', () => {
  // JobScheduler rejects setPersisted(true) before executing JS if this normal permission is absent.
  assert.match(read('node_modules/expo-task-manager/android/src/main/java/expo/modules/taskManager/TaskManagerUtils.java'), /\.setPersisted\(true\)/);
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /<uses-permission\s+android:name="android\.permission\.RECEIVE_BOOT_COMPLETED"\s*\/>/);
  const permissions = JSON.parse(read('app.json')).expo.android.permissions;
  assert.ok(permissions.includes('RECEIVE_BOOT_COMPLETED'), 'Expo regeneration must retain the required permission');
  assert.match(read('plugins/withMyMapAndroid.ts'), /'android\.permission\.RECEIVE_BOOT_COMPLETED'/);
});
