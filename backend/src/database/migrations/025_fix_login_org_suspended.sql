-- Migration 025: sp_validate_login distingue org suspendida de credenciales inválidas
-- Antes: devolvía vacío en ambos casos → "Credenciales inválidas" engañoso.
-- Ahora: lanza ORG_SUSPENDED cuando la contraseña es correcta pero la org está eliminada.

CREATE OR REPLACE FUNCTION sp_validate_login(
  p_email    TEXT,
  p_password TEXT
) RETURNS SETOF v_user_session
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   UUID;
  v_hash      TEXT;
  v_is_active BOOLEAN;
  v_org_id    UUID;
  v_org_dead  TIMESTAMPTZ;
BEGIN
  SELECT u.id, u.password_hash, u.is_active, u.organization_id
    INTO v_user_id, v_hash, v_is_active, v_org_id
    FROM users u
   WHERE lower(u.email) = lower(trim(p_email))
     AND u.deleted_at IS NULL;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_is_active THEN RETURN; END IF;

  IF crypt(p_password, v_hash) <> v_hash THEN RETURN; END IF;

  -- Contraseña correcta: ahora sí verificar org
  SELECT deleted_at INTO v_org_dead
    FROM organizations
   WHERE id = v_org_id;

  IF v_org_dead IS NOT NULL THEN
    RAISE EXCEPTION 'ORG_SUSPENDED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE users SET last_login_at = NOW() WHERE id = v_user_id;

  RETURN QUERY
    SELECT s.* FROM v_user_session s WHERE s.user_id = v_user_id;
END;
$$;
