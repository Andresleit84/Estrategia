-- Migration 018 — Extend fn_update_key_result to support editing type, unit, start/target values
-- Replaces the 6-param version with a 10-param version (new params default to NULL = no change)

CREATE OR REPLACE FUNCTION fn_update_key_result(
  p_kr_id       uuid,
  p_title       text,
  p_description text,
  p_current_val numeric,
  p_confidence  numeric,
  p_owner_id    uuid,
  p_type        text    DEFAULT NULL,
  p_metric_unit text    DEFAULT NULL,
  p_start_value numeric DEFAULT NULL,
  p_target_value numeric DEFAULT NULL
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

  -- Resolve effective values for directional validation
  v_type   := COALESCE(p_type,         v_type);
  v_start  := COALESCE(p_start_value,  v_start);
  v_target := COALESCE(p_target_value, v_target);

  -- Validate start/target direction when type or values change
  IF p_type IS NOT NULL OR p_start_value IS NOT NULL OR p_target_value IS NOT NULL THEN
    IF v_type = 'INCREASE' AND v_target <= v_start THEN
      RAISE EXCEPTION 'Para tipo INCREASE el objetivo debe ser mayor al valor inicial' USING ERRCODE = 'P0004';
    END IF;
    IF v_type = 'DECREASE' AND v_target >= v_start THEN
      RAISE EXCEPTION 'Para tipo DECREASE el objetivo debe ser menor al valor inicial' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  UPDATE key_results
     SET title        = COALESCE(NULLIF(trim(p_title), ''), title),
         description  = CASE WHEN p_description IS NULL THEN description ELSE NULLIF(trim(p_description), '') END,
         current_value= COALESCE(p_current_val,   current_value),
         confidence   = COALESCE(p_confidence,    confidence),
         owner_id     = COALESCE(p_owner_id,      owner_id),
         type         = COALESCE(p_type,          type),
         metric_unit  = COALESCE(NULLIF(trim(COALESCE(p_metric_unit,'')), ''), metric_unit),
         start_value  = COALESCE(p_start_value,   start_value),
         target_value = COALESCE(p_target_value,  target_value),
         updated_at   = NOW()
   WHERE id = p_kr_id;

  -- Recalculate progress with updated values
  v_new_progress := fn_calculate_kr_progress(p_kr_id);
  UPDATE key_results SET progress = v_new_progress WHERE id = p_kr_id;

  -- Auto-complete if reaches 100%
  UPDATE key_results
     SET status = 'COMPLETED'
   WHERE id = p_kr_id
     AND status NOT IN ('CANCELLED', 'COMPLETED')
     AND fn_calculate_kr_progress(p_kr_id) >= 100;

  -- Propagate to parent objective
  UPDATE objectives
     SET progress   = fn_calculate_objective_progress(v_obj_id),
         updated_at = NOW()
   WHERE id = v_obj_id;
END;
$$;
