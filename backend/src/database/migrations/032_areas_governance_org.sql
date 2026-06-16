-- ================================================================
-- Migración 032 — Áreas organizativas, Gobierno corporativo,
--                  Colaboración cross-área en iniciativas
-- ================================================================
--
-- Estructura jerárquica:
--   Organización
--   ├── Cuerpos de gobierno (Consejo, Comité — cooperativas)
--   └── Áreas (RRHH, TI, Cobranza, etc.)
--       └── Equipos (ya existen, ahora con area_id)
--
-- Iniciativas extendidas:
--   - Área principal responsable
--   - Áreas involucradas (cross-funcional)
--   - Dependencias (qué hay que destrabar)
-- ================================================================

-- ── 1. ÁREAS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS areas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  color       VARCHAR(7)  NOT NULL DEFAULT '#6366f1',
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_areas_org
  ON areas(org_id) WHERE is_active = true;

-- Ligar equipos a áreas
ALTER TABLE teams ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teams_area
  ON teams(area_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION fn_areas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_areas_updated_at ON areas;
CREATE TRIGGER trg_areas_updated_at
  BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION fn_areas_updated_at();

-- ── 2. GOBIERNO CORPORATIVO ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS governance_bodies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(30)  NOT NULL DEFAULT 'OTHER'
                CHECK (type IN ('CONSEJO','COMITE','DIRECTORIO','JUNTA','ASAMBLEA','OTHER')),
  description TEXT,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_bodies_org
  ON governance_bodies(org_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS governance_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_id     UUID NOT NULL REFERENCES governance_bodies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_label  VARCHAR(100),
  sort_order  INT  NOT NULL DEFAULT 0,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(body_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gov_members_body
  ON governance_members(body_id);

CREATE OR REPLACE FUNCTION fn_gov_bodies_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_gov_bodies_updated_at ON governance_bodies;
CREATE TRIGGER trg_gov_bodies_updated_at
  BEFORE UPDATE ON governance_bodies
  FOR EACH ROW EXECUTE FUNCTION fn_gov_bodies_updated_at();

-- ── 3. INICIATIVAS — áreas involucradas ───────────────────────────

CREATE TABLE IF NOT EXISTS initiative_areas (
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  area_id       UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (initiative_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_initiative_areas_area
  ON initiative_areas(area_id);

-- Solo una área principal por iniciativa
CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_primary_area
  ON initiative_areas(initiative_id) WHERE is_primary = true;

-- ── 4. INICIATIVAS — dependencias cross-área ──────────────────────

CREATE TABLE IF NOT EXISTS initiative_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id   UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  depends_on_id   UUID REFERENCES initiatives(id) ON DELETE SET NULL,
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 500),
  type            VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'
                    CHECK (type IN ('INTERNAL','EXTERNAL','DECISION')),
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','IN_PROGRESS','RESOLVED','BLOCKED')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_initiative_deps
  ON initiative_dependencies(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_deps_on
  ON initiative_dependencies(depends_on_id) WHERE depends_on_id IS NOT NULL;

CREATE OR REPLACE FUNCTION fn_initiative_deps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_initiative_deps_updated_at ON initiative_dependencies;
CREATE TRIGGER trg_initiative_deps_updated_at
  BEFORE UPDATE ON initiative_dependencies
  FOR EACH ROW EXECUTE FUNCTION fn_initiative_deps_updated_at();

-- ── 5. VISTAS ──────────────────────────────────────────────────────

-- v_areas_with_teams
CREATE OR REPLACE VIEW v_areas_with_teams AS
SELECT
  a.id,
  a.org_id,
  a.name,
  a.description,
  a.color,
  a.sort_order,
  a.is_active,
  a.created_at,
  a.updated_at,
  a.manager_id,
  u.name                             AS manager_name,
  u.avatar_url                       AS manager_avatar,
  COUNT(DISTINCT t.id)               AS team_count,
  COUNT(DISTINCT tm.user_id)         AS member_count,
  COALESCE(
    json_agg(
      json_build_object(
        'id',           t.id,
        'name',         t.name,
        'description',  t.description,
        'is_root',      t.is_root,
        'area_id',      t.area_id,
        'member_count', (
          SELECT COUNT(*)::INT FROM team_members tm2 WHERE tm2.team_id = t.id
        )
      ) ORDER BY t.name
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  )::JSONB                           AS teams
FROM areas a
LEFT JOIN users u  ON u.id = a.manager_id AND u.deleted_at IS NULL
LEFT JOIN teams t  ON t.area_id = a.id AND t.deleted_at IS NULL
LEFT JOIN team_members tm ON tm.team_id = t.id
WHERE a.is_active = true
GROUP BY a.id, u.name, u.avatar_url;

-- v_governance_bodies
CREATE OR REPLACE VIEW v_governance_bodies AS
SELECT
  gb.id,
  gb.org_id,
  gb.name,
  gb.type,
  gb.description,
  gb.sort_order,
  gb.is_active,
  gb.created_at,
  gb.updated_at,
  COUNT(DISTINCT gm.id)              AS member_count,
  COALESCE(
    json_agg(
      json_build_object(
        'id',         gm.id,
        'user_id',    u.id,
        'name',       u.name,
        'email',      u.email,
        'avatar_url', u.avatar_url,
        'role_label', gm.role_label,
        'sort_order', gm.sort_order
      ) ORDER BY gm.sort_order, u.name
    ) FILTER (WHERE gm.id IS NOT NULL),
    '[]'
  )::JSONB                           AS members
FROM governance_bodies gb
LEFT JOIN governance_members gm ON gm.body_id = gb.id
LEFT JOIN users u ON u.id = gm.user_id AND u.deleted_at IS NULL
WHERE gb.is_active = true
GROUP BY gb.id;

-- ── Actualizar v_initiative_timeline con áreas + dependencias ─────

DROP VIEW IF EXISTS v_initiatives_by_kr;
DROP VIEW IF EXISTS v_overdue_milestones;
DROP VIEW IF EXISTS v_sprint_board;
DROP VIEW IF EXISTS v_initiative_timeline CASCADE;

CREATE VIEW v_initiative_timeline AS
SELECT
  i.id,
  i.organization_id,
  i.cycle_id,
  i.team_id,
  i.owner_id,
  i.sprint_id,
  i.code,
  i.title,
  i.description,
  i.status,
  i.progress,
  i.start_date,
  i.due_date,
  i.completed_at,
  i.created_at,
  u.name                             AS owner_name,
  u.avatar_url                       AS owner_avatar,
  t.name                             AS team_name,
  (i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE
    AND i.status NOT IN ('DONE','CANCELLED'))
                                     AS is_overdue,
  CASE
    WHEN i.due_date IS NOT NULL AND i.status NOT IN ('DONE','CANCELLED')
    THEN GREATEST(0, CURRENT_DATE - i.due_date)
    ELSE 0
  END                                AS days_overdue,
  -- milestones (subquery para evitar duplicados en JOIN)
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id',            m.id,
        'title',         m.title,
        'status',        m.status,
        'due_date',      m.due_date,
        'completed_at',  m.completed_at,
        'assignee_id',   m.assignee_id,
        'assignee_name', ma.name,
        'sort_order',    m.sort_order,
        'is_overdue',    (m.due_date IS NOT NULL
                          AND m.due_date < CURRENT_DATE
                          AND m.status NOT IN ('COMPLETED','CANCELLED'))
      ) ORDER BY m.sort_order, m.due_date NULLS LAST
    )
    FROM milestones m
    LEFT JOIN users ma ON m.assignee_id = ma.id
    WHERE m.initiative_id = i.id
  ), '[]'::json)::JSONB              AS milestones,
  -- key_results
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', kr.id, 'title', kr.title, 'progress', kr.progress, 'status', kr.status
    ))
    FROM initiative_key_results ikr
    JOIN key_results kr ON ikr.kr_id = kr.id
    WHERE ikr.initiative_id = i.id AND kr.deleted_at IS NULL
  ), '[]'::json)::JSONB              AS key_results,
  -- milestone counts
  (SELECT COUNT(*)::INT FROM milestones m
   WHERE m.initiative_id = i.id AND m.status != 'CANCELLED')
                                     AS total_milestones,
  (SELECT COUNT(*)::INT FROM milestones m
   WHERE m.initiative_id = i.id AND m.status = 'COMPLETED')
                                     AS completed_milestones,
  -- área principal
  (SELECT a.id    FROM initiative_areas ia JOIN areas a ON a.id = ia.area_id
   WHERE ia.initiative_id = i.id AND ia.is_primary = true LIMIT 1)
                                     AS primary_area_id,
  (SELECT a.name  FROM initiative_areas ia JOIN areas a ON a.id = ia.area_id
   WHERE ia.initiative_id = i.id AND ia.is_primary = true LIMIT 1)
                                     AS primary_area_name,
  (SELECT a.color FROM initiative_areas ia JOIN areas a ON a.id = ia.area_id
   WHERE ia.initiative_id = i.id AND ia.is_primary = true LIMIT 1)
                                     AS primary_area_color,
  -- áreas involucradas
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', a.id, 'name', a.name, 'color', a.color, 'is_primary', ia.is_primary
    ) ORDER BY ia.is_primary DESC, a.name)
    FROM initiative_areas ia
    JOIN areas a ON a.id = ia.area_id
    WHERE ia.initiative_id = i.id
  ), '[]'::json)::JSONB              AS involved_areas,
  -- dependencias
  COALESCE((
    SELECT json_agg(json_build_object(
      'id',              idep.id,
      'description',     idep.description,
      'type',            idep.type,
      'status',          idep.status,
      'depends_on_id',   idep.depends_on_id,
      'depends_on_title', dep_i.title,
      'resolved_at',     idep.resolved_at,
      'created_at',      idep.created_at
    ) ORDER BY idep.created_at)
    FROM initiative_dependencies idep
    LEFT JOIN initiatives dep_i ON dep_i.id = idep.depends_on_id AND dep_i.deleted_at IS NULL
    WHERE idep.initiative_id = i.id
  ), '[]'::json)::JSONB              AS dependencies,
  (SELECT COUNT(*)::INT FROM initiative_dependencies idep
   WHERE idep.initiative_id = i.id
     AND idep.status IN ('PENDING','BLOCKED'))
                                     AS open_dependencies_count
