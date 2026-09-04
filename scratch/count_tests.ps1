$total = 0
Get-ChildItem tests -File -Filter *.test.ts | Sort-Object Name | ForEach-Object {
  $c = (Select-String -Path $_.FullName -Pattern '^\s*(it|test)\(' | Measure-Object).Count
  $total += $c
  Write-Output ("{0}: {1}" -f $_.Name, $c)
}
Write-Output "TOTAL: $total"
Write-Output ("files: " + (Get-ChildItem tests -File -Filter *.test.ts).Count)
