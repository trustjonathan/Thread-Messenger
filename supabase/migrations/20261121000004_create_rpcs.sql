-- Migration: 20261121000004_create_rpcs.sql
-- Description: Hardened RPCs with fixed search_path = public, private, pg_temp, strict rate limits, and co-located privilege grants.

-- 1. get_or_create_direct_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_conv_id uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF p_other_user_id IS NULL OR v_auth_id = p_other_user_id THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  -- Block check: generic failure without leaking block existence
  IF private.is_blocked_between(v_auth_id, p_other_user_id) THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  v_low := LEAST(v_auth_id, p_other_user_id);
  v_high := GREATEST(v_auth_id, p_other_user_id);

  -- Transaction-scoped advisory lock on sorted canonical pair
  PERFORM pg_advisory_xact_lock(hashtext(v_low::text), hashtext(v_high::text));

  -- Check if conversation already exists
  SELECT conversation_id INTO v_conv_id
  FROM public.direct_conversation_pairs
  WHERE user_low_id = v_low AND user_high_id = v_high;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Enforce daily creation rate limit (max 50 new direct conversations per 24 hours)
  IF NOT private.check_rate_limit('conv_create:' || v_auth_id::text, 50, interval '24 hours') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- Create conversation
  INSERT INTO public.conversations (kind) VALUES ('direct') RETURNING id INTO v_conv_id;

  INSERT INTO public.direct_conversation_pairs (conversation_id, user_low_id, user_high_id)
  VALUES (v_conv_id, v_low, v_high);

  INSERT INTO public.conversation_members (conversation_id, user_id, last_read_at)
  VALUES (v_conv_id, v_low, clock_timestamp()), (v_conv_id, v_high, clock_timestamp());

  RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;

-- 2. send_message (The Exclusive Writer for Messages)
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
  v_other_user_id uuid;
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

  IF NOT private.is_conversation_member(p_conversation_id) THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  -- Check block status with conversation peer
  SELECT user_id INTO v_other_user_id
  FROM public.conversation_members
  WHERE conversation_id = p_conversation_id AND user_id <> v_auth_id;

  IF v_other_user_id IS NOT NULL AND private.is_blocked_between(v_auth_id, v_other_user_id) THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  -- Rate limit check: max 60 messages per 60 seconds
  IF NOT private.check_rate_limit('msg:' || v_auth_id::text, 60, interval '60 seconds') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent insert: duplicate (sender_id, client_id) will not insert
  INSERT INTO public.messages (conversation_id, sender_id, client_id, body)
  VALUES (p_conversation_id, v_auth_id, p_client_id, v_clean_body)
  ON CONFLICT (sender_id, client_id) DO NOTHING;

  -- Return either original or newly inserted row
  SELECT * INTO v_result
  FROM public.messages
  WHERE sender_id = v_auth_id AND client_id = p_client_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.send_message(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text, uuid) TO authenticated;

