-- ================================================================
-- Migración 005 — Hito 5: OKRs Tácticos + Estrategia Contextual
-- REGLA: Toda la lógica de negocio reside en la base de datos.
-- ================================================================

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_update_timestamp (alias de fn_set_updated_at)
-- Usada por las tablas nuevas; fn_set_updated_at ya existe en 001.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_audit_log_generic
-- Versión genérica del audit log para tablas nuevas.
-- Reutiliza fn_audit_log de 001; este alias la encapsula.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log_generic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, occurred_at)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(
      CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.id ELSE NULL END,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END
    ),
    TG_OP,
    CASE WHEN TG_OP IN ('DELETE','UPDATE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ================================================================
-- A. TABLA: organizational_problems
-- ================================================================
CREATE TABLE IF NOT EXISTS organizational_problems (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (char_length(title) <= 500),
  description     TEXT,
  category        TEXT        NOT NULL DEFAULT 'OTHER'
                                CHECK (category IN ('PEOPLE','PROCESS','TECHNOLOGY','MARKET','CULTURE','FINANCIAL','OPERATIONAL','OTHER')),
  severity        SMALLINT    NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  frequency       SMALLINT    NOT NULL DEFAULT 3 CHECK (frequency BETWEEN 1 AND 5),
  priority_score  NUMERIC     GENERATED ALWAYS AS (severity * frequency * 1.0) STORED,
  status          TEXT        NOT NULL DEFAULT 'IDENTIFIED'
                                CHECK (status IN ('IDENTIFIED','BEING_ADDRESSED','RESOLVED','DEPRIORITIZED')),
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER trg_problems_updated_at
  BEFORE UPDATE ON organizational_problems
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE OR REPLACE TRIGGER trg_audit_log_problems
  AFTER INSERT OR UPDATE OR DELETE ON organizational_problems
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_generic();

-- ================================================================
-- B. TABLA: strategic_intents
-- ================================================================
CREATE TABLE IF NOT EXISTS strategic_intents (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (char_length(title) <= 500),
  description     TEXT,
  horizon_years   SMALLINT    NOT NULL DEFAULT 3 CHECK (horizon_years BETWEEN 1 AND 10),
  target_year     INTEGER,
  category        TEXT        CHECK (category IN ('GROWTH','EFFICIENCY','CULTURE','INNOVATION','SUSTAINABILITY','OTHER')),
  status          TEXT        NOT NULL DEFAULT 'DRAFT'
                                CHECK (status IN ('DRAFT','ACTIVE','ACHIEVED','CANCELLED')),
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER trg_strategic_intents_updated_at
  BEFORE UPDATE ON strategic_intents
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE OR REPLACE TRIGGER trg_audit_log_strategic_intents
  AFTER INSERT OR UPDATE OR DELETE ON strategic_intents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_generic();

-- ================================================================
-- C. TABLA: problem_intents (M2M)
-- ================================================================
CREATE TABLE IF NOT EXISTS problem_intents (
  problem_id UUID NOT NULL REFERENCES organizational_problems(id) ON DELETE CASCADE,
  intent_id  UUID NOT NULL REFERENCES strategic_intents(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, intent_id)
);

-- ================================================================
-- D. Extender objectives: strategic_intent_id
-- ================================================================
ALTER TABLE objectives
  ADD COLUMN IF NOT EXISTS strategic_intent_id UUID
    REFERENCES strategic_intents(id) ON DELETE SET NULL;

-- ================================================================
-- E. Triggers para nuevas tablas (definidos arriba en A y B)
-- ================================================================
-- trg_problems_updated_at          → ya creado en sección A
-- trg_strategic_intents_updated_at → ya creado en sección B
-- trg_audit_log_problems           → ya creado en sección A
-- trg_audit_log_strategic_intents  → ya creado en sección B

-- ================================================================
-- F1. TRIGGER: fn_validate_tactical_alignment
-- Valida que OKRs TEAM/INDIVIDUAL tengan parent correcto.
-- ERRCODE P0009 ya usado en sp_create_key_result (004).
-- Usamos P0010 para no colisionar.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_validate_tactical_alignment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_level TEXT;
BEGIN
  -- Solo aplica a niveles tácticos
  IF NEW.level NOT IN ('TEAM', 'INDIVIDUAL') THEN
    RETURN NEW;
  END IF;

  -- En UPDATE, solo revalidar si level o parent_objective_id cambiaron
  IF TG_OP = 'UPDATE' THEN
    IF NEW.level = OLD.level AND NEW.parent_objective_id IS NOT DISTINCT FROM OLD.parent_objective_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Debe tener parent
  IF NEW.parent_objective_id IS NULL THEN
    RAISE EXCEPTION 'Los objetivos de nivel % deben tener un objetivo padre.', NEW.level
      USING ERRCODE = 'P0010';
  END IF;

  -- Obtener nivel del padre
  SELECT level INTO v_parent_level
    FROM objectives
   WHERE id = NEW.parent_objective_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El objetivo padre no existe o fue eliminado.'
      USING ERRCODE = 'P0010';
  END IF;

  -- TEAM: padre debe ser COMPANY o AREA
  IF NEW.level = 'TEAM' AND v_parent_level NOT IN ('COMPANY', 'AREA') THEN
    RAISE EXCEPTION 'Un objetivo TEAM debe tener padre de nivel COMPANY o AREA (actual: %).',
      v_parent_level USING ERRCODE = 'P0010';
  END IF;

  -- INDIVIDUAL: padre debe ser AREA, COMPANY o TEAM
  IF NEW.level = 'INDIVIDUAL' AND v_parent_level NOT IN ('COMPANY', 'AREA', 'TEAM') THEN
    RAISE EXCEPTION 'Un objetivo INDIVIDUAL debe tener padre de nivel COMPANY, AREA o TEAM (actual: %).',
      v_parent_level USING ERRCODE = 'P0010';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_tactical_alignment
  BEFORE INSERT OR UPDATE ON objectives
  FOR EACH ROW EXECUTE FUNCTION fn_validate_tactical_alignment();

-- ================================================================
-- F2. VISTA: v_team_objectives
-- ================================================================
CREATE OR REPLACE VIEW v_team_objectives AS
SELECT
  o.*,
  fn_calculate_objective_progress(o.id) AS progress_calc,
  t.name AS team_name_full,
  u.name AS owner_name_full
FROM objectives o
LEFT JOIN teams t ON t.id = o.team_id
LEFT JOIN users u ON u.id = o.owner_id
WHERE o.deleted_at IS NULL
  AND o.level IN ('TEAM', 'INDIVIDUAL');

-- ================================================================
-- F3. VISTA: v_my_objectives
-- Filtrada por el usuario actual via app.current_user_id.
-- org_id y cycle_id se aplican en el WHERE de la query.
-- ================================================================
CREATE OR REPLACE VIEW v_my_objectives AS
SELECT
  o.*,
  t.name AS team_name_full,
  u.name AS owner_name_full
FROM objectives o
LEFT JOIN teams t ON t.id = o.team_id
LEFT JOIN users u ON u.id = o.owner_id
WHERE o.deleted_at IS NULL
  AND (
    o.owner_id = current_setting('app.current_user_id', TRUE)::UUID
    OR o.team_id IN (
      SELECT tm.team_id
        FROM team_members tm
       WHERE tm.user_id = current_setting('app.current_user_id', TRUE)::UUID
    )
  );

-- ================================================================
-- F4. FUNCIÓN: fn_get_alignment_gaps
-- ================================================================
CREATE OR REPLACE FUNCTION fn_get_alignment_gaps(
  p_cycle_id UUID,
  p_org_id   UUID
)
RETURNS TABLE (
  objective_id       UUID,
  objective_title    TEXT,
  level              TEXT,
  progress           NUMERIC,
  tactical_child_count BIGINT,
  alignment_gap      BOOLEAN
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_total        BIGINT;
  v_aligned      BIGINT;
  v_align_index  NUMERIC;
BEGIN
  -- Datos por objetivo estratégico
  RETURN QUERY
  WITH strategic_objs AS (
    SELECT
      o.id,
      o.title,
      o.level,
      fn_calculate_objective_progress(o.id) AS obj_progress
    FROM objectives o
    WHERE o.cycle_id      = p_cycle_id
      AND o.organization_id = p_org_id
      AND o.level         IN ('COMPANY', 'AREA')
      AND o.deleted_at    IS NULL
      AND o.status NOT IN ('CANCELLED')
  ),
  child_counts AS (
    SELECT
      s.id,
      s.title,
      s.level,
      s.obj_progress,
      COUNT(c.id) AS child_count
    FROM strategic_objs s
    LEFT JOIN objectives c
           ON c.parent_objective_id = s.id
          AND c.level IN ('TEAM', 'INDIVIDUAL')
          AND c.deleted_at IS NULL
          AND c.status NOT IN ('CANCELLED')
    GROUP BY s.id, s.title, s.level, s.obj_progress
  )
  SELECT
    cc.id,
    cc.title,
    cc.level,
    cc.obj_progress,
    cc.child_count,
    cc.child_count = 0
  FROM child_counts cc;

  -- Fila resumen: alignment_index como aggregate (objective_id = NULL)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sub.child_count > 0)
  INTO v_total, v_aligned
  FROM (
    SELECT COUNT(c.id) AS child_count
    FROM objectives s
    LEFT JOIN objectives c
           ON c.parent_objective_id = s.id
          AND c.level IN ('TEAM', 'INDIVIDUAL')
          AND c.deleted_at IS NULL
          AND c.status NOT IN ('CANCELLED')
    WHERE s.cycle_id        = p_cycle_id
      AND s.organization_id = p_org_id
      AND s.level           IN ('COMPANY', 'AREA')
      AND s.deleted_at      IS NULL
      AND s.status NOT IN ('CANCELLED')
    GROUP BY s.id
  ) sub;

  v_align_index := CASE WHEN v_total = 0 THEN 100.0
                        ELSE ROUND((v_aligned::NUMERIC / v_total) * 100, 2)
                   END;

  -- Summary row: objective_id NULL, title encodes the index
  RETURN QUERY SELECT
    NULL::UUID,
    ('alignment_index:' || v_align_index::TEXT)::TEXT,
    'SUMMARY'::TEXT,
    v_align_index,
    v_aligned,
    FALSE;
END;
$$;

-- ================================================================
-- F5. VISTA: v_strategic_intents_with_stats
-- ================================================================
CREATE OR REPLACE VIEW v_strategic_intents_with_stats AS
SELECT
  si.*,
  COUNT(DISTINCT pi.problem_id)::INT        AS problem_count,
  COUNT(DISTINCT o.id)::INT                 AS aligned_objectives_count
FROM strategic_intents si
LEFT JOIN problem_intents pi ON pi.intent_id = si.id
LEFT JOIN objectives o
       ON o.strategic_intent_id = si.id
      AND o.deleted_at IS NULL
WHERE si.deleted_at IS NULL
GROUP BY si.id;

-- ================================================================
-- F6. VISTA: v_problems_with_stats
-- ================================================================
CREATE OR REPLACE VIEW v_problems_with_stats AS
SELECT
  op.*,
  COUNT(DISTINCT pi.intent_id)::INT AS intent_count,
  u.name                       AS created_by_name
FROM organizational_problems op
LEFT JOIN problem_intents pi ON pi.problem_id = op.id
LEFT JOIN users u             ON u.id = op.created_by
WHERE op.deleted_at IS NULL
GROUP BY op.id, u.name;

-- ================================================================
-- F7. PROCEDIMIENTO: sp_create_problem
-- ================================================================
CREATE OR REPLACE PROCEDURE sp_create_problem(
  p_org_id      UUID,
  p_title       TEXT,
  p_description TEXT,
  p_category    TEXT,
  p_severity    SMALLINT,
  p_frequency   SMALLINT,
  p_created_by  UUID,
  OUT p_problem_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  IF length(trim(COALESCE(p_title, ''))) < 3 THEN
    RAISE EXCEPTION 'El título del problema debe tener al menos 3 caracteres.'
      USING ERRCODE = 'P0011';
  END IF;

  INSERT INTO organizational_problems (
    organization_id, title, description, category, severity, frequency, created_by
  ) VALUES (
    p_org_id,
    trim(p_title),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_category, '')), ''), 'OTHER'),
    COALESCE(p_severity, 3),
    COALESCE(p_frequency, 3),
    p_created_by
  )
  RETURNING id INTO p_problem_id;
