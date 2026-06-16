-- Migration 026: AI Diagnostic Reports
-- Almacena análisis FODA generados por IA con contexto regulatorio y benchmark

CREATE TABLE IF NOT EXISTS ai_diagnostic_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id),
  created_by       UUID        NOT NULL REFERENCES users(id),
  org_name         TEXT        NOT NULL,
  country_code     VARCHAR(3)  NOT NULL,
  country_name     TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'GENERATING'
                               CHECK (status IN ('GENERATING','READY','ERROR')),
  content          JSONB       NOT NULL DEFAULT '{}',
  pdf_path         TEXT,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_diagnostic_org
  ON ai_diagnostic_reports(organization_id, created_at DESC);

CREATE OR REPLACE VIEW v_ai_diagnostic_reports AS
  SELECT
    r.id,
    r.organization_id,
    r.org_name,
    r.country_code,
    r.country_name,
    r.status,
    r.pdf_path IS NOT NULL AS has_pdf,
    r.pdf_path,
    r.error_message,
    r.created_at,
    u.name AS created_by_name
  FROM ai_diagnostic_reports r
  JOIN users u ON u.id = r.created_by;

GRANT SELECT, INSERT, UPDATE ON ai_diagnostic_reports TO okr_user;
GRANT SELECT ON v_ai_diagnostic_reports TO okr_user;
