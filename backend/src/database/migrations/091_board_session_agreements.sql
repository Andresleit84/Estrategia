-- Migration 091: board_session_agreements — acuerdos operativos de sesión del Consejo

-- ── 1. Tabla ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS board_session_agreements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_session_id UUID        NOT NULL REFERENCES board_sessions(id) ON DELETE CASCADE,
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  text             TEXT        NOT NULL,
  owner            TEXT,
  due_date         DATE,
  completed        BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bsa_session ON board_session_agreements(board_session_id);
CREATE INDEX IF NOT EXISTS idx_bsa_org     ON board_session_agreements(organization_id);

-- ── 2. SPs ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_upsert_board_agreement(
  p_id         UUID,
  p_session_id UUID,
  p_org_id     UUID,
  p_text       TEXT,
  p_owner      TEXT,
  p_due_date   DATE
) LANGUAGE plpgsql AS $$
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO board_session_agreements
      (board_session_id, organization_id, text, owner, due_date, sort_order)
    VALUES
      (p_session_id, p_org_id, p_text, p_owner, p_due_date,
       COALESCE((SELECT MAX(sort_order)+1 FROM board_session_agreements
                  WHERE board_session_id = p_session_id), 1));
  ELSE
    UPDATE board_session_agreements
    SET text       = p_text,
        owner      = p_owner,
        due_date   = p_due_date,
        updated_at = NOW()
    WHERE id = p_id AND organization_id = p_org_id;
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_toggle_board_agreement(
  p_id        UUID,
  p_org_id    UUID,
  p_completed BOOLEAN
) LANGUAGE plpgsql AS $$
BEGIN
  UPDATE board_session_agreements
  SET completed    = p_completed,
      completed_at = CASE WHEN p_completed THEN NOW() ELSE NULL END,
      updated_at   = NOW()
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_board_agreement(
  p_id     UUID,
  p_org_id UUID
) LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM board_session_agreements
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 3. Grants ─────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON board_session_agreements TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_upsert_board_agreement(UUID,UUID,UUID,TEXT,TEXT,DATE) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_toggle_board_agreement(UUID,UUID,BOOLEAN)             TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_delete_board_agreement(UUID,UUID)                     TO okr_user;
