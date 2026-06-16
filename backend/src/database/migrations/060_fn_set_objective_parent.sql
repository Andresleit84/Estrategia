-- Migration 060: fn_set_objective_parent
-- Creada 2026-05-25
-- Requerida por ObjectivesService.update cuando se cambia parent_objective_id

CREATE OR REPLACE FUNCTION fn_set_objective_parent(p_obj_id UUID, p_parent_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar que el objetivo existe y no está eliminado
  IF NOT EXISTS (
    SELECT 1 FROM objectives WHERE id = p_obj_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'P0003: Objetivo no encontrado o eliminado';
  END IF;

  -- Validar que no es auto-referencia
  IF p_parent_id = p_obj_id THEN
    RAISE EXCEPTION 'P0003: Un objetivo no puede ser su propio padre';
  END IF;

  -- Si hay parent, validar que existe y no está eliminado
  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM objectives WHERE id = p_parent_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'P0003: Objetivo padre no encontrado';
  END IF;

  UPDATE objectives
  SET parent_objective_id = p_parent_id,
      updated_at = NOW()
  WHERE id = p_obj_id AND deleted_at IS NULL;
END;
$$;