FROM initiatives i
LEFT JOIN users u ON i.owner_id = u.id
LEFT JOIN teams t ON i.team_id  = t.id
WHERE i.deleted_at IS NULL;

-- Recrear vistas dependientes
CREATE OR REPLACE VIEW v_initiatives_by_kr AS
SELECT
  ikr.kr_id,
  ikr.initiative_id,
  i.title        AS initiative_title,
  i.status       AS initiative_status,
  i.progress     AS initiative_progress,
  i.due_date     AS initiative_due_date,
  i.is_overdue,
  i.days_overdue,
  i.team_name,
  i.owner_name,
  i.total_milestones,
  i.completed_milestones
FROM initiative_key_results ikr
JOIN v_initiative_timeline i ON ikr.initiative_id = i.id;

CREATE OR REPLACE VIEW v_overdue_milestones AS
SELECT
  m.id,
  m.initiative_id,
  m.title,
  m.status,
  m.due_date,
  (CURRENT_DATE - m.due_date)        AS days_overdue,
  m.assignee_id,
  u.name                             AS assignee_name,
  i.title                            AS initiative_title,
  i.organization_id,
  i.team_id,
  t.name                             AS team_name,
  COALESCE((
    SELECT json_agg(kr.title)
    FROM initiative_key_results ikr
    JOIN key_results kr ON ikr.kr_id = kr.id
    WHERE ikr.initiative_id = m.initiative_id AND kr.deleted_at IS NULL
  ), '[]'::json)::JSONB              AS impacted_krs
