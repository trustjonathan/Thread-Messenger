#!/usr/bin/env bash
set -euo pipefail

# Tests that schema 'private' is strictly excluded from PostgREST API exposure
# and confirms 'private' is absent from supabase/config.toml [api] schemas.

CONFIG_FILE="supabase/config.toml"
API_URL="${SUPABASE_URL:-http://localhost:54321}"
ANON_KEY="${SUPABASE_ANON_KEY:-}"

echo "=== 1. Checking supabase/config.toml [api] schemas ==="
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: $CONFIG_FILE not found."
  exit 1
fi

# Ensure 'private' is NOT present in schemas setting
if grep -E 'schemas\s*=' "$CONFIG_FILE" | grep -q '"private"'; then
  echo "FAIL: 'private' schema is exposed in $CONFIG_FILE [api] schemas!"
  exit 1
else
  echo "PASS: 'private' is not listed in $CONFIG_FILE [api] schemas."
fi

echo "=== 2. Testing PostgREST API Endpoint Protection ==="
if [ -n "$ANON_KEY" ]; then
  # Probe table in private schema
  TABLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    "$API_URL/rest/v1/rate_limits" || echo "failed")

  echo "Probe /rest/v1/rate_limits HTTP Status: $TABLE_STATUS"
  if [ "$TABLE_STATUS" = "404" ] || [ "$TABLE_STATUS" = "400" ]; then
    echo "PASS: /rest/v1/rate_limits is unreachable through PostgREST."
  else
    echo "WARNING: Expected 404/400 for private table, got $TABLE_STATUS"
    exit 1
  fi

  # Probe RPC in private schema
  RPC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    "$API_URL/rest/v1/rpc/check_rate_limit" || echo "failed")

  echo "Probe /rest/v1/rpc/check_rate_limit HTTP Status: $RPC_STATUS"
  if [ "$RPC_STATUS" = "404" ] || [ "$RPC_STATUS" = "400" ]; then
    echo "PASS: /rest/v1/rpc/check_rate_limit is unreachable through PostgREST."
  else
    echo "WARNING: Expected 404/400 for private RPC, got $RPC_STATUS"
    exit 1
  fi
else
  echo "INFO: SUPABASE_ANON_KEY not set; skipped live curl check. Config validation PASSED."
fi

echo "All API smoke tests passed."
