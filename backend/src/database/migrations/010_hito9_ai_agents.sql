-- Hito 9: AI Agents + MCP Tools avanzadas

-- Tabla para persistir briefings generados por IA
CREATE TABLE IF NOT EXISTS ai_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES cycles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('risk_sentinel','executive_briefing','alignment_audit','cycle_close')),
  title TEXT NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_briefings_org ON ai_briefings(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_briefings_cycle ON ai_briefings(cycle_id) WHERE cycle_id IS NOT NULL;

-- Tabla para historial de conversaciones del Strategy Advisor
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES cycles(id) ON DELETE SET NULL,
  title TEXT,
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);

-- Función: comparar dos ciclos
CREATE OR REPLACE FUNCTION fn_compare_cycles(
  p_cycle_id_1 uuid,
  p_cycle_id_2 uuid
) RETURNS jsonb AS $$
DECLARE
  v_c1 jsonb;
  v_c2 jsonb;
  v_prog1 numeric;
  v_prog2 numeric;
  v_score1 numeric;
  v_score2 numeric;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id, 'name', c.name,
    'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
    'objective_count', (SELECT COUNT(*) FROM objectives o WHERE o.cycle_id = c.id AND o.deleted_at IS NULL),
    'checkin_count', (
      SELECT COUNT(*) FROM check_ins ci
      JOIN key_results kr ON kr.id = ci.kr_id
      JOIN objectives o ON o.id = kr.objective_id
      WHERE o.cycle_id = c.id
    ),
    'completed_krs', (
      SELECT COUNT(*) FROM key_results kr
      JOIN objectives o ON o.id = kr.objective_id
      WHERE o.cycle_id = c.id AND kr.status = 'COMPLETED' AND kr.deleted_at IS NULL
    )
  ) INTO v_c1 FROM cycles c WHERE c.id = p_cycle_id_1;

  SELECT jsonb_build_object(
    'id', c.id, 'name', c.name,
    'start_date', c.start_date, 'end_date', c.end_date, 'status', c.status,
    'objective_count', (SELECT COUNT(*) FROM objectives o WHERE o.cycle_id = c.id AND o.deleted_at IS NULL),
    'checkin_count', (
      SELECT COUNT(*) FROM check_ins ci
      JOIN key_results kr ON kr.id = ci.kr_id
      JOIN objectives o ON o.id = kr.objective_id
      WHERE o.cycle_id = c.id
    ),
    'completed_krs', (
      SELECT COUNT(*) FROM key_results kr
      JOIN objectives o ON o.id = kr.objective_id
      WHERE o.cycle_id = c.id AND kr.status = 'COMPLETED' AND kr.deleted_at IS NULL
    )
  ) INTO v_c2 FROM cycles c WHERE c.id = p_cycle_id_2;

  SELECT COALESCE(AVG(fn_calculate_objective_progress(o.id)), 0)
  INTO v_prog1
  FROM objectives o WHERE o.cycle_id = p_cycle_id_1 AND o.deleted_at IS NULL;

  SELECT COALESCE(AVG(fn_calculate_objective_progress(o.id)), 0)
  INTO v_prog2
  FROM objectives o WHERE o.cycle_id = p_cycle_id_2 AND o.deleted_at IS NULL;

  v_score1 := COALESCE(fn_get_cycle_score(p_cycle_id_1), 0);
  v_score2 := COALESCE(fn_get_cycle_score(p_cycle_id_2), 0);

  RETURN jsonb_build_object(
    'cycle_1', v_c1 || jsonb_build_object('avg_progress', ROUND(v_prog1::numeric,1), 'score', v_score1),
    'cycle_2', v_c2 || jsonb_build_object('avg_progress', ROUND(v_prog2::numeric,1), 'score', v_score2),
    'delta', jsonb_build_object(
      'progress_change', ROUND((v_prog2 - v_prog1)::numeric, 1),
      'score_change', ROUND((v_score2 - v_score1)::numeric, 1),
      'trend', CASE
        WHEN v_prog2 > v_prog1 + 5 THEN 'IMPROVING'
        WHEN v_prog2 < v_prog1 - 5 THEN 'DECLINING'
        ELSE 'STABLE'
      END
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Función: simular 3 escenarios para un KR
CREATE OR REPLACE FUNCTION fn_run_scenario(
  p_kr_id uuid,
  p_optimistic_factor numeric DEFAULT 1.3,
  p_pessimistic_factor numeric DEFAULT 0.6
) RETURNS jsonb AS $$
DECLARE
  v_kr RECORD;
  v_pred jsonb;
  v_base_prob numeric;
  v_base_value numeric;
  v_range numeric;
BEGIN
  SELECT kr.id, kr.title, kr.type, kr.start_value, kr.current_value, kr.target_value,
         kr.metric_unit, kr.status, o.title as objective_title
  INTO v_kr
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  WHERE kr.id = p_kr_id AND kr.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'KR not found');
  END IF;

  v_pred := fn_predict_kr_completion(p_kr_id);
  v_base_prob := COALESCE((v_pred->>'probability')::numeric, 0.5);
  v_base_value := COALESCE((v_pred->>'projected_value')::numeric, v_kr.current_value);
  v_range := ABS(v_kr.target_value - v_kr.start_value);

  RETURN jsonb_build_object(
    'kr_id', p_kr_id,
    'kr_title', v_kr.title,
    'objective_title', v_kr.objective_title,
    'current_value', v_kr.current_value,
    'target_value', v_kr.target_value,
    'metric_unit', v_kr.metric_unit,
    'scenarios', jsonb_build_array(
      jsonb_build_object(
        'name', 'Optimista',
        'color', '#22c55e',
        'description', 'Ritmo superior al actual mantenido',
        'projected_value', ROUND(LEAST(v_base_value + v_range * 0.2, v_kr.target_value)::numeric, 1),
        'probability', ROUND(LEAST(v_base_prob * p_optimistic_factor, 0.95)::numeric, 2)
      ),
      jsonb_build_object(
        'name', 'Base',
        'color', '#3b82f6',
        'description', 'Continuando al ritmo actual',
        'projected_value', ROUND(v_base_value::numeric, 1),
        'probability', ROUND(v_base_prob::numeric, 2),
        'projected_date', v_pred->>'projected_date'
      ),
      jsonb_build_object(
        'name', 'Pesimista',
        'color', '#ef4444',
        'description', 'Ritmo disminuye significativamente',
        'projected_value', ROUND(GREATEST(v_base_value - v_range * 0.25, v_kr.start_value)::numeric, 1),
        'probability', ROUND(GREATEST(v_base_prob * p_pessimistic_factor, 0.05)::numeric, 2)
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Vista: resumen para MCP audit
CREATE OR REPLACE VIEW v_mcp_audit_summary AS
SELECT
  organization_id,
  DATE_TRUNC('day', created_at) as day,
  tool_name,
  COUNT(*) as call_count,
  AVG(duration_ms) as avg_duration_ms,
  COUNT(*) FILTER (WHERE error IS NOT NULL) as error_count
FROM mcp_audit_log
GROUP BY organization_id, DATE_TRUNC('day', created_at), tool_name;
