-- ================================================================
-- Migración 006 — Fixes de seguridad auth
-- Bugs corregidos:
--   1. EMAIL_ALREADY_EXISTS: sp_create_organization y sp_register_user
--      solo validaban unicidad por org. Ahora validan globalmente.
--   2. COUNT() bigint → INT en vistas (fallback si 005 ya aplicado).
-- ================================================================

-- ----------------------------------------------------------------
-- FIX 1: sp_create_organization — email único globalmente
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_create_organization(text,text,text,text,text,text);
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

  -- Verificar unicidad global de email
  IF EXISTS (
    SELECT 1 FROM users
     WHERE lower(email) = lower(trim(p_owner_email))
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS' USING ERRCODE = 'P0002';
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
-- FIX 2: sp_register_user — email único globalmente
-- Usado por sp_accept_invitation al crear usuarios invitados.
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

  -- Verificar unicidad global de email (no solo por org)
  IF EXISTS (
    SELECT 1 FROM users
     WHERE lower(email) = lower(trim(p_email))
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
-- FIX 3: COUNT() bigint → INT en vistas del Hito 5
-- (idempotente — usa DROP/CREATE para forzar el cambio de tipo)
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_strategic_intents_with_stats;
CREATE VIEW v_strategic_intents_with_stats AS
SELECT
  si.*,
  COUNT(DISTINCT pi.problem_id)::INT   AS problem_count,
  COUNT(DISTINCT o.id)::INT            AS aligned_objectives_count
FROM strategic_intents si
LEFT JOIN problem_intents pi ON pi.intent_id = si.id
LEFT JOIN objectives o
       ON o.strategic_intent_id = si.id
      AND o.deleted_at IS NULL
WHERE si.deleted_at IS NULL
GROUP BY si.id;

DROP VIEW IF EXISTS v_problems_with_stats;
CREATE VIEW v_problems_with_stats AS
SELECT
  op.*,
  COUNT(DISTINCT pi.intent_id)::INT AS intent_count,
  u.name                            AS created_by_name
FROM organizational_problems op
LEFT JOIN problem_intents pi ON pi.problem_id = op.id
LEFT JOIN users u             ON u.id = op.created_by
WHERE op.deleted_at IS NULL
GROUP BY op.id, u.name;
