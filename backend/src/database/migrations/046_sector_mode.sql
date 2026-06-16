-- ================================================================
-- Migración 046 — Sector / Industria por organización
-- Añade campo `sector` a organizations y actualiza v_user_session
-- ================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'GENERIC'
    CHECK (sector IN ('GENERIC', 'COOPERATIVE_FINANCIAL', 'BANKING', 'INSURANCE', 'OTHER'));

-- Actualizar v_user_session para exponer sector
CREATE OR REPLACE VIEW v_user_session AS
SELECT
  u.id                AS user_id,
  u.organization_id,
  u.email,
  u.name,
  u.role,
  u.avatar_url,
  u.is_active,
  u.email_verified,
  o.slug              AS org_slug,
  o.name              AS org_name,
  o.plan              AS org_plan,
  o.mode              AS org_mode,
  o.settings          AS org_settings,
  o.sector            AS org_sector
FROM users u
JOIN organizations o ON o.id = u.organization_id
WHERE u.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND u.is_active = TRUE;

-- Actualizar fn_update_organization para aceptar sector
CREATE OR REPLACE FUNCTION fn_update_organization(
  p_org_id   UUID,
  p_name     TEXT    DEFAULT NULL,
  p_mode     TEXT    DEFAULT NULL,
  p_settings JSONB   DEFAULT NULL,
  p_sector   TEXT    DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE organizations
     SET name     = COALESCE(p_name,     name),
         mode     = COALESCE(p_mode,     mode),
         settings = COALESCE(p_settings, settings),
         sector   = COALESCE(p_sector,   sector)
   WHERE id = p_org_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT UPDATE(sector) ON organizations TO okr_user;

-- Recrear sp_validate_login para incluir org_sector en el tipo de retorno
-- (RETURNS SETOF v_user_session se bake en la definición al momento de creación;
--  hay que drop+create cada vez que v_user_session cambia de estructura)
DROP FUNCTION IF EXISTS sp_validate_login(text, text);

CREATE OR REPLACE FUNCTION sp_validate_login(p_email TEXT, p_password TEXT)
RETURNS TABLE(
  user_id         UUID,
  organization_id UUID,
  email           TEXT,
  name            TEXT,
  role            TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN,
  email_verified  BOOLEAN,
  org_slug        TEXT,
  org_name        TEXT,
  org_plan        TEXT,
  org_mode        TEXT,
  org_settings    JSONB,
  org_sector      TEXT
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
