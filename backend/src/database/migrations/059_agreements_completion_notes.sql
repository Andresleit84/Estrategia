-- Migration 059: Notas de cierre en acuerdos
-- Agrega campo completion_notes para evidencia al marcar un acuerdo como cumplido

-- ── 1. Columna ────────────────────────────────────────────────────────────────
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- ── 2. Vista actualizada ──────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_agreements;

CREATE VIEW v_agreements AS
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
  a.owner_id,
  a.created_by,
  a.created_at,
  a.updated_at,
  a.completion_notes,
  u_owner.name                                                          AS owner_name,
  u_owner.email                                                         AS owner_email,
  u_created.name                                                        AS created_by_name,
  c.name                                                                AS cycle_name,
  (a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE
   AND a.status NOT IN ('FULFILLED','CANCELLED'))                       AS is_overdue,
  (SELECT COUNT(*)::INT
     FROM agreement_backlog_items abi
    WHERE abi.agreement_id = a.id)                                      AS linked_items_count
FROM agreements a
LEFT JOIN users  u_owner   ON u_owner.id   = a.owner_id
LEFT JOIN users  u_created ON u_created.id = a.created_by
LEFT JOIN cycles c         ON c.id         = a.cycle_id
WHERE a.deleted_at IS NULL;

-- ── 3. Función de actualización con 11 parámetros ─────────────────────────────
CREATE OR REPLACE FUNCTION fn_update_agreement(
  p_id               UUID,
  p_title            TEXT,
  p_description      TEXT,
  p_source           TEXT,
  p_agreement_date   DATE,
  p_due_date         DATE,
  p_priority         TEXT,
  p_status           TEXT,
  p_cycle_id         UUID,
  p_owner_id         UUID,
  p_completion_notes TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE agreements SET
    title            = COALESCE(p_title,            title),
    description      = COALESCE(p_description,      description),
    source           = COALESCE(p_source,           source),
    agreement_date   = COALESCE(p_agreement_date,   agreement_date),
    due_date         = COALESCE(p_due_date,         due_date),
    priority         = COALESCE(p_priority,         priority),
    status           = COALESCE(p_status,           status),
    cycle_id         = CASE WHEN p_cycle_id         IS NOT NULL THEN p_cycle_id         ELSE cycle_id         END,
    owner_id         = CASE WHEN p_owner_id         IS NOT NULL THEN p_owner_id         ELSE owner_id         END,
    completion_notes = CASE WHEN p_completion_notes IS NOT NULL THEN p_completion_notes ELSE completion_notes END
  WHERE id = p_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acuerdo no encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
