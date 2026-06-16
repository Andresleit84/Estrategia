-- Migration 052: Session Participants
-- Admin pre-defines who should complete the assessment in a session

CREATE TABLE IF NOT EXISTS sector_session_participants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES sector_assessment_sessions(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by    UUID        REFERENCES users(id),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ssp_session ON sector_session_participants(session_id);

-- ─── View: participant completion status ──────────────────────────────────────

CREATE OR REPLACE VIEW v_session_participant_status AS
SELECT
  ssp.id,
  ssp.session_id,
  ssp.user_id,
  u.name       AS user_name,
  u.email      AS user_email,
  u.avatar_url,
  sa.id        AS assessment_id,
  sa.status    AS assessment_status,
  COALESCE(sa.completion_pct, 0)::INT AS completion_pct,
  COALESCE(sa.status = 'COMPLETED', false) AS completed,
  ssp.added_at
FROM sector_session_participants ssp
JOIN users u ON u.id = ssp.user_id
LEFT JOIN LATERAL (
  SELECT a.id, a.status,
    ROUND((COUNT(ts.id) FILTER (WHERE ts.overall_score IS NOT NULL)::NUMERIC / 8) * 100) AS completion_pct
  FROM sector_assessments a
  LEFT JOIN threat_scores ts ON ts.assessment_id = a.id
  WHERE a.session_id = ssp.session_id
    AND a.created_by  = ssp.user_id
    AND a.deleted_at  IS NULL
  GROUP BY a.id
  ORDER BY (a.status = 'COMPLETED') DESC, a.created_at DESC
  LIMIT 1
) sa ON true;

-- ─── Procedures ───────────────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_add_session_participant(
  p_session_id UUID,
  p_user_id    UUID,
  p_added_by   UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO sector_session_participants (session_id, user_id, added_by)
  VALUES (p_session_id, p_user_id, p_added_by)
  ON CONFLICT (session_id, user_id) DO NOTHING;
END;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, DELETE ON sector_session_participants TO okr_user;
GRANT SELECT ON v_session_participant_status TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_add_session_participant(UUID, UUID, UUID) TO okr_user;
