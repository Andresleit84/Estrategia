-- Migration 053 — check_in_cadence en key_results
-- Añade cadencia de actualización por KR. Actualiza SP, función y vistas.

-- ----------------------------------------------------------------
-- 1. Nueva columna en key_results
-- ----------------------------------------------------------------
ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS check_in_cadence TEXT NOT NULL DEFAULT 'BIWEEKLY'
    CHECK (check_in_cadence IN ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY'));

-- ----------------------------------------------------------------
-- 2. Función helper: cadencia → días
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cadence_days(p_cadence TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_cadence
    WHEN 'WEEKLY'    THEN 7
    WHEN 'BIWEEKLY'  THEN 14
    WHEN 'MONTHLY'   THEN 30
    WHEN 'QUARTERLY' THEN 90
    ELSE 14
  END;
$$;

-- ----------------------------------------------------------------
-- 3. sp_create_key_result — agrega p_cadence (sin DEFAULT, siempre explícito)
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
  p_cadence     TEXT,
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
    check_in_cadence, created_by
  ) VALUES (
    p_obj_id, p_owner_id, trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''),
    COALESCE(p_type, 'INCREASE'), COALESCE(p_unit, '%'),
    COALESCE(p_start_val, 0), COALESCE(p_target_val, 100), COALESCE(p_start_val, 0),
    COALESCE(p_cadence, 'BIWEEKLY'),
    p_created_by
  )
  RETURNING id INTO p_kr_id;
END;
$$;

