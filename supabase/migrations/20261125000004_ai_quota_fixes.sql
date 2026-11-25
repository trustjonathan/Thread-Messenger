-- Migration: 20261125000004_ai_quota_fixes.sql
-- Description: Fix missing RETURN statements, stale v_row values after UPDATE,
--              and expired-cooldown display in get_ai_quota / consume_ai_prompt / refund_ai_prompt.

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
  v_batch_size      int  := 5;
  v_daily_cap       int  := 10;
  v_daily_reset     interval := interval '24 hours';
  v_row             private.ai_usage%ROWTYPE;
  v_now             timestamptz := clock_timestamp();
  v_remaining       int;
  v_used_today      int;
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
      v_batch_size,
      v_batch_size,
      0,
      v_daily_cap,
      NULL::timestamptz,
      v_now;
    RETURN;
  END IF;

  -- Daily reset check (read-only in STABLE function; compute effective values)
  IF v_now - v_row.day_started_at >= v_daily_reset THEN
    RETURN QUERY SELECT
      v_batch_size,
      v_batch_size,
      0,
      v_daily_cap,
      NULL::timestamptz,
      v_now;
    RETURN;
  END IF;

  v_used_today := COALESCE(v_row.day_count, 0);

  IF v_used_today >= v_daily_cap THEN
    v_remaining := 0;
    v_locked_until := v_row.day_started_at + v_daily_reset;
  ELSIF v_row.cooldown_until IS NOT NULL AND v_now < v_row.cooldown_until THEN
    v_remaining := 0;
    v_locked_until := v_row.cooldown_until;
  ELSIF v_row.cooldown_until IS NOT NULL AND v_now >= v_row.cooldown_until THEN
    -- 5-hour rest has elapsed: next batch of 5 is available
    v_remaining := LEAST(v_batch_size, v_daily_cap - v_used_today);
    v_locked_until := NULL;
  ELSE
    v_remaining := GREATEST(v_batch_size - COALESCE(v_row.batch_count, 0), 0);
    v_locked_until := NULL;
  END IF;

  RETURN QUERY SELECT
    v_remaining,
    v_batch_size,
    v_used_today,
    v_daily_cap,
    v_locked_until,
    v_now;
END;
$$;

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
  v_batch_size      int  := 5;
  v_batch_cooldown  interval := interval '5 hours';
  v_daily_cap       int  := 10;
  v_daily_reset     interval := interval '24 hours';
  v_row             private.ai_usage%ROWTYPE;
  v_now             timestamptz := clock_timestamp();
  v_allowed         boolean := false;
  v_remaining       int;
  v_locked_until    timestamptz;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF current_setting('app.ai_enabled', true) = 'false' THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM private.ai_usage
  WHERE user_id = v_auth_id
  FOR UPDATE;

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
    v_remaining := 0;
  -- Cooldown check
  ELSIF v_row.cooldown_until IS NOT NULL AND v_now < v_row.cooldown_until THEN
    v_allowed := false;
    v_locked_until := v_row.cooldown_until;
    v_remaining := 0;
  -- Cooldown expired: reset batch and consume 1st prompt of new batch
  ELSIF v_row.cooldown_until IS NOT NULL AND v_now >= v_row.cooldown_until THEN
    v_allowed := true;
    UPDATE private.ai_usage
    SET batch_count = 1,
        day_count   = day_count + 1,
        cooldown_until = NULL,
        updated_at   = v_now
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;
    v_remaining := GREATEST(v_batch_size - v_row.batch_count, 0);
    v_locked_until := NULL;
  -- Batch exhausted without cooldown set (safety): set cooldown, deny
  ELSIF COALESCE(v_row.batch_count, 0) >= v_batch_size THEN
    v_locked_until := v_now + v_batch_cooldown;
    UPDATE private.ai_usage
    SET cooldown_until = v_locked_until,
        updated_at   = v_now
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;
    v_allowed := false;
    v_remaining := 0;
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
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;

    v_remaining := GREATEST(v_batch_size - v_row.batch_count, 0);
    IF v_row.day_count >= v_daily_cap THEN
      v_locked_until := v_row.day_started_at + v_daily_reset;
    ELSE
      v_locked_until := v_row.cooldown_until;
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_allowed,
    v_remaining,
    v_batch_size,
    COALESCE(v_row.day_count, 0),
    v_daily_cap,
    v_locked_until,
    v_now;
END;
$$;

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
  v_batch_size      int  := 5;
  v_daily_cap       int  := 10;
  v_daily_reset     interval := interval '24 hours';
  v_row             private.ai_usage%ROWTYPE;
  v_now             timestamptz := clock_timestamp();
  v_refunded        boolean := false;
  v_remaining       int;
  v_locked_until    timestamptz;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF current_setting('app.ai_enabled', true) = 'false' THEN
    RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM private.ai_usage
  WHERE user_id = v_auth_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      v_batch_size,
      v_batch_size,
      0,
      v_daily_cap,
      NULL::timestamptz,
      v_now;
    RETURN;
  END IF;

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

  IF COALESCE(v_row.batch_count, 0) > 0 THEN
    v_refunded := true;
    UPDATE private.ai_usage
    SET batch_count = batch_count - 1,
        day_count   = GREATEST(day_count - 1, 0),
        cooldown_until = NULL,
        updated_at   = v_now
    WHERE user_id = v_auth_id
    RETURNING * INTO v_row;
  END IF;

  v_remaining := GREATEST(v_batch_size - COALESCE(v_row.batch_count, 0), 0);

  IF COALESCE(v_row.day_count, 0) >= v_daily_cap THEN
    v_locked_until := v_row.day_started_at + v_daily_reset;
  ELSE
    v_locked_until := NULL;
  END IF;

  RETURN QUERY SELECT
    v_refunded,
    v_remaining,
    v_batch_size,
    COALESCE(v_row.day_count, 0),
    v_daily_cap,
    v_locked_until,
    v_now;
END;
$$;
