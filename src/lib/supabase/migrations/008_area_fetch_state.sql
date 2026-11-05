-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Per-area Google fetch state (replaces spots.updated_at cooldowns)
-- Run once in Supabase Dashboard → SQL Editor.
-- Safe to re-run. Only service_role can read/write.
--
-- Why: the old cooldown looked at spots.updated_at, which photo refreshes and
-- the spots_updated_at trigger also bump, so busy areas never re-fetched.
-- Retry times here are written only after a Google search succeeds.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS area_fetch_state (
  area_key              text        PRIMARY KEY,
  primary_retry_after   timestamptz,
  vibe_retry_after      timestamptz,
  text_retry_after      timestamptz,
  text_next_page_token  text,
  text_pages_fetched    integer     NOT NULL DEFAULT 0,
  eligible_count        integer,
  lock_token            uuid,
  lock_expires_at       timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE area_fetch_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "area_fetch_state_service_all" ON area_fetch_state;
CREATE POLICY "area_fetch_state_service_all"
  ON area_fetch_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE area_fetch_state FROM anon, authenticated;

-- Take the per-area fetch lock when it is free or expired.
-- Returns { acquired, lock_expires_at } — lock_expires_at is the holder's expiry.
CREATE OR REPLACE FUNCTION try_lock_area_fetch(
  p_key text,
  p_token uuid,
  p_ttl_ms integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz;
  v_holder uuid;
BEGIN
  IF p_key IS NULL OR length(p_key) < 1 OR length(p_key) > 200
     OR p_token IS NULL OR p_ttl_ms < 1000 OR p_ttl_ms > 120000 THEN
    RETURN jsonb_build_object('acquired', false, 'lock_expires_at', v_now);
  END IF;

  INSERT INTO area_fetch_state (area_key, lock_token, lock_expires_at, updated_at)
  VALUES (p_key, p_token, v_now + make_interval(secs => p_ttl_ms / 1000.0), v_now)
  ON CONFLICT (area_key) DO UPDATE
  SET
    lock_token = EXCLUDED.lock_token,
    lock_expires_at = EXCLUDED.lock_expires_at,
    updated_at = v_now
  WHERE area_fetch_state.lock_expires_at IS NULL
     OR area_fetch_state.lock_expires_at <= v_now;

  SELECT lock_token, lock_expires_at INTO v_holder, v_expires
  FROM area_fetch_state
  WHERE area_key = p_key;

  RETURN jsonb_build_object(
    'acquired', v_holder = p_token,
    'lock_expires_at', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION try_lock_area_fetch(text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION try_lock_area_fetch(text, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION try_lock_area_fetch(text, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION try_lock_area_fetch(text, uuid, integer) TO service_role;
