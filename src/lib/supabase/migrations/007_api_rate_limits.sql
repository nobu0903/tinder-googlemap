-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Shared API rate-limit counters (cross serverless instance)
-- Run once in Supabase Dashboard → SQL Editor.
-- Safe to re-run. Execute is granted only to service_role.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_rate_buckets (
  bucket_key   text        PRIMARY KEY,
  hit_count    integer     NOT NULL,
  window_start timestamptz NOT NULL
);

ALTER TABLE api_rate_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_rate_buckets_service_all" ON api_rate_buckets;
CREATE POLICY "api_rate_buckets_service_all"
  ON api_rate_buckets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE api_rate_buckets FROM anon, authenticated;

CREATE OR REPLACE FUNCTION consume_api_rate_limit(
  p_key text,
  p_window_ms integer,
  p_max integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_start timestamptz;
  v_now timestamptz := clock_timestamp();
  v_window interval := make_interval(secs => p_window_ms / 1000.0);
BEGIN
  IF p_key IS NULL OR length(p_key) < 1 OR length(p_key) > 200
     OR p_max < 1 OR p_window_ms < 1000 THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after_sec', 60);
  END IF;

  INSERT INTO api_rate_buckets (bucket_key, hit_count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    hit_count = CASE
      WHEN api_rate_buckets.window_start + v_window <= v_now THEN 1
      ELSE api_rate_buckets.hit_count + 1
    END,
    window_start = CASE
      WHEN api_rate_buckets.window_start + v_window <= v_now THEN v_now
      ELSE api_rate_buckets.window_start
    END
  RETURNING hit_count, window_start INTO v_count, v_start;

  IF v_count > p_max THEN
    UPDATE api_rate_buckets
    SET hit_count = p_max
    WHERE bucket_key = p_key AND hit_count > p_max;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_sec', GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (v_start + v_window - v_now)))::int
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max - v_count,
    'retry_after_sec', GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_start + v_window - v_now)))::int
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION consume_api_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_api_rate_limit(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION consume_api_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION consume_api_rate_limit(text, integer, integer) TO service_role;
