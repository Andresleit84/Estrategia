-- ================================================================
-- Migración 001 — Hito 1: Fundaciones
-- REGLA: Toda la lógica de negocio reside en la base de datos.
-- Node.js solo transporta datos — nunca los transforma.
-- Incluye: hashing de contraseñas (pgcrypto), validación,
-- rotación de tokens, RBAC, auditoría.
-- ================================================================

-- ----------------------------------------------------------------
-- EXTENSIONES (idempotentes)
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- FUNCIÓN: updated_at automático
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- TABLA: organizations
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  mode            TEXT NOT NULL DEFAULT 'AGILE'
                    CHECK (mode IN ('AGILE', 'TRADITIONAL', 'HYBRID')),
  plan            TEXT NOT NULL DEFAULT 'FREE'
                    CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE')),
  logo_url        TEXT,
  settings        JSONB NOT NULL DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------
-- TABLA: users
-- password_hash usa bcrypt vía pgcrypto: crypt(plain, gen_salt('bf',12))
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  email           TEXT NOT NULL,
  password_hash   TEXT,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'MEMBER'
                    CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, email)
);

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------
-- TABLA: refresh_tokens
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  family          UUID NOT NULL DEFAULT uuid_generate_v4(),
  device_info     TEXT,
  ip_address      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLA: invitations
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'MEMBER',
  invited_by_id   UUID REFERENCES users(id),
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLA: audit_log
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGSERIAL PRIMARY KEY,
  table_name      TEXT NOT NULL,
  record_id       UUID,
  operation       TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data        JSONB,
  new_data        JSONB,
  actor_id        UUID,
  actor_ip        TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLA: mcp_audit_log
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  tool_name       TEXT NOT NULL,
  user_id         UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  input_summary   TEXT,
  output_summary  TEXT,
  tokens_used     INT,
  duration_ms     INT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TRIGGER: soft delete genérico
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_soft_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD; -- ya borrado lógicamente → permitir DELETE físico (limpieza)
  END IF;
  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW() WHERE id = $1',
    TG_TABLE_NAME
  ) USING OLD.id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_soft_delete_organizations
  BEFORE DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE OR REPLACE TRIGGER trg_soft_delete_users
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

-- ----------------------------------------------------------------
-- TRIGGER: audit_log automático
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_new_data JSONB;
BEGIN
  -- Nunca loguear el hash de contraseña
  IF TG_TABLE_NAME = 'users' THEN
    v_new_data := CASE WHEN TG_OP IN ('INSERT','UPDATE')
                       THEN to_jsonb(NEW) - 'password_hash'
                       ELSE NULL END;
  ELSE
    v_new_data := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  END IF;

  INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, occurred_at)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('DELETE','UPDATE')
         THEN (CASE WHEN TG_TABLE_NAME = 'users'
                    THEN to_jsonb(OLD) - 'password_hash'
                    ELSE to_jsonb(OLD) END)
         ELSE NULL END,
    v_new_data,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER trg_audit_log_organizations
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_log_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_user_has_permission(user_id, resource, action)
-- RBAC centralizado. Node.js solo llama esta función.
-- ----------------------------------------------------------------
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

  IF v_role = 'VIEWER' THEN
    RETURN p_action = 'READ';
  END IF;

  RETURN FALSE;
END;
$$;

-- ----------------------------------------------------------------
-- VISTA: v_user_session
-- Datos completos del usuario para poblar el JWT y la sesión.
-- ----------------------------------------------------------------
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
  o.settings          AS org_settings
