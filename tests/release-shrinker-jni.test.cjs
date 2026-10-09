const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function regeneratedRules(initial) {
  const mods = [];
  let rules = initial;
  const passthrough = config => config;
  const configPlugins = Object.fromEntries(['withAndroidManifest', 'withAndroidStyles',
    'withAppBuildGradle', 'withMainApplication', 'withGradleProperties',
    'withProjectBuildGradle'].map(name => [name, passthrough]));
  configPlugins.withDangerousMod = (config, [, action]) => { mods.push(action); return config; };
  const fakeFs = {
    ...fs, mkdirSync() {}, copyFileSync() {},
    readFileSync(file) { return file.endsWith('proguard-rules.pro') ? rules : ''; },
    writeFileSync(file, text) { if (file.endsWith('proguard-rules.pro')) rules = text; },
    existsSync() { return false; },
  };
  const module = {exports: {}};
  const compiled = ts.transpileModule(fs.readFileSync('plugins/withMyMapAndroid.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, __dirname: path.resolve('plugins'),
    require: name => name === '@expo/config-plugins' ? configPlugins :
      (name === 'fs' || name === 'node:fs') ? fakeFs : require(name),
  });
  module.exports.default({});
  const run = () => mods.forEach(action => action({modRequest: {platformProjectRoot: '/qa/android'}}));
  run(); const once = rules; run();
  assert.equal(rules, once, 'Repeated Expo regeneration must not duplicate the JNI keep rule');
  return rules;
}

// WebRTC's JNI_OnLoad uses the prefixed class name, which is invisible to R8's
// Java call graph. The upstream org.jni_zero rule does not match that namespace.
const prefixedJniKeep = /^\s*-keep\s+class\s+livekit\.org\.jni_zero\.\*\*\s*\{\s*\*;\s*\}/m;

test('release shrinker retains LiveKit-prefixed JNI classes and members', () => {
  assert.match(fs.readFileSync('android/app/proguard-rules.pro', 'utf8'), prefixedJniKeep);
});

test('Expo regeneration preserves prefixed JNI entries even with an unprefixed upstream rule', () => {
  assert.match(regeneratedRules('-keep class org.jni_zero.** { *; }\n'), prefixedJniKeep);
});

const headlessKeep = /^\s*-keep\s+class\s+expo\.modules\.adapters\.react\.apploader\.RNHeadlessAppLoader\s*\{\s*\*;\s*\}/m;
test('release shrinker preserves the Expo task loader instantiated from manifest metadata', () => {
  assert.match(fs.readFileSync('android/app/proguard-rules.pro', 'utf8'), headlessKeep);
});

test('Expo regeneration retains the background task loader class and no-argument constructor', () => {
  assert.match(regeneratedRules(''), headlessKeep);
});
