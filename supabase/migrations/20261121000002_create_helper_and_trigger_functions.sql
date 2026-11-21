-- Migration: 20261121000002_create_helper_and_trigger_functions.sql
-- Description: Helper and trigger functions placed in schema private with strict permissions.

-- 1. Grant Schema Usage (Required for authenticated RLS evaluation of private functions)
GRANT USAGE ON SCHEMA private TO authenticated;

-- 2. Atomic Fixed-Window Rate Limiter
CREATE OR REPLACE FUNCTION private.check_rate_limit(
  p_key text,
  p_max int,
  p_window interval
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  INSERT INTO private.rate_limits AS rl (key, count, window_start)
  VALUES (p_key, 1, clock_timestamp())
  ON CONFLICT (key) DO UPDATE
  SET count = CASE
        WHEN clock_timestamp() - rl.window_start >= p_window THEN 1
        ELSE rl.count + 1
      END,
      window_start = CASE
        WHEN clock_timestamp() - rl.window_start >= p_window THEN clock_timestamp()
        ELSE rl.window_start
      END
  RETURNING (count <= p_max) INTO v_allowed;

  RETURN v_allowed;
END;
$$;

-- check_rate_limit is internal; no client role gets direct execution grants
REVOKE ALL ON FUNCTION private.check_rate_limit(text, int, interval) FROM PUBLIC, anon, authenticated;

-- 3. Conversation Membership Helper (Used in RLS and RPCs)
CREATE OR REPLACE FUNCTION private.is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.is_conversation_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_conversation_member(uuid) TO authenticated;

-- 4. Bidirectional Block Checker Helper
CREATE OR REPLACE FUNCTION private.is_blocked_between(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = p_a AND blocked_id = p_b)
       OR (blocker_id = p_b AND blocked_id = p_a)
  );
$$;

REVOKE ALL ON FUNCTION private.is_blocked_between(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_blocked_between(uuid, uuid) TO authenticated;

-- 5. Message Integrity Trigger Function (Enforces Server Values)
CREATE OR REPLACE FUNCTION private.enforce_message_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  NEW.id := gen_random_uuid();
  NEW.created_at := clock_timestamp();
  NEW.sender_id := auth.uid();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_message_integrity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_message_integrity
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.enforce_message_integrity();

-- 6. Signup Trigger Function on auth.users
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_raw_username text;
  v_clean_username text;
  v_candidate text;
  v_display_name text;
  v_is_user_chosen boolean := false;
  v_retry_count int := 0;
  v_inserted boolean := false;
  v_salt text;
BEGIN
  -- Extract and sanitize requested username from metadata
  v_raw_username := lower(trim(COALESCE(NEW.raw_user_meta_data->>'username', '')));
  -- Strip non-alphanumeric/underscore characters
  v_clean_username := regexp_replace(v_raw_username, '[^a-z0-9_]', '', 'g');

  -- Reserved usernames check
  IF v_clean_username IN ('admin', 'administrator', 'system', 'support', 'help', 'root', 'moderator', 'official', 'null', 'undefined', 'thread', 'messenger') THEN
    v_clean_username := '';
  END IF;

  -- If candidate length is valid [3..30], attempt to use it
  IF length(v_clean_username) >= 3 AND length(v_clean_username) <= 30 THEN
    v_candidate := v_clean_username;
    v_is_user_chosen := true;
  ELSE
    -- Deterministic fallback: prefix 'u_' and up to 16 hex chars (total length <= 18 <= 30)
    v_candidate := 'u_' || substr(replace(NEW.id::text, '-', ''), 1, 16);
    v_is_user_chosen := false;
  END IF;

  -- Display name safely truncated to 50 chars
  v_display_name := SUBSTRING(
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(v_clean_username, ''),
      'User'
    )
    FROM 1 FOR 50
  );

  -- Safe insertion loop: catches unique_violation without raising
  WHILE NOT v_inserted AND v_retry_count < 5 LOOP
    BEGIN
      INSERT INTO public.profiles (
        id,
        username,
        display_name,
        username_set,
        created_at
      ) VALUES (
        NEW.id,
        v_candidate,
        v_display_name,
        v_is_user_chosen,
        clock_timestamp()
      );
      v_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      v_retry_count := v_retry_count + 1;
      v_is_user_chosen := false;
      -- Generate salted candidate guaranteed to fit in 30 characters
      v_salt := substr(md5(random()::text), 1, 4);
      -- base length 24 + 1 underscore + 4 salt = 29 characters max
      v_candidate := SUBSTRING(
        COALESCE(NULLIF(v_clean_username, ''), 'u_' || substr(replace(NEW.id::text, '-', ''), 1, 12))
        FROM 1 FOR 24
      ) || '_' || v_salt;
    END;
  END LOOP;

  -- Absolute fallback if loop exceeded (random salt guaranteed unique)
  IF NOT v_inserted THEN
    v_candidate := 'u_' || substr(replace(NEW.id::text, '-', ''), 1, 12) || '_' || substr(md5(clock_timestamp()::text), 1, 8);
    -- 2 + 12 + 1 + 8 = 23 chars <= 30
    BEGIN
      INSERT INTO public.profiles (
        id,
        username,
        display_name,
        username_set,
        created_at
      ) VALUES (
        NEW.id,
        v_candidate,
        v_display_name,
        false,
        clock_timestamp()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Trigger must never block user registration
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
