-- Thread AI is now unrestricted, and group sends are hardened.
--
-- The previous quota implementation (5 prompts / 5h cooldown, 10/day) was
-- enforced by public.get_ai_quota(), public.consume_ai_prompt(),
-- public.refund_ai_prompt() and private.ai_usage. The Edge Function no longer
-- calls any of these objects, so we remove them here to avoid stale counters,
-- dead RPCs in the API surface, and an obsolete DB-level kill switch.
--
-- Forward-only migration: earlier quota migrations are left untouched so
-- already-applied environments remain replayable.

DROP POLICY IF EXISTS ai_usage_select_own ON private.ai_usage;
DROP TABLE IF EXISTS private.ai_usage;

DROP FUNCTION IF EXISTS public.get_ai_quota();
DROP FUNCTION IF EXISTS public.consume_ai_prompt();
DROP FUNCTION IF EXISTS public.refund_ai_prompt();

-- Harden send_message for groups: the original single-peer SELECT only checked
-- one other member. Check every active member, and reject removed members.
CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id uuid,
  p_body text,
  p_client_id uuid
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_clean_body text;
  v_result public.messages;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF p_conversation_id IS NULL OR p_body IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0001';
  END IF;

  v_clean_body := trim(p_body);
  IF length(v_clean_body) < 1 OR length(p_body) > 2000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0001';
  END IF;

  IF NOT private.is_active_conversation_member(p_conversation_id) THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  -- Block if the caller has a block relationship with ANY active member.
  IF EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.removed_at IS NULL
      AND cm.user_id <> v_auth_id
      AND private.is_blocked_between(v_auth_id, cm.user_id)
  ) THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT private.check_rate_limit('msg:' || v_auth_id::text, 60, interval '60 seconds') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, client_id, body)
  VALUES (p_conversation_id, v_auth_id, p_client_id, v_clean_body)
  ON CONFLICT (sender_id, client_id) DO NOTHING;

  SELECT * INTO v_result
  FROM public.messages
  WHERE sender_id = v_auth_id AND client_id = p_client_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.send_message(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, uuid) TO authenticated;