END;
$$;

-- ================================================================
-- F8. PROCEDIMIENTO: sp_update_problem
-- ================================================================
CREATE OR REPLACE PROCEDURE sp_update_problem(
  p_problem_id  UUID,
  p_title       TEXT,
  p_description TEXT,
  p_category    TEXT,
  p_severity    SMALLINT,
  p_frequency   SMALLINT,
  p_status      TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizational_problems
     WHERE id = p_problem_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Problema no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE organizational_problems
     SET title       = COALESCE(NULLIF(trim(p_title), ''), title),
         description = CASE
                         WHEN p_description IS NULL THEN description
                         ELSE NULLIF(trim(p_description), '')
                       END,
         category    = COALESCE(NULLIF(trim(COALESCE(p_category, '')), ''), category),
         severity    = COALESCE(p_severity, severity),
         frequency   = COALESCE(p_frequency, frequency),
         status      = COALESCE(NULLIF(trim(COALESCE(p_status, '')), ''), status),
         updated_at  = NOW()
   WHERE id = p_problem_id AND deleted_at IS NULL;
END;
$$;

-- ================================================================
-- F9. PROCEDIMIENTO: sp_create_strategic_intent
-- ================================================================
CREATE OR REPLACE PROCEDURE sp_create_strategic_intent(
  p_org_id        UUID,
  p_title         TEXT,
  p_description   TEXT,
  p_horizon_years SMALLINT,
  p_target_year   INTEGER,
  p_category      TEXT,
  p_created_by    UUID,
  OUT p_intent_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  IF length(trim(COALESCE(p_title, ''))) < 3 THEN
    RAISE EXCEPTION 'El título de la intención estratégica debe tener al menos 3 caracteres.'
      USING ERRCODE = 'P0012';
  END IF;

  INSERT INTO strategic_intents (
    organization_id, title, description, horizon_years, target_year, category, created_by
  ) VALUES (
    p_org_id,
    trim(p_title),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    COALESCE(p_horizon_years, 3),
    p_target_year,
    NULLIF(trim(COALESCE(p_category, '')), ''),
    p_created_by
  )
  RETURNING id INTO p_intent_id;
END;
$$;

-- ================================================================
-- F10. PROCEDIMIENTO: sp_update_strategic_intent
-- ================================================================
CREATE OR REPLACE PROCEDURE sp_update_strategic_intent(
  p_intent_id     UUID,
  p_title         TEXT,
  p_description   TEXT,
  p_horizon_years SMALLINT,
  p_target_year   INTEGER,
  p_category      TEXT,
  p_status        TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM strategic_intents
     WHERE id = p_intent_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Intención estratégica no encontrada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE strategic_intents
     SET title         = COALESCE(NULLIF(trim(p_title), ''), title),
         description   = CASE
                           WHEN p_description IS NULL THEN description
                           ELSE NULLIF(trim(p_description), '')
                         END,
         horizon_years = COALESCE(p_horizon_years, horizon_years),
         target_year   = CASE
                           WHEN p_target_year IS NULL THEN target_year
                           ELSE p_target_year
                         END,
         category      = CASE
                           WHEN p_category IS NULL THEN category
                           ELSE NULLIF(trim(p_category), '')
                         END,
         status        = COALESCE(NULLIF(trim(COALESCE(p_status, '')), ''), status),
         updated_at    = NOW()
   WHERE id = p_intent_id AND deleted_at IS NULL;
END;
$$;

-- ================================================================
-- G. ÍNDICES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_problems_org
  ON organizational_problems(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_problems_status
  ON organizational_problems(organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_strategic_intents_org
  ON strategic_intents(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_strategic_intent
  ON objectives(strategic_intent_id)
  WHERE strategic_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_team
  ON objectives(team_id, cycle_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_level
  ON objectives(organization_id, cycle_id, level)
  WHERE deleted_at IS NULL;
