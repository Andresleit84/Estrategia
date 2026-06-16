-- Migration 050: Sector Assessment Consolidation
-- fn_sector_consolidation(p_org_id UUID) → JSONB
-- sector_consolidation_plans table for persisted AI plans

CREATE TABLE IF NOT EXISTS sector_consolidation_plans (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ai_plan          JSONB       NOT NULL,
  assessment_count INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consolidation_plans_org
  ON sector_consolidation_plans(organization_id, created_at DESC);

GRANT SELECT, INSERT ON sector_consolidation_plans TO okr_user;

-- ─── fn_sector_consolidation ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_sector_consolidation(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_meta    JSONB;
  v_threats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_assessments', COUNT(*),
    'completed_count',   COUNT(*) FILTER (WHERE sa.status = 'COMPLETED'),
    'earliest_date',     MIN(sa.created_at),
    'latest_date',       MAX(sa.created_at)
  )
  INTO v_meta
  FROM sector_assessments sa
  WHERE sa.organization_id = p_org_id
    AND sa.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'threat_key',      agg.threat_key,
      'avg_score',       agg.avg_score,
      'min_score',       agg.min_score,
      'max_score',       agg.max_score,
      'stddev',          agg.stddev_score,
      'count',           agg.cnt,
      'consensus_level', CASE
        WHEN agg.stddev_score IS NULL OR agg.stddev_score <= 0.5 THEN 'HIGH'
        WHEN agg.stddev_score <= 1.0 THEN 'MEDIUM'
        ELSE 'LOW'
      END,
      'scores', agg.scores
    )
  ), '[]'::JSONB)
  INTO v_threats
  FROM (
    SELECT
      ts.threat_key,
      ROUND(AVG(ts.overall_score)::NUMERIC, 2)    AS avg_score,
      MIN(ts.overall_score)                        AS min_score,
      MAX(ts.overall_score)                        AS max_score,
      ROUND(STDDEV(ts.overall_score)::NUMERIC, 2) AS stddev_score,
      COUNT(*)                                     AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'assessment_id',    sa.id,
          'assessment_title', sa.title,
          'score',            ts.overall_score,
          'benchmark',        ts.benchmark,
          'engagement_type',  sa.engagement_type,
          'assessed_at',      sa.created_at,
          'assessor_name',    u.name
        )
        ORDER BY sa.created_at ASC
      ) AS scores
    FROM threat_scores ts
    JOIN sector_assessments sa ON sa.id = ts.assessment_id
    LEFT JOIN users u ON u.id = sa.created_by
    WHERE sa.organization_id = p_org_id
      AND sa.deleted_at IS NULL
      AND sa.status = 'COMPLETED'
      AND ts.overall_score IS NOT NULL
    GROUP BY ts.threat_key
  ) agg;

  RETURN jsonb_build_object(
    'meta',    v_meta,
    'threats', COALESCE(v_threats, '[]'::JSONB)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_sector_consolidation(UUID) TO okr_user;
