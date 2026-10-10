const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function releaseInputs(env=process.env){
 const commit=env.MYMAP_RELEASE_COMMIT||env.EAS_BUILD_GIT_COMMIT_HASH||env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Release requires a full source commit SHA.');
 const names=[...new Set(fs.readFileSync('src/config/env.ts','utf8').match(/EXPO_PUBLIC_[A-Z0-9_]+/g)||[])].sort();
 const publicConfig=Object.fromEntries(names.map(n=>[n,env[n]?.trim()||'']));
 const flags={carPlay:env.MYMAP_ENABLE_CARPLAY==='true',watch:env.MYMAP_ENABLE_WATCH!=='false',widgets:env.MYMAP_ENABLE_WIDGETS!=='false',amazonAds:false,adm:env.MYMAP_ENABLE_ADM==='true',testAds:env.EXPO_PUBLIC_ENABLE_TEST_ADS==='true'};
 const inputs={schema:1,...JSON.parse(fs.readFileSync('release.json')),commit,lockfileSha256:sha(fs.readFileSync('package-lock.json')),flags,publicConfigFingerprint:sha(JSON.stringify({publicConfig,admob:JSON.parse(fs.readFileSync('config/admob.json'))}))};
 return {...inputs,inputsFingerprint:sha(JSON.stringify(inputs))};
}
if(require.main===module){const out=process.argv[2];const value=releaseInputs();if(out){fs.mkdirSync(require('node:path').dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(value,null,2));}else console.log(JSON.stringify(value,null,2));}
module.exports={releaseInputs};
