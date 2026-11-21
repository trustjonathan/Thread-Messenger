-- Test 06: Anon Access Denial and Catalog Function Privilege Audit
-- Verifies: anon denied on all tables and RPCs; catalog audit guarantees zero anon execute permissions.

BEGIN;

-- 1. Test Anon Denied on All Tables
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);

DO $$
BEGIN
  BEGIN PERFORM * FROM public.profiles; RAISE EXCEPTION 'anon can select profiles'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.conversations; RAISE EXCEPTION 'anon can select conversations'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.conversation_members; RAISE EXCEPTION 'anon can select conversation_members'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.messages; RAISE EXCEPTION 'anon can select messages'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.blocks; RAISE EXCEPTION 'anon can select blocks'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.reports; RAISE EXCEPTION 'anon can select reports'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM public.direct_conversation_pairs; RAISE EXCEPTION 'anon can select direct_conversation_pairs'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM private.rate_limits; RAISE EXCEPTION 'anon can select private.rate_limits'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 2. Test Anon Denied on All RPCs
DO $$
DECLARE
  v_fake_uuid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  BEGIN PERFORM public.get_or_create_direct_conversation(v_fake_uuid); RAISE EXCEPTION 'anon can execute get_or_create'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.send_message(v_fake_uuid, 'test', v_fake_uuid); RAISE EXCEPTION 'anon can execute send_message'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.list_conversations(); RAISE EXCEPTION 'anon can execute list_conversations'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.search_user_by_username('test'); RAISE EXCEPTION 'anon can execute search_user'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.set_username('test'); RAISE EXCEPTION 'anon can execute set_username'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.mark_read(v_fake_uuid); RAISE EXCEPTION 'anon can execute mark_read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.report_content(v_fake_uuid, NULL, 'reason'); RAISE EXCEPTION 'anon can execute report_content'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.update_last_seen(); RAISE EXCEPTION 'anon can execute update_last_seen'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Switch back to admin/postgres to inspect catalog
RESET ROLE;

-- 3. Catalog Audit: Assert anon has EXECUTE on ZERO functions in schemas public and private
DO $$
DECLARE
  v_leaked_count int;
  v_leaked_names text;
BEGIN
  SELECT count(*), string_agg(n.nspname || '.' || p.proname, ', ')
  INTO v_leaked_count, v_leaked_names
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_leaked_count > 0 THEN
    RAISE EXCEPTION 'CATALOG SECURITY AUDIT FAILED: Anon has EXECUTE on % function(s): %', v_leaked_count, v_leaked_names;
  END IF;
END $$;

-- 4. Reviewable List of Functions Executable by `authenticated`
-- This query outputs all executable functions in public and private for authenticated review
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
ORDER BY n.nspname, p.proname;

ROLLBACK;
