// Install the pinned Android runtime without downloading iOS artifacts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{spawnSync}=require('node:child_process'),{Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
const root=path.resolve(__dirname,'..'),pkg=path.join(root,'node_modules','llama.rn');
const VERSION='0.12.9',SHA='cda945a7c0ed075a0b028c1c3c6f5b668532eb18b069ecc4793ed7ca6cdb65ac';
const target=path.join(pkg,'android/src/main/jniLibs'),marker=path.join(target,'.llama-rn.sha256');
function tar(args){const result=spawnSync('tar',args,{encoding:'utf8',maxBuffer:8*1024*1024});if(result.status!==0)throw Error(result.stderr||'tar failed');return result.stdout;}
async function main(){
 const installed=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'),'utf8'));if(installed.version!==VERSION)throw Error('Review the pinned Android artifact before upgrading llama.rn.');
 const manifest=JSON.parse(fs.readFileSync(path.join(pkg,'install/native-artifacts.json'),'utf8')).artifacts.find(a=>a.name==='android-jni-libs');if(manifest.sha256!==SHA)throw Error('Android artifact manifest checksum changed.');
 if(fs.existsSync(marker)&&fs.readFileSync(marker,'utf8').trim()===SHA&&['arm64-v8a','x86_64'].every(abi=>fs.existsSync(path.join(target,abi,'librnllama.so')))){console.log('Android AI runtime verified; iOS download skipped.');return;}
 const temp=path.join(root,'.local');fs.mkdirSync(temp,{recursive:true});const archive=path.join(temp,'llama-rn-android-'+crypto.randomUUID()+'.tar.gz');
 try{
  const response=await fetch(`https://github.com/mybigday/llama.rn/releases/download/v${VERSION}/llama-rn-android-jni-libs.tar.gz`,{signal:AbortSignal.timeout(300000)});if(!response.ok||!response.body)throw Error('Unable to download the Android AI runtime.');
  await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(archive,{flags:'wx'}));
  const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(archive))hash.update(chunk);if(hash.digest('hex')!==SHA)throw Error('Android AI runtime checksum mismatch.');
  const names=tar(['-tzf',archive]).trim().split(/\r?\n/);
  const allowed='android/src/main/jniLibs';for(const name of names){const clean=name.replace(/^\.\//,'').replace(/\/$/,'');if(clean.includes('..')||clean.includes('\\')||(!clean.startsWith(allowed+'/')&&!allowed.startsWith(clean+'/')&&clean!==allowed))throw Error('Unexpected archive path.');}
  if(tar(['-tvzf',archive]).trim().split(/\r?\n/).some(line=>!['-','d'].includes(line[0])))throw Error('Archive links are not allowed.');
  tar(['-xzf',archive,'-C',pkg]);fs.writeFileSync(marker,SHA+'\n');console.log('Android AI runtime installed and checksum verified; iOS download skipped.');
 }finally{fs.rmSync(archive,{force:true});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