FROM milestones m
JOIN initiatives i  ON m.initiative_id = i.id AND i.deleted_at IS NULL
LEFT JOIN users u   ON m.assignee_id = u.id
LEFT JOIN teams t   ON i.team_id = t.id
WHERE m.status NOT IN ('COMPLETED','CANCELLED')
  AND m.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;

-- ── 6. v_sprint_board (depende de v_initiative_timeline) ──────────────
CREATE OR REPLACE VIEW v_sprint_board AS
SELECT
  sc.id                                AS sprint_id,
  sc.organization_id,
  sc.cycle_id,
  sc.team_id,
  t.name                               AS team_name,
  sc.name                              AS sprint_name,
  sc.goal,
  sc.status,
  sc.start_date,
  sc.end_date,
  sc.planned_velocity,
  COALESCE(sc.actual_velocity, 0)      AS actual_velocity,
  COALESCE((
    SELECT json_agg(json_build_object(
      'kr_id',                 kr.id,
      'kr_title',              kr.title,
      'progress',              kr.progress,
      'status',                kr.status,
      'metric_unit',           kr.metric_unit,
      'expected_contribution', sgk.expected_contribution
    ) ORDER BY kr.title)
    FROM sprint_goal_krs sgk
    JOIN key_results kr ON sgk.kr_id = kr.id AND kr.deleted_at IS NULL
    WHERE sgk.sprint_id = sc.id
  ), '[]'::json)::JSONB                AS sprint_krs,
  (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'TODO')         AS todo_count,
  (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'IN_PROGRESS')  AS in_progress_count,
  (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'DONE')         AS done_count,
  (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL)                             AS total_count,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id',                  it.id,
      'title',               it.title,
      'status',              it.status,
      'progress',            it.progress,
      'is_overdue',          it.is_overdue,
      'team_name',           it.team_name,
      'owner_name',          it.owner_name,
      'due_date',            it.due_date,
      'total_milestones',    it.total_milestones,
      'completed_milestones',it.completed_milestones
    ) ORDER BY it.status, it.title)
    FROM v_initiative_timeline it
    WHERE it.sprint_id = sc.id
  ), '[]'::json)::JSONB                AS initiatives,
  sc.created_at,
  sc.code                              AS sprint_code
FROM sprint_cycles sc
LEFT JOIN teams t ON sc.team_id = t.id;
