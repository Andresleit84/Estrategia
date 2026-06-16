-- ================================================================
-- Migración 012 — Correcciones de vistas del Hito 10
-- ================================================================
-- v_portfolio_dashboard: CURRENT_DATE en lugar de NOW() para is_overdue
-- v_executive_dashboard: CURRENT_TIMESTAMP en lugar de NOW() para last_updated

-- ----------------------------------------------------------------
-- VISTA: v_portfolio_dashboard (corregida)
-- Usa CURRENT_DATE para comparar fechas (due_date es tipo date, no timestamptz)
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
  (i.due_date < CURRENT_DATE AND i.status NOT IN ('DONE','CANCELLED')) AS is_overdue
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
-- VISTA: v_executive_dashboard (corregida)
-- Usa CURRENT_TIMESTAMP (más explícito que NOW()) para last_updated
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
        ) < CURRENT_TIMESTAMP - INTERVAL '14 days'
      )
      AND kr.status NOT IN ('COMPLETED','CANCELLED')
    ) AS at_risk_krs
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.deleted_at IS NULL
    AND o.deleted_at IS NULL
  GROUP BY o.organization_id, o.cycle_id
),
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
  CURRENT_TIMESTAMP                                                           AS last_updated
FROM cycles c
LEFT JOIN obj_prog op     ON op.cycle_id = c.id AND op.organization_id = c.organization_id
LEFT JOIN kr_risk krrisk  ON krrisk.cycle_id = c.id AND krrisk.organization_id = c.organization_id
LEFT JOIN top_risk_krs trk ON trk.cycle_id = c.id AND trk.organization_id = c.organization_id
WHERE c.deleted_at IS NULL
  AND (
    c.status = 'ACTIVE'
    OR (c.status = 'CLOSED' AND c.end_date >= CURRENT_TIMESTAMP - INTERVAL '90 days')
  )
GROUP BY
  c.organization_id, c.id, c.name, c.status,
  krrisk.at_risk_krs, trk.krs_json;
