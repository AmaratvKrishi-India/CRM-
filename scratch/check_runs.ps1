$f = 'scratch\multidev-run9.log'
$s1 = (Get-Item $f).Length
Start-Sleep -Seconds 6
$s2 = (Get-Item $f).Length
Write-Output "run9 size_before=$s1 size_after=$s2 growing=$($s2 -gt $s1)"
Write-Output '--- run9 tail ---'
Get-Content $f -Tail 6
foreach ($n in 7,8) {
  Write-Output "=== run$n summary ==="
  Select-String -Path "scratch\multidev-run$n.log" -Pattern 'tests |pass |fail |passing|failing|13 / 13|13/13' | Select-Object -Last 6 | ForEach-Object { $_.Line }
}
