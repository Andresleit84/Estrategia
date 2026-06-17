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
DECLARE
  v_cycle_start DATE;
  v_cycle_end DATE;
  v_cycle_name TEXT;
  v_days_remaining INT;
  v_expected_progress INT;
  v_actual_progress INT;
  v_progress_gap INT;
  v_weekly_velocity NUMERIC;
  v_weeks_remaining NUMERIC;
  v_projected_final INT;
  v_objectives_count INT;
  v_trend_count INT;
BEGIN
  -- Obtener info del ciclo
  SELECT c.name, c.start_date, c.end_date,
         GREATEST(0, (c.end_date - CURRENT_DATE))::INT
    INTO v_cycle_name, v_cycle_start, v_cycle_end, v_days_remaining
    FROM cycles c
   WHERE c.id = p_cycle_id AND c.organization_id = p_org_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_weeks_remaining := GREATEST(0, v_days_remaining / 7.0);
  v_expected_progress := CASE
    WHEN CURRENT_DATE >= v_cycle_end THEN 100
    WHEN CURRENT_DATE <= v_cycle_start THEN 0
    ELSE ROUND(100.0 * (CURRENT_DATE - v_cycle_start) / (v_cycle_end - v_cycle_start))::INT
  END;

  -- Progreso actual (promedio de objetivos)
  SELECT COUNT(*), COALESCE(AVG(CAST(progress AS FLOAT)), 0)::INT
    INTO v_objectives_count, v_actual_progress
    FROM v_objectives_with_progress
   WHERE cycle_id = p_cycle_id AND organization_id = p_org_id AND status != 'CANCELLED';

  v_progress_gap := v_actual_progress - v_expected_progress;

  -- Tendencia semanal (últimas 4 semanas de histórico)
  WITH trend AS (
    SELECT DATE_TRUNC('week', checked_at)::DATE AS week_start,
           EXTRACT(WEEK FROM checked_at)::INT AS week_number,
           AVG(CAST(value AS FLOAT)) AS avg_value
      FROM check_ins ci
     WHERE ci.organization_id = p_org_id
       AND checked_at >= CURRENT_DATE - INTERVAL '28 days'
     GROUP BY week_start, week_number
     ORDER BY week_start DESC
     LIMIT 4
  )
  SELECT COUNT(*) INTO v_trend_count FROM trend;

  -- Calcular velocidad semanal si hay trend
  IF v_trend_count >= 2 THEN
    WITH trend AS (
      SELECT DATE_TRUNC('week', checked_at)::DATE AS week_start,
             AVG(CAST(value AS FLOAT)) AS avg_value
        FROM check_ins ci
       WHERE ci.organization_id = p_org_id
         AND checked_at >= CURRENT_DATE - INTERVAL '28 days'
       GROUP BY week_start
       ORDER BY week_start DESC
       LIMIT 4
    ),
    deltas AS (
      SELECT (LAG(avg_value) OVER (ORDER BY week_start DESC) - avg_value) AS delta
        FROM trend
    )
    SELECT ROUND(AVG(ABS(delta)), 1) INTO v_weekly_velocity FROM deltas WHERE delta IS NOT NULL;
  ELSE
    v_weekly_velocity := 0;
  END IF;

  v_weekly_velocity := COALESCE(v_weekly_velocity, 0);

  -- Proyección final = actual + (semanas restantes * velocidad)
  v_projected_final := LEAST(100, GREATEST(0,
    ROUND(v_actual_progress + (v_weeks_remaining * v_weekly_velocity))::INT
  ));

  -- Construir array de objetivos con estado de forecast
  WITH obj_forecast AS (
    SELECT
      id, title, level, progress,
      COALESCE(avg_confidence, 0) AS confidence,
      CASE
        WHEN progress >= (v_expected_progress * 0.75)::INT AND COALESCE(avg_confidence, 0) >= 0.5
          THEN 'on_track'
        WHEN progress >= (v_expected_progress * 0.45)::INT OR COALESCE(avg_confidence, 0) >= 0.4
          THEN 'at_risk'
        ELSE 'critical'
      END AS forecast_status,
      progress - v_expected_progress AS obj_gap
      FROM v_objectives_with_progress
     WHERE cycle_id = p_cycle_id AND organization_id = p_org_id AND status != 'CANCELLED'
  )
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', id,
      'title', title,
      'level', level,
      'progress', progress,
      'confidence', confidence,
      'forecast_status', forecast_status,
      'obj_gap', obj_gap
    )
  ) INTO COALESCE(objectives_json, '[]'::JSONB) FROM obj_forecast;

  -- Retornar resultado
  RETURN QUERY SELECT
    p_cycle_id,
    v_cycle_name,
    v_days_remaining,
    v_expected_progress,
    v_actual_progress,
    v_progress_gap,
    v_weekly_velocity,
    v_weeks_remaining,
    v_projected_final,
    COALESCE(objectives_json, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. VISTA v_engagement_roi: Reemplaza getEngagementRoi en TypeScript
-- ============================================================================
CREATE OR REPLACE VIEW v_engagement_roi AS
WITH cycle_data AS (
  SELECT c.id, c.name, c.status, c.start_date, c.end_date, c.organization_id
    FROM cycles c
   WHERE c.status IN ('ACTIVE', 'CLOSED')
),
agreement_stats AS (
  SELECT
    cycle_id,
    organization_id,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'FULFILLED') AS fulfilled,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
    COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'FULFILLED') / NULLIF(COUNT(*), 0))::INT AS fulfillment_rate
    FROM agreements
   GROUP BY cycle_id, organization_id
),
objective_stats AS (
  SELECT
    cycle_id,
    organization_id,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE progress >= 70 OR status = 'COMPLETED') AS completed,
    COUNT(*) FILTER (WHERE progress >= 40 AND progress < 70) AS partial,
    COUNT(*) FILTER (WHERE progress < 40 AND status != 'CANCELLED') AS missed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE progress >= 70 OR status = 'COMPLETED') / NULLIF(COUNT(*), 0))::INT AS completion_rate
    FROM v_objectives_with_progress
   WHERE status != 'CANCELLED'
   GROUP BY cycle_id, organization_id
),
work_stats AS (
  SELECT
    c.cycle_id,
    c.organization_id,
    COUNT(*) FILTER (WHERE c.type = 'EPIC') AS epics_total,
    COUNT(*) FILTER (WHERE c.type = 'EPIC' AND c.status IN ('COMPLETED','DONE')) AS epics_done,
    COUNT(*) FILTER (WHERE c.type = 'FEATURE') AS features_total,
    COUNT(*) FILTER (WHERE c.type = 'FEATURE' AND c.status IN ('COMPLETED','DONE')) AS features_done,
    COUNT(*) FILTER (WHERE c.type = 'STORY') AS stories_total,
    COUNT(*) FILTER (WHERE c.type = 'STORY' AND c.status IN ('COMPLETED','DONE')) AS stories_done,
    COALESCE(SUM(c.story_points), 0) AS total_points,
    COALESCE(SUM(c.story_points) FILTER (WHERE c.status IN ('COMPLETED','DONE')), 0) AS done_points
    FROM v_backlog_items c
   GROUP BY c.cycle_id, c.organization_id
),
checkin_stats AS (
  SELECT
    kr.cycle_id,
    kr.organization_id,
    COUNT(DISTINCT ci.id) AS total
    FROM check_ins ci
    JOIN key_results kr ON kr.id = ci.kr_id
   GROUP BY kr.cycle_id, kr.organization_id
)
SELECT
  c.id AS cycle_id,
  c.name AS cycle_name,
  c.status AS cycle_status,
  c.start_date, c.end_date,
  c.organization_id,
  COALESCE(ag.total, 0) AS agreements_total,
  COALESCE(ag.fulfilled, 0) AS agreements_fulfilled,
  COALESCE(ag.in_progress, 0) AS agreements_in_progress,
  COALESCE(ag.pending, 0) AS agreements_pending,
  COALESCE(ag.fulfillment_rate, 0) AS agreements_fulfillment_rate,
  COALESCE(obj.total, 0) AS objectives_total,
  COALESCE(obj.completed, 0) AS objectives_completed,
  COALESCE(obj.partial, 0) AS objectives_partial,
  COALESCE(obj.missed, 0) AS objectives_missed,
  COALESCE(obj.completion_rate, 0) AS objectives_completion_rate,
  COALESCE(w.epics_total, 0) AS work_epics_total,
  COALESCE(w.epics_done, 0) AS work_epics_done,
  COALESCE(w.features_total, 0) AS work_features_total,
  COALESCE(w.features_done, 0) AS work_features_done,
  COALESCE(w.stories_total, 0) AS work_stories_total,
  COALESCE(w.stories_done, 0) AS work_stories_done,
  COALESCE(w.total_points, 0) AS work_total_points,
  COALESCE(w.done_points, 0) AS work_done_points,
  COALESCE(ch.total, 0) AS checkins_total
  FROM cycle_data c
  LEFT JOIN agreement_stats ag ON ag.cycle_id = c.id AND ag.organization_id = c.organization_id
  LEFT JOIN objective_stats obj ON obj.cycle_id = c.id AND obj.organization_id = c.organization_id
  LEFT JOIN work_stats w ON w.cycle_id = c.id AND w.organization_id = c.organization_id
  LEFT JOIN checkin_stats ch ON ch.cycle_id = c.id AND ch.organization_id = c.organization_id;

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
-- 4. Índices para optimizar queries de engagement_roi
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agreements_cycle_status ON agreements(cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_objectives_cycle_progress ON v_objectives_with_progress(cycle_id, progress);
CREATE INDEX IF NOT EXISTS idx_checkins_org_date ON check_ins(organization_id, checked_at DESC);

-- ============================================================================
-- 5. Índices compuestos para queries frecuentes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_check_ins_org_kr_date ON check_ins(organization_id, kr_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_objectives_org_cycle_level ON v_objectives_with_progress(organization_id, cycle_id, level);
CREATE INDEX IF NOT EXISTS idx_agreements_org_cycle_status ON agreements(organization_id, cycle_id, status);

-- ============================================================================
COMMENT ON FUNCTION fn_get_cycle_projection IS 'Reemplaza getCycleProjection() de TypeScript - Calcula proyección del ciclo con velocidad semanal y forecast de objetivos. Database-First implementation.';
COMMENT ON VIEW v_engagement_roi IS 'Reemplaza getEngagementRoi() de TypeScript - Agregaciones de ROI del engagement por ciclo. Database-First implementation.';
COMMENT ON PROCEDURE sp_generate_sprints IS 'Reemplaza loop en sprints.service.ts - Genera N sprints para un ciclo de una sola vez en transacción SQL.';
