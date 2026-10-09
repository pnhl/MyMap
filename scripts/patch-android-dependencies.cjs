// AGP 9: Invertase's shared plugin does not eagerly create the Android extension.
// Apply the library plugin before RN Firebase/AdMob configure android{}.
const fs=require('node:fs');
for(const name of ['@react-native-firebase/app','@react-native-firebase/auth','react-native-google-mobile-ads']){
 const file=`node_modules/${name}/android/build.gradle`;
 let source=fs.readFileSync(file,'utf8');
 if(!source.includes("apply plugin: 'com.android.library'")){
  const marker=/plugins\s*\{[^}]+\}/m;
  if(!marker.test(source))throw Error('Cannot patch '+name);
  source=source.replace(marker,match=>match+"\n\napply plugin: 'com.android.library'\n");
  fs.writeFileSync(file,source);
 }
}
const nativeFile='node_modules/react-native-google-mobile-ads/android/src/main/java/io/invertase/googlemobileads/ReactNativeGoogleMobileAdsNativeModule.kt';
const {patchNativeAdFailures}=require('./native-ad-patch.cjs');
const nativeSource=fs.readFileSync(nativeFile,'utf8');
const patchedNative=patchNativeAdFailures(nativeSource);
if(patchedNative!==nativeSource)fs.writeFileSync(nativeFile,patchedNative);

// On Windows CMake shortens clang++.exe to CLANG_~1.EXE. The driver then
// omits its implicit C++ runtime at link time. Link the same shared STL
// requested by Expo/RN explicitly, instead of mixing in a static runtime.
const expoCmake='node_modules/expo-modules-core/android/CMakeLists.txt';
const expoSource=fs.readFileSync(expoCmake,'utf8');
if(!expoSource.includes('# MyMap Windows shared STL'))fs.writeFileSync(expoCmake,expoSource+'\n# MyMap Windows shared STL\nif(CMAKE_HOST_WIN32 AND ANDROID)\n  target_link_libraries(expo-modules-core PRIVATE c++_shared)\nendif()\n');
