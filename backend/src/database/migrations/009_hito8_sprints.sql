-- ============================================================
-- Hito 8: Modo ágil — Sprints y cadencia
-- ============================================================

-- ── TABLES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sprint_cycles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  cycle_id          UUID NOT NULL REFERENCES cycles(id),
  team_id           UUID NOT NULL REFERENCES teams(id),
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  goal              TEXT CHECK (goal IS NULL OR char_length(goal) <= 500),
  status            TEXT NOT NULL DEFAULT 'PLANNING'
                      CHECK (status IN ('PLANNING','ACTIVE','COMPLETED','CANCELLED')),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  planned_velocity  INT NOT NULL DEFAULT 0 CHECK (planned_velocity >= 0),
  actual_velocity   INT CHECK (actual_velocity IS NULL OR actual_velocity >= 0),
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sprint_dates_check CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS sprint_goal_krs (
  sprint_id              UUID NOT NULL REFERENCES sprint_cycles(id) ON DELETE CASCADE,
  kr_id                  UUID NOT NULL REFERENCES key_results(id)   ON DELETE CASCADE,
  expected_contribution  NUMERIC(5,2) NOT NULL DEFAULT 0
                           CHECK (expected_contribution >= 0 AND expected_contribution <= 100),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sprint_id, kr_id)
);

-- Now add sprint_id FK to initiatives (safe with IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'initiatives' AND column_name = 'sprint_id'
  ) THEN
    ALTER TABLE initiatives
      ADD COLUMN sprint_id UUID REFERENCES sprint_cycles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ── INDEXES ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sprints_org           ON sprint_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_sprints_cycle_team    ON sprint_cycles(cycle_id, team_id);
