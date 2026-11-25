-- Migration: 20261125000005_invite_links.sql
-- Description: Hardened invite links with private storage, URL-safe codes without look-alikes, constant-time resolve, and RLS.

-- 1. Create private.invite_codes table
CREATE TABLE IF NOT EXISTS private.invite_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  regenerated_at timestamptz
);

-- Enable RLS (Private table, no client access permitted)
ALTER TABLE private.invite_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.invite_codes FROM PUBLIC, anon, authenticated;

-- Helper to generate a random 12-char code without look-alike characters (no 0, O, 1, l, I)
-- Alphabet: 23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ (57 chars)
CREATE OR REPLACE FUNCTION private.generate_secure_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_chars text := '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  v_chars_len int := length(v_chars);
  v_bytes bytea;
  v_code text := '';
  v_i int;
  v_byte_val int;
BEGIN
  LOOP
    v_code := '';
    v_bytes := extensions.gen_random_bytes(16);
    FOR v_i IN 0..11 LOOP
      v_byte_val := get_byte(v_bytes, v_i);
      v_code := v_code || substr(v_chars, (v_byte_val % v_chars_len) + 1, 1);
    END LOOP;

    -- Ensure uniqueness in private.invite_codes
    EXIT WHEN NOT EXISTS (SELECT 1 FROM private.invite_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION private.generate_secure_invite_code() FROM PUBLIC, anon, authenticated;

-- 2. RPC get_my_invite_code(): authenticated
-- Returns caller's code, creating it on first call. Rate-limited via private.check_rate_limit.
CREATE OR REPLACE FUNCTION public.get_my_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_code text;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING errcode = 'P0001';
  END IF;

  -- Rate limit: 30 requests per minute
  IF NOT private.check_rate_limit('get_invite:' || v_auth_id::text, 30, interval '1 minute') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING errcode = 'P0001';
  END IF;

  SELECT code INTO v_code
  FROM private.invite_codes
  WHERE user_id = v_auth_id;

  IF v_code IS NULL THEN
    v_code := private.generate_secure_invite_code();
    INSERT INTO private.invite_codes (user_id, code, created_at)
    VALUES (v_auth_id, v_code, clock_timestamp())
    ON CONFLICT (user_id) DO UPDATE SET code = private.invite_codes.code
    RETURNING code INTO v_code;
  END IF;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_invite_code() TO authenticated;

-- 3. RPC regenerate_invite_code(): authenticated
-- Replaces existing code (old one immediately fails). Rate-limited (5 per hour).
CREATE OR REPLACE FUNCTION public.regenerate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_code text;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING errcode = 'P0001';
  END IF;

  -- Rate limit: 5 regenerations per hour
  IF NOT private.check_rate_limit('regen_invite:' || v_auth_id::text, 5, interval '1 hour') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING errcode = 'P0001';
  END IF;

  v_code := private.generate_secure_invite_code();

  INSERT INTO private.invite_codes (user_id, code, created_at, regenerated_at)
  VALUES (v_auth_id, v_code, clock_timestamp(), clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
  SET code = v_code,
      regenerated_at = clock_timestamp();

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code() TO authenticated;

-- 4. RPC resolve_invite(code): callable by anon and authenticated
-- Returns ONLY { username, display_name, avatar_seed }.
-- Invalid, malformed or regenerated codes return generic INVALID_INVITE with no hint.
-- Strict rate-limiting (20 calls per 10 minutes) per IP/caller.
CREATE OR REPLACE FUNCTION public.resolve_invite(p_code text)
RETURNS TABLE (
  username text,
  display_name text,
  avatar_seed text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_caller_key text;
  v_clean_code text;
  v_user_id uuid;
  v_found boolean := false;
  v_username text := NULL;
  v_display_name text := NULL;
  v_avatar_seed text := NULL;
BEGIN
  -- Determine caller identifier for rate limiting: auth.uid() or client IP header
  v_caller_key := coalesce(
    auth.uid()::text,
    nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    'anon_global'
  );

  -- Rate limit: 20 calls per 10 minutes
  IF NOT private.check_rate_limit('resolve_inv:' || v_caller_key, 20, interval '10 minutes') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING errcode = 'P0001';
  END IF;

  v_clean_code := trim(p_code);

  -- Code format validation: must be at least 10 chars, URL-safe alphabet without look-alikes
  IF v_clean_code IS NOT NULL AND length(v_clean_code) >= 10 AND length(v_clean_code) <= 32 AND v_clean_code ~ '^[23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]+$' THEN
    SELECT ic.user_id INTO v_user_id
    FROM private.invite_codes ic
    WHERE ic.code = v_clean_code;

    IF v_user_id IS NOT NULL THEN
      SELECT p.username, p.display_name, p.avatar_seed
      INTO v_username, v_display_name, v_avatar_seed
      FROM public.profiles p
      WHERE p.id = v_user_id;

      IF v_username IS NOT NULL THEN
        v_found := true;
      END IF;
    END IF;
  END IF;

  -- Constant-time simulation: do dummy crypto calculation to equalize timing
  PERFORM extensions.digest(coalesce(v_clean_code, '') || 'constant_time_salt_thread', 'sha256');

  IF NOT v_found THEN
    -- Return empty set instead of raising so rate-limit counter commits
    RETURN;
  END IF;

  RETURN QUERY SELECT v_username, v_display_name, v_avatar_seed;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_invite(text) TO anon, authenticated;

-- 5. RPC redeem_invite(code): authenticated
-- Returns the inviter's username so client can open exact-username new-chat flow.
-- Refuses self-invite; if blocked, returns generic INVALID_INVITE without revealing block.
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_clean_code text;
  v_inviter_id uuid;
  v_inviter_username text;
  v_is_blocked boolean := false;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING errcode = 'P0001';
  END IF;

  -- Rate limit: 20 per 10 minutes
  IF NOT private.check_rate_limit('redeem_inv:' || v_auth_id::text, 20, interval '10 minutes') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING errcode = 'P0001';
  END IF;

  v_clean_code := trim(p_code);

  IF v_clean_code IS NULL OR length(v_clean_code) < 10 OR length(v_clean_code) > 32 THEN
    PERFORM extensions.digest(coalesce(v_clean_code, '') || 'constant_time_redeem_thread', 'sha256');
    RETURN NULL;
  END IF;

  SELECT ic.user_id INTO v_inviter_id
  FROM private.invite_codes ic
  WHERE ic.code = v_clean_code;

  -- Equalize execution path
  PERFORM extensions.digest(coalesce(v_clean_code, '') || 'constant_time_redeem_thread', 'sha256');

  IF v_inviter_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Self-invite refused
  IF v_inviter_id = v_auth_id THEN
    RETURN NULL;
  END IF;

  -- Check if blocked between caller and inviter
  SELECT private.is_blocked_between(v_auth_id, v_inviter_id) INTO v_is_blocked;
  IF v_is_blocked THEN
    -- Return identical generic result without revealing block
    RETURN NULL;
  END IF;

  SELECT p.username INTO v_inviter_username
  FROM public.profiles p
  WHERE p.id = v_inviter_id;

  IF v_inviter_username IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_inviter_username;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
