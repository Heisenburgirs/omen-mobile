param(
  # Play Console rejects a versionCode it has seen; bump this for every upload.
  [int]$BuildNumber = 1,
  [string]$ApiUrl = 'https://www.getomen.xyz',
  [string]$SiteUrl = 'https://www.getomen.xyz',
  # Privy app client for the production mobile app (Allowed app identifier
  # com.omen.myapp, URL scheme omen). .env holds the development client, which
  # production must never ship with.
  [string]$PrivyClientId = $env:OMEN_PRIVY_PRODUCTION_CLIENT_ID
)
# Production build of OMEN for Android: package com.omen.myapp, signed with
# the upload key from E:\OMEN\keys, pointed at the production backend.
# Produces an APK (sideload onto a phone) and an AAB (Play Console upload)
# under E:\OMEN\releases\<version>-<build>\.
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$node = (Get-Command node -ErrorAction Stop).Source
$env:PATH = (Split-Path -Parent $node) + ';' + $env:PATH
$runtimeConfig = Join-Path $project '.local\android-runtime.json'
$runtime = $null
if (Test-Path -LiteralPath $runtimeConfig) { $runtime = Get-Content -LiteralPath $runtimeConfig -Raw | ConvertFrom-Json }
if ($runtime.root) {
  $runtimeRoot = [System.IO.Path]::GetFullPath($runtime.root)
  $env:ANDROID_HOME = Join-Path $runtimeRoot 'sdk'
  $env:ANDROID_USER_HOME = Join-Path $runtimeRoot 'user'
} else {
  $env:ANDROID_HOME = Join-Path $project '.local\android-sdk'
  $env:ANDROID_USER_HOME = Join-Path $project '.local\android-user'
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $project '.local\gradle'
if (!$env:JAVA_HOME -or !(Test-Path -LiteralPath $env:JAVA_HOME)) { $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent (Get-Command java).Source) }
$signing = if ($env:OMEN_RELEASE_SIGNING) { $env:OMEN_RELEASE_SIGNING } else { 'E:\OMEN\keys\release.properties' }
if (!(Test-Path -LiteralPath $signing)) { throw "Upload key properties not found at $signing. Generate the keystore first." }

# Production identity and endpoints. EXPO_PUBLIC_ values are baked into the bundle.
$env:NODE_ENV = 'production'
$env:APP_VARIANT = 'production'
$env:OMEN_BUILD_NUMBER = "$BuildNumber"
$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:EXPO_PUBLIC_SITE_URL = $SiteUrl
if (!$PrivyClientId) { throw 'Pass -PrivyClientId <production mobile app client id> or set OMEN_PRIVY_PRODUCTION_CLIENT_ID; the .env client is the development one.' }
$env:EXPO_PUBLIC_PRIVY_CLIENT_ID = $PrivyClientId
$env:NODE_OPTIONS = ($env:NODE_OPTIONS + ' --dns-result-order=ipv4first').Trim()

function Stop-GradleDaemons {
  # A daemon left by a development build keeps that build's environment and
  # holds files under android\build open: Expo's autolinking step would then
  # generate code for the development package again.
  $gradlew = Join-Path $project 'android\gradlew.bat'
  if (Test-Path -LiteralPath $gradlew) {
    Push-Location (Join-Path $project 'android')
    try { & .\gradlew.bat --stop | Out-Null } finally { Pop-Location }
  }
}
function Remove-StaleBuild {
  foreach ($stale in @('android\build', 'android\app\build', 'android\.gradle')) {
    $path = Join-Path $project $stale
    if (Test-Path -LiteralPath $path) { Remove-Item -Recurse -Force -LiteralPath $path }
  }
}

Stop-GradleDaemons
Remove-StaleBuild
Write-Host "Generating the production Android project (build $BuildNumber, API $ApiUrl)..."
# A clean generation: switching the package id inside a reused project leaves
# generated code under the old package and the release compile fails.
& $node (Join-Path $project 'node_modules\expo\bin\cli') prebuild --platform android --no-install --clean
if ($LASTEXITCODE -ne 0) { throw 'Native project generation failed.' }
$gradle = Get-Content -LiteralPath (Join-Path $project 'android\app\build.gradle') -Raw
if ($gradle -notmatch 'omen-release-signing') { throw 'The release signing plugin did not apply; check plugins/with-release-signing.js.' }
if ($gradle -notmatch 'applicationId\s+''com\.omen\.myapp''') { throw 'The generated project is not the production package.' }

Push-Location (Join-Path $project 'android')
try {
  & .\gradlew.bat app:assembleRelease app:bundleRelease --console=plain --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
} finally { Pop-Location }

$version = (Select-String -Path (Join-Path $project 'android\app\build.gradle') -Pattern 'versionName\s+"([^"]+)"').Matches[0].Groups[1].Value
$out = "E:\OMEN\releases\$version-$BuildNumber"
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'android\app\build\outputs\apk\release\app-release.apk') -Destination (Join-Path $out 'omen-release.apk') -Force
Copy-Item -LiteralPath (Join-Path $project 'android\app\build\outputs\bundle\release\app-release.aab') -Destination (Join-Path $out 'omen-release.aab') -Force
$apksigner = Get-ChildItem -Path (Join-Path $env:ANDROID_HOME 'build-tools') -Filter apksigner.bat -Recurse | Sort-Object FullName -Descending | Select-Object -First 1
if ($apksigner) {
  Write-Host 'Signer:'
  & $apksigner.FullName verify --print-certs (Join-Path $out 'omen-release.apk') | Select-String 'SHA-256'
}
Write-Host "Release $version ($BuildNumber) written to $out"
Write-Host ' - omen-release.apk  install on a phone: adb install -r omen-release.apk'
Write-Host ' - omen-release.aab  upload to Play Console (internal testing)'

# Leave a clean development project behind for scripts/android.ps1 (its next
# build recompiles the native side once).
Stop-GradleDaemons
Remove-StaleBuild
$env:APP_VARIANT = 'local-preview'
& $node (Join-Path $project 'node_modules\expo\bin\cli') prebuild --platform android --no-install --clean | Out-Null
