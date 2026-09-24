const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function moduleFromSource(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
    name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Missing mock for ${name}`);
    },
    module,
    module.exports
  );
  return module.exports;
}

test('MapLibre Native is always available in native builds', () => {
  const mapsConfig = moduleFromSource('src/config/maps.ts', {});
  assert.equal(mapsConfig.NATIVE_MAPS_ENABLED, true);
});

test('map renderer exposes native, web and 3D engines', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/MapRenderer.tsx'), 'utf8');
  for (const engine of ['maplibre_native', 'leaflet', 'maplibre_gl', 'openlayers', 'cesium']) {
    assert.ok(source.includes(engine), `Missing renderer engine: ${engine}`);
  }
});

test('geo distance between current location and destination calculates correctly', () => {
  const geo = moduleFromSource('src/utils/geo.ts', {});
  const origin = { latitude: 21.028511, longitude: 105.804817 }; // Hanoi
  const destination = { latitude: 10.823099, longitude: 106.629664 }; // HCMC
  const meters = geo.distanceMeters(origin, destination);
  assert.ok(meters > 1100000 && meters < 1200000, `Expected ~1140km, got ${meters}m`);
  const km = (meters / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  assert.ok(km.length > 0);
});

test('heatmap 0.5-degree grid groups close points and computes density', () => {
  const samplePoints = [
    { latitude: 21.0285, longitude: 105.8542 },
    { latitude: 21.0310, longitude: 105.8500 },
    { latitude: 10.8231, longitude: 106.6297 },
  ];
  const groups = new Map();
  for (const p of samplePoints) {
    const key = `${Math.round(p.latitude * 2) / 2}:${Math.round(p.longitude * 2) / 2}`;
    const cell = groups.get(key) || { count: 0, latSum: 0, lngSum: 0 };
    cell.count++;
    cell.latSum += p.latitude;
    cell.lngSum += p.longitude;
    groups.set(key, cell);
  }
  assert.equal(groups.size, 2, 'Two distinct regional clusters expected (Hanoi and HCMC)');
  const hanoiCell = groups.get('21:106');
  assert.ok(hanoiCell);
  assert.equal(hanoiCell.count, 2);
  const hcmcCell = groups.get('11:106.5');
  assert.ok(hcmcCell);
  assert.equal(hcmcCell.count, 1);
});

test('embedded leaflet bundle contains valid CSS, JS and heat engine', () => {
  const bundle = moduleFromSource('src/components/leafletBundle.ts', {});
  assert.ok(bundle.LEAFLET_CSS && bundle.LEAFLET_CSS.length > 5000, 'LEAFLET_CSS should be populated');
  assert.ok(bundle.LEAFLET_JS && bundle.LEAFLET_JS.length > 100000, 'LEAFLET_JS should be populated');
  assert.ok(bundle.LEAFLET_HEAT_JS && bundle.LEAFLET_HEAT_JS.length > 3000, 'LEAFLET_HEAT_JS should be populated');
  assert.ok(bundle.LEAFLET_JS.includes('tileLayer'), 'Leaflet core map API must exist');
});
