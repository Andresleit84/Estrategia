-- ================================================================
-- Migración 056 — team_id en key_results
-- Permite asignar un equipo/área responsable a cada KR.
-- ================================================================

-- 1. Columna
ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kr_team ON key_results(team_id) WHERE deleted_at IS NULL;

-- 2. v_key_results_with_trend — agrega team_id y team_name
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
  kr.team_id,
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
  t.name                                                            AS team_name,
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
LEFT JOIN teams      t  ON kr.team_id  = t.id
LEFT JOIN trend_calc tc ON tc.kr_id    = kr.id
WHERE kr.deleted_at IS NULL;

-- 3. sp_create_key_result — agrega p_team_id (param 11, OUT al final sin DEFAULT previo)
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
  p_team_id     UUID,
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
    check_in_cadence, team_id, created_by
  ) VALUES (
    p_obj_id, p_owner_id, trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''),
    COALESCE(p_type, 'INCREASE'), COALESCE(p_unit, '%'),
    COALESCE(p_start_val, 0), COALESCE(p_target_val, 100), COALESCE(p_start_val, 0),
    COALESCE(p_cadence, 'BIWEEKLY'), p_team_id,
    p_created_by
  )
  RETURNING id INTO p_kr_id;
END;
$$;

-- 4. fn_update_key_result — agrega p_team_id (param 12)
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
  p_check_in_cadence text    DEFAULT NULL,
  p_team_id          uuid    DEFAULT NULL
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
         team_id           = COALESCE(p_team_id,           team_id),
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
