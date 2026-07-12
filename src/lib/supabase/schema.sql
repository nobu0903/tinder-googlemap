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
