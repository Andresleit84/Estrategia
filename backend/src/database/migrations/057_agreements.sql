-- Migration 057: Módulo de Acuerdos
-- Registra acuerdos externos (junta, cliente, regulatorios) y los vincula con la ejecución interna

-- ── Tabla principal ────────────────────────────────────────────────────────────
CREATE TABLE agreements (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id         UUID         REFERENCES cycles(id) ON DELETE SET NULL,
  code             TEXT,
  title            TEXT         NOT NULL,
  description      TEXT,
  source           TEXT,        -- Origen: junta del 2026-05-15, cliente Acme, regulador X
  agreement_date   DATE,
  due_date         DATE,
  status           TEXT         NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','IN_PROGRESS','FULFILLED','CANCELLED')),
  priority         TEXT         NOT NULL DEFAULT 'MEDIUM'
                                CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  created_by       UUID         REFERENCES users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- M2M: acuerdos ↔ backlog_items (épicas/features creados a partir del acuerdo)
CREATE TABLE agreement_backlog_items (
  agreement_id    UUID  NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  backlog_item_id UUID  NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agreement_id, backlog_item_id)
);

-- ── Código auto-generado: AGR-N por org ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_agreement_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT 'AGR-' || (COUNT(*) + 1)::TEXT INTO NEW.code
  FROM agreements
  WHERE organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agreements_code
  BEFORE INSERT ON agreements
  FOR EACH ROW EXECUTE FUNCTION fn_set_agreement_code();

-- ── updated_at automático ─────────────────────────────────────────────────────
CREATE TRIGGER trg_agreements_updated_at
  BEFORE UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── Vista principal ───────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_agreements AS
SELECT
  a.id,
  a.organization_id,
  a.cycle_id,
  a.code,
  a.title,
  a.description,
  a.source,
  a.agreement_date,
  a.due_date,
  a.status,
  a.priority,
  a.created_by,
  a.created_at,
  a.updated_at,
  u.name                                                               AS created_by_name,
  c.name                                                               AS cycle_name,
  (a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE
   AND a.status NOT IN ('FULFILLED','CANCELLED'))                      AS is_overdue,
  (SELECT COUNT(*)::INT
     FROM agreement_backlog_items abi
    WHERE abi.agreement_id = a.id)                                     AS linked_items_count
FROM agreements a
LEFT JOIN users     u ON u.id = a.created_by
LEFT JOIN cycles    c ON c.id = a.cycle_id
WHERE a.deleted_at IS NULL;

-- ── Procedimiento de creación ─────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_create_agreement(
  p_org_id         UUID,
  p_title          TEXT,
  p_description    TEXT,
  p_source         TEXT,
  p_agreement_date DATE,
  p_due_date       DATE,
  p_priority       TEXT,
  p_cycle_id       UUID,
  p_created_by     UUID,
  INOUT p_id       UUID DEFAULT NULL
) LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO agreements (
    organization_id, title, description, source, agreement_date,
    due_date, priority, cycle_id, created_by
  ) VALUES (
    p_org_id, p_title, p_description, p_source, p_agreement_date,
    p_due_date, p_priority, p_cycle_id, p_created_by
  ) RETURNING id INTO p_id;
END;
$$;

-- ── Función de actualización ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_agreement(
  p_id             UUID,
  p_title          TEXT,
  p_description    TEXT,
  p_source         TEXT,
  p_agreement_date DATE,
  p_due_date       DATE,
  p_priority       TEXT,
  p_status         TEXT,
  p_cycle_id       UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE agreements SET
    title          = COALESCE(p_title,          title),
    description    = COALESCE(p_description,    description),
    source         = COALESCE(p_source,         source),
    agreement_date = COALESCE(p_agreement_date, agreement_date),
    due_date       = COALESCE(p_due_date,       due_date),
    priority       = COALESCE(p_priority,       priority),
    status         = COALESCE(p_status,         status),
    cycle_id       = CASE WHEN p_cycle_id IS NOT NULL THEN p_cycle_id ELSE cycle_id END
  WHERE id = p_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acuerdo no encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_agreements_org    ON agreements(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agreements_status ON agreements(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_agreement_backlog ON agreement_backlog_items(agreement_id);
