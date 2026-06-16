-- ================================================================
-- Migración 014 — Fix: permitir un ciclo ACTIVE por tipo por organización
-- Corrección OKR: strategic + annual + quarterly deben poder estar
-- ACTIVE simultáneamente. El constraint anterior era incorrecto.
-- ================================================================

-- ----------------------------------------------------------------
-- FUNCIÓN: un ciclo ACTIVE por tipo por organización (no por org total)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_single_active_cycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM cycles
    WHERE organization_id = NEW.organization_id
      AND type            = NEW.type
      AND status          = 'ACTIVE'
      AND id             <> NEW.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya existe un ciclo % activo para esta organización. Cierra el ciclo actual antes de activar uno nuevo.', NEW.type
      USING ERRCODE = 'P0004';
  END IF;
  RETURN NEW;
END;
$$;
