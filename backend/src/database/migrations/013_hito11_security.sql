-- ================================================================
-- Migración 013 — Hito 11: Seguridad, Performance y Calidad
-- ================================================================

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_check_org_context
-- Usada por las políticas RLS para verificar el contexto de org.
-- Devuelve TRUE si:
--   a) no hay contexto establecido (operaciones internas/cron), o
--   b) el organization_id de la fila coincide con app.current_org_id
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_org_context(check_org_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  ctx text;
BEGIN
  ctx := current_setting('app.current_org_id', true);
  IF ctx IS NULL OR ctx = '' THEN
    RETURN true; -- operación interna, sin restricción
  END IF;
  RETURN check_org_id = ctx::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false; -- UUID malformado → denegar
END;
$$;

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY — tablas con organization_id directo
-- Defensa en profundidad: el app ya filtra por org vía JWT,
-- pero RLS previene leakage si el código olvidara el filtro.
-- ----------------------------------------------------------------

-- cycles
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON cycles;
CREATE POLICY org_isolation ON cycles
  USING (fn_check_org_context(organization_id));

-- objectives
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON objectives;
CREATE POLICY org_isolation ON objectives
  USING (fn_check_org_context(organization_id));

-- teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON teams;
CREATE POLICY org_isolation ON teams
  USING (fn_check_org_context(organization_id));

-- initiatives
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON initiatives;
CREATE POLICY org_isolation ON initiatives
  USING (fn_check_org_context(organization_id));

-- ai_briefings
ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON ai_briefings;
CREATE POLICY org_isolation ON ai_briefings
  USING (fn_check_org_context(organization_id));

-- ai_conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON ai_conversations;
CREATE POLICY org_isolation ON ai_conversations
  USING (fn_check_org_context(organization_id));

-- cycle_close_reports
ALTER TABLE cycle_close_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_close_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON cycle_close_reports;
CREATE POLICY org_isolation ON cycle_close_reports
  USING (fn_check_org_context(organization_id));

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_prevent_audit_modification
-- Hace inmutables los registros de auditoría — UPDATE/DELETE
-- sobre mcp_audit_log y ai_briefings lanzan excepción.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_audit_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable — % on table "%" is not permitted',
    TG_OP, TG_TABLE_NAME
  USING ERRCODE = '55000'; -- object_not_in_prerequisite_state
END;
$$;

-- Trigger en mcp_audit_log
DROP TRIGGER IF EXISTS trg_mcp_audit_immutable ON mcp_audit_log;
CREATE TRIGGER trg_mcp_audit_immutable
  BEFORE UPDATE OR DELETE ON mcp_audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_modification();

-- Trigger en ai_briefings (snapshots inmutables)
DROP TRIGGER IF EXISTS trg_ai_briefings_immutable ON ai_briefings;
CREATE TRIGGER trg_ai_briefings_immutable
  BEFORE UPDATE OR DELETE ON ai_briefings
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_modification();

-- ----------------------------------------------------------------
-- ÍNDICES DE PERFORMANCE — Hito 11
-- Cubren las queries más frecuentes del dashboard ejecutivo,
-- vistas v_at_risk_krs, v_executive_dashboard, v_team_health.
-- ----------------------------------------------------------------

-- key_results: filtrado por objetivo + estado + confianza (v_at_risk_krs, v_executive_dashboard)
CREATE INDEX IF NOT EXISTS idx_krs_objective_status_conf
  ON key_results(objective_id, status, confidence)
  WHERE deleted_at IS NULL;

-- key_results: búsqueda de KRs activos por org (via join con objectives)
CREATE INDEX IF NOT EXISTS idx_krs_status_deleted
  ON key_results(status, deleted_at);

-- objectives: dashboard ejecutivo — org + ciclo + nivel
CREATE INDEX IF NOT EXISTS idx_objectives_org_cycle_level
  ON objectives(organization_id, cycle_id, level)
  WHERE deleted_at IS NULL;

-- check_ins: subconsulta de "último check-in antes de fecha X" en v_weekly_trend
CREATE INDEX IF NOT EXISTS idx_checkins_kr_checkedat_value
  ON check_ins(kr_id, checked_at DESC, current_value);

-- initiatives: portfolio dashboard por ciclo
CREATE INDEX IF NOT EXISTS idx_initiatives_org_cycle_status
  ON initiatives(organization_id, cycle_id, status)
  WHERE deleted_at IS NULL;

-- milestones: conteo de hitos por iniciativa (v_portfolio_dashboard)
CREATE INDEX IF NOT EXISTS idx_milestones_initiative_status
  ON milestones(initiative_id, status);

-- ai_briefings: búsqueda por tipo + fecha (listado de briefings)
CREATE INDEX IF NOT EXISTS idx_ai_briefings_org_type_date
  ON ai_briefings(organization_id, type, created_at DESC);

-- refresh_tokens: búsqueda para revocación (logout)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash_revoked
  ON refresh_tokens(token_hash, revoked_at)
  WHERE revoked_at IS NULL;

-- ----------------------------------------------------------------
-- VISTA: v_mcp_audit_summary (si no existe, crearla)
-- Resumen de uso de herramientas MCP por org y tool
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_mcp_audit_summary;
CREATE VIEW v_mcp_audit_summary AS
SELECT
  organization_id,
  tool_name,
  COUNT(*)                                                       AS call_count,
  COUNT(*) FILTER (WHERE error IS NOT NULL)                      AS error_count,
  ROUND(AVG(duration_ms)::numeric, 0)                           AS avg_duration_ms,
  MAX(created_at)                                                 AS last_created_at,
  DATE_TRUNC('day', created_at)::date                            AS day
FROM mcp_audit_log
GROUP BY organization_id, tool_name, DATE_TRUNC('day', created_at)::date;

-- ----------------------------------------------------------------
-- VERIFICACIÓN: Confirmar que la migración se ejecutó
-- ----------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Migration 013_hito11_security applied — RLS enabled, audit triggers set, performance indexes created.';
END;
$$;
