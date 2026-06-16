-- Migration 057 — Add kr_code and obj_code to v_at_risk_krs and v_cadence_dashboard

-- ----------------------------------------------------------------
-- 1. v_at_risk_krs — add kr_code, obj_code
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_at_risk_krs CASCADE;
CREATE VIEW v_at_risk_krs AS
SELECT
  kr.id,
  kr.code               AS kr_code,
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
  o.code                AS obj_code,
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

-- ----------------------------------------------------------------
-- 2. v_cadence_dashboard — add kr_code, obj_code
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_cadence_dashboard CASCADE;
CREATE VIEW v_cadence_dashboard AS
SELECT
  kr.id                                                                       AS kr_id,
  kr.code                                                                     AS kr_code,
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
  o.code                                                                      AS obj_code,
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

GRANT SELECT ON v_at_risk_krs     TO okr_user;
GRANT SELECT ON v_cadence_dashboard TO okr_user;
