-- Migration 088: Fix cycle_score and avg_confidence in reports
--
-- Bug 1: fn_get_cycle_score filters only COMPANY-level objectives.
--        Quarterly cycles (Q2 2026) have only TEAM objectives → score = 0.
--        Fix: fallback to ALL objectives when cycle has no COMPANY ones.
--
-- Bug 2: v_cycle_health and v_team_health filter avg_confidence/cadence by
--        kr.status = 'ACTIVE', but KR statuses are ON_TRACK/AT_RISK/BEHIND/
--        COMPLETED/CANCELLED — never 'ACTIVE'. All confidence = 0.
--        Fix: use NOT IN ('COMPLETED','CANCELLED') instead.

-- ── Fix 1: fn_get_cycle_score ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_cycle_score(p_cycle_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_avg          NUMERIC;
  v_company_count INT;
BEGIN
  -- Count COMPANY-level objectives in this cycle
  SELECT COUNT(*) INTO v_company_count
  FROM objectives
  WHERE cycle_id = p_cycle_id
    AND level = 'COMPANY'
    AND deleted_at IS NULL
    AND status NOT IN ('CANCELLED');

  IF v_company_count > 0 THEN
    -- Use COMPANY objectives (strategic view)
    SELECT AVG(fn_calculate_objective_progress(o.id)) INTO v_avg
    FROM objectives o
    WHERE o.cycle_id = p_cycle_id
      AND o.level    = 'COMPANY'
      AND o.deleted_at IS NULL
      AND o.status NOT IN ('CANCELLED');
  ELSE
    -- No COMPANY objectives — use all active objectives (tactical cycles)
    SELECT AVG(fn_calculate_objective_progress(o.id)) INTO v_avg
    FROM objectives o
    WHERE o.cycle_id = p_cycle_id
      AND o.deleted_at IS NULL
      AND o.status NOT IN ('CANCELLED');
  END IF;

  RETURN ROUND(COALESCE(v_avg, 0.0), 2);
END;
$$;

-- ── Fix 2: v_cycle_health — avg_confidence filter ────────────────────────────

CREATE OR REPLACE VIEW v_cycle_health AS
WITH obj_progress AS (
  SELECT o.cycle_id,
         o.id     AS objective_id,
         o.status,
         fn_calculate_objective_progress(o.id) AS progress
  FROM objectives o
  WHERE o.deleted_at IS NULL
),
kr_stats AS (
  SELECT o.cycle_id,
         COUNT(kr.id) AS total_krs,
         COUNT(kr.id) FILTER (WHERE kr.status = 'COMPLETED') AS completed_krs,
         COUNT(kr.id) FILTER (
           WHERE (kr.confidence < 0.4
                  OR kr.status IN ('AT_RISK','BEHIND')
                  OR COALESCE(kr.last_checkin_at, '1900-01-01'::timestamptz) < NOW() - INTERVAL '14 days')
             AND kr.status NOT IN ('COMPLETED','CANCELLED')
         ) AS at_risk_krs,
         AVG(kr.confidence) FILTER (
           WHERE kr.status NOT IN ('COMPLETED','CANCELLED')
         ) AS avg_confidence
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.deleted_at IS NULL AND o.deleted_at IS NULL
  GROUP BY o.cycle_id
)
SELECT c.id                                                              AS cycle_id,
       c.organization_id,
       c.name                                                            AS cycle_name,
       c.status                                                          AS cycle_status,
       c.start_date,
       c.end_date,
       COUNT(op.objective_id)                                            AS total_objectives,
       COUNT(op.objective_id) FILTER (WHERE op.status = 'DRAFT')        AS draft_count,
       COUNT(op.objective_id) FILTER (WHERE op.status = 'ACTIVE')       AS active_count,
       COUNT(op.objective_id) FILTER (WHERE op.status = 'COMPLETED')    AS completed_count,
       COUNT(op.objective_id) FILTER (WHERE op.status = 'CANCELLED')    AS cancelled_count,
       COALESCE(ks.total_krs,     0)                                     AS total_krs,
       COALESCE(ks.completed_krs, 0)                                     AS completed_krs,
       COALESCE(ks.at_risk_krs,   0)                                     AS at_risk_krs,
       ROUND(COALESCE(ks.avg_confidence, 0), 4)                          AS avg_confidence,
       ROUND(COALESCE(fn_get_cycle_score(c.id), 0), 2)                   AS cycle_score,
       ROUND(COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 0), 2) AS avg_progress,
       CASE
         WHEN c.status = 'ACTIVE'
              AND COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 0) > 0
              AND CURRENT_DATE > c.start_date
         THEN LEAST(
           (c.end_date + INTERVAL '365 days')::date,
           CURRENT_DATE + (
             (CURRENT_DATE - c.start_date)::numeric
             * (100.0 - COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 0))
             / GREATEST(COALESCE(AVG(op.progress) FILTER (WHERE op.status = 'ACTIVE'), 1), 0.01)
           )::integer
         )
         ELSE NULL
       END AS projected_close_date
