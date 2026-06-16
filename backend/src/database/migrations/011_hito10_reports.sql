-- ================================================================
-- Migración 011 — Hito 10: Reports & Dashboards
-- ================================================================

-- ----------------------------------------------------------------
-- TABLA: cycle_close_reports
-- Un único reporte inmutable por ciclo (snapshot JSON)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cycle_close_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid        NOT NULL REFERENCES cycles(id),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content         jsonb       NOT NULL,
  generated_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cycle_close_reports_cycle UNIQUE (cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_cycle_close_reports_org
  ON cycle_close_reports(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cycle_close_reports_org_cycle
  ON cycle_close_reports(organization_id, cycle_id);

-- ----------------------------------------------------------------
-- ÍNDICES DE PERFORMANCE GENERALES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_check_ins_kr_checked
  ON check_ins(kr_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_initiatives_cycle_team
  ON initiatives(cycle_id, team_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_cycle_level
  ON objectives(cycle_id, level)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------
-- VISTA: v_weekly_trend
-- 8 semanas de tendencia por ciclo (semana 1 = más antigua, 8 = actual)
-- NOTA: usa fn_calculate_objective_progress por fila — puede ser lento
-- en ciclos con muchos objetivos. Materializar con REFRESH si es necesario.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_weekly_trend AS
WITH weeks AS (
  SELECT
    generate_series(
      (NOW() - INTERVAL '7 weeks')::date,
      NOW()::date,
      INTERVAL '1 week'
    )::date                                   AS week_start,
    row_number() OVER (ORDER BY generate_series) AS week_number
  FROM generate_series(
    (NOW() - INTERVAL '7 weeks')::date,
    NOW()::date,
    INTERVAL '1 week'
  )
),
cycles_base AS (
  SELECT id AS cycle_id, organization_id FROM cycles WHERE deleted_at IS NULL
),
-- Para cada KR y cada semana: current_value del check-in más reciente antes del fin de semana
kr_weekly_value AS (
  SELECT
    kr.id          AS kr_id,
    kr.objective_id,
    kr.start_value,
    kr.target_value,
    kr.type,
    w.week_start,
    w.week_number,
    (
      SELECT ci.current_value
      FROM check_ins ci
      WHERE ci.kr_id = kr.id
        AND ci.checked_at <= (w.week_start + INTERVAL '6 days 23:59:59')
      ORDER BY ci.checked_at DESC
      LIMIT 1
    ) AS last_value_in_week,
    (
      SELECT COUNT(*)
      FROM check_ins ci
      WHERE ci.kr_id = kr.id
        AND ci.checked_at >= w.week_start::timestamptz
        AND ci.checked_at <= (w.week_start + INTERVAL '6 days 23:59:59')
    ) AS checkin_count_in_week
  FROM key_results kr
  JOIN objectives obj ON obj.id = kr.objective_id
  CROSS JOIN weeks w
  WHERE kr.deleted_at IS NULL
    AND obj.deleted_at IS NULL
),
-- Progreso calculado por KR y semana (0-100)
kr_weekly_progress AS (
  SELECT
    kw.objective_id,
    kw.week_start,
    kw.week_number,
    kw.checkin_count_in_week,
    CASE
      WHEN kw.last_value_in_week IS NULL THEN NULL
      WHEN kw.target_value = kw.start_value THEN 100.0
      WHEN kw.type IN ('INCREASE', 'ACHIEVE') THEN
        LEAST(100.0, GREATEST(0.0,
          (kw.last_value_in_week - kw.start_value) /
          NULLIF(kw.target_value - kw.start_value, 0) * 100.0
        ))
      WHEN kw.type = 'DECREASE' THEN
        LEAST(100.0, GREATEST(0.0,
          (kw.start_value - kw.last_value_in_week) /
          NULLIF(kw.start_value - kw.target_value, 0) * 100.0
        ))
      WHEN kw.type = 'MAINTAIN' THEN
        CASE
          WHEN ABS(kw.last_value_in_week - kw.target_value) <=
               ABS(kw.target_value * 0.05) THEN 100.0
          ELSE GREATEST(0.0, 100.0 - ABS(kw.last_value_in_week - kw.target_value) /
               NULLIF(kw.target_value, 0) * 100.0)
        END
      ELSE NULL
    END AS kr_progress
  FROM kr_weekly_value kw
),
-- Agrupado por objetivo y semana
obj_weekly_progress AS (
  SELECT
    obj.cycle_id,
    obj.organization_id,
    kwp.week_start,
    kwp.week_number,
    COALESCE(AVG(kwp.kr_progress), 0) AS obj_progress,
    SUM(kwp.checkin_count_in_week)    AS checkin_count
  FROM objectives obj
  JOIN kr_weekly_progress kwp ON kwp.objective_id = obj.id
  WHERE obj.deleted_at IS NULL
  GROUP BY obj.cycle_id, obj.organization_id, kwp.week_start, kwp.week_number
)
SELECT
  cycle_id,
  organization_id,
  week_number::int        AS week_number,
  week_start,
  ROUND(COALESCE(AVG(obj_progress), 0)::numeric, 2) AS avg_progress,
  COALESCE(SUM(checkin_count), 0)::bigint            AS checkin_count
FROM obj_weekly_progress
GROUP BY cycle_id, organization_id, week_number, week_start
ORDER BY cycle_id, week_number;

-- ----------------------------------------------------------------
-- VISTA: v_cycle_health
-- Salud general de cada ciclo
-- NOTA: usa fn_calculate_objective_progress y fn_get_cycle_score.
-- Si hay muchos objetivos, materializar con REFRESH.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_cycle_health AS
WITH obj_progress AS (
  SELECT
    o.cycle_id,
    o.id           AS objective_id,
    o.status,
    fn_calculate_objective_progress(o.id) AS progress
  FROM objectives o
  WHERE o.deleted_at IS NULL
),
kr_stats AS (
  SELECT
    o.cycle_id,
    COUNT(kr.id)                                       AS total_krs,
    COUNT(kr.id) FILTER (WHERE kr.status = 'COMPLETED') AS completed_krs,
    COUNT(kr.id) FILTER (
      WHERE (kr.confidence < 0.5 OR (
        SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id
      ) < NOW() - INTERVAL '14 days')
      AND kr.status NOT IN ('COMPLETED','CANCELLED')
    )                                                  AS at_risk_krs,
    AVG(kr.confidence) FILTER (WHERE kr.status = 'ACTIVE') AS avg_confidence
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.deleted_at IS NULL
    AND o.deleted_at IS NULL
  GROUP BY o.cycle_id
)
SELECT
  c.id                                                          AS cycle_id,
  c.organization_id,
  c.name                                                        AS cycle_name,
  c.status                                                      AS cycle_status,
  c.start_date,
  c.end_date,
  COUNT(op.objective_id)::bigint                                AS total_objectives,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'DRAFT')      AS draft_count,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'ACTIVE')     AS active_count,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'COMPLETED')  AS completed_count,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'CANCELLED')  AS cancelled_count,
  COALESCE(ks.total_krs, 0)::bigint                             AS total_krs,
  COALESCE(ks.completed_krs, 0)::bigint                         AS completed_krs,
  COALESCE(ks.at_risk_krs, 0)::bigint                           AS at_risk_krs,
  ROUND(COALESCE(ks.avg_confidence, 0)::numeric, 4)             AS avg_confidence,
  ROUND(COALESCE(fn_get_cycle_score(c.id), 0)::numeric, 2)      AS cycle_score,
  ROUND(
    COALESCE(
      AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'),
      0
    )::numeric,
    2
  )                                                             AS avg_progress,
  CASE
    WHEN c.status = 'ACTIVE'
      AND COALESCE(
            AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 0
          ) > 0
    THEN
      LEAST(
        c.end_date + INTERVAL '90 days',
        GREATEST(
          c.start_date,
          (
            c.start_date +
            ((c.end_date - c.start_date) *
            (COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 0) / 100.0))::integer
          )::date
        )
      )::date
    ELSE NULL
  END                                                           AS projected_close_date
