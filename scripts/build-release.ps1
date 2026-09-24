param([string]$JavaHome = $env:JAVA_HOME)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
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
Push-Location (Join-Path $projectRoot 'android')
try {
    & ./gradlew.bat :app:assembleRelease --console=plain --max-workers=2
    if ($LASTEXITCODE -ne 0) { throw "Release build failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}
$version = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$releaseDir = Join-Path $projectRoot 'dist/releases'
New-Item -ItemType Directory -Force $releaseDir | Out-Null
$apk = Join-Path $releaseDir "MyMap-$version-release.apk"
Copy-Item -LiteralPath (Join-Path $projectRoot 'android/app/build/outputs/apk/release/app-release.apk') -Destination $apk
(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash | Set-Content "$apk.sha256"
Write-Output "Release APK: $apk"
