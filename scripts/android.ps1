param([switch]$Rebuild, [switch]$Preview, [switch]$Phone, [string]$ApiUrl, [ValidatePattern('^[A-Za-z0-9_.-]+$')][string]$Avd='Omen_PlayStore')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$node=(Get-Command node -ErrorAction Stop).Source
$env:PATH=(Split-Path -Parent $node)+';'+$env:PATH
# Optional machine-local runtime location keeps emulator disk writes off the source drive.
$runtimeConfig=Join-Path $project '.local\android-runtime.json'
$runtime=$null
if(Test-Path -LiteralPath $runtimeConfig){ $runtime=Get-Content -LiteralPath $runtimeConfig -Raw | ConvertFrom-Json }
if($runtime.root){
  $runtimeRoot=[System.IO.Path]::GetFullPath($runtime.root)
  if(!(Test-Path -LiteralPath $runtimeRoot)){throw "Android runtime drive is unavailable: $runtimeRoot"}
  $env:ANDROID_HOME=Join-Path $runtimeRoot 'sdk'
  $env:ANDROID_USER_HOME=Join-Path $runtimeRoot 'user'
  $env:ANDROID_AVD_HOME=Join-Path $runtimeRoot 'avd'
  $runtimeLogs=Join-Path $runtimeRoot 'logs'
}else{
  $env:ANDROID_HOME=Join-Path $project '.local\android-sdk'
  $env:ANDROID_USER_HOME=Join-Path $project '.local\android-user'
  $env:ANDROID_AVD_HOME=Join-Path $project '.local\avd'
  $runtimeLogs=Join-Path $project '.local'
}
New-Item -ItemType Directory -Path $runtimeLogs -Force | Out-Null
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:GRADLE_USER_HOME=Join-Path $project '.local\gradle'
$env:NODE_ENV=if($Preview){'production'}else{'development'}
$env:APP_VARIANT=if($Preview){'local-preview'}else{'development'}
# The API the build talks to. Development builds reach this PC through adb
# reverse (127.0.0.1 from .env). A bundled preview on a phone cannot rely on
# adb once the app is installed, so it targets this PC's LAN address instead;
# rebuild if that address changes. -ApiUrl overrides either.
if($ApiUrl){
  $env:EXPO_PUBLIC_API_URL=$ApiUrl
}elseif($Phone -and $Preview){
  $route=Get-NetRoute -DestinationPrefix '0.0.0.0/0' -AddressFamily IPv4 | Sort-Object RouteMetric,InterfaceMetric | Select-Object -First 1
  $lanIp=(Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
  if(!$lanIp){throw 'Could not find this PC''s LAN address; pass -ApiUrl http://<pc-ip>:3100.'}
  $env:EXPO_PUBLIC_API_URL="http://${lanIp}:3100"
}
if($env:EXPO_PUBLIC_API_URL){Write-Host "API for this build: $env:EXPO_PUBLIC_API_URL"}
$env:NODE_OPTIONS=($env:NODE_OPTIONS+' --dns-result-order=ipv4first').Trim()
# Development builds always use the debug key so the installed app updates in
# place; the upload key is only for scripts/release.ps1.
$env:OMEN_RELEASE_SIGNING=Join-Path $project '.local\no-release-signing.properties'
if (!$env:JAVA_HOME -or !(Test-Path -LiteralPath $env:JAVA_HOME)) { $env:JAVA_HOME=Split-Path -Parent (Split-Path -Parent (Get-Command java).Source) }
$adb=Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (!(Test-Path -LiteralPath $adb)) { throw 'Android SDK missing. See README.md for local setup.' }
if (!(Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
$processFile=Join-Path $project '.local\processes.json'
$owned=@()
if(Test-Path -LiteralPath $processFile){ $owned=@(Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json | ForEach-Object { $_ }) }
function Start-OmenNode($Arguments,$Label) {
  $process=Start-Process -FilePath $node -ArgumentList $Arguments -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeLogs "$Label.log") -RedirectStandardError (Join-Path $runtimeLogs "$Label-error.log") -PassThru
  $script:owned+=@{id=$process.Id;label=$Label}
  $script:owned | ConvertTo-Json | Set-Content -LiteralPath $processFile
  return $process
}
function Wait-OmenUrl($Url,$Expected,$Seconds=45) {
  for($i=0;$i -lt $Seconds;$i++) {
    try { $result=Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2; $body=$result.Content; if($body -is [byte[]]){$body=[System.Text.Encoding]::UTF8.GetString($body)}; if($body -match $Expected){return} } catch {}
    Start-Sleep -Seconds 1
  }
  throw "Service did not start at $Url. Check the Android runtime logs."
}
$serial=$null
function Find-Phone {
  # First non-emulator device (USB or Wi-Fi) that has authorised this computer.
  # A Wi-Fi phone drops off adb when it sleeps; reconnect it through mDNS.
  for($attempt=0;$attempt -lt 2;$attempt++){
    foreach($line in (& $adb devices)) {
      if($line -match '^(\S+)\s+device$' -and $Matches[1] -notlike 'emulator-*'){return $Matches[1]}
    }
    $wifi=(& $adb mdns services 2>$null) | Where-Object { $_ -match '_adb-tls-connect\._tcp\s+(\S+)$' } | ForEach-Object { $Matches[1] } | Select-Object -First 1
    if(!$wifi){break}
    & $adb connect $wifi | Out-Null
    Start-Sleep -Seconds 2
  }
  return $null
}
if($Phone){
  $serial=Find-Phone
  if(!$serial){throw 'No phone found. Plug it in over USB with USB debugging on, or turn on Wireless debugging (paired once with "adb pair"), then rerun with -Phone.'}
  Write-Host "Using phone $serial"
}
if(!$Phone){
foreach($line in (& $adb devices)) {
  if($line -match '^emulator-5560\s+offline') {
    throw 'The OMEN emulator is offline. Close that emulator before reopening it; another copy will not be started.'
  }
  if($line -match '^(emulator-\d+)\s+device') {
    $candidate=$Matches[1]
    if((& $adb -s $candidate emu avd name) -contains $Avd){$serial=$candidate;break}
  }
}
if(!$serial){
  if ((& $adb devices) -match '^emulator-5560\s+') {
    throw 'Another emulator is using the OMEN port. Close it before launching the selected OMEN emulator.'
  }
  if (!(Test-Path -LiteralPath (Join-Path $env:ANDROID_AVD_HOME ($Avd+'.ini')))) {
    throw "The $Avd emulator is missing. See README.md for the Google Play image setup."
  }
  Write-Host "Opening the $Avd Android emulator..."
  Start-Process -FilePath "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList '-avd',$Avd,'-port','5560','-no-audio','-gpu','host','-feature','-Vulkan','-memory','4096' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeLogs 'emulator.log') -RedirectStandardError (Join-Path $runtimeLogs 'emulator-error.log')
  $serial='emulator-5560'
  $booted=$false
  for($i=0;$i -lt 180;$i++){
    # Listing devices succeeds while the new emulator is still registering.
    $connected=(& $adb devices) -match "^$serial\s+device"
    if($connected -and ((& $adb -s $serial shell getprop sys.boot_completed) -join '').Trim() -eq '1'){$booted=$true;break}
    Start-Sleep -Seconds 2
  }
  if(!$booted){throw 'Emulator did not finish booting. Check emulator.log in the Android runtime logs.'}
}
}
$buildType=if($Preview){'release'}else{'debug'}
$apk=Join-Path $project "android\app\build\outputs\apk\$buildType\app-$buildType.apk"
# Emulator builds are x86_64 only; a phone needs arm64, so a phone build carries both.
$arch=if($Phone){'arm64-v8a,x86_64'}else{'x86_64'}
$archFile=Join-Path $project ".local/apk-architectures-$buildType.txt"
$hasArm=(Test-Path -LiteralPath $archFile) -and ((Get-Content -LiteralPath $archFile -Raw) -match 'arm64-v8a')
# A preview bakes the JavaScript into the APK, so every preview run rebuilds.
if($Rebuild -or $Preview -or !(Test-Path -LiteralPath $apk) -or ($Phone -and !$hasArm)){
  & $node (Join-Path $project 'node_modules\expo\bin\cli') prebuild --platform android --no-install --no-clean
  if($LASTEXITCODE -ne 0){throw 'Native project generation failed.'}
  Push-Location android
  $task=if($Preview){'app:assembleRelease'}else{'app:assembleDebug'}
  try { & .\gradlew.bat $task "-PreactNativeArchitectures=$arch" --max-workers=1 --console=plain; if($LASTEXITCODE -ne 0){throw 'Android build failed.'}; Set-Content -LiteralPath $archFile -Value $arch } finally { Pop-Location }
}
# A build can take long enough for a Wi-Fi phone to sleep and drop off adb.
if($Phone){
  $serial=Find-Phone
  if(!$serial){throw 'The phone dropped off adb during the build. Wake it, check Wireless debugging is on, and rerun with -Phone (the APK is built, so the rerun is quick unless -Preview).'}
  Write-Host "Installing on phone $serial"
}
foreach($service in @(@{port=8081;label='metro';arguments=@((Join-Path $project 'node_modules/expo/bin/cli'),'start','--dev-client','--localhost','--port','8081')})) {
  if($Preview -and $service.label -eq 'metro'){continue}
  # Avoid the CIM network provider, which can hang after a native build.
  $listener=[System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq $service.port
  if(!$listener){$null=Start-OmenNode $service.arguments $service.label}
  else {
    $known=$owned | Where-Object { $_.label -eq $service.label -and (Get-Process -Id $_.id -ErrorAction SilentlyContinue) }
    if(!$known){throw "Port $($service.port) is already in use by an untracked process. Stop it first."}
  }
}
# The backend is the OMEN website (omen-landing, "npm run dev" on port 3100).
$backendPort=3100
$backend=[System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq $backendPort
if(!$backend){Write-Warning "Nothing is listening on port $backendPort. Start the website (npm run dev in omen-landing) or the app will show market data as unavailable."}
if(!$Preview){Wait-OmenUrl 'http://127.0.0.1:8081/status' 'packager-status:running'}
& $adb -s $serial reverse tcp:$backendPort tcp:$backendPort
if(!$Preview){& $adb -s $serial reverse tcp:8081 tcp:8081}
# A Wi-Fi serial (ip:port) has a colon, which a file name cannot.
$stamp=Join-Path $project (".local\installed-" + ($serial -replace '[^A-Za-z0-9_.-]','_') + ".txt")
$apkHash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
$installed=((& $adb -s $serial shell pm path xyz.getomen.app.dev) -join '') -match '^package:'
$previousHash=if(Test-Path -LiteralPath $stamp){(Get-Content -LiteralPath $stamp -Raw).Trim()}else{''}
if(!$installed -or $previousHash -ne $apkHash){
  $installOutput=(& $adb -s $serial install -r $apk 2>&1) -join "`n"
  if($installOutput -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE'){
    # A differently signed build is installed; replace it (app data is lost).
    Write-Warning 'Installed app was signed with another key; reinstalling from scratch.'
    & $adb -s $serial uninstall xyz.getomen.app.dev | Out-Null
    $installOutput=(& $adb -s $serial install -r $apk 2>&1) -join "`n"
  }
  if($LASTEXITCODE -ne 0 -or $installOutput -notmatch 'Success'){throw "App installation failed: $installOutput"}
  Set-Content -LiteralPath $stamp -Value $apkHash
}
if($Preview){
  & $adb -s $serial shell am start -n xyz.getomen.app.dev/xyz.getomen.app.dev.MainActivity
}else{
  & $adb -s $serial shell am start -a android.intent.action.VIEW -d 'exp+omen-mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' xyz.getomen.app.dev
}
Write-Host 'OMEN is open. Sign in with Google or your wallet. The app uses Solana mainnet.'
Write-Host 'To stop the bundler: powershell -ExecutionPolicy Bypass -File scripts/stop.ps1'
