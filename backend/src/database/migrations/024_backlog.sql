-- Migration 024: Backlog items — Epics, Features, User Stories
-- Run as okr_user (or postgres for first-time grants)

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS backlog_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type             VARCHAR(10)  NOT NULL CHECK (type IN ('EPIC','FEATURE','STORY')),
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  acceptance_criteria TEXT,
  status           VARCHAR(20)  NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  priority         VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM'
                     CHECK (priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  story_points     INTEGER CHECK (story_points IS NULL OR story_points >= 0),
  parent_id        UUID REFERENCES backlog_items(id) ON DELETE CASCADE,
  initiative_id    UUID REFERENCES initiatives(id) ON DELETE SET NULL,
  sprint_id        UUID REFERENCES sprint_cycles(id) ON DELETE SET NULL,
  assignee_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  cycle_id         UUID REFERENCES cycles(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce hierarchy: FEATURE must have EPIC parent, STORY must have FEATURE/EPIC parent
CREATE OR REPLACE FUNCTION fn_validate_backlog_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_parent_type TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    IF NEW.type != 'EPIC' THEN
      RAISE EXCEPTION 'Features and Stories must have a parent';
    END IF;
    RETURN NEW;
  END IF;
  SELECT type INTO v_parent_type FROM backlog_items WHERE id = NEW.parent_id;
  IF NEW.type = 'FEATURE' AND v_parent_type != 'EPIC' THEN
    RAISE EXCEPTION 'Feature parent must be an Epic';
  END IF;
  IF NEW.type = 'STORY' AND v_parent_type NOT IN ('FEATURE','EPIC') THEN
    RAISE EXCEPTION 'Story parent must be a Feature or Epic';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_backlog_hierarchy
  BEFORE INSERT OR UPDATE ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION fn_validate_backlog_hierarchy();

CREATE TRIGGER trg_backlog_updated_at
  BEFORE UPDATE ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_backlog_org          ON backlog_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_backlog_parent       ON backlog_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_backlog_initiative   ON backlog_items(initiative_id);
CREATE INDEX IF NOT EXISTS idx_backlog_sprint       ON backlog_items(sprint_id);
CREATE INDEX IF NOT EXISTS idx_backlog_cycle        ON backlog_items(cycle_id);
CREATE INDEX IF NOT EXISTS idx_backlog_type_status  ON backlog_items(organization_id, type, status);

-- ── View: v_backlog_items ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_backlog_items AS
SELECT
  bi.id,
  bi.organization_id,
  bi.type,
  bi.title,
  bi.description,
  bi.acceptance_criteria,
  bi.status,
  bi.priority,
  bi.story_points,
  bi.parent_id,
  bi.initiative_id,
  bi.sprint_id,
  bi.assignee_id,
  bi.cycle_id,
  bi.created_by,
  bi.created_at,
  bi.updated_at,
  -- Joined fields
  u.name                      AS assignee_name,
  creator.name                AS created_by_name,
  parent_bi.title             AS parent_title,
  parent_bi.type              AS parent_type,
  i.title                     AS initiative_title,
  sc.name                     AS sprint_name,
  c.name                      AS cycle_name,
  -- Children stats (one level down only)
  COALESCE(ch_stats.total,        0) AS children_count,
  COALESCE(ch_stats.done,         0) AS completed_children,
  COALESCE(ch_stats.total_pts,    0) AS total_story_points,
  COALESCE(ch_stats.done_pts,     0) AS done_story_points,
  -- Progress % (based on done children, or own status)
  CASE
    WHEN COALESCE(ch_stats.total, 0) = 0 THEN
      CASE bi.status WHEN 'DONE' THEN 100 ELSE 0 END
    ELSE
      ROUND(COALESCE(ch_stats.done, 0)::NUMERIC / ch_stats.total * 100)
  END AS progress
FROM backlog_items bi
LEFT JOIN users u               ON bi.assignee_id = u.id
LEFT JOIN users creator         ON bi.created_by   = creator.id
LEFT JOIN backlog_items parent_bi ON bi.parent_id   = parent_bi.id
LEFT JOIN initiatives i         ON bi.initiative_id = i.id
LEFT JOIN sprint_cycles sc      ON bi.sprint_id     = sc.id
LEFT JOIN cycles c              ON bi.cycle_id      = c.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                             AS total,
    COUNT(*) FILTER (WHERE ch.status = 'DONE')           AS done,
    SUM(COALESCE(ch.story_points, 0))                    AS total_pts,
    SUM(COALESCE(ch.story_points, 0))
      FILTER (WHERE ch.status = 'DONE')                  AS done_pts
  FROM backlog_items ch
  WHERE ch.parent_id = bi.id
) ch_stats ON true;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE backlog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY backlog_org_isolation ON backlog_items
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Grants for okr_user
GRANT SELECT, INSERT, UPDATE, DELETE ON backlog_items TO okr_user;
