-- Test 03: Profiles Scrape Protection, Updates, and Exact Search
-- Verifies: scrape isolation, column update permissions, set_username RPC, and exact search.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'user_c@test.local');

-- User A and User B share a direct conversation. User C is a stranger.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
SELECT public.get_or_create_direct_conversation('22222222-2222-2222-2222-222222222222');

-- 1. Profiles Scrape Protection
-- User A must only see self and User B (2 rows), NOT User C
DO $$
DECLARE
  v_count int;
  v_c_visible boolean;
BEGIN
  SELECT count(*) INTO v_count FROM public.profiles;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected exactly 2 visible profiles, got %', v_count;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333') INTO v_c_visible;
  IF v_c_visible THEN
    RAISE EXCEPTION 'TEST FAILED: Stranger User C is visible in profiles SELECT';
  END IF;
END $$;

-- 2. Direct Column UPDATE Permissions
-- Updating display_name must succeed
UPDATE public.profiles
SET display_name = 'Updated Display Name'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Direct UPDATE on username must fail with insufficient_privilege
DO $$
BEGIN
  UPDATE public.profiles
  SET username = 'hacked_name'
  WHERE id = '11111111-1111-1111-1111-111111111111';
  RAISE EXCEPTION 'TEST FAILED: Direct UPDATE on username succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- Direct UPDATE on last_seen_at must fail with insufficient_privilege
DO $$
BEGIN
  UPDATE public.profiles
  SET last_seen_at = now()
  WHERE id = '11111111-1111-1111-1111-111111111111';
  RAISE EXCEPTION 'TEST FAILED: Direct UPDATE on last_seen_at succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- 3. set_username RPC (One-Time Execution)
SELECT public.set_username('user_a_custom');

-- Second call to set_username must fail with USERNAME_ALREADY_SET
DO $$
BEGIN
  PERFORM public.set_username('user_a_second_try');
  RAISE EXCEPTION 'TEST FAILED: Second set_username call succeeded';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%USERNAME_ALREADY_SET%' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected USERNAME_ALREADY_SET but got %', SQLERRM;
  END IF;
END $$;

-- 4. Exact Search (No Partial or Wildcard Matches)
-- Querying User C's actual username must return User C
DO $$
DECLARE
  v_c_username text;
  v_found_id uuid;
  v_found_count int;
BEGIN
  -- Obtain User C's generated username as admin
  SELECT username INTO v_c_username FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333';

  -- Exact search
  SELECT id INTO v_found_id FROM public.search_user_by_username(v_c_username);
  IF v_found_id <> '33333333-3333-3333-3333-333333333333' THEN
    RAISE EXCEPTION 'TEST FAILED: Exact search did not find User C';
  END IF;

  -- Partial search prefix
  SELECT count(*) INTO v_found_count FROM public.search_user_by_username(substr(v_c_username, 1, 4));
  IF v_found_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Partial prefix search returned rows';
  END IF;

  -- Wildcard search
  SELECT count(*) INTO v_found_count FROM public.search_user_by_username(substr(v_c_username, 1, 4) || '%');
  IF v_found_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Wildcard search returned rows';
  END IF;
END $$;

ROLLBACK;
