-- Función usada por demo.service.ts en POST /api/v1/demo/clean.
-- Limpia los briefings de IA de una organización para reiniciar el estado demo.
CREATE OR REPLACE FUNCTION fn_demo_clean_ai_briefings(p_org_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM ai_briefings WHERE organization_id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_demo_clean_ai_briefings(uuid) TO okr_user;
