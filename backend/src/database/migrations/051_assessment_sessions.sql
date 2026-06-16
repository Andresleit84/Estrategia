-- Migration 051: Assessment Sessions (Períodos de diagnóstico)
-- Groups multiple individual assessments under a session/period
-- Adds calibration + session-level AI plan
-- Removes AI from individual assessments

-- ─── deleted_at on sector_assessments (needed by existing functions) ──────────

ALTER TABLE sector_assessments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── Sessions table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sector_assessment_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL CHECK (char_length(name) BETWEEN 3 AND 200),
  period_label      TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'OPEN'
                                  CHECK (status IN ('OPEN','COMPLETED')),
  calibrated_scores JSONB,
  ai_plan           JSONB,
  created_by        UUID        REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sector_sessions_org
  ON sector_assessment_sessions(organization_id, created_at DESC);

-- ─── Link assessments to sessions ────────────────────────────────────────────

ALTER TABLE sector_assessments
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES sector_assessment_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sector_assessments_session
  ON sector_assessments(session_id)
  WHERE session_id IS NOT NULL;

-- ─── Update sp_create_sector_assessment to accept session_id ─────────────────

CREATE OR REPLACE PROCEDURE sp_create_sector_assessment(
  p_org_id          UUID,
  p_user_id         UUID,
  p_title           TEXT,
  p_engagement_type TEXT,
  INOUT p_id        UUID,
  p_session_id      UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sector_assessments (organization_id, created_by, title, engagement_type, session_id)
  VALUES (p_org_id, p_user_id, p_title, COALESCE(p_engagement_type, 'DIAGNOSTIC'), p_session_id)
  RETURNING id INTO p_id;
END;
$$;

-- ─── Recreate views with session_id ──────────────────────────────────────────

CREATE OR REPLACE VIEW v_sector_assessments AS
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

CREATE OR REPLACE VIEW v_sector_assessment_detail AS
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

-- ─── Sessions list view ───────────────────────────────────────────────────────

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
  u.name    AS created_by_name,
  COUNT(a.id) AS total_assessments,
  COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') AS completed_assessments,
  ROUND(
    AVG(a.avg_score) FILTER (WHERE a.status = 'COMPLETED')::NUMERIC, 1
  ) AS avg_score
FROM sector_assessment_sessions s
LEFT JOIN users u ON u.id = s.created_by
LEFT JOIN sector_assessments a ON a.session_id = s.id AND a.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, u.name;

-- ─── fn_session_consolidation ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_session_consolidation(p_session_id UUID, p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_session RECORD;
  v_meta    JSONB;
  v_threats JSONB;
BEGIN
  SELECT s.id, s.name, s.period_label, s.status, s.calibrated_scores
  INTO v_session
  FROM sector_assessment_sessions s
  WHERE s.id = p_session_id
    AND s.organization_id = p_org_id
    AND s.deleted_at IS NULL;

  IF NOT FOUND THEN RETURN '{}'::JSONB; END IF;

  SELECT jsonb_build_object(
    'total_assessments', COUNT(*),
    'completed_count',   COUNT(*) FILTER (WHERE sa.status = 'COMPLETED'),
    'earliest_date',     MIN(sa.created_at),
    'latest_date',       MAX(sa.created_at)
  )
  INTO v_meta
  FROM sector_assessments sa
  WHERE sa.session_id = p_session_id AND sa.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'threat_key',       agg.threat_key,
      'avg_score',        agg.avg_score,
      'min_score',        agg.min_score,
      'max_score',        agg.max_score,
      'stddev',           agg.stddev_score,
      'count',            agg.cnt,
      'consensus_level',  CASE
        WHEN agg.stddev_score IS NULL OR agg.stddev_score <= 0.5 THEN 'HIGH'
        WHEN agg.stddev_score <= 1.0 THEN 'MEDIUM'
        ELSE 'LOW'
      END,
      'calibrated_score', CASE
        WHEN v_session.calibrated_scores IS NOT NULL
          THEN (v_session.calibrated_scores->>(agg.threat_key))::NUMERIC
        ELSE NULL
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
    WHERE sa.session_id = p_session_id
      AND sa.deleted_at IS NULL
      AND sa.status = 'COMPLETED'
      AND ts.overall_score IS NOT NULL
    GROUP BY ts.threat_key
  ) agg;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id',               v_session.id,
      'name',             v_session.name,
      'period_label',     v_session.period_label,
      'status',           v_session.status,
      'calibrated_scores', v_session.calibrated_scores
    ),
    'meta',    v_meta,
    'threats', COALESCE(v_threats, '[]'::JSONB)
  );
END;
$$;

-- ─── Session procedures ───────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_sector_session(
  p_org_id      UUID,
  p_user_id     UUID,
  p_name        TEXT,
  p_period      TEXT,
  INOUT p_id    UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sector_assessment_sessions (organization_id, created_by, name, period_label)
  VALUES (p_org_id, p_user_id, p_name, p_period)
  RETURNING id INTO p_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_calibrate_session(
  p_session_id UUID,
  p_org_id     UUID,
  p_scores     JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sector_assessment_sessions
     SET calibrated_scores = p_scores,
         updated_at        = NOW()
   WHERE id = p_session_id
     AND organization_id = p_org_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ─── Updated-at trigger for sessions ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at_sector_session()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sector_session_updated_at ON sector_assessment_sessions;
CREATE TRIGGER trg_sector_session_updated_at
  BEFORE UPDATE ON sector_assessment_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_sector_session();

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON sector_assessment_sessions TO okr_user;
GRANT SELECT ON v_sector_sessions TO okr_user;
GRANT EXECUTE ON FUNCTION fn_session_consolidation(UUID, UUID) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_create_sector_session(UUID, UUID, TEXT, TEXT, UUID) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_calibrate_session(UUID, UUID, JSONB) TO okr_user;
