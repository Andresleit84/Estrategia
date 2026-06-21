-- ================================================================
-- Migración 084 — Metas anuales por KR + Jerarquía de iniciativas + Conglomerado
-- Para KRs de ciclos multi-año: una fila por año con meta e hito.
-- Para Brasilia: parent_initiative_id permite eje → proyecto → tarea.
-- Para conglomerado: parent_org_id en organizations.
-- ================================================================

-- ── 1. Metas anuales por KR ───────────────────────────────────────
-- Un KR con horizonte 2026–2030 puede tener 5 filas (una por año).
-- baseline es la línea base medida para ese año.
-- target es la meta esperada al cierre de ese año.

CREATE TABLE IF NOT EXISTS kr_annual_targets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kr_id          UUID        NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  year           INTEGER     NOT NULL CHECK (year BETWEEN 2020 AND 2040),
  baseline       NUMERIC,                 -- línea base medida
  target         NUMERIC,                 -- meta al cierre del año
  actual         NUMERIC,                 -- valor real al cierre (se llena al cerrar ciclo)
  notes          TEXT,
  baseline_confirmed    BOOLEAN NOT NULL DEFAULT false,
  baseline_confirmed_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kr_id, year)
);

CREATE INDEX IF NOT EXISTS idx_kr_annual_targets_kr   ON kr_annual_targets(kr_id);
CREATE INDEX IF NOT EXISTS idx_kr_annual_targets_year ON kr_annual_targets(year);

CREATE OR REPLACE FUNCTION fn_kr_annual_targets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_kr_annual_targets_updated_at ON kr_annual_targets;
CREATE TRIGGER trg_kr_annual_targets_updated_at
  BEFORE UPDATE ON kr_annual_targets
  FOR EACH ROW EXECUTE FUNCTION fn_kr_annual_targets_updated_at();

-- ── 2. Jerarquía de iniciativas (Programa Brasilia) ───────────────
-- Permite: Programa → Subprograma → Proyecto → Plan de trabajo
-- external_code: M1, N3, C4, D2, H1, etc. (codificación Brasilia)
-- regulatory_refs: referencias a hallazgos SUGEF, acuerdos JD

ALTER TABLE initiatives
  ADD COLUMN IF NOT EXISTS parent_initiative_id UUID REFERENCES initiatives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_level         TEXT CHECK (program_level IN ('PROGRAM','SUBPROGRAM','PROJECT','WORKPLAN')),
  ADD COLUMN IF NOT EXISTS external_code         TEXT,    -- Ej: M5, N3, C4, D1, H2
  ADD COLUMN IF NOT EXISTS regulatory_refs       JSONB,   -- { sugef: ["GC.3.10"], jd_acuerdo: "2026-8354-43" }
  ADD COLUMN IF NOT EXISTS dependency_codes      TEXT[];  -- códigos externos de los que depende

CREATE INDEX IF NOT EXISTS idx_initiatives_parent
  ON initiatives(parent_initiative_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_initiatives_external_code
  ON initiatives(external_code)
  WHERE deleted_at IS NULL AND external_code IS NOT NULL;

-- ── 3. Conglomerado: organización padre ───────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orgs_parent
  ON organizations(parent_org_id)
  WHERE parent_org_id IS NOT NULL;

-- ── 4. Vista: KRs con metas anuales ──────────────────────────────

CREATE OR REPLACE VIEW v_kr_annual_summary AS
SELECT
  kr.id                       AS kr_id,
  kr.objective_id,
  kr.title                    AS kr_title,
  kr.kr_category,
  kr.pillar_id,
  kat.year,
  kat.baseline,
  kat.target,
  kat.actual,
  kat.notes,
  kat.baseline_confirmed,
  kat.baseline_confirmed_at,
  CASE
    WHEN kat.actual IS NOT NULL AND kat.target IS NOT NULL AND kat.target <> 0
      THEN ROUND((kat.actual / kat.target * 100)::NUMERIC, 1)
    ELSE NULL
  END                         AS year_progress_pct
FROM key_results  kr
JOIN kr_annual_targets kat ON kat.kr_id = kr.id
WHERE kr.deleted_at IS NULL
ORDER BY kr.id, kat.year;

-- ── 5. Vista: árbol de iniciativas ───────────────────────────────

CREATE OR REPLACE VIEW v_initiative_tree AS
SELECT
  i.id,
  i.organization_id,
  i.title,
  i.status,
  i.progress,
  i.start_date,
  i.due_date,
  i.program_level,
  i.external_code,
  i.parent_initiative_id,
  i.pillar_id,
  i.regulatory_refs,
  i.dependency_codes,
  p.title                     AS parent_title,
  p.external_code             AS parent_code,
  p.program_level             AS parent_level,
  u.name                      AS owner_name,
  COUNT(DISTINCT c.id)::INT   AS children_count
FROM initiatives i
LEFT JOIN initiatives p ON p.id = i.parent_initiative_id AND p.deleted_at IS NULL
LEFT JOIN users       u ON u.id = i.owner_id
LEFT JOIN initiatives c ON c.parent_initiative_id = i.id AND c.deleted_at IS NULL
WHERE i.deleted_at IS NULL
GROUP BY i.id, i.organization_id, i.title, i.status, i.progress,
         i.start_date, i.due_date, i.program_level, i.external_code,
         i.parent_initiative_id, i.pillar_id, i.regulatory_refs,
         i.dependency_codes, p.title, p.external_code, p.program_level,
         u.name;

-- ── 6. Vista: conglomerado ────────────────────────────────────────

CREATE OR REPLACE VIEW v_conglomerate AS
SELECT
  parent.id                   AS parent_org_id,
  parent.name                 AS parent_org_name,
  child.id                    AS subsidiary_id,
  child.name                  AS subsidiary_name,
  child.plan                  AS subsidiary_plan,
  child.created_at            AS subsidiary_since
FROM organizations parent
JOIN organizations child ON child.parent_org_id = parent.id
WHERE parent.deleted_at IS NULL
  AND child.deleted_at  IS NULL;

GRANT SELECT ON v_kr_annual_summary  TO okr_user;
GRANT SELECT ON v_initiative_tree    TO okr_user;
GRANT SELECT ON v_conglomerate       TO okr_user;
GRANT SELECT, INSERT, UPDATE ON kr_annual_targets TO okr_user;
