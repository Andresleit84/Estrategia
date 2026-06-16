-- 073 — KR refs_data JSONB field + view rebuild
-- Stores cascade links, FODA, SUGEF, and dependency references per KR
-- Structure: { links_down: {annual, quarterly}, links_up, foda, sugef, deps }

ALTER TABLE key_results ADD COLUMN IF NOT EXISTS refs_data JSONB;

-- Rebuild view to include all new fields from migrations 072 and 073
DROP VIEW IF EXISTS v_key_results_with_trend CASCADE;
CREATE VIEW v_key_results_with_trend AS
WITH trend_calc AS (
  SELECT ci.kr_id,
    MAX(CASE WHEN ci.rn = 1 THEN ci.current_value END) AS latest,
    MAX(CASE WHEN ci.rn = 2 THEN ci.current_value END) AS prev,
    COUNT(*) AS total_checkins
  FROM (
    SELECT check_ins.kr_id, check_ins.current_value,
      ROW_NUMBER() OVER (PARTITION BY check_ins.kr_id ORDER BY check_ins.checked_at DESC) AS rn
    FROM check_ins
  ) ci
  WHERE ci.rn <= 3
  GROUP BY ci.kr_id
)
SELECT
  kr.id, kr.objective_id, kr.owner_id, kr.team_id,
  kr.title, kr.description, kr.type,
  kr.kr_category, kr.kpi_description, kr.gap_note, kr.recommendation, kr.refs_data,
  kr.metric_unit, kr.start_value, kr.target_value, kr.current_value,
  kr.confidence, kr.progress, kr.status, kr.last_checkin_at,
  kr.created_by, kr.created_at, kr.updated_at, kr.deleted_at, kr.completed_at,
  kr.code, kr.check_in_cadence,
  fn_cadence_days(kr.check_in_cadence) AS cadence_days,
  u.name  AS owner_name,
  u.email AS owner_email,
  t.name  AS team_name,
  COALESCE(
    CASE
      WHEN tc.total_checkins < 2 THEN 'flat'
      WHEN tc.latest > tc.prev   THEN 'up'
      WHEN tc.latest < tc.prev   THEN 'down'
      ELSE 'flat'
    END, 'flat'
  ) AS trend,
  COALESCE(tc.total_checkins, 0)::INTEGER AS checkin_count
FROM key_results kr
LEFT JOIN users      u  ON kr.owner_id = u.id
LEFT JOIN teams      t  ON kr.team_id  = t.id
LEFT JOIN trend_calc tc ON tc.kr_id    = kr.id
WHERE kr.deleted_at IS NULL;
