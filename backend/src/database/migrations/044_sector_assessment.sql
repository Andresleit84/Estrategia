-- Migration 044: Sector Assessment — 8 structural threats diagnostic module

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sector_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  engagement_type TEXT NOT NULL DEFAULT 'DIAGNOSTIC'
                    CHECK (engagement_type IN ('DIAGNOSTIC','ANNUAL_REVIEW','FOLLOWUP')),
  status          TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                    CHECK (status IN ('IN_PROGRESS','COMPLETED')),
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  UUID NOT NULL REFERENCES sector_assessments(id) ON DELETE CASCADE,
  threat_key     TEXT NOT NULL,
  overall_score  NUMERIC(3,1),
  benchmark      TEXT CHECK (benchmark IN ('BELOW','AT','ABOVE')),
  evidence       TEXT,
  ai_insights    TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, threat_key)
);

CREATE TABLE IF NOT EXISTS threat_dimension_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_score_id UUID NOT NULL REFERENCES threat_scores(id) ON DELETE CASCADE,
  dimension_key  TEXT NOT NULL,
  score          INTEGER CHECK (score BETWEEN 1 AND 5),
  notes          TEXT,
  UNIQUE (threat_score_id, dimension_key)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sector_assessments_org
  ON sector_assessments(organization_id);

CREATE INDEX IF NOT EXISTS idx_threat_scores_assessment
  ON threat_scores(assessment_id);

CREATE INDEX IF NOT EXISTS idx_threat_dimension_scores_threat
  ON threat_dimension_scores(threat_score_id);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at_sector_assessment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sector_assessment_updated_at ON sector_assessments;
CREATE TRIGGER trg_sector_assessment_updated_at
  BEFORE UPDATE ON sector_assessments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_sector_assessment();

-- ─── Views ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_sector_assessments AS
SELECT
  sa.id,
  sa.organization_id,
  sa.created_by,
  sa.title,
  sa.engagement_type,
  sa.status,
  sa.notes,
  sa.completed_at,
  sa.created_at,
  sa.updated_at,
  u.name AS created_by_name,
  -- completion_pct: threats that have an overall_score / 8 * 100
  ROUND(
    (COUNT(ts.id) FILTER (WHERE ts.overall_score IS NOT NULL)::NUMERIC / 8) * 100
  ) AS completion_pct,
  -- avg_score across scored threats
  ROUND(
    AVG(ts.overall_score) FILTER (WHERE ts.overall_score IS NOT NULL), 1
  ) AS avg_score,
  -- threat_scores summary as JSONB array
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
GROUP BY sa.id, u.name;

CREATE OR REPLACE VIEW v_sector_assessment_detail AS
SELECT
  sa.id,
  sa.organization_id,
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
GROUP BY sa.id, u.name;

-- ─── Procedures ───────────────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_sector_assessment(
  p_org_id         UUID,
  p_user_id        UUID,
  p_title          TEXT,
  p_engagement_type TEXT,
  INOUT p_id       UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sector_assessments (organization_id, created_by, title, engagement_type)
  VALUES (p_org_id, p_user_id, p_title, COALESCE(p_engagement_type, 'DIAGNOSTIC'))
  RETURNING id INTO p_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_update_threat_score(
  p_assessment_id UUID,
  p_threat_key    TEXT,
  p_overall_score NUMERIC,
  p_benchmark     TEXT,
  p_evidence      TEXT,
  p_ai_insights   TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
  v_score_id UUID;
  v_dim_avg  NUMERIC;
BEGIN
  INSERT INTO threat_scores (assessment_id, threat_key, overall_score, benchmark, evidence, ai_insights)
  VALUES (p_assessment_id, p_threat_key, p_overall_score, p_benchmark, p_evidence, p_ai_insights)
  ON CONFLICT (assessment_id, threat_key) DO UPDATE
    SET overall_score = EXCLUDED.overall_score,
        benchmark     = COALESCE(EXCLUDED.benchmark,     threat_scores.benchmark),
        evidence      = COALESCE(EXCLUDED.evidence,      threat_scores.evidence),
        ai_insights   = COALESCE(EXCLUDED.ai_insights,   threat_scores.ai_insights),
        updated_at    = NOW()
  RETURNING id INTO v_score_id;

  -- If dimension scores exist, recalculate overall_score as their average
  SELECT ROUND(AVG(score)::NUMERIC, 1)
    INTO v_dim_avg
    FROM threat_dimension_scores
   WHERE threat_score_id = v_score_id AND score IS NOT NULL;

  IF v_dim_avg IS NOT NULL THEN
    UPDATE threat_scores SET overall_score = v_dim_avg WHERE id = v_score_id;
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_upsert_dimension_scores(
  p_threat_score_id UUID,
  p_scores          JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
  v_item      JSONB;
  v_dim_avg   NUMERIC;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_scores)
  LOOP
    INSERT INTO threat_dimension_scores (threat_score_id, dimension_key, score, notes)
    VALUES (
      p_threat_score_id,
      v_item->>'dimension_key',
      (v_item->>'score')::INTEGER,
      v_item->>'notes'
    )
    ON CONFLICT (threat_score_id, dimension_key) DO UPDATE
      SET score = EXCLUDED.score,
          notes = COALESCE(EXCLUDED.notes, threat_dimension_scores.notes);
  END LOOP;

  -- Recalculate overall_score of parent threat_score
  SELECT ROUND(AVG(score)::NUMERIC, 1)
    INTO v_dim_avg
    FROM threat_dimension_scores
   WHERE threat_score_id = p_threat_score_id AND score IS NOT NULL;

  UPDATE threat_scores
     SET overall_score = v_dim_avg,
         updated_at    = NOW()
   WHERE id = p_threat_score_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_complete_assessment(
  p_assessment_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sector_assessments
     SET status       = 'COMPLETED',
         completed_at = NOW(),
         updated_at   = NOW()
   WHERE id = p_assessment_id;
END;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON sector_assessments         TO okr_user;
GRANT SELECT, INSERT, UPDATE ON threat_scores              TO okr_user;
GRANT SELECT, INSERT, UPDATE ON threat_dimension_scores    TO okr_user;
GRANT SELECT                 ON v_sector_assessments       TO okr_user;
GRANT SELECT                 ON v_sector_assessment_detail TO okr_user;
