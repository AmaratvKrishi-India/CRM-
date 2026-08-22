$envLines = Get-Content -LiteralPath '.env.production'
$vars = @{}
foreach ($line in $envLines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { $vars[$Matches[1]] = $Matches[2].Trim('"') }
}
$url = $vars['VITE_SUPABASE_URL']
$anon = $vars['VITE_SUPABASE_ANON_KEY']
$headers = @{ 'apikey' = $anon; 'Authorization' = "Bearer $anon" }

try { $r = Invoke-WebRequest -Uri 'https://crm-blush-omega.vercel.app' -UseBasicParsing -TimeoutSec 30; Write-Output ("VERCEL_WEB = " + $r.StatusCode) } catch { Write-Output ("VERCEL_WEB = ERROR " + $_.Exception.Message) }

try { $r = Invoke-WebRequest -Uri "$url/rest/v1/leads?select=id&limit=1" -Headers $headers -UseBasicParsing -TimeoutSec 30; Write-Output ("REST_LEADS = " + $r.StatusCode) } catch { Write-Output ("REST_LEADS = ERROR " + $_.Exception.Message) }

try { $r = Invoke-WebRequest -Uri "$url/rest/v1/rpc/current_profile_id" -Method POST -Headers $headers -Body '{}' -ContentType 'application/json' -UseBasicParsing -TimeoutSec 30; Write-Output ("RPC_CURRENT_PROFILE_ID = " + $r.StatusCode) } catch { Write-Output ("RPC_CURRENT_PROFILE_ID = ERROR " + $_.Exception.Message) }