CREATE INDEX IF NOT EXISTS idx_sprints_team_status   ON sprint_cycles(team_id, status);
CREATE INDEX IF NOT EXISTS idx_sprint_goal_krs_sprint ON sprint_goal_krs(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_goal_krs_kr     ON sprint_goal_krs(kr_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_sprint     ON initiatives(sprint_id) WHERE sprint_id IS NOT NULL;

-- ── TRIGGERS ────────────────────────────────────────────────

-- updated_at
CREATE OR REPLACE FUNCTION fn_sprint_cycles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sprint_cycles_updated_at ON sprint_cycles;
CREATE TRIGGER trg_sprint_cycles_updated_at
  BEFORE UPDATE ON sprint_cycles
  FOR EACH ROW EXECUTE FUNCTION fn_sprint_cycles_updated_at();

-- Validate org mode: sprints only for AGILE or HYBRID
CREATE OR REPLACE FUNCTION fn_validate_sprint_org_mode()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_mode TEXT;
BEGIN
  SELECT mode INTO v_mode FROM organizations WHERE id = NEW.organization_id;
  IF v_mode = 'TRADITIONAL' THEN
    RAISE EXCEPTION 'Los sprints solo están disponibles en organizaciones AGILE o HYBRID'
      USING ERRCODE = 'P0050';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sprint_org_mode ON sprint_cycles;
CREATE TRIGGER trg_validate_sprint_org_mode
  BEFORE INSERT ON sprint_cycles
  FOR EACH ROW EXECUTE FUNCTION fn_validate_sprint_org_mode();

-- Validate sprint dates within parent cycle dates
CREATE OR REPLACE FUNCTION fn_validate_sprint_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_start DATE;
  v_cycle_end   DATE;
BEGIN
  SELECT start_date, end_date INTO v_cycle_start, v_cycle_end
  FROM cycles WHERE id = NEW.cycle_id;

  IF NEW.start_date < v_cycle_start THEN
    RAISE EXCEPTION 'El sprint no puede comenzar antes que el ciclo OKR (ciclo inicia %)',
      v_cycle_start USING ERRCODE = 'P0051';
  END IF;

  IF NEW.end_date > v_cycle_end THEN
    RAISE EXCEPTION 'El sprint no puede terminar después del ciclo OKR (ciclo termina %)',
      v_cycle_end USING ERRCODE = 'P0052';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sprint_dates ON sprint_cycles;
CREATE TRIGGER trg_validate_sprint_dates
  BEFORE INSERT OR UPDATE OF start_date, end_date, cycle_id ON sprint_cycles
  FOR EACH ROW EXECUTE FUNCTION fn_validate_sprint_dates();

-- Maximum one ACTIVE sprint per team
CREATE OR REPLACE FUNCTION fn_single_active_sprint_per_team()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    IF EXISTS (
      SELECT 1 FROM sprint_cycles
      WHERE team_id          = NEW.team_id
        AND organization_id  = NEW.organization_id
        AND status           = 'ACTIVE'
        AND id              != NEW.id
    ) THEN
      RAISE EXCEPTION 'Ya existe un sprint ACTIVE para este equipo. Ciérralo antes de activar uno nuevo.'
        USING ERRCODE = 'P0053';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_active_sprint_per_team ON sprint_cycles;
CREATE TRIGGER trg_single_active_sprint_per_team
  BEFORE INSERT OR UPDATE OF status ON sprint_cycles
  FOR EACH ROW EXECUTE FUNCTION fn_single_active_sprint_per_team();

-- ── STORED PROCEDURES ────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_sprint(
  p_org_id          UUID,
  p_cycle_id        UUID,
  p_team_id         UUID,
  p_name            TEXT,
  p_goal            TEXT,
  p_start_date      DATE,
  p_end_date        DATE,
  p_planned_velocity INT,
  p_created_by      UUID,
  INOUT p_sprint_id UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sprint_cycles (
    organization_id, cycle_id, team_id, name, goal,
    start_date, end_date, planned_velocity, created_by
  ) VALUES (
    p_org_id, p_cycle_id, p_team_id, p_name, p_goal,
    p_start_date, p_end_date, p_planned_velocity, p_created_by
  ) RETURNING id INTO p_sprint_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_activate_sprint(
  p_sprint_id UUID,
  p_user_id   UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sprint_cycles
  SET status = 'ACTIVE', updated_at = NOW()
  WHERE id = p_sprint_id AND status = 'PLANNING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sprint no encontrado o no está en estado PLANNING'
      USING ERRCODE = 'P0054';
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_close_sprint(
  p_sprint_id  UUID,
  p_velocity   INT,
  p_user_id    UUID,
  INOUT p_suggested_checkins JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  -- Verify sprint exists and is ACTIVE
  IF NOT EXISTS (
    SELECT 1 FROM sprint_cycles WHERE id = p_sprint_id AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Sprint no encontrado o no está en estado ACTIVE'
      USING ERRCODE = 'P0055';
  END IF;

  -- Close the sprint
  UPDATE sprint_cycles
  SET status = 'COMPLETED', actual_velocity = p_velocity, updated_at = NOW()
  WHERE id = p_sprint_id;

  -- Build suggested check-ins for linked KRs (user must confirm before creating)
  SELECT COALESCE(json_agg(json_build_object(
    'kr_id',          kr.id,
    'kr_title',       kr.title,
    'metric_unit',    kr.metric_unit,
    'current_value',  kr.current_value,
    'target_value',   kr.target_value,
    'progress',       ROUND(kr.progress::NUMERIC, 1),
    'owner_id',       kr.owner_id
  ) ORDER BY kr.title), '[]'::json)::JSONB
  INTO p_suggested_checkins
  FROM sprint_goal_krs sgk
  JOIN key_results kr ON sgk.kr_id = kr.id AND kr.deleted_at IS NULL
  WHERE sgk.sprint_id = p_sprint_id;
END;
$$;

-- ── FUNCTIONS ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_sprint_okr_impact(p_sprint_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_sprint  RECORD;
  v_krs     JSONB;
BEGIN
  SELECT * INTO v_sprint FROM sprint_cycles WHERE id = p_sprint_id;
  IF NOT FOUND THEN RETURN '{"error":"not_found"}'::JSONB; END IF;

  -- For each linked KR: current progress + progress at sprint start (from check-ins)
  WITH kr_data AS (
    SELECT
      sgk.kr_id,
      sgk.expected_contribution,
      kr.title         AS kr_title,
      kr.type          AS kr_type,
      kr.metric_unit,
      kr.progress      AS current_progress,
      kr.start_value,
      kr.target_value,
      -- Progress at sprint start: latest check-in strictly before sprint start_date
      COALESCE((
        SELECT ROUND(
          CASE kr.type
            WHEN 'ACHIEVE' THEN
              CASE WHEN ci.current_value >= kr.target_value THEN 100.0 ELSE 0.0 END
            WHEN 'DECREASE' THEN
              LEAST(100, GREATEST(0,
                (kr.start_value - ci.current_value)::NUMERIC /
                NULLIF(kr.start_value - kr.target_value, 0) * 100))
            ELSE
              LEAST(100, GREATEST(0,
                (ci.current_value - kr.start_value)::NUMERIC /
                NULLIF(kr.target_value - kr.start_value, 0) * 100))
          END::NUMERIC, 1)
        FROM check_ins ci
        WHERE ci.kr_id = sgk.kr_id AND ci.checked_at < v_sprint.start_date
        ORDER BY ci.checked_at DESC LIMIT 1
      ), 0) AS progress_at_start
    FROM sprint_goal_krs sgk
    JOIN key_results kr ON sgk.kr_id = kr.id AND kr.deleted_at IS NULL
    WHERE sgk.sprint_id = p_sprint_id
  )
  SELECT COALESCE(json_agg(json_build_object(
    'kr_id',                  kr_id,
    'kr_title',               kr_title,
    'metric_unit',            metric_unit,
    'expected_contribution',  expected_contribution,
    'current_progress',       current_progress,
    'progress_at_start',      progress_at_start,
    'actual_contribution',    ROUND((current_progress - progress_at_start)::NUMERIC, 1)
  )), '[]'::json)::JSONB
  INTO v_krs
  FROM kr_data;

  RETURN jsonb_build_object(
    'sprint_id',   v_sprint.id,
    'sprint_name', v_sprint.name,
    'status',      v_sprint.status,
    'start_date',  v_sprint.start_date,
    'end_date',    v_sprint.end_date,
    'key_results', COALESCE(v_krs, '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_calculate_burnup(p_cycle_id UUID, p_team_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_result        JSONB := '[]'::JSONB;
  v_total_sprints INT;
  v_sprint        RECORD;
  v_actual_prog   NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_total_sprints
  FROM sprint_cycles
  WHERE cycle_id = p_cycle_id AND team_id = p_team_id
    AND status NOT IN ('CANCELLED');

  IF v_total_sprints = 0 THEN RETURN '[]'::JSONB; END IF;

  FOR v_sprint IN
    SELECT sc.*,
           ROW_NUMBER() OVER (ORDER BY sc.start_date) AS sprint_num
    FROM sprint_cycles sc
    WHERE sc.cycle_id = p_cycle_id AND sc.team_id = p_team_id
      AND sc.status NOT IN ('CANCELLED')
    ORDER BY sc.start_date
  LOOP
    -- Actual progress: average of linked KR progress using check-in value at sprint end
    SELECT COALESCE(AVG(
      CASE kr.type
        WHEN 'ACHIEVE' THEN
          CASE WHEN COALESCE(ci.current_value, kr.current_value) >= kr.target_value THEN 100.0 ELSE 0.0 END
        WHEN 'DECREASE' THEN
          LEAST(100, GREATEST(0,
            (kr.start_value - COALESCE(ci.current_value, kr.current_value))::NUMERIC /
            NULLIF(kr.start_value - kr.target_value, 0) * 100))
        ELSE
          LEAST(100, GREATEST(0,
            (COALESCE(ci.current_value, kr.current_value) - kr.start_value)::NUMERIC /
            NULLIF(kr.target_value - kr.start_value, 0) * 100))
      END
    ), 0)
    INTO v_actual_prog
    FROM sprint_goal_krs sgk
    JOIN key_results kr ON sgk.kr_id = kr.id AND kr.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT current_value FROM check_ins
      WHERE kr_id = kr.id AND checked_at <= (v_sprint.end_date::TIMESTAMPTZ + INTERVAL '1 day')
      ORDER BY checked_at DESC LIMIT 1
    ) ci ON true
    WHERE sgk.sprint_id = v_sprint.id;

    v_result := v_result || jsonb_build_object(
      'sprint_id',        v_sprint.id,
      'sprint_name',      v_sprint.name,
      'sprint_num',       v_sprint.sprint_num,
      'end_date',         v_sprint.end_date,
      'status',           v_sprint.status,
      'ideal_progress',   ROUND((v_sprint.sprint_num::NUMERIC / v_total_sprints) * 100, 1),
      'actual_progress',  ROUND(v_actual_prog::NUMERIC, 1),
      'planned_velocity', v_sprint.planned_velocity,
      'actual_velocity',  COALESCE(v_sprint.actual_velocity, 0)
    );
  END LOOP;

  RETURN v_result;
END;
$$;

-- ── VIEWS ───────────────────────────────────────────────────

-- Drop dependent views before redefining v_initiative_timeline (adding sprint_id column)
DROP VIEW IF EXISTS v_initiatives_by_kr;
DROP VIEW IF EXISTS v_overdue_milestones;
DROP VIEW IF EXISTS v_initiative_timeline;

-- Update v_initiative_timeline to expose sprint_id
CREATE VIEW v_initiative_timeline AS
SELECT
  i.id,
  i.organization_id,
  i.cycle_id,
  i.team_id,
  i.owner_id,
  i.sprint_id,
  i.title,
  i.description,
  i.status,
  i.progress,
  i.start_date,
  i.due_date,
  i.completed_at,
  i.created_at,
  u.name                                   AS owner_name,
  t.name                                   AS team_name,
  (i.due_date < CURRENT_DATE AND i.status NOT IN ('DONE','CANCELLED')) AS is_overdue,
  CASE WHEN i.due_date IS NOT NULL AND i.status NOT IN ('DONE','CANCELLED')
    THEN GREATEST(0, (CURRENT_DATE - i.due_date))
    ELSE 0
  END                                      AS days_overdue,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id',            m.id,
        'title',         m.title,
        'status',        m.status,
        'due_date',      m.due_date,
        'completed_at',  m.completed_at,
        'assignee_id',   m.assignee_id,
        'assignee_name', a.name,
        'sort_order',    m.sort_order,
        'is_overdue',    (m.due_date < CURRENT_DATE AND m.status NOT IN ('COMPLETED','CANCELLED'))
      ) ORDER BY m.sort_order, m.due_date NULLS LAST
    )
    FROM milestones m
    LEFT JOIN users a ON m.assignee_id = a.id
    WHERE m.initiative_id = i.id
  ), '[]'::json)::JSONB                    AS milestones,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id',       kr.id,
        'title',    kr.title,
        'progress', kr.progress,
        'status',   kr.status
      )
    )
    FROM initiative_key_results ikr
    JOIN key_results kr ON ikr.kr_id = kr.id
    WHERE ikr.initiative_id = i.id AND kr.deleted_at IS NULL
  ), '[]'::json)::JSONB                    AS key_results,
  (SELECT COUNT(*) FROM milestones m WHERE m.initiative_id = i.id AND m.status != 'CANCELLED')::INT AS total_milestones,
  (SELECT COUNT(*) FROM milestones m WHERE m.initiative_id = i.id AND m.status = 'COMPLETED')::INT  AS completed_milestones
