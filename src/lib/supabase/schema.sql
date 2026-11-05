-- VibeLoop — Supabase SQL schema (idempotent / safe to re-run)
-- Run in Supabase Dashboard → SQL Editor → New query → Run
--
-- First-time setup: run this entire file once.
-- Already set up? Run only the migration you need:
--   migrations/001_add_address_to_spots.sql
--   migrations/002_add_primary_type_to_spots.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: spots  (Google Places cache layer)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spots (
    id               VARCHAR(255) PRIMARY KEY,   -- Google Place ID (e.g. ChIJ...)
    name             VARCHAR(255) NOT NULL,
    rating           NUMERIC(2, 1),
    user_rating_count INT,
    price_level      INT,                         -- 0–4  (¥ to ¥¥¥¥)
    lat              NUMERIC(10, 7) NOT NULL,
    lng              NUMERIC(10, 7) NOT NULL,
    address          TEXT,
    photos           JSONB,
    opening_hours    JSONB,
    primary_type     TEXT,                        -- Google primary type (restaurant, lodging, …)
    vibe_tags        VARCHAR(50)[],
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

-- Add columns for databases created before these fields existed
ALTER TABLE spots ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS primary_type TEXT;

CREATE INDEX IF NOT EXISTS idx_spots_geo  ON spots(lat, lng);
CREATE INDEX IF NOT EXISTS idx_spots_tags ON spots USING gin(vibe_tags);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spots_updated_at ON spots;
CREATE TRIGGER spots_updated_at
  BEFORE UPDATE ON spots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: swipes  (deduplication registry)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swipes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    spot_id    VARCHAR(255) REFERENCES spots(id)     ON DELETE CASCADE,
    action     VARCHAR(10)  NOT NULL CHECK (action IN ('like','dislike')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, spot_id)
);

CREATE INDEX IF NOT EXISTS idx_swipes_user ON swipes(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security (RLS) — drop + recreate so re-runs do not fail
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spots_public_read"   ON spots;
DROP POLICY IF EXISTS "spots_service_write" ON spots;
DROP POLICY IF EXISTS "swipes_own_read"     ON swipes;
DROP POLICY IF EXISTS "swipes_own_insert"   ON swipes;

CREATE POLICY "spots_public_read"
  ON spots FOR SELECT USING (true);

CREATE POLICY "spots_service_write"
  ON spots FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "swipes_own_read"
  ON swipes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "swipes_own_insert"
  ON swipes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: app_waitlist  (mobile app interest list)
-- Full migration: migrations/004_app_waitlist.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_waitlist (
    id               bigint       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    email            text         NOT NULL,
    wants_ios        boolean      NOT NULL DEFAULT false,
    wants_android    boolean      NOT NULL DEFAULT false,
    feature_requests text,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT app_waitlist_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS app_waitlist_created_at_idx ON app_waitlist (created_at);

ALTER TABLE app_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_waitlist_service_all" ON app_waitlist;
CREATE POLICY "app_waitlist_service_all"
  ON app_waitlist FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: feedback  (in-app guided feedback)
-- Full migration: migrations/005_feedback.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
    id           bigint       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    area         text         NOT NULL,
    kind         text         NOT NULL,
    message      text         NOT NULL,
    extra        text,
    email        text,
    user_id      uuid         REFERENCES auth.users ON DELETE SET NULL,
    source       text         NOT NULL DEFAULT 'settings',
    created_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT feedback_area_check CHECK (
      area IN ('swipe', 'explore', 'collection', 'login', 'ads', 'other')
    ),
    CONSTRAINT feedback_kind_check CHECK (
      kind IN ('bug', 'ux', 'feature', 'other')
    )
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at);
CREATE INDEX IF NOT EXISTS feedback_kind_idx ON feedback (kind);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_service_all" ON feedback;
CREATE POLICY "feedback_service_all"
  ON feedback FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: booking_clicks  (affiliate click telemetry)
-- Full migration: migrations/003_add_booking_fields.sql
-- RLS: migrations/006_booking_clicks_rls.sql
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_clicks (
    id           bigint       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    spot_id      text         NOT NULL,
    booking_url  text         NOT NULL,
    booking_tier smallint     NOT NULL DEFAULT 3,
    user_id      uuid         REFERENCES auth.users ON DELETE SET NULL,
    created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_clicks_spot_id_idx    ON booking_clicks (spot_id);
CREATE INDEX IF NOT EXISTS booking_clicks_created_at_idx ON booking_clicks (created_at);

ALTER TABLE booking_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_clicks_service_all" ON booking_clicks;
CREATE POLICY "booking_clicks_service_all"
  ON booking_clicks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE booking_clicks FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- API rate limits — migrations/007_api_rate_limits.sql
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-area Google fetch state — migrations/008_area_fetch_state.sql
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
