-- ================================================================
-- Migración 002 — Hito 2: Multi-tenancy, equipos y onboarding
-- ================================================================

-- ----------------------------------------------------------------
-- TABLA: teams
-- Soporta jerarquía (parent_team_id). El equipo raíz tiene parent NULL.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  description     TEXT,
  parent_team_id  UUID REFERENCES teams(id) ON DELETE SET NULL,
  owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  is_root         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE OR REPLACE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------
-- TABLA: team_members
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'MEMBER'
                    CHECK (role IN ('LEAD', 'MEMBER', 'OBSERVER')),
  added_by_id     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ----------------------------------------------------------------
-- TRIGGER: auditoría para teams y team_members
-- ----------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_audit_log_teams
  AFTER INSERT OR UPDATE OR DELETE ON teams
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_log_team_members
  AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ----------------------------------------------------------------
-- TRIGGER: validar que no se creen ciclos en la jerarquía de equipos
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_team_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_ancestor UUID;
BEGIN
  IF NEW.parent_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- No puede ser su propio padre
  IF NEW.parent_team_id = NEW.id THEN
    RAISE EXCEPTION 'TEAM_CANNOT_BE_OWN_PARENT' USING ERRCODE = 'P0010';
  END IF;

  -- Verificar que no haya un ciclo recorriendo hacia arriba
  WITH RECURSIVE ancestors AS (
    SELECT parent_team_id AS id FROM teams WHERE id = NEW.parent_team_id
    UNION ALL
    SELECT t.parent_team_id FROM teams t JOIN ancestors a ON t.id = a.id WHERE t.parent_team_id IS NOT NULL
  )
  SELECT id INTO v_ancestor FROM ancestors WHERE id = NEW.id LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'TEAM_HIERARCHY_CYCLE_DETECTED' USING ERRCODE = 'P0011';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_team_hierarchy
  BEFORE INSERT OR UPDATE OF parent_team_id ON teams
  FOR EACH ROW EXECUTE FUNCTION fn_validate_team_hierarchy();

-- ----------------------------------------------------------------
-- ACTUALIZAR sp_create_organization para crear equipo raíz
-- (DROP requerido porque cambia el tipo de retorno)
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_create_organization(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);

CREATE OR REPLACE FUNCTION sp_create_organization(
  p_org_name    TEXT,
  p_org_slug    TEXT,
  p_mode        TEXT,
  p_owner_email TEXT,
  p_password    TEXT,
  p_owner_name  TEXT
)
RETURNS TABLE (p_org_id UUID, p_user_id UUID, p_root_team_id UUID)
LANGUAGE plpgsql AS $$
DECLARE
  v_org_id       UUID;
  v_user_id      UUID;
  v_root_team_id UUID;
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

  -- Equipo raíz con el nombre de la organización
  INSERT INTO teams (organization_id, name, owner_id, is_root)
  VALUES (v_org_id, trim(p_org_name), v_user_id, TRUE)
  RETURNING id INTO v_root_team_id;

  -- Owner también es miembro LEAD del equipo raíz
  INSERT INTO team_members (team_id, user_id, role, added_by_id)
  VALUES (v_root_team_id, v_user_id, 'LEAD', v_user_id);

  RETURN QUERY SELECT v_org_id, v_user_id, v_root_team_id;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: sp_create_team
