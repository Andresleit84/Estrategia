-- Migration 062: fn_my_impact_chain (versión final con id en nodos y p_item_id opcional)
-- Devuelve la cadena estratégica completa de un usuario desde el ítem de backlog más reciente
-- Actualizado 2026-05-29: campo id en todos los nodos, parámetro p_item_id opcional

CREATE OR REPLACE FUNCTION fn_my_impact_chain(
  p_user_id UUID,
  p_org_id  UUID,
  p_item_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_nodes      JSONB   := '[]'::JSONB;
  v_item       RECORD;
  v_parent     RECORD;
  v_initiative RECORD;
  v_kr         RECORD;
  v_obj        RECORD;
  v_intent     RECORD;
  v_vision     TEXT;
  v_init_id    UUID;
  v_parent_id  UUID;
  v_obj_id     UUID;
  v_depth      INT;
  v_complete   BOOLEAN := FALSE;
BEGIN
  IF p_item_id IS NOT NULL THEN
    SELECT id, code, title, type, status, initiative_id, parent_id
    INTO v_item
    FROM backlog_items
    WHERE id = p_item_id
      AND organization_id = p_org_id
      AND (assignee_id = p_user_id OR created_by = p_user_id)
      AND status NOT IN ('DONE', 'CANCELLED');
    IF NOT FOUND THEN
      RETURN json_build_object('nodes', '[]'::JSON, 'complete', FALSE);
    END IF;
  ELSE
    SELECT id, code, title, type, status, initiative_id, parent_id
    INTO v_item
    FROM backlog_items
    WHERE organization_id = p_org_id
      AND (assignee_id = p_user_id OR created_by = p_user_id)
      AND status NOT IN ('DONE', 'CANCELLED')
    ORDER BY
      CASE type WHEN 'STORY' THEN 1 WHEN 'FEATURE' THEN 2 ELSE 3 END ASC,
      updated_at DESC NULLS LAST
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN json_build_object('nodes', '[]'::JSON, 'complete', FALSE);
    END IF;
  END IF;

  v_nodes   := v_nodes || jsonb_build_object('type', v_item.type, 'id', v_item.id, 'code', v_item.code,
                'title', v_item.title, 'status', v_item.status, 'href', '/backlog');
  v_init_id := v_item.initiative_id;

  v_parent_id := v_item.parent_id;
  v_depth     := 0;
  WHILE v_parent_id IS NOT NULL AND v_depth < 3 LOOP
    SELECT id, code, title, type, status, initiative_id, parent_id
    INTO v_parent
    FROM backlog_items
    WHERE id = v_parent_id;
    EXIT WHEN NOT FOUND;

    v_nodes := v_nodes || jsonb_build_object('type', v_parent.type, 'id', v_parent.id, 'code', v_parent.code,
                'title', v_parent.title, 'status', v_parent.status, 'href', '/backlog');

    IF v_init_id IS NULL THEN v_init_id := v_parent.initiative_id; END IF;
    EXIT WHEN v_parent.type = 'EPIC';

    v_parent_id := v_parent.parent_id;
    v_depth     := v_depth + 1;
  END LOOP;

  IF v_init_id IS NULL THEN
    RETURN json_build_object('nodes', v_nodes, 'complete', FALSE);
  END IF;

  SELECT id, code, title, status INTO v_initiative
  FROM initiatives
  WHERE id = v_init_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN json_build_object('nodes', v_nodes, 'complete', FALSE);
  END IF;

  v_nodes := v_nodes || jsonb_build_object('type', 'INITIATIVE', 'id', v_initiative.id, 'code', v_initiative.code,
              'title', v_initiative.title, 'status', v_initiative.status, 'href', '/initiatives');

  SELECT kr.id, kr.code, kr.title, kr.status,
         ROUND(kr.progress::NUMERIC) AS progress,
         kr.confidence::FLOAT        AS confidence,
         kr.objective_id
  INTO v_kr
  FROM key_results kr
  JOIN initiative_key_results ikr ON ikr.kr_id = kr.id
  WHERE ikr.initiative_id = v_initiative.id AND kr.deleted_at IS NULL
  ORDER BY kr.created_at ASC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('nodes', v_nodes, 'complete', FALSE);
  END IF;

  v_nodes := v_nodes || jsonb_build_object('type', 'KR', 'id', v_kr.id, 'code', v_kr.code,
              'title', v_kr.title, 'status', v_kr.status,
              'progress', v_kr.progress, 'confidence', v_kr.confidence,
              'href', '/tactical');

  v_obj_id := v_kr.objective_id;
  v_depth  := 0;
  WHILE v_obj_id IS NOT NULL AND v_depth < 5 LOOP
    SELECT id, code, title, level, status,
           ROUND(progress::NUMERIC) AS progress,
           parent_objective_id, strategic_intent_id
    INTO v_obj
    FROM objectives
    WHERE id = v_obj_id AND deleted_at IS NULL;
    EXIT WHEN NOT FOUND;

    v_nodes := v_nodes || jsonb_build_object(
                'type',     'OBJECTIVE_' || v_obj.level,
                'id',       v_obj.id,
                'code',     v_obj.code,
                'title',    v_obj.title,
                'status',   v_obj.status,
                'progress', v_obj.progress,
                'href',     CASE WHEN v_obj.level = 'TEAM' THEN '/tactical' ELSE '/strategic' END
              );

    IF v_obj.strategic_intent_id IS NOT NULL THEN
      SELECT id, code, title, status, category INTO v_intent
      FROM strategic_intents
      WHERE id = v_obj.strategic_intent_id AND deleted_at IS NULL;
      IF FOUND THEN
        v_nodes := v_nodes || jsonb_build_object('type', 'INTENT', 'id', v_intent.id, 'code', v_intent.code,
                    'title', v_intent.title, 'status', v_intent.status,
                    'category', v_intent.category, 'href', '/strategy');
      END IF;
      EXIT;
    END IF;

    v_obj_id := v_obj.parent_objective_id;
    v_depth  := v_depth + 1;
  END LOOP;

  SELECT vision_statement INTO v_vision
  FROM transformation_programs
  WHERE organization_id = p_org_id AND status = 'ACTIVE'
    AND vision_statement IS NOT NULL AND vision_statement <> ''
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_nodes   := v_nodes || jsonb_build_object('type', 'VISION', 'title', v_vision, 'href', '/program');
    v_complete := TRUE;
  ELSE
    v_complete := (v_nodes @> '[{"type":"INTENT"}]'::JSONB OR v_nodes @> '[{"type":"VISION"}]'::JSONB);
  END IF;

  RETURN json_build_object('nodes', v_nodes, 'complete', v_complete);
END;
$$;
