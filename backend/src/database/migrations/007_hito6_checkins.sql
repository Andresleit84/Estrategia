-- ================================================================
-- Migración 007 — Hito 6: Check-ins + progreso en cascada
-- ================================================================

-- ----------------------------------------------------------------
-- ADD: completed_at a key_results
-- ----------------------------------------------------------------
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ----------------------------------------------------------------
-- TABLA: check_ins
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS check_ins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kr_id         UUID NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_value NUMERIC(15,4) NOT NULL,
  confidence    NUMERIC(3,2)  NOT NULL DEFAULT 0.5
                  CHECK (confidence >= 0.0 AND confidence <= 1.0),
  notes         TEXT,
  mood          TEXT CHECK (mood IN ('GREAT', 'GOOD', 'NEUTRAL', 'CONCERNED', 'BLOCKED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLA: notifications
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN ('KR_AT_RISK','KR_COMPLETED','OBJ_COMPLETED','CHECKIN_DUE','STALE_KR','MILESTONE_OVERDUE')),
  title           TEXT NOT NULL,
  body            TEXT,
  entity_type     TEXT CHECK (entity_type IN ('key_result','objective','cycle','milestone')),
  entity_id       UUID,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_checkins_kr_created
  ON check_ins(kr_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_key_results_last_checkin
  ON key_results(last_checkin_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_org
  ON notifications(organization_id, created_at DESC);

-- ----------------------------------------------------------------
-- TRIGGER: previene check-in con fecha anterior al último registrado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_past_checkin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_last TIMESTAMPTZ;
BEGIN
  SELECT MAX(checked_at) INTO v_last
    FROM check_ins
   WHERE kr_id = NEW.kr_id;

  IF v_last IS NOT NULL AND NEW.checked_at < v_last THEN
    RAISE EXCEPTION 'La fecha del check-in no puede ser anterior al último check-in registrado (%).',
      to_char(v_last, 'YYYY-MM-DD HH24:MI')
      USING ERRCODE = 'P0020';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_prevent_past_checkin
  BEFORE INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_past_checkin();

-- ----------------------------------------------------------------
-- TRIGGER: audit log en check_ins
-- ----------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_audit_log_checkins
  AFTER INSERT OR UPDATE OR DELETE ON check_ins
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ----------------------------------------------------------------
-- TRIGGER: recálculo en cascada después de un check-in
-- Actualiza KR → objetivo → objetivos padre, auto-completa si 100%
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_checkin_cascade_recalc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_kr            RECORD;
  v_new_progress  NUMERIC(5,2);
  v_new_status    TEXT;
  v_obj_id        UUID;
  v_obj_progress  NUMERIC(5,2);
  v_parent_id     UUID;
  v_org_id        UUID;
  v_kr_owner_id   UUID;
BEGIN
  SELECT kr.*, o.organization_id, o.id AS obj_id_direct
    INTO v_kr
    FROM key_results kr
    JOIN objectives o ON kr.objective_id = o.id
   WHERE kr.id = NEW.kr_id;

  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_kr.status IN ('COMPLETED', 'CANCELLED') THEN RETURN NEW; END IF;

  v_org_id     := v_kr.organization_id;
  v_kr_owner_id := v_kr.owner_id;

  -- ── Calcular progreso inline (mismo algoritmo que fn_calculate_kr_progress) ──
  v_new_progress := CASE v_kr.type
    WHEN 'INCREASE' THEN
      CASE WHEN v_kr.target_value = v_kr.start_value THEN 100.0
      ELSE GREATEST(0.0, LEAST(100.0,
        (NEW.current_value - v_kr.start_value) / (v_kr.target_value - v_kr.start_value) * 100.0))
      END
    WHEN 'DECREASE' THEN
      CASE WHEN v_kr.start_value = v_kr.target_value THEN 100.0
      ELSE GREATEST(0.0, LEAST(100.0,
        (v_kr.start_value - NEW.current_value) / (v_kr.start_value - v_kr.target_value) * 100.0))
      END
    WHEN 'MAINTAIN' THEN
      CASE WHEN v_kr.target_value = 0 THEN 100.0
      ELSE GREATEST(0.0, 100.0 - (ABS(NEW.current_value - v_kr.target_value) / ABS(v_kr.target_value) * 100.0))
      END
    WHEN 'ACHIEVE' THEN
      CASE WHEN NEW.current_value >= v_kr.target_value THEN 100.0 ELSE 0.0 END
    ELSE 0.0
  END;

  -- ── Determinar nuevo estado ──
  v_new_status := CASE
    WHEN v_new_progress >= 100.0 THEN 'COMPLETED'
    WHEN NEW.confidence < 0.35 THEN 'AT_RISK'
    WHEN v_new_progress < 30.0  THEN 'BEHIND'
    ELSE 'ON_TRACK'
  END;

  -- ── Actualizar KR en un solo UPDATE ──
  UPDATE key_results SET
    current_value   = NEW.current_value,
    confidence      = NEW.confidence,
    last_checkin_at = NEW.checked_at,
    progress        = v_new_progress,
    status          = v_new_status,
    completed_at    = CASE
                        WHEN v_new_status = 'COMPLETED' AND completed_at IS NULL THEN NOW()
                        ELSE completed_at
                      END
  WHERE id = NEW.kr_id;

  -- ── Notificación si KR pasa a AT_RISK o COMPLETED ──
  IF v_new_status = 'AT_RISK' AND v_kr.status <> 'AT_RISK' THEN
    INSERT INTO notifications(organization_id, user_id, type, title, body, entity_type, entity_id)
    VALUES (
      v_org_id,
      v_kr_owner_id,
      'KR_AT_RISK',
      'KR en riesgo: ' || LEFT(v_kr.title, 60),
      'La confianza bajó a ' || ROUND(NEW.confidence * 100)::TEXT || '%. El resultado clave requiere atención.',
      'key_result',
      NEW.kr_id
    );
  ELSIF v_new_status = 'COMPLETED' AND v_kr.status <> 'COMPLETED' THEN
    INSERT INTO notifications(organization_id, user_id, type, title, body, entity_type, entity_id)
    VALUES (
      v_org_id,
      v_kr_owner_id,
      'KR_COMPLETED',
      '¡KR completado! ' || LEFT(v_kr.title, 60),
      'Alcanzaste el objetivo: ' || NEW.current_value::TEXT || ' ' || v_kr.metric_unit || '.',
      'key_result',
      NEW.kr_id
    );
  END IF;

  -- ── Propagar progreso hacia arriba en la jerarquía ──
  v_obj_id := v_kr.objective_id;
  LOOP
    SELECT fn_calculate_objective_progress(v_obj_id) INTO v_obj_progress;
    UPDATE objectives SET progress = v_obj_progress WHERE id = v_obj_id;

    -- Auto-completar objetivo si todos los KRs activos están completos
    IF NOT EXISTS (
      SELECT 1 FROM key_results
      WHERE objective_id = v_obj_id
        AND status NOT IN ('COMPLETED', 'CANCELLED')
        AND deleted_at IS NULL
    ) AND EXISTS (
      SELECT 1 FROM key_results
      WHERE objective_id = v_obj_id
        AND status = 'COMPLETED'
        AND deleted_at IS NULL
    ) THEN
      UPDATE objectives
      SET status = 'COMPLETED'
      WHERE id = v_obj_id AND status NOT IN ('COMPLETED', 'CANCELLED');
    END IF;

    SELECT parent_objective_id INTO v_parent_id FROM objectives WHERE id = v_obj_id;
    EXIT WHEN v_parent_id IS NULL;
    v_obj_id := v_parent_id;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_checkin_cascade_recalc
  AFTER INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION fn_checkin_cascade_recalc();

-- ----------------------------------------------------------------
-- FUNCIÓN: predicción de completion del KR (regresión lineal)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_predict_kr_completion(p_kr_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_kr          RECORD;
  v_slope       FLOAT8;
  v_intercept   FLOAT8;
  v_count       INT;
  v_min_epoch   FLOAT8;
  v_max_epoch   FLOAT8;
  v_epoch_now   FLOAT8;
  v_epoch_tgt   FLOAT8;
  v_proj_date   TIMESTAMPTZ;
  v_proj_val    NUMERIC;
  v_trend       TEXT;
  v_probability NUMERIC;
BEGIN
  SELECT * INTO v_kr FROM key_results WHERE id = p_kr_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT
    COUNT(*),
    MIN(EXTRACT(epoch FROM checked_at)::FLOAT8),
    MAX(EXTRACT(epoch FROM checked_at)::FLOAT8)
  INTO v_count, v_min_epoch, v_max_epoch
  FROM check_ins WHERE kr_id = p_kr_id;

  -- Require ≥2 check-ins AND at least 6 hours apart for a meaningful regression
  IF v_count < 2 OR (v_max_epoch - v_min_epoch) < 21600 THEN
    RETURN jsonb_build_object(
      'trend',             'flat',
      'probability',       0.5,
      'insufficient_data', true,
      'data_points',       v_count
    );
  END IF;

  SELECT
    regr_slope(current_value,     EXTRACT(epoch FROM checked_at)::FLOAT8),
    regr_intercept(current_value, EXTRACT(epoch FROM checked_at)::FLOAT8)
  INTO v_slope, v_intercept
  FROM check_ins WHERE kr_id = p_kr_id;

  v_epoch_now := EXTRACT(epoch FROM NOW())::FLOAT8;

  -- Projected value in 30 days — clamped to ±5× target range to avoid absurd numbers
  v_proj_val := ROUND(
    GREATEST(
      v_kr.start_value::FLOAT8 - ABS(v_kr.target_value::FLOAT8 - v_kr.start_value::FLOAT8) * 5,
      LEAST(
        v_kr.start_value::FLOAT8 + ABS(v_kr.target_value::FLOAT8 - v_kr.start_value::FLOAT8) * 5,
        v_slope * (v_epoch_now + 86400.0 * 30.0) + v_intercept
      )
    )::NUMERIC, 2
  );

  IF v_slope IS NOT NULL AND v_slope <> 0 THEN
    v_epoch_tgt := (v_kr.target_value::FLOAT8 - v_intercept) / v_slope;
    v_proj_date := to_timestamp(v_epoch_tgt);
    IF v_proj_date < NOW() - INTERVAL '1 day'
       OR v_proj_date > NOW() + INTERVAL '2 years' THEN
      v_proj_date := NULL;
    END IF;
  END IF;

  v_trend := CASE
    WHEN v_slope > 0 AND v_kr.type IN ('INCREASE','ACHIEVE') THEN 'up'
    WHEN v_slope < 0 AND v_kr.type = 'DECREASE'              THEN 'up'
    WHEN v_slope < 0 AND v_kr.type IN ('INCREASE','ACHIEVE') THEN 'down'
    WHEN v_slope > 0 AND v_kr.type = 'DECREASE'              THEN 'down'
    ELSE 'flat' END;

  v_probability := CASE
    WHEN v_kr.progress >= 100  THEN 1.0
    WHEN v_proj_date IS NOT NULL THEN
      GREATEST(0.1, LEAST(0.9, v_kr.progress / 100.0 +
        CASE WHEN v_slope > 0 AND v_kr.type IN ('INCREASE','ACHIEVE') THEN 0.2
             WHEN v_slope < 0 AND v_kr.type = 'DECREASE'             THEN 0.2
             ELSE -0.2 END))
    WHEN v_slope > 0 AND v_kr.type IN ('INCREASE','ACHIEVE') THEN 0.6
    WHEN v_slope < 0 AND v_kr.type = 'DECREASE'              THEN 0.6
    ELSE 0.3 END;

  RETURN jsonb_build_object(
    'trend',             v_trend,
    'probability',       v_probability,
    'projected_date',    v_proj_date,
    'projected_value',   v_proj_val,
    'data_points',       v_count,
    'insufficient_data', false
  );
END;
$$;

-- ----------------------------------------------------------------
-- FUNCIÓN: días desde el último check-in de un KR
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_days_since_last_checkin(p_kr_id UUID)
RETURNS INT LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_last TIMESTAMPTZ;
BEGIN
  SELECT MAX(checked_at) INTO v_last FROM check_ins WHERE kr_id = p_kr_id;
  IF v_last IS NULL THEN RETURN NULL; END IF;
  RETURN EXTRACT(DAY FROM NOW() - v_last)::INT;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: crea un check-in (los triggers hacen el resto)
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_create_check_in(
  p_kr_id       UUID,
  p_user_id     UUID,
  p_value       NUMERIC,
  p_confidence  NUMERIC,
  p_notes       TEXT,
  p_mood        TEXT,
  INOUT p_checkin_id UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO check_ins(kr_id, user_id, current_value, confidence, notes, mood, checked_at)
  VALUES (p_kr_id, p_user_id, p_value, p_confidence, p_notes, p_mood, NOW())
  RETURNING id INTO p_checkin_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: marca KRs sin check-in reciente como AT_RISK
-- Llamado por cron nightly
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_mark_stale_krs_at_risk(p_org_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE key_results kr
  SET status = 'AT_RISK'
  FROM objectives o
  WHERE kr.objective_id   = o.id
    AND o.organization_id = p_org_id
    AND kr.deleted_at IS NULL
    AND o.deleted_at  IS NULL
    AND o.status      = 'ACTIVE'
    AND kr.status     = 'ON_TRACK'
    AND (
      kr.last_checkin_at IS NULL
      OR kr.last_checkin_at < NOW() - INTERVAL '14 days'
    );

  -- Insertar notificaciones para los KRs recién marcados
  INSERT INTO notifications(organization_id, user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT
    o.organization_id,
    kr.owner_id,
    'STALE_KR',
    'KR sin check-in: ' || LEFT(kr.title, 60),
    'Llevas más de 14 días sin registrar progreso en este resultado clave.',
    'key_result',
    kr.id
  FROM key_results kr
  JOIN objectives o ON kr.objective_id = o.id
  WHERE o.organization_id = p_org_id
    AND kr.status = 'AT_RISK'
    AND kr.deleted_at IS NULL
    AND o.status = 'ACTIVE'
    AND (
      kr.last_checkin_at IS NULL
      OR kr.last_checkin_at < NOW() - INTERVAL '14 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.entity_id = kr.id
        AND n.type = 'STALE_KR'
        AND n.created_at > NOW() - INTERVAL '7 days'
    );
END;
$$;

-- ----------------------------------------------------------------
-- VISTA: historial de check-ins con delta
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_check_in_history AS
SELECT
  ci.id,
  ci.kr_id,
  ci.user_id,
  ci.checked_at,
  ci.current_value,
  ci.confidence,
  ci.notes,
  ci.mood,
  ci.created_at,
  kr.title          AS kr_title,
  kr.metric_unit,
  kr.target_value,
  kr.start_value,
  kr.type           AS kr_type,
  o.organization_id,
  o.cycle_id,
  u.name            AS checked_by_name,
  LAG(ci.current_value) OVER (PARTITION BY ci.kr_id ORDER BY ci.checked_at) AS prev_value,
  ci.current_value
    - LAG(ci.current_value) OVER (PARTITION BY ci.kr_id ORDER BY ci.checked_at) AS delta
FROM check_ins ci
JOIN key_results kr ON ci.kr_id = kr.id
JOIN objectives  o  ON kr.objective_id = o.id
JOIN users       u  ON ci.user_id = u.id;

-- ----------------------------------------------------------------
-- VISTA: KRs en riesgo, ordenados por impacto estratégico
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_at_risk_krs AS
SELECT
  kr.id,
  kr.title              AS kr_title,
  kr.metric_unit,
  kr.current_value,
  kr.target_value,
  kr.progress,
  kr.confidence,
  kr.status,
  kr.last_checkin_at,
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INT, 999) AS days_since_checkin,
  kr.owner_id,
  u.name                AS owner_name,
  o.id                  AS objective_id,
  o.title               AS objective_title,
  o.level               AS objective_level,
  o.organization_id,
  c.id                  AS cycle_id
FROM key_results kr
JOIN objectives o ON kr.objective_id = o.id
JOIN cycles     c ON o.cycle_id      = c.id
LEFT JOIN users u ON kr.owner_id     = u.id
WHERE kr.deleted_at IS NULL
  AND o.deleted_at  IS NULL
  AND c.status      = 'ACTIVE'
  AND kr.status NOT IN ('COMPLETED','CANCELLED')
  AND (
    (kr.last_checkin_at IS NULL AND kr.created_at < NOW() - INTERVAL '7 days')
    OR kr.last_checkin_at < NOW() - INTERVAL '14 days'
    OR kr.confidence < 0.4
    OR kr.status IN ('AT_RISK','BEHIND')
  )
ORDER BY
  CASE o.level WHEN 'COMPANY' THEN 1 WHEN 'AREA' THEN 2 WHEN 'TEAM' THEN 3 ELSE 4 END,
  kr.confidence ASC,
  days_since_checkin DESC;

-- ----------------------------------------------------------------
-- VISTA: cadence dashboard (grid equipo × KR)
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_cadence_dashboard AS
SELECT
  kr.id             AS kr_id,
  kr.title          AS kr_title,
  kr.metric_unit,
  kr.progress,
  kr.confidence,
  kr.status,
  kr.last_checkin_at,
  COALESCE(EXTRACT(DAY FROM NOW() - kr.last_checkin_at)::INT, 999) AS days_since_checkin,
  kr.owner_id,
  u.name            AS owner_name,
  u.email           AS owner_email,
  o.id              AS objective_id,
  o.title           AS objective_title,
  o.level           AS objective_level,
  o.organization_id,
  o.cycle_id,
  o.team_id,
  t.name            AS team_name
FROM key_results kr
JOIN objectives o  ON kr.objective_id = o.id
LEFT JOIN users u  ON kr.owner_id     = u.id
LEFT JOIN teams t  ON o.team_id       = t.id
WHERE kr.deleted_at IS NULL
  AND o.deleted_at  IS NULL
  AND kr.status NOT IN ('CANCELLED')
ORDER BY days_since_checkin DESC, o.level, kr.progress ASC;

-- ----------------------------------------------------------------
-- ACTUALIZAR v_key_results_with_trend — trend real desde check-ins
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_key_results_with_trend CASCADE;

CREATE VIEW v_key_results_with_trend AS
WITH trend_calc AS (
  SELECT
    ci.kr_id,
    MAX(CASE WHEN rn = 1 THEN ci.current_value END) AS latest,
    MAX(CASE WHEN rn = 2 THEN ci.current_value END) AS prev,
    COUNT(*) AS total_checkins
  FROM (
    SELECT kr_id, current_value,
           ROW_NUMBER() OVER (PARTITION BY kr_id ORDER BY checked_at DESC) AS rn
    FROM check_ins
  ) ci
  WHERE ci.rn <= 3
  GROUP BY ci.kr_id
)
SELECT
  kr.*,
  u.name        AS owner_name,
  u.email       AS owner_email,
  COALESCE(
    CASE
      WHEN tc.total_checkins < 2 THEN 'flat'
      WHEN tc.latest > tc.prev   THEN 'up'
      WHEN tc.latest < tc.prev   THEN 'down'
      ELSE 'flat'
    END,
    'flat'
  )             AS trend,
  COALESCE(tc.total_checkins, 0)::INT AS checkin_count
FROM key_results kr
LEFT JOIN users      u  ON kr.owner_id = u.id
LEFT JOIN trend_calc tc ON tc.kr_id    = kr.id
WHERE kr.deleted_at IS NULL;