FROM initiatives i
LEFT JOIN users  u ON i.owner_id = u.id
LEFT JOIN teams  t ON i.team_id  = t.id
WHERE i.deleted_at IS NULL;

-- Sprint board: sprint details + grouped initiatives + linked KRs
CREATE OR REPLACE VIEW v_sprint_board AS
SELECT
  sc.id                   AS sprint_id,
  sc.organization_id,
  sc.cycle_id,
  sc.team_id,
  t.name                  AS team_name,
  sc.name                 AS sprint_name,
  sc.goal,
  sc.status,
  sc.start_date,
  sc.end_date,
  sc.planned_velocity,
  COALESCE(sc.actual_velocity, 0) AS actual_velocity,
  -- Linked KRs
  COALESCE((
    SELECT json_agg(json_build_object(
      'kr_id',                kr.id,
      'kr_title',             kr.title,
      'progress',             kr.progress,
      'status',               kr.status,
      'metric_unit',          kr.metric_unit,
      'expected_contribution', sgk.expected_contribution
    ) ORDER BY kr.title)
    FROM sprint_goal_krs sgk
    JOIN key_results kr ON sgk.kr_id = kr.id AND kr.deleted_at IS NULL
    WHERE sgk.sprint_id = sc.id
  ), '[]'::json)::JSONB   AS sprint_krs,
  -- Initiative counts by status
  (SELECT COUNT(*) FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'TODO')::INT          AS todo_count,
  (SELECT COUNT(*) FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'IN_PROGRESS')::INT   AS in_progress_count,
  (SELECT COUNT(*) FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'DONE')::INT          AS done_count,
  (SELECT COUNT(*) FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL)::INT                              AS total_count,
  -- Initiatives as JSONB
  COALESCE((
    SELECT json_agg(json_build_object(
      'id',                   it.id,
      'title',                it.title,
      'status',               it.status,
      'progress',             it.progress,
      'is_overdue',           it.is_overdue,
      'team_name',            it.team_name,
      'owner_name',           it.owner_name,
      'due_date',             it.due_date,
      'total_milestones',     it.total_milestones,
      'completed_milestones', it.completed_milestones
    ) ORDER BY it.status, it.title)
    FROM v_initiative_timeline it
    WHERE it.sprint_id = sc.id
  ), '[]'::json)::JSONB   AS initiatives,
  sc.created_at
