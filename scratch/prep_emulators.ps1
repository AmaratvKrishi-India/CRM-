$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
Write-Output "=== devices ==="
& $adb devices
foreach ($d in 'emulator-5556','emulator-5558','emulator-5560') {
  Write-Output "=== force-stop on $d ==="
  & $adb -s $d shell am force-stop com.amaratvkrishi.salescrm
}
Write-Output "=== docker supabase ==="
docker ps --filter "name=supabase" --format "{{.Names}} {{.Status}}"
