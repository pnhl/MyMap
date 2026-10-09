param([string]$JavaHome = $env:JAVA_HOME, [ValidateSet('android','amazon','both')][string]$Channel='both', [string]$Architectures='armeabi-v7a,arm64-v8a', [string]$OutputDirectory='dist/releases', [switch]$TestAds, [ValidateRange(1,8)][int]$MaxWorkers=1)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testOutput=[IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
if($TestAds -and !$testOutput.StartsWith((Join-Path $projectRoot '.local')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
    throw 'Test ads APKs must stay in the private .local directory.'
}
$env:EXPO_PUBLIC_ENABLE_TEST_ADS = if($TestAds){'true'}else{'false'}
if (!$JavaHome) {
    $JavaHome = Join-Path $env:USERPROFILE '.jdks/jbr-21.0.11'
}
if (!(Test-Path (Join-Path $JavaHome 'bin/java.exe'))) {
    throw 'Set JAVA_HOME or pass -JavaHome with a JDK 21 installation.'
}
if (!(Test-Path (Join-Path $projectRoot '.signing/release.properties'))) {
    throw 'Restore the private .signing folder before building a signed release.'
}
$env:JAVA_HOME = $JavaHome
$env:NODE_ENV = 'production'
# Keep the Java Unix-domain socket path short on Windows.
$buildTemp = Join-Path $env:SystemDrive 'mymap-build-tmp'
New-Item -ItemType Directory -Force $buildTemp | Out-Null
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$buildTemp -Djava.io.tmpdir=$buildTemp"
$env:CMAKE_BUILD_PARALLEL_LEVEL = '3'
& node (Join-Path $projectRoot 'scripts/prepare-android-ai.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the Android AI runtime.' }
& node (Join-Path $projectRoot 'scripts/patch-android-dependencies.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not apply Android dependency compatibility patches.' }
Push-Location (Join-Path $projectRoot 'android')
try {
    [string[]]$tasks = if ($Channel -eq 'both') { @(':app:assembleGoogleRelease', ':app:assembleAmazonRelease') } elseif ($Channel -eq 'android') { @(':app:assembleGoogleRelease') } else { @(':app:assembleAmazonRelease') }
    & ./gradlew.bat @tasks "-PreactNativeArchitectures=$Architectures" '-Pandroid.enableMinifyInReleaseBuilds=true' '-Pandroid.enableShrinkResourcesInReleaseBuilds=true' '-Pexpo.useLegacyPackaging=true' '-Pandroid.enableBundleCompression=true' --console=plain "--max-workers=$MaxWorkers"
    if ($LASTEXITCODE -ne 0) { throw "Release build failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}
$version = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$releaseDir = Join-Path $projectRoot $OutputDirectory
New-Item -ItemType Directory -Force $releaseDir | Out-Null
$channels = if ($Channel -eq 'both') { @('android','amazon') } else { @($Channel) }
foreach ($releaseChannel in $channels) {
    $flavor = if ($releaseChannel -eq 'android') { 'google' } else { 'amazon' }
    $apk = Join-Path $releaseDir "MyMap-$version-$releaseChannel-release.apk"
    Copy-Item -LiteralPath (Join-Path $projectRoot "android/app/build/outputs/apk/$flavor/release/app-$flavor-release.apk") -Destination $apk
    & (Join-Path $PSScriptRoot 'verify-apk-startup.ps1') -ApkPath $apk
    (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash | Set-Content "$apk.sha256"
    Write-Output "Release APK: $apk"
}