FROM sprint_cycles sc
LEFT JOIN teams t ON sc.team_id = t.id;

-- Sprint velocity history per team
CREATE OR REPLACE VIEW v_sprint_velocity AS
SELECT
  sc.id                                    AS sprint_id,
  sc.organization_id,
  sc.team_id,
  t.name                                   AS team_name,
  sc.cycle_id,
  sc.name                                  AS sprint_name,
  sc.status,
  sc.start_date,
  sc.end_date,
  sc.planned_velocity,
  COALESCE(sc.actual_velocity, 0)          AS actual_velocity,
  ROW_NUMBER() OVER (
    PARTITION BY sc.team_id, sc.cycle_id
    ORDER BY sc.start_date
  )                                        AS sprint_num
FROM sprint_cycles sc
LEFT JOIN teams t ON sc.team_id = t.id
WHERE sc.status NOT IN ('CANCELLED');

-- All sprints in a cycle (timeline view)
CREATE OR REPLACE VIEW v_cycle_sprint_timeline AS
SELECT
  sc.id                                    AS sprint_id,
  sc.organization_id,
  sc.cycle_id,
  c.name                                   AS cycle_name,
  sc.team_id,
  t.name                                   AS team_name,
  sc.name                                  AS sprint_name,
  sc.goal,
  sc.status,
  sc.start_date,
  sc.end_date,
  sc.planned_velocity,
  COALESCE(sc.actual_velocity, 0)          AS actual_velocity,
  ROW_NUMBER() OVER (
    PARTITION BY sc.team_id, sc.cycle_id
    ORDER BY sc.start_date
  )                                        AS sprint_num,
  (SELECT COUNT(*) FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL)::INT AS initiative_count,
  (SELECT COUNT(*) FROM sprint_goal_krs WHERE sprint_id = sc.id)::INT                    AS kr_count,
  sc.created_at
