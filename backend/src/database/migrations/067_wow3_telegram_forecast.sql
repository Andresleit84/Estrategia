-- Migration 056 — WOW-3 Telegram: sp_send_forecast_notification con INOUT p_notification_id
-- Agrega parámetro INOUT para que el backend sepa si se creó una notificación nueva
-- (y así pueda disparar el mensaje Telegram sin una segunda consulta de dedup)

CREATE OR REPLACE PROCEDURE sp_send_forecast_notification(
  p_kr_id          UUID,
  p_org_id         UUID,
  INOUT p_notification_id UUID DEFAULT NULL
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
  v_new_id    UUID;
BEGIN
  p_notification_id := NULL;

  -- Dedup 48h
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

  v_new_id := gen_random_uuid();

  INSERT INTO notifications(id, organization_id, user_id, type, title, body, entity_type, entity_id)
  VALUES (
    v_new_id,
    p_org_id, v_owner_id,
    'KR_FORECAST_ALERT',
    'Alerta de cierre: ' || LEFT(v_kr_title, 55),
    v_body,
    'key_result', p_kr_id
  );

  p_notification_id := v_new_id;
END;
$$;

GRANT EXECUTE ON PROCEDURE sp_send_forecast_notification(UUID, UUID, UUID) TO okr_user;
