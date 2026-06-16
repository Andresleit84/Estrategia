-- Migration 055: session_documents
-- Almacena insumos de soporte (encuestas, entrevistas, informes) como texto
-- extraído, vinculados a una sesión de diagnóstico sectorial.

ALTER TABLE sector_assessment_sessions
  ADD COLUMN IF NOT EXISTS session_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sector_assessment_sessions.session_documents IS
  'Array de { id, name, doc_type, content, size_chars, uploaded_at, uploaded_by, uploaded_by_name }';

-- Actualizar la vista para exponer session_documents
CREATE OR REPLACE VIEW v_sector_sessions AS
SELECT
  s.id,
  s.organization_id,
  s.name,
  s.period_label,
  s.status,
  s.calibrated_scores,
  s.session_documents,
  s.ai_plan,
  s.created_at,
  s.updated_at,
  u.name AS created_by_name,
  COUNT(a.id) AS total_assessments,
  COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') AS completed_assessments,
  ROUND(
    (
      SELECT AVG(ts.overall_score)
      FROM threat_scores ts
      JOIN sector_assessments sa2 ON sa2.id = ts.assessment_id
      WHERE sa2.session_id = s.id
        AND sa2.deleted_at IS NULL
        AND sa2.status = 'COMPLETED'
        AND ts.overall_score IS NOT NULL
    )::NUMERIC,
    1
  ) AS avg_score
FROM sector_assessment_sessions s
LEFT JOIN users u ON u.id = s.created_by
LEFT JOIN sector_assessments a ON a.session_id = s.id AND a.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, u.name;
