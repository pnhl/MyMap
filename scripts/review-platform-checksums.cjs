// Maintenance only. Review this pinned tool version and HTTPS origins before
// committing the generated hashes. Production never downloads/accepts new hashes.
const fs=require('node:fs'),crypto=require('node:crypto');
const version='8.12.0-13700139';
async function main(){
 const records=await Promise.all(['linux','osx','windows'].map(async platform=>{
  const name=`aapt2-${version}-${platform}.jar`,url=`https://dl.google.com/dl/android/maven2/com/android/tools/build/aapt2/${version}/${name}`;
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('Could not verify official AAPT2 download: '+platform);
  return{name,url,sha256:crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')};
 }));
 for(const file of ['config/native-locks/play/verification-metadata.xml','config/native-locks/amazon/verification-metadata.xml','companions/wear/gradle/verification-metadata.xml']){
  let xml=fs.readFileSync(file,'utf8');
  const pattern=new RegExp(`<component group="com.android.tools.build" name="aapt2" version="${version}">([\\s\\S]*?)</component>`);
  if(!pattern.test(xml))throw Error('Resolve the pinned AAPT2 component before review.');
  xml=xml.replace(pattern,(full,body)=>{
   for(const record of records){
    if(body.includes(`name="${record.name}"`)){
     const artifact=body.match(new RegExp(`<artifact name="${record.name.replaceAll('.','\\.')}">([\\s\\S]*?)</artifact>`))[1];
     if(!artifact.includes(record.sha256))throw Error('Official artifact checksum changed: '+record.name);
    }else body+=`         <artifact name="${record.name}">\n            <sha256 value="${record.sha256}" origin="Reviewed official Google Maven tool classifier"/>\n         </artifact>\n`;
   }
   return `<component group="com.android.tools.build" name="aapt2" version="${version}">${body}</component>`;
  });fs.writeFileSync(file,xml);
 }
 fs.writeFileSync('config/native-locks/tool-origins.json',JSON.stringify({version,records},null,2)+'\n');
 console.log('Reviewed official AAPT2 classifier checksums for Linux/macOS/Windows.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
