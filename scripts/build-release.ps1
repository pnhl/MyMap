param([string]$JavaHome=$env:JAVA_HOME,[ValidateSet('android','amazon','both')][string]$Channel='both',[string]$Architectures='armeabi-v7a,arm64-v8a',[string]$OutputDirectory='dist/releases',[switch]$TestAds,[ValidateRange(1,8)][int]$MaxWorkers=2)
$ErrorActionPreference='Stop'
if($TestAds){throw 'Store releases cannot use test ads. Use the EAS development profile for ad previews.'}
if($OutputDirectory -ne 'dist/releases'){throw 'Release artifacts use dist/releases/build-N so provenance cannot be mixed.'}
$stores=if($Channel -eq 'both'){@('play','amazon')}elseif($Channel -eq 'android'){@('play')}else{@('amazon')}
foreach($store in $stores){
 & (Join-Path $PSScriptRoot 'build-android-store.ps1') -Store $store -JavaHome $JavaHome -Architectures $Architectures -MaxWorkers $MaxWorkers
}
