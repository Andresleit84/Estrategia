-- Migration 043: Trial system (15-day free trial)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
