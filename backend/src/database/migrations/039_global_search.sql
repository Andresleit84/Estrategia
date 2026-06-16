-- Global search function across objectives, backlog, initiatives and cycles
CREATE OR REPLACE FUNCTION fn_global_search(
  p_org_id UUID,
  p_query  TEXT,
  p_limit  INT DEFAULT 20
)
RETURNS TABLE (
  id       UUID,
  title    TEXT,
  subtitle TEXT,
  type_key TEXT,
  category TEXT,
  href     TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT id, title, subtitle, type_key, category, href FROM (
    SELECT
      o.id,
      o.title,
      COALESCE(o.code, CASE o.level WHEN 'COMPANY' THEN 'Empresa' WHEN 'TEAM' THEN 'Equipo' ELSE 'Individual' END) AS subtitle,
      CASE o.level WHEN 'COMPANY' THEN 'OKR_COMPANY' ELSE 'OKR_TEAM' END AS type_key,
      'OKRs'::text AS category,
      CASE WHEN o.level = 'COMPANY' THEN '/strategic' ELSE '/tactical' END AS href,
      ts_rank(to_tsvector('simple', o.title), plainto_tsquery('simple', p_query)) AS rank
    FROM objectives o
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL
      AND o.title ILIKE '%' || p_query || '%'

    UNION ALL

    SELECT
      b.id,
      b.title,
      COALESCE(b.code, CASE b.type WHEN 'EPIC' THEN 'Épica' WHEN 'FEATURE' THEN 'Feature' ELSE 'Historia' END) AS subtitle,
      b.type::text AS type_key,
      'Backlog'::text AS category,
      '/backlog'::text AS href,
      ts_rank(to_tsvector('simple', b.title), plainto_tsquery('simple', p_query)) AS rank
    FROM backlog_items b
    WHERE b.organization_id = p_org_id
      AND b.title ILIKE '%' || p_query || '%'

    UNION ALL

    SELECT
      i.id,
      i.title,
      CASE i.status WHEN 'TODO' THEN 'Por hacer' WHEN 'IN_PROGRESS' THEN 'En curso' WHEN 'DONE' THEN 'Completada' ELSE i.status END AS subtitle,
      'INITIATIVE'::text AS type_key,
      'Iniciativas'::text AS category,
      '/initiatives'::text AS href,
      ts_rank(to_tsvector('simple', i.title), plainto_tsquery('simple', p_query)) AS rank
    FROM initiatives i
    WHERE i.organization_id = p_org_id
      AND i.deleted_at IS NULL
      AND i.title ILIKE '%' || p_query || '%'

    UNION ALL

    SELECT
      c.id,
      c.name AS title,
      CASE c.status WHEN 'ACTIVE' THEN 'Activo' WHEN 'DRAFT' THEN 'Borrador' WHEN 'CLOSED' THEN 'Cerrado' ELSE c.status END AS subtitle,
      'CYCLE'::text AS type_key,
      'Ciclos'::text AS category,
      '/cycles'::text AS href,
      ts_rank(to_tsvector('simple', c.name), plainto_tsquery('simple', p_query)) AS rank
    FROM cycles c
    WHERE c.organization_id = p_org_id
      AND c.deleted_at IS NULL
      AND c.name ILIKE '%' || p_query || '%'
  ) sub
  ORDER BY rank DESC, title
  LIMIT p_limit
$$;
