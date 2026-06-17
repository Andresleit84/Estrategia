-- Migration 078: Complete Row-Level Security for all organization tables
-- Fecha: 2026-06-17
-- Descripción: Habilita RLS en TODAS las tablas con organization_id que aún no lo tienen

-- 1. key_results
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON key_results;
CREATE POLICY org_isolation ON key_results FOR ALL USING (
  fn_check_org_context((SELECT o.organization_id FROM objectives o WHERE o.id = objective_id))
);

-- 2. check_ins
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON check_ins;
CREATE POLICY org_isolation ON check_ins FOR ALL USING (
  fn_check_org_context((
    SELECT o.organization_id FROM key_results kr
    JOIN objectives o ON o.id = kr.objective_id
    WHERE kr.id = kr_id
  ))
);

-- 3. notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON notifications;
CREATE POLICY org_isolation ON notifications FOR ALL USING (fn_check_org_context(organization_id));

-- 4. agreements
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON agreements;
CREATE POLICY org_isolation ON agreements FOR ALL USING (fn_check_org_context(organization_id));

-- 5. agreement_backlog_items
ALTER TABLE agreement_backlog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON agreement_backlog_items;
CREATE POLICY org_isolation ON agreement_backlog_items FOR ALL USING (
  fn_check_org_context((SELECT a.organization_id FROM agreements a WHERE a.id = agreement_id))
);

-- 6. sprint_cycles
ALTER TABLE sprint_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON sprint_cycles;
CREATE POLICY org_isolation ON sprint_cycles FOR ALL USING (fn_check_org_context(organization_id));

-- 7. sprint_goal_krs
ALTER TABLE sprint_goal_krs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON sprint_goal_krs;
CREATE POLICY org_isolation ON sprint_goal_krs FOR ALL USING (
  fn_check_org_context((SELECT sc.organization_id FROM sprint_cycles sc WHERE sc.id = sprint_id))
);

-- 8. ai_diagnostic_reports
ALTER TABLE ai_diagnostic_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON ai_diagnostic_reports;
CREATE POLICY org_isolation ON ai_diagnostic_reports FOR ALL USING (fn_check_org_context(organization_id));

-- 9. sector_assessments
ALTER TABLE sector_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON sector_assessments;
CREATE POLICY org_isolation ON sector_assessments FOR ALL USING (fn_check_org_context(organization_id));

-- 10. sector_assessment_sessions
ALTER TABLE sector_assessment_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON sector_assessment_sessions;
CREATE POLICY org_isolation ON sector_assessment_sessions FOR ALL USING (
  fn_check_org_context((SELECT sa.organization_id FROM sector_assessments sa WHERE sa.id = sector_assessment_id))
);

-- 11. delivery_programs
ALTER TABLE delivery_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON delivery_programs;
CREATE POLICY org_isolation ON delivery_programs FOR ALL USING (fn_check_org_context(organization_id));

-- 12. program_cycles
ALTER TABLE program_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON program_cycles;
CREATE POLICY org_isolation ON program_cycles FOR ALL USING (
  fn_check_org_context((SELECT c.organization_id FROM cycles c WHERE c.id = cycle_id))
);
