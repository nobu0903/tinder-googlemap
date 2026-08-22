-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — In-app feedback form
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
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
