-- Migration 090: board_sessions — sesiones mensuales del Pulso OKR del Consejo

-- ── 1. Tabla board_sessions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id         UUID        NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  session_date     DATE        NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT','PREPARING','READY','PRESENTED','CLOSED')),
  chair            TEXT,
  secretary        TEXT,
  director_notes   TEXT,
  meeting_notes    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_sessions_org_cycle ON board_sessions(organization_id, cycle_id);

-- ── 2. Ampliar board_decisions ────────────────────────────────────────────────

ALTER TABLE board_decisions
  ADD COLUMN IF NOT EXISTS board_session_id UUID REFERENCES board_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_note   TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_board_decisions_session ON board_decisions(board_session_id);

-- ── 3. Ampliar board_guardrails ───────────────────────────────────────────────

ALTER TABLE board_guardrails
  ADD COLUMN IF NOT EXISTS last_updated_note TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- ── 4. SP: crear sesión ────────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_board_session(
  p_org_id       UUID,
  p_cycle_id     UUID,
  p_session_date DATE,
  p_chair        TEXT,
  p_secretary    TEXT,
  INOUT p_out_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO board_sessions(organization_id, cycle_id, session_date, chair, secretary)
  VALUES (p_org_id, p_cycle_id, p_session_date, p_chair, p_secretary)
  RETURNING id INTO p_out_id;
END;
$$;

-- ── 5. SP: actualizar sesión ───────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_update_board_session(
  p_org_id         UUID,
  p_id             UUID,
  p_status         TEXT,
  p_session_date   DATE,
  p_chair          TEXT,
  p_secretary      TEXT,
  p_director_notes TEXT,
  p_meeting_notes  TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE board_sessions SET
    status         = COALESCE(p_status,         status),
    session_date   = COALESCE(p_session_date,   session_date),
    chair          = COALESCE(p_chair,          chair),
    secretary      = COALESCE(p_secretary,      secretary),
    director_notes = p_director_notes,
    meeting_notes  = p_meeting_notes,
    updated_at     = NOW()
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 6. SP: eliminar sesión ─────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_delete_board_session(
  p_org_id UUID,
  p_id     UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM board_sessions WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 7. SP: actualizar guardrail status (inline quick update) ──────────────────

CREATE OR REPLACE PROCEDURE sp_update_guardrail_status(
  p_org_id   UUID,
  p_id       UUID,
  p_status   TEXT,
  p_trend    TEXT,
  p_note     TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE board_guardrails SET
    status             = COALESCE(p_status, status),
    trend              = COALESCE(p_trend,  trend),
    last_updated_note  = p_note,
    status_updated_at  = NOW(),
    updated_at         = NOW()
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 8. SP: vincular decisión a sesión ─────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_link_decision_to_session(
  p_org_id     UUID,
  p_id         UUID,
  p_session_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE board_decisions
  SET board_session_id = p_session_id, updated_at = NOW()
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 9. SP: actualizar follow-up de decisión ───────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_update_decision_followup(
  p_org_id              UUID,
  p_id                  UUID,
  p_follow_up_note      TEXT,
  p_follow_up_verified  BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE board_decisions SET
    follow_up_note     = p_follow_up_note,
    follow_up_verified = COALESCE(p_follow_up_verified, follow_up_verified),
    updated_at         = NOW()
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 10. Vista v_board_sessions ────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_board_sessions AS
SELECT
  bs.id,
  bs.organization_id,
  bs.cycle_id,
  c.name            AS cycle_name,
  c.type            AS cycle_type,
  c.status          AS cycle_status,
  c.start_date      AS cycle_start,
  c.end_date        AS cycle_end,
  bs.session_date,
  bs.status,
  bs.chair,
  bs.secretary,
  bs.director_notes,
  bs.meeting_notes,
  bs.created_at,
  bs.updated_at,
  (SELECT COUNT(*) FROM board_decisions bd
   WHERE bd.board_session_id = bs.id) AS decisions_count,
  (SELECT COUNT(*) FROM board_decisions bd
   WHERE bd.board_session_id = bs.id AND bd.status = 'PENDING') AS pending_decisions
FROM board_sessions bs
JOIN cycles c ON c.id = bs.cycle_id;

-- ── 11. Vista v_cycle_krs_with_critical ────────────────────────────────────────

CREATE OR REPLACE VIEW v_cycle_krs_with_critical AS
SELECT
  kr.id,
  kr.code,
  kr.title,
  kr.is_critical,
  kr.status,
  ROUND(kr.confidence::NUMERIC * 100, 1) AS confidence_pct,
  ROUND(CASE
    WHEN kr.target_value = kr.start_value THEN 0
    ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100
  END::NUMERIC, 1)                        AS progress,
  o.id          AS objective_id,
  o.code        AS objective_code,
  o.title       AS objective_title,
  o.level       AS objective_level,
  o.cycle_id,
  o.organization_id
FROM key_results kr
JOIN objectives o ON o.id = kr.objective_id
WHERE o.deleted_at IS NULL AND kr.deleted_at IS NULL;

GRANT SELECT ON v_board_sessions TO okr_user;
GRANT SELECT ON v_cycle_krs_with_critical TO okr_user;
GRANT ALL ON board_sessions TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_create_board_session(UUID,UUID,DATE,TEXT,TEXT,UUID) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_update_board_session(UUID,UUID,TEXT,DATE,TEXT,TEXT,TEXT,TEXT) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_delete_board_session(UUID,UUID) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_update_guardrail_status(UUID,UUID,TEXT,TEXT,TEXT) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_link_decision_to_session(UUID,UUID,UUID) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_update_decision_followup(UUID,UUID,TEXT,BOOLEAN) TO okr_user;
