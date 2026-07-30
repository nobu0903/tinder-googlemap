-- Fix for existing VibeLoop databases (run this ONLY — do not re-run full schema.sql)
-- Supabase Dashboard → SQL Editor → New query → Run
-- Used to filter hotels vs hotel restaurants in the feed.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS primary_type TEXT;