-- Crea un equipo dentro de la org, valida pertenencia del owner.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_create_team(
  p_organization_id UUID,
  p_name            TEXT,
  p_description     TEXT DEFAULT NULL,
  p_parent_team_id  UUID DEFAULT NULL,
  p_owner_id        UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_team_id UUID;
BEGIN
  -- Validar que el parent pertenezca a la misma org
  IF p_parent_team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM teams
       WHERE id = p_parent_team_id AND organization_id = p_organization_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'PARENT_TEAM_NOT_FOUND' USING ERRCODE = 'P0012';
    END IF;
  ELSE
    -- Sin parent → usar equipo raíz como parent
    SELECT id INTO p_parent_team_id
      FROM teams
     WHERE organization_id = p_organization_id AND is_root = TRUE AND deleted_at IS NULL;
  END IF;

  INSERT INTO teams (organization_id, name, description, parent_team_id, owner_id)
  VALUES (p_organization_id, trim(p_name), p_description, p_parent_team_id, p_owner_id)
  RETURNING id INTO v_team_id;

  -- Si hay owner, agregarlo como LEAD automáticamente
  IF p_owner_id IS NOT NULL THEN
    INSERT INTO team_members (team_id, user_id, role, added_by_id)
    VALUES (v_team_id, p_owner_id, 'LEAD', p_owner_id)
    ON CONFLICT (team_id, user_id) DO NOTHING;
  END IF;

  RETURN v_team_id;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: sp_add_team_member
-- Agrega un usuario a un equipo validando que ambos pertenezcan a la org.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_add_team_member(
  p_team_id     UUID,
  p_user_id     UUID,
  p_role        TEXT DEFAULT 'MEMBER',
  p_added_by_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
  v_member_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
    FROM teams WHERE id = p_team_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND' USING ERRCODE = 'P0013';
  END IF;

  -- El usuario debe pertenecer a la misma org
  IF NOT EXISTS (
    SELECT 1 FROM users
     WHERE id = p_user_id AND organization_id = v_org_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'USER_NOT_IN_ORG' USING ERRCODE = 'P0014';
  END IF;

  INSERT INTO team_members (team_id, user_id, role, added_by_id)
  VALUES (p_team_id, p_user_id, p_role, p_added_by_id)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: sp_remove_team_member
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_remove_team_member(
  p_team_id UUID,
  p_user_id UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND' USING ERRCODE = 'P0015';
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_user_belongs_to_org(user_id, org_id)
-- Validación de cross-tenant rápida usada en guards.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_user_belongs_to_org(
  p_user_id UUID,
  p_org_id  UUID
)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
     WHERE id = p_user_id
       AND organization_id = p_org_id
       AND deleted_at IS NULL
       AND is_active = TRUE
  );
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_update_organization(org_id, name, mode, settings)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_organization(
  p_org_id   UUID,
  p_name     TEXT DEFAULT NULL,
  p_mode     TEXT DEFAULT NULL,
  p_settings JSONB DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE organizations
     SET name     = COALESCE(p_name,     name),
         mode     = COALESCE(p_mode,     mode),
         settings = COALESCE(p_settings, settings)
   WHERE id = p_org_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- VISTA: v_org_members
-- Miembros de la org con sus equipos (agrupados).
-- Filtrar por organization_id desde el backend.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_org_members AS
SELECT
  u.id                AS user_id,
  u.organization_id,
  u.email,
  u.name,
  u.role              AS org_role,
  u.avatar_url,
  u.is_active,
  u.email_verified,
  u.last_login_at,
  u.created_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object('team_id', t.id, 'team_name', t.name, 'role', tm.role)
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::jsonb
  )                   AS teams
FROM users u
LEFT JOIN team_members tm ON tm.user_id = u.id
LEFT JOIN teams t ON t.id = tm.team_id AND t.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.organization_id, u.email, u.name, u.role,
         u.avatar_url, u.is_active, u.email_verified, u.last_login_at, u.created_at;

-- ----------------------------------------------------------------
-- VISTA: v_team_tree
-- Árbol de equipos con profundidad y path de IDs.
-- Filtrar por organization_id desde el backend.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_team_tree AS
WITH RECURSIVE tree AS (
  -- Raíz
  SELECT
    t.id, t.organization_id, t.name, t.description,
    t.parent_team_id, t.owner_id, t.is_root,
    0 AS depth,
    ARRAY[t.id] AS id_path,
    t.name AS name_path,
    (SELECT count(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
  FROM teams t
  WHERE t.parent_team_id IS NULL AND t.deleted_at IS NULL

  UNION ALL

  -- Hijos recursivos
  SELECT
    t.id, t.organization_id, t.name, t.description,
    t.parent_team_id, t.owner_id, t.is_root,
    tree.depth + 1,
    tree.id_path || t.id,
    tree.name_path || ' > ' || t.name,
    (SELECT count(*) FROM team_members tm WHERE tm.team_id = t.id)
  FROM teams t
  JOIN tree ON t.parent_team_id = tree.id
  WHERE t.deleted_at IS NULL
)
SELECT
  tree.*,
  u.name  AS owner_name,
  u.email AS owner_email
FROM tree
LEFT JOIN users u ON u.id = tree.owner_id
ORDER BY depth, name;

-- ----------------------------------------------------------------
-- VISTA: v_user_teams
-- Equipos donde el usuario es miembro.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_user_teams AS
SELECT
  tm.user_id,
  t.id            AS team_id,
  t.organization_id,
  t.name          AS team_name,
  t.description,
  t.parent_team_id,
  t.is_root,
  tm.role         AS member_role,
  tm.created_at   AS joined_at,
  (SELECT count(*) FROM team_members tm2 WHERE tm2.team_id = t.id) AS member_count
FROM team_members tm
JOIN teams t ON t.id = tm.team_id AND t.deleted_at IS NULL;

-- ----------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_teams_org         ON teams(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teams_parent      ON teams(parent_team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
