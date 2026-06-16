-- ============================================================
-- Hito 7: Iniciativas y ejecución táctica
-- ============================================================

-- ── TABLES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS initiatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  cycle_id        UUID REFERENCES cycles(id),
  team_id         UUID REFERENCES teams(id),
  owner_id        UUID REFERENCES users(id),
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'TODO'
                    CHECK (status IN ('TODO','IN_PROGRESS','DONE','CANCELLED')),
  progress        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date      DATE,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS initiative_key_results (
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  kr_id         UUID NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (initiative_id, kr_id)
);

CREATE TABLE IF NOT EXISTS milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  assignee_id   UUID REFERENCES users(id),
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_initiatives_org         ON initiatives(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_initiatives_team_cycle  ON initiatives(team_id, cycle_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_initiatives_owner       ON initiatives(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_initiative_krs_kr       ON initiative_key_results(kr_id);
CREATE INDEX IF NOT EXISTS idx_milestones_initiative   ON milestones(initiative_id);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date     ON milestones(due_date) WHERE status != 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_milestones_status_active ON milestones(initiative_id) WHERE status NOT IN ('COMPLETED','CANCELLED');
CREATE INDEX IF NOT EXISTS idx_initiatives_status       ON initiatives(organization_id, status) WHERE deleted_at IS NULL;

-- ── TRIGGERS ────────────────────────────────────────────────

-- updated_at auto-update
CREATE OR REPLACE FUNCTION fn_initiatives_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION fn_milestones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_initiatives_updated_at ON initiatives;
CREATE TRIGGER trg_initiatives_updated_at
  BEFORE UPDATE ON initiatives
  FOR EACH ROW EXECUTE FUNCTION fn_initiatives_updated_at();

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON milestones;
CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_milestones_updated_at();

-- Recalculate initiative progress when milestone status changes
CREATE OR REPLACE FUNCTION fn_initiative_progress_from_milestones()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total     INT;
  v_completed INT;
  v_progress  NUMERIC(5,2);
  v_new_status TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'COMPLETED')
  INTO v_total, v_completed
  FROM milestones
  WHERE initiative_id = COALESCE(NEW.initiative_id, OLD.initiative_id)
    AND status != 'CANCELLED';

  IF v_total = 0 THEN
    v_progress := 0;
  ELSE
    v_progress := ROUND((v_completed::NUMERIC / v_total) * 100, 2);
  END IF;

  -- derive initiative status from milestone progress
  IF v_completed = v_total AND v_total > 0 THEN
    v_new_status := 'DONE';
  ELSE
    SELECT status INTO v_new_status FROM initiatives
    WHERE id = COALESCE(NEW.initiative_id, OLD.initiative_id);
    -- only auto-advance to IN_PROGRESS, never revert DONE manually set
    IF v_new_status = 'TODO' AND v_completed > 0 THEN
      v_new_status := 'IN_PROGRESS';
    END IF;
  END IF;

  UPDATE initiatives
  SET
    progress     = v_progress,
    status       = v_new_status,
    completed_at = CASE WHEN v_new_status = 'DONE' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
    updated_at   = NOW()
  WHERE id = COALESCE(NEW.initiative_id, OLD.initiative_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initiative_progress_from_milestones ON milestones;
CREATE TRIGGER trg_initiative_progress_from_milestones
  AFTER INSERT OR UPDATE OF status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_initiative_progress_from_milestones();

-- Overdue milestone notification
CREATE OR REPLACE FUNCTION fn_milestone_overdue_alert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Only fire when milestone becomes overdue (due_date passed and not completed)
  IF NEW.due_date < CURRENT_DATE AND NEW.status NOT IN ('COMPLETED', 'CANCELLED')
     AND (OLD.status = 'PENDING' OR OLD.due_date != NEW.due_date) THEN

    SELECT i.organization_id INTO v_org_id
    FROM initiatives i WHERE i.id = NEW.initiative_id;

    INSERT INTO notifications (organization_id, user_id, type, title, body, entity_type, entity_id)
    SELECT
      v_org_id,
      NEW.assignee_id,
      'MILESTONE_OVERDUE',
      'Hito vencido: ' || NEW.title,
      'El hito "' || NEW.title || '" venció el ' || TO_CHAR(NEW.due_date, 'DD/MM/YYYY') || ' y aún está pendiente.',
      'milestone',
      NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE entity_id = NEW.id AND type = 'MILESTONE_OVERDUE' AND read_at IS NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_milestone_overdue_alert ON milestones;
CREATE TRIGGER trg_milestone_overdue_alert
  AFTER INSERT OR UPDATE OF due_date, status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_milestone_overdue_alert();

-- Audit log for initiatives
CREATE OR REPLACE FUNCTION fn_audit_log_initiatives()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, actor_id)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD)::JSONB ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::JSONB ELSE NULL END,
    COALESCE(NEW.created_by, OLD.created_by)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_initiatives ON initiatives;
CREATE TRIGGER trg_audit_log_initiatives
  AFTER INSERT OR UPDATE OR DELETE ON initiatives
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_initiatives();

-- Extend notifications type check to include MILESTONE_OVERDUE
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('KR_AT_RISK','KR_COMPLETED','OBJ_COMPLETED','CHECKIN_DUE','STALE_KR','MILESTONE_OVERDUE'));

