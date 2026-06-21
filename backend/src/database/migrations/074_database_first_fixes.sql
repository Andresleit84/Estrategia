-- Migration 074: Optimizaciones de índices para Database-First compliance
-- Mejora performance de queries frecuentes en reports y sprints

CREATE INDEX IF NOT EXISTS idx_agreements_cycle_status ON agreements(cycle_id, status);
CREATE INDEX IF NOT EXISTS idx_agreements_org_cycle_status ON agreements(organization_id, cycle_id, status);
-- check_ins no tiene organization_id directo (llega via kr → objective → cycle → org)
CREATE INDEX IF NOT EXISTS idx_check_ins_kr_date ON check_ins(kr_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_objectives_cycle_status ON objectives(cycle_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_key_results_obj ON key_results(objective_id) WHERE deleted_at IS NULL;

-- Nota: Los refactors Database-First completos (fn_get_cycle_projection, sp_generate_sprints)
-- se implementan en TypeScript por ahora. Las funciones SQL complejas requieren
-- validación contra el schema actual antes de ser aplicadas en producción.
