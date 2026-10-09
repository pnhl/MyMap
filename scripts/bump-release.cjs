const fs=require('node:fs');
const r=JSON.parse(fs.readFileSync('release.json'));r.build++;
const version=process.argv[2];if(version){if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Use semantic version x.y.z.');r.version=version;}
const app=JSON.parse(fs.readFileSync('app.json'));app.expo.version=r.version;app.expo.ios.buildNumber=String(r.build);app.expo.android.versionCode=r.build;
for(const filename of ['package.json','package-lock.json']){const p=JSON.parse(fs.readFileSync(filename));p.version=r.version;if(p.packages?.[''])p.packages[''].version=r.version;fs.writeFileSync(filename,JSON.stringify(p,null,2)+'\n');}
fs.writeFileSync('release.json',JSON.stringify(r,null,2)+'\n');fs.writeFileSync('app.json',JSON.stringify(app,null,2)+'\n');console.log(`Version ${r.version}, all stores build ${r.build}.`);
