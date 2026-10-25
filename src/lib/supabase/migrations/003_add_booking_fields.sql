-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Affiliate booking fields + booking-click analytics
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend the spots table with affiliate booking data -----------------------

ALTER TABLE spots
  ADD COLUMN IF NOT EXISTS phone_number    text,        -- nationalPhoneNumber from Google Places
  ADD COLUMN IF NOT EXISTS reservation_uri text,        -- Google reservationUri (TableCheck / Ebica / etc.)
  ADD COLUMN IF NOT EXISTS hotpepper_url   text,        -- Raw Hotpepper shop URL (if matched)
  ADD COLUMN IF NOT EXISTS booking_url     text;        -- Final resolved URL: Tier1 affiliate | Tier2 reserve | null

-- 2. Booking-click analytics table -------------------------------------------

CREATE TABLE IF NOT EXISTS booking_clicks (
  id           bigint  PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  spot_id      text    NOT NULL,
  booking_url  text    NOT NULL,
  -- 1 = Hotpepper affiliate, 2 = Google Reserve, 3 = Google Maps fallback
  booking_tier smallint NOT NULL DEFAULT 3,
  user_id      uuid    REFERENCES auth.users ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
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
