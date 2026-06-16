-- ================================================================
-- Migración 031 — Correcciones de vistas de reportes
-- ================================================================
-- 1. v_weekly_trend: genera las 8 semanas correctamente (alias generate_series)
-- 2. v_executive_dashboard: at_risk_krs con threshold 0.4, NULL checkin = at risk
-- 3. v_cycle_health: mismos fixes + projected_close_date velocity-based
-- ================================================================

-- ----------------------------------------------------------------
-- VISTA: v_weekly_trend (corregida)
-- Bug original: generate_series en SELECT y FROM sin alias causaba
-- cruce de valores. Fix: usar alias 'gs' en FROM.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_weekly_trend AS
WITH weeks AS (
  SELECT
    gs::date                               AS week_start,
    row_number() OVER (ORDER BY gs)::int   AS week_number
  FROM generate_series(
    (NOW() - INTERVAL '7 weeks')::date,
    NOW()::date,
    INTERVAL '1 week'
  ) AS gs
),
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
obj_weekly_progress AS (
  SELECT
    obj.cycle_id,
    obj.organization_id,
    kwp.week_start,
    kwp.week_number,
    COALESCE(AVG(kwp.kr_progress), 0) AS obj_progress,
    SUM(kwp.checkin_count_in_week)     AS checkin_count
  FROM objectives obj
  JOIN kr_weekly_progress kwp ON kwp.objective_id = obj.id
  WHERE obj.deleted_at IS NULL
  GROUP BY obj.cycle_id, obj.organization_id, kwp.week_start, kwp.week_number
)
SELECT
  cycle_id,
  organization_id,
  week_number,
  week_start,
  ROUND(COALESCE(AVG(obj_progress), 0)::numeric, 2) AS avg_progress,
  COALESCE(SUM(checkin_count), 0)::bigint            AS checkin_count
FROM obj_weekly_progress
GROUP BY cycle_id, organization_id, week_number, week_start
ORDER BY cycle_id, week_number;

GRANT SELECT ON v_weekly_trend TO okr_user;


-- ----------------------------------------------------------------
-- VISTA: v_executive_dashboard (corregida)
-- Bug: confidence < 0.5 (debe ser < 0.4 para coincidir con v_at_risk_krs)
--      NULL checkin_at evaluaba a NULL en lugar de TRUE (KR sin checkin = at_risk)
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
        kr.confidence < 0.4
        OR kr.status IN ('AT_RISK', 'BEHIND')
        OR COALESCE(kr.last_checkin_at, '1900-01-01'::timestamptz)
             < CURRENT_TIMESTAMP - INTERVAL '14 days'
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
        'kr_id',           kr.id,
        'kr_code',         kr.code,
        'kr_title',        kr.title,
        'obj_code',        o.code,
        'objective_title', o.title,
        'confidence',      kr.confidence,
        'progress',        ROUND(
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
        'level',           o.level
      )
      ORDER BY kr.confidence ASC NULLS LAST
    ) AS krs_json
  FROM (
    SELECT
      kr.id, kr.code, kr.title, kr.confidence, kr.type,
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

GRANT SELECT ON v_executive_dashboard TO okr_user;


-- ----------------------------------------------------------------
-- VISTA: v_cycle_health (corregida)
-- Bug 1: at_risk_krs usaba confidence < 0.5 (debe ser < 0.4)
--         y no contaba KRs con NULL last_checkin como at_risk
-- Bug 2: projected_close_date = start + (duration × progress%) → fecha en el pasado
--         Corrección: velocidad actual → proyección futura real
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
    COUNT(kr.id)                                              AS total_krs,
    COUNT(kr.id) FILTER (WHERE kr.status = 'COMPLETED')       AS completed_krs,
    COUNT(kr.id) FILTER (
      WHERE (
        kr.confidence < 0.4
        OR kr.status IN ('AT_RISK', 'BEHIND')
        OR COALESCE(kr.last_checkin_at, '1900-01-01'::timestamptz)
             < NOW() - INTERVAL '14 days'
      )
      AND kr.status NOT IN ('COMPLETED','CANCELLED')
    )                                                         AS at_risk_krs,
    AVG(kr.confidence) FILTER (WHERE kr.status = 'ACTIVE')    AS avg_confidence
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
  COUNT(op.objective_id) FILTER (WHERE op.status = 'DRAFT')    AS draft_count,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'ACTIVE')   AS active_count,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'COMPLETED') AS completed_count,
  COUNT(op.objective_id) FILTER (WHERE op.status = 'CANCELLED') AS cancelled_count,
  COALESCE(ks.total_krs, 0)::bigint                            AS total_krs,
  COALESCE(ks.completed_krs, 0)::bigint                        AS completed_krs,
  COALESCE(ks.at_risk_krs, 0)::bigint                          AS at_risk_krs,
  ROUND(COALESCE(ks.avg_confidence, 0)::numeric, 4)            AS avg_confidence,
  ROUND(COALESCE(fn_get_cycle_score(c.id), 0)::numeric, 2)     AS cycle_score,
  ROUND(
    COALESCE(
      AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'),
      0
    )::numeric,
    2
  )                                                            AS avg_progress,
  -- Proyección velocity-based: si seguimos al ritmo actual, ¿cuándo termina?
  -- Fórmula: CURRENT_DATE + (elapsed_days × remaining% / current%)
  CASE
    WHEN c.status = 'ACTIVE'
      AND COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 0) > 0
      AND CURRENT_DATE > c.start_date
    THEN
      LEAST(
        (c.end_date + INTERVAL '365 days')::date,
        (
          CURRENT_DATE + (
            (CURRENT_DATE - c.start_date)::numeric
            * (100.0 - COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 0))
            / GREATEST(COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 1), 0.01)
          )::integer
        )
      )
    ELSE NULL
  END                                                          AS projected_close_date
FROM cycles c
LEFT JOIN obj_progress op ON op.cycle_id = c.id
LEFT JOIN kr_stats ks     ON ks.cycle_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.organization_id, c.name, c.status, c.start_date, c.end_date,
         ks.total_krs, ks.completed_krs, ks.at_risk_krs, ks.avg_confidence;

GRANT SELECT ON v_cycle_health TO okr_user;
