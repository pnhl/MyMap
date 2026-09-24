param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$signingDirectory = Join-Path $projectRoot '.signing'
$keystorePath = Join-Path $signingDirectory 'mymap-release.p12'
$propertiesPath = Join-Path $signingDirectory 'release.properties'

if ((Test-Path -LiteralPath $keystorePath) -and (Test-Path -LiteralPath $propertiesPath)) {
  Write-Output 'Release signing files already exist.'
  exit 0
}
if ((Test-Path -LiteralPath $keystorePath) -or (Test-Path -LiteralPath $propertiesPath)) {
  throw 'Release signing is incomplete. Restore both files in .signing before continuing.'
}

$keytoolCandidates = @(
  $(if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin\keytool.exe' }),
  'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$keytool = $keytoolCandidates | Select-Object -First 1
if (-not $keytool) {
  throw 'Không tìm thấy keytool. Hãy cài Android Studio/JDK hoặc đặt JAVA_HOME.'
}

[System.IO.Directory]::CreateDirectory($signingDirectory) | Out-Null
$randomBytes = [byte[]]::new(36)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
$password = [Convert]::ToBase64String($randomBytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
$env:MYMAP_KEYSTORE_PASSWORD = $password
try {
  & $keytool -genkeypair -v `
    -keystore $keystorePath `
    -storetype PKCS12 `
    -storepass:env MYMAP_KEYSTORE_PASSWORD `
    -keypass:env MYMAP_KEYSTORE_PASSWORD `
    -alias mymap-release `
    -keyalg RSA `
    -keysize 4096 `
    -sigalg SHA256withRSA `
    -validity 10000 `
    -dname 'CN=MyMap Release, OU=Mobile, O=MyMap, L=Ho Chi Minh City, ST=Ho Chi Minh, C=VN'
  if ($LASTEXITCODE -ne 0) {
    throw "keytool failed with exit code $LASTEXITCODE"
  }

  $properties = @(
    "storePassword=$password",
    'storeFile=../../.signing/mymap-release.p12',
    'keyAlias=mymap-release',
    "keyPassword=$password"
  ) -join [Environment]::NewLine
  [System.IO.File]::WriteAllText($propertiesPath, $properties + [Environment]::NewLine)
} finally {
  Remove-Item Env:MYMAP_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
}

Write-Output "Created release keystore: $keystorePath"
Write-Output "Created local signing properties: $propertiesPath"
Write-Output 'Back up both files securely before publishing.'
