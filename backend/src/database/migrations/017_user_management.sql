-- ================================================================
-- MIGRACIÓN 017 — Gestión de miembros y permisos de menú
-- ================================================================

-- ----------------------------------------------------------------
-- PROCEDURE: sp_update_member_role
-- Actor (OWNER/ADMIN) cambia el rol de un miembro de la misma org.
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_update_member_role(
  p_actor_id    UUID,
  p_target_id   UUID,
  p_new_role    TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
  v_actor_role  TEXT;
  v_actor_org   UUID;
  v_target_role TEXT;
  v_target_org  UUID;
BEGIN
  SELECT role, organization_id INTO v_actor_role, v_actor_org
    FROM users WHERE id = p_actor_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Actor no encontrado'; END IF;
  IF v_actor_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Sin permisos para cambiar roles' USING ERRCODE = '42501';
  END IF;

  SELECT role, organization_id INTO v_target_role, v_target_org
    FROM users WHERE id = p_target_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  IF v_target_org <> v_actor_org THEN
    RAISE EXCEPTION 'El usuario no pertenece a esta organización' USING ERRCODE = '42501';
  END IF;
  IF v_target_role = 'OWNER' THEN
    RAISE EXCEPTION 'No se puede cambiar el rol del propietario' USING ERRCODE = '42501';
  END IF;
  IF p_new_role = 'OWNER' THEN
    RAISE EXCEPTION 'No se puede asignar el rol de propietario' USING ERRCODE = '42501';
  END IF;
  IF p_new_role NOT IN ('ADMIN', 'MANAGER', 'MEMBER', 'VIEWER') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_new_role;
  END IF;

  UPDATE users SET role = p_new_role, updated_at = NOW()
   WHERE id = p_target_id;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCTION: fn_reset_member_password
-- Genera contraseña temporal, la hashea en DB y retorna el texto
-- plano para que el administrador la comparta con el usuario.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reset_member_password(
  p_actor_id  UUID,
  p_target_id UUID
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_actor_role  TEXT;
  v_actor_org   UUID;
  v_target_role TEXT;
  v_target_org  UUID;
  v_new_password TEXT;
BEGIN
  SELECT role, organization_id INTO v_actor_role, v_actor_org
    FROM users WHERE id = p_actor_id AND deleted_at IS NULL;
  IF v_actor_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Sin permisos' USING ERRCODE = '42501';
  END IF;

  SELECT role, organization_id INTO v_target_role, v_target_org
    FROM users WHERE id = p_target_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_target_org <> v_actor_org THEN
    RAISE EXCEPTION 'Usuario no encontrado en esta organización';
  END IF;
  IF v_target_role = 'OWNER' AND v_actor_role = 'ADMIN' THEN
    RAISE EXCEPTION 'Sin permisos para resetear la contraseña del propietario' USING ERRCODE = '42501';
  END IF;

  -- Contraseña temporal: 4 mayúsculas + 4 minúsculas + 4 dígitos
  v_new_password :=
    substring(upper(encode(gen_random_bytes(4), 'hex')), 1, 4) ||
    substring(lower(encode(gen_random_bytes(4), 'hex')), 1, 4) ||
    lpad((floor(random() * 9999))::int::text, 4, '0');

  UPDATE users
     SET password_hash = crypt(v_new_password, gen_salt('bf', 10)),
         updated_at    = NOW()
   WHERE id = p_target_id;

  -- Revocar todas las sesiones activas del usuario
  UPDATE refresh_tokens SET revoked_at = NOW()
   WHERE user_id = p_target_id AND revoked_at IS NULL;

  RETURN v_new_password;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDURE: sp_remove_member
-- OWNER/ADMIN elimina (soft delete) a un miembro de la org.
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_remove_member(
  p_actor_id  UUID,
  p_target_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  v_actor_role TEXT;
  v_actor_org  UUID;
  v_target_role TEXT;
  v_target_org  UUID;
BEGIN
  SELECT role, organization_id INTO v_actor_role, v_actor_org
    FROM users WHERE id = p_actor_id AND deleted_at IS NULL;
  IF v_actor_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Sin permisos' USING ERRCODE = '42501';
  END IF;

  SELECT role, organization_id INTO v_target_role, v_target_org
    FROM users WHERE id = p_target_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_target_org <> v_actor_org THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  IF v_target_role = 'OWNER' THEN
    RAISE EXCEPTION 'No se puede eliminar al propietario' USING ERRCODE = '42501';
  END IF;
  IF p_actor_id = p_target_id THEN
    RAISE EXCEPTION 'No puedes eliminarte a ti mismo' USING ERRCODE = '42501';
  END IF;

  -- Soft delete + revocar sesiones
  UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = p_target_id;
  UPDATE refresh_tokens SET revoked_at = NOW()
   WHERE user_id = p_target_id AND revoked_at IS NULL;
END;
$$;
