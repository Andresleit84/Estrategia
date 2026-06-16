-- Migration 027: Códigos secuenciales por artefacto
-- Cada artefacto recibe un código legible: OBJ-1, KR-3, INI-2, SPR-1, EP-1, FT-2, HU-5, PRB-1, INT-1
-- Los códigos son inmutables y únicos por organización + prefijo.

-- ── 1. Tabla de secuencias por org y prefijo ─────────────────────────────────

CREATE TABLE IF NOT EXISTS code_sequences (
  org_id       UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prefix       TEXT    NOT NULL,
  last_value   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, prefix)
);

GRANT SELECT, INSERT, UPDATE ON code_sequences TO okr_user;

-- ── 2. Función generadora de código ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_next_code(p_org_id UUID, p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE v_next INTEGER;
BEGIN
  INSERT INTO code_sequences (org_id, prefix, last_value)
  VALUES (p_org_id, p_prefix, 1)
  ON CONFLICT (org_id, prefix)
  DO UPDATE SET last_value = code_sequences.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN p_prefix || '-' || v_next;
END;
$$;

-- ── 3. ADD COLUMN code a cada tabla ──────────────────────────────────────────

ALTER TABLE objectives               ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE key_results              ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE initiatives              ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE sprint_cycles            ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE backlog_items            ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE organizational_problems  ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE strategic_intents        ADD COLUMN IF NOT EXISTS code TEXT;

-- ── 4. Trigger genérico para tablas con organization_id ──────────────────────

CREATE OR REPLACE FUNCTION fn_assign_artifact_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := fn_next_code(NEW.organization_id, TG_ARGV[0]);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger específico para key_results (organization_id vive en objectives)
CREATE OR REPLACE FUNCTION fn_assign_kr_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_org_id UUID;
BEGIN
  IF NEW.code IS NULL THEN
    SELECT organization_id INTO v_org_id FROM objectives WHERE id = NEW.objective_id;
    NEW.code := fn_next_code(v_org_id, 'KR');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger específico para backlog_items (prefijo depende del tipo)
CREATE OR REPLACE FUNCTION fn_assign_backlog_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_prefix TEXT;
BEGIN
  IF NEW.code IS NULL THEN
    v_prefix := CASE NEW.type
      WHEN 'EPIC'    THEN 'EP'
      WHEN 'FEATURE' THEN 'FT'
      ELSE                'HU'
    END;
    NEW.code := fn_next_code(NEW.organization_id, v_prefix);
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. Registrar triggers ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_objectives_code              ON objectives;
DROP TRIGGER IF EXISTS trg_key_results_code             ON key_results;
DROP TRIGGER IF EXISTS trg_initiatives_code             ON initiatives;
DROP TRIGGER IF EXISTS trg_sprint_cycles_code           ON sprint_cycles;
DROP TRIGGER IF EXISTS trg_backlog_items_code           ON backlog_items;
DROP TRIGGER IF EXISTS trg_organizational_problems_code ON organizational_problems;
DROP TRIGGER IF EXISTS trg_strategic_intents_code       ON strategic_intents;

CREATE TRIGGER trg_objectives_code
  BEFORE INSERT ON objectives
  FOR EACH ROW EXECUTE FUNCTION fn_assign_artifact_code('OBJ');

CREATE TRIGGER trg_key_results_code
  BEFORE INSERT ON key_results
  FOR EACH ROW EXECUTE FUNCTION fn_assign_kr_code();

CREATE TRIGGER trg_initiatives_code
  BEFORE INSERT ON initiatives
  FOR EACH ROW EXECUTE FUNCTION fn_assign_artifact_code('INI');

CREATE TRIGGER trg_sprint_cycles_code
  BEFORE INSERT ON sprint_cycles
  FOR EACH ROW EXECUTE FUNCTION fn_assign_artifact_code('SPR');

CREATE TRIGGER trg_backlog_items_code
  BEFORE INSERT ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION fn_assign_backlog_code();

CREATE TRIGGER trg_organizational_problems_code
  BEFORE INSERT ON organizational_problems
  FOR EACH ROW EXECUTE FUNCTION fn_assign_artifact_code('PRB');

CREATE TRIGGER trg_strategic_intents_code
  BEFORE INSERT ON strategic_intents
  FOR EACH ROW EXECUTE FUNCTION fn_assign_artifact_code('INT');

-- ── 6. Actualizar registros existentes (backfill) ────────────────────────────
-- Se asignan códigos a los registros que ya existen, en orden de creación.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- objectives
  FOR r IN SELECT o.id, o.organization_id
           FROM objectives o
           WHERE o.code IS NULL AND o.deleted_at IS NULL
           ORDER BY o.created_at
  LOOP
    UPDATE objectives SET code = fn_next_code(r.organization_id, 'OBJ') WHERE id = r.id;
  END LOOP;

  -- key_results
  FOR r IN SELECT kr.id, o.organization_id
           FROM key_results kr
           JOIN objectives o ON o.id = kr.objective_id
           WHERE kr.code IS NULL AND kr.deleted_at IS NULL
           ORDER BY kr.created_at
  LOOP
    UPDATE key_results SET code = fn_next_code(r.organization_id, 'KR') WHERE id = r.id;
  END LOOP;

  -- initiatives
  FOR r IN SELECT id, organization_id FROM initiatives WHERE code IS NULL AND deleted_at IS NULL ORDER BY created_at LOOP
    UPDATE initiatives SET code = fn_next_code(r.organization_id, 'INI') WHERE id = r.id;
  END LOOP;

  -- sprint_cycles
  FOR r IN SELECT id, organization_id FROM sprint_cycles WHERE code IS NULL ORDER BY created_at LOOP
    UPDATE sprint_cycles SET code = fn_next_code(r.organization_id, 'SPR') WHERE id = r.id;
  END LOOP;

  -- backlog_items
  FOR r IN SELECT id, organization_id, type FROM backlog_items WHERE code IS NULL ORDER BY created_at LOOP
    UPDATE backlog_items
       SET code = fn_next_code(r.organization_id,
           CASE r.type WHEN 'EPIC' THEN 'EP' WHEN 'FEATURE' THEN 'FT' ELSE 'HU' END)
     WHERE id = r.id;
  END LOOP;

  -- organizational_problems
  FOR r IN SELECT id, organization_id FROM organizational_problems WHERE code IS NULL AND deleted_at IS NULL ORDER BY created_at LOOP
    UPDATE organizational_problems SET code = fn_next_code(r.organization_id, 'PRB') WHERE id = r.id;
  END LOOP;

  -- strategic_intents
  FOR r IN SELECT id, organization_id FROM strategic_intents WHERE code IS NULL AND deleted_at IS NULL ORDER BY created_at LOOP
    UPDATE strategic_intents SET code = fn_next_code(r.organization_id, 'INT') WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 7. Recrear vistas con el campo code ──────────────────────────────────────

-- v_objectives_with_progress  (code al final — columnas exactas de la BD actual)
CREATE OR REPLACE VIEW v_objectives_with_progress AS
 SELECT o.id,
    o.organization_id,
    o.cycle_id,
    o.parent_objective_id,
    o.owner_id,
    o.team_id,
    o.strategic_intent_id,
    o.title,
    o.description,
    o.level,
    o.status,
    o.rolled_from_id,
    o.created_by,
    o.created_at,
    o.updated_at,
    fn_calculate_objective_progress(o.id) AS progress,
    ( SELECT COUNT(*)::INT FROM key_results kr
       WHERE kr.objective_id = o.id
         AND kr.deleted_at IS NULL
         AND kr.status <> 'CANCELLED') AS kr_count,
    u.name  AS owner_name,
    u.email AS owner_email,
    t.name  AS team_name,
    o.code
   FROM objectives o
   LEFT JOIN users u ON u.id = o.owner_id
   LEFT JOIN teams t ON t.id = o.team_id
  WHERE o.deleted_at IS NULL;

-- v_key_results_with_trend  (code al final — columnas exactas de la BD actual)
CREATE OR REPLACE VIEW v_key_results_with_trend AS
WITH trend_calc AS (
  SELECT ci.kr_id,
    MAX(CASE WHEN ci.rn = 1 THEN ci.current_value ELSE NULL END) AS latest,
    MAX(CASE WHEN ci.rn = 2 THEN ci.current_value ELSE NULL END) AS prev,
    COUNT(*) AS total_checkins
  FROM ( SELECT check_ins.kr_id,
           check_ins.current_value,
           ROW_NUMBER() OVER (PARTITION BY check_ins.kr_id ORDER BY check_ins.checked_at DESC) AS rn
           FROM check_ins) ci
  WHERE ci.rn <= 3
  GROUP BY ci.kr_id
)
 SELECT kr.id,
    kr.objective_id,
    kr.owner_id,
    kr.title,
    kr.description,
    kr.type,
    kr.metric_unit,
    kr.start_value,
    kr.target_value,
    kr.current_value,
    kr.confidence,
    kr.progress,
    kr.status,
    kr.last_checkin_at,
    kr.created_by,
    kr.created_at,
    kr.updated_at,
    kr.deleted_at,
    kr.completed_at,
    u.name  AS owner_name,
    u.email AS owner_email,
    COALESCE(
      CASE
        WHEN tc.total_checkins < 2 THEN 'flat'
        WHEN tc.latest > tc.prev   THEN 'up'
        WHEN tc.latest < tc.prev   THEN 'down'
        ELSE 'flat'
      END, 'flat')::TEXT AS trend,
    COALESCE(tc.total_checkins, 0)::INT AS checkin_count,
    kr.code
   FROM key_results kr
   LEFT JOIN users u        ON kr.owner_id = u.id
   LEFT JOIN trend_calc tc  ON tc.kr_id    = kr.id
  WHERE kr.deleted_at IS NULL;

-- v_problems_with_stats  (DROP+CREATE para incluir code vía SELECT *)
DROP VIEW IF EXISTS v_problems_with_stats CASCADE;
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

-- v_strategic_intents_with_stats  (DROP+CREATE para incluir code vía SELECT *)
DROP VIEW IF EXISTS v_strategic_intents_with_stats CASCADE;
CREATE VIEW v_strategic_intents_with_stats AS
SELECT
  si.*,
  COUNT(DISTINCT pi.problem_id)::INT AS problem_count,
  COUNT(DISTINCT o.id)::INT          AS aligned_objectives_count
FROM strategic_intents si
LEFT JOIN problem_intents pi ON pi.intent_id = si.id
LEFT JOIN objectives o
       ON o.strategic_intent_id = si.id
      AND o.deleted_at IS NULL
WHERE si.deleted_at IS NULL
GROUP BY si.id;

-- v_backlog_items  (DROP+CREATE para agregar code y parent_code en posición correcta)
DROP VIEW IF EXISTS v_backlog_items CASCADE;
CREATE VIEW v_backlog_items AS
SELECT
  bi.id,
  bi.organization_id,
  bi.type,
  bi.title,
  bi.description,
  bi.acceptance_criteria,
  bi.status,
  bi.priority,
  bi.story_points,
  bi.parent_id,
  bi.initiative_id,
  bi.sprint_id,
  bi.assignee_id,
  bi.cycle_id,
  bi.created_by,
  bi.created_at,
  bi.updated_at,
  u.name                      AS assignee_name,
  creator.name                AS created_by_name,
  parent_bi.title             AS parent_title,
  parent_bi.type              AS parent_type,
  i.title                     AS initiative_title,
  sc.name                     AS sprint_name,
  c.name                      AS cycle_name,
  COALESCE(ch_stats.total,        0) AS children_count,
  COALESCE(ch_stats.done,         0) AS completed_children,
  COALESCE(ch_stats.total_pts,    0) AS total_story_points,
  COALESCE(ch_stats.done_pts,     0) AS done_story_points,
  CASE
    WHEN COALESCE(ch_stats.total, 0) = 0 THEN
      CASE bi.status WHEN 'DONE' THEN 100 ELSE 0 END
    ELSE
      ROUND(COALESCE(ch_stats.done, 0)::NUMERIC / ch_stats.total * 100)
  END                         AS progress,
  bi.code,
  parent_bi.code              AS parent_code
FROM backlog_items bi
LEFT JOIN users u                 ON bi.assignee_id  = u.id
LEFT JOIN users creator           ON bi.created_by   = creator.id
LEFT JOIN backlog_items parent_bi ON bi.parent_id    = parent_bi.id
LEFT JOIN initiatives i           ON bi.initiative_id = i.id
LEFT JOIN sprint_cycles sc        ON bi.sprint_id     = sc.id
LEFT JOIN cycles c                ON bi.cycle_id      = c.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                             AS total,
    COUNT(*) FILTER (WHERE ch.status = 'DONE')           AS done,
    SUM(COALESCE(ch.story_points, 0))                    AS total_pts,
    SUM(COALESCE(ch.story_points, 0))
      FILTER (WHERE ch.status = 'DONE')                  AS done_pts
  FROM backlog_items ch WHERE ch.parent_id = bi.id
) ch_stats ON true;

