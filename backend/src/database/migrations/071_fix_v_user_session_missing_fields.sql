-- Migration 071: restore missing fields in v_user_session + sp_validate_login
-- Fields dropped by migration 069: is_platform_admin, org_trial_expires_at
-- is_platform_admin: derived as (role = 'OWNER') — OWNER users are the platform admin
-- org_trial_expires_at: o.trial_expires_at (added to orgs in migration 043)

DROP FUNCTION IF EXISTS sp_validate_login(text, text);
DROP VIEW IF EXISTS v_user_session CASCADE;

CREATE VIEW v_user_session AS
SELECT
  u.id                              AS user_id,
  u.organization_id,
  u.email,
  u.name,
  u.role,
  u.avatar_url,
  u.is_active,
  u.email_verified,
  u.first_day_completed_at,
  o.slug                            AS org_slug,
  o.name                            AS org_name,
  o.plan                            AS org_plan,
  o.mode                            AS org_mode,
  o.settings                        AS org_settings,
  o.sector                          AS org_sector,
  o.trial_expires_at                AS org_trial_expires_at,
  (u.role = 'OWNER')::boolean       AS is_platform_admin
FROM users u
JOIN organizations o ON o.id = u.organization_id
WHERE u.deleted_at IS NULL
  AND o.deleted_at  IS NULL
  AND u.is_active   = TRUE;

GRANT SELECT ON v_user_session TO okr_user;

-- Recreate sp_validate_login matching the new view structure (15 columns + 2 new = 18 total)
CREATE OR REPLACE FUNCTION sp_validate_login(p_email TEXT, p_password TEXT)
RETURNS TABLE(
  user_id                  UUID,
  organization_id          UUID,
  email                    TEXT,
  name                     TEXT,
  role                     TEXT,
  avatar_url               TEXT,
  is_active                BOOLEAN,
  email_verified           BOOLEAN,
  first_day_completed_at   TIMESTAMPTZ,
  org_slug                 TEXT,
  org_name                 TEXT,
  org_plan                 TEXT,
  org_mode                 TEXT,
  org_settings             JSONB,
  org_sector               TEXT,
  org_trial_expires_at     TIMESTAMPTZ,
  is_platform_admin        BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   UUID;
  v_hash      TEXT;
  v_is_active BOOLEAN;
BEGIN
  SELECT u.id, u.password_hash, u.is_active
    INTO v_user_id, v_hash, v_is_active
    FROM users u
   WHERE lower(u.email) = lower(trim(p_email))
     AND u.deleted_at IS NULL
   ORDER BY u.created_at ASC
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_is_active THEN RETURN; END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN RETURN; END IF;

  UPDATE users SET last_login_at = NOW() WHERE id = v_user_id;

  RETURN QUERY
    SELECT s.* FROM v_user_session s WHERE s.user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION sp_validate_login(text, text) TO okr_user;
