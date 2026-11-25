-- Migration: 20261125000003_ai_quota.sql
-- Description: AI quota table, RLS, and RPCs for consumption tracking.
--
-- NAMED CONSTANTS (change here -- used by all functions below)
--   AI_BATCH_SIZE        = 5 prompts per batch
--   AI_BATCH_COOLDOWN    = 5 hours between batches
--   AI_DAILY_CAP         = 10 prompts per 24-hour day
--   AI_DAILY_RESET       = 24 hours before full reset
-- These values are inlined in each function body for clarity; keep them in sync.

-- Enable schema usage for authenticated RLS evaluation of private functions
GRANT USAGE ON SCHEMA private TO authenticated;

-- Kill switch: custom GUC defaulting to enabled ('true').
-- Edge Function checks current_setting('app.ai_enabled', true) before calling
-- consume_ai_prompt. Set to 'false' to disable all AI traffic at the DB layer.
-- DEFAULT is applied per-session via the Edge Function; here we document intent.
-- No ALTER DATABASE needed; current_setting(..., true) returns NULL if unset,
-- and the functions treat NULL as enabled.

-- ---------------------------------------------------------------------------
-- 1. private.ai_usage table (per-user AI consumption tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.ai_usage (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_count    int NOT NULL DEFAULT 0 CHECK (batch_count >= 0 AND batch_count <= 5),
  day_count      int NOT NULL DEFAULT 0 CHECK (day_count >= 0 AND day_count <= 10),
  day_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cooldown_until timestamptz,
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at     timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE private.ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can only read their own row
CREATE POLICY ai_usage_select_own ON private.ai_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for client roles. RPCs are SECURITY DEFINER
-- and bypass RLS; they are the sole write path.
REVOKE ALL ON TABLE private.ai_usage FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. public.get_ai_quota() -- read-only quota state (callable by authenticated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ai_quota()
RETURNS TABLE (
  remaining_in_batch int,
  batch_size         int,
  used_today         int,
  daily_cap          int,
  locked_until       timestamptz,
  server_now         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id         uuid := auth.uid();
  v_batch_size      int  := 5;                       -- AI_BATCH_SIZE
  v_batch_cooldown  interval := interval '5 hours';  -- AI_BATCH_COOLDOWN
  v_daily_cap       int  := 10;                      -- AI_DAILY_CAP
  v_daily_reset     interval := interval '24 hours'; -- AI_DAILY_RESET
  v_row             private.ai_usage%ROWTYPE;
  v_now             timestamptz := clock_timestamp();
  v_remaining       int;
  v_locked_until    timestamptz;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_row
  FROM private.ai_usage
  WHERE user_id = v_auth_id;

  -- No row yet: user has never consumed a prompt
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      v_batch_size                            AS remaining_in_batch,
      v_batch_size                            AS batch_size,
      0                                       AS used_today,
      v_daily_cap                             AS daily_cap,
      NULL::timestamptz                       AS locked_until,
      v_now                                   AS server_now;
  END IF;

  -- Daily reset: if 24h elapsed since day_started_at, reset everything
  IF v_now - v_row.day_started_at >= v_daily_reset THEN
    UPDATE private.ai_usage
    SET batch_count = 0,
        day_count   = 0,
        day_started_at = v_now,
        cooldown_until = NULL,
        updated_at   = v_now
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;
  END IF;

  -- Compute remaining in batch
  v_remaining := GREATEST(v_batch_size - COALESCE(v_row.batch_count, 0), 0);

  -- Compute locked_until
  IF v_row.cooldown_until IS NOT NULL AND v_now < v_row.cooldown_until THEN
    v_locked_until := v_row.cooldown_until;
  ELSIF COALESCE(v_row.day_count, 0) >= v_daily_cap THEN
    v_locked_until := v_row.day_started_at + v_daily_reset;
  ELSE
    v_locked_until := NULL;
  END IF;

  RETURN QUERY SELECT
    v_remaining                                  AS remaining_in_batch,
    v_batch_size                                 AS batch_size,
    COALESCE(v_row.day_count, 0)                 AS used_today,
    v_daily_cap                                  AS daily_cap,
    v_locked_until                               AS locked_until,
    v_now                                        AS server_now;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. public.consume_ai_prompt() -- consume one prompt if allowed (service role only)
--    Called by Edge Function BEFORE Gemini. SELECT ... FOR UPDATE prevents
--    concurrent over-consumption.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_ai_prompt()
RETURNS TABLE (
  allowed          boolean,
  remaining_in_batch int,
  batch_size         int,
  used_today         int,
  daily_cap          int,
  locked_until       timestamptz,
  server_now         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id         uuid := auth.uid();
  v_batch_size      int  := 5;                       -- AI_BATCH_SIZE
  v_batch_cooldown  interval := interval '5 hours';  -- AI_BATCH_COOLDOWN
  v_daily_cap       int  := 10;                      -- AI_DAILY_CAP
  v_daily_reset     interval := interval '24 hours'; -- AI_DAILY_RESET
  v_row             private.ai_usage%ROWTYPE;
  v_now             timestamptz := clock_timestamp();
  v_allowed         boolean := false;
  v_remaining       int;
  v_locked_until    timestamptz;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- AI_ENABLED kill switch: deny if explicitly disabled
  IF current_setting('app.ai_enabled', true) = 'false' THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the user's row to serialize concurrent consumption
  SELECT * INTO v_row
  FROM private.ai_usage
  WHERE user_id = v_auth_id
  FOR UPDATE;

  -- Initialize row if not exists
  IF NOT FOUND THEN
    INSERT INTO private.ai_usage (
      user_id, batch_count, day_count, day_started_at, cooldown_until, updated_at
    ) VALUES (v_auth_id, 0, 0, v_now, NULL, v_now)
    RETURNING * INTO v_row;
  END IF;

  -- Daily reset: if 24h elapsed since day_started_at, reset everything
  IF v_now - v_row.day_started_at >= v_daily_reset THEN
    UPDATE private.ai_usage
    SET batch_count = 0,
        day_count   = 0,
        day_started_at = v_now,
        cooldown_until = NULL,
        updated_at   = v_now
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;
  END IF;

  -- Daily cap check
  IF COALESCE(v_row.day_count, 0) >= v_daily_cap THEN
    v_allowed := false;
    v_locked_until := v_row.day_started_at + v_daily_reset;
  -- Cooldown check
  ELSIF v_row.cooldown_until IS NOT NULL AND v_now < v_row.cooldown_until THEN
    v_allowed := false;
    v_locked_until := v_row.cooldown_until;
  -- Cooldown expired: reset batch and clear cooldown (new batch unlocks)
  ELSIF v_row.cooldown_until IS NOT NULL AND v_now >= v_row.cooldown_until THEN
    UPDATE private.ai_usage
    SET batch_count = 0,
        cooldown_until = NULL,
        updated_at   = v_now
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;
    v_allowed := true;
    UPDATE private.ai_usage
    SET batch_count = batch_count + 1,
        day_count   = day_count + 1,
        cooldown_until = CASE
          WHEN batch_count + 1 >= v_batch_size THEN v_now + v_batch_cooldown
          ELSE NULL
        END,
        updated_at   = v_now
    WHERE user_id = v_auth_id;
    v_remaining := GREATEST(v_batch_size - 1, 0);
    v_locked_until := NULL;
  -- Batch exhausted but no cooldown set yet (safety): set cooldown, deny
  ELSIF COALESCE(v_row.batch_count, 0) >= v_batch_size THEN
    v_locked_until := v_now + v_batch_cooldown;
    UPDATE private.ai_usage
    SET cooldown_until = v_locked_until,
        updated_at   = v_now
    WHERE user_id = v_auth_id;
    v_allowed := false;
  -- Normal consumption
  ELSE
    v_allowed := true;
    UPDATE private.ai_usage
    SET batch_count = batch_count + 1,
        day_count   = day_count + 1,
        cooldown_until = CASE
          WHEN batch_count + 1 >= v_batch_size THEN v_now + v_batch_cooldown
          ELSE NULL
        END,
        updated_at   = v_now
    WHERE user_id = v_auth_id;
    v_remaining := GREATEST(v_batch_size - (v_row.batch_count + 1), 0);
    v_locked_until := NULL;
  END IF;

  RETURN QUERY SELECT
    v_allowed                                       AS allowed,
    GREATEST(v_batch_size - COALESCE(v_row.batch_count, 0), 0) AS remaining_in_batch,
    v_batch_size                                    AS batch_size,
    COALESCE(v_row.day_count, 0)                    AS used_today,
    v_daily_cap                                     AS daily_cap,
    v_locked_until                                  AS locked_until,
    v_now                                           AS server_now;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_prompt() FROM PUBLIC, anon;
-- Only service_role (Edge Function) may execute consume_ai_prompt
GRANT EXECUTE ON FUNCTION public.consume_ai_prompt() TO service_role;

-- ---------------------------------------------------------------------------
-- 4. public.refund_ai_prompt() -- decrement once, never below 0, never past reset
--    Called by Edge Function if Gemini fails after a successful consume.
--    Service role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_ai_prompt()
RETURNS TABLE (
  refunded         boolean,
  remaining_in_batch int,
  batch_size         int,
  used_today         int,
  daily_cap          int,
  locked_until       timestamptz,
  server_now         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_auth_id         uuid := auth.uid();
  v_batch_size      int  := 5;                       -- AI_BATCH_SIZE
  v_batch_cooldown  interval := interval '5 hours';  -- AI_BATCH_COOLDOWN
  v_daily_cap       int  := 10;                      -- AI_DAILY_CAP
  v_daily_reset     interval := interval '24 hours'; -- AI_DAILY_RESET
  v_row             private.ai_usage%ROWTYPE;
  v_now             timestamptz := clock_timestamp();
  v_refunded        boolean := false;
  v_remaining       int;
  v_locked_until    timestamptz;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- AI_ENABLED kill switch
  IF current_setting('app.ai_enabled', true) = 'false' THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the user's row
  SELECT * INTO v_row
  FROM private.ai_usage
  WHERE user_id = v_auth_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false                                       AS refunded,
      v_batch_size                                AS remaining_in_batch,
      v_batch_size                                AS batch_size,
      0                                           AS used_today,
      v_daily_cap                                 AS daily_cap,
      NULL::timestamptz                           AS locked_until,
      v_now                                       AS server_now;
  END IF;

  -- Daily reset check
  IF v_now - v_row.day_started_at >= v_daily_reset THEN
    UPDATE private.ai_usage
    SET batch_count = 0,
        day_count   = 0,
        day_started_at = v_now,
        cooldown_until = NULL,
        updated_at   = v_now
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;
  END IF;

  -- Refund: decrement batch_count once, never below 0; clear cooldown
  IF COALESCE(v_row.batch_count, 0) > 0 THEN
    v_refunded := true;
    UPDATE private.ai_usage
    SET batch_count = batch_count - 1,
        day_count   = GREATEST(day_count - 1, 0),
        cooldown_until = NULL,
        updated_at   = v_now
    WHERE user_id = v_auth_id;
  END IF;

  v_remaining := GREATEST(v_batch_size - COALESCE(v_row.batch_count, 0), 0);

  -- Recompute locked_until after refund
  IF COALESCE(v_row.day_count, 0) >= v_daily_cap THEN
    v_locked_until := v_row.day_started_at + v_daily_reset;
  ELSE
    v_locked_until := NULL;
  END IF;

  RETURN QUERY SELECT
    v_refunded                                      AS refunded,
    v_remaining                                     AS remaining_in_batch,
    v_batch_size                                    AS batch_size,
    COALESCE(v_row.day_count, 0)                    AS used_today,
    v_daily_cap                                     AS daily_cap,
    v_locked_until                                  AS locked_until,
    v_now                                           AS server_now;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_ai_prompt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ai_prompt() TO service_role;