FROM sprint_cycles sc
LEFT JOIN cycles c ON sc.cycle_id = c.id
LEFT JOIN teams t   ON sc.team_id  = t.id;

-- Recreate views dropped above (v_initiatives_by_kr depends on v_initiative_timeline)
CREATE OR REPLACE VIEW v_initiatives_by_kr AS
SELECT
  ikr.kr_id,
  ikr.initiative_id,
  i.title                AS initiative_title,
  i.status               AS initiative_status,
  i.progress             AS initiative_progress,
  i.due_date             AS initiative_due_date,
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
  (CURRENT_DATE - m.due_date)  AS days_overdue,
  m.assignee_id,
  u.name                       AS assignee_name,
  i.title                      AS initiative_title,
  i.organization_id,
  i.team_id,
  t.name                       AS team_name,
  COALESCE((
    SELECT json_agg(kr.title)
    FROM initiative_key_results ikr
    JOIN key_results kr ON ikr.kr_id = kr.id
    WHERE ikr.initiative_id = m.initiative_id AND kr.deleted_at IS NULL
  ), '[]'::json)::JSONB        AS impacted_krs
FROM milestones m
JOIN initiatives i ON m.initiative_id = i.id AND i.deleted_at IS NULL
LEFT JOIN users u ON m.assignee_id = u.id
LEFT JOIN teams t ON i.team_id = t.id
WHERE m.status NOT IN ('COMPLETED','CANCELLED')
  AND m.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;
