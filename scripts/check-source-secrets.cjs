const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/AIza[0-9A-Za-z_-]{30,}/,/\b(?:ghp_|gho_|github_pat_|sb_secret_)[0-9A-Za-z_]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\b/];
let bad=false;
for(const name of new Set(names)){
 if(!fs.existsSync(name)||!fs.statSync(name).isFile()||fs.statSync(name).size>2_000_000)continue;
 const source=fs.readFileSync(name,'utf8');if(patterns.some(re=>re.test(source))){console.error('Credential-like literal: '+name);bad=true;}
}
if(process.argv.includes('--history')){
 const entries=execFileSync('git',['rev-list','--objects','--max-count=30','HEAD'],{encoding:'utf8',maxBuffer:32*1024*1024}).trim().split('\n');
 let count=0;
 for(const entry of entries){const split=entry.indexOf(' ');if(split<0)continue;const oid=entry.slice(0,split),name=entry.slice(split+1);
  if(!/\.(?:[cm]?js|tsx?|json|ya?ml|md|sql|swift|kt|gradle|properties|xml|plist|txt|env)$|(?:^|\/)\.env/.test(name))continue;
  if(execFileSync('git',['cat-file','-t',oid],{encoding:'utf8'}).trim()!=='blob')continue;
  const size=Number(execFileSync('git',['cat-file','-s',oid],{encoding:'utf8'}));if(size>2_000_000)continue;
  const source=execFileSync('git',['cat-file','blob',oid],{encoding:'utf8',maxBuffer:2_100_000});count++;
  if(patterns.some(re=>re.test(source))){console.error('Credential-like historical literal: '+name);bad=true;}
 }console.log('Historical blobs scanned: '+count+'; values were not printed.');
}
if(bad)process.exitCode=1;else console.log('Source credential scan passed; values were not printed.');
