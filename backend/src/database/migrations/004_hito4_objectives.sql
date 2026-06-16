-- ================================================================
-- Migración 004 — Hito 4: OKRs estratégicos
-- REGLA: Toda la lógica de negocio reside en la base de datos.
-- ================================================================

-- ----------------------------------------------------------------
-- TABLA: objectives
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS objectives (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id             UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  parent_objective_id  UUID REFERENCES objectives(id) ON DELETE SET NULL,
  owner_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id              UUID REFERENCES teams(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  level                TEXT NOT NULL DEFAULT 'COMPANY'
                         CHECK (level IN ('COMPANY', 'AREA', 'TEAM', 'INDIVIDUAL')),
  status               TEXT NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  progress             NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  created_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER trg_objectives_updated_at
  BEFORE UPDATE ON objectives
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_audit_log_objectives
  AFTER INSERT OR UPDATE OR DELETE ON objectives
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ----------------------------------------------------------------
-- TABLA: key_results
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS key_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id    UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'INCREASE'
                    CHECK (type IN ('INCREASE', 'DECREASE', 'MAINTAIN', 'ACHIEVE')),
  metric_unit     TEXT NOT NULL DEFAULT '%',
  start_value     NUMERIC(15,4) NOT NULL DEFAULT 0,
  target_value    NUMERIC(15,4) NOT NULL DEFAULT 100,
  current_value   NUMERIC(15,4) NOT NULL DEFAULT 0,
  confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.5
                    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  progress        NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  status          TEXT NOT NULL DEFAULT 'ON_TRACK'
                    CHECK (status IN ('ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED', 'CANCELLED')),
  last_checkin_at TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER trg_key_results_updated_at
  BEFORE UPDATE ON key_results
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_audit_log_key_results
  AFTER INSERT OR UPDATE OR DELETE ON key_results
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ----------------------------------------------------------------
-- TRIGGER: máx 5 objetivos por nivel/ciclo/org (BEFORE INSERT)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_objective_limits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM objectives
   WHERE organization_id = NEW.organization_id
     AND cycle_id        = NEW.cycle_id
     AND level           = NEW.level
     AND deleted_at IS NULL
     AND status NOT IN ('CANCELLED');

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Se alcanzó el límite de 5 objetivos por nivel (%) en este ciclo.', NEW.level
      USING ERRCODE = 'P0006';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_objective_limits
  BEFORE INSERT ON objectives
  FOR EACH ROW EXECUTE FUNCTION fn_validate_objective_limits();

-- ----------------------------------------------------------------
-- TRIGGER: máx 5 KRs activos por objetivo (BEFORE INSERT)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_kr_limits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM key_results
   WHERE objective_id = NEW.objective_id
     AND deleted_at IS NULL
     AND status NOT IN ('CANCELLED');

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Se alcanzó el límite de 5 resultados clave por objetivo.'
      USING ERRCODE = 'P0007';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_kr_limits
  BEFORE INSERT ON key_results
  FOR EACH ROW EXECUTE FUNCTION fn_validate_kr_limits();

-- ----------------------------------------------------------------
-- FUNCIÓN: calcula el progreso de un KR según su tipo
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calculate_kr_progress(p_kr_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_type    TEXT;
  v_start   NUMERIC;
  v_target  NUMERIC;
  v_current NUMERIC;
  v_raw     NUMERIC;
BEGIN
  SELECT type, start_value, target_value, current_value
    INTO v_type, v_start, v_target, v_current
    FROM key_results
   WHERE id = p_kr_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN 0.0; END IF;

  CASE v_type
    WHEN 'INCREASE' THEN
      IF v_target = v_start THEN RETURN 100.0; END IF;
      v_raw := (v_current - v_start) / (v_target - v_start) * 100;
    WHEN 'DECREASE' THEN
      IF v_start = v_target THEN RETURN 100.0; END IF;
      v_raw := (v_start - v_current) / (v_start - v_target) * 100;
    WHEN 'MAINTAIN' THEN
      -- Dentro del 5% del target = 100%, fuera = penaliza progresivamente
      IF v_target = 0 THEN RETURN 100.0; END IF;
      v_raw := 100.0 - (ABS(v_current - v_target) / ABS(v_target) * 100.0);
    WHEN 'ACHIEVE' THEN
      v_raw := CASE WHEN v_current >= v_target THEN 100.0 ELSE 0.0 END;
    ELSE
      v_raw := 0.0;
  END CASE;

  RETURN GREATEST(0.0, LEAST(100.0, COALESCE(v_raw, 0.0)));
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: calcula el progreso de un Objetivo (promedio KRs activos)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calculate_objective_progress(p_obj_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT AVG(fn_calculate_kr_progress(kr.id))
    INTO v_avg
    FROM key_results kr
   WHERE kr.objective_id = p_obj_id
     AND kr.deleted_at IS NULL
     AND kr.status NOT IN ('CANCELLED');

  RETURN ROUND(COALESCE(v_avg, 0.0), 2);
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: evalúa la calidad de un OKR (score 0-10 + issues)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_okr_quality(
  p_title       TEXT,
  p_description TEXT,
  p_type        TEXT,
  p_target      NUMERIC,
  p_unit        TEXT
)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_score   INT := 0;
  v_issues  TEXT[] := '{}';
  v_lower   TEXT;
BEGIN
  v_lower := LOWER(COALESCE(p_title, ''));

  -- Título: longitud mínima (mín 15 caracteres)
  IF length(COALESCE(p_title, '')) >= 15 THEN
    v_score := v_score + 2;
  ELSIF length(COALESCE(p_title, '')) >= 8 THEN
    v_score := v_score + 1;
    v_issues := array_append(v_issues, 'El título es demasiado corto. Sé más específico sobre qué se quiere lograr.');
  ELSE
    v_issues := array_append(v_issues, 'El título es demasiado corto. Un buen objetivo describe claramente el resultado esperado.');
  END IF;

  -- Título: sin palabras vagas
  IF v_lower ~ '(mejorar|incrementar|reducir|optimizar|hacer|ser|estar)$' THEN
    v_issues := array_append(v_issues, 'El título termina en verbo genérico. Define el estado final concreto que quieres alcanzar.');
  ELSIF NOT (v_lower ~ '(mejorar|optimizar|ser el mejor|hacer mejor|buenas prácticas|eficiencia general)') THEN
    v_score := v_score + 2;
  ELSE
    v_score := v_score + 1;
    v_issues := array_append(v_issues, 'El título contiene lenguaje vago. Define el resultado final de forma medible y específica.');
  END IF;

  -- Descripción presente
  IF length(COALESCE(p_description, '')) >= 20 THEN
    v_score := v_score + 1;
  ELSE
    v_issues := array_append(v_issues, 'Agrega una descripción que explique el contexto y la importancia estratégica de este objetivo.');
  END IF;

  -- Target value significativo
  IF p_target IS NOT NULL AND p_target <> 0 THEN
    v_score := v_score + 2;
  ELSE
    v_issues := array_append(v_issues, 'Define un valor objetivo concreto y ambicioso. Evita usar 0 como meta.');
  END IF;

  -- Unidad específica
  IF length(COALESCE(p_unit, '')) >= 1 AND COALESCE(p_unit, '') <> '' THEN
    v_score := v_score + 2;
  ELSE
    v_issues := array_append(v_issues, 'Especifica la unidad de medida (%, $, unidades, puntos NPS, etc.).');
  END IF;

  -- Tipo de KR apropiado
  IF p_type IN ('INCREASE', 'DECREASE', 'MAINTAIN', 'ACHIEVE') THEN
    v_score := v_score + 1;
  ELSE
    v_issues := array_append(v_issues, 'Selecciona el tipo de resultado clave adecuado para esta métrica.');
  END IF;

  RETURN jsonb_build_object(
    'score',   LEAST(v_score, 10),
    'max',     10,
    'issues',  to_jsonb(v_issues),
    'quality', CASE
                 WHEN v_score >= 8 THEN 'excellent'
                 WHEN v_score >= 6 THEN 'good'
                 WHEN v_score >= 4 THEN 'fair'
                 ELSE 'poor'
               END
  );
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: score real del ciclo (promedio ponderado objetivos COMPANY)
-- Reemplaza el stub de Hito 3
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_cycle_score(p_cycle_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT AVG(fn_calculate_objective_progress(o.id))
    INTO v_avg
    FROM objectives o
   WHERE o.cycle_id = p_cycle_id
     AND o.level    = 'COMPANY'
     AND o.deleted_at IS NULL
     AND o.status NOT IN ('CANCELLED');

  RETURN ROUND(COALESCE(v_avg, 0.0), 2);
END;
$$;

-- ----------------------------------------------------------------
-- VISTA: objetivos con progreso calculado
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_objectives_with_progress AS
SELECT
  o.id,
  o.organization_id,
  o.cycle_id,
  o.parent_objective_id,
  o.owner_id,
  o.team_id,
  NULL::uuid                              AS strategic_intent_id,
  o.title,
  o.description,
  o.level,
  o.status,
  o.created_by,
  o.created_at,
  o.updated_at,
  fn_calculate_objective_progress(o.id)  AS progress,
  (
    SELECT COUNT(*)::INT FROM key_results kr
     WHERE kr.objective_id = o.id
       AND kr.deleted_at IS NULL
       AND kr.status NOT IN ('CANCELLED')
  )                                       AS kr_count,
  -- owner info
  u.name  AS owner_name,
  u.email AS owner_email,
  -- team info
  t.name  AS team_name
FROM objectives o
LEFT JOIN users u ON u.id = o.owner_id
LEFT JOIN teams t ON t.id = o.team_id
WHERE o.deleted_at IS NULL;

-- ----------------------------------------------------------------
-- VISTA: KRs con tendencia (stub de tendencia; real en Hito 6 con check-ins)
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_key_results_with_trend AS
SELECT
  kr.id,
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
  kr.status,
  kr.last_checkin_at,
  kr.created_at,
  kr.updated_at,
  fn_calculate_kr_progress(kr.id)  AS progress,
  'flat'::TEXT                     AS trend,  -- Hito 6: calculado con últimos 3 check-ins
  u.name  AS owner_name,
  u.email AS owner_email
FROM key_results kr
LEFT JOIN users u ON u.id = kr.owner_id
WHERE kr.deleted_at IS NULL;

-- ----------------------------------------------------------------
-- VISTA: mapa de alineación COMPANY → AREA
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_alignment_map AS
WITH company_objs AS (
  SELECT
    o.id,
    o.organization_id,
    o.cycle_id,
    o.title,
    o.level,
    o.status,
    o.owner_id,
    u.name AS owner_name,
    fn_calculate_objective_progress(o.id) AS progress
  FROM objectives o
  LEFT JOIN users u ON u.id = o.owner_id
  WHERE o.deleted_at IS NULL
    AND o.level = 'COMPANY'
    AND o.status NOT IN ('CANCELLED')
),
area_objs AS (
  SELECT
    o.id,
    o.parent_objective_id,
    o.organization_id,
    o.cycle_id,
    o.title,
    o.level,
    o.status,
    o.owner_id,
    u.name AS owner_name,
    fn_calculate_objective_progress(o.id) AS progress
  FROM objectives o
  LEFT JOIN users u ON u.id = o.owner_id
  WHERE o.deleted_at IS NULL
    AND o.level = 'AREA'
    AND o.status NOT IN ('CANCELLED')
)
SELECT
  c.id                   AS company_obj_id,
  c.organization_id,
  c.cycle_id,
  c.title                AS company_title,
  c.progress             AS company_progress,
  c.status               AS company_status,
  c.owner_name           AS company_owner,
  jsonb_agg(
    CASE WHEN a.id IS NOT NULL THEN jsonb_build_object(
      'id',       a.id,
      'title',    a.title,
      'progress', a.progress,
      'status',   a.status,
      'owner',    a.owner_name
    ) END
  ) FILTER (WHERE a.id IS NOT NULL) AS area_objectives
FROM company_objs c
LEFT JOIN area_objs a ON a.parent_objective_id = c.id
  AND a.organization_id = c.organization_id
  AND a.cycle_id = c.cycle_id
GROUP BY c.id, c.organization_id, c.cycle_id, c.title, c.progress, c.status, c.owner_name;

-- ----------------------------------------------------------------
-- VISTA: ciclos con estadísticas — ACTUALIZADA con datos reales
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_cycles_with_stats AS
SELECT
  c.id,
  c.organization_id,
  c.name,
  c.description,
  c.type,
  c.status,
  c.start_date,
  c.end_date,
  c.closed_at,
  c.snapshot,
  c.created_by,
  c.created_at,
  c.updated_at,
  (
    SELECT COUNT(*)::INT FROM objectives o
     WHERE o.cycle_id = c.id
       AND o.deleted_at IS NULL
       AND o.status NOT IN ('CANCELLED')
  )                                         AS objectives_count,
  (
    SELECT COALESCE(AVG(fn_calculate_objective_progress(o.id)), 0.0)
      FROM objectives o
     WHERE o.cycle_id = c.id
       AND o.deleted_at IS NULL
       AND o.status NOT IN ('CANCELLED')
  )                                         AS avg_progress,
  fn_get_cycle_score(c.id)                 AS score,
  GREATEST(
    EXTRACT(DAY FROM (c.end_date::TIMESTAMPTZ - NOW()))::INT,
    0
  )                                         AS days_remaining,
  CASE
    WHEN c.status = 'CLOSED'                           THEN 'CLOSED'
    WHEN c.status = 'ACTIVE' AND c.end_date < CURRENT_DATE THEN 'OVERDUE'
    WHEN c.status = 'ACTIVE'                           THEN 'ACTIVE'
    ELSE 'DRAFT'
  END                                       AS display_status
FROM cycles c
WHERE c.deleted_at IS NULL;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: cerrar ciclo — actualizado con cascade a OKRs
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_close_cycle(
  p_cycle_id UUID,
  p_user_id  UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  v_status   TEXT;
  v_score    NUMERIC;
  v_snapshot JSONB;
BEGIN
  SELECT status INTO v_status FROM cycles WHERE id = p_cycle_id AND deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ciclo no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Solo se puede cerrar un ciclo ACTIVE' USING ERRCODE = 'P0003';
  END IF;

  -- Calcular score final ANTES de cerrar
  v_score := fn_get_cycle_score(p_cycle_id);

  -- Cerrar objetivos ACTIVE del ciclo (COMPLETED solo si progreso >= 70)
  UPDATE objectives
     SET status     = CASE
                        WHEN fn_calculate_objective_progress(id) >= 70 THEN 'COMPLETED'
                        ELSE 'CANCELLED'
                      END,
         updated_at = NOW()
   WHERE cycle_id   = p_cycle_id
     AND status     IN ('DRAFT', 'ACTIVE')
     AND deleted_at IS NULL;

  -- Cerrar KRs de esos objetivos
  UPDATE key_results
     SET status     = CASE
                        WHEN fn_calculate_kr_progress(id) >= 70 THEN 'COMPLETED'
                        ELSE 'CANCELLED'
                      END,
         updated_at = NOW()
   WHERE objective_id IN (
     SELECT id FROM objectives WHERE cycle_id = p_cycle_id AND deleted_at IS NULL
   )
   AND status NOT IN ('COMPLETED', 'CANCELLED')
   AND deleted_at IS NULL;

  v_snapshot := jsonb_build_object(
    'closed_at',        NOW(),
    'closed_by',        p_user_id,
    'score',            v_score,
    'objectives_count', (
      SELECT COUNT(*) FROM objectives
       WHERE cycle_id = p_cycle_id AND deleted_at IS NULL
    )
  );

  UPDATE cycles
     SET status     = 'CLOSED',
         closed_at  = NOW(),
         snapshot   = v_snapshot,
         updated_at = NOW()
   WHERE id = p_cycle_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: crear objetivo
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_create_objective(
  p_org_id     UUID,
  p_cycle_id   UUID,
  p_parent_id  UUID,
  p_owner_id   UUID,
  p_team_id    UUID,
  p_level      TEXT,
  p_title      TEXT,
  p_description TEXT,
  p_created_by UUID,
  OUT p_objective_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  IF length(trim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'El título del objetivo no puede estar vacío' USING ERRCODE = 'P0008';
  END IF;

  INSERT INTO objectives (
    organization_id, cycle_id, parent_objective_id, owner_id, team_id,
    level, title, description, created_by
  ) VALUES (
    p_org_id, p_cycle_id, p_parent_id, p_owner_id, p_team_id,
    COALESCE(p_level, 'COMPANY'), trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''), p_created_by
  )
  RETURNING id INTO p_objective_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: crear key result
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_create_key_result(
  p_obj_id      UUID,
  p_owner_id    UUID,
  p_title       TEXT,
  p_type        TEXT,
  p_unit        TEXT,
  p_start_val   NUMERIC,
  p_target_val  NUMERIC,
  p_description TEXT,
  p_created_by  UUID,
  OUT p_kr_id   UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  IF length(trim(COALESCE(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'El título del resultado clave no puede estar vacío' USING ERRCODE = 'P0009';
  END IF;

  INSERT INTO key_results (
    objective_id, owner_id, title, description,
    type, metric_unit, start_value, target_value, current_value,
    created_by
  ) VALUES (
    p_obj_id, p_owner_id, trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''),
    COALESCE(p_type, 'INCREASE'), COALESCE(p_unit, '%'),
    COALESCE(p_start_val, 0), COALESCE(p_target_val, 100), COALESCE(p_start_val, 0),
    p_created_by
  )
  RETURNING id INTO p_kr_id;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: actualizar objetivo (solo DRAFT/ACTIVE)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_objective(
  p_obj_id      UUID,
  p_title       TEXT,
  p_description TEXT,
  p_owner_id    UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM objectives WHERE id = p_obj_id AND deleted_at IS NULL;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Objetivo no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'No se puede editar un objetivo % ', v_status USING ERRCODE = 'P0003';
  END IF;

  UPDATE objectives
     SET title       = COALESCE(NULLIF(trim(p_title), ''), title),
         description = CASE
                         WHEN p_description IS NULL THEN description
                         ELSE NULLIF(trim(p_description), '')
                       END,
         owner_id    = COALESCE(p_owner_id, owner_id),
         updated_at  = NOW()
   WHERE id = p_obj_id;
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: actualizar key result
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_key_result(
  p_kr_id       UUID,
  p_title       TEXT,
  p_description TEXT,
  p_current_val NUMERIC,
  p_confidence  NUMERIC,
  p_owner_id    UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_status       TEXT;
  v_new_progress NUMERIC;
  v_obj_id       UUID;
BEGIN
  SELECT status, objective_id INTO v_status, v_obj_id
    FROM key_results WHERE id = p_kr_id AND deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Resultado clave no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'No se puede editar un resultado clave en estado %', v_status USING ERRCODE = 'P0003';
  END IF;

  UPDATE key_results
     SET title         = COALESCE(NULLIF(trim(p_title), ''), title),
         description   = CASE
                           WHEN p_description IS NULL THEN description
                           ELSE NULLIF(trim(p_description), '')
                         END,
         current_value = COALESCE(p_current_val, current_value),
         confidence    = COALESCE(p_confidence, confidence),
         owner_id      = COALESCE(p_owner_id, owner_id),
         updated_at    = NOW()
   WHERE id = p_kr_id;

  -- Recalcular progreso y actualizar
  v_new_progress := fn_calculate_kr_progress(p_kr_id);
  UPDATE key_results SET progress = v_new_progress WHERE id = p_kr_id;

  -- Auto-complete si alcanza 100%
  UPDATE key_results
     SET status = 'COMPLETED'
   WHERE id = p_kr_id
     AND status NOT IN ('CANCELLED', 'COMPLETED')
     AND fn_calculate_kr_progress(p_kr_id) >= 100;

  -- Propagar progreso al objetivo padre
  UPDATE objectives
     SET progress   = fn_calculate_objective_progress(v_obj_id),
         updated_at = NOW()
   WHERE id = v_obj_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: cancelar objetivo
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_cancel_objective(
  p_obj_id  UUID,
  p_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE objectives SET status = 'CANCELLED', updated_at = NOW()
   WHERE id = p_obj_id AND deleted_at IS NULL AND status NOT IN ('CANCELLED');

  UPDATE key_results SET status = 'CANCELLED', updated_at = NOW()
   WHERE objective_id = p_obj_id
     AND deleted_at IS NULL
     AND status NOT IN ('CANCELLED', 'COMPLETED');
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: cancelar key result
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_cancel_key_result(
  p_kr_id   UUID,
  p_user_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE key_results SET status = 'CANCELLED', updated_at = NOW()
   WHERE id = p_kr_id AND deleted_at IS NULL;
END;
$$;

-- ----------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_objectives_cycle_org   ON objectives(cycle_id, organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_objectives_parent      ON objectives(parent_objective_id) WHERE parent_objective_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_objectives_level_cycle ON objectives(organization_id, cycle_id, level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_key_results_objective  ON key_results(objective_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_key_results_status     ON key_results(objective_id, status) WHERE deleted_at IS NULL;