-- ── STORED PROCEDURES ────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_create_initiative(
  p_org_id      UUID,
  p_cycle_id    UUID,
  p_team_id     UUID,
  p_owner_id    UUID,
  p_title       TEXT,
  p_description TEXT,
  p_start_date  DATE,
  p_due_date    DATE,
  p_created_by  UUID,
  p_kr_ids      UUID[],
  INOUT p_initiative_id UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
  v_kr_id UUID;
BEGIN
  INSERT INTO initiatives (
    organization_id, cycle_id, team_id, owner_id,
    title, description, start_date, due_date, created_by
  ) VALUES (
    p_org_id, p_cycle_id, p_team_id, p_owner_id,
    p_title, p_description, p_start_date, p_due_date, p_created_by
  ) RETURNING id INTO p_initiative_id;

  -- Link to KRs (M2M)
  IF p_kr_ids IS NOT NULL THEN
    FOREACH v_kr_id IN ARRAY p_kr_ids LOOP
      INSERT INTO initiative_key_results (initiative_id, kr_id)
      VALUES (p_initiative_id, v_kr_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_complete_milestone(
  p_milestone_id UUID,
  p_user_id      UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE milestones
  SET status = 'COMPLETED', completed_at = NOW()
  WHERE id = p_milestone_id AND status != 'COMPLETED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hito no encontrado o ya completado' USING ERRCODE = 'P0030';
  END IF;
END;
$$;

-- ── FUNCTIONS ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_initiative_health(p_initiative_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_init        RECORD;
  v_total       INT;
  v_completed   INT;
  v_overdue     INT;
  v_blocking    JSONB;
  v_days_overdue INT;
  v_health      TEXT;
BEGIN
  SELECT * INTO v_init FROM initiatives WHERE id = p_initiative_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN '{"error": "not_found"}'::JSONB; END IF;

  SELECT
    COUNT(*) FILTER (WHERE status != 'CANCELLED'),
    COUNT(*) FILTER (WHERE status = 'COMPLETED'),
    COUNT(*) FILTER (WHERE status != 'COMPLETED' AND status != 'CANCELLED' AND due_date < CURRENT_DATE)
  INTO v_total, v_completed, v_overdue
  FROM milestones WHERE initiative_id = p_initiative_id;

  SELECT COALESCE(json_agg(json_build_object(
    'id', id, 'title', title, 'due_date', due_date, 'status', status
  )), '[]'::json)::JSONB INTO v_blocking
  FROM milestones
  WHERE initiative_id = p_initiative_id
    AND status NOT IN ('COMPLETED', 'CANCELLED')
    AND due_date < CURRENT_DATE;

  v_days_overdue := CASE
    WHEN v_init.due_date IS NOT NULL AND v_init.due_date < CURRENT_DATE
         AND v_init.status != 'DONE' THEN (CURRENT_DATE - v_init.due_date)
    ELSE 0
  END;

  v_health := CASE
    WHEN v_init.status = 'DONE'       THEN 'COMPLETED'
    WHEN v_init.status = 'CANCELLED'  THEN 'CANCELLED'
    WHEN v_days_overdue > 0           THEN 'OVERDUE'
    WHEN v_overdue > 0                THEN 'AT_RISK'
    WHEN v_init.progress >= 70        THEN 'ON_TRACK'
    ELSE                                   'BEHIND'
  END;

  RETURN jsonb_build_object(
    'status',               v_init.status,
    'health',               v_health,
    'progress',             v_init.progress,
    'days_overdue',         v_days_overdue,
    'completion_rate',      CASE WHEN v_total = 0 THEN 0 ELSE ROUND((v_completed::NUMERIC / v_total) * 100, 1) END,
    'total_milestones',     v_total,
    'completed_milestones', v_completed,
    'overdue_milestones',   v_overdue,
    'blocking_milestones',  v_blocking
  );
END;
$$;

-- ── VIEWS ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_initiative_timeline AS
SELECT
  i.id,
  i.organization_id,
  i.cycle_id,
  i.team_id,
  i.owner_id,
  i.title,
  i.description,
  i.status,
  i.progress,
  i.start_date,
  i.due_date,
  i.completed_at,
  i.created_at,
  -- owner info
  u.name                                   AS owner_name,
  -- team info
  t.name                                   AS team_name,
  -- overdue flag
  (i.due_date < CURRENT_DATE AND i.status NOT IN ('DONE','CANCELLED')) AS is_overdue,
  CASE WHEN i.due_date IS NOT NULL AND i.status NOT IN ('DONE','CANCELLED')
    THEN GREATEST(0, (CURRENT_DATE - i.due_date))
    ELSE 0
  END                                      AS days_overdue,
  -- milestones as JSONB array
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id',           m.id,
        'title',        m.title,
        'status',       m.status,
        'due_date',     m.due_date,
        'completed_at', m.completed_at,
        'assignee_id',  m.assignee_id,
        'assignee_name', a.name,
        'sort_order',   m.sort_order,
        'is_overdue',   (m.due_date < CURRENT_DATE AND m.status NOT IN ('COMPLETED','CANCELLED'))
      ) ORDER BY m.sort_order, m.due_date NULLS LAST
    )
    FROM milestones m
    LEFT JOIN users a ON m.assignee_id = a.id
    WHERE m.initiative_id = i.id
  ), '[]'::json)::JSONB                    AS milestones,
  -- KRs linked
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id',       kr.id,
        'title',    kr.title,
        'progress', kr.progress,
        'status',   kr.status
      )
    )
    FROM initiative_key_results ikr
    JOIN key_results kr ON ikr.kr_id = kr.id
    WHERE ikr.initiative_id = i.id AND kr.deleted_at IS NULL
  ), '[]'::json)::JSONB                    AS key_results,
  -- milestone counts
  (SELECT COUNT(*) FROM milestones m WHERE m.initiative_id = i.id AND m.status != 'CANCELLED')::INT AS total_milestones,
  (SELECT COUNT(*) FROM milestones m WHERE m.initiative_id = i.id AND m.status = 'COMPLETED')::INT  AS completed_milestones
