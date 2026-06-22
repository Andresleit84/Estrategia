-- 092_planning_rtn.sql
-- RTN: Revisión Trimestral del Negocio (equivalente a SAFe PI Planning)
-- 11 etapas, artefactos kanban por etapa, dependencias, capacidad

-- ────────────────────────────────────────────
-- TABLAS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS planning_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id        UUID REFERENCES cycles(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  type            VARCHAR(20) NOT NULL DEFAULT 'QUARTERLY'
                    CHECK (type IN ('QUARTERLY','ANNUAL','PI')),
  status          VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
                    CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED')),
  current_stage   INT NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 11),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stage           INT NOT NULL CHECK (stage BETWEEN 1 AND 11),
  title           TEXT NOT NULL,
  description     TEXT,
  assignee        TEXT,
  due_date        DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'TODO'
                    CHECK (status IN ('TODO','IN_PROGRESS','DONE','BLOCKED')),
  item_type       VARCHAR(30) DEFAULT 'ARTIFACT'
                    CHECK (item_type IN ('ARTIFACT','ACTION','DECISION','RISK')),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_area       TEXT NOT NULL,
  to_area         TEXT NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','RESOLVED','ESCALATED','DEFERRED')),
  owner           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_capacity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  area            TEXT NOT NULL,
  objective_title TEXT,
  total_people    INT NOT NULL DEFAULT 0,
  allocated       INT NOT NULL DEFAULT 0,
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- ÍNDICES
-- ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_planning_sessions_org   ON planning_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_planning_sessions_cycle ON planning_sessions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_planning_items_session  ON planning_items(session_id, stage);
CREATE INDEX IF NOT EXISTS idx_planning_deps_session   ON planning_dependencies(session_id);
CREATE INDEX IF NOT EXISTS idx_planning_cap_session    ON planning_capacity(session_id);

-- ────────────────────────────────────────────
-- VISTAS
-- ────────────────────────────────────────────

CREATE OR REPLACE VIEW v_planning_sessions AS
SELECT
  ps.*,
  c.name  AS cycle_name,
  c.type  AS cycle_type,
  (SELECT COUNT(*)  FROM planning_items pi WHERE pi.session_id = ps.id)                          AS total_items,
  (SELECT COUNT(*)  FROM planning_items pi WHERE pi.session_id = ps.id AND pi.status = 'DONE')   AS done_items,
  (SELECT COUNT(*)  FROM planning_items pi WHERE pi.session_id = ps.id AND pi.status = 'BLOCKED') AS blocked_items
FROM planning_sessions ps
LEFT JOIN cycles c ON c.id = ps.cycle_id;

