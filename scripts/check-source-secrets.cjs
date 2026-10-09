const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/AIza[0-9A-Za-z_-]{30,}/,/\b(?:ghp_|gho_|github_pat_|sb_secret_)[0-9A-Za-z_]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\b/];
let bad=false;
for(const name of new Set(names)){
 if(!fs.existsSync(name)||!fs.statSync(name).isFile()||fs.statSync(name).size>2_000_000)continue;
 const source=fs.readFileSync(name,'utf8');if(patterns.some(re=>re.test(source))){console.error('Credential-like literal: '+name);bad=true;}
}
if(bad)process.exitCode=1;else console.log('Source credential scan passed; values were not printed.');