FROM cycles c
LEFT JOIN obj_progress op ON op.cycle_id = c.id
LEFT JOIN kr_stats ks     ON ks.cycle_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.organization_id, c.name, c.status, c.start_date, c.end_date,
         ks.total_krs, ks.completed_krs, ks.at_risk_krs, ks.avg_confidence;

-- ----------------------------------------------------------------
-- VISTA: v_team_health
-- Salud por (organization_id, cycle_id, team_id) — solo equipos con
-- al menos un objetivo activo en el ciclo.
-- NOTA: usa fn_calculate_objective_progress — materializar si es lento.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_team_health AS
WITH team_objectives AS (
  SELECT
    o.organization_id,
    o.cycle_id,
    o.team_id,
    o.id AS objective_id,
    fn_calculate_objective_progress(o.id) AS progress
  FROM objectives o
  WHERE o.deleted_at IS NULL
    AND o.status = 'ACTIVE'
    AND o.team_id IS NOT NULL
),
team_kr_stats AS (
  SELECT
    o.organization_id,
    o.cycle_id,
    o.team_id,
    AVG(kr.confidence) FILTER (WHERE kr.status = 'ACTIVE')         AS avg_confidence,
    COUNT(kr.id) FILTER (WHERE kr.confidence < 0.5
                           AND kr.status = 'ACTIVE')               AS at_risk_count,
    -- cadence_score: % de KRs activos con check-in en los últimos 7 días
    ROUND(
      100.0 *
      COUNT(kr.id) FILTER (
        WHERE kr.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM check_ins ci
            WHERE ci.kr_id = kr.id
              AND ci.checked_at >= NOW() - INTERVAL '7 days'
          )
      ) / NULLIF(COUNT(kr.id) FILTER (WHERE kr.status = 'ACTIVE'), 0),
      2
    )                                                               AS cadence_score
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.deleted_at IS NULL
    AND o.deleted_at IS NULL
    AND o.status = 'ACTIVE'
    AND o.team_id IS NOT NULL
  GROUP BY o.organization_id, o.cycle_id, o.team_id
)
SELECT
  to_.organization_id,
  to_.cycle_id,
  to_.team_id,
  t.name                                           AS team_name,
  COUNT(to_.objective_id)::bigint                  AS objective_count,
  ROUND(COALESCE(AVG(to_.progress), 0)::numeric, 2) AS avg_progress,
  ROUND(COALESCE(tks.avg_confidence, 0)::numeric, 4) AS avg_confidence,
  COALESCE(tks.cadence_score, 0)                   AS cadence_score,
  COALESCE(tks.at_risk_count, 0)::bigint           AS at_risk_count
