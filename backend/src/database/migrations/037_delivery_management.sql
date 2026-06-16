-- ── Migración 037: Delivery Management ────────────────────────────────────────
-- Módulo de gestión de entregables estructurado en programas → fases → entregables.
-- Permite vincular deliverables a objetivos e iniciativas del sistema OKR.
-- Incluye vistas de progreso, dashboard de programa y alertas de vencimiento.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_programs (
  id              UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID        NOT NULL REFERENCES organizations(id),
  cycle_id        UUID        REFERENCES cycles(id),
  name            TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
  created_by      UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS delivery_phases (
  id                UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id        UUID        NOT NULL REFERENCES delivery_programs(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  description       TEXT,
  order_index       INTEGER     NOT NULL DEFAULT 0,
  gate_criteria     TEXT,
  target_start_date DATE,
  target_end_date   DATE,
  status            TEXT        NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliverables (
  id                   UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  phase_id             UUID        NOT NULL REFERENCES delivery_phases(id) ON DELETE CASCADE,
  organization_id      UUID        NOT NULL REFERENCES organizations(id),
  title                TEXT        NOT NULL,
  description          TEXT,
  acceptance_criteria  TEXT,
  owner_id             UUID        REFERENCES users(id),
  due_date             DATE,
  status               TEXT        NOT NULL DEFAULT 'NOT_STARTED'
                       CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'BLOCKED', 'CANCELLED')),
  document_url         TEXT,
  notes                TEXT,
  linked_objective_id  UUID        REFERENCES objectives(id) ON DELETE SET NULL,
  linked_initiative_id UUID        REFERENCES initiatives(id) ON DELETE SET NULL,
  created_by           UUID        REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deliverable_dependencies (
  deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  depends_on_id  UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  PRIMARY KEY (deliverable_id, depends_on_id),
  CHECK (deliverable_id != depends_on_id)
);

-- ============================================================
-- TRIGGERS — updated_at
-- ============================================================

CREATE OR REPLACE TRIGGER trg_updated_at_delivery_programs
  BEFORE UPDATE ON delivery_programs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_delivery_phases
  BEFORE UPDATE ON delivery_phases
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_updated_at_deliverables
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- TRIGGERS — audit log
-- ============================================================

CREATE OR REPLACE TRIGGER trg_audit_log_delivery_programs
  AFTER INSERT OR UPDATE OR DELETE ON delivery_programs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_log_deliverables
  AFTER INSERT OR UPDATE OR DELETE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_delivery_programs_org
  ON delivery_programs(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_phases_program
  ON delivery_phases(program_id, order_index);

CREATE INDEX IF NOT EXISTS idx_deliverables_phase
  ON deliverables(phase_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_org
  ON deliverables(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_owner
  ON deliverables(owner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliverables_due_date
  ON deliverables(due_date)
  WHERE deleted_at IS NULL
    AND status NOT IN ('APPROVED', 'CANCELLED');

-- ============================================================
-- VIEW: v_deliverables_full
-- Deliverables con info de propietario, fase, programa y flags calculados.
-- ============================================================

CREATE OR REPLACE VIEW v_deliverables_full AS
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
  (d.due_date < CURRENT_DATE
   AND d.status NOT IN ('APPROVED', 'CANCELLED'))          AS is_overdue,
  (d.due_date BETWEEN CURRENT_DATE
                  AND CURRENT_DATE + INTERVAL '7 days'
   AND d.status NOT IN ('APPROVED', 'CANCELLED'))          AS due_soon
FROM deliverables d
LEFT JOIN users          u  ON d.owner_id   = u.id
JOIN  delivery_phases   dp  ON d.phase_id   = dp.id
JOIN  delivery_programs  p  ON dp.program_id = p.id
WHERE d.deleted_at IS NULL;

-- ============================================================
-- VIEW: v_phase_progress
-- Fases con contadores de entregables por estado y porcentaje de completitud.
-- ============================================================

CREATE OR REPLACE VIEW v_phase_progress AS
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
  dp.created_at,
  dp.updated_at,
  COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL)                                      AS total_deliverables,
  COUNT(d.id) FILTER (WHERE d.status = 'NOT_STARTED'  AND d.deleted_at IS NULL)        AS not_started_count,
  COUNT(d.id) FILTER (WHERE d.status = 'IN_PROGRESS'  AND d.deleted_at IS NULL)        AS in_progress_count,
  COUNT(d.id) FILTER (WHERE d.status = 'IN_REVIEW'    AND d.deleted_at IS NULL)        AS in_review_count,
  COUNT(d.id) FILTER (WHERE d.status = 'APPROVED'     AND d.deleted_at IS NULL)        AS approved_count,
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
GROUP BY dp.id;

-- ============================================================
-- VIEW: v_program_dashboard
-- Programas con estadísticas agregadas de entregables y fases.
-- ============================================================

CREATE OR REPLACE VIEW v_program_dashboard AS
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
  COUNT(d.id) FILTER (WHERE d.deleted_at IS NULL)                                      AS total_deliverables,
  COUNT(d.id) FILTER (WHERE d.status = 'APPROVED'  AND d.deleted_at IS NULL)           AS approved_count,
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

-- ============================================================
-- VIEW: v_upcoming_deliverables
-- Entregables vencidos o próximos a vencer (hasta 30 días).
-- Usada en la página de bienvenida.
-- ============================================================

CREATE OR REPLACE VIEW v_upcoming_deliverables AS
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