FROM users u
JOIN organizations o ON o.id = u.organization_id
WHERE u.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND u.is_active = TRUE;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: sp_validate_login
-- Verifica credenciales usando pgcrypto (bcrypt). Toda la lógica
-- de autenticación vive en la BD: Node.js no toca contraseñas.
-- Retorna los datos de sesión o NULL si las credenciales son malas.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_validate_login(
  p_email    TEXT,
  p_password TEXT
)
RETURNS TABLE (
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
  org_settings    JSONB
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
     AND u.deleted_at IS NULL;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_is_active THEN RETURN; END IF;

  -- Verificar contraseña con bcrypt (pgcrypto)
  IF crypt(p_password, v_hash) <> v_hash THEN RETURN; END IF;

  -- Registrar último login
  UPDATE users SET last_login_at = NOW() WHERE id = v_user_id;

  RETURN QUERY
    SELECT s.* FROM v_user_session s WHERE s.user_id = v_user_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: sp_register_user
-- Crea usuario en una org existente. Hash de contraseña en la BD.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_register_user(
  p_organization_id UUID,
  p_email           TEXT,
  p_password        TEXT,
  p_name            TEXT,
  p_role            TEXT DEFAULT 'MEMBER'
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_organization_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM users
     WHERE organization_id = p_organization_id
       AND lower(email) = lower(trim(p_email))
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO users (organization_id, email, password_hash, name, role)
  VALUES (
    p_organization_id,
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf', 12)),
    trim(p_name),
    p_role
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: sp_create_organization
-- Crea organización + usuario owner en una operación atómica.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_create_organization(
  p_org_name    TEXT,
  p_org_slug    TEXT,
  p_mode        TEXT,
  p_owner_email TEXT,
  p_password    TEXT,
  p_owner_name  TEXT
)
RETURNS TABLE (p_org_id UUID, p_user_id UUID)
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id  UUID;
  v_user_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = lower(trim(p_org_slug))) THEN
    RAISE EXCEPTION 'SLUG_ALREADY_EXISTS' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO organizations (name, slug, mode)
  VALUES (trim(p_org_name), lower(trim(p_org_slug)), p_mode)
  RETURNING id INTO v_org_id;

  INSERT INTO users (organization_id, email, password_hash, name, role, email_verified)
  VALUES (
    v_org_id,
    lower(trim(p_owner_email)),
    crypt(p_password, gen_salt('bf', 12)),
    trim(p_owner_name),
    'OWNER',
    TRUE
  )
  RETURNING id INTO v_user_id;

  RETURN QUERY SELECT v_org_id, v_user_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: sp_invite_user
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_invite_user(
  p_organization_id UUID,
  p_email           TEXT,
  p_role            TEXT,
  p_invited_by_id   UUID
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_token TEXT;
BEGIN
  UPDATE invitations
     SET expires_at = NOW()
   WHERE organization_id = p_organization_id
     AND lower(email) = lower(trim(p_email))
     AND accepted_at IS NULL
     AND expires_at > NOW();

  INSERT INTO invitations (organization_id, email, role, invited_by_id)
  VALUES (p_organization_id, lower(trim(p_email)), p_role, p_invited_by_id)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: sp_accept_invitation
-- Verifica el token, crea el usuario con contraseña hasheada en BD.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_accept_invitation(
  p_token    TEXT,
  p_name     TEXT,
  p_password TEXT
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_inv
    FROM invitations
   WHERE token = p_token
     AND accepted_at IS NULL
     AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_INVALID_OR_EXPIRED' USING ERRCODE = 'P0004';
  END IF;

  v_user_id := sp_register_user(v_inv.organization_id, v_inv.email, p_password, p_name, v_inv.role);

  UPDATE invitations SET accepted_at = NOW() WHERE id = v_inv.id;

  RETURN v_user_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: sp_refresh_token
-- Rotación segura con detección de reuso (token family).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_refresh_token(
  p_token_hash  TEXT,
  p_new_hash    TEXT,
  p_device_info TEXT,
  p_ip_address  TEXT
)
RETURNS TABLE (p_user_id UUID, p_family UUID)
LANGUAGE plpgsql AS $$
DECLARE
  v_token refresh_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token
    FROM refresh_tokens
   WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN; -- token inexistente
  END IF;

  -- Reuso detectado → invalidar familia completa
  IF v_token.revoked_at IS NOT NULL THEN
    UPDATE refresh_tokens
       SET revoked_at = NOW()
     WHERE family = v_token.family AND revoked_at IS NULL;
    RETURN;
  END IF;

  IF v_token.expires_at < NOW() THEN
    UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = v_token.id;
    RETURN;
  END IF;

  UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = v_token.id;

  INSERT INTO refresh_tokens (user_id, token_hash, family, device_info, ip_address, expires_at)
  VALUES (v_token.user_id, p_new_hash, v_token.family, p_device_info, p_ip_address,
          NOW() + INTERVAL '30 days');

  RETURN QUERY SELECT v_token.user_id, v_token.family;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_issue_refresh_token
-- Genera un token aleatorio, lo hashea y lo almacena.
-- Retorna el token en texto plano (solo se muestra una vez).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_issue_refresh_token(
  p_user_id     UUID,
  p_device_info TEXT DEFAULT NULL,
  p_ip_address  TEXT DEFAULT NULL
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_raw   TEXT := encode(gen_random_bytes(64), 'hex');
  v_hash  TEXT := encode(digest(v_raw, 'sha256'), 'hex');
BEGIN
  INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
  VALUES (p_user_id, v_hash, p_device_info, p_ip_address, NOW() + INTERVAL '30 days');

  RETURN v_raw; -- el token plano se devuelve UNA sola vez al cliente
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: sp_refresh_token_raw
-- Versión de sp_refresh_token que recibe el token en texto plano,
-- lo hashea dentro de la BD, y devuelve el nuevo token plano.
-- Node.js nunca maneja hashes de refresh tokens.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_refresh_token_raw(
  p_raw_token   TEXT,
  p_device_info TEXT,
  p_ip_address  TEXT
)
RETURNS TABLE (p_user_id UUID, p_family UUID, p_new_raw_token TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  v_old_hash  TEXT := encode(digest(p_raw_token, 'sha256'), 'hex');
  v_new_raw   TEXT := encode(gen_random_bytes(64), 'hex');
  v_new_hash  TEXT := encode(digest(v_new_raw, 'sha256'), 'hex');
  v_token     refresh_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token
    FROM refresh_tokens
   WHERE token_hash = v_old_hash;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_token.revoked_at IS NOT NULL THEN
    UPDATE refresh_tokens
       SET revoked_at = NOW()
     WHERE family = v_token.family AND revoked_at IS NULL;
    RETURN;
  END IF;

  IF v_token.expires_at < NOW() THEN
    UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = v_token.id;
    RETURN;
  END IF;

  UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = v_token.id;

  INSERT INTO refresh_tokens (user_id, token_hash, family, device_info, ip_address, expires_at)
  VALUES (v_token.user_id, v_new_hash, v_token.family, p_device_info, p_ip_address,
          NOW() + INTERVAL '30 days');

  RETURN QUERY SELECT v_token.user_id, v_token.family, v_new_raw;
END;
$$;

-- ----------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_org              ON users(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active  ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family  ON refresh_tokens(family);
CREATE INDEX IF NOT EXISTS idx_audit_log_table        ON audit_log(table_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user         ON mcp_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_token      ON invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_org_email  ON invitations(organization_id, lower(email));