FROM team_objectives to_
JOIN teams t   ON t.id = to_.team_id
LEFT JOIN team_kr_stats tks
  ON  tks.organization_id = to_.organization_id
  AND tks.cycle_id        = to_.cycle_id
  AND tks.team_id         = to_.team_id
GROUP BY
  to_.organization_id, to_.cycle_id, to_.team_id,
  t.name,
  tks.avg_confidence, tks.cadence_score, tks.at_risk_count;

-- ----------------------------------------------------------------
-- VISTA: v_portfolio_dashboard
-- Una fila por iniciativa (no borrada), con datos de equipo y propietario
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_portfolio_dashboard AS
SELECT
  i.id,
  i.organization_id,
  i.cycle_id,
  i.team_id,
  t.name                                                        AS team_name,
  i.title,
  i.status,
  i.start_date,
  i.due_date,
  i.progress,
  i.owner_id,
  u.name                                                        AS owner_name,
  COUNT(m.id)::bigint                                           AS milestone_count,
  COUNT(m.id) FILTER (WHERE m.status = 'DONE')::bigint          AS completed_milestones,
  (i.due_date < NOW() AND i.status NOT IN ('DONE','CANCELLED')) AS is_overdue
FROM initiatives i
LEFT JOIN teams t     ON t.id = i.team_id
LEFT JOIN users u     ON u.id = i.owner_id
LEFT JOIN milestones m ON m.initiative_id = i.id
WHERE i.deleted_at IS NULL
GROUP BY
  i.id, i.organization_id, i.cycle_id, i.team_id, t.name,
  i.title, i.status, i.start_date, i.due_date, i.progress,
  i.owner_id, u.name
