-- Migration 055 — WOW-3: Predicción avanzada de cierre de KR
-- fn_kr_forecast: velocidad, brecha, acción recomendada, escenarios
-- sp_send_forecast_notification: alerta proactiva al owner (dedup 48h)

-- ─── 1. Ampliar constraint de tipo de notificación ─────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'KR_AT_RISK','KR_COMPLETED','OBJ_COMPLETED',
    'CHECKIN_DUE','STALE_KR','MILESTONE_OVERDUE',
    'KR_FORECAST_ALERT'
  ));

-- ─── 2. fn_kr_forecast ─────────────────────────────────────────────────────
-- Retorna análisis completo de cierre: velocidad actual vs necesaria, brecha,
-- tipo de acción recomendada, 3 escenarios y compatibilidad total con
-- fn_predict_kr_completion (mismos campos legacy).
CREATE OR REPLACE FUNCTION fn_kr_forecast(p_kr_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_kr                    RECORD;
  v_cycle_end             DATE;
  v_slope                 FLOAT8;
  v_intercept             FLOAT8;
  v_count                 INT;
  v_min_epoch             FLOAT8;
  v_max_epoch             FLOAT8;
  v_epoch_now             FLOAT8;
  v_days_remaining        INT;
  v_weeks_remaining       NUMERIC;
  v_cadence_days          INT;
  v_days_since_ci         INT;
  v_pace_current          NUMERIC;
  v_pace_needed           NUMERIC;
  v_pace_ratio            NUMERIC;
  v_proj_val_cycle        NUMERIC;
  v_proj_val_30d          NUMERIC;
  v_proj_pct              NUMERIC;
  v_gap_units             NUMERIC;
  v_gap_pct               NUMERIC;
  v_is_on_pace            BOOLEAN;
  v_action_type           TEXT;
  v_rec_cw                INT;
  v_val_per_checkin       NUMERIC;
  v_base_per_week         NUMERIC;
  v_checkins_until_end    NUMERIC;
  v_trend                 TEXT;
  v_probability           NUMERIC;
  v_proj_date             TIMESTAMPTZ;
  v_epoch_tgt             FLOAT8;
  v_opt_pct               NUMERIC;
  v_base_pct              NUMERIC;
  v_pes_pct               NUMERIC;
BEGIN
  -- ── Cargar KR ──────────────────────────────────────────────────────────────
  SELECT kr.id, kr.title, kr.type, kr.metric_unit,
         kr.start_value, kr.target_value, kr.current_value,
         kr.progress, kr.status, kr.owner_id,
         kr.check_in_cadence, kr.last_checkin_at
    INTO v_kr
    FROM key_results kr
    WHERE kr.id = p_kr_id AND kr.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- ── Fecha fin del ciclo activo ─────────────────────────────────────────────
  SELECT c.end_date::DATE INTO v_cycle_end
    FROM cycles c
    JOIN objectives o ON o.cycle_id = c.id
    JOIN key_results kr ON kr.objective_id = o.id
    WHERE kr.id = p_kr_id AND c.status = 'ACTIVE'
    LIMIT 1;
  v_cycle_end := COALESCE(v_cycle_end, CURRENT_DATE + 90);

  v_days_remaining  := GREATEST(0, (v_cycle_end - CURRENT_DATE)::INT);
  v_weeks_remaining := ROUND(v_days_remaining / 7.0, 1);
  v_cadence_days    := fn_cadence_days(v_kr.check_in_cadence);
  v_epoch_now       := EXTRACT(epoch FROM NOW())::FLOAT8;

  -- ── Días desde último check-in ─────────────────────────────────────────────
  SELECT COALESCE(EXTRACT(DAY FROM NOW() - MAX(checked_at))::INT, 999)
    INTO v_days_since_ci
    FROM check_ins WHERE kr_id = p_kr_id;

  -- ── Completado ─────────────────────────────────────────────────────────────
  IF v_kr.progress >= 100 THEN
    RETURN jsonb_build_object(
      'trend','up','probability',1.0,
      'projected_date', NULL, 'projected_value', v_kr.current_value,
      'data_points', 0, 'insufficient_data', false,
      'action_type','COMPLETED',
      'projected_completion_pct', 100, 'gap_pct', 0, 'gap_units', 0,
      'pace_current_per_day', 0, 'pace_needed_per_day', 0, 'pace_ratio', 2.0,
      'days_remaining', v_days_remaining, 'weeks_remaining', v_weeks_remaining,
      'days_since_last_checkin', v_days_since_ci, 'cadence_days', v_cadence_days,
      'is_on_pace', true,
      'recommended_checkins_per_week', 1, 'value_needed_per_checkin', 0,
      'scenario_optimistic_pct', 100, 'scenario_base_pct', 100, 'scenario_pessimistic_pct', 100,
      'metric_unit', v_kr.metric_unit, 'kr_type', v_kr.type
    );
  END IF;

  -- ── Datos de regresión ──────────────────────────────────────────────────────
  SELECT COUNT(*),
         MIN(EXTRACT(epoch FROM checked_at)::FLOAT8),
         MAX(EXTRACT(epoch FROM checked_at)::FLOAT8)
    INTO v_count, v_min_epoch, v_max_epoch
    FROM check_ins WHERE kr_id = p_kr_id;

  -- ── Velocidad necesaria (siempre se calcula) ───────────────────────────────
  v_pace_needed := CASE v_kr.type
    WHEN 'INCREASE' THEN
      GREATEST(0, ROUND((v_kr.target_value - v_kr.current_value)::NUMERIC / GREATEST(1, v_days_remaining), 3))
    WHEN 'DECREASE' THEN
      GREATEST(0, ROUND((v_kr.current_value - v_kr.target_value)::NUMERIC / GREATEST(1, v_days_remaining), 3))
    ELSE 0 END;

  -- ── Datos insuficientes ────────────────────────────────────────────────────
  IF v_count < 2 OR (v_max_epoch - v_min_epoch) < 21600 THEN
    v_gap_units := CASE v_kr.type
      WHEN 'INCREASE' THEN GREATEST(0, ROUND(v_kr.target_value - v_kr.current_value, 2))
      WHEN 'DECREASE' THEN GREATEST(0, ROUND(v_kr.current_value - v_kr.target_value, 2))
      ELSE 0 END;
    RETURN jsonb_build_object(
      'trend','flat','probability',0.5,
      'projected_date', NULL, 'projected_value', v_kr.current_value,
      'data_points', v_count, 'insufficient_data', true,
      'action_type', CASE WHEN v_days_since_ci >= v_cadence_days THEN 'URGENT_CHECKIN' ELSE 'INSUFFICIENT_DATA' END,
      'projected_completion_pct', ROUND(v_kr.progress, 1),
      'gap_pct', GREATEST(0, ROUND(100 - v_kr.progress, 1)),
      'gap_units', v_gap_units,
      'pace_current_per_day', 0, 'pace_needed_per_day', v_pace_needed, 'pace_ratio', 0,
      'days_remaining', v_days_remaining, 'weeks_remaining', v_weeks_remaining,
      'days_since_last_checkin', v_days_since_ci, 'cadence_days', v_cadence_days,
      'is_on_pace', false,
      'recommended_checkins_per_week', CEIL(7.0 / v_cadence_days)::INT,
      'value_needed_per_checkin', ROUND(v_gap_units / GREATEST(1, v_weeks_remaining * CEIL(7.0 / v_cadence_days)), 2),
      'scenario_optimistic_pct', LEAST(100, ROUND(v_kr.progress * 1.25, 1)),
      'scenario_base_pct', ROUND(v_kr.progress, 1),
      'scenario_pessimistic_pct', GREATEST(0, ROUND(v_kr.progress * 0.65, 1)),
      'metric_unit', v_kr.metric_unit, 'kr_type', v_kr.type
    );
  END IF;

  -- ── Regresión lineal ────────────────────────────────────────────────────────
  SELECT regr_slope(current_value,     EXTRACT(epoch FROM checked_at)::FLOAT8),
         regr_intercept(current_value, EXTRACT(epoch FROM checked_at)::FLOAT8)
    INTO v_slope, v_intercept
    FROM check_ins WHERE kr_id = p_kr_id;

  -- ── Valor proyectado al cierre del ciclo ───────────────────────────────────
  v_proj_val_cycle := v_slope * (v_epoch_now + 86400.0 * v_days_remaining) + v_intercept;
  v_proj_val_cycle := GREATEST(
    v_kr.start_value::FLOAT8 - ABS(v_kr.target_value::FLOAT8 - v_kr.start_value::FLOAT8) * 2,
    LEAST(
      v_kr.start_value::FLOAT8 + ABS(v_kr.target_value::FLOAT8 - v_kr.start_value::FLOAT8) * 3,
      v_proj_val_cycle
    )
  );
  v_proj_val_cycle := ROUND(v_proj_val_cycle::NUMERIC, 2);

  -- Valor proyectado en 30 días (para compatibilidad legacy)
  v_proj_val_30d := ROUND(
    GREATEST(
      v_kr.start_value::FLOAT8 - ABS(v_kr.target_value::FLOAT8 - v_kr.start_value::FLOAT8) * 5,
      LEAST(
        v_kr.start_value::FLOAT8 + ABS(v_kr.target_value::FLOAT8 - v_kr.start_value::FLOAT8) * 5,
        v_slope * (v_epoch_now + 86400.0 * 30.0) + v_intercept
      )
    )::NUMERIC, 2
  );

  -- ── % de cumplimiento proyectado al cierre ─────────────────────────────────
  v_proj_pct := CASE v_kr.type
    WHEN 'INCREASE' THEN
      CASE WHEN v_kr.target_value = v_kr.start_value THEN 100
           ELSE GREATEST(0, LEAST(100,
             ROUND((v_proj_val_cycle - v_kr.start_value) / (v_kr.target_value - v_kr.start_value) * 100, 1)))
      END
    WHEN 'DECREASE' THEN
      CASE WHEN v_kr.start_value = v_kr.target_value THEN 100
           ELSE GREATEST(0, LEAST(100,
             ROUND((v_kr.start_value - v_proj_val_cycle) / (v_kr.start_value - v_kr.target_value) * 100, 1)))
      END
    WHEN 'ACHIEVE' THEN CASE WHEN v_proj_val_cycle >= v_kr.target_value THEN 100.0 ELSE 0.0 END
    ELSE ROUND(v_kr.progress, 1)
  END;

  -- ── Brecha al cierre ────────────────────────────────────────────────────────
  v_gap_pct   := GREATEST(0, ROUND(100 - v_proj_pct, 1));
  v_gap_units := CASE v_kr.type
    WHEN 'INCREASE' THEN GREATEST(0, ROUND(v_kr.target_value - v_proj_val_cycle, 2))
    WHEN 'DECREASE' THEN GREATEST(0, ROUND(v_proj_val_cycle - v_kr.target_value, 2))
    ELSE 0 END;

  -- ── Velocidades ─────────────────────────────────────────────────────────────
  v_pace_current := ROUND(ABS(v_slope * 86400)::NUMERIC, 3);
  v_pace_ratio   := CASE
    WHEN v_pace_needed <= 0 THEN 2.0
    ELSE ROUND(v_pace_current / v_pace_needed, 2)
  END;
  v_is_on_pace := v_proj_pct >= 95;

  -- ── Tendencia ───────────────────────────────────────────────────────────────
  v_trend := CASE
    WHEN v_slope > 0 AND v_kr.type IN ('INCREASE','ACHIEVE') THEN 'up'
    WHEN v_slope < 0 AND v_kr.type = 'DECREASE'              THEN 'up'
    WHEN v_slope < 0 AND v_kr.type IN ('INCREASE','ACHIEVE') THEN 'down'
    WHEN v_slope > 0 AND v_kr.type = 'DECREASE'              THEN 'down'
    ELSE 'flat'
  END;

  -- ── Probabilidad (basada en proyección, no sólo slope) ────────────────────
  v_probability := ROUND(
    GREATEST(0.05, LEAST(0.97, v_proj_pct / 100.0 * 0.85 + 0.08))::NUMERIC, 2
  );

  -- ── Fecha proyectada para alcanzar la meta ─────────────────────────────────
  IF v_slope IS NOT NULL AND v_slope <> 0 THEN
    v_epoch_tgt := (v_kr.target_value::FLOAT8 - v_intercept) / v_slope;
    -- Guard before to_timestamp: only convert if epoch is within [-1yr, +10yr] from now
    -- Prevents "timestamp out of range" when slope is near-zero and target is large
    IF v_epoch_tgt BETWEEN (v_epoch_now - 86400.0 * 366)
                       AND (v_epoch_now + 86400.0 * 3653) THEN
      v_proj_date := to_timestamp(v_epoch_tgt);
    END IF;
  END IF;

  -- ── Tipo de acción recomendada ──────────────────────────────────────────────
  v_action_type := CASE
    WHEN v_days_since_ci >= v_cadence_days THEN 'URGENT_CHECKIN'
    WHEN v_is_on_pace                      THEN 'ON_TRACK'
    ELSE                                        'INCREASE_PACE'
  END;

  -- ── Check-ins recomendados por semana ──────────────────────────────────────
  v_base_per_week := 7.0 / v_cadence_days;
  v_rec_cw := CASE
    WHEN NOT v_is_on_pace AND v_pace_ratio < 0.5  THEN GREATEST(2, CEIL(v_base_per_week * 2)::INT)
    WHEN NOT v_is_on_pace AND v_pace_ratio < 0.75 THEN GREATEST(2, CEIL(v_base_per_week * 1.5)::INT)
    ELSE CEIL(v_base_per_week)::INT
  END;

  -- ── Valor necesario por check-in ──────────────────────────────────────────
  v_checkins_until_end := GREATEST(1, v_weeks_remaining * v_rec_cw);
  v_val_per_checkin := CASE
    WHEN v_gap_units > 0 THEN ROUND(v_gap_units / v_checkins_until_end, 2)
    ELSE 0
  END;

  -- ── Escenarios ─────────────────────────────────────────────────────────────
  v_base_pct := v_proj_pct;
  v_opt_pct  := LEAST(100, ROUND(v_proj_pct * 1.25, 1));
  v_pes_pct  := GREATEST(0,  ROUND(v_proj_pct * 0.65, 1));

  RETURN jsonb_build_object(
    -- Legacy (backward-compatible con fn_predict_kr_completion)
    'trend',             v_trend,
    'probability',       v_probability,
    'projected_date',    v_proj_date,
    'projected_value',   v_proj_val_30d,
    'data_points',       v_count,
    'insufficient_data', false,
    -- Nuevos campos WOW-3
    'pace_current_per_day',          v_pace_current,
    'pace_needed_per_day',           v_pace_needed,
    'pace_ratio',                    v_pace_ratio,
    'projected_value_at_cycle_end',  v_proj_val_cycle,
    'projected_completion_pct',      v_proj_pct,
    'gap_units',                     v_gap_units,
    'gap_pct',                       v_gap_pct,
    'days_remaining',                v_days_remaining,
    'weeks_remaining',               v_weeks_remaining,
    'is_on_pace',                    v_is_on_pace,
    'action_type',                   v_action_type,
    'recommended_checkins_per_week', v_rec_cw,
    'value_needed_per_checkin',      v_val_per_checkin,
    'scenario_optimistic_pct',       v_opt_pct,
    'scenario_base_pct',             v_base_pct,
    'scenario_pessimistic_pct',      v_pes_pct,
    'days_since_last_checkin',       v_days_since_ci,
    'cadence_days',                  v_cadence_days,
    'metric_unit',                   v_kr.metric_unit,
    'kr_type',                       v_kr.type
  );
END;
$$;

-- ─── 3. sp_send_forecast_notification ──────────────────────────────────────
-- Inserta KR_FORECAST_ALERT para el owner si el KR está en riesgo.
-- Deduplicación: no envía si ya hay una notif del mismo KR en las últimas 48h.
CREATE OR REPLACE PROCEDURE sp_send_forecast_notification(
  p_kr_id  UUID,
  p_org_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  v_forecast  JSONB;
  v_kr_title  TEXT;
  v_owner_id  UUID;
  v_action    TEXT;
  v_gap_units NUMERIC;
  v_gap_pct   NUMERIC;
  v_unit      TEXT;
  v_days      INT;
  v_proj_pct  NUMERIC;
  v_rec_cw    INT;
  v_vpci      NUMERIC;
  v_days_ci   INT;
  v_body      TEXT;
BEGIN
  -- Dedup
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = p_kr_id
      AND type = 'KR_FORECAST_ALERT'
      AND created_at > NOW() - INTERVAL '48 hours'
  ) THEN RETURN; END IF;

  v_forecast := fn_kr_forecast(p_kr_id);
  IF v_forecast IS NULL THEN RETURN; END IF;

  v_action := v_forecast->>'action_type';
  IF v_action NOT IN ('INCREASE_PACE','URGENT_CHECKIN') THEN RETURN; END IF;

  SELECT kr.title, kr.owner_id
    INTO v_kr_title, v_owner_id
    FROM key_results kr
    JOIN objectives o ON o.id = kr.objective_id
    WHERE kr.id = p_kr_id AND o.organization_id = p_org_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_gap_units := ROUND((v_forecast->>'gap_units')::NUMERIC, 1);
  v_gap_pct   := ROUND((v_forecast->>'gap_pct')::NUMERIC, 0);
  v_unit      := COALESCE(v_forecast->>'metric_unit', '');
  v_days      := (v_forecast->>'days_remaining')::INT;
  v_proj_pct  := ROUND((v_forecast->>'projected_completion_pct')::NUMERIC, 0);
  v_rec_cw    := (v_forecast->>'recommended_checkins_per_week')::INT;
  v_vpci      := ROUND((v_forecast->>'value_needed_per_checkin')::NUMERIC, 1);
  v_days_ci   := (v_forecast->>'days_since_last_checkin')::INT;

  v_body := CASE v_action
    WHEN 'URGENT_CHECKIN' THEN
      'Llevas ' || v_days_ci || ' días sin registrar progreso'
      || ' (cadencia: cada ' || (v_forecast->>'cadence_days') || ' días).'
      || ' Quedan ' || v_days || ' días en el ciclo. Registra un check-in hoy.'
    WHEN 'INCREASE_PACE' THEN
      'A este ritmo cerrarás en ' || v_proj_pct || '%'
      || CASE WHEN v_gap_units > 0 THEN ' (' || v_gap_units || ' ' || v_unit || ' por debajo de la meta)' ELSE '' END || '.'
      || ' Necesitas ' || v_rec_cw || ' check-in(s)/semana'
      || CASE WHEN v_vpci > 0 THEN ' avanzando +' || v_vpci || ' ' || v_unit || '/check-in' ELSE '' END
      || '. Quedan ' || v_days || ' días.'
    ELSE '' END;

  INSERT INTO notifications(id, organization_id, user_id, type, title, body, entity_type, entity_id)
  VALUES (
    gen_random_uuid(),
    p_org_id, v_owner_id,
    'KR_FORECAST_ALERT',
    'Alerta de cierre: ' || LEFT(v_kr_title, 55),
    v_body,
    'key_result', p_kr_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION  fn_kr_forecast(UUID)                         TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_send_forecast_notification(UUID, UUID)    TO okr_user;
