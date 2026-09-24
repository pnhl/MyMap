const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('MyMap branding is wired to the app icon, native splash and in-app header', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  assert.equal(config.icon, './assets/branding/app-icon-v2.png');
  assert.equal(config.backgroundColor, '#061326');
  assert.equal(config.android.adaptiveIcon.foregroundImage, './assets/branding/adaptive-foreground-v2.png');
  const splashPlugin = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
  assert.equal(splashPlugin[1].image, './assets/branding/splash-logo-v2.png');
  assert.equal(splashPlugin[1].backgroundColor, '#061326');

  for (const asset of ['app-icon-v2.png', 'adaptive-foreground-v2.png', 'splash-background-v2.png', 'splash-logo-v2.png']) {
    assert.ok(fs.statSync(path.join(root, 'assets', 'branding', asset)).size > 1_000);
  }

  const styles = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'), 'utf8');
  const splash = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable', 'splash_screen.xml'), 'utf8');
  const header = fs.readFileSync(path.join(root, 'src', 'ui', 'glass.tsx'), 'utf8');
  assert.match(styles, /@drawable\/splash_screen/);
  assert.match(splash, /@drawable\/splashscreen_logo/);
  assert.match(header, /assets\/branding\/splash-logo-v2\.png/);
});