FROM cycles c
LEFT JOIN obj_progress op ON op.cycle_id = c.id
LEFT JOIN kr_stats     ks ON ks.cycle_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.organization_id, c.name, c.status, c.start_date, c.end_date,
         ks.total_krs, ks.completed_krs, ks.at_risk_krs, ks.avg_confidence;

-- ── Fix 3: v_team_health — avg_confidence, at_risk_count, cadence_score ─────

CREATE OR REPLACE VIEW v_team_health AS
WITH team_objectives AS (
  SELECT o.organization_id,
         o.cycle_id,
         o.team_id,
         o.id AS objective_id,
         fn_calculate_objective_progress(o.id) AS progress
  FROM objectives o
  WHERE o.deleted_at IS NULL AND o.status = 'ACTIVE' AND o.team_id IS NOT NULL
),
team_kr_stats AS (
  SELECT o.organization_id,
         o.cycle_id,
         o.team_id,
         AVG(kr.confidence) FILTER (
           WHERE kr.status NOT IN ('COMPLETED','CANCELLED')
         ) AS avg_confidence,
         COUNT(kr.id) FILTER (
           WHERE kr.confidence < 0.5
             AND kr.status NOT IN ('COMPLETED','CANCELLED')
         ) AS at_risk_count,
         ROUND(
           100.0
           * COUNT(kr.id) FILTER (
               WHERE kr.status NOT IN ('COMPLETED','CANCELLED')
                 AND EXISTS (
                   SELECT 1 FROM check_ins ci
                   WHERE ci.kr_id = kr.id
                     AND ci.checked_at >= NOW() - INTERVAL '7 days'
                 )
             )::numeric
           / NULLIF(COUNT(kr.id) FILTER (
               WHERE kr.status NOT IN ('COMPLETED','CANCELLED')
             )::numeric, 0),
           2
         ) AS cadence_score
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.deleted_at IS NULL AND o.deleted_at IS NULL
    AND o.status = 'ACTIVE' AND o.team_id IS NOT NULL
  GROUP BY o.organization_id, o.cycle_id, o.team_id
)
SELECT to_.organization_id,
       to_.cycle_id,
       to_.team_id,
       t.name                                                       AS team_name,
       COUNT(to_.objective_id)                                      AS objective_count,
       ROUND(COALESCE(AVG(to_.progress), 0), 2)                    AS avg_progress,
       ROUND(COALESCE(tks.avg_confidence, 0), 4)                   AS avg_confidence,
       COALESCE(tks.cadence_score, 0)                              AS cadence_score,
       COALESCE(tks.at_risk_count, 0)                              AS at_risk_count
FROM team_objectives to_
JOIN teams t ON t.id = to_.team_id
LEFT JOIN team_kr_stats tks
       ON tks.organization_id = to_.organization_id
      AND tks.cycle_id        = to_.cycle_id
      AND tks.team_id         = to_.team_id
GROUP BY to_.organization_id, to_.cycle_id, to_.team_id, t.name,
         tks.avg_confidence, tks.cadence_score, tks.at_risk_count;
