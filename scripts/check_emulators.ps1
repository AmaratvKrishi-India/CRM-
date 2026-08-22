$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
foreach ($d in 'emulator-5556','emulator-5558','emulator-5560') {
    $pkg = & $adb -s $d shell pm list packages com.amaratvkrishi.salescrm
    $ver = & $adb -s $d shell dumpsys package com.amaratvkrishi.salescrm | Select-String 'versionName'
    Write-Output ("{0} -> pkg=[{1}] {2}" -f $d, $pkg.Trim(), $ver)
}
