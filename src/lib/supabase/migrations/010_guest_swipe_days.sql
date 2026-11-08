-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010 — One mark per browser per Tokyo day for guest swipers.
-- Run once in Supabase Dashboard → SQL Editor.
-- Safe to re-run. The anon key cannot read or write this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_swipe_days (
  guest_id   uuid        NOT NULL,
  swipe_date date        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_id, swipe_date)
);

CREATE INDEX IF NOT EXISTS idx_guest_swipe_days_user
  ON guest_swipe_days (user_id);

CREATE INDEX IF NOT EXISTS idx_guest_swipe_days_date
  ON guest_swipe_days (swipe_date);

ALTER TABLE guest_swipe_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_swipe_days_service_all" ON guest_swipe_days;
CREATE POLICY "guest_swipe_days_service_all"
  ON guest_swipe_days FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE guest_swipe_days FROM anon, authenticated;
