#!/usr/bin/env bash
set -euo pipefail

# Real Two-Session Concurrency Race Test for get_or_create_direct_conversation
# Spawns two parallel psql processes calling get_or_create_direct_conversation simultaneously
# Asserts both return the exact same conversation UUID and exactly one conversation is created.

CONTAINER="supabase_db_Thread-Messenger"
USER1="44444444-4444-4444-4444-444444444444"
USER2="55555555-5555-5555-5555-555555555555"

echo "=== 1. Setting up Race Users ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
INSERT INTO auth.users (id, email) VALUES
  ('$USER1', 'race_user_1@test.local'),
  ('$USER2', 'race_user_2@test.local')
ON CONFLICT (id) DO NOTHING;
"

echo "=== 2. Spawning Parallel psql Sessions ==="
OUT1=$(mktemp)
OUT2=$(mktemp)

SQL1="SET ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"sub\": \"$USER1\", \"role\": \"authenticated\"}', true); SELECT public.get_or_create_direct_conversation('$USER2');"
SQL2="SET ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"sub\": \"$USER2\", \"role\": \"authenticated\"}', true); SELECT public.get_or_create_direct_conversation('$USER1');"

docker exec -i "$CONTAINER" psql -U postgres -d postgres -t -A -c "$SQL1" > "$OUT1" &
PID1=$!

docker exec -i "$CONTAINER" psql -U postgres -d postgres -t -A -c "$SQL2" > "$OUT2" &
PID2=$!

wait "$PID1"
wait "$PID2"

RES1=$(grep -E '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' "$OUT1" | tail -n 1)
RES2=$(grep -E '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' "$OUT2" | tail -n 1)
rm -f "$OUT1" "$OUT2"

echo "Session 1 returned: $RES1"
echo "Session 2 returned: $RES2"

if [ -z "$RES1" ] || [ -z "$RES2" ] || [ "$RES1" != "$RES2" ]; then
  echo "RACE CONDITION FAILED: IDs do not match ($RES1 vs $RES2)"
  exit 1
fi

echo "=== 3. Verifying Database Row Count ==="
COUNT=$(docker exec -i "$CONTAINER" psql -U postgres -d postgres -t -A -c "
SELECT count(*) FROM public.direct_conversation_pairs
WHERE user_low_id = '$USER1' AND user_high_id = '$USER2';
" | tr -d '[:space:]')

echo "direct_conversation_pairs count: $COUNT"

if [ "$COUNT" != "1" ]; then
  echo "RACE CONDITION FAILED: Expected count 1, got $COUNT"
  exit 1
fi

echo "PASS: Parallel race cleanly serialized via pg_advisory_xact_lock. Exactly 1 conversation exists."

# Cleanup
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "DELETE FROM auth.users WHERE id IN ('$USER1', '$USER2');" > /dev/null
