-- ================================================================
-- Migración 016 — Carry-over de items incompletos entre ciclos
-- Permite arrastrar objetivos + KRs pendientes al siguiente ciclo.
-- ================================================================

-- ----------------------------------------------------------------
-- Columnas: rolled_from_id en objectives y key_results
-- ----------------------------------------------------------------
ALTER TABLE objectives  ADD COLUMN IF NOT EXISTS rolled_from_id UUID REFERENCES objectives(id)  ON DELETE SET NULL;
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS rolled_from_id UUID REFERENCES key_results(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_rolled_from  ON objectives(rolled_from_id)  WHERE rolled_from_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_key_results_rolled_from ON key_results(rolled_from_id) WHERE rolled_from_id IS NOT NULL;

-- ----------------------------------------------------------------
-- VISTA: actualizar v_objectives_with_progress para exponer rolled_from_id
-- DROP necesario porque CREATE OR REPLACE no permite reordenar columnas
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_objectives_with_progress CASCADE;
CREATE VIEW v_objectives_with_progress AS
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
  o.rolled_from_id,
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
  u.name  AS owner_name,
  u.email AS owner_email,
  t.name  AS team_name
FROM objectives o
LEFT JOIN users u ON u.id = o.owner_id
LEFT JOIN teams t ON t.id = o.team_id
WHERE o.deleted_at IS NULL;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: sp_rollover_cycle_items
-- Copia objetivos seleccionados (con sus KRs) al ciclo destino.
-- Resetea progreso a 0 y marca rolled_from_id para trazabilidad.
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_rollover_cycle_items(
  p_from_cycle_id UUID,
  p_to_cycle_id   UUID,
  p_objective_ids UUID[],
  p_user_id       UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  v_obj_id   UUID;
  v_new_obj  UUID;
  v_org_id   UUID;
BEGIN
  SELECT organization_id INTO v_org_id
    FROM cycles WHERE id = p_to_cycle_id AND deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Ciclo destino no encontrado' USING ERRCODE = 'P0002';
  END IF;

  FOREACH v_obj_id IN ARRAY p_objective_ids LOOP
    INSERT INTO objectives (
      organization_id, cycle_id, owner_id, team_id,
      title, description, level, status, progress,
      created_by, rolled_from_id
    )
    SELECT
      organization_id, p_to_cycle_id, owner_id, team_id,
      title, description, level, 'ACTIVE', 0.0,
      p_user_id, id
    FROM objectives
    WHERE id = v_obj_id AND deleted_at IS NULL
    RETURNING id INTO v_new_obj;

    CONTINUE WHEN v_new_obj IS NULL;

    -- Copia KRs activos: resetea current_value al start_value original
    INSERT INTO key_results (
      objective_id, owner_id, title, description, type,
      metric_unit, start_value, target_value, current_value,
      confidence, progress, status, created_by, rolled_from_id
    )
    SELECT
      v_new_obj, owner_id, title, description, type,
      metric_unit, start_value, target_value, start_value,
      0.5, 0.0, 'ON_TRACK', p_user_id, id
    FROM key_results
    WHERE objective_id = v_obj_id
      AND deleted_at IS NULL
      AND status NOT IN ('CANCELLED');
  END LOOP;
END;
$$;
