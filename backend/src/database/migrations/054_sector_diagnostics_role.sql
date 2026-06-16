-- ----------------------------------------------------------------
-- Migración 054: Rol SECTOR_DIAGNOSTICS
-- Agrega el rol de diagnóstico sectorial con acceso restringido
-- solo a la sección sector-assessment.
-- ----------------------------------------------------------------

-- 1. Ampliar el CHECK constraint del rol
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER', 'SECTOR_DIAGNOSTICS'));

-- 2. Actualizar fn_user_has_permission para el nuevo rol
CREATE OR REPLACE FUNCTION fn_user_has_permission(
  p_user_id   UUID,
  p_resource  TEXT,
  p_action    TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_role      TEXT;
  v_is_active BOOLEAN;
BEGIN
  SELECT role, is_active
    INTO v_role, v_is_active
    FROM users
   WHERE id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND OR NOT v_is_active THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('OWNER', 'ADMIN') THEN RETURN TRUE; END IF;

  IF v_role = 'MANAGER' THEN
    RETURN p_action IN ('READ', 'CREATE', 'UPDATE')
      AND p_resource NOT IN ('users.role', 'organizations.settings');
  END IF;

  IF v_role = 'MEMBER' THEN
    RETURN p_action = 'READ'
      OR (p_action = 'UPDATE' AND p_resource = 'checkins.own');
  END IF;

  IF v_role IN ('VIEWER', 'SECTOR_DIAGNOSTICS') THEN
    RETURN p_action = 'READ';
  END IF;

  RETURN FALSE;
END;
$$;
