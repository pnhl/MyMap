const {spawnSync}=require('node:child_process');
const script=process.env.EAS_BUILD_PLATFORM==='ios'?'scripts/prepare-ios-ai.cjs':'scripts/prepare-android-ai.cjs';
for(const file of [script,...(process.env.EAS_BUILD_PLATFORM==='android'?['scripts/patch-android-dependencies.cjs']:[])]){
 const r=spawnSync(process.execPath,[file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
