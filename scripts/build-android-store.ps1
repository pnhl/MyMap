param([ValidateSet('play','amazon')][string]$Store='play',[string]$JavaHome=$env:JAVA_HOME,[string]$Architectures='armeabi-v7a,arm64-v8a',[ValidateRange(1,8)][int]$MaxWorkers=2)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
& node scripts/release-check.cjs
if($LASTEXITCODE -ne 0){throw 'Release source validation failed.'}
if(!$JavaHome){$JavaHome=Join-Path $env:USERPROFILE '.jdks/jbr-21.0.11'}
if(!(Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))){throw 'Set JAVA_HOME to JDK 21.'}
if(!(Test-Path -LiteralPath '.signing/release.properties')){throw 'Restore the existing release signing files; never replace the published app signing key.'}
$env:JAVA_HOME=$JavaHome
$env:MYMAP_STORE=$Store
$env:MYMAP_RELEASE='true'
$env:EXPO_PUBLIC_ENABLE_TEST_ADS='false'
$env:RNLLAMA_SKIP_POSTINSTALL='1'
$env:NODE_ENV='production'
$env:CMAKE_BUILD_PARALLEL_LEVEL='3'
$buildTemp=Join-Path $env:SystemDrive 'mymap-build-tmp'
New-Item -ItemType Directory -Force -Path $buildTemp | Out-Null
$env:JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$buildTemp -Djava.io.tmpdir=$buildTemp"
& node scripts/prepare-android-ai.cjs
if($LASTEXITCODE -ne 0){throw 'Android AI preparation failed.'}
& node scripts/patch-android-dependencies.cjs
if($LASTEXITCODE -ne 0){throw 'Dependency patches failed.'}
# CNG owns /android (ignored). A fresh prebuild prevents one store's native SDKs leaking into another.
& npx expo prebuild --platform android --clean --no-install
if($LASTEXITCODE -ne 0){throw 'Android prebuild failed.'}
$tasks=if($Store -eq 'play'){@(':app:assembleGoogleRelease',':app:bundleGoogleRelease')}else{@(':app:assembleAmazonRelease')}
Push-Location -LiteralPath android
try {
 & ./gradlew.bat @tasks "-PreactNativeArchitectures=$Architectures" '-Pandroid.enableMinifyInReleaseBuilds=true' '-Pandroid.enableShrinkResourcesInReleaseBuilds=true' '-Pexpo.useLegacyPackaging=true' '-Pandroid.enableBundleCompression=true' --console=plain "--max-workers=$MaxWorkers"
 if($LASTEXITCODE -ne 0){throw 'Android release build failed.'}
} finally {Pop-Location}
$release=Get-Content -LiteralPath release.json -Raw | ConvertFrom-Json
$output=Join-Path $projectRoot "dist/releases/build-$($release.build)"
New-Item -ItemType Directory -Force -Path $output | Out-Null
$flavor=if($Store -eq 'play'){'google'}else{'amazon'}
$apk=Join-Path $output "MyMap-$($release.version)-$Store.apk"
Copy-Item -LiteralPath "android/app/build/outputs/apk/$flavor/release/app-$flavor-release.apk" -Destination $apk
& python scripts/verify-artifacts.py "--$Store" $apk --commit (git rev-parse HEAD)
if($LASTEXITCODE -ne 0){throw 'APK manifest/signature validation failed.'}
& scripts/verify-apk-startup.ps1 -ApkPath $apk
if($LASTEXITCODE -ne 0){throw 'APK startup validation failed.'}
if($Store -eq 'play'){
 $aab=Join-Path $output "MyMap-$($release.version)-play.aab"
 Copy-Item -LiteralPath android/app/build/outputs/bundle/googleRelease/app-google-release.aab -Destination $aab
 & python scripts/verify-artifacts.py --aab $aab --play $apk --commit (git rev-parse HEAD)
 if($LASTEXITCODE -ne 0){throw 'AAB validation failed; set BUNDLETOOL_JAR.'}
}
Write-Output "Validated release: $output"
