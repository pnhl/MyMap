const fs=require('node:fs'),crypto=require('node:crypto');
function verify(bundle){
 let previous='0'.repeat(64);
 if(bundle.manifestText!==JSON.stringify(bundle.manifest)||bundle.algorithm!=='ECDSA-P256-SHA256-SPKI-DER'||bundle.manifest.format!=='mymap-proof-v1'||bundle.manifest.algorithm!=='SHA-256')return false;
 for(const record of bundle.chain){const hash=crypto.createHash('sha256').update(previous+'\n'+JSON.stringify(record.point)).digest('hex');if(record.previous!==previous||record.hash!==hash)return false;previous=hash;}
 if(bundle.manifest.root!==previous||bundle.manifest.count!==bundle.chain.length)return false;
 return crypto.verify('sha256',Buffer.from(bundle.manifestText),crypto.createPublicKey({key:Buffer.from(bundle.publicKey,'base64'),type:'spki',format:'der'}),Buffer.from(bundle.signature,'base64'));
}
module.exports={verify};
if(require.main===module){try{if(!process.argv[2])throw new Error('Usage: node scripts/verify-location-proof.cjs <proof.json>');const ok=verify(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log(ok?'Valid signature and hash chain':'Invalid proof');process.exitCode=ok?0:1;}catch(e){console.error(e.message);process.exitCode=1;}}