-- ----------------------------------------------------------------
-- 4. fn_update_key_result — agrega p_check_in_cadence (param 11)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_key_result(
  p_kr_id            uuid,
  p_title            text,
  p_description      text,
  p_current_val      numeric,
  p_confidence       numeric,
  p_owner_id         uuid,
  p_type             text    DEFAULT NULL,
  p_metric_unit      text    DEFAULT NULL,
  p_start_value      numeric DEFAULT NULL,
  p_target_value     numeric DEFAULT NULL,
  p_check_in_cadence text    DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_status       TEXT;
  v_new_progress NUMERIC;
  v_obj_id       UUID;
  v_type         TEXT;
  v_start        NUMERIC;
  v_target       NUMERIC;
BEGIN
  SELECT status, objective_id, type, start_value, target_value
    INTO v_status, v_obj_id, v_type, v_start, v_target
    FROM key_results WHERE id = p_kr_id AND deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Resultado clave no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'No se puede editar un resultado clave en estado %', v_status USING ERRCODE = 'P0003';
  END IF;

  v_type   := COALESCE(p_type,         v_type);
  v_start  := COALESCE(p_start_value,  v_start);
  v_target := COALESCE(p_target_value, v_target);

  IF p_type IS NOT NULL OR p_start_value IS NOT NULL OR p_target_value IS NOT NULL THEN
    IF v_type = 'INCREASE' AND v_target <= v_start THEN
      RAISE EXCEPTION 'Para tipo INCREASE el objetivo debe ser mayor al valor inicial' USING ERRCODE = 'P0004';
    END IF;
    IF v_type = 'DECREASE' AND v_target >= v_start THEN
      RAISE EXCEPTION 'Para tipo DECREASE el objetivo debe ser menor al valor inicial' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  UPDATE key_results
     SET title             = COALESCE(NULLIF(trim(p_title), ''), title),
         description       = CASE WHEN p_description IS NULL THEN description
                                  ELSE NULLIF(trim(p_description), '') END,
         current_value     = COALESCE(p_current_val,       current_value),
         confidence        = COALESCE(p_confidence,        confidence),
         owner_id          = COALESCE(p_owner_id,          owner_id),
         type              = COALESCE(p_type,              type),
         metric_unit       = COALESCE(NULLIF(trim(COALESCE(p_metric_unit,'')), ''), metric_unit),
         start_value       = COALESCE(p_start_value,       start_value),
         target_value      = COALESCE(p_target_value,      target_value),
         check_in_cadence  = COALESCE(p_check_in_cadence,  check_in_cadence),
         updated_at        = NOW()
   WHERE id = p_kr_id;

  v_new_progress := fn_calculate_kr_progress(p_kr_id);
  UPDATE key_results SET progress = v_new_progress WHERE id = p_kr_id;

  UPDATE key_results
     SET status = 'COMPLETED'
   WHERE id = p_kr_id
     AND status NOT IN ('CANCELLED', 'COMPLETED')
     AND fn_calculate_kr_progress(p_kr_id) >= 100;

  UPDATE objectives
     SET progress   = fn_calculate_objective_progress(v_obj_id),
         updated_at = NOW()
   WHERE id = v_obj_id;
END;
$$;

-- ----------------------------------------------------------------
-- 5. sp_mark_stale_krs_at_risk — usa cadencia por KR
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_mark_stale_krs_at_risk(p_org_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE key_results kr
  SET status = 'AT_RISK'
  FROM objectives o
  WHERE kr.objective_id   = o.id
    AND o.organization_id = p_org_id
    AND kr.deleted_at IS NULL
    AND o.deleted_at  IS NULL
    AND o.status      = 'ACTIVE'
    AND kr.status     = 'ON_TRACK'
    AND (
      kr.last_checkin_at IS NULL
      OR kr.last_checkin_at < NOW() - (fn_cadence_days(kr.check_in_cadence) || ' days')::INTERVAL
    );

  INSERT INTO notifications(organization_id, user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT
    o.organization_id,
    kr.owner_id,
    'STALE_KR',
    'KR sin check-in: ' || LEFT(kr.title, 60),
    'Llevas más de ' || fn_cadence_days(kr.check_in_cadence) || ' días sin registrar progreso.',
    'key_result',
    kr.id
  FROM key_results kr
  JOIN objectives o ON kr.objective_id = o.id
  WHERE o.organization_id = p_org_id
    AND kr.status = 'AT_RISK'
    AND kr.deleted_at IS NULL
    AND o.status = 'ACTIVE'
    AND (
      kr.last_checkin_at IS NULL
      OR kr.last_checkin_at < NOW() - (fn_cadence_days(kr.check_in_cadence) || ' days')::INTERVAL
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.entity_id = kr.id
        AND n.type = 'STALE_KR'
        AND n.created_at > NOW() - INTERVAL '7 days'
    );
END;
$$;

-- ----------------------------------------------------------------
-- 6. v_key_results_with_trend — agrega check_in_cadence y cadence_days
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_key_results_with_trend CASCADE;

CREATE VIEW v_key_results_with_trend AS
WITH trend_calc AS (
  SELECT
    ci.kr_id,
    MAX(CASE WHEN ci.rn = 1 THEN ci.current_value END) AS latest,
    MAX(CASE WHEN ci.rn = 2 THEN ci.current_value END) AS prev,
    COUNT(*) AS total_checkins
  FROM (
    SELECT kr_id, current_value,
           ROW_NUMBER() OVER (PARTITION BY kr_id ORDER BY checked_at DESC) AS rn
    FROM check_ins
  ) ci
  WHERE ci.rn <= 3
  GROUP BY ci.kr_id
)
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
  kr.progress,
  kr.status,
  kr.last_checkin_at,
  kr.created_by,
  kr.created_at,
  kr.updated_at,
  kr.deleted_at,
  kr.completed_at,
  kr.code,
  kr.check_in_cadence,
  fn_cadence_days(kr.check_in_cadence)                              AS cadence_days,
  u.name                                                            AS owner_name,
  u.email                                                           AS owner_email,
  COALESCE(
    CASE
      WHEN tc.total_checkins < 2 THEN 'flat'
      WHEN tc.latest > tc.prev   THEN 'up'
      WHEN tc.latest < tc.prev   THEN 'down'
      ELSE 'flat'
    END, 'flat'
  )::TEXT                                                           AS trend,
  COALESCE(tc.total_checkins, 0)::INT                              AS checkin_count
FROM key_results kr
LEFT JOIN users      u  ON kr.owner_id = u.id
LEFT JOIN trend_calc tc ON tc.kr_id    = kr.id
WHERE kr.deleted_at IS NULL;

-- ----------------------------------------------------------------
-- 7. v_cadence_dashboard — agrega cadence_days y cadence_status
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_cadence_dashboard CASCADE;
CREATE VIEW v_cadence_dashboard AS
SELECT
  kr.id                                                                       AS kr_id,
  kr.title                                                                    AS kr_title,
  kr.metric_unit,
  kr.progress,
  kr.confidence,
  kr.status,
  kr.last_checkin_at,
  kr.check_in_cadence,
  fn_cadence_days(kr.check_in_cadence)                                        AS cadence_days,
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INT, 999)           AS days_since_checkin,
  CASE
    WHEN kr.last_checkin_at IS NULL
      OR EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INT
           >= fn_cadence_days(kr.check_in_cadence)                            THEN 'overdue'
    WHEN EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INT
           >= fn_cadence_days(kr.check_in_cadence) * 0.75                    THEN 'due_soon'
    ELSE 'ok'
  END                                                                         AS cadence_status,
  kr.owner_id,
  u.name                                                                      AS owner_name,
  u.email                                                                     AS owner_email,
  o.id                                                                        AS objective_id,
  o.title                                                                     AS objective_title,
  o.level                                                                     AS objective_level,
  o.organization_id,
  o.cycle_id,
  o.team_id,
  t.name                                                                      AS team_name
FROM key_results kr
JOIN objectives o  ON kr.objective_id = o.id
LEFT JOIN users u  ON kr.owner_id     = u.id
LEFT JOIN teams t  ON o.team_id       = t.id
WHERE kr.deleted_at IS NULL
  AND o.deleted_at  IS NULL
  AND kr.status NOT IN ('CANCELLED')
ORDER BY days_since_checkin DESC, o.level, kr.progress ASC;

-- ----------------------------------------------------------------
-- 8. v_at_risk_krs — usa cadencia por KR para la condición de stale
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_at_risk_krs CASCADE;
CREATE VIEW v_at_risk_krs AS
SELECT
  kr.id,
  kr.title              AS kr_title,
  kr.metric_unit,
  kr.current_value,
  kr.target_value,
  kr.progress,
  kr.confidence,
  kr.status,
  kr.last_checkin_at,
  kr.check_in_cadence,
  fn_cadence_days(kr.check_in_cadence)                                AS cadence_days,
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INT, 999)   AS days_since_checkin,
  kr.owner_id,
  u.name                AS owner_name,
  o.id                  AS objective_id,
  o.title               AS objective_title,
  o.level               AS objective_level,
  o.organization_id,
  c.id                  AS cycle_id
FROM key_results kr
JOIN objectives o ON kr.objective_id = o.id
JOIN cycles     c ON o.cycle_id      = c.id
LEFT JOIN users u ON kr.owner_id     = u.id
WHERE kr.deleted_at IS NULL
  AND o.deleted_at  IS NULL
  AND c.status      = 'ACTIVE'
  AND kr.status NOT IN ('COMPLETED','CANCELLED')
  AND (
    (kr.last_checkin_at IS NULL AND kr.created_at < NOW() - INTERVAL '7 days')
    OR kr.last_checkin_at < NOW()
         - (fn_cadence_days(kr.check_in_cadence) || ' days')::INTERVAL
    OR kr.confidence < 0.4
    OR kr.status IN ('AT_RISK','BEHIND')
  )
ORDER BY
  CASE o.level WHEN 'COMPANY' THEN 1 WHEN 'AREA' THEN 2 WHEN 'TEAM' THEN 3 ELSE 4 END,
  kr.confidence ASC,
  days_since_checkin DESC;
