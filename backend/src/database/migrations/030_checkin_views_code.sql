-- Migración 030 — Añade kr_code y obj_code a v_at_risk_krs y v_cadence_dashboard
-- Usa DROP + CREATE para evitar restricción de orden de columnas en CREATE OR REPLACE VIEW
-- También asegura que la columna code exista en ambas tablas

ALTER TABLE key_results ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE objectives   ADD COLUMN IF NOT EXISTS code TEXT;

DROP VIEW IF EXISTS v_at_risk_krs;
CREATE VIEW v_at_risk_krs AS
SELECT
  kr.id,
  kr.title              AS kr_title,
  kr.metric_unit,
  kr.current_value,
  kr.target_value,
  kr.progress,
  kr.confidence,
  kr.status,
  kr.last_checkin_at,
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INTEGER, 999) AS days_since_checkin,
  kr.owner_id,
  u.name                AS owner_name,
  o.id                  AS objective_id,
  o.title               AS objective_title,
  o.level               AS objective_level,
  o.organization_id,
  c.id                  AS cycle_id,
  kr.code               AS kr_code,
  o.code                AS obj_code
FROM key_results kr
JOIN objectives  o ON kr.objective_id = o.id
JOIN cycles      c ON o.cycle_id      = c.id
LEFT JOIN users  u ON kr.owner_id     = u.id
WHERE kr.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND c.status = 'ACTIVE'
  AND kr.status NOT IN ('COMPLETED', 'CANCELLED')
  AND (
        (kr.last_checkin_at IS NULL AND kr.created_at < NOW() - INTERVAL '7 days')
     OR kr.last_checkin_at < NOW() - INTERVAL '14 days'
     OR kr.confidence < 0.4
     OR kr.status IN ('AT_RISK', 'BEHIND')
  )
ORDER BY
  CASE o.level
    WHEN 'COMPANY'    THEN 1
    WHEN 'AREA'       THEN 2
    WHEN 'TEAM'       THEN 3
    ELSE 4
  END,
  kr.confidence,
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INTEGER, 999) DESC;

GRANT SELECT ON v_at_risk_krs TO okr_user;


DROP VIEW IF EXISTS v_cadence_dashboard;
CREATE VIEW v_cadence_dashboard AS
SELECT
  kr.id               AS kr_id,
  kr.title            AS kr_title,
  kr.metric_unit,
  kr.progress,
  kr.confidence,
  kr.status,
  kr.last_checkin_at,
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INTEGER, 999) AS days_since_checkin,
  kr.owner_id,
  u.name              AS owner_name,
  u.email             AS owner_email,
  o.id                AS objective_id,
  o.title             AS objective_title,
  o.level             AS objective_level,
  o.organization_id,
  o.cycle_id,
  o.team_id,
  t.name              AS team_name,
  kr.code             AS kr_code,
  o.code              AS obj_code
FROM key_results kr
JOIN objectives  o  ON kr.objective_id = o.id
LEFT JOIN users  u  ON kr.owner_id     = u.id
LEFT JOIN teams  t  ON o.team_id       = t.id
WHERE kr.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND kr.status <> 'CANCELLED'
ORDER BY
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INTEGER, 999) DESC,
  o.level,
  kr.progress;

GRANT SELECT ON v_cadence_dashboard TO okr_user;
