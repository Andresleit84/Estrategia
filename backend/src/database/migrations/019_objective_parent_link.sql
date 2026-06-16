-- Migration 019: fn_set_objective_parent
-- Allows linking/unlinking an objective's parent after creation.

CREATE OR REPLACE FUNCTION fn_set_objective_parent(
  p_obj_id    UUID,
  p_parent_id UUID   -- NULL to unlink
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_status     TEXT;
  v_cursor_id  UUID;
BEGIN
  SELECT status INTO v_status
    FROM objectives
   WHERE id = p_obj_id AND deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Objetivo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'No se puede editar un objetivo %', v_status USING ERRCODE = 'P0003';
  END IF;

  -- Guard against self-reference
  IF p_parent_id IS NOT NULL AND p_parent_id = p_obj_id THEN
    RAISE EXCEPTION 'Un objetivo no puede ser su propio padre' USING ERRCODE = 'P0004';
  END IF;

  -- Guard against circular reference: walk up from p_parent_id; if we hit p_obj_id → cycle
  IF p_parent_id IS NOT NULL THEN
    v_cursor_id := p_parent_id;
    LOOP
      SELECT parent_objective_id INTO v_cursor_id
        FROM objectives
       WHERE id = v_cursor_id AND deleted_at IS NULL;
      EXIT WHEN v_cursor_id IS NULL;
      IF v_cursor_id = p_obj_id THEN
        RAISE EXCEPTION 'Referencia circular detectada' USING ERRCODE = 'P0005';
      END IF;
    END LOOP;
  END IF;

  UPDATE objectives
     SET parent_objective_id = p_parent_id,
         updated_at          = NOW()
   WHERE id = p_obj_id AND deleted_at IS NULL;
END;
$$;
