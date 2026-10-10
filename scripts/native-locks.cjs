const fs=require('node:fs'),path=require('node:path');
function paths(platform,store=process.env.APP_STORE_TARGET||process.env.MYMAP_STORE){
 if(platform==='ios')return [['config/native-locks/ios/Podfile.lock','ios/Podfile.lock']];
 if(!['play','amazon'].includes(store))throw Error('Native lock needs play or amazon store.');
 return [[`config/native-locks/${store}/app.lockfile`,'android/app/gradle.lockfile'],[`config/native-locks/${store}/verification-metadata.xml`,'android/gradle/verification-metadata.xml']];
}
function sync(mode,platform,store){for(const [saved,generated]of paths(platform,store)){
 const [input,output]=mode==='capture'?[generated,saved]:[saved,generated];
 if(!fs.existsSync(input))throw Error('Missing reviewed native dependency lock: '+input);
 if(mode!=='check'){fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(input,output);}
}}
if(require.main===module){try{const [mode,platform,store]=process.argv.slice(2);if(!['capture','restore','check'].includes(mode))throw Error('Choose capture, restore or check.');sync(mode,platform,store);}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={sync};
