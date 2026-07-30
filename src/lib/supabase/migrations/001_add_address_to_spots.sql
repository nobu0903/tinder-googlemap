-- Fix for existing VibeLoop databases (run this ONLY — do not re-run full schema.sql)
-- Supabase Dashboard → SQL Editor → New query → Run

ALTER TABLE spots ADD COLUMN IF NOT EXISTS address TEXT;
