-- Sincroniza v_mcp_audit_summary con la versión de desarrollo:
-- agrega last_created_at, redondea avg_duration_ms, normaliza ORDER de columnas.
DROP VIEW IF EXISTS v_mcp_audit_summary;

CREATE VIEW v_mcp_audit_summary AS
SELECT
  organization_id,
  tool_name,
  COUNT(*)                                              AS call_count,
  COUNT(*) FILTER (WHERE error IS NOT NULL)             AS error_count,
  ROUND(AVG(duration_ms), 0)                            AS avg_duration_ms,
  MAX(created_at)                                       AS last_created_at,
  DATE_TRUNC('day', created_at)::date                   AS day
FROM mcp_audit_log
GROUP BY organization_id, tool_name, DATE_TRUNC('day', created_at)::date;