ORDER BY t.name NULLS LAST, i.status, i.due_date NULLS LAST;

-- ----------------------------------------------------------------
-- VISTA: v_executive_dashboard
-- Una fila por (organization_id, cycle_id) — ciclos ACTIVE o CLOSED
-- en los últimos 90 días.
-- NOTA: usa fn_calculate_objective_progress — materializar si es lento.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_executive_dashboard AS
WITH obj_prog AS (
  SELECT
    o.organization_id,
    o.cycle_id,
    o.id        AS objective_id,
    o.level,
    o.status,
    fn_calculate_objective_progress(o.id) AS progress
  FROM objectives o
  WHERE o.deleted_at IS NULL
),
kr_risk AS (
  SELECT
    o.organization_id,
    o.cycle_id,
    COUNT(kr.id) FILTER (
      WHERE (
        kr.confidence < 0.5
        OR (
          SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id
        ) < NOW() - INTERVAL '14 days'
      )
      AND kr.status NOT IN ('COMPLETED','CANCELLED')
    ) AS at_risk_krs
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.deleted_at IS NULL
    AND o.deleted_at IS NULL
  GROUP BY o.organization_id, o.cycle_id
),
-- Top 5 KRs en más riesgo por ciclo
top_risk_krs AS (
  SELECT
    o.organization_id,
    o.cycle_id,
    jsonb_agg(
      jsonb_build_object(
        'kr_id',          kr.id,
        'kr_title',       kr.title,
        'objective_title', o.title,
        'confidence',     kr.confidence,
        'progress',       ROUND(
          COALESCE(
            CASE
              WHEN kr.target_value = kr.start_value THEN 100.0
              WHEN kr.type IN ('INCREASE','ACHIEVE') THEN
                LEAST(100.0, GREATEST(0.0,
                  (kr.current_value - kr.start_value) /
                  NULLIF(kr.target_value - kr.start_value, 0) * 100.0
                ))
              WHEN kr.type = 'DECREASE' THEN
                LEAST(100.0, GREATEST(0.0,
                  (kr.start_value - kr.current_value) /
                  NULLIF(kr.start_value - kr.target_value, 0) * 100.0
                ))
              ELSE 0.0
            END,
            0.0
          )::numeric, 0
        ),
        'level',          o.level
      )
      ORDER BY kr.confidence ASC NULLS LAST
    ) AS krs_json
  FROM (
    SELECT
      kr.id, kr.title, kr.confidence, kr.type,
      kr.current_value, kr.start_value, kr.target_value,
      kr.objective_id,
      ROW_NUMBER() OVER (
        PARTITION BY o2.organization_id, o2.cycle_id
        ORDER BY kr.confidence ASC NULLS LAST
      ) AS rn
    FROM key_results kr
    JOIN objectives o2 ON o2.id = kr.objective_id
    WHERE kr.deleted_at IS NULL
      AND o2.deleted_at IS NULL
      AND kr.status NOT IN ('COMPLETED','CANCELLED')
  ) kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.rn <= 5
  GROUP BY o.organization_id, o.cycle_id
)
SELECT
  c.organization_id,
  c.id                                                                        AS cycle_id,
  c.name                                                                      AS cycle_name,
  c.status                                                                    AS cycle_status,
  ROUND(COALESCE(fn_get_cycle_score(c.id), 0)::numeric, 2)                   AS cycle_score,
  COUNT(op.objective_id)::bigint                                              AS total_objectives,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'COMPLETED')::bigint      AS completed_objectives,
  COALESCE(krrisk.at_risk_krs, 0)::bigint                                    AS at_risk_krs,
  ROUND(COALESCE(AVG(op.progress), 0)::numeric, 2)                           AS avg_progress,
  ROUND(COALESCE(
    AVG(op.progress) FILTER (WHERE op.level = 'COMPANY'), 0
  )::numeric, 2)                                                              AS company_progress,
  ROUND(COALESCE(
    AVG(op.progress) FILTER (WHERE op.level = 'AREA'), 0
  )::numeric, 2)                                                              AS area_progress,
  ROUND(COALESCE(
    AVG(op.progress) FILTER (WHERE op.level = 'TEAM'), 0
  )::numeric, 2)                                                              AS team_progress,
  jsonb_build_object(
    'COMPANY',    jsonb_build_object(
      'progress', ROUND(COALESCE(AVG(op.progress) FILTER (WHERE op.level = 'COMPANY'), 0)::numeric, 2),
      'count',    COUNT(op.objective_id) FILTER (WHERE op.level = 'COMPANY')
    ),
    'AREA',       jsonb_build_object(
      'progress', ROUND(COALESCE(AVG(op.progress) FILTER (WHERE op.level = 'AREA'), 0)::numeric, 2),
      'count',    COUNT(op.objective_id) FILTER (WHERE op.level = 'AREA')
    ),
    'TEAM',       jsonb_build_object(
      'progress', ROUND(COALESCE(AVG(op.progress) FILTER (WHERE op.level = 'TEAM'), 0)::numeric, 2),
      'count',    COUNT(op.objective_id) FILTER (WHERE op.level = 'TEAM')
    ),
    'INDIVIDUAL', jsonb_build_object(
      'progress', ROUND(COALESCE(AVG(op.progress) FILTER (WHERE op.level = 'INDIVIDUAL'), 0)::numeric, 2),
      'count',    COUNT(op.objective_id) FILTER (WHERE op.level = 'INDIVIDUAL')
    )
  )                                                                           AS heatmap,
  COALESCE(trk.krs_json, '[]'::jsonb)                                        AS top_at_risk_krs,
  NOW()                                                                       AS last_updated
