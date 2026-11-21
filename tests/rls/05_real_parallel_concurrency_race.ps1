# Real Two-Session Concurrency Race Test for get_or_create_direct_conversation
# Spawns two parallel psql processes calling get_or_create_direct_conversation simultaneously
# Asserts both return the exact same conversation UUID and exactly one conversation is created.

$dockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$containerName = "supabase_db_Thread-Messenger"

$user1 = "44444444-4444-4444-4444-444444444444"
$user2 = "55555555-5555-5555-5555-555555555555"

Write-Host "=== 1. Setting up Race Users ==="
$setupSql = @"
INSERT INTO auth.users (id, email) VALUES
  ('$user1', 'race_user_1@test.local'),
  ('$user2', 'race_user_2@test.local')
ON CONFLICT (id) DO NOTHING;
"@

& $dockerPath exec -i $containerName psql -U postgres -d postgres -c $setupSql

Write-Host "=== 2. Spawning Parallel psql Sessions ==="

$scriptBlock1 = {
  param($dockerPath, $containerName, $user1, $user2)
  $sql = "SET ROLE authenticated; SELECT set_config('request.jwt.claims', '{\`"sub\`": \`"$user1\`", \`"role\`": \`"authenticated\`"}', true); SELECT public.get_or_create_direct_conversation('$user2');"
  $res = & $dockerPath exec -i $containerName psql -U postgres -d postgres -t -A -c $sql
  $str = ($res | Out-String)
  $allMatches = [regex]::Matches($str, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
  if ($allMatches.Count -gt 0) {
    return $allMatches[$allMatches.Count - 1].Value
  }
  return $str.Trim()
}

$scriptBlock2 = {
  param($dockerPath, $containerName, $user1, $user2)
  $sql = "SET ROLE authenticated; SELECT set_config('request.jwt.claims', '{\`"sub\`": \`"$user2\`", \`"role\`": \`"authenticated\`"}', true); SELECT public.get_or_create_direct_conversation('$user1');"
  $res = & $dockerPath exec -i $containerName psql -U postgres -d postgres -t -A -c $sql
  $str = ($res | Out-String)
  $allMatches = [regex]::Matches($str, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
  if ($allMatches.Count -gt 0) {
    return $allMatches[$allMatches.Count - 1].Value
  }
  return $str.Trim()
}

$job1 = Start-Job -ScriptBlock $scriptBlock1 -ArgumentList $dockerPath, $containerName, $user1, $user2
$job2 = Start-Job -ScriptBlock $scriptBlock2 -ArgumentList $dockerPath, $containerName, $user1, $user2

$res1 = Receive-Job -Job $job1 -Wait
$res2 = Receive-Job -Job $job2 -Wait

Remove-Job -Job $job1, $job2

Write-Host "Session 1 returned conversation ID: $res1"
Write-Host "Session 2 returned conversation ID: $res2"

if (-not $res1 -or -not $res2 -or $res1 -ne $res2) {
  Write-Error "RACE CONDITION FAILED: IDs do not match or are empty ($res1 vs $res2)"
  exit 1
}

Write-Host "=== 3. Verifying Database Row Count ==="
$countSql = @"
SELECT count(*) FROM public.direct_conversation_pairs
WHERE user_low_id = '$user1' AND user_high_id = '$user2';
"@

$count = (& $dockerPath exec -i $containerName psql -U postgres -d postgres -t -A -c $countSql).Trim()
Write-Host "direct_conversation_pairs row count for pair: $count"

if ($count -ne "1") {
  Write-Error "RACE CONDITION FAILED: Expected exactly 1 conversation row, found $count"
  exit 1
}

Write-Host "PASS: Parallel race cleanly serialized via pg_advisory_xact_lock. Exactly 1 conversation exists."

# Cleanup test users
$cleanupSql = @"
DELETE FROM auth.users WHERE id IN ('$user1', '$user2');
"@
& $dockerPath exec -i $containerName psql -U postgres -d postgres -c $cleanupSql | Out-Null