-- ────────────────────────────────────────────
-- SPs — SESIONES
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_create_planning_session(
  p_org_id      UUID,
  p_cycle_id    UUID,
  p_name        TEXT,
  p_type        VARCHAR,
  p_description TEXT
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO planning_sessions(organization_id, cycle_id, name, type, description, started_at)
  VALUES(p_org_id, p_cycle_id, p_name, p_type, p_description, NOW())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sp_update_planning_session(
  p_org_id       UUID,
  p_id           UUID,
  p_name         TEXT,
  p_status       VARCHAR,
  p_current_stage INT,
  p_description  TEXT
) AS $$
BEGIN
  UPDATE planning_sessions
  SET
    name          = COALESCE(p_name, name),
    status        = COALESCE(p_status, status),
    current_stage = COALESCE(p_current_stage, current_stage),
    description   = COALESCE(p_description, description),
    completed_at  = CASE
      WHEN p_status = 'COMPLETED' AND completed_at IS NULL THEN NOW()
      ELSE completed_at
    END,
    updated_at    = NOW()
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sp_delete_planning_session(
  p_org_id UUID,
  p_id     UUID
) AS $$
BEGIN
  DELETE FROM planning_sessions WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- SPs — ITEMS (KANBAN)
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_upsert_planning_item(
  p_id          UUID,
  p_session_id  UUID,
  p_org_id      UUID,
  p_stage       INT,
  p_title       TEXT,
  p_description TEXT,
  p_assignee    TEXT,
  p_due_date    DATE,
  p_status      VARCHAR,
  p_item_type   VARCHAR,
  p_sort_order  INT
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO planning_items(session_id, organization_id, stage, title, description,
                               assignee, due_date, status, item_type, sort_order)
    VALUES(p_session_id, p_org_id, p_stage, p_title, p_description,
           p_assignee, p_due_date,
           COALESCE(p_status,'TODO'), COALESCE(p_item_type,'ARTIFACT'), COALESCE(p_sort_order,0))
    RETURNING id INTO v_id;
  ELSE
    UPDATE planning_items
    SET
      title       = COALESCE(p_title, title),
      description = COALESCE(p_description, description),
      assignee    = COALESCE(p_assignee, assignee),
      due_date    = COALESCE(p_due_date, due_date),
      status      = COALESCE(p_status, status),
      item_type   = COALESCE(p_item_type, item_type),
      sort_order  = COALESCE(p_sort_order, sort_order),
      updated_at  = NOW()
    WHERE id = p_id AND organization_id = p_org_id;
    v_id := p_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sp_move_planning_item(
  p_org_id UUID,
  p_id     UUID,
  p_status VARCHAR
) AS $$
BEGIN
  UPDATE planning_items
  SET status = p_status, updated_at = NOW()
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sp_delete_planning_item(
  p_org_id UUID,
  p_id     UUID
) AS $$
BEGIN
  DELETE FROM planning_items WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- SPs — DEPENDENCIAS
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_upsert_planning_dependency(
  p_id          UUID,
  p_session_id  UUID,
  p_org_id      UUID,
  p_from_area   TEXT,
  p_to_area     TEXT,
  p_description TEXT,
  p_status      VARCHAR,
  p_owner       TEXT
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO planning_dependencies(session_id, organization_id, from_area, to_area,
                                      description, status, owner)
    VALUES(p_session_id, p_org_id, p_from_area, p_to_area,
           p_description, COALESCE(p_status,'OPEN'), p_owner)
    RETURNING id INTO v_id;
  ELSE
    UPDATE planning_dependencies
    SET
      from_area   = COALESCE(p_from_area, from_area),
      to_area     = COALESCE(p_to_area, to_area),
      description = COALESCE(p_description, description),
      status      = COALESCE(p_status, status),
      owner       = COALESCE(p_owner, owner),
      updated_at  = NOW()
    WHERE id = p_id AND organization_id = p_org_id;
    v_id := p_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sp_delete_planning_dependency(
  p_org_id UUID,
  p_id     UUID
) AS $$
BEGIN
  DELETE FROM planning_dependencies WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- SPs — CAPACIDAD
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_upsert_planning_capacity(
  p_id              UUID,
  p_session_id      UUID,
  p_org_id          UUID,
  p_area            TEXT,
  p_objective_title TEXT,
  p_total_people    INT,
  p_allocated       INT,
  p_notes           TEXT
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO planning_capacity(session_id, organization_id, area, objective_title,
                                  total_people, allocated, notes)
    VALUES(p_session_id, p_org_id, p_area, p_objective_title,
           COALESCE(p_total_people,0), COALESCE(p_allocated,0), p_notes)
    RETURNING id INTO v_id;
  ELSE
    UPDATE planning_capacity
    SET
      area            = COALESCE(p_area, area),
      objective_title = COALESCE(p_objective_title, objective_title),
      total_people    = COALESCE(p_total_people, total_people),
      allocated       = COALESCE(p_allocated, allocated),
      notes           = COALESCE(p_notes, notes),
      updated_at      = NOW()
    WHERE id = p_id AND organization_id = p_org_id;
    v_id := p_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sp_delete_planning_capacity(
  p_org_id UUID,
  p_id     UUID
) AS $$
BEGIN
  DELETE FROM planning_capacity WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- GRANTS
-- ────────────────────────────────────────────

GRANT SELECT ON v_planning_sessions TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON planning_sessions   TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON planning_items      TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON planning_dependencies TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON planning_capacity   TO okr_user;

GRANT EXECUTE ON FUNCTION  sp_create_planning_session    TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_update_planning_session    TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_delete_planning_session    TO okr_user;
GRANT EXECUTE ON FUNCTION  sp_upsert_planning_item       TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_move_planning_item         TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_delete_planning_item       TO okr_user;
GRANT EXECUTE ON FUNCTION  sp_upsert_planning_dependency TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_delete_planning_dependency TO okr_user;
GRANT EXECUTE ON FUNCTION  sp_upsert_planning_capacity   TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_delete_planning_capacity   TO okr_user;
