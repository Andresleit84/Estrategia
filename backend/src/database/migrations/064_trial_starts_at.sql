-- 064: add trial_starts_at to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;

-- Back-fill existing rows that already have a trial end date
UPDATE organizations
   SET trial_starts_at = trial_expires_at - INTERVAL '15 days'
 WHERE trial_expires_at IS NOT NULL
   AND trial_starts_at IS NULL;
