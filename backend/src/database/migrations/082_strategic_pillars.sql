-- ================================================================
-- Migración 082 — Pilares Estratégicos
-- Entidad propia para pilares, separada de los objetivos anuales.
-- Un pilar tiene horizonte multi-año; los objetivos anuales cuelgan de él.
-- ================================================================

-- ── 1. Tabla principal ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategic_pillars (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code             TEXT,                          -- P1, P2, P3, P4, TA, TB
  name             TEXT        NOT NULL,
  description      TEXT,
  objective_2030   TEXT,                          -- Objetivo aspiracional del pilar al horizonte
  owner_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
  color            VARCHAR(7)  NOT NULL DEFAULT '#6366f1',
  sort_order       INT         NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_pillars_org
  ON strategic_pillars(organization_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- ── 2. FK en objectives ───────────────────────────────────────────

ALTER TABLE objectives
  ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES strategic_pillars(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_pillar
  ON objectives(pillar_id)
  WHERE deleted_at IS NULL;

-- ── 3. FK en key_results (pilar directo para reporting) ──────────

ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES strategic_pillars(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_krs_pillar
  ON key_results(pillar_id)
  WHERE deleted_at IS NULL;

-- ── 4. FK en initiatives ──────────────────────────────────────────

ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES strategic_pillars(id) ON DELETE SET NULL;

-- ── 5. updated_at trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_pillars_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_pillars_updated_at ON strategic_pillars;
CREATE TRIGGER trg_pillars_updated_at
  BEFORE UPDATE ON strategic_pillars
  FOR EACH ROW EXECUTE FUNCTION fn_pillars_updated_at();

-- ── 6. Vista de pilares con progreso agregado ─────────────────────

CREATE OR REPLACE VIEW v_pillars_progress AS
SELECT
  p.id,
  p.organization_id,
  p.code,
  p.name,
  p.description,
  p.objective_2030,
  p.owner_id,
  p.color,
  p.sort_order,
  p.is_active,
  p.created_at,
  p.updated_at,
  u.name                                    AS owner_name,
  COUNT(DISTINCT o.id)::INT                 AS objectives_count,
  COUNT(DISTINCT kr.id)::INT                AS krs_count,
  COALESCE(
    ROUND(AVG(kr.progress)::NUMERIC, 1), 0
  )                                         AS avg_progress,
  COUNT(DISTINCT kr.id) FILTER (
    WHERE kr.status = 'ON_TRACK'
  )::INT                                    AS krs_on_track,
  COUNT(DISTINCT kr.id) FILTER (
    WHERE kr.status IN ('AT_RISK', 'BEHIND')
  )::INT                                    AS krs_at_risk,
  COALESCE(
    ROUND((AVG(kr.confidence) * 100)::NUMERIC, 1), 0
  )                                         AS avg_confidence_pct
FROM strategic_pillars p
LEFT JOIN users        u  ON u.id  = p.owner_id
LEFT JOIN objectives   o  ON o.pillar_id = p.id AND o.deleted_at IS NULL
LEFT JOIN key_results  kr ON kr.pillar_id = p.id AND kr.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.organization_id, p.code, p.name, p.description,
         p.objective_2030, p.owner_id, p.color, p.sort_order, p.is_active,
         p.created_at, p.updated_at, u.name;

-- ── 7. SP: crear pilar ────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_pillar(
  p_org_id        UUID,
  p_code          TEXT,
  p_name          TEXT,
  p_description   TEXT,
  p_objective_2030 TEXT,
  p_owner_id      UUID,
  p_color         TEXT,
  p_sort_order    INT
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO strategic_pillars(
    organization_id, code, name, description, objective_2030,
    owner_id, color, sort_order
  ) VALUES (
    p_org_id, p_code, p_name, p_description, p_objective_2030,
    p_owner_id, COALESCE(p_color, '#6366f1'), COALESCE(p_sort_order, 0)
  );
END;
$$;

GRANT SELECT ON v_pillars_progress         TO okr_user;
GRANT SELECT, INSERT, UPDATE ON strategic_pillars TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_create_pillar(UUID,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,INT) TO okr_user;