FROM initiatives i
LEFT JOIN users  u ON i.owner_id = u.id
LEFT JOIN teams  t ON i.team_id  = t.id
WHERE i.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_initiatives_by_kr AS
SELECT
  ikr.kr_id,
  ikr.initiative_id,
  i.title                AS initiative_title,
  i.status               AS initiative_status,
  i.progress             AS initiative_progress,
  i.due_date             AS initiative_due_date,
  i.is_overdue,
  i.days_overdue,
  i.team_name,
  i.owner_name,
  i.total_milestones,
  i.completed_milestones
FROM initiative_key_results ikr
JOIN v_initiative_timeline i ON ikr.initiative_id = i.id;

CREATE OR REPLACE VIEW v_overdue_milestones AS
SELECT
  m.id,
  m.initiative_id,
  m.title,
  m.status,
  m.due_date,
  (CURRENT_DATE - m.due_date)  AS days_overdue,
  m.assignee_id,
  u.name                       AS assignee_name,
  i.title                      AS initiative_title,
  i.organization_id,
  i.team_id,
  t.name                       AS team_name,
  -- KRs impacted by this initiative
  COALESCE((
    SELECT json_agg(kr.title)
    FROM initiative_key_results ikr
    JOIN key_results kr ON ikr.kr_id = kr.id
    WHERE ikr.initiative_id = m.initiative_id AND kr.deleted_at IS NULL
  ), '[]'::json)::JSONB        AS impacted_krs
FROM milestones m
JOIN initiatives i ON m.initiative_id = i.id AND i.deleted_at IS NULL
LEFT JOIN users u ON m.assignee_id = u.id
LEFT JOIN teams t ON i.team_id = t.id
WHERE m.status NOT IN ('COMPLETED','CANCELLED')
  AND m.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;
