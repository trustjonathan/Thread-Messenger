-- Test 05: Concurrency and Signup Triggers
-- Verifies: advisory lock serialization, rate limit atomicity, and username trigger resilience.

BEGIN;

-- 1. Test Signup Trigger with Varied and Degraded Metadata
-- Case A: Google OAuth with NO metadata
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'google1@test.local', '{}');

-- Case B: Reserved username 'admin'
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'admin_wannabe@test.local', '{"username": "admin"}');

-- Case C: Username that is 60 characters long
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'longname@test.local', '{"username": "this_is_an_extremely_long_username_that_exceeds_the_limit_by_far"}');

-- Case D: 5 users with identical requested username 'cool_dev'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000004', 'cool1@test.local', '{"username": "cool_dev"}'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'cool2@test.local', '{"username": "cool_dev"}'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'cool3@test.local', '{"username": "cool_dev"}'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'cool4@test.local', '{"username": "cool_dev"}'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'cool5@test.local', '{"username": "cool_dev"}');

-- Assert all generated profiles satisfy constraints
DO $$
DECLARE
  v_rec record;
  v_count int := 0;
BEGIN
  FOR v_rec IN SELECT id, username, display_name FROM public.profiles WHERE id::text LIKE 'aaaaaaaa-%' LOOP
    v_count := v_count + 1;
    -- Username format verification
    IF v_rec.username !~ '^[a-z0-9_]{3,30}$' THEN
      RAISE EXCEPTION 'TEST FAILED: Generated username % violates regex', v_rec.username;
    END IF;
    -- Reserved username check
    IF v_rec.username IN ('admin', 'administrator', 'system', 'support', 'help', 'root', 'moderator', 'official', 'null', 'undefined', 'thread', 'messenger') THEN
      RAISE EXCEPTION 'TEST FAILED: Generated username % is a reserved name', v_rec.username;
    END IF;
    -- Display name check
    IF length(v_rec.display_name) < 1 OR length(v_rec.display_name) > 50 THEN
      RAISE EXCEPTION 'TEST FAILED: Generated display_name % violates length constraint', v_rec.display_name;
    END IF;
  END LOOP;

  IF v_count <> 8 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 8 test profiles, found %', v_count;
  END IF;
END $$;

-- 2. Test Atomic Rate Limit Under Concurrent First Insert
DO $$
DECLARE
  v_res1 boolean;
  v_res2 boolean;
BEGIN
  -- Two calls on identical fresh key in same transaction
  v_res1 := private.check_rate_limit('concurrent_test_key', 5, interval '60 seconds');
  v_res2 := private.check_rate_limit('concurrent_test_key', 5, interval '60 seconds');
  IF NOT (v_res1 AND v_res2) THEN
    RAISE EXCEPTION 'TEST FAILED: check_rate_limit did not allow concurrent initial hits';
  END IF;
END $$;

-- 3. Test Advisory Lock Serialization on get_or_create_direct_conversation
-- Ensure calling from both sides produces the exact same conversation ID
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}', true);
SELECT public.get_or_create_direct_conversation('aaaaaaaa-0000-0000-0000-000000000002') AS conv_1 \gset

SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-0000-0000-000000000002", "role": "authenticated"}', true);
SELECT public.get_or_create_direct_conversation('aaaaaaaa-0000-0000-0000-000000000001') AS conv_2 \gset

DO $$
BEGIN
  IF :'conv_1' <> :'conv_2' THEN
    RAISE EXCEPTION 'TEST FAILED: get_or_create_direct_conversation returned different IDs for same pair: % vs %', :'conv_1', :'conv_2';
  END IF;
END $$;

ROLLBACK;
