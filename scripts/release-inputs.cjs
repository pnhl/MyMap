const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function releaseInputs(env=process.env){
 require('./provider-secret-policy.cjs').assertPublicEnvironment(env);
 const commit=env.MYMAP_RELEASE_COMMIT||env.EAS_BUILD_GIT_COMMIT_HASH||env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Release requires a full source commit SHA.');
 const sourceFiles=['app.config.ts'];
 function walk(dir){if(!fs.existsSync(dir))return;for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=require('node:path').join(dir,item.name);if(item.isDirectory())walk(file);else if(/\.[jt]sx?$/.test(file))sourceFiles.push(file);}}
 walk('src');
 const names=[...new Set(sourceFiles.filter(f=>fs.existsSync(f)).flatMap(f=>fs.readFileSync(f,'utf8').match(/EXPO_PUBLIC_[A-Z0-9_]+/g)||[]))].sort();
 const publicConfig=Object.fromEntries(names.map(n=>[n,env[n]?.trim()||'']));
 if(env.MYMAP_RELEASE==='true')for(const [name,value]of Object.entries(publicConfig)){
  if(!/URL|ENDPOINT/.test(name)||!value)continue;
  try{const url=new URL(value);if(['localhost','10.0.2.2','0.0.0.0','127.0.0.1'].includes(url.hostname)&&!/SPOTUBE/.test(name))throw Error('dev');}catch{throw Error('Invalid production endpoint configuration: '+name);}
 }
 const flags={carPlay:env.MYMAP_ENABLE_CARPLAY==='true',watch:env.MYMAP_ENABLE_WATCH!=='false',widgets:env.MYMAP_ENABLE_WIDGETS!=='false',amazonAds:false,adm:env.MYMAP_ENABLE_ADM==='true',testAds:env.EXPO_PUBLIC_ENABLE_TEST_ADS==='true'};
 const inputs={schema:1,...JSON.parse(fs.readFileSync('release.json')),commit,lockfileSha256:sha(fs.readFileSync('package-lock.json')),flags,publicConfigFingerprint:sha(JSON.stringify({publicConfig,admob:JSON.parse(fs.readFileSync('config/admob.json'))}))};
 return {...inputs,inputsFingerprint:sha(JSON.stringify(inputs))};
}
if(require.main===module){const out=process.argv[2];const value=releaseInputs();if(out){fs.mkdirSync(require('node:path').dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(value,null,2));}else console.log(JSON.stringify(value,null,2));}
module.exports={releaseInputs};