-- 3. list_conversations (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.list_conversations()
RETURNS TABLE (
  conversation_id uuid,
  created_at timestamptz,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  last_message_id uuid,
  last_message_body text,
  last_message_sender_id uuid,
  last_message_created_at timestamptz,
  unread_count bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, private, pg_temp
AS $$
  SELECT
    c.id AS conversation_id,
    c.created_at AS created_at,
    other_p.id AS other_user_id,
    other_p.username AS other_username,
    other_p.display_name AS other_display_name,
    lm.id AS last_message_id,
    SUBSTRING(lm.body FROM 1 FOR 100) AS last_message_body,
    lm.sender_id AS last_message_sender_id,
    lm.created_at AS last_message_created_at,
    COALESCE(unread.count, 0) AS unread_count
  FROM public.conversation_members cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  JOIN public.conversation_members other_cm
    ON other_cm.conversation_id = c.id AND other_cm.user_id <> cm.user_id
  JOIN public.profiles other_p ON other_p.id = other_cm.user_id
  LEFT JOIN LATERAL (
    SELECT m.id, m.body, m.sender_id, m.created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT LEAST(count(*), 100) AS count
    FROM (
      SELECT 1
      FROM public.messages m
      WHERE m.conversation_id = c.id
        AND m.sender_id <> cm.user_id
        AND m.created_at > cm.last_read_at
      LIMIT 100
    ) sub
  ) unread ON true
  WHERE cm.user_id = auth.uid()
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.list_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_conversations() TO authenticated;

-- 4. search_user_by_username (VOLATILE, Rate-Limited, Exact Match Only)
CREATE OR REPLACE FUNCTION public.search_user_by_username(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_clean text;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  v_clean := lower(trim(COALESCE(p_username, '')));
  IF length(v_clean) = 0 THEN
    RETURN;
  END IF;

  -- Rate limit 1: 30 per 60 seconds
  IF NOT private.check_rate_limit('search_m:' || v_auth_id::text, 30, interval '60 seconds') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- Rate limit 2: 500 per 24 hours
  IF NOT private.check_rate_limit('search_d:' || v_auth_id::text, 500, interval '24 hours') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- Exact match query (never wildcard or substring)
  RETURN QUERY
  SELECT p.id, p.username, p.display_name
  FROM public.profiles p
  WHERE p.username = v_clean;
END;
$$;

REVOKE ALL ON FUNCTION public.search_user_by_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_user_by_username(text) TO authenticated;

-- 5. set_username (One-Time Username Selection)
CREATE OR REPLACE FUNCTION public.set_username(p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_clean text;
  v_already_set boolean;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  v_clean := lower(trim(COALESCE(p_username, '')));
  IF v_clean !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0001';
  END IF;

  IF v_clean IN ('admin', 'administrator', 'system', 'support', 'help', 'root', 'moderator', 'official', 'null', 'undefined', 'thread', 'messenger') THEN
    RAISE EXCEPTION 'USERNAME_RESERVED' USING ERRCODE = 'P0001';
  END IF;

  SELECT username_set INTO v_already_set
  FROM public.profiles
  WHERE id = v_auth_id;

  IF v_already_set IS TRUE THEN
    RAISE EXCEPTION 'USERNAME_ALREADY_SET' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    UPDATE public.profiles
    SET username = v_clean, username_set = true
    WHERE id = v_auth_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'USERNAME_TAKEN' USING ERRCODE = 'P0001';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.set_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_username(text) TO authenticated;

-- 6. mark_read
CREATE OR REPLACE FUNCTION public.mark_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0001';
  END IF;

  IF NOT private.is_conversation_member(p_conversation_id) THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.conversation_members
  SET last_read_at = clock_timestamp()
  WHERE conversation_id = p_conversation_id AND user_id = v_auth_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_read(uuid) TO authenticated;

-- 7. report_content (Sole Writer for Reports)
CREATE OR REPLACE FUNCTION public.report_content(
  p_message_id uuid,
  p_user_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_clean_reason text;
  v_conv_id uuid;
  v_report_id uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  v_clean_reason := trim(COALESCE(p_reason, ''));
  IF length(v_clean_reason) < 3 OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0001';
  END IF;

  IF p_message_id IS NULL AND p_user_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0001';
  END IF;

  -- Rate limit: max 10 reports per hour
  IF NOT private.check_rate_limit('report:' || v_auth_id::text, 10, interval '1 hour') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- If reporting a message: reporter must be an active member of that conversation
  IF p_message_id IS NOT NULL THEN
    SELECT conversation_id INTO v_conv_id
    FROM public.messages
    WHERE id = p_message_id;

    IF v_conv_id IS NULL OR NOT private.is_conversation_member(v_conv_id) THEN
      RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- If reporting a user: cannot report self
  IF p_user_id IS NOT NULL AND p_user_id = v_auth_id THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reports (reporter_id, message_id, user_id, reason, created_at)
  VALUES (v_auth_id, p_message_id, p_user_id, v_clean_reason, clock_timestamp())
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_content(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content(uuid, uuid, text) TO authenticated;

-- 8. update_last_seen
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- Rate limit: at most 1 update per 10 seconds
  IF private.check_rate_limit('seen:' || v_auth_id::text, 1, interval '10 seconds') THEN
    UPDATE public.profiles
    SET last_seen_at = clock_timestamp()
    WHERE id = v_auth_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated;
