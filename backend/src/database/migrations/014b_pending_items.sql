-- ================================================================
-- Migración 014 — Items pendientes de hitos anteriores
-- ================================================================

-- ----------------------------------------------------------------
-- FUNCIÓN: fn_get_cascade_coverage (Hito 5 — diferido)
-- Para un objetivo, retorna el % de cobertura táctica:
-- qué porcentaje de sus KRs tiene al menos un objetivo hijo activo.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_cascade_coverage(p_objective_id uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
  WITH krs AS (
    SELECT COUNT(*) AS cnt
    FROM key_results
    WHERE objective_id = p_objective_id AND deleted_at IS NULL
  ),
  children AS (
    SELECT COUNT(*) AS cnt
    FROM objectives
    WHERE parent_objective_id = p_objective_id
      AND deleted_at IS NULL
      AND status NOT IN ('CANCELLED')
  )
  SELECT
    CASE
      WHEN krs.cnt = 0 OR children.cnt = 0 THEN 0
      ELSE LEAST(100, ROUND(100.0 * children.cnt / GREATEST(1, krs.cnt), 1))
    END
  FROM krs, children;
$$;

-- ----------------------------------------------------------------
-- VISTA: v_upcoming_milestones (Hito 10 — diferido a Hito 11)
-- Milestones vencidos en los próximos 30 días con contexto completo.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_upcoming_milestones AS
SELECT
  m.id                                                   AS milestone_id,
  m.initiative_id,
  m.title                                                AS milestone_title,
  m.status                                               AS milestone_status,
  m.due_date,
  (m.due_date - CURRENT_DATE)                            AS days_until_due,
  i.title                                                AS initiative_title,
  i.organization_id,
  i.cycle_id,
  i.team_id,
  i.status                                               AS initiative_status,
  t.name                                                 AS team_name,
  u.name                                                 AS owner_name
FROM milestones m
JOIN initiatives i ON i.id = m.initiative_id
LEFT JOIN teams t ON t.id = i.team_id
LEFT JOIN users u ON u.id = i.owner_id
WHERE m.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  AND m.status NOT IN ('COMPLETED', 'CANCELLED')
  AND i.deleted_at IS NULL;

-- Índice para la vista
CREATE INDEX IF NOT EXISTS idx_milestones_due_upcoming
  ON milestones(due_date, status)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED');

-- ----------------------------------------------------------------
-- VERIFICACIÓN
-- ----------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Migration 014_pending_items applied — fn_get_cascade_coverage, v_upcoming_milestones.';
END;
$$;
