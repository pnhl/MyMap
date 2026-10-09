const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {parseStringPromise} = require('xml2js');

function manifestPlugin() {
  const actions = [];
  const passthrough = config => config;
  const mockedPlugins = {
    withAndroidManifest: (config, action) => {actions.push(action); return config;},
    withAndroidStyles: passthrough,
    withAppBuildGradle: passthrough,
    withDangerousMod: passthrough,
    withMainApplication: passthrough,
    withGradleProperties: passthrough,
    withProjectBuildGradle: passthrough,
  };
  const module = {exports: {}};
  const compiled = ts.transpileModule(fs.readFileSync('plugins/withMyMapAndroid.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, __dirname: path.resolve('plugins'),
    require: name => name === '@expo/config-plugins' ? mockedPlugins : require(name),
  });
  module.exports.default({});
  return actions[0];
}

test('native regeneration exposes only the supported Spotube packages and preserves GPS services', () => {
  const transform = manifestPlugin();
  const manifest = {application: [{$: {'android:name': '.MainApplication'}}]};
  transform({modResults: {manifest}});
  transform({modResults: {manifest}});
  const packages = manifest.queries.flatMap(item => item.package || []).map(item => item.$['android:name']);
  assert.equal(packages.length, 3);
  assert.equal(new Set(packages).size, 3);
  assert.ok(packages.includes('oss.krtirtho.spotube'));
  assert.ok(!manifest['uses-permission'].some(item => item.$['android:name'] === 'android.permission.QUERY_ALL_PACKAGES'));
  const services = manifest.application[0].service;
  assert.equal(services.filter(item => item.$['android:foregroundServiceType'] === 'mediaPlayback').length, 1);
  assert.equal(services.filter(item => item.$['android:foregroundServiceType'] === 'location').length, 1);
  assert.equal(services.filter(item => item.$['android:foregroundServiceType'] === 'specialUse').length, 1);
});

test('Spotube connection permits cleartext only on loopback and keeps remote traffic secure', async () => {
  const parsed = await parseStringPromise(fs.readFileSync('android/app/src/main/res/xml/mymap_network_security_config.xml', 'utf8'));
  const network = parsed['network-security-config'];
  assert.equal(network['base-config'][0].$.cleartextTrafficPermitted, 'false');
  const exceptions = network['domain-config'];
  assert.equal(exceptions.length, 1);
  assert.equal(exceptions[0].$.cleartextTrafficPermitted, 'true');
  const domains = exceptions[0].domain;
  assert.deepEqual(domains.map(item => item._).sort(), ['127.0.0.1', 'localhost']);
  assert.ok(domains.every(item => item.$.includeSubdomains === 'false'));
});

test('music playback remains background-only while moments request the microphone explicitly', async () => {
  const config = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  const audio = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-audio')[1];
  assert.equal(audio.enableBackgroundPlayback, true);
  assert.equal(audio.enableBackgroundRecording, false);
  assert.equal(audio.recordAudioAndroid, true);
  assert.equal(typeof audio.microphonePermission, 'string');
  assert.ok(config.ios.infoPlist.UIBackgroundModes.includes('audio'));
  const manifest = (await parseStringPromise(fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8'))).manifest;
  assert.ok(manifest['uses-permission'].some(item => item.$['android:name'] === 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'));
  const recording = manifest['uses-permission'].filter(item => item.$['android:name'] === 'android.permission.RECORD_AUDIO');
  assert.ok(recording.some(item => item.$['tools:node'] !== 'remove'));
  const services = manifest.application[0].service;
  assert.ok(!services.some(item => item.$['android:foregroundServiceType'] === 'microphone'));
  assert.equal(services.filter(item => item.$['android:foregroundServiceType'] === 'mediaPlayback').length, 1);
});
