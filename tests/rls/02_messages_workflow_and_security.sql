-- Test 02: Messages Workflow and Security
-- Verifies: direct insert denial, sender insert/return, client integrity override,
-- idempotent retry, block rejection, and 61st message rate limit.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.local');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

SELECT set_config('app.ab_conv_id', public.get_or_create_direct_conversation('22222222-2222-2222-2222-222222222222')::text, true);

-- 1. Direct INSERT into messages must be denied
DO $$
DECLARE
  v_conv_id uuid := current_setting('app.ab_conv_id')::uuid;
BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, client_id, body)
  VALUES (v_conv_id, '11111111-1111-1111-1111-111111111111', gen_random_uuid(), 'Direct test');
  RAISE EXCEPTION 'TEST FAILED: Direct INSERT into messages succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  -- Expected outcome
  NULL;
END $$;

-- 2. Sender insert & returning via send_message (Count = 1)
DO $$
DECLARE
  v_conv_id uuid := current_setting('app.ab_conv_id')::uuid;
  v_msg public.messages;
  v_client_id uuid := '10000000-0000-0000-0000-000000000001';
BEGIN
  v_msg := public.send_message(v_conv_id, 'Hello User B', v_client_id);
  IF v_msg.sender_id <> '11111111-1111-1111-1111-111111111111' THEN
    RAISE EXCEPTION 'TEST FAILED: sender_id does not match caller';
  END IF;
  IF v_msg.body <> 'Hello User B' THEN
    RAISE EXCEPTION 'TEST FAILED: body does not match';
  END IF;
  IF v_msg.id IS NULL OR v_msg.created_at IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: id or created_at not populated';
  END IF;
END $$;

-- 3. Idempotent retry returns original message (Count = 2)
DO $$
DECLARE
  v_conv_id uuid := current_setting('app.ab_conv_id')::uuid;
  v_msg public.messages;
  v_client_id uuid := '10000000-0000-0000-0000-000000000001';
  v_count int;
BEGIN
  -- Call again with different body but same client_id
  v_msg := public.send_message(v_conv_id, 'Changed body text', v_client_id);
  IF v_msg.body <> 'Hello User B' THEN
    RAISE EXCEPTION 'TEST FAILED: Idempotent retry did not return original body';
  END IF;

  SELECT count(*) INTO v_count FROM public.messages WHERE client_id = v_client_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Duplicate message was inserted, count = %', v_count;
  END IF;
END $$;

-- 4. Blocked user cannot send (fails with generic OPERATION_FAILED before rate limit)
-- Switch to User B to block User A
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');

-- Switch back to User A
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
DO $$
DECLARE
  v_conv_id uuid := current_setting('app.ab_conv_id')::uuid;
BEGIN
  PERFORM public.send_message(v_conv_id, 'Trying while blocked', gen_random_uuid());
  RAISE EXCEPTION 'TEST FAILED: Blocked user was able to send message';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%OPERATION_FAILED%' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected OPERATION_FAILED on block but got %', SQLERRM;
  END IF;
END $$;

-- Unblock so we can test rate limiting cleanly
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
DELETE FROM public.blocks WHERE blocker_id = '22222222-2222-2222-2222-222222222222';

-- 5. Send rate limit: 61st message within 60s is rejected with RATE_LIMITED
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
DO $$
DECLARE
  v_conv_id uuid := current_setting('app.ab_conv_id')::uuid;
  i int;
BEGIN
  -- We already made 2 send_message calls (steps 2 & 3). Send 58 more to reach limit of 60.
  FOR i IN 3..60 LOOP
    PERFORM public.send_message(v_conv_id, 'Flood message ' || i, gen_random_uuid());
  END LOOP;

  -- 61st message must raise RATE_LIMITED
  BEGIN
    PERFORM public.send_message(v_conv_id, 'Message 61', gen_random_uuid());
    RAISE EXCEPTION 'TEST FAILED: 61st message was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RATE_LIMITED%' THEN
      RAISE EXCEPTION 'TEST FAILED: Expected RATE_LIMITED but got %', SQLERRM;
    END IF;
  END;
END $$;

ROLLBACK;
