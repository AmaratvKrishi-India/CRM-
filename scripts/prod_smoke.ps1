$envLines = Get-Content -LiteralPath '.env.production'
$vars = @{}
foreach ($line in $envLines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { $vars[$Matches[1]] = $Matches[2].Trim('"') }
}
$url = $vars['VITE_SUPABASE_URL']
$anon = $vars['VITE_SUPABASE_ANON_KEY']
$headers = @{ 'apikey' = $anon; 'Authorization' = "Bearer $anon" }

$webUrl = $env:CRM_WEB_URL
if ([string]::IsNullOrWhiteSpace($webUrl)) {
    Write-Output 'WEB = SKIPPED (set CRM_WEB_URL to the current deployment URL)'
} else {
    $webUri = $null
    if ([Uri]::TryCreate($webUrl.Trim(), [UriKind]::Absolute, [ref]$webUri) -and $webUri.Scheme -in @('http', 'https')) {
        try { $r = Invoke-WebRequest -Uri $webUri -UseBasicParsing -TimeoutSec 30; Write-Output ("WEB = " + $r.StatusCode) } catch { Write-Output ("WEB = ERROR " + $_.Exception.Message) }
    } else {
        Write-Output 'WEB = ERROR (CRM_WEB_URL must be an absolute HTTP or HTTPS URL)'
    }
}

try { $r = Invoke-WebRequest -Uri "$url/rest/v1/leads?select=id&limit=1" -Headers $headers -UseBasicParsing -TimeoutSec 30; Write-Output ("REST_LEADS = " + $r.StatusCode) } catch { Write-Output ("REST_LEADS = ERROR " + $_.Exception.Message) }

try { $r = Invoke-WebRequest -Uri "$url/rest/v1/rpc/current_profile_id" -Method POST -Headers $headers -Body '{}' -ContentType 'application/json' -UseBasicParsing -TimeoutSec 30; Write-Output ("RPC_CURRENT_PROFILE_ID = " + $r.StatusCode) } catch { Write-Output ("RPC_CURRENT_PROFILE_ID = ERROR " + $_.Exception.Message) }
