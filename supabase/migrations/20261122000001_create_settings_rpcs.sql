-- Migration: Add settings RPCs for listing blocked users and updating display name

-- 1. List blocked users
CREATE OR REPLACE FUNCTION public.list_blocked_users()
RETURNS TABLE (
  id uuid,
  username text,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.display_name
  FROM public.blocks b
  JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = v_caller_id
  ORDER BY b.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_blocked_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_blocked_users() TO authenticated;

-- 2. Update display name RPC (guarantees length 1-50)
CREATE OR REPLACE FUNCTION public.update_display_name(p_display_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_clean text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  v_clean := trim(p_display_name);
  IF v_clean IS NULL OR length(v_clean) < 1 OR length(v_clean) > 50 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Display name must be 1 to 50 characters.';
  END IF;

  UPDATE public.profiles
  SET display_name = v_clean
  WHERE id = v_caller_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_display_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_display_name(text) TO authenticated;
