// Provider credentials belong to the Worker. Errors contain names only.
const fs = require('node:fs');
const path = require('node:path');
const {parseEnv} = require('node:util');
const forbiddenPublicNames = Object.freeze([
  'EXPO_PUBLIC_STADIA_MAPS_API_KEY', 'EXPO_PUBLIC_TOMTOM_TRAFFIC_KEY',
  'EXPO_PUBLIC_MAPILLARY_ACCESS_TOKEN', 'EXPO_PUBLIC_GRAPHHOPPER_KEY',
  'EXPO_PUBLIC_CESIUM_ION_TOKEN',
]);
function assertPublicEnvironment(env) {
  // Test names before accessing any value, including empty obsolete variables.
  for (const name of Object.keys(env)) {
    if (!name.startsWith('EXPO_PUBLIC_')) continue;
    if (forbiddenPublicNames.includes(name) || /(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|API_KEY|ION_TOKEN|TRAFFIC_KEY|GRAPHHOPPER_KEY)(?:_|$)/.test(name))
      throw Error('Server credential is forbidden in public configuration: '+name);
  }
  for (const name of Object.keys(env)) {
    if (!name.startsWith('EXPO_PUBLIC_') || !/(?:URL|URI|ENDPOINT)(?:_|$)/.test(name) || !env[name]) continue;
    const value=String(env[name]);
    let url;
    try { url=new URL(value); } catch { throw Error('Invalid public endpoint: '+name); }
    if (url.username || url.password || [...url.searchParams.keys()].some(key=>/^(?:api[-_]?key|key|token|access[-_]?token|client[-_]?secret|authorization|signature|sig)$/i.test(key)))
      throw Error('Credential-bearing URL is forbidden in public configuration: '+name);
    if (name==='EXPO_PUBLIC_ROUTING_GATEWAY_URL' && (url.protocol!=='https:' || url.search || url.hash))
      throw Error('Gateway requires an HTTPS base URL without query or fragment: '+name);
  }
}
function validatePublicEnvText(source) {
  const parsed=parseEnv(source);
  for(const name of Object.keys(parsed)) if(!name.startsWith('EXPO_PUBLIC_'))
    throw Error('CI mobile environment must contain public variables only: '+name);
  assertPublicEnvironment(parsed);
  return source;
}
function checkPublicSources(root=path.resolve(__dirname,'..')) {
  const files=['app.config.ts','.env.example'];
  function walk(dir) { for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
    const file=path.join(dir,item.name);
    if(item.isDirectory())walk(file); else if(/\.[jt]sx?$/.test(file))files.push(file);
  }}
  walk('src');
  for(const file of files) {
    const source=fs.readFileSync(path.join(root,file),'utf8');
    for(const name of source.match(/EXPO_PUBLIC_[A-Z0-9_]+/g)||[])
      assertPublicEnvironment({[name]:''});
  }
  console.log('Public configuration contains no server credential variables.');
}
if(require.main===module)try{checkPublicSources();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={forbiddenPublicNames,assertPublicEnvironment,validatePublicEnvText,checkPublicSources};
