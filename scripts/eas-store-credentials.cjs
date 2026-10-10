const fs=require('node:fs'),path=require('node:path');
function withStoreCredentials(store,work,root=process.cwd()){
 if(!['play','amazon'].includes(store))throw Error('Choose signing store.');
 const input=path.join(root,'.signing',store,'eas-credentials.json'),output=path.join(root,'credentials.json');
 if(fs.existsSync(output))throw Error('Preserve credentials.json in the intended .signing/<store>/ folder before building.');
 if(!fs.existsSync(input))throw Error('Missing private EAS credentials file for '+store+'.');
 const data=fs.readFileSync(input),value=JSON.parse(data),key=value.android?.keystore;
 if(!key||['keystorePath','keystorePassword','keyAlias','keyPassword'].some(k=>typeof key[k]!=='string'||!key[k]))throw Error('Invalid private EAS credential schema for '+store+'.');
 if(!fs.existsSync(path.resolve(root,key.keystorePath)))throw Error('Missing EAS keystore for '+store+'.');
 fs.writeFileSync(output,data,{flag:'wx',mode:0o600});
 try{return work();}finally{fs.unlinkSync(output);}
}
module.exports={withStoreCredentials};
