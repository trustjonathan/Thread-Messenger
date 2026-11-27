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
  $Headers = @{ "apikey" = $AnonKey; "Authorization" = "Bearer $AnonKey" }

  try {
    $resp = Invoke-WebRequest -Uri "$ApiUrl/rest/v1/rate_limits" -Headers $Headers -SkipHttpErrorCheck
    $status = [int]$resp.StatusCode
    Write-Host "Probe /rest/v1/rate_limits HTTP Status: $status"
    if ($status -eq 404 -or $status -eq 400) {
      Write-Host "PASS: /rest/v1/rate_limits is unreachable through PostgREST."
    } else {
      Write-Host "WARNING: Expected 404/400 for private table, got $status"
      exit 1
    }
  } catch {
    Write-Host "WARNING: Expected 404/400 for private table, request rejected ($($_.Exception.Message))"
    exit 1
  }

  try {
    $rpcHeaders = @{ "apikey" = $AnonKey; "Authorization" = "Bearer $AnonKey"; "Content-Type" = "application/json" }
    $rpcResp = Invoke-WebRequest -Uri "$ApiUrl/rest/v1/rpc/check_rate_limit" -Method Post -Headers $rpcHeaders -Body '{}' -SkipHttpErrorCheck
    $rpcStatus = [int]$rpcResp.StatusCode
    Write-Host "Probe /rest/v1/rpc/check_rate_limit HTTP Status: $rpcStatus"
    if ($rpcStatus -eq 404 -or $rpcStatus -eq 400) {
      Write-Host "PASS: /rest/v1/rpc/check_rate_limit is unreachable through PostgREST."
    } else {
      Write-Host "WARNING: Expected 404/400 for private RPC, got $rpcStatus"
      exit 1
    }
  } catch {
    Write-Host "WARNING: Expected 404/400 for private RPC, request rejected ($($_.Exception.Message))"
    exit 1
  }
} else {
  Write-Host "INFO: SUPABASE_ANON_KEY not set; config validation PASSED."
}

Write-Host "API smoke test completed."
