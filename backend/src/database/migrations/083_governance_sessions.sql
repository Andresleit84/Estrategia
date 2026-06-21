-- ================================================================
-- Migración 083 — Sesiones de Gobierno + Ciclo de vida CE en Acuerdos
-- Una sesión es el foro donde el CE toma y cierra acuerdos.
-- Sin sesión no hay trazabilidad SUGEF del acuerdo.
-- ================================================================

-- ── 1. Sesiones de gobierno ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS governance_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  body_id          UUID        REFERENCES governance_bodies(id) ON DELETE SET NULL,
  session_number   TEXT,                   -- CE-2026-001, RTN-Q3-2026
  session_date     DATE        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'REGULAR'
                               CHECK (type IN ('REGULAR','EXTRAORDINARY','RTN','KICKOFF','BMR','JD')),
  status           TEXT        NOT NULL DEFAULT 'PLANNED'
                               CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  agenda           TEXT,
  minutes_notes    TEXT,                   -- Resumen del acta
  minutes_url      TEXT,                   -- Enlace al acta formal
  duration_min     INT,                    -- Duración real en minutos
  facilitator_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gov_sessions_org
  ON governance_sessions(organization_id, session_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gov_sessions_body
  ON governance_sessions(body_id)
  WHERE deleted_at IS NULL;

-- Participantes de la sesión
CREATE TABLE IF NOT EXISTS governance_session_participants (
  session_id  UUID NOT NULL REFERENCES governance_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attended    BOOLEAN NOT NULL DEFAULT true,
  role_label  TEXT,
  PRIMARY KEY (session_id, user_id)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION fn_gov_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_gov_sessions_updated_at ON governance_sessions;
CREATE TRIGGER trg_gov_sessions_updated_at
  BEFORE UPDATE ON governance_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_gov_sessions_updated_at();

-- ── 2. Extender acuerdos con ciclo de vida CE ─────────────────────
-- Ciclo CE: OPEN → TRACKING → EVIDENCE → CLOSED | ESCALATED
-- Compatible con estados genéricos anteriores (PENDING → OPEN, FULFILLED → CLOSED)

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS governance_body_id UUID REFERENCES governance_bodies(id),
  ADD COLUMN IF NOT EXISTS session_id         UUID REFERENCES governance_sessions(id),
  ADD COLUMN IF NOT EXISTS escalated_to       TEXT CHECK (escalated_to IN ('JD','GG','JEFATURA','EXTERNAL')),
  ADD COLUMN IF NOT EXISTS evidence_text      TEXT,    -- descripción del entregable verificable
  ADD COLUMN IF NOT EXISTS evidence_url       TEXT,    -- enlace al artefacto
  ADD COLUMN IF NOT EXISTS closed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by          UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS unique_owner_id    UUID REFERENCES users(id),  -- dueño único (regla CE)
  ADD COLUMN IF NOT EXISTS deliverable        TEXT;    -- entregable verificable prometido

-- Ampliar el CHECK de status para incluir estados CE
-- Migrar filas existentes IN_PROGRESS → TRACKING antes de cambiar el constraint
UPDATE agreements SET status = 'TRACKING' WHERE status = 'IN_PROGRESS';

ALTER TABLE agreements DROP CONSTRAINT IF EXISTS agreements_status_check;
ALTER TABLE agreements ADD CONSTRAINT agreements_status_check
  CHECK (status IN (
    'PENDING',      -- genérico: sin asignar
    'IN_PROGRESS',  -- genérico legacy (alias de TRACKING, mantenido para compatibilidad)
    'OPEN',         -- CE: registrado en sesión, notificado
    'TRACKING',     -- CE: responsable reporta avance, sin bloqueo
    'EVIDENCE',     -- CE: primer artefacto verificable entregado
    'FULFILLED',    -- genérico: completado (alias de CLOSED)
    'CLOSED',       -- CE: CE confirmó cierre en sesión
    'ESCALATED',    -- CE: bloqueo que supera autoridad del responsable
    'CANCELLED'
  ));

-- Índices nuevos
CREATE INDEX IF NOT EXISTS idx_agreements_session
  ON agreements(session_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agreements_body
  ON agreements(governance_body_id) WHERE deleted_at IS NULL;

-- ── 3. Vista de sesiones con resumen de acuerdos ──────────────────

CREATE OR REPLACE VIEW v_governance_sessions AS
SELECT
  gs.id,
  gs.organization_id,
  gs.body_id,
  gb.name                                     AS body_name,
  gb.type                                     AS body_type,
  gs.session_number,
  gs.session_date,
  gs.type,
  gs.status,
  gs.agenda,
  gs.minutes_notes,
  gs.minutes_url,
  gs.duration_min,
  gs.facilitator_id,
  uf.name                                     AS facilitator_name,
  gs.created_by,
  gs.created_at,
  gs.updated_at,
  COUNT(DISTINCT a.id)::INT                   AS agreements_count,
  COUNT(DISTINCT a.id) FILTER (
    WHERE a.status IN ('OPEN','TRACKING','EVIDENCE')
  )::INT                                      AS agreements_open,
  COUNT(DISTINCT a.id) FILTER (
    WHERE a.status IN ('CLOSED','FULFILLED')
  )::INT                                      AS agreements_closed,
  COUNT(DISTINCT a.id) FILTER (
    WHERE a.status = 'ESCALATED'
  )::INT                                      AS agreements_escalated,
  COUNT(DISTINCT sp.user_id)::INT             AS participants_count
FROM governance_sessions gs
LEFT JOIN governance_bodies gb ON gb.id = gs.body_id
LEFT JOIN users             uf ON uf.id = gs.facilitator_id
LEFT JOIN agreements        a  ON a.session_id = gs.id AND a.deleted_at IS NULL
LEFT JOIN governance_session_participants sp ON sp.session_id = gs.id
WHERE gs.deleted_at IS NULL
GROUP BY gs.id, gs.organization_id, gs.body_id, gb.name, gb.type,
         gs.session_number, gs.session_date, gs.type, gs.status,
         gs.agenda, gs.minutes_notes, gs.minutes_url, gs.duration_min,
         gs.facilitator_id, uf.name, gs.created_by, gs.created_at, gs.updated_at;

-- ── 4. SP: registrar acuerdo desde sesión CE ─────────────────────

CREATE OR REPLACE PROCEDURE sp_create_ce_agreement(
  p_org_id       UUID,
  p_session_id   UUID,
  p_body_id      UUID,
  p_title        TEXT,
  p_description  TEXT,
  p_owner_id     UUID,
  p_due_date     DATE,
  p_deliverable  TEXT,
  p_priority     TEXT DEFAULT 'MEDIUM'
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO agreements(
    organization_id, session_id, governance_body_id, cycle_id,
    title, description, unique_owner_id, due_date, deliverable,
    status, priority, source, agreement_date
  )
  SELECT
    p_org_id,
    p_session_id,
    p_body_id,
    (SELECT id FROM cycles WHERE organization_id = p_org_id
       AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1),
    p_title,
    p_description,
    p_owner_id,
    p_due_date,
    p_deliverable,
    'OPEN',
    COALESCE(p_priority, 'MEDIUM'),
    (SELECT session_number FROM governance_sessions WHERE id = p_session_id),
    (SELECT session_date  FROM governance_sessions WHERE id = p_session_id);
END;
$$;

-- SP: cerrar acuerdo en sesión
CREATE OR REPLACE PROCEDURE sp_close_ce_agreement(
  p_agreement_id UUID,
  p_closing_session_id UUID,
  p_closed_by    UUID,
  p_evidence     TEXT,
  p_evidence_url TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE agreements
     SET status       = 'CLOSED',
         closed_at    = NOW(),
         closed_by    = p_closed_by,
         evidence_text = p_evidence,
         evidence_url  = p_evidence_url,
         updated_at   = NOW()
   WHERE id = p_agreement_id
     AND deleted_at IS NULL;
END;
$$;

GRANT SELECT ON v_governance_sessions TO okr_user;
GRANT SELECT, INSERT, UPDATE ON governance_sessions TO okr_user;
GRANT SELECT, INSERT ON governance_session_participants TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_create_ce_agreement(UUID,UUID,UUID,TEXT,TEXT,UUID,DATE,TEXT,TEXT) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_close_ce_agreement(UUID,UUID,UUID,TEXT,TEXT) TO okr_user;
