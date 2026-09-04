param([string]$Root = 'src', [switch]$AdminOnly)
Set-Location 'C:\Users\PC\Desktop\calling app'
if ($AdminOnly) { $files = Get-ChildItem src\components\admin -Recurse -Filter *.tsx }
else { $files = Get-ChildItem src -Recurse -Filter *.tsx | Where-Object { $_.FullName -notmatch 'components\\admin' } }
$tokens = @()
foreach ($f in $files) {
  $c = Get-Content $f.FullName -Raw
  $ms = [regex]::Matches($c, '(bg|text|border|divide|ring|from|to|via|placeholder|shadow|outline|caret|accent)-(slate|gray|zinc|neutral|stone|white|black)-?[0-9]*')
  foreach ($m in $ms) { $tokens += $m.Value }
}
$tokens | Group-Object | Sort-Object Count -Descending | ForEach-Object { ('{0,5} {1}' -f $_.Count, $_.Name) }
