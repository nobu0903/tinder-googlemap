-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — Admin passkeys and single-use WebAuthn challenges
-- Run once in Supabase Dashboard → SQL Editor.
-- Safe to re-run. The service role is the only client that can read or write.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_passkeys (
  credential_id text PRIMARY KEY,
  public_key    text        NOT NULL,
  counter       bigint      NOT NULL DEFAULT 0,
  transports    text[]      NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_passkey_challenges (
  challenge   text        PRIMARY KEY,
  purpose     text        NOT NULL CHECK (purpose IN ('authentication', 'registration')),
  expires_at  timestamptz NOT NULL
);

ALTER TABLE admin_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_passkey_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_passkeys_service_all" ON admin_passkeys;
CREATE POLICY "admin_passkeys_service_all"
  ON admin_passkeys FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admin_passkey_challenges_service_all" ON admin_passkey_challenges;
CREATE POLICY "admin_passkey_challenges_service_all"
  ON admin_passkey_challenges FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE admin_passkeys FROM anon, authenticated;
REVOKE ALL ON TABLE admin_passkey_challenges FROM anon, authenticated;