-- v_sprint_board  (columnas exactas de la BD actual + sprint_code al final)
CREATE OR REPLACE VIEW v_sprint_board AS
 SELECT sc.id AS sprint_id,
    sc.organization_id,
    sc.cycle_id,
    sc.team_id,
    t.name AS team_name,
    sc.name AS sprint_name,
    sc.goal,
    sc.status,
    sc.start_date,
    sc.end_date,
    sc.planned_velocity,
    COALESCE(sc.actual_velocity, 0) AS actual_velocity,
    (COALESCE(( SELECT json_agg(json_build_object('kr_id', kr.id, 'kr_title', kr.title, 'progress', kr.progress, 'status', kr.status, 'metric_unit', kr.metric_unit, 'expected_contribution', sgk.expected_contribution) ORDER BY kr.title)
           FROM sprint_goal_krs sgk
           JOIN key_results kr ON sgk.kr_id = kr.id AND kr.deleted_at IS NULL
          WHERE sgk.sprint_id = sc.id), '[]'::json))::jsonb AS sprint_krs,
    (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'TODO')        AS todo_count,
    (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'IN_PROGRESS') AS in_progress_count,
    (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL AND status = 'DONE')        AS done_count,
    (SELECT COUNT(*)::INT FROM initiatives WHERE sprint_id = sc.id AND deleted_at IS NULL)                            AS total_count,
    (COALESCE(( SELECT json_agg(json_build_object('id', it.id, 'title', it.title, 'status', it.status, 'progress', it.progress, 'is_overdue', it.is_overdue, 'team_name', it.team_name, 'owner_name', it.owner_name, 'due_date', it.due_date, 'total_milestones', it.total_milestones, 'completed_milestones', it.completed_milestones) ORDER BY it.status, it.title)
           FROM v_initiative_timeline it
          WHERE it.sprint_id = sc.id), '[]'::json))::jsonb AS initiatives,
    sc.created_at,
    sc.code AS sprint_code
   FROM sprint_cycles sc
   LEFT JOIN teams t ON sc.team_id = t.id;
