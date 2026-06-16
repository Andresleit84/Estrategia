-- Migration 051b: Fix view recreation (DROP required to add new columns)

-- ─── Drop dependent views first ──────────────────────────────────────────────

DROP VIEW IF EXISTS v_sector_assessment_detail;
DROP VIEW IF EXISTS v_sector_assessments;

-- ─── Recreate v_sector_assessments with session_id ───────────────────────────

CREATE VIEW v_sector_assessments AS
SELECT
  sa.id,
  sa.organization_id,
  sa.session_id,
  sa.created_by,
  sa.title,
  sa.engagement_type,
  sa.status,
  sa.notes,
  sa.completed_at,
  sa.created_at,
  sa.updated_at,
  u.name AS created_by_name,
  ROUND(
    (COUNT(ts.id) FILTER (WHERE ts.overall_score IS NOT NULL)::NUMERIC / 8) * 100
  ) AS completion_pct,
  ROUND(
    AVG(ts.overall_score) FILTER (WHERE ts.overall_score IS NOT NULL), 1
  ) AS avg_score,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'threat_key',    ts2.threat_key,
          'overall_score', ts2.overall_score,
          'benchmark',     ts2.benchmark
        ) ORDER BY ts2.threat_key
      )
      FROM threat_scores ts2
      WHERE ts2.assessment_id = sa.id
    ),
    '[]'::jsonb
  ) AS threat_scores
FROM sector_assessments sa
LEFT JOIN threat_scores ts ON ts.assessment_id = sa.id
LEFT JOIN users u ON u.id = sa.created_by
WHERE sa.deleted_at IS NULL
GROUP BY sa.id, u.name;

-- ─── Recreate v_sector_assessment_detail with session_id ─────────────────────

CREATE VIEW v_sector_assessment_detail AS
SELECT
  sa.id,
  sa.organization_id,
  sa.session_id,
  sa.created_by,
  sa.title,
  sa.engagement_type,
  sa.status,
  sa.notes,
  sa.completed_at,
  sa.created_at,
  sa.updated_at,
  u.name AS created_by_name,
  ROUND(
    (COUNT(ts.id) FILTER (WHERE ts.overall_score IS NOT NULL)::NUMERIC / 8) * 100
  ) AS completion_pct,
  ROUND(
    AVG(ts.overall_score) FILTER (WHERE ts.overall_score IS NOT NULL), 1
  ) AS avg_score,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            ts2.id,
          'threat_key',    ts2.threat_key,
          'overall_score', ts2.overall_score,
          'benchmark',     ts2.benchmark,
          'evidence',      ts2.evidence,
          'ai_insights',   ts2.ai_insights,
          'updated_at',    ts2.updated_at,
          'dimensions',    COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id',            tds.id,
                  'dimension_key', tds.dimension_key,
                  'score',         tds.score,
                  'notes',         tds.notes
                ) ORDER BY tds.dimension_key
              )
              FROM threat_dimension_scores tds
              WHERE tds.threat_score_id = ts2.id
            ),
            '[]'::jsonb
          )
        ) ORDER BY ts2.threat_key
      )
      FROM threat_scores ts2
      WHERE ts2.assessment_id = sa.id
    ),
    '[]'::jsonb
  ) AS threat_scores
FROM sector_assessments sa
LEFT JOIN threat_scores ts ON ts.assessment_id = sa.id
LEFT JOIN users u ON u.id = sa.created_by
WHERE sa.deleted_at IS NULL
GROUP BY sa.id, u.name;

-- ─── Sessions list view (avg_score calculated inline) ─────────────────────────

CREATE OR REPLACE VIEW v_sector_sessions AS
SELECT
  s.id,
  s.organization_id,
  s.name,
  s.period_label,
  s.status,
  s.calibrated_scores,
  s.ai_plan,
  s.created_at,
  s.updated_at,
  u.name AS created_by_name,
  COUNT(a.id) AS total_assessments,
  COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') AS completed_assessments,
  ROUND(
    (
      SELECT AVG(ts.overall_score)
      FROM threat_scores ts
      JOIN sector_assessments sa2 ON sa2.id = ts.assessment_id
      WHERE sa2.session_id = s.id
        AND sa2.deleted_at IS NULL
        AND sa2.status = 'COMPLETED'
        AND ts.overall_score IS NOT NULL
    )::NUMERIC,
    1
  ) AS avg_score
FROM sector_assessment_sessions s
LEFT JOIN users u ON u.id = s.created_by
LEFT JOIN sector_assessments a ON a.session_id = s.id AND a.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, u.name;

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT ON v_sector_assessments TO okr_user;
GRANT SELECT ON v_sector_assessment_detail TO okr_user;
GRANT SELECT ON v_sector_sessions TO okr_user;
