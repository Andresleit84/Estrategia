-- ================================================================
-- 021_objective_alignments.sql
-- Multi-parent alignment: an objective can contribute to multiple
-- strategic objectives beyond its primary parent_objective_id.
-- source_id = annual/tactical OKR, target_id = strategic/annual OKR
-- ================================================================

CREATE TABLE IF NOT EXISTS objective_alignments (
  source_id  UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_id, target_id),
  CHECK (source_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_obj_align_source ON objective_alignments(source_id);
CREATE INDEX IF NOT EXISTS idx_obj_align_target ON objective_alignments(target_id);
