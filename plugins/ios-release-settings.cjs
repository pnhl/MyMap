module.exports=function enforceRelease(project,version,build){
 for(const entry of Object.values(project.pbxXCBuildConfigurationSection())){
  if(!entry||typeof entry!=='object'||String(entry.name).replaceAll('"','')!=='Release'||!entry.buildSettings)continue;
  Object.assign(entry.buildSettings,{ENABLE_DEBUG_DYLIB:'NO',ENABLE_PREVIEWS:'NO',SWIFT_OPTIMIZATION_LEVEL:'"-O"',SWIFT_COMPILATION_MODE:'wholemodule',COPY_PHASE_STRIP:'YES',CURRENT_PROJECT_VERSION:String(build),MARKETING_VERSION:version});
 }
};
