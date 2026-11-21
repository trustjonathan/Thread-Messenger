-- Test 07: Performance Seed Script and EXPLAIN ANALYZE
-- Seeds 50 direct conversations x 1000 messages (50,000 messages total)
-- Sets request.jwt.claims to satisfy the message integrity trigger
-- Runs EXPLAIN (ANALYZE, BUFFERS) on public.list_conversations()

BEGIN;

DO $$
DECLARE
  v_target_user uuid := '11111111-1111-1111-1111-111111111111';
  v_peer_user uuid;
  v_conv_id uuid;
  v_u_low uuid;
  v_u_high uuid;
  i int;
  m int;
BEGIN
  RAISE NOTICE 'Starting performance test seed...';

  -- 1. Create Target User
  INSERT INTO auth.users (id, email)
  VALUES (v_target_user, 'target_user@benchmark.local')
  ON CONFLICT DO NOTHING;

  -- 2. Create 50 Peer Users and 50 Conversations
  FOR i IN 1..50 LOOP
    v_peer_user := ('20000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;

    INSERT INTO auth.users (id, email)
    VALUES (v_peer_user, 'peer_' || i || '@benchmark.local')
    ON CONFLICT DO NOTHING;

    -- Create Conversation
    INSERT INTO public.conversations (kind)
    VALUES ('direct')
    RETURNING id INTO v_conv_id;

    v_u_low := LEAST(v_target_user, v_peer_user);
    v_u_high := GREATEST(v_target_user, v_peer_user);

    INSERT INTO public.direct_conversation_pairs (conversation_id, user_low_id, user_high_id)
    VALUES (v_conv_id, v_u_low, v_u_high);

    -- Members with target user having read up to 10 minutes ago
    INSERT INTO public.conversation_members (conversation_id, user_id, last_read_at)
    VALUES
      (v_conv_id, v_target_user, clock_timestamp() - interval '10 minutes'),
      (v_conv_id, v_peer_user, clock_timestamp() - interval '1 day');

    -- Seed 990 messages from target user (auth.uid() = v_target_user)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_target_user::text, 'role', 'authenticated')::text, true);

    INSERT INTO public.messages (conversation_id, client_id, body, created_at)
    SELECT
      v_conv_id,
      gen_random_uuid(),
      'History message ' || s.num || ' in conv ' || i,
      clock_timestamp() - interval '2 days' + (s.num * interval '1 minute')
    FROM generate_series(1, 990) AS s(num);

    -- Seed 10 recent messages from peer user (auth.uid() = v_peer_user, to populate unread count)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_peer_user::text, 'role', 'authenticated')::text, true);

    INSERT INTO public.messages (conversation_id, client_id, body, created_at)
    SELECT
      v_conv_id,
      gen_random_uuid(),
      'Recent incoming unread message ' || s.num || ' in conv ' || i,
      clock_timestamp() - interval '5 minutes' + (s.num * interval '10 seconds')
    FROM generate_series(1, 10) AS s(num);

  END LOOP;

  RAISE NOTICE 'Seeded 50 conversations and 50,000 messages.';
END $$;

-- 3. Set Context as Target User and Run Benchmark Query
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- Performance verification using EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM public.list_conversations();

ROLLBACK;
