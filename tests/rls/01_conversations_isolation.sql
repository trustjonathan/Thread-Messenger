-- Test 01: Conversation Isolation
-- Verifies that User A cannot read or access conversations or messages between User B and User C.

BEGIN;

-- Setup test users
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'user_c@test.local');

-- User B and User C create a conversation
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

SELECT public.get_or_create_direct_conversation('33333333-3333-3333-3333-333333333333') AS bc_conv_id \gset

-- User B sends a message
SELECT public.send_message(:'bc_conv_id', 'Private message from B to C', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Switch to User A (Stranger)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- 1. User A must see 0 rows from conversations
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.conversations WHERE id = :'bc_conv_id';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: User A can see conversation BC';
  END IF;
END $$;

-- 2. User A must see 0 rows from messages
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.messages WHERE conversation_id = :'bc_conv_id';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: User A can see messages in conversation BC';
  END IF;
END $$;

-- 3. User A calling send_message on conversation BC must fail with OPERATION_FAILED
DO $$
BEGIN
  PERFORM public.send_message(:'bc_conv_id', 'Intruder message', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  RAISE EXCEPTION 'TEST FAILED: User A was able to send message to conversation BC';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%OPERATION_FAILED%' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected OPERATION_FAILED but got %', SQLERRM;
  END IF;
END $$;

ROLLBACK;
