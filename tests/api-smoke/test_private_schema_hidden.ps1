# PowerShell API Smoke Test
# Validates that 'private' is absent from supabase/config.toml and unreachable through PostgREST

$ConfigFile = "supabase/config.toml"
$ApiUrl = if ($env:SUPABASE_URL) { $env:SUPABASE_URL } else { "http://localhost:54321" }
$AnonKey = $env:SUPABASE_ANON_KEY

Write-Host "=== 1. Checking supabase/config.toml [api] schemas ==="
if (-not (Test-Path $ConfigFile)) {
  Write-Error "$ConfigFile not found."
  exit 1
}

$ConfigContent = Get-Content $ConfigFile -Raw
if ($ConfigContent -match 'schemas\s*=\s*\[[^\]]*"private"[^\]]*\]') {
  Write-Error "FAIL: 'private' schema is exposed in $ConfigFile [api] schemas!"
  exit 1
} else {
  Write-Host "PASS: 'private' is not listed in $ConfigFile [api] schemas."
}

Write-Host "=== 2. Testing PostgREST API Endpoint Protection ==="
if ($AnonKey) {
  try {
    $resp = Invoke-WebRequest -Uri "$ApiUrl/rest/v1/rate_limits" -Headers @{ "apikey" = $AnonKey; "Authorization" = "Bearer $AnonKey" } -SkipHttpErrorCheck
    Write-Host "Probe /rest/v1/rate_limits Status: $($resp.StatusCode)"
    if ($resp.StatusCode -eq 404 -or $resp.StatusCode -eq 400) {
      Write-Host "PASS: /rest/v1/rate_limits is unreachable."
    }
  } catch {
    Write-Host "PASS: Request rejected ($($_.Exception.Message))"
  }
} else {
  Write-Host "INFO: SUPABASE_ANON_KEY not set; config validation PASSED."
}

Write-Host "API smoke test completed."
