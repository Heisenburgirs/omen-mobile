$project=Split-Path -Parent $PSScriptRoot
$processFile=Join-Path $project '.local\processes.json'
if(Test-Path -LiteralPath $processFile){
  $entries=@(Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json)
  foreach($entry in $entries){
    $process=Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.id)" -ErrorAction SilentlyContinue
    if($process.Name -eq 'node.exe' -and $process.CommandLine -like "*$project*" -and ($process.CommandLine -match 'expo[/\\]bin[/\\]cli')){Stop-Process -Id $entry.id -ErrorAction SilentlyContinue}
  }
  '[]' | Set-Content -LiteralPath $processFile
}
Write-Host 'OMEN bundler stopped. Close the emulator window when finished.'
