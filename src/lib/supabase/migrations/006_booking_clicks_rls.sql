-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Lock down booking_clicks (anon key must not read user_id)
-- Run once in Supabase Dashboard → SQL Editor.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE booking_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_clicks_service_all" ON booking_clicks;
CREATE POLICY "booking_clicks_service_all"
  ON booking_clicks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE booking_clicks FROM anon, authenticated;
