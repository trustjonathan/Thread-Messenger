-- Test 04: Blocks and Reports Security
-- Verifies: block visibility isolation, direct insert denial on reports,
-- report_content message read requirement, and report rate limits.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'user_c@test.local');

-- User A creates conversation with B
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
SELECT set_config('app.ab_conv_id', public.get_or_create_direct_conversation('22222222-2222-2222-2222-222222222222')::text, true);
SELECT set_config('app.ab_msg_id', (public.send_message(current_setting('app.ab_conv_id')::uuid, 'Message to report', gen_random_uuid())).id::text, true);

-- User B creates conversation with C and sends a message
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
SELECT set_config('app.bc_conv_id', public.get_or_create_direct_conversation('33333333-3333-3333-3333-333333333333')::text, true);
SELECT set_config('app.bc_msg_id', (public.send_message(current_setting('app.bc_conv_id')::uuid, 'Private BC message', gen_random_uuid())).id::text, true);

-- Switch back to User A
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- 1. Direct INSERT into reports must be denied
DO $$
BEGIN
  INSERT INTO public.reports (reporter_id, reason)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Direct insert attempt');
  RAISE EXCEPTION 'TEST FAILED: Direct INSERT into reports succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

-- 2. Report message in own conversation must succeed
SELECT public.report_content(current_setting('app.ab_msg_id')::uuid, NULL, 'Inappropriate message');

-- 3. Reporting a message in an unjoined conversation (BC) must fail with OPERATION_FAILED
DO $$
DECLARE
  v_bc_msg_id uuid := current_setting('app.bc_msg_id')::uuid;
BEGIN
  PERFORM public.report_content(v_bc_msg_id, NULL, 'Trying to report stranger message');
  RAISE EXCEPTION 'TEST FAILED: Able to report message in stranger conversation';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%OPERATION_FAILED%' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected OPERATION_FAILED but got %', SQLERRM;
  END IF;
END $$;

-- 4. Reporting self must fail with OPERATION_FAILED
DO $$
BEGIN
  PERFORM public.report_content(NULL, '11111111-1111-1111-1111-111111111111', 'Self report');
  RAISE EXCEPTION 'TEST FAILED: Able to report self';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%OPERATION_FAILED%' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected OPERATION_FAILED on self-report but got %', SQLERRM;
  END IF;
END $$;

-- 5. Report rate limit: max 10 reports per hour
DO $$
DECLARE
  v_ab_msg_id uuid := current_setting('app.ab_msg_id')::uuid;
  i int;
BEGIN
  -- We already submitted 1 report. Submit 9 more to hit 10.
  FOR i IN 2..10 LOOP
    PERFORM public.report_content(v_ab_msg_id, NULL, 'Report batch ' || i);
  END LOOP;

  -- 11th report must fail with RATE_LIMITED
  BEGIN
    PERFORM public.report_content(v_ab_msg_id, NULL, 'Report 11 should fail');
    RAISE EXCEPTION 'TEST FAILED: 11th report succeeded past rate limit';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RATE_LIMITED%' THEN
      RAISE EXCEPTION 'TEST FAILED: Expected RATE_LIMITED on report but got %', SQLERRM;
    END IF;
  END;
END $$;

-- 6. Block isolation: User B cannot see rows where User A blocked User B
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.blocks WHERE blocker_id = '11111111-1111-1111-1111-111111111111';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Blocked user can see blocker record in blocks table';
  END IF;
END $$;

ROLLBACK;
