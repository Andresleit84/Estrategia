-- Traceability: objective → initiative links via key_results
CREATE OR REPLACE VIEW v_traceability_objective_links AS
SELECT
  kr.objective_id,
  ikr.initiative_id,
  i.title       AS initiative_title,
  i.status      AS initiative_status,
  i.progress    AS initiative_progress,
  i.code        AS initiative_code,
  i.organization_id
FROM initiative_key_results ikr
JOIN key_results  kr ON ikr.kr_id         = kr.id
JOIN initiatives  i  ON ikr.initiative_id = i.id
WHERE kr.deleted_at IS NULL
  AND i.deleted_at  IS NULL;