FROM cycles c
LEFT JOIN obj_prog op     ON op.cycle_id = c.id AND op.organization_id = c.organization_id
LEFT JOIN kr_risk krrisk  ON krrisk.cycle_id = c.id AND krrisk.organization_id = c.organization_id
LEFT JOIN top_risk_krs trk ON trk.cycle_id = c.id AND trk.organization_id = c.organization_id
WHERE c.deleted_at IS NULL
  AND (
    c.status = 'ACTIVE'
    OR (c.status = 'CLOSED' AND c.end_date >= NOW() - INTERVAL '90 days')
  )
GROUP BY
  c.organization_id, c.id, c.name, c.status,
  krrisk.at_risk_krs, trk.krs_json;

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_generate_cycle_close_report
-- Genera el snapshot JSON completo de cierre de ciclo
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generate_cycle_close_report(
  p_cycle_id uuid,
  p_org_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cycle         RECORD;
  v_summary       jsonb;
  v_objectives    jsonb;
  v_top           jsonb;
  v_bottom        jsonb;
  v_total_checkins bigint;
  v_score         numeric;
  v_obj_progress  numeric;
BEGIN
  -- Ciclo
  SELECT id, name, start_date, end_date, status
  INTO v_cycle
  FROM cycles
  WHERE id = p_cycle_id AND organization_id = p_org_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Cycle not found');
  END IF;

  v_score := COALESCE(fn_get_cycle_score(p_cycle_id), 0);

  -- Total check-ins del ciclo
  SELECT COUNT(*)
  INTO v_total_checkins
  FROM check_ins ci
  JOIN key_results kr ON kr.id = ci.kr_id
  JOIN objectives  o  ON o.id  = kr.objective_id
  WHERE o.cycle_id = p_cycle_id
    AND o.deleted_at IS NULL
    AND kr.deleted_at IS NULL;

  -- Array de objetivos con progreso
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',             o.id,
      'title',          o.title,
      'level',          o.level,
      'status',         o.status,
      'final_progress', ROUND(COALESCE(fn_calculate_objective_progress(o.id), 0)::numeric, 2),
      'kr_count',       (SELECT COUNT(*) FROM key_results kr WHERE kr.objective_id = o.id AND kr.deleted_at IS NULL),
      'completed_krs',  (SELECT COUNT(*) FROM key_results kr WHERE kr.objective_id = o.id AND kr.deleted_at IS NULL AND kr.status = 'COMPLETED')
    )
  )
  INTO v_objectives
  FROM objectives o
  WHERE o.cycle_id = p_cycle_id
    AND o.organization_id = p_org_id
    AND o.deleted_at IS NULL;

  -- Summary
  SELECT jsonb_build_object(
    'total_objectives', COUNT(*),
    'completed',        COUNT(*) FILTER (WHERE o.status = 'COMPLETED'),
    'partial',          COUNT(*) FILTER (WHERE
                          o.status != 'CANCELLED'
                          AND COALESCE(fn_calculate_objective_progress(o.id), 0) >= 30
                          AND COALESCE(fn_calculate_objective_progress(o.id), 0) < 100
                        ),
    'missed',           COUNT(*) FILTER (WHERE
                          o.status != 'CANCELLED'
                          AND COALESCE(fn_calculate_objective_progress(o.id), 0) < 30
                        ),
    'cancelled',        COUNT(*) FILTER (WHERE o.status = 'CANCELLED'),
    'completion_rate',  ROUND(
                          100.0 * COUNT(*) FILTER (WHERE o.status = 'COMPLETED') /
                          NULLIF(COUNT(*) FILTER (WHERE o.status != 'CANCELLED'), 0),
                          2
                        )
  )
  INTO v_summary
  FROM objectives o
  WHERE o.cycle_id = p_cycle_id
    AND o.organization_id = p_org_id
    AND o.deleted_at IS NULL;

  -- Top 3 por progreso
  SELECT jsonb_agg(sub ORDER BY sub->>'final_progress' DESC)
  INTO v_top
  FROM (
    SELECT jsonb_build_object(
      'id',             o.id,
      'title',          o.title,
      'level',          o.level,
      'final_progress', ROUND(COALESCE(fn_calculate_objective_progress(o.id), 0)::numeric, 2)
    ) AS sub
    FROM objectives o
    WHERE o.cycle_id = p_cycle_id
      AND o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND o.status != 'CANCELLED'
    ORDER BY fn_calculate_objective_progress(o.id) DESC NULLS LAST
    LIMIT 3
  ) t;

  -- Bottom 3 activos por progreso
  SELECT jsonb_agg(sub ORDER BY sub->>'final_progress' ASC)
  INTO v_bottom
  FROM (
    SELECT jsonb_build_object(
      'id',             o.id,
      'title',          o.title,
      'level',          o.level,
      'final_progress', ROUND(COALESCE(fn_calculate_objective_progress(o.id), 0)::numeric, 2)
    ) AS sub
    FROM objectives o
    WHERE o.cycle_id = p_cycle_id
      AND o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND o.status = 'ACTIVE'
    ORDER BY fn_calculate_objective_progress(o.id) ASC NULLS FIRST
    LIMIT 3
  ) t;

  RETURN jsonb_build_object(
    'cycle', jsonb_build_object(
      'id',         v_cycle.id,
      'name',       v_cycle.name,
      'start_date', v_cycle.start_date,
      'end_date',   v_cycle.end_date,
      'status',     v_cycle.status,
      'score',      v_score
    ),
    'summary',          COALESCE(v_summary, '{}'::jsonb),
    'objectives',       COALESCE(v_objectives, '[]'::jsonb),
    'top_performers',   COALESCE(v_top, '[]'::jsonb),
    'needs_improvement',COALESCE(v_bottom, '[]'::jsonb),
    'total_checkins',   v_total_checkins,
    'generated_at',     NOW()
  );
END;
$$;
