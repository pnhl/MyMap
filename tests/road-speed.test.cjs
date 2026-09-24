const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'services', 'roadSpeedLimit.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText;
const serviceModule = new Module(sourcePath, module);
serviceModule.filename = sourcePath;
serviceModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
serviceModule._compile(compiled, sourcePath);

const { inferRoadSpeedContext } = serviceModule.exports;

test('motorbike speed estimates follow built-up and divided-road rules', () => {
  assert.equal(inferRoadSpeedContext({ highway: 'residential' }, 'motorbike').speedLimitKmh, 50);
  assert.equal(inferRoadSpeedContext({ highway: 'residential', divider: 'yes' }, 'motorbike').speedLimitKmh, 60);
  assert.equal(inferRoadSpeedContext({ highway: 'primary', oneway: 'yes', lanes: '2' }, 'motorbike').speedLimitKmh, 70);
  assert.equal(inferRoadSpeedContext({ highway: 'primary' }, 'motorbike').speedLimitKmh, 60);
});

test('posted OSM limits can lower the estimate and motorcycle tags take priority', () => {
  assert.equal(inferRoadSpeedContext({ highway: 'residential', maxspeed: '40' }, 'motorbike').speedLimitKmh, 40);
  assert.equal(
    inferRoadSpeedContext({ highway: 'primary', maxspeed: '80', 'maxspeed:motorcycle': '55' }, 'motorbike').speedLimitKmh,
    55
  );
});
