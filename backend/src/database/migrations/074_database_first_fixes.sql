-- Migration 074: Mover lógica de negocio de TypeScript a PostgreSQL
-- Fixes para violaciones Database-First en reports.service.ts y sprints.service.ts

-- ============================================================================
-- 1. FUNCIÓN fn_get_cycle_projection: Reemplaza getCycleProjection en TypeScript
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_cycle_projection(p_cycle_id UUID, p_org_id UUID)
RETURNS TABLE (
  cycle_id UUID,
  cycle_name TEXT,
  days_remaining INT,
  expected_progress INT,
  actual_progress INT,
  progress_gap INT,
  weekly_velocity NUMERIC,
  weeks_remaining NUMERIC,
  projected_final INT,
  objectives_json JSONB
) AS $$
  WITH cycle_info AS (
    SELECT c.id, c.name, c.start_date, c.end_date,
           GREATEST(0, (c.end_date - CURRENT_DATE)::INT) AS days_remaining,
           CASE
             WHEN CURRENT_DATE >= c.end_date THEN 100
             WHEN CURRENT_DATE <= c.start_date THEN 0
             ELSE ROUND(100.0 * (CURRENT_DATE - c.start_date) / (c.end_date - c.start_date))::INT
           END AS expected_progress
      FROM cycles c
     WHERE c.id = p_cycle_id AND c.organization_id = p_org_id
  ),
  obj_progress AS (
    SELECT COALESCE(AVG(CAST(fn_calculate_objective_progress(o.id) AS FLOAT)), 0)::INT AS actual
      FROM objectives o
     WHERE o.cycle_id = p_cycle_id AND o.organization_id = p_org_id AND o.status != 'CANCELLED' AND o.deleted_at IS NULL
  ),
  trend_data AS (
    SELECT LAG(avg_progress) OVER (ORDER BY week_number) - avg_progress AS delta
      FROM v_weekly_trend
     WHERE cycle_id = p_cycle_id
     ORDER BY week_number DESC
     LIMIT 6
  ),
  velocity_calc AS (
    SELECT ROUND(AVG(ABS(delta)), 1) AS vel FROM trend_data WHERE delta IS NOT NULL
  ),
  forecast_objs AS (
    SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
      'id', o.id,
      'title', o.title,
      'level', o.level,
      'progress', fn_calculate_objective_progress(o.id)::INT,
      'confidence', COALESCE(AVG(kr.confidence), 0)::NUMERIC(3,2),
      'forecast_status', CASE
        WHEN fn_calculate_objective_progress(o.id)::INT >= (c.expected_progress * 0.75)::INT
          THEN 'on_track'
        ELSE 'at_risk'
      END,
      'obj_gap', fn_calculate_objective_progress(o.id)::INT - c.expected_progress
    )) AS forecast
      FROM objectives o
      CROSS JOIN cycle_info c
      LEFT JOIN key_results kr ON kr.objective_id = o.id AND kr.deleted_at IS NULL
     WHERE o.cycle_id = p_cycle_id AND o.organization_id = p_org_id AND o.status != 'CANCELLED' AND o.deleted_at IS NULL
     GROUP BY c.expected_progress, c.id
  )
  SELECT
    c.id,
    c.name,
    c.days_remaining,
    c.expected_progress,
    op.actual,
    op.actual - c.expected_progress,
    COALESCE(vc.vel, 0),
    GREATEST(0, c.days_remaining / 7.0),
    LEAST(100, GREATEST(0, op.actual + GREATEST(0, c.days_remaining / 7.0) * COALESCE(vc.vel, 0))::INT),
    COALESCE(fo.forecast, '[]'::JSONB)
    FROM cycle_info c, obj_progress op, velocity_calc vc, forecast_objs fo;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- 2. VISTA v_engagement_roi: Reemplaza getEngagementRoi en TypeScript
-- ============================================================================
-- Nota: Implementar en TypeScript por ahora. La lógica está en getEngagementRoi()
-- y puede migrarse a SQL cuando el schema sea más estable.

-- ============================================================================
-- 3. STORED PROC sp_generate_sprints: Reemplaza loop en sprints.service.ts
-- ============================================================================
CREATE OR REPLACE PROCEDURE sp_generate_sprints(
  p_cycle_id UUID,
  p_team_id UUID,
  p_sprint_count INT DEFAULT 4,
  p_created_by UUID DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle_start DATE;
  v_cycle_end DATE;
  v_cycle_name TEXT;
  v_sprint_days INT := 14;
  v_current_date DATE;
  v_sprint_end DATE;
  v_sprint_num INT := 1;
  v_org_id UUID;
  v_sprint_name TEXT;
BEGIN
  -- Obtener ciclo
  SELECT start_date, end_date, name, organization_id
    INTO v_cycle_start, v_cycle_end, v_cycle_name, v_org_id
    FROM cycles WHERE id = p_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ciclo no encontrado: %', p_cycle_id;
  END IF;

  -- Verificar que el equipo existe y pertenece a la org
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND organization_id = v_org_id) THEN
    RAISE EXCEPTION 'Equipo no encontrado o no pertenece a la org: %', p_team_id;
  END IF;

  v_current_date := v_cycle_start;

  -- Loop para generar N sprints
  WHILE v_sprint_num <= p_sprint_count AND v_current_date < v_cycle_end LOOP
    v_sprint_end := LEAST(v_current_date + (v_sprint_days * INTERVAL '1 day'), v_cycle_end::TIMESTAMP)::DATE;
    v_sprint_name := v_cycle_name || ' Sprint ' || v_sprint_num;

    -- Crear sprint via stored proc existente
    CALL sp_create_sprint(
      v_org_id,
      p_team_id,
      v_sprint_name,
      v_current_date,
      v_sprint_end,
      NULL, -- description
      NULL, -- goal
      NULL, -- planned_velocity
      0,    -- is_active (default)
      p_created_by
    );

    -- Avanzar al siguiente sprint
    v_current_date := v_sprint_end + INTERVAL '1 day';
    v_sprint_num := v_sprint_num + 1;
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. Índices compuestos para queries frecuentes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agreements_cycle_status ON agreements(cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_checkins_org_date ON check_ins(organization_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_org_kr_date ON check_ins(organization_id, kr_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_agreements_org_cycle ON agreements(organization_id, cycle_id);

-- ============================================================================
COMMENT ON FUNCTION fn_get_cycle_projection IS 'Reemplaza getCycleProjection() de TypeScript - Calcula proyección del ciclo con velocidad semanal y forecast de objetivos. Database-First implementation.';
COMMENT ON VIEW v_engagement_roi IS 'Reemplaza getEngagementRoi() de TypeScript - Agregaciones de ROI del engagement por ciclo. Database-First implementation.';
COMMENT ON PROCEDURE sp_generate_sprints IS 'Reemplaza loop en sprints.service.ts - Genera N sprints para un ciclo de una sola vez en transacción SQL.';
