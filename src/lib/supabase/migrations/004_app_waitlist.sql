-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Mobile app waitlist
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
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

-- No anon/authenticated policies — writes go through service_role (API route).
DROP POLICY IF EXISTS "app_waitlist_service_all" ON app_waitlist;
CREATE POLICY "app_waitlist_service_all"
  ON app_waitlist FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
