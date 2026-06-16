-- ── Patch: Fix delivery views field names + add missing columns ──────────────
-- Fixes:
--   1. delivery_phases: add owner_id column (missing from original migration)
--   2. v_phase_progress: total_deliverables→deliverable_count, approved_count→completed_count, add owner_id/owner_name
--   3. v_program_dashboard: total_deliverables→deliverable_count, approved_count→completed_count
--   4. v_deliverables_full: add linked_objective_title, linked_initiative_title
--   5. v_upcoming_deliverables: add days_until_due

-- 1. Add owner_id to delivery_phases
ALTER TABLE delivery_phases
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- Drop views in dependency order before recreating with new column names
DROP VIEW IF EXISTS v_upcoming_deliverables;
DROP VIEW IF EXISTS v_deliverables_full;
DROP VIEW IF EXISTS v_phase_progress;
DROP VIEW IF EXISTS v_program_dashboard;

-- 2. v_phase_progress — fix field names + add owner
CREATE VIEW v_phase_progress AS
SELECT
  dp.id,
  dp.program_id,
  dp.name,
  dp.description,
  dp.order_index,
  dp.gate_criteria,
  dp.target_start_date,
  dp.target_end_date,
  dp.status,
  dp.owner_id,
  dp.created_at,
  dp.updated_at,
  u.name                                                                                AS owner_name,
  COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL)                                      AS deliverable_count,
  COUNT(d.id) FILTER (WHERE d.status = 'NOT_STARTED'  AND d.deleted_at IS NULL)        AS not_started_count,
  COUNT(d.id) FILTER (WHERE d.status = 'IN_PROGRESS'  AND d.deleted_at IS NULL)        AS in_progress_count,
  COUNT(d.id) FILTER (WHERE d.status = 'IN_REVIEW'    AND d.deleted_at IS NULL)        AS in_review_count,
  COUNT(d.id) FILTER (WHERE d.status = 'APPROVED'     AND d.deleted_at IS NULL)        AS completed_count,
  COUNT(d.id) FILTER (WHERE d.status = 'BLOCKED'      AND d.deleted_at IS NULL)        AS blocked_count,
  COUNT(d.id) FILTER (WHERE d.status = 'CANCELLED'    AND d.deleted_at IS NULL)        AS cancelled_count,
  COALESCE(ROUND(
    100.0
    * COUNT(d.id) FILTER (WHERE d.status = 'APPROVED' AND d.deleted_at IS NULL)
    / NULLIF(
        COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL AND d.status != 'CANCELLED'),
        0
      )
  ), 0)                                                                                AS completion_pct
FROM delivery_phases dp
LEFT JOIN deliverables d ON d.phase_id = dp.id
LEFT JOIN users        u ON u.id = dp.owner_id
GROUP BY dp.id, u.name;

-- 3. v_program_dashboard — fix field names
CREATE VIEW v_program_dashboard AS
SELECT
  p.id,
  p.organization_id,
  p.name,
  p.description,
  p.status,
  p.cycle_id,
  p.created_by,
  p.created_at,
  p.updated_at,
  c.name                                                                                AS cycle_name,
  COUNT(DISTINCT dp.id)                                                                 AS phase_count,
  COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL)                                      AS deliverable_count,
  COUNT(d.id) FILTER (WHERE d.status = 'APPROVED'  AND d.deleted_at IS NULL)           AS completed_count,
  COUNT(d.id) FILTER (WHERE d.status = 'BLOCKED'   AND d.deleted_at IS NULL)           AS blocked_count,
  COUNT(d.id) FILTER (
    WHERE d.due_date < CURRENT_DATE
      AND d.status NOT IN ('APPROVED', 'CANCELLED')
      AND d.deleted_at IS NULL
  )                                                                                     AS overdue_count,
  COALESCE(ROUND(
    100.0
    * COUNT(d.id) FILTER (WHERE d.status = 'APPROVED' AND d.deleted_at IS NULL)
    / NULLIF(
        COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL AND d.status != 'CANCELLED'),
        0
      )
  ), 0)                                                                                AS completion_pct
FROM delivery_programs p
LEFT JOIN delivery_phases   dp ON dp.program_id  = p.id
LEFT JOIN deliverables       d ON d.phase_id     = dp.id
LEFT JOIN cycles             c ON c.id           = p.cycle_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, c.name;

-- 4. v_deliverables_full — add linked_objective_title, linked_initiative_title
CREATE VIEW v_deliverables_full AS
SELECT
  d.id,
  d.phase_id,
  d.organization_id,
  d.title,
  d.description,
  d.acceptance_criteria,
  d.owner_id,
  d.due_date,
  d.status,
  d.document_url,
  d.notes,
  d.linked_objective_id,
  d.linked_initiative_id,
  d.created_by,
  d.created_at,
  d.updated_at,
  u.name                                                   AS owner_name,
  u.email                                                  AS owner_email,
  dp.name                                                  AS phase_name,
  dp.order_index                                           AS phase_order,
  dp.program_id,
  dp.status                                                AS phase_status,
  p.name                                                   AS program_name,
  p.organization_id                                        AS program_org_id,
  obj.title                                                AS linked_objective_title,
  ini.title                                                AS linked_initiative_title,
  (d.due_date < CURRENT_DATE
   AND d.status NOT IN ('APPROVED', 'CANCELLED'))          AS is_overdue,
  (d.due_date BETWEEN CURRENT_DATE
                  AND CURRENT_DATE + INTERVAL '7 days'
   AND d.status NOT IN ('APPROVED', 'CANCELLED'))          AS due_soon
FROM deliverables d
LEFT JOIN users              u   ON d.owner_id            = u.id
JOIN  delivery_phases        dp  ON d.phase_id            = dp.id
JOIN  delivery_programs       p  ON dp.program_id         = p.id
LEFT JOIN objectives         obj ON d.linked_objective_id = obj.id AND obj.deleted_at IS NULL
LEFT JOIN initiatives        ini ON d.linked_initiative_id = ini.id AND ini.deleted_at IS NULL
WHERE d.deleted_at IS NULL;

-- 5. v_upcoming_deliverables — add days_until_due
CREATE VIEW v_upcoming_deliverables AS
SELECT
  d.id,
  d.title,
  d.status,
  d.due_date,
  d.organization_id,
  d.is_overdue,
  d.due_soon,
  d.owner_name,
  d.owner_id,
  d.phase_name,
  d.program_name,
  d.program_id,
  (d.due_date - CURRENT_DATE)::INTEGER                     AS days_until_due,
  CASE
    WHEN d.due_date < CURRENT_DATE                          THEN 'OVERDUE'
    WHEN d.due_date <= CURRENT_DATE + INTERVAL '7 days'    THEN 'DUE_SOON'
    ELSE                                                         'UPCOMING'
  END AS urgency
FROM v_deliverables_full d
WHERE d.status  NOT IN ('APPROVED', 'CANCELLED')
  AND d.due_date IS NOT NULL
  AND d.due_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY d.due_date ASC;
