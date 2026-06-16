-- =============================================================================
-- SEED DEMO: Caja Morelia — Datos de presentación completos
-- Idempotente: DELETE+INSERT con UUIDs fijos (todos válidos: solo hex a-f, 0-9)
-- Re-ejecutar restaura todo el estado demo.
-- =============================================================================
-- UUID grupos (prefijo = tipo):
--   a1xxxxxx = usuarios demo
--   a2xxxxxx = áreas
--   a3xxxxxx = equipos
--   b1xxxxxx = objetivos Q1 2026
--   b2xxxxxx = objetivos Q2 2026
--   c1xxxxxx = KRs Q1 2026
--   c2xxxxxx = KRs Q2 2026
--   a4xxxxxx = iniciativas
--   a5xxxxxx = hitos
--   a6xxxxxx = sprints
--   a7xxxxxx = backlog items
--   a8xxxxxx = acuerdos
--   a9xxxxxx = cuerpos de gobierno
--   aa0xxxxx = actividades de gobierno
--   ac0xxxxx = intenciones estratégicas
--   ad0xxxxx = problemas organizacionales
--   ae0xxxxx = AI briefings
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- =============================================================================
-- 1. LIMPIEZA EXPLÍCITA (sin depender de cascades — orden hoja → raíz)
-- =============================================================================

-- Tablas puente / hoja
DELETE FROM agreement_backlog_items WHERE agreement_id IN (
  'a8000001-0000-4000-a000-000000000001',
  'a8000002-0000-4000-a000-000000000001',
  'a8000003-0000-4000-a000-000000000001'
);
DELETE FROM sprint_goal_krs WHERE sprint_id = 'a6000001-0000-4000-a000-000000000001';
DELETE FROM initiative_key_results WHERE initiative_id IN (
  'a4000001-0000-4000-a000-000000000001',
  'a4000002-0000-4000-a000-000000000001',
  'a4000003-0000-4000-a000-000000000001',
  'a4000004-0000-4000-a000-000000000001'
);
DELETE FROM governance_members WHERE body_id IN (
  'a9000001-0000-4000-a000-000000000001',
  'a9000002-0000-4000-a000-000000000001'
);
DELETE FROM team_members WHERE team_id IN (
  'a3000001-0000-4000-a000-000000000001',
  'a3000002-0000-4000-a000-000000000001',
  'a3000003-0000-4000-a000-000000000001'
);

-- Check-ins de KRs demo
DELETE FROM check_ins WHERE kr_id IN (
  'c1000001-0000-4000-a000-000000000001',
  'c1000002-0000-4000-a000-000000000001',
  'c1000003-0000-4000-a000-000000000001',
  'c1000004-0000-4000-a000-000000000001',
  'c1000005-0000-4000-a000-000000000001',
  'c2000001-0000-4000-a000-000000000001',
  'c2000002-0000-4000-a000-000000000001',
  'c2000003-0000-4000-a000-000000000001',
  'c2000004-0000-4000-a000-000000000001',
  'c2000005-0000-4000-a000-000000000001',
  'c2000006-0000-4000-a000-000000000001',
  'c2000007-0000-4000-a000-000000000001',
  'c2000008-0000-4000-a000-000000000001',
  'c2000009-0000-4000-a000-000000000001',
  'c2000010-0000-4000-a000-000000000001',
  'c2000011-0000-4000-a000-000000000001',
  'c2000012-0000-4000-a000-000000000001',
  'c2000013-0000-4000-a000-000000000001',
  'c2000014-0000-4000-a000-000000000001',
  'c2000015-0000-4000-a000-000000000001',
  'c2000016-0000-4000-a000-000000000001',
  'c2000017-0000-4000-a000-000000000001',
  'c2000018-0000-4000-a000-000000000001',
  'c2000019-0000-4000-a000-000000000001',
  'c2000020-0000-4000-a000-000000000001',
  'c2000021-0000-4000-a000-000000000001',
  -- addendum: KRs individuales (Pedro y Ana)
  'c2000022-0000-4000-a000-000000000001',
  'c2000023-0000-4000-a000-000000000001',
  'c2000024-0000-4000-a000-000000000001',
  'c2000025-0000-4000-a000-000000000001'
);

-- KRs demo
DELETE FROM key_results WHERE id IN (
  'c1000001-0000-4000-a000-000000000001',
  'c1000002-0000-4000-a000-000000000001',
  'c1000003-0000-4000-a000-000000000001',
  'c1000004-0000-4000-a000-000000000001',
  'c1000005-0000-4000-a000-000000000001',
  'c2000001-0000-4000-a000-000000000001',
  'c2000002-0000-4000-a000-000000000001',
  'c2000003-0000-4000-a000-000000000001',
  'c2000004-0000-4000-a000-000000000001',
  'c2000005-0000-4000-a000-000000000001',
  'c2000006-0000-4000-a000-000000000001',
  'c2000007-0000-4000-a000-000000000001',
  'c2000008-0000-4000-a000-000000000001',
  'c2000009-0000-4000-a000-000000000001',
  'c2000010-0000-4000-a000-000000000001',
  'c2000011-0000-4000-a000-000000000001',
  'c2000012-0000-4000-a000-000000000001',
  'c2000013-0000-4000-a000-000000000001',
  'c2000014-0000-4000-a000-000000000001',
  'c2000015-0000-4000-a000-000000000001',
  'c2000016-0000-4000-a000-000000000001',
  'c2000017-0000-4000-a000-000000000001',
  'c2000018-0000-4000-a000-000000000001',
  'c2000019-0000-4000-a000-000000000001',
  'c2000020-0000-4000-a000-000000000001',
  'c2000021-0000-4000-a000-000000000001',
  -- addendum: KRs individuales (Pedro y Ana)
  'c2000022-0000-4000-a000-000000000001',
  'c2000023-0000-4000-a000-000000000001',
  'c2000024-0000-4000-a000-000000000001',
  'c2000025-0000-4000-a000-000000000001'
);

-- Acuerdos, backlog, sprint, milestones, iniciativas
DELETE FROM agreements WHERE id IN (
  'a8000001-0000-4000-a000-000000000001',
  'a8000002-0000-4000-a000-000000000001',
  'a8000003-0000-4000-a000-000000000001'
);
DELETE FROM backlog_items WHERE id IN (
  'a7000004-0000-4000-a000-000000000001',
  'a7000005-0000-4000-a000-000000000001'
);
DELETE FROM backlog_items WHERE id IN (
  'a7000002-0000-4000-a000-000000000001',
  'a7000003-0000-4000-a000-000000000001'
);
DELETE FROM backlog_items WHERE id = 'a7000001-0000-4000-a000-000000000001';
DELETE FROM sprint_cycles WHERE id = 'a6000001-0000-4000-a000-000000000001';
DELETE FROM milestones WHERE id IN (
  'a5000001-0000-4000-a000-000000000001',
  'a5000002-0000-4000-a000-000000000001',
  'a5000003-0000-4000-a000-000000000001',
  'a5000004-0000-4000-a000-000000000001',
  'a5000005-0000-4000-a000-000000000001',
  'a5000006-0000-4000-a000-000000000001',
  'a5000007-0000-4000-a000-000000000001',
  'a5000008-0000-4000-a000-000000000001',
  'a5000009-0000-4000-a000-000000000001',
  'a5000010-0000-4000-a000-000000000001',
  'a5000011-0000-4000-a000-000000000001',
  'a5000012-0000-4000-a000-000000000001',
  'a5000013-0000-4000-a000-000000000001'
);
DELETE FROM initiatives WHERE id IN (
  'a4000001-0000-4000-a000-000000000001',
  'a4000002-0000-4000-a000-000000000001',
  'a4000003-0000-4000-a000-000000000001',
  'a4000004-0000-4000-a000-000000000001'
);

-- Objetivos (INDIVIDUAL primero — tienen FK a TEAM/AREA que se elimina después)
DELETE FROM objectives WHERE id IN (
  'b2000009-0000-4000-a000-000000000001',
  'b2000010-0000-4000-a000-000000000001',
  -- addendum: objetivos individuales Pedro y Ana
  'b2000011-0000-4000-a000-000000000001',
  'b2000012-0000-4000-a000-000000000001'
);
DELETE FROM objectives WHERE id IN (
  'b2000006-0000-4000-a000-000000000001',
  'b2000007-0000-4000-a000-000000000001',
  'b2000008-0000-4000-a000-000000000001'
);
DELETE FROM objectives WHERE id IN (
  'b2000004-0000-4000-a000-000000000001',
  'b2000005-0000-4000-a000-000000000001'
);
DELETE FROM objectives WHERE id IN (
  'b2000001-0000-4000-a000-000000000001',
  'b2000002-0000-4000-a000-000000000001',
  'b2000003-0000-4000-a000-000000000001',
  'b1000001-0000-4000-a000-000000000001',
  'b1000002-0000-4000-a000-000000000001',
  'b1000003-0000-4000-a000-000000000001'
);

-- Intenciones, problemas, governance, teams, areas, users
DELETE FROM strategic_intents WHERE id IN (
  'ac000001-0000-4000-a000-000000000001',
  'ac000002-0000-4000-a000-000000000001',
  'ac000003-0000-4000-a000-000000000001'
);
DELETE FROM organizational_problems WHERE id IN (
  'ad000001-0000-4000-a000-000000000001',
  'ad000002-0000-4000-a000-000000000001'
);
DELETE FROM governance_bodies WHERE id IN (
  'a9000001-0000-4000-a000-000000000001',
  'a9000002-0000-4000-a000-000000000001'
);
DELETE FROM governance_activities WHERE id IN (
  'aa000001-0000-4000-a000-000000000001',
  'aa000002-0000-4000-a000-000000000001',
  'aa000003-0000-4000-a000-000000000001'
);
DELETE FROM teams WHERE id IN (
  'a3000001-0000-4000-a000-000000000001',
  'a3000002-0000-4000-a000-000000000001',
  'a3000003-0000-4000-a000-000000000001'
);
DELETE FROM areas WHERE id IN (
  'a2000001-0000-4000-a000-000000000001',
  'a2000002-0000-4000-a000-000000000001'
);
-- trg_soft_delete_users convierte DELETE en soft-delete; lo bypasseamos con replica role
SET session_replication_role = replica;
DELETE FROM users WHERE id IN (
  'a1000001-0000-4000-a000-000000000001',
  'a1000002-0000-4000-a000-000000000001',
  'a1000003-0000-4000-a000-000000000001',
  'a1000004-0000-4000-a000-000000000001',
  -- addendum: nuevos perfiles de rol
  'af000001-0000-4000-a000-000000000001',
  'af000002-0000-4000-a000-000000000001',
  'af000003-0000-4000-a000-000000000001'
);
SET session_replication_role = DEFAULT;

-- =============================================================================
-- 2. USUARIOS DEMO  (contraseña: Demo2026#)
-- =============================================================================
INSERT INTO users (id, organization_id, email, password_hash, name, role, is_active, email_verified) VALUES
  ('a1000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'maria.gonzalez@demo.com',
   crypt('Demo2026#', gen_salt('bf')),
   'María González', 'MANAGER', true, true),

  ('a1000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'carlos.mendoza@demo.com',
   crypt('Demo2026#', gen_salt('bf')),
   'Carlos Mendoza', 'MANAGER', true, true),

  ('a1000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'laura.vazquez@demo.com',
   crypt('Demo2026#', gen_salt('bf')),
   'Laura Vázquez', 'MEMBER', true, true),

  ('a1000004-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'roberto.diaz@demo.com',
   crypt('Demo2026#', gen_salt('bf')),
   'Roberto Díaz', 'VIEWER', true, true);

-- =============================================================================
-- 3. ÁREAS
-- =============================================================================
INSERT INTO areas (id, org_id, name, description, manager_id, color, sort_order) VALUES
  ('a2000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Finanzas',
   'Dirección Financiera y Gestión de Riesgo Crediticio',
   'a1000001-0000-4000-a000-000000000001', '#10b981', 1),

  ('a2000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Comercial',
   'Gestión de socios, captación y experiencia del cliente',
   NULL, '#f59e0b', 2);

-- =============================================================================
-- 4. EQUIPOS
-- =============================================================================
INSERT INTO teams (id, organization_id, name, description, owner_id, area_id, is_root) VALUES
  ('a3000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Equipo Finanzas',
   'Análisis de riesgo, recuperación y productos crediticios',
   'a1000001-0000-4000-a000-000000000001',
   'a2000001-0000-4000-a000-000000000001', false),

  ('a3000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Equipo Tecnología',
   'Desarrollo de plataforma, analítica e infraestructura cloud',
   'a1000002-0000-4000-a000-000000000001',
   '921164ff-866f-4f47-b472-b2b37fc27776', false),

  ('a3000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Equipo Comercial',
   'Captación de socios, app móvil y canales digitales',
   NULL,
   'a2000002-0000-4000-a000-000000000001', false);

INSERT INTO team_members (team_id, user_id, role, added_by_id) VALUES
  ('a3000001-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   'LEAD', '63d97824-0990-48c1-ae56-e606c703ece4'),
  ('a3000001-0000-4000-a000-000000000001', 'a1000003-0000-4000-a000-000000000001',
   'MEMBER', '63d97824-0990-48c1-ae56-e606c703ece4'),
  ('a3000002-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   'LEAD', '63d97824-0990-48c1-ae56-e606c703ece4'),
  ('a3000003-0000-4000-a000-000000000001', 'a1000004-0000-4000-a000-000000000001',
   'OBSERVER', '63d97824-0990-48c1-ae56-e606c703ece4')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- =============================================================================
-- 5. INTENCIONES ESTRATÉGICAS
-- =============================================================================
INSERT INTO strategic_intents (id, organization_id, title, description, horizon_years, target_year, category, status, created_by) VALUES
  ('ac000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Ser la institución financiera cooperativa más confiable del centro de México',
   'Consolidar liderazgo en crédito y captación en el segmento PyME y personas con actividad empresarial.',
   5, 2030, 'GROWTH', 'ACTIVE',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('ac000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'La innovación digital como ventaja competitiva sostenible',
   'Transformar todos los puntos de contacto con el socio a canales digitales ágiles y personalizados.',
   3, 2028, 'INNOVATION', 'ACTIVE',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('ac000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Excelencia operacional con costos clase mundial',
   'Reducir el costo operativo 20% mediante automatización e inteligencia analítica.',
   3, 2028, 'EFFICIENCY', 'DRAFT',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- =============================================================================
-- 6. PROBLEMAS ORGANIZACIONALES
-- =============================================================================
INSERT INTO organizational_problems (id, organization_id, title, description, category, severity, frequency, status, created_by) VALUES
  ('ad000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Alta tasa de mora en cartera PyME',
   'La mora en crédito a pequeña empresa supera el umbral regulatorio del 6% desde Q3 2025. Afecta rentabilidad y provisiones.',
   'FINANCIAL', 5, 4, 'BEING_ADDRESSED',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('ad000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Brechas en capacidades analíticas del equipo',
   'El 70% de decisiones de crédito se toman sin modelos predictivos. Falta talento en ciencia de datos.',
   'PEOPLE', 3, 5, 'IDENTIFIED',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- =============================================================================
-- 7. CUERPOS DE GOBIERNO
-- =============================================================================
INSERT INTO governance_bodies (id, org_id, name, type, description, sort_order) VALUES
  ('a9000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Consejo de Administración', 'CONSEJO',
   'Máximo órgano de gobierno corporativo. Sesiona bimestralmente.', 1),

  ('a9000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Comité de Riesgos', 'COMITE',
   'Supervisión de riesgo crediticio, mercado y operacional. Sesiona mensualmente.', 2);

INSERT INTO governance_members (body_id, user_id, role_label) VALUES
  ('a9000001-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4', 'Presidente'),
  ('a9000001-0000-4000-a000-000000000001', 'a1000004-0000-4000-a000-000000000001', 'Vocal'),
  ('a9000002-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001', 'Presidenta'),
  ('a9000002-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001', 'Secretario')
ON CONFLICT (body_id, user_id) DO NOTHING;

-- =============================================================================
-- 8. ACTIVIDADES DE GOBIERNO
-- =============================================================================
INSERT INTO governance_activities (id, organization_id, title, description, event_type, responsible, deliverable, frequency, scheduled_date, due_date, status, cycle_id, created_by) VALUES
  ('aa000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Revisión de Avance OKR Q2 2026 — Consejo de Administración',
   'Sesión para revisar avance estratégico del trimestre y tomar decisiones de asignación de recursos.',
   'REVIEW', 'María González', 'Reporte ejecutivo OKR + presentación PPTX', 'Trimestral',
   '2026-06-30', '2026-06-30', 'UPCOMING',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('aa000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Comité de Riesgo Crediticio — Mayo 2026',
   'Revisión mensual de mora, análisis de cartera vencida y acciones correctivas.',
   'MEETING', 'María González', 'Tablero de riesgo + minutas', 'Mensual',
   '2026-05-27', '2026-05-27', 'UPCOMING',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('aa000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Comité de Riesgo Crediticio — Abril 2026',
   'Revisión de apertura de ciclo, baseline de mora y plan de acción Q2.',
   'MEETING', 'María González', 'Minutas y plan de acción', 'Mensual',
   '2026-04-29', '2026-04-29', 'COMPLETED',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- =============================================================================
-- 9. OBJETIVOS Q1 2026 (CLOSED) — para demostrar K5 Cierre de Ciclo
-- =============================================================================
INSERT INTO objectives (id, organization_id, cycle_id, title, description, level, status, owner_id, created_by) VALUES
  ('b1000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '138cec9f-7b40-4f0d-83be-315a3a2093e2',
   'Establecer la cultura de gestión por OKRs en toda la organización',
   'Lograr que todos los equipos operen con OKRs definidos, check-ins regulares y revisiones de ciclo.',
   'COMPANY', 'COMPLETED',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b1000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '138cec9f-7b40-4f0d-83be-315a3a2093e2',
   'Reducir la mora en cartera de crédito personal por debajo del 5%',
   'Implementar estrategias preventivas y correctivas para contener la mora en crédito al consumo.',
   'COMPANY', 'ACTIVE',
   'a1000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b1000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '138cec9f-7b40-4f0d-83be-315a3a2093e2',
   'Acelerar la adopción digital entre socios activos',
   'Incrementar el uso de app y banca en línea como canal principal de transacción.',
   'COMPANY', 'ACTIVE',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- KRs Q1
INSERT INTO key_results (id, objective_id, owner_id, title, type, metric_unit, start_value, target_value, current_value, confidence, status, check_in_cadence, created_by) VALUES
  ('c1000001-0000-4000-a000-000000000001',
   'b1000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   '% de equipos con OKRs definidos y publicados',
   'INCREASE', '%', 0, 80, 95, 1.0, 'COMPLETED', 'MONTHLY',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('c1000002-0000-4000-a000-000000000001',
   'b1000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'Número de check-ins realizados en el ciclo (toda la org)',
   'INCREASE', 'check-ins', 0, 36, 52, 1.0, 'COMPLETED', 'MONTHLY',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('c1000003-0000-4000-a000-000000000001',
   'b1000002-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Índice de mora en crédito personal',
   'DECREASE', '%', 7.2, 5.0, 5.6, 0.6, 'AT_RISK', 'MONTHLY',
   'a1000001-0000-4000-a000-000000000001'),

  ('c1000004-0000-4000-a000-000000000001',
   'b1000002-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Tasa de recuperación de crédito vencido',
   'INCREASE', '%', 32, 55, 41, 0.5, 'BEHIND', 'MONTHLY',
   'a1000001-0000-4000-a000-000000000001'),

  ('c1000005-0000-4000-a000-000000000001',
   'b1000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   '% de transacciones realizadas vía app o banca en línea',
   'INCREASE', '%', 15, 40, 27, 0.4, 'BEHIND', 'MONTHLY',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- Check-ins Q1 — cronológico por KR (trigger exige orden)
INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c1000001-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-01-07 10:00:00-06', 25, 0.7, 'Kick-off. 2 equipos con OKRs borrador.', 'NEUTRAL'),
  ('c1000001-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-01-28 10:00:00-06', 62, 0.85, '5 equipos publicados. Finanzas y TI lideran.', 'GOOD'),
  ('c1000001-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-02-18 10:00:00-06', 80, 0.95, 'Meta alcanzada. Todos los equipos core con OKRs.', 'GREAT'),
  ('c1000001-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-03-11 10:00:00-06', 95, 1.0, 'Cierre Q1: 7/8 equipos + 1 adicional voluntario.', 'GREAT');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c1000002-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-01-07 11:00:00-06', 4, 0.7, '4 check-ins en primera semana.', 'NEUTRAL'),
  ('c1000002-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-01-28 11:00:00-06', 18, 0.8, 'Buen ritmo. Vamos a superar la meta.', 'GOOD'),
  ('c1000002-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-02-18 11:00:00-06', 35, 0.95, 'A punto de alcanzar la meta.', 'GREAT'),
  ('c1000002-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-03-11 11:00:00-06', 52, 1.0, 'Cierre Q1: 52 check-ins. Superamos meta en 44%.', 'GREAT');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c1000003-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-01-07 09:00:00-06', 7.2, 0.6, 'Baseline: 7.2%. Arrancamos cobranza preventiva.', 'CONCERNED'),
  ('c1000003-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-01-28 09:00:00-06', 6.8, 0.65, 'Mejora marginal. Brigada de cobranza activada.', 'NEUTRAL'),
  ('c1000003-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-02-18 09:00:00-06', 6.1, 0.65, 'Tendencia positiva pero lenta.', 'CONCERNED'),
  ('c1000003-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-03-11 09:00:00-06', 5.6, 0.6, 'Cierre Q1: 5.6% vs meta 5.0%. Llevamos a Q2.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c1000004-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-01-07 09:30:00-06', 32, 0.55, 'Arranque. Necesitamos reforzar equipo de gestores.', 'CONCERNED'),
  ('c1000004-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-01-28 09:30:00-06', 35, 0.5, 'Lenta mejora. Falta liquidez en acreditados.', 'CONCERNED'),
  ('c1000004-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-02-18 09:30:00-06', 39, 0.5, 'No alcanzaremos 55%. Proponemos reestructura.', 'BLOCKED'),
  ('c1000004-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-03-11 09:30:00-06', 41, 0.5, 'Cierre Q1: 41% vs 55%. Iniciamos reestructura Q2.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c1000005-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-01-07 10:30:00-06', 15, 0.5, 'Baseline: 15%. Lanzamos campaña de adopción.', 'NEUTRAL'),
  ('c1000005-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-01-28 10:30:00-06', 19, 0.45, 'Crecimiento lento. Socios mayores prefieren sucursal.', 'CONCERNED'),
  ('c1000005-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-02-18 10:30:00-06', 23, 0.4, 'Mejoramos pero lejos de 40%. App v2 se retrasa.', 'CONCERNED'),
  ('c1000005-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-03-11 10:30:00-06', 27, 0.4, 'Cierre Q1: 27% vs 40%. App móvil es la palanca para Q2.', 'CONCERNED');

-- =============================================================================
-- 10. OBJETIVOS Q2 2026 — COMPANY
-- =============================================================================
INSERT INTO objectives (id, organization_id, cycle_id, title, description, level, status, owner_id, strategic_intent_id, created_by) VALUES
  ('b2000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Acelerar la rentabilidad del portafolio crediticio',
   'Incrementar el margen neto de la cartera conteniendo la mora y optimizando el costo de colocación.',
   'COMPANY', 'ACTIVE',
   'a1000001-0000-4000-a000-000000000001',
   'ac000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b2000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Transformar la experiencia digital del socio',
   'Convertir la app móvil en el canal principal de interacción reduciendo fricción y tiempo de servicio.',
   'COMPANY', 'ACTIVE',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'ac000002-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b2000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Fortalecer la cultura de gestión basada en datos',
   'Lograr que las decisiones estratégicas se sustenten en modelos analíticos y dashboards en tiempo real.',
   'COMPANY', 'ACTIVE',
   'a1000002-0000-4000-a000-000000000001',
   'ac000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- =============================================================================
-- 11. OBJETIVOS Q2 2026 — AREA
-- =============================================================================
INSERT INTO objectives (id, organization_id, cycle_id, parent_objective_id, title, description, level, status, owner_id, team_id, created_by) VALUES
  ('b2000004-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000001-0000-4000-a000-000000000001',
   'Optimizar la recuperación y control del riesgo crediticio',
   'Reducir mora en todos los segmentos y mejorar recuperación mediante modelos predictivos.',
   'AREA', 'ACTIVE',
   'a1000001-0000-4000-a000-000000000001',
   'a3000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b2000005-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000002-0000-4000-a000-000000000001',
   'Modernizar la infraestructura tecnológica hacia cloud-native',
   'Migrar servicios core a arquitectura cloud y habilitar capacidades analíticas avanzadas.',
   'AREA', 'ACTIVE',
   'a1000002-0000-4000-a000-000000000001',
   'a3000002-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- =============================================================================
-- 12. OBJETIVOS Q2 2026 — TEAM (3 nuevos; hay 2 existentes = 5 total en Q2)
-- =============================================================================
INSERT INTO objectives (id, organization_id, cycle_id, parent_objective_id, title, description, level, status, owner_id, team_id, created_by) VALUES
  ('b2000006-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000005-0000-4000-a000-000000000001',
   'Implementar el motor de scoring predictivo v2',
   'Desplegar modelo ML que mejore la precisión de evaluación crediticia y amplíe la cobertura.',
   'TEAM', 'ACTIVE',
   'a1000002-0000-4000-a000-000000000001',
   'a3000002-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b2000007-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000004-0000-4000-a000-000000000001',
   'Reducir el tiempo de otorgamiento de crédito a 48 horas',
   'Digitalizar y automatizar análisis y aprobación para eliminar cuellos de botella manuales.',
   'TEAM', 'ACTIVE',
   'a1000001-0000-4000-a000-000000000001',
   'a3000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b2000008-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000002-0000-4000-a000-000000000001',
   'Lanzar la app móvil de autoservicio v3 con 15,000 descargas',
   'Rediseñar la app con UX conversacional, pagos inmediatos y solicitud de crédito digital.',
   'TEAM', 'ACTIVE',
   NULL,
   'a3000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- =============================================================================
-- 13. OBJETIVOS Q2 2026 — INDIVIDUAL
-- =============================================================================
INSERT INTO objectives (id, organization_id, cycle_id, parent_objective_id, title, description, level, status, owner_id, team_id, created_by) VALUES
  ('b2000009-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000006-0000-4000-a000-000000000001',
   'Diseñar e implementar el pipeline ML para scoring v2',
   'Construir pipeline de datos, entrenamiento y despliegue del modelo de riesgo predictivo.',
   'INDIVIDUAL', 'ACTIVE',
   'a1000002-0000-4000-a000-000000000001',
   'a3000002-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b2000010-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000004-0000-4000-a000-000000000001',
   'Modelar y validar 12 indicadores de riesgo temprano',
   'Definir y validar con el área los indicadores de alerta para detección de mora antes de 30 días.',
   'INDIVIDUAL', 'ACTIVE',
   'a1000003-0000-4000-a000-000000000001',
   'a3000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- =============================================================================
-- 14. KRs Q2 2026
-- =============================================================================
INSERT INTO key_results (id, objective_id, owner_id, title, type, metric_unit, start_value, target_value, current_value, confidence, status, check_in_cadence, created_by) VALUES
  -- C1: Rentabilidad portafolio
  ('c2000001-0000-4000-a000-000000000001', 'b2000001-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Rendimiento neto de la cartera de crédito',
   'INCREASE', '%', 8.5, 10.0, 9.1, 0.75, 'ON_TRACK', 'BIWEEKLY',
   'a1000001-0000-4000-a000-000000000001'),

  ('c2000002-0000-4000-a000-000000000001', 'b2000001-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Índice de mora total de la cartera',
   'DECREASE', '%', 5.8, 4.5, 5.2, 0.55, 'AT_RISK', 'BIWEEKLY',
   'a1000001-0000-4000-a000-000000000001'),

  ('c2000003-0000-4000-a000-000000000001', 'b2000001-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Costo operativo por peso colocado',
   'DECREASE', '%', 2.1, 1.8, 2.0, 0.70, 'ON_TRACK', 'MONTHLY',
   'a1000001-0000-4000-a000-000000000001'),

  -- C2: Experiencia digital
  ('c2000004-0000-4000-a000-000000000001', 'b2000002-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'NPS de canales digitales (app + web)',
   'INCREASE', 'puntos', 62, 75, 65, 0.50, 'AT_RISK', 'MONTHLY',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('c2000005-0000-4000-a000-000000000001', 'b2000002-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'Tiempo promedio de atención en sucursal',
   'DECREASE', 'minutos', 18, 10, 14, 0.72, 'ON_TRACK', 'BIWEEKLY',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('c2000006-0000-4000-a000-000000000001', 'b2000002-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   '% de socios activos usando la app mensualmente',
   'INCREASE', '%', 35, 55, 38, 0.35, 'BEHIND', 'BIWEEKLY',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  -- C3: Cultura de datos
  ('c2000007-0000-4000-a000-000000000001', 'b2000003-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   'Número de dashboards operativos activos por área',
   'INCREASE', 'dashboards', 2, 8, 5, 0.80, 'ON_TRACK', 'MONTHLY',
   'a1000002-0000-4000-a000-000000000001'),

  ('c2000008-0000-4000-a000-000000000001', 'b2000003-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   '% de decisiones gerenciales sustentadas en datos',
   'INCREASE', '%', 40, 70, 52, 0.78, 'ON_TRACK', 'MONTHLY',
   'a1000002-0000-4000-a000-000000000001'),

  ('c2000009-0000-4000-a000-000000000001', 'b2000003-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   'Índice de madurez analítica organizacional (escala 1-10)',
   'INCREASE', 'puntos', 3, 7, 4.5, 0.55, 'AT_RISK', 'MONTHLY',
   'a1000002-0000-4000-a000-000000000001'),

  -- A1: Riesgo crediticio
  ('c2000010-0000-4000-a000-000000000001', 'b2000004-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Mora en cartera PyME',
   'DECREASE', '%', 8.3, 6.0, 7.4, 0.50, 'AT_RISK', 'BIWEEKLY',
   'a1000001-0000-4000-a000-000000000001'),

  ('c2000011-0000-4000-a000-000000000001', 'b2000004-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Tasa de recuperación de cartera vencida',
   'INCREASE', '%', 28, 45, 34, 0.65, 'ON_TRACK', 'BIWEEKLY',
   'a1000001-0000-4000-a000-000000000001'),

  -- A2: Infraestructura cloud
  ('c2000012-0000-4000-a000-000000000001', 'b2000005-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   '% de servicios core migrados a cloud',
   'INCREASE', '%', 20, 60, 38, 0.75, 'ON_TRACK', 'BIWEEKLY',
   'a1000002-0000-4000-a000-000000000001'),

  ('c2000013-0000-4000-a000-000000000001', 'b2000005-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   'Tiempo promedio de despliegue de nuevas versiones',
   'DECREASE', 'días', 5, 1, 3, 0.72, 'ON_TRACK', 'BIWEEKLY',
   'a1000002-0000-4000-a000-000000000001'),

  -- T1: Scoring v2
  ('c2000014-0000-4000-a000-000000000001', 'b2000006-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   'Precisión del modelo de scoring (AUC-ROC)',
   'INCREASE', '%', 78, 90, 84, 0.80, 'ON_TRACK', 'WEEKLY',
   'a1000002-0000-4000-a000-000000000001'),

  ('c2000015-0000-4000-a000-000000000001', 'b2000006-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   '% de solicitudes con scoring automático',
   'INCREASE', '%', 45, 85, 58, 0.55, 'AT_RISK', 'WEEKLY',
   'a1000002-0000-4000-a000-000000000001'),

  -- T2: Tiempo otorgamiento
  ('c2000016-0000-4000-a000-000000000001', 'b2000007-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Tiempo promedio de otorgamiento de crédito (días hábiles)',
   'DECREASE', 'días', 5, 2, 3.5, 0.50, 'AT_RISK', 'WEEKLY',
   'a1000001-0000-4000-a000-000000000001'),

  ('c2000017-0000-4000-a000-000000000001', 'b2000007-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Número de rechazos procesados digitalmente por mes',
   'INCREASE', 'rechazos/mes', 120, 500, 245, 0.68, 'ON_TRACK', 'WEEKLY',
   'a1000001-0000-4000-a000-000000000001'),

  -- T3: App móvil
  ('c2000018-0000-4000-a000-000000000001', 'b2000008-0000-4000-a000-000000000001',
   NULL,
   'Descargas acumuladas de la app móvil v3',
   'INCREASE', 'descargas', 8000, 15000, 9500, 0.35, 'BEHIND', 'WEEKLY',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('c2000019-0000-4000-a000-000000000001', 'b2000008-0000-4000-a000-000000000001',
   NULL,
   'Retención de usuarios activos a 30 días',
   'INCREASE', '%', 42, 65, 48, 0.52, 'AT_RISK', 'WEEKLY',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  -- I1: Pipeline ML
  ('c2000020-0000-4000-a000-000000000001', 'b2000009-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   'Pipelines ML desplegados en producción',
   'INCREASE', 'pipelines', 0, 3, 1, 0.75, 'ON_TRACK', 'WEEKLY',
   'a1000002-0000-4000-a000-000000000001'),

  -- I2: Indicadores riesgo temprano
  ('c2000021-0000-4000-a000-000000000001', 'b2000010-0000-4000-a000-000000000001',
   'a1000003-0000-4000-a000-000000000001',
   'Indicadores de riesgo temprano definidos y validados',
   'INCREASE', 'indicadores', 0, 12, 7, 0.55, 'AT_RISK', 'WEEKLY',
   'a1000003-0000-4000-a000-000000000001');

-- =============================================================================
-- 15. CHECK-INS Q2 2026 (cronológico: Apr 14, Apr 28, May 12)
-- =============================================================================
INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000001-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-14 09:00:00-06', 8.7, 0.70, 'Primer cierre mensual Q2. Rendimiento mejora.', 'GOOD'),
  ('c2000001-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-28 09:00:00-06', 8.9, 0.72, 'Tendencia positiva. Cartera nueva con mejores tasas.', 'GOOD'),
  ('c2000001-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-05-12 09:00:00-06', 9.1, 0.75, 'A ritmo. Si contenemos mora, llegamos al 10%.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000002-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-14 09:15:00-06', 5.7, 0.55, 'Mora bajó 0.1 desde fin Q1. PyME sigue presionando.', 'CONCERNED'),
  ('c2000002-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-28 09:15:00-06', 5.5, 0.55, 'Mejora incremental. Necesitamos scoring v2.', 'CONCERNED'),
  ('c2000002-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-05-12 09:15:00-06', 5.2, 0.55, 'Ritmo no alcanza para llegar a 4.5%. Escalamos al comité.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000003-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-14 09:30:00-06', 2.08, 0.68, 'Reducción por automatización de captación.', 'GOOD'),
  ('c2000003-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-05-12 09:30:00-06', 2.0, 0.70, 'La digitalización de rechazos ahorra tiempo-gestor.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000004-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-14 10:00:00-06', 63, 0.50, 'NPS estable. Socios reportan lentitud en la app.', 'CONCERNED'),
  ('c2000004-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-28 10:00:00-06', 64, 0.50, 'Mejora mínima. La v3 de la app cambiará esto.', 'CONCERNED'),
  ('c2000004-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-05-12 10:00:00-06', 65, 0.50, 'NPS no despega. Lanzamiento app v3 es crítico.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000005-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-14 10:15:00-06', 17, 0.68, 'Reducción de 1 min por ficha digital.', 'GOOD'),
  ('c2000005-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-28 10:15:00-06', 15, 0.70, 'Buen avance. Nueva distribución en caja ayuda.', 'GOOD'),
  ('c2000005-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-05-12 10:15:00-06', 14, 0.72, 'En ruta hacia 10 min. Falta automatizar firmas.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000006-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-14 10:30:00-06', 36, 0.38, 'Solo 1 pp de mejora vs Q1. App actual no engancha.', 'BLOCKED'),
  ('c2000006-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-28 10:30:00-06', 37, 0.36, 'Plano. La app v3 es la única palanca real.', 'BLOCKED'),
  ('c2000006-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-05-12 10:30:00-06', 38, 0.35, 'Riesgo alto. V3 debe salir antes de Jun 15.', 'BLOCKED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000007-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 11:00:00-06', 3, 0.75, 'Dashboard de riesgo crediticio en vivo.', 'GOOD'),
  ('c2000007-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-28 11:00:00-06', 4, 0.78, 'Dashboard de cobranza desplegado.', 'GOOD'),
  ('c2000007-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 11:00:00-06', 5, 0.80, 'Vamos al ritmo. 3 más antes de cierre Q2.', 'GREAT');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000008-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 11:15:00-06', 44, 0.72, 'Reuniones de dirección ya incluyen tableros.', 'GOOD'),
  ('c2000008-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-28 11:15:00-06', 48, 0.75, 'Métricas en comité de crédito. Avanzamos bien.', 'GOOD'),
  ('c2000008-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 11:15:00-06', 52, 0.78, 'Mitad del camino. La cultura está cambiando.', 'GREAT');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000009-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 11:30:00-06', 3.5, 0.55, 'Assessment realizado. Necesitamos training SQL/Python.', 'CONCERNED'),
  ('c2000009-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-28 11:30:00-06', 4.0, 0.55, 'Iniciamos talleres. El cambio cultural toma tiempo.', 'NEUTRAL'),
  ('c2000009-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 11:30:00-06', 4.5, 0.55, 'Progresamos, pero llegar a 7 en Q2 es ambicioso.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000010-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-14 08:30:00-06', 8.1, 0.52, 'Mora PyME alta. 3 acreditados en reestructura.', 'CONCERNED'),
  ('c2000010-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-28 08:30:00-06', 7.8, 0.50, 'Leve mejora. Scoring v2 nos dará visibilidad.', 'CONCERNED'),
  ('c2000010-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-05-12 08:30:00-06', 7.4, 0.50, '0.9 pp de mejora. Meta agresiva. Escalamos al comité.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000011-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-14 08:45:00-06', 30, 0.62, 'Nuevo método de cobranza. Mejoramos 2 pp.', 'NEUTRAL'),
  ('c2000011-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-28 08:45:00-06', 32, 0.64, 'Reestructuras rindiendo. Buen ritmo.', 'GOOD'),
  ('c2000011-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-05-12 08:45:00-06', 34, 0.65, '6 pp desde inicio. Proyectamos 42% al cierre Q2.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000012-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 12:00:00-06', 25, 0.72, 'Primer microservicio migrado: notificaciones.', 'GOOD'),
  ('c2000012-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-28 12:00:00-06', 32, 0.74, 'Scoring y autenticación migrados. En ruta.', 'GREAT'),
  ('c2000012-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 12:00:00-06', 38, 0.75, 'La migración del core bancario es el siguiente reto.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000013-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 12:15:00-06', 4.5, 0.70, 'CI/CD configurado. Deploy bajó medio día.', 'GOOD'),
  ('c2000013-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 12:15:00-06', 3.0, 0.72, 'Automatizamos pruebas de integración. Objetivo: 1 día.', 'GREAT');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000014-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 13:00:00-06', 80, 0.78, 'Primer modelo entrenado con datos Q1. AUC 80%.', 'GOOD'),
  ('c2000014-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-28 13:00:00-06', 82, 0.79, 'Segunda iteración con feature engineering.', 'GOOD'),
  ('c2000014-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 13:00:00-06', 84, 0.80, 'AUC 84%. Meta 90% viable con datos de mayo.', 'GREAT');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000015-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 13:15:00-06', 48, 0.55, 'Modelo solo cubre solicitudes nuevas. Falta historial.', 'CONCERNED'),
  ('c2000015-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-28 13:15:00-06', 53, 0.55, 'Avanzamos. Integración con core bancario es lenta.', 'CONCERNED'),
  ('c2000015-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 13:15:00-06', 58, 0.55, '85% en Q2 es difícil. Proponemos Q3 como fecha.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000016-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-14 09:00:00-06', 4.8, 0.52, 'Reducción mínima. Cuello de botella en validación.', 'CONCERNED'),
  ('c2000016-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-28 09:00:00-06', 4.2, 0.51, 'Digitalizamos validación INE. Mejora 0.6 días.', 'NEUTRAL'),
  ('c2000016-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-05-12 09:00:00-06', 3.5, 0.50, 'Meta 2 días es agresiva. Integración buró es bloqueador.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000017-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-14 09:15:00-06', 155, 0.65, 'Módulo de rechazo automático activo. Buen arranque.', 'GOOD'),
  ('c2000017-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-04-28 09:15:00-06', 198, 0.67, 'Volumen creciendo. Ajustamos reglas de negocio.', 'GOOD'),
  ('c2000017-0000-4000-a000-000000000001', 'a1000001-0000-4000-a000-000000000001',
   '2026-05-12 09:15:00-06', 245, 0.68, 'A buen ritmo. Proyectamos 420-450 al cierre Q2.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000018-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-14 14:00:00-06', 8800, 0.38, '800 descargas en 2 semanas. Campaña no ha arrancado.', 'CONCERNED'),
  ('c2000018-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-28 14:00:00-06', 9100, 0.37, 'Ritmo lento. App v3 generará la tracción real.', 'BLOCKED'),
  ('c2000018-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-05-12 14:00:00-06', 9500, 0.35, 'Muy atrás. V3 debe salir antes de Jun 15.', 'BLOCKED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000019-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-14 14:15:00-06', 44, 0.52, 'Retención subió 2 pp. Usuarios que pagan vuelven.', 'NEUTRAL'),
  ('c2000019-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-04-28 14:15:00-06', 46, 0.52, 'Mejora lenta. Push de notificaciones ayuda.', 'NEUTRAL'),
  ('c2000019-0000-4000-a000-000000000001', '63d97824-0990-48c1-ae56-e606c703ece4',
   '2026-05-12 14:15:00-06', 48, 0.52, 'Mejorando. La v3 debería cambiar esto mucho.', 'NEUTRAL');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000020-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-14 15:00:00-06', 0, 0.72, 'Pipeline ETL configurado. Primer modelo en staging.', 'NEUTRAL'),
  ('c2000020-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-04-28 15:00:00-06', 1, 0.74, 'Primer pipeline en producción. Funcionando.', 'GREAT'),
  ('c2000020-0000-4000-a000-000000000001', 'a1000002-0000-4000-a000-000000000001',
   '2026-05-12 15:00:00-06', 1, 0.75, 'Segundo pipeline en testing. 3 listos para Jun 30.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000021-0000-4000-a000-000000000001', 'a1000003-0000-4000-a000-000000000001',
   '2026-04-14 15:30:00-06', 3, 0.58, 'Primeros 3 indicadores: días de atraso, monto, frecuencia.', 'NEUTRAL'),
  ('c2000021-0000-4000-a000-000000000001', 'a1000003-0000-4000-a000-000000000001',
   '2026-04-28 15:30:00-06', 5, 0.56, '5 indicadores. La validación con el área toma tiempo.', 'NEUTRAL'),
  ('c2000021-0000-4000-a000-000000000001', 'a1000003-0000-4000-a000-000000000001',
   '2026-05-12 15:30:00-06', 7, 0.55, '7 indicadores. 12 en Q2 es retador. Datos externos faltan.', 'CONCERNED');

-- =============================================================================
-- 16. INICIATIVAS
-- =============================================================================
INSERT INTO initiatives (id, organization_id, cycle_id, team_id, owner_id, title, description, status, progress, start_date, due_date, created_by) VALUES
  ('a4000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a3000002-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   'Motor de Scoring Predictivo v2',
   'Desarrollo del modelo ML de segunda generación para evaluación crediticia automática.',
   'IN_PROGRESS', 45, '2026-04-01', '2026-06-30',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('a4000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a3000001-0000-4000-a000-000000000001',
   'a1000001-0000-4000-a000-000000000001',
   'Plataforma Digital de Recuperación de Cartera',
   'Sistema de cobranza con automatización de recordatorios, reestructuras y seguimiento de acuerdos.',
   'IN_PROGRESS', 35, '2026-04-01', '2026-06-30',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('a4000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a3000003-0000-4000-a000-000000000001',
   NULL,
   'App Móvil Socios v3 — UX Conversacional',
   'Rediseño completo de la app con flujos conversacionales, pagos inmediatos y solicitud de crédito digital.',
   'IN_PROGRESS', 60, '2026-04-01', '2026-06-15',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('a4000004-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a3000002-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001',
   'Migración a Infraestructura Cloud-Native',
   'Migración progresiva de servicios core a AWS. Objetivo: 60% en cloud al cierre de Q2.',
   'IN_PROGRESS', 55, '2026-04-01', '2026-06-30',
   '63d97824-0990-48c1-ae56-e606c703ece4');

INSERT INTO initiative_key_results (initiative_id, kr_id) VALUES
  ('a4000001-0000-4000-a000-000000000001', 'c2000014-0000-4000-a000-000000000001'),
  ('a4000001-0000-4000-a000-000000000001', 'c2000015-0000-4000-a000-000000000001'),
  ('a4000001-0000-4000-a000-000000000001', 'c2000020-0000-4000-a000-000000000001'),
  ('a4000002-0000-4000-a000-000000000001', 'c2000011-0000-4000-a000-000000000001'),
  ('a4000002-0000-4000-a000-000000000001', 'c2000016-0000-4000-a000-000000000001'),
  ('a4000002-0000-4000-a000-000000000001', 'c2000021-0000-4000-a000-000000000001'),
  ('a4000003-0000-4000-a000-000000000001', 'c2000018-0000-4000-a000-000000000001'),
  ('a4000003-0000-4000-a000-000000000001', 'c2000019-0000-4000-a000-000000000001'),
  ('a4000004-0000-4000-a000-000000000001', 'c2000012-0000-4000-a000-000000000001'),
  ('a4000004-0000-4000-a000-000000000001', 'c2000013-0000-4000-a000-000000000001')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 17. HITOS
-- =============================================================================
INSERT INTO milestones (id, initiative_id, title, status, due_date, assignee_id, sort_order) VALUES
  ('a5000001-0000-4000-a000-000000000001', 'a4000001-0000-4000-a000-000000000001',
   'Análisis de requerimientos y datos',
   'COMPLETED', '2026-04-18', 'a1000002-0000-4000-a000-000000000001', 1),
  ('a5000002-0000-4000-a000-000000000001', 'a4000001-0000-4000-a000-000000000001',
   'Desarrollo del modelo ML (feature engineering + entrenamiento)',
   'IN_PROGRESS', '2026-05-30', 'a1000002-0000-4000-a000-000000000001', 2),
  ('a5000003-0000-4000-a000-000000000001', 'a4000001-0000-4000-a000-000000000001',
   'Testing, validación y QA del modelo',
   'PENDING', '2026-06-15', 'a1000002-0000-4000-a000-000000000001', 3),
  ('a5000004-0000-4000-a000-000000000001', 'a4000001-0000-4000-a000-000000000001',
   'Deploy a producción e integración con core bancario',
   'PENDING', '2026-06-30', 'a1000002-0000-4000-a000-000000000001', 4),

  ('a5000005-0000-4000-a000-000000000001', 'a4000002-0000-4000-a000-000000000001',
   'Diagnóstico de cartera morosa y segmentación',
   'COMPLETED', '2026-04-25', 'a1000001-0000-4000-a000-000000000001', 1),
  ('a5000006-0000-4000-a000-000000000001', 'a4000002-0000-4000-a000-000000000001',
   'Prototipo de interfaz para gestores de cobranza',
   'IN_PROGRESS', '2026-05-16', 'a1000003-0000-4000-a000-000000000001', 2),
  ('a5000007-0000-4000-a000-000000000001', 'a4000002-0000-4000-a000-000000000001',
   'Integración con buró de crédito y automatización de alertas',
   'PENDING', '2026-06-20', 'a1000001-0000-4000-a000-000000000001', 3),

  ('a5000008-0000-4000-a000-000000000001', 'a4000003-0000-4000-a000-000000000001',
   'Diseño UX/UI conversacional aprobado',
   'COMPLETED', '2026-04-22', NULL, 1),
  ('a5000009-0000-4000-a000-000000000001', 'a4000003-0000-4000-a000-000000000001',
   'Desarrollo de flujos: pagos, consultas y solicitud de crédito',
   'IN_PROGRESS', '2026-05-31', NULL, 2),
  ('a5000010-0000-4000-a000-000000000001', 'a4000003-0000-4000-a000-000000000001',
   'Lanzamiento en App Store y Google Play + campaña digital',
   'PENDING', '2026-06-15', NULL, 3),

  ('a5000011-0000-4000-a000-000000000001', 'a4000004-0000-4000-a000-000000000001',
   'Migración de microservicios de soporte (notificaciones, auth)',
   'COMPLETED', '2026-04-30', 'a1000002-0000-4000-a000-000000000001', 1),
  ('a5000012-0000-4000-a000-000000000001', 'a4000004-0000-4000-a000-000000000001',
   'Migración del motor de scoring y analítica',
   'IN_PROGRESS', '2026-05-31', 'a1000002-0000-4000-a000-000000000001', 2),
  ('a5000013-0000-4000-a000-000000000001', 'a4000004-0000-4000-a000-000000000001',
   'Migración del core bancario (fase 1)',
   'PENDING', '2026-06-30', 'a1000002-0000-4000-a000-000000000001', 3);

-- =============================================================================
-- 18. SPRINT ACTIVO (dentro del rango Q2: Apr 1 - Jun 30, 2026)
-- =============================================================================
INSERT INTO sprint_cycles (id, organization_id, cycle_id, team_id, name, goal, status, start_date, end_date, planned_velocity, created_by) VALUES
  ('a6000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a3000002-0000-4000-a000-000000000001',
   'Sprint 7 — Scoring v2 Core',
   'Completar el entrenamiento del modelo v2 y desplegar el primer pipeline en producción.',
   'ACTIVE', '2026-05-05', '2026-05-30', 34,
   'a1000002-0000-4000-a000-000000000001');

INSERT INTO sprint_goal_krs (sprint_id, kr_id) VALUES
  ('a6000001-0000-4000-a000-000000000001', 'c2000014-0000-4000-a000-000000000001'),
  ('a6000001-0000-4000-a000-000000000001', 'c2000020-0000-4000-a000-000000000001')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 19. BACKLOG ITEMS (orden: EPIC → FEATURE → STORY para satisfacer FK jerárquica)
-- =============================================================================
-- EPIC
INSERT INTO backlog_items (id, organization_id, type, title, description, status, priority, initiative_id, cycle_id, assignee_id, created_by) VALUES
  ('a7000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'EPIC', 'Motor de Scoring Predictivo v2',
   'Epic principal que agrupa el desarrollo del modelo ML de scoring crediticio.',
   'IN_PROGRESS', 'HIGH',
   'a4000001-0000-4000-a000-000000000001',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a1000002-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001');

-- FEATUREs (parent = EPIC)
INSERT INTO backlog_items (id, organization_id, type, title, description, acceptance_criteria, status, priority, story_points, parent_id, initiative_id, sprint_id, cycle_id, assignee_id, created_by) VALUES
  ('a7000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'FEATURE', 'API REST de predicción de riesgo crediticio',
   'Endpoint que recibe datos del solicitante y retorna score + probabilidad de mora.',
   'Responde en < 300ms. Swagger completo. Cobertura > 90%.',
   'IN_PROGRESS', 'HIGH', 8,
   'a7000001-0000-4000-a000-000000000001',
   'a4000001-0000-4000-a000-000000000001',
   'a6000001-0000-4000-a000-000000000001',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a1000002-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001'),

  ('a7000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'FEATURE', 'Dashboard de scoring para gestores de crédito',
   'Interfaz con score de cada solicitud activa con semáforo y factores de riesgo.',
   'Gestor ve score, factores top 5 y monto recomendado. Responsive.',
   'OPEN', 'HIGH', 13,
   'a7000001-0000-4000-a000-000000000001',
   'a4000001-0000-4000-a000-000000000001',
   'a6000001-0000-4000-a000-000000000001',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a1000002-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001');

-- STORYs (parent = FEATURE)
INSERT INTO backlog_items (id, organization_id, type, title, description, acceptance_criteria, status, priority, story_points, parent_id, initiative_id, sprint_id, cycle_id, assignee_id, created_by) VALUES
  ('a7000004-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'STORY', 'Integrar datos del Buró de Crédito en tiempo real',
   'Consultar el score Buró del solicitante durante el análisis crediticio.',
   'Consulta automática. Tiempo de respuesta total < 5 segundos.',
   'IN_PROGRESS', 'CRITICAL', 5,
   'a7000002-0000-4000-a000-000000000001',
   'a4000001-0000-4000-a000-000000000001',
   'a6000001-0000-4000-a000-000000000001',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'a1000002-0000-4000-a000-000000000001',
   'a1000002-0000-4000-a000-000000000001'),

  ('a7000005-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'STORY', 'Exportar reportes de scoring por cartera y período',
   'Generación de reportes PDF/Excel con distribución de scores por segmento.',
   'Reporte generado en < 10 segundos para hasta 5,000 registros.',
   'OPEN', 'MEDIUM', 3,
   'a7000002-0000-4000-a000-000000000001',
   'a4000001-0000-4000-a000-000000000001', NULL,
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   NULL,
   'a1000002-0000-4000-a000-000000000001');

-- =============================================================================
-- 20. ACUERDOS
-- =============================================================================
INSERT INTO agreements (id, organization_id, cycle_id, title, description, source, agreement_date, due_date, status, priority, created_by) VALUES
  ('a8000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Integrar consulta al Buró de Crédito en el flujo de análisis crediticio',
   'El Comité de Riesgos acordó que toda solicitud > $50,000 debe consultar automáticamente el Buró antes del comité de aprobación.',
   'Comité de Riesgos — Abril 2026',
   '2026-04-29', '2026-06-15', 'IN_PROGRESS', 'HIGH',
   'a1000001-0000-4000-a000-000000000001'),

  ('a8000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Definir y publicar KPIs de mora con actualización diaria en dashboard ejecutivo',
   'Dirección General acordó que mora, recuperación y exposición estén disponibles en dashboard con datos del día anterior.',
   'Sesión Dirección General — Mayo 2026',
   '2026-05-05', '2026-05-31', 'PENDING', 'CRITICAL',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('a8000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Capacitar a los 12 gestores en la nueva plataforma digital de cobranza',
   'RRHH y TI acordaron 3 sesiones de 2 horas antes del lanzamiento de la plataforma de recuperación.',
   'Comité de Riesgos — Abril 2026',
   '2026-04-29', '2026-06-10', 'PENDING', 'MEDIUM',
   'a1000001-0000-4000-a000-000000000001');

INSERT INTO agreement_backlog_items (agreement_id, backlog_item_id) VALUES
  ('a8000001-0000-4000-a000-000000000001', 'a7000004-0000-4000-a000-000000000001'),
  ('a8000001-0000-4000-a000-000000000001', 'a7000002-0000-4000-a000-000000000001'),
  ('a8000002-0000-4000-a000-000000000001', 'a7000003-0000-4000-a000-000000000001')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 21. AI BRIEFING Q1 2026 — Cierre de Ciclo (inmutable: ON CONFLICT DO NOTHING)
-- =============================================================================
INSERT INTO ai_briefings (id, organization_id, cycle_id, type, title, content, created_by) VALUES (
  'ae000001-0000-4000-a000-000000000001',
  'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
  '138cec9f-7b40-4f0d-83be-315a3a2093e2',
  'cycle_close',
  'Cierre de Ciclo Q1 2026 — Caja Morelia',
  '{
    "cycle_name": "Q1 2026",
    "cycle_id": "138cec9f-7b40-4f0d-83be-315a3a2093e2",
    "cycle_score": 62,
    "total_objectives": 3,
    "completed": 1,
    "active_at_close": 2,
    "cancelled": 0,
    "completion_rate": 33,
    "at_risk_count": 2,
    "narrative": "El Q1 2026 marcó el arranque formal de la gestión por OKRs en Caja Morelia. El objetivo cultural fue el gran logro: toda la organización adoptó la metodología con 52 check-ins registrados, superando la meta en 44%. Sin embargo, los objetivos financieros (mora y adopción digital) quedaron por debajo, evidenciando que el cambio operativo requiere más tiempo que el cultural. La experiencia del Q1 enseñó que definir metas financieras agresivas sin las capacidades tecnológicas de soporte genera frustración. El Q2 debe corregir esto con el scoring v2 y la app móvil como palancas centrales.",
    "achievements": [
      "95% de equipos con OKRs definidos — meta era 80%, superada con 7 equipos comprometidos",
      "52 check-ins registrados — cultura de seguimiento instalada en la organización",
      "Lanzamiento exitoso de la plataforma OKR como único sistema de gestión estratégica",
      "Mora personal bajó 1.6 pp (7.2% a 5.6%) — progreso real aunque insuficiente para la meta"
    ],
    "misses": [
      "Mora personal cerró en 5.6% vs meta de 5.0% — faltaron herramientas predictivas",
      "Tasa de recuperación en 41% vs meta de 55% — la cartera reestructurada requiere más tiempo",
      "Adopción digital en 27% vs meta de 40% — la app actual no genera suficiente engagement",
      "Los objetivos financieros se definieron sin considerar las dependencias tecnológicas"
    ],
    "learnings": [
      "Las metas culturales son más fáciles de lograr que las operativas — el Q2 debe equilibrar ambas",
      "El scoring predictivo es la palanca más importante para los objetivos financieros",
      "Los check-ins bissemanales generan mayor compromiso que los mensuales",
      "La adopción digital depende más del producto (app) que de la comunicación — invertir en UX",
      "Los OKRs de ÁREA funcionan como puentes efectivos entre estrategia y ejecución de equipo"
    ],
    "next_cycle_recommendations": [
      "Priorizar el despliegue del scoring v2 como desbloqueador de los objetivos de mora",
      "Lanzar app móvil v3 antes del 15 de junio — es la palanca crítica para adopción digital",
      "Mantener cadencia bisemanal de check-ins en todos los KRs",
      "Crear OKRs INDIVIDUALES para los perfiles técnicos clave — mayor accountability",
      "Agregar OKR de capacitación analítica — es un cuello de botella identificado en Q1"
    ],
    "generated_at": "2026-04-02T08:00:00.000Z"
  }'::jsonb,
  '63d97824-0990-48c1-ae56-e606c703ece4'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ADDENDUM: PERFILES DE ROL + PROGRAMAS DE TRANSFORMACIÓN
-- Nuevos usuarios: Elena Flores (Consejo), Pedro Ramírez (Gerencia),
--                  Ana Torres (Operativo)
-- Nuevos programas: 2 programas estratégicos plurianuales para /program
-- =============================================================================

-- Cleanup restante del addendum (independiente de jerarquía de objetivos)
-- Nota: ai_briefings tiene trigger de inmutabilidad — no se elimina; usa ON CONFLICT DO NOTHING

-- Sector assessment (cascade: sector_assessments → threat_scores)
DELETE FROM sector_assessments WHERE id IN (
  'be000001-0000-4000-a000-000000000001',
  'be000002-0000-4000-a000-000000000001'
);
DELETE FROM sector_assessment_sessions WHERE id IN (
  'bd000001-0000-4000-a000-000000000001',
  'bd000002-0000-4000-a000-000000000001'
);

-- Delivery (leaf → root)
DELETE FROM deliverables WHERE phase_id IN (
  'bb000001-0000-4000-a000-000000000001',
  'bb000002-0000-4000-a000-000000000001',
  'bb000003-0000-4000-a000-000000000001',
  'bb000004-0000-4000-a000-000000000001',
  'bb000005-0000-4000-a000-000000000001',
  'bb000006-0000-4000-a000-000000000001'
);
DELETE FROM delivery_phases WHERE id IN (
  'bb000001-0000-4000-a000-000000000001',
  'bb000002-0000-4000-a000-000000000001',
  'bb000003-0000-4000-a000-000000000001',
  'bb000004-0000-4000-a000-000000000001',
  'bb000005-0000-4000-a000-000000000001',
  'bb000006-0000-4000-a000-000000000001'
);
DELETE FROM delivery_programs WHERE id IN (
  'ba000001-0000-4000-a000-000000000001',
  'ba000002-0000-4000-a000-000000000001'
);

DELETE FROM program_cycles WHERE id IN (
  'b4000001-0000-4000-a000-000000000001',
  'b4000002-0000-4000-a000-000000000001',
  'b4000003-0000-4000-a000-000000000001',
  'b4000004-0000-4000-a000-000000000001'
);
DELETE FROM transformation_programs WHERE id IN (
  'b3000001-0000-4000-a000-000000000001',
  'b3000002-0000-4000-a000-000000000001'
);

-- --- A1. Nuevos usuarios ---
-- Perfiles cubiertos:
--   elena.flores@demo.com  VIEWER  → Presidenta del Consejo de Administración
--   pedro.ramirez@demo.com MANAGER → Gerente de Cobranza (Comité de Riesgos)
--   ana.torres@demo.com    MEMBER  → Ejecutiva Comercial (usuario operativo)
INSERT INTO users (id, organization_id, email, password_hash, name, role, is_active, email_verified) VALUES
  ('af000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'elena.flores@demo.com',
   crypt('Demo2026#', gen_salt('bf')),
   'Elena Flores', 'VIEWER', true, true),

  ('af000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'pedro.ramirez@demo.com',
   crypt('Demo2026#', gen_salt('bf')),
   'Pedro Ramírez', 'MANAGER', true, true),

  ('af000003-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'ana.torres@demo.com',
   crypt('Demo2026#', gen_salt('bf')),
   'Ana Torres', 'MEMBER', true, true);

-- --- A2. Membresías de equipo ---
INSERT INTO team_members (team_id, user_id, role, added_by_id) VALUES
  -- Elena observa el equipo de Finanzas (perspectiva de Consejo sobre riesgo financiero)
  ('a3000001-0000-4000-a000-000000000001', 'af000001-0000-4000-a000-000000000001',
   'OBSERVER', '63d97824-0990-48c1-ae56-e606c703ece4'),
  -- Pedro es miembro activo de Finanzas (gestión de cobranza y recuperación)
  ('a3000001-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   'MEMBER', '63d97824-0990-48c1-ae56-e606c703ece4'),
  -- Ana es miembro del equipo Comercial (captación de socios y canal digital)
  ('a3000003-0000-4000-a000-000000000001', 'af000003-0000-4000-a000-000000000001',
   'MEMBER', '63d97824-0990-48c1-ae56-e606c703ece4')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- --- A3. Cuerpos de gobierno ---
INSERT INTO governance_members (body_id, user_id, role_label) VALUES
  ('a9000001-0000-4000-a000-000000000001', 'af000001-0000-4000-a000-000000000001',
   'Presidenta del Consejo'),
  ('a9000002-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   'Coordinador de Cobranza')
ON CONFLICT (body_id, user_id) DO NOTHING;

-- --- A4. Objetivos individuales Q2 — Pedro y Ana ---
-- INDIVIDUAL: actualmente 2/5 en Q2, agregamos 2 → total 4/5
INSERT INTO objectives (id, organization_id, cycle_id, parent_objective_id, title, description, level, status, owner_id, team_id, created_by) VALUES
  ('b2000011-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000007-0000-4000-a000-000000000001',
   'Digitalizar la gestión de expedientes de cobranza preventiva',
   'Transformar el flujo de seguimiento de cartera vencida con herramientas digitales, alertas automáticas y firma electrónica de acuerdos de pago.',
   'INDIVIDUAL', 'ACTIVE',
   'af000002-0000-4000-a000-000000000001',
   'a3000001-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('b2000012-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'b2000008-0000-4000-a000-000000000001',
   'Incrementar captación de socios en zona norte mediante campaña digital',
   'Lanzar campaña de referidos en app + redes para captar 150 nuevos socios en el corredor norte de la ciudad antes del cierre de Q2.',
   'INDIVIDUAL', 'ACTIVE',
   'af000003-0000-4000-a000-000000000001',
   'a3000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- --- A5. KRs individuales Q2 ---
INSERT INTO key_results (id, objective_id, owner_id, title, type, metric_unit, start_value, target_value, current_value, confidence, status, check_in_cadence, created_by) VALUES
  ('c2000022-0000-4000-a000-000000000001', 'b2000011-0000-4000-a000-000000000001',
   'af000002-0000-4000-a000-000000000001',
   'Tiempo promedio de resolución de expedientes vencidos',
   'DECREASE', 'días', 12, 4, 9, 0.58, 'AT_RISK', 'WEEKLY',
   'af000002-0000-4000-a000-000000000001'),

  ('c2000023-0000-4000-a000-000000000001', 'b2000011-0000-4000-a000-000000000001',
   'af000002-0000-4000-a000-000000000001',
   'Cartera vencida recuperada con acuerdo de pago digital',
   'INCREASE', '%', 8, 40, 22, 0.65, 'ON_TRACK', 'WEEKLY',
   'af000002-0000-4000-a000-000000000001'),

  ('c2000024-0000-4000-a000-000000000001', 'b2000012-0000-4000-a000-000000000001',
   'af000003-0000-4000-a000-000000000001',
   'Nuevos socios captados en zona norte',
   'INCREASE', 'socios', 0, 150, 47, 0.52, 'AT_RISK', 'BIWEEKLY',
   'af000003-0000-4000-a000-000000000001'),

  ('c2000025-0000-4000-a000-000000000001', 'b2000012-0000-4000-a000-000000000001',
   'af000003-0000-4000-a000-000000000001',
   'Tasa de conversión de prospectos contactados a socios activos',
   'INCREASE', '%', 5, 25, 12, 0.60, 'ON_TRACK', 'BIWEEKLY',
   'af000003-0000-4000-a000-000000000001');

-- --- A6. Check-ins de KRs individuales Q2 ---
INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000022-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   '2026-04-21 08:00:00-06', 12, 0.60,
   'Baseline confirmado. La mayoría se gestiona en papel. Iniciamos mapeo de proceso digital.', 'NEUTRAL'),
  ('c2000022-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   '2026-05-05 08:00:00-06', 10, 0.59,
   'Formulario digital en piloto con 15 expedientes. Buen avance pero buró y firma son cuellos de botella.', 'NEUTRAL'),
  ('c2000022-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   '2026-05-19 08:00:00-06', 9, 0.58,
   'Reducimos 3 días pero la meta de 4 es muy agresiva sin integración de buró en tiempo real.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000023-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   '2026-04-21 08:30:00-06', 8, 0.63,
   'Solo cartera antigua tiene acuerdos digitales. Nuevo proceso de firma electrónica en diseño.', 'NEUTRAL'),
  ('c2000023-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   '2026-05-05 08:30:00-06', 15, 0.64,
   'Primer lote: 12 clientes firmaron acuerdo digital. El proceso funciona. Escalando.', 'GOOD'),
  ('c2000023-0000-4000-a000-000000000001', 'af000002-0000-4000-a000-000000000001',
   '2026-05-19 08:30:00-06', 22, 0.65,
   'En ritmo para 35-40%. La clave es la firma electrónica y el WhatsApp como canal de cierre.', 'GOOD');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000024-0000-4000-a000-000000000001', 'af000003-0000-4000-a000-000000000001',
   '2026-04-28 09:00:00-06', 12, 0.58,
   'Primer evento presencial en zona norte: 12 prospectos interesados. Campaña digital pendiente.', 'NEUTRAL'),
  ('c2000024-0000-4000-a000-000000000001', 'af000003-0000-4000-a000-000000000001',
   '2026-05-12 09:00:00-06', 47, 0.52,
   'Campaña en redes activada. Ritmo de 25-30 socios/quincena. Meta 150 es retadora pero alcanzable con app v3.', 'CONCERNED');

INSERT INTO check_ins (kr_id, user_id, checked_at, current_value, confidence, notes, mood) VALUES
  ('c2000025-0000-4000-a000-000000000001', 'af000003-0000-4000-a000-000000000001',
   '2026-04-28 09:30:00-06', 5, 0.60,
   'Baseline: 5% conversión previa. Nuevo script de llamada y demo de app activos.', 'NEUTRAL'),
  ('c2000025-0000-4000-a000-000000000001', 'af000003-0000-4000-a000-000000000001',
   '2026-05-12 09:30:00-06', 12, 0.60,
   'Script mejorado: 12% de conversión. El app ayuda a cerrar en el acto. Escalamos el canal.', 'GOOD');

-- --- A7. Programas de Transformación ---
INSERT INTO transformation_programs (id, organization_id, created_by, title, description, start_year, end_year, status, vision_statement) VALUES
  ('b3000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'Transformación Digital 2025–2027',
   'Programa estratégico de 3 años para digitalizar todos los puntos de contacto con el socio y migrar la infraestructura tecnológica a cloud-native. Abarca app móvil, scoring predictivo, automatización de procesos y canales digitales.',
   2025, 2027, 'ACTIVE',
   'Ser una institución financiera 100% digital-first al 2027: cero procesos manuales en la experiencia del socio y decisiones crediticias 100% automatizadas por modelos de IA.'),

  ('b3000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'Excelencia en Gestión de Riesgo 2026–2028',
   'Programa de 3 años para reducir la mora por debajo del 3% mediante inteligencia analítica avanzada, scoring predictivo v2/v3, cobranza preventiva digital y fortalecimiento de la cultura de riesgo en todos los niveles.',
   2026, 2028, 'ACTIVE',
   'Ser reconocidos como la cooperativa de crédito con el mejor indicador de mora del sector, respaldado por modelos predictivos de clase mundial y un equipo con cultura de datos.');

INSERT INTO program_cycles (id, program_id, cycle_id, year_label, year_number, focus_areas, expected_outcomes) VALUES
  ('b4000001-0000-4000-a000-000000000001',
   'b3000001-0000-4000-a000-000000000001',
   '138cec9f-7b40-4f0d-83be-315a3a2093e2',
   'Q1 2026', 2026,
   ARRAY['Digital', 'Ejecución', 'Gobernanza'],
   'Base tecnológica lista: CI/CD configurado, primeros microservicios en cloud, OKRs adoptados por toda la organización con 52 check-ins registrados.'),

  ('b4000002-0000-4000-a000-000000000001',
   'b3000001-0000-4000-a000-000000000001',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Q2 2026', 2026,
   ARRAY['Digital', 'Modelo de Negocio', 'Talento'],
   'App móvil v3 lanzada con 15,000 descargas, scoring predictivo v2 en producción (AUC 90%), 60% de servicios core migrados a cloud.'),

  ('b4000003-0000-4000-a000-000000000001',
   'b3000002-0000-4000-a000-000000000001',
   '138cec9f-7b40-4f0d-83be-315a3a2093e2',
   'Q1 2026', 2026,
   ARRAY['Regulatorio', 'Gobernanza'],
   'Baseline de indicadores de riesgo calibrado, modelo de cobranza preventiva en piloto, mora personal medida semanalmente con reporte al Comité de Riesgos.'),

  ('b4000004-0000-4000-a000-000000000001',
   'b3000002-0000-4000-a000-000000000001',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Q2 2026', 2026,
   ARRAY['Eficiencia', 'Gobernanza', 'Regulatorio'],
   'Mora PyME reducida 2pp (8.3%→6.3%), scoring automático cubriendo 85% de solicitudes, proceso de reestructura digital operando con firma electrónica.');

-- --- A8. Briefing ejecutivo Q2 2026 (para /reports/executive-briefing) ---
INSERT INTO ai_briefings (id, organization_id, cycle_id, type, title, content, created_by) VALUES (
  'ae000002-0000-4000-a000-000000000001',
  'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
  '1b95fbef-9f8a-4247-8564-1577de49a5ee',
  'executive_briefing',
  'Briefing Ejecutivo — Semana 20, Mayo 2026',
  '{
    "cycle_name": "Q2 2026",
    "week": "Semana 20 — 13 al 19 de mayo 2026",
    "overall_health": "AT_RISK",
    "progress_pct": 52,
    "executive_summary": "El Q2 avanza al 52% del período con señales mixtas: los objetivos tecnológicos marchan bien (scoring v2 al 84% de AUC, migración cloud al 38%), mientras que la mora y la adopción digital siguen presionando. Tres KRs en AT_RISK requieren decisión ejecutiva esta semana.",
    "wins": [
      "Scoring v2 alcanzó AUC 84% — en ruta para superar la meta de 90% al cierre",
      "Tiempo de atención en sucursal bajó a 14 minutos — en ruta hacia 10 min",
      "Pipeline ML #1 en producción — primer activo de IA en operación",
      "Migración cloud al 38% — ritmo sostenido hacia el objetivo de 60%"
    ],
    "risks": [
      "Mora PyME en 7.4% — meta es 6.0%. Sin scoring v2 completo, el ritmo no alcanza",
      "App móvil: solo 9,500 descargas vs meta 15,000 — app v3 debe salir antes del 15 jun",
      "Adopción digital plana en 38% — el NPS de canales no mejora sin la nueva app",
      "Pedro Ramírez reporta cuello de botella en buró de crédito para gestión de expedientes"
    ],
    "decisions_needed": [
      "Autorizar adelanto de lanzamiento de app v3 al 10 de junio (Comité Digital)",
      "Revisar meta de scoring automático 85% — integración con core bancario tiene bloqueador técnico",
      "Asignar presupuesto adicional para campaña de captación zona norte (Ana Torres)"
    ],
    "krs_spotlight": [
      {"kr": "Mora total de cartera", "status": "AT_RISK", "current": "5.2%", "target": "4.5%", "owner": "María González"},
      {"kr": "Scoring automático", "status": "AT_RISK", "current": "58%", "target": "85%", "owner": "Carlos Mendoza"},
      {"kr": "Descargas app móvil", "status": "BEHIND", "current": "9,500", "target": "15,000", "owner": "Equipo Comercial"},
      {"kr": "Dashboards operativos", "status": "ON_TRACK", "current": "5", "target": "8", "owner": "Carlos Mendoza"}
    ],
    "generated_at": "2026-05-19T07:00:00.000Z"
  }'::jsonb,
  '63d97824-0990-48c1-ae56-e606c703ece4'
) ON CONFLICT (id) DO NOTHING;

-- --- A9. Delivery Programs (/delivery) ---
-- Programa 1: Plataforma Digital de Recuperación de Cartera (Finanzas / Pedro)
-- Programa 2: App Móvil Socios v3 — Canal Digital (Comercial / Carlos + Ana)

INSERT INTO delivery_programs (id, organization_id, cycle_id, name, description, status, created_by) VALUES
  ('ba000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'Plataforma Digital de Recuperación de Cartera',
   'Digitalización del proceso de cobranza: scoring conductual, portales de auto-gestión y firma electrónica para reestructuras. Meta: reducir mora de 5.2% a 4.5% al cierre Q2.',
   'ACTIVE',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('ba000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '1b95fbef-9f8a-4247-8564-1577de49a5ee',
   'App Móvil Socios v3 — Canal Digital',
   'Nueva versión de la app con onboarding digital, apertura de productos y pagos NFC. Meta: 15,000 descargas y 25% de transacciones digitales al cierre Q2.',
   'ACTIVE',
   '63d97824-0990-48c1-ae56-e606c703ece4');

INSERT INTO delivery_phases (id, program_id, name, description, order_index, gate_criteria, target_start_date, target_end_date, status, owner_id) VALUES
  -- Programa 1 fases
  ('bb000001-0000-4000-a000-000000000001',
   'ba000001-0000-4000-a000-000000000001',
   'Diagnóstico y Arquitectura',
   'Levantamiento de procesos actuales, diseño de arquitectura de microservicios y definición de APIs con el core bancario.',
   1,
   'Arquitectura aprobada por TI y Riesgos. APIs documentadas. Plan de migración firmado.',
   '2026-01-15', '2026-02-28', 'COMPLETED',
   'a1000004-0000-4000-a000-000000000001'),

  ('bb000002-0000-4000-a000-000000000001',
   'ba000001-0000-4000-a000-000000000001',
   'Desarrollo e Integración',
   'Desarrollo del scoring conductual, portal de auto-gestión y módulo de firma electrónica. Integración con buró de crédito.',
   2,
   'Scoring operando en staging. Portal con 3 flujos completos. Firma electrónica certificada.',
   '2026-03-01', '2026-05-15', 'IN_PROGRESS',
   'a1000004-0000-4000-a000-000000000001'),

  ('bb000003-0000-4000-a000-000000000001',
   'ba000001-0000-4000-a000-000000000001',
   'Lanzamiento y Adopción',
   'Piloto con 500 socios en mora temprana, capacitación a gestores y escalamiento al 100% de la cartera.',
   3,
   'Piloto con NPS > 60. Tasa de auto-gestión > 30%. Mora early reducida 0.5pp.',
   '2026-05-16', '2026-06-30', 'PENDING',
   'af000002-0000-4000-a000-000000000001'),

  -- Programa 2 fases
  ('bb000004-0000-4000-a000-000000000001',
   'ba000002-0000-4000-a000-000000000001',
   'Diseño UX y Prototipos',
   'Research con 40 socios, definición de flujos de onboarding digital, prototipado en Figma y pruebas de usabilidad.',
   1,
   'Prototipo aprobado por 80% de usuarios en test. Flujos de onboarding validados. Design system actualizado.',
   '2026-01-10', '2026-02-20', 'COMPLETED',
   'a1000003-0000-4000-a000-000000000001'),

  ('bb000005-0000-4000-a000-000000000001',
   'ba000002-0000-4000-a000-000000000001',
   'Desarrollo y QA',
   'Desarrollo de módulos de apertura de productos, pagos NFC, notificaciones push y panel de movimientos en tiempo real.',
   2,
   'App en beta con 200 socios piloto. Crash rate < 0.1%. Performance: carga inicial < 2s.',
   '2026-02-21', '2026-05-10', 'IN_PROGRESS',
   'a1000004-0000-4000-a000-000000000001'),

  ('bb000006-0000-4000-a000-000000000001',
   'ba000002-0000-4000-a000-000000000001',
   'Lanzamiento Público y Growth',
   'Publicación en App Store y Google Play, campaña de activación digital y programa de referidos para alcanzar 15,000 descargas.',
   3,
   '15,000 descargas. Rating > 4.2 estrellas. 25% de transacciones por canal digital.',
   '2026-05-11', '2026-06-30', 'PENDING',
   'af000003-0000-4000-a000-000000000001');

INSERT INTO deliverables (id, phase_id, organization_id, title, description, acceptance_criteria, owner_id, due_date, status, linked_objective_id, created_by) VALUES
  -- Fase 1: Diagnóstico y Arquitectura (COMPLETED)
  ('bc000001-0000-4000-a000-000000000001',
   'bb000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Mapa de proceso de cobranza AS-IS',
   'Documentación completa del proceso actual: flujos, tiempos, touchpoints y puntos de dolor identificados con los gestores.',
   'Documento aprobado por Gerencia de Cobranza. Incluye 5 flujos mapeados y matriz de tiempos.',
   'af000002-0000-4000-a000-000000000001',
   '2026-02-10', 'APPROVED',
   'b2000011-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000002-0000-4000-a000-000000000001',
   'bb000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Documento de arquitectura técnica',
   'Diseño de microservicios, diagrama de APIs con core bancario, modelo de datos y plan de seguridad.',
   'Firmado por CTO y Oficial de Seguridad. Sin observaciones pendientes de la auditoría interna.',
   'a1000004-0000-4000-a000-000000000001',
   '2026-02-25', 'APPROVED',
   'b2000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000003-0000-4000-a000-000000000001',
   'bb000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Plan de integración con buró de crédito',
   'Definición de endpoints, SLAs de respuesta, manejo de errores y plan de contingencia para consultas fallidas.',
   'Acuerdo firmado con bureau. Ambiente sandbox disponible. Tiempos de respuesta < 3s documentados.',
   'a1000004-0000-4000-a000-000000000001',
   '2026-02-28', 'APPROVED',
   'b2000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  -- Fase 2: Desarrollo e Integración (IN_PROGRESS)
  ('bc000004-0000-4000-a000-000000000001',
   'bb000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Motor de scoring conductual v1',
   'Modelo ML que combina historial de pagos, comportamiento de uso y señales externas para predecir probabilidad de pago a 30/60/90 días.',
   'Precisión > 78% en dataset de validación. Integrado en staging. Documentación de features lista.',
   'a1000004-0000-4000-a000-000000000001',
   '2026-04-30', 'IN_REVIEW',
   'b2000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000005-0000-4000-a000-000000000001',
   'bb000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Portal de auto-gestión para socios en mora',
   'Plataforma web donde el socio ve su saldo, simula planes de pago y acepta propuestas de reestructura con firma electrónica.',
   '3 flujos completos (consulta, simulación, aceptación). Accesible en móvil. WCAG AA.',
   'af000002-0000-4000-a000-000000000001',
   '2026-05-10', 'IN_PROGRESS',
   'b2000011-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000006-0000-4000-a000-000000000001',
   'bb000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Módulo de firma electrónica certificada',
   'Integración con proveedor de firma electrónica avanzada (NOM-151). Flujo de reestructura con validez legal.',
   'Certificación NOM-151 obtenida. 10 reestructuras piloto firmadas exitosamente. Sin observaciones legales.',
   'a1000004-0000-4000-a000-000000000001',
   '2026-05-15', 'BLOCKED',
   'b2000003-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000007-0000-4000-a000-000000000001',
   'bb000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Dashboard de gestores de cobranza',
   'Panel en tiempo real: cartera asignada, alertas de mora temprana, cola de contacto priorizada por scoring y registro de gestiones.',
   'Tiempo de carga < 2s. 100% de alertas AT_RISK visibles. Exportación a Excel funcional.',
   'af000002-0000-4000-a000-000000000001',
   '2026-05-15', 'IN_PROGRESS',
   'b2000011-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  -- Programa 2 — Fase 4: Diseño UX (COMPLETED)
  ('bc000008-0000-4000-a000-000000000001',
   'bb000004-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Research de usuario (40 socios)',
   'Entrevistas, pruebas de concepto y análisis de uso actual de la app v2. Identificación de top-5 fricciones.',
   'Reporte de hallazgos entregado. 40 participantes completaron el estudio. Pain points priorizados.',
   'a1000003-0000-4000-a000-000000000001',
   '2026-01-31', 'APPROVED',
   'b2000005-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000009-0000-4000-a000-000000000001',
   'bb000004-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Prototipo de alta fidelidad (Figma)',
   'Diseño completo de onboarding, apertura de productos, pagos NFC y área de movimientos. Sistema de diseño actualizado.',
   'NPS de prototipo > 60. Design system publicado. Specs de desarrollo entregadas a TI.',
   'a1000003-0000-4000-a000-000000000001',
   '2026-02-15', 'APPROVED',
   'b2000005-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000010-0000-4000-a000-000000000001',
   'bb000004-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Plan de pruebas de usabilidad',
   'Protocolo de test con 15 socios sobre el prototipo. Resultados incorporados en el diseño final.',
   '3 iteraciones completadas. Tasa de completación de tareas > 85%.',
   'a1000003-0000-4000-a000-000000000001',
   '2026-02-20', 'APPROVED',
   'b2000005-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  -- Programa 2 — Fase 5: Desarrollo y QA (IN_PROGRESS)
  ('bc000011-0000-4000-a000-000000000001',
   'bb000005-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Módulo de apertura de productos digitales',
   'Flujo completo para apertura de cuenta de ahorro, crédito personal y póliza de seguro desde la app, con validación biométrica.',
   'NOM-151 integrada. KYC automatizado aprobado por Compliance. Pruebas con 50 socios piloto.',
   'a1000004-0000-4000-a000-000000000001',
   '2026-04-20', 'IN_REVIEW',
   'b2000005-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000012-0000-4000-a000-000000000001',
   'bb000005-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Sistema de pagos NFC y QR',
   'Pagos sin contacto en puntos de atención propios y red de comercios afiliados. Integración con switch de pagos CNBV.',
   'Certificación de switch. 10 comercios piloto operando. Tiempo de transacción < 4s.',
   'a1000004-0000-4000-a000-000000000001',
   '2026-05-05', 'IN_PROGRESS',
   'b2000005-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000013-0000-4000-a000-000000000001',
   'bb000005-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Notificaciones push y alertas de cuenta',
   'Sistema de notificaciones: cargo/abono en tiempo real, alertas de mora, promociones segmentadas y recordatorios de pago.',
   'Entrega < 2s. Opt-in > 70% en beta. 0 falsos positivos en alertas de mora.',
   'af000003-0000-4000-a000-000000000001',
   '2026-05-10', 'IN_PROGRESS',
   'b2000012-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4'),

  ('bc000014-0000-4000-a000-000000000001',
   'bb000005-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Panel de movimientos en tiempo real',
   'Pantalla de actividad con filtros, búsqueda y exportación de estados de cuenta en PDF.',
   'Latencia < 500ms. Exportación PDF en < 3s. Accesible WCAG AA.',
   'af000003-0000-4000-a000-000000000001',
   '2026-05-10', 'NOT_STARTED',
   'b2000012-0000-4000-a000-000000000001',
   '63d97824-0990-48c1-ae56-e606c703ece4');

-- --- A10. Sector Assessment Sessions (/sector-assessment) ---
-- Sesión 1: Diagnóstico Estratégico Q1 2026 (COMPLETED — baseline)
-- Sesión 2: Seguimiento Estratégico Q2 2026 (OPEN — mejora visible vs Q1)

INSERT INTO sector_assessment_sessions (id, organization_id, name, period_label, status, calibrated_scores, ai_plan, created_by, session_documents) VALUES
  ('bd000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Diagnóstico Estratégico Q1 2026',
   'Q1 2026',
   'COMPLETED',
   '{
     "STRATEGIC_EXECUTION": 5.5,
     "GOVERNANCE_MATURITY": 6.0,
     "MARGIN_DEPENDENCY": 4.5,
     "DIGITAL_CAPABILITY": 3.5,
     "LEADERSHIP_TALENT": 5.0,
     "BUSINESS_MODEL": 4.0,
     "REGULATORY_PRESSURE": 6.5,
     "MEMBER_DIGITAL_DISCONNECT": 3.0
   }'::jsonb,
   '{
     "priority_areas": ["DIGITAL_CAPABILITY", "MEMBER_DIGITAL_DISCONNECT", "BUSINESS_MODEL"],
     "90_day_actions": [
       "Lanzar plataforma de recuperación de cartera digital",
       "Iniciar desarrollo de App Móvil v3",
       "Contratar Director de Transformación Digital"
     ],
     "strategic_bets": [
       "Digitalizar el 60% del proceso de cobranza antes de Q3",
       "Alcanzar 15,000 usuarios activos en app para fin de año"
     ]
   }'::jsonb,
   '63d97824-0990-48c1-ae56-e606c703ece4',
   '[
     {"name": "Plan Estratégico 2026.pdf", "uploaded_at": "2026-01-15T10:00:00Z"},
     {"name": "Benchmarks cooperativas financieras 2025.xlsx", "uploaded_at": "2026-01-15T10:05:00Z"}
   ]'::jsonb),

  ('bd000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   'Seguimiento Estratégico Q2 2026',
   'Q2 2026',
   'OPEN',
   '{
     "STRATEGIC_EXECUTION": 6.2,
     "GOVERNANCE_MATURITY": 6.5,
     "MARGIN_DEPENDENCY": 5.0,
     "DIGITAL_CAPABILITY": 5.5,
     "LEADERSHIP_TALENT": 5.5,
     "BUSINESS_MODEL": 5.0,
     "REGULATORY_PRESSURE": 6.5,
     "MEMBER_DIGITAL_DISCONNECT": 4.5
   }'::jsonb,
   '{
     "priority_areas": ["MARGIN_DEPENDENCY", "REGULATORY_PRESSURE", "STRATEGIC_EXECUTION"],
     "90_day_actions": [
       "Completar piloto de recuperación digital (500 socios)",
       "Publicar App Móvil v3 en tiendas",
       "Activar scoring automático en 85% de solicitudes de crédito"
     ],
     "strategic_bets": [
       "Cerrar Q2 con mora total en 4.5%",
       "Superar 10,000 descargas de la app para julio"
     ]
   }'::jsonb,
   '63d97824-0990-48c1-ae56-e606c703ece4',
   '[
     {"name": "Avance OKRs Q2 semana 20.pdf", "uploaded_at": "2026-05-19T09:00:00Z"}
   ]'::jsonb);

INSERT INTO sector_assessments (id, organization_id, created_by, title, engagement_type, status, notes, ai_analysis, session_id) VALUES
  ('be000001-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'Diagnóstico Estratégico — Caja Morelia Q1 2026',
   'DIAGNOSTIC',
   'COMPLETED',
   'Diagnóstico inicial del ciclo 2026. Prioridades identificadas: capacidad digital crítica (3.5/10) y desconexión socio-canal (3.0/10). Aprobado por Consejo de Administración en sesión del 20 de enero.',
   '{
     "executive_summary": "Caja Morelia muestra fortaleza en Gobernanza (6.0) y Presión Regulatoria (6.5), pero presenta brechas críticas en Capacidad Digital (3.5) y Desconexión Socio-Digital (3.0). El Modelo de Negocio (4.0) y la Dependencia de Margen (4.5) requieren atención estratégica en el mediano plazo.",
     "key_risks": [
       "Riesgo de pérdida de socios jóvenes ante ofertas 100% digitales de fintech",
       "Margen financiero vulnerable ante cambios en tasa de referencia TIIE",
       "Capacidad tecnológica insuficiente para competir en adquisición digital"
     ],
     "opportunities": [
       "Base de 45,000 socios con alta lealtad institucional — potencial para cross-sell digital",
       "Regulación favorable para cooperativas en crédito PyME",
       "Talento directivo con disposición al cambio identificada en Assessment 360"
     ],
     "recommended_priorities": ["DIGITAL_CAPABILITY", "MEMBER_DIGITAL_DISCONNECT", "BUSINESS_MODEL"],
     "confidence": 0.87
   }'::jsonb,
   'bd000001-0000-4000-a000-000000000001'),

  ('be000002-0000-4000-a000-000000000001',
   'a682b4f2-c4ba-4beb-af0a-caa8005f3de7',
   '63d97824-0990-48c1-ae56-e606c703ece4',
   'Seguimiento Estratégico — Caja Morelia Q2 2026',
   'FOLLOWUP',
   'IN_PROGRESS',
   'Seguimiento a 4 meses del diagnóstico inicial. Se observa avance significativo en Capacidad Digital (+2.0pp) y Desconexión Socio-Digital (+1.5pp). Mora sigue siendo el indicador más crítico.',
   '{
     "executive_summary": "Caja Morelia muestra progreso relevante en Capacidad Digital (3.5→5.5) y Desconexión Socio-Digital (3.0→4.5), validando la apuesta por la transformación digital. La Dependencia de Margen mejora moderadamente (4.5→5.0). El área de mayor preocupación sigue siendo el ritmo de cierre de la mora total.",
     "progress_highlights": [
       "Capacidad Digital: +57% de mejora en 4 meses (3.5 → 5.5)",
       "Scoring automático en staging — pendiente integración con core bancario",
       "App Móvil v3 en beta con 200 socios: NPS 68"
     ],
     "active_risks": [
       "Integración del módulo de firma electrónica bloqueada — impacta fecha de lanzamiento del portal",
       "Mora total al 5.2% — ritmo de recuperación insuficiente para cerrar en 4.5%",
       "Rotación en equipo de gestores de cobranza (3 salidas en Q2)"
     ],
     "recommended_actions": ["MARGIN_DEPENDENCY", "REGULATORY_PRESSURE", "STRATEGIC_EXECUTION"],
     "confidence": 0.82
   }'::jsonb,
   'bd000002-0000-4000-a000-000000000001');

INSERT INTO threat_scores (id, assessment_id, threat_key, overall_score, benchmark, evidence, ai_insights) VALUES
  -- Assessment Q1 2026 (baseline — scores bajos, oportunidades claras)
  ('bf000001-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'STRATEGIC_EXECUTION', 5.5, 'AT',
   'OKR Q1 cerrado con 68% de progreso promedio. 3 de 5 objetivos ON_TRACK al inicio del ciclo.',
   'Ejecución estratégica estable pero sin mecanismos de corrección temprana. Recomendación: implementar revisiones quincenales de OKRs con escalación automática de riesgos.'),

  ('bf000002-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'GOVERNANCE_MATURITY', 6.0, 'AT',
   'Consejo de Administración activo con sesiones mensuales. Comité de Riesgos operando con reportes trimestrales.',
   'Gobernanza formal consolidada. Oportunidad de incorporar tablero digital en tiempo real para el Consejo, reduciendo latencia en toma de decisiones de 30 a 7 días.'),

  ('bf000003-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'MARGIN_DEPENDENCY', 4.5, 'BELOW',
   'Margen financiero neto: 4.8%. Concentración en crédito de nómina (72% de cartera). Sensibilidad TIIE: -1pp TIIE = -0.6pp margen.',
   'Dependencia crítica de un solo producto. Diversificación urgente hacia crédito PyME y seguros. El scoring automático en desarrollo es el habilitador clave para escalar PyME sin riesgo adicional.'),

  ('bf000004-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'DIGITAL_CAPABILITY', 3.5, 'BELOW',
   'Core bancario con 12 años de antigüedad. App actual con rating 3.1 en tiendas. 0 APIs abiertas. Sin equipo de data science propio.',
   'Brecha digital crítica. Competidores fintech ofrecen onboarding en 8 minutos vs 45 minutos en sucursal. Prioridad máxima: App v3 y scoring conductual como base para competir en el segmento 25-45 años.'),

  ('bf000005-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'LEADERSHIP_TALENT', 5.0, 'AT',
   'Dirección estable con promedio 7 años en la institución. Sin Director de Transformación Digital. 2 posiciones técnicas senior vacantes.',
   'Talento directivo comprometido con la transformación pero con brecha en capacidades digitales. Contratar Head of Digital es la acción de mayor impacto en los próximos 60 días.'),

  ('bf000006-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'BUSINESS_MODEL', 4.0, 'BELOW',
   'Ingresos por servicios: 12% del total. Comisiones cayeron 8% vs 2024. 45,000 socios activos, retención 91%.',
   'Modelo de ingresos excesivamente dependiente del spread de crédito. Potencial en seguros, pagos y servicios de nómina aún no explotado. La app v3 es el canal habilitador para monetizar la base de socios.'),

  ('bf000007-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'REGULATORY_PRESSURE', 6.5, 'ABOVE',
   'CNBV con 4 observaciones activas. Actualización NOM-151 implementada. Informe SOFOM en trámite. Sin sanciones en los últimos 3 años.',
   'Exposición regulatoria moderada-alta pero bajo control. La integración del módulo de firma electrónica NOM-151 en el portal de cobranza cierra la principal observación pendiente.'),

  ('bf000008-0000-4000-a000-000000000001', 'be000001-0000-4000-a000-000000000001',
   'MEMBER_DIGITAL_DISCONNECT', 3.0, 'BELOW',
   'App actual: 9,500 descargas, rating 3.1. Transacciones digitales: 8% del total. Sucursal procesa 85% de operaciones. Socios 18-35: solo 22% usa canal digital.',
   'Desconexión crítica con el segmento joven. En 3 años, si no se digitaliza el canal, se perderá el 30% de los socios menores de 40 años. La app v3 con onboarding en < 5 minutos es la respuesta correcta.'),

  -- Assessment Q2 2026 (seguimiento — mejora visible en digital, mora sigue crítica)
  ('bf000009-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'STRATEGIC_EXECUTION', 6.2, 'AT',
   'OKR Q2 semana 20: 62% de progreso promedio. 2 KRs en AT_RISK (mora y scoring). Revisiones quincenales implementadas.',
   'Mejora en ejecución: las revisiones quincenales detectaron el retraso en scoring 3 semanas antes que en Q1. El mecanismo de escalación funciona. Oportunidad: automatizar alertas cuando KR cae debajo del 70% del ritmo esperado.'),

  ('bf000010-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'GOVERNANCE_MATURITY', 6.5, 'AT',
   'Dashboard OKR accesible en tiempo real para el Consejo desde marzo. Comité de Riesgos con alertas automáticas.',
   'Gobernanza con visibilidad en tiempo real consolidada. El Consejo recibe alertas de KRs AT_RISK el mismo día — latencia de 30 días eliminada. Siguiente paso: incorporar benchmarks del sector en el tablero.'),

  ('bf000011-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'MARGIN_DEPENDENCY', 5.0, 'AT',
   'Crédito PyME creció de 8% a 12% de la cartera. Margen financiero neto estable en 4.9%. Seguros: +15% vs Q1.',
   'Diversificación en marcha. El scoring PyME (en desarrollo) acelerará el crecimiento seguro de este segmento. Riesgo: si la mora total no baja a 4.5%, el costo de riesgo absorberá la mejora de margen.'),

  ('bf000012-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'DIGITAL_CAPABILITY', 5.5, 'AT',
   'App v3 en beta con 200 socios: NPS 68, rating proyectado 4.3. Scoring conductual en staging con 78% de precisión. APIs internas documentadas.',
   'Progreso digital acelerado (+57% en 4 meses). El bloqueador crítico es la integración del módulo de firma electrónica — retrasa el lanzamiento del portal de cobranza 3 semanas. Prioridad inmediata: desbloquear con proveedor NOM-151.'),

  ('bf000013-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'LEADERSHIP_TALENT', 5.5, 'AT',
   'Head of Digital contratado (inicio junio). 1 posición técnica senior cubierta de 2. 3 salidas en equipo de cobranza.',
   'La contratación del Head of Digital despeja el mayor riesgo de liderazgo. Atención inmediata: retención en equipo de cobranza — 3 salidas impactan directamente el KR de mora.'),

  ('bf000014-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'BUSINESS_MODEL', 5.0, 'AT',
   'Ingresos por servicios subieron de 12% a 15% del total. Nuevos 180 socios por referidos digitales. Pólizas de seguro: +22% vs Q1.',
   'El modelo de ingresos se diversifica lentamente. La app v3 con apertura de productos digitales es el catalizador para acelerar cross-sell. Proyección: servicios al 20% del ingreso total para fin de año si el lanzamiento es en junio.'),

  ('bf000015-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'REGULATORY_PRESSURE', 6.5, 'ABOVE',
   'La observación de NOM-151 sigue abierta (bloqueo técnico en firma electrónica). Las otras 3 observaciones CNBV fueron atendidas.',
   'El módulo de firma electrónica bloqueado es ahora también un riesgo regulatorio activo. Resolver antes del 30 de junio o solicitar prórroga formal a la CNBV para evitar sanción.'),

  ('bf000016-0000-4000-a000-000000000001', 'be000002-0000-4000-a000-000000000001',
   'MEMBER_DIGITAL_DISCONNECT', 4.5, 'AT',
   'App beta: 200 socios activos. Transacciones digitales: 14% (vs 8% en Q1). Socios 18-35 en canal digital: 31% (vs 22% en Q1).',
   'Mejora significativa (+50% en adopción digital joven). Con el lanzamiento público de la app v3, proyectamos llegar al 40% de socios jóvenes en canal digital para Q3. El ritmo de captación de 9,500 descargas actuales necesita acelerarse 58% para llegar a 15,000.');

-- =============================================================================
-- 22. STATUS CORRECTIONS
-- El trigger trg_checkin_cascade_recalc recalcula status al insertar check-ins.
-- Para el demo necesitamos AT_RISK visible. Lo forzamos aquí (después de todos
-- los check-ins) — el trigger ya no volverá a dispararse hasta el próximo check-in.
-- =============================================================================
UPDATE key_results SET status = 'AT_RISK' WHERE id IN (
  -- Q2: mora total (5.2% vs meta 4.5%) — pace insuficiente para llegar
  'c2000002-0000-4000-a000-000000000001',
  -- Q2: madurez analítica (4.5/7) — cultura tarda más de lo esperado
  'c2000009-0000-4000-a000-000000000001',
  -- Q2: mora PyME (7.4% vs meta 6.0%) — sigue sobre el umbral regulatorio
  'c2000010-0000-4000-a000-000000000001',
  -- Q2: scoring automático (58% vs meta 85%) — integración con core bancario bloqueada
  'c2000015-0000-4000-a000-000000000001',
  -- Q2: tiempo de otorgamiento (3.5 días vs meta 2 días) — buró es el bloqueador
  'c2000016-0000-4000-a000-000000000001'
);

-- Q1 KRs históricos que no llegaron a meta (ciclo CLOSED — no hay nuevo trigger)
UPDATE key_results SET status = 'AT_RISK'  WHERE id = 'c1000003-0000-4000-a000-000000000001';
UPDATE key_results SET status = 'BEHIND'   WHERE id = 'c1000004-0000-4000-a000-000000000001';
UPDATE key_results SET status = 'BEHIND'   WHERE id = 'c1000005-0000-4000-a000-000000000001';

-- KRs individuales (addendum A5): trigger recalcula al insertar check-ins, lo forzamos aquí
UPDATE key_results SET status = 'AT_RISK' WHERE id IN (
  'c2000022-0000-4000-a000-000000000001',  -- expedientes: 9 días vs meta 4 — ritmo insuficiente
  'c2000024-0000-4000-a000-000000000001'   -- socios: 47 vs meta 150 — captación por debajo del ritmo
);

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
DO $$
DECLARE
  v_users INT; v_users2 INT; v_areas INT; v_teams INT; v_objs INT; v_krs INT;
  v_ci INT; v_ini INT; v_mil INT; v_spr INT; v_bk INT;
  v_agr INT; v_gb INT; v_si INT; v_op INT; v_br INT;
  v_prg INT; v_prc INT; v_dlv INT; v_dph INT; v_del INT;
  v_sas INT; v_sa INT; v_thr INT;
BEGIN
  SELECT COUNT(*) INTO v_users  FROM users    WHERE id::text LIKE 'a1000%';
  SELECT COUNT(*) INTO v_users2 FROM users    WHERE id::text LIKE 'af000%';
  SELECT COUNT(*) INTO v_areas  FROM areas    WHERE id::text LIKE 'a2000%';
  SELECT COUNT(*) INTO v_teams  FROM teams    WHERE id::text LIKE 'a3000%';
  SELECT COUNT(*) INTO v_objs   FROM objectives WHERE id::text ~ '^[bc][12]000';
  SELECT COUNT(*) INTO v_krs    FROM key_results WHERE id::text ~ '^c[12]000';
  SELECT COUNT(*) INTO v_ci     FROM check_ins WHERE kr_id::text ~ '^c[12]000';
  SELECT COUNT(*) INTO v_ini    FROM initiatives WHERE id::text LIKE 'a4000%';
  SELECT COUNT(*) INTO v_mil    FROM milestones  WHERE id::text LIKE 'a5000%';
  SELECT COUNT(*) INTO v_spr    FROM sprint_cycles WHERE id::text LIKE 'a6000%';
  SELECT COUNT(*) INTO v_bk     FROM backlog_items WHERE id::text LIKE 'a7000%';
  SELECT COUNT(*) INTO v_agr    FROM agreements WHERE id::text LIKE 'a8000%';
  SELECT COUNT(*) INTO v_gb     FROM governance_bodies WHERE id::text LIKE 'a9000%';
  SELECT COUNT(*) INTO v_si     FROM strategic_intents WHERE id::text LIKE 'ac000%';
  SELECT COUNT(*) INTO v_op     FROM organizational_problems WHERE id::text LIKE 'ad000%';
  SELECT COUNT(*) INTO v_br     FROM ai_briefings WHERE id::text LIKE 'ae000%';
  SELECT COUNT(*) INTO v_prg    FROM transformation_programs WHERE id::text LIKE 'b3000%';
  SELECT COUNT(*) INTO v_prc    FROM program_cycles WHERE id::text LIKE 'b4000%';
  SELECT COUNT(*) INTO v_dlv    FROM delivery_programs WHERE id::text LIKE 'ba000%';
  SELECT COUNT(*) INTO v_dph    FROM delivery_phases WHERE id::text LIKE 'bb000%';
  SELECT COUNT(*) INTO v_del    FROM deliverables WHERE id::text LIKE 'bc000%';
  SELECT COUNT(*) INTO v_sas    FROM sector_assessment_sessions WHERE id::text LIKE 'bd000%';
  SELECT COUNT(*) INTO v_sa     FROM sector_assessments WHERE id::text LIKE 'be000%';
  SELECT COUNT(*) INTO v_thr    FROM threat_scores WHERE id::text LIKE 'bf000%';
  RAISE NOTICE '=== SEED DEMO COMPLETADO ===';
  RAISE NOTICE 'Usuarios base: % | Usuarios perfil: % | Áreas: % | Equipos: %', v_users, v_users2, v_areas, v_teams;
  RAISE NOTICE 'Objetivos: % | KRs: % | Check-ins: %',     v_objs,  v_krs,   v_ci;
  RAISE NOTICE 'Iniciativas: % | Hitos: % | Sprint: %',     v_ini,   v_mil,   v_spr;
  RAISE NOTICE 'Backlog: % | Acuerdos: % | Cuerpos gov: %', v_bk,    v_agr,   v_gb;
  RAISE NOTICE 'Int. estrat: % | Problemas: % | Briefings: %', v_si, v_op, v_br;
  RAISE NOTICE 'Programas transform.: % | Ciclos de programa: %', v_prg, v_prc;
  RAISE NOTICE 'Delivery: prog=% | fases=% | entregables=%', v_dlv, v_dph, v_del;
  RAISE NOTICE 'Sector assessment: sesiones=% | assessments=% | amenazas=%', v_sas, v_sa, v_thr;
  -- Validaciones mínimas
  IF v_users  <> 4 THEN RAISE EXCEPTION 'ERROR: se esperaban 4 usuarios base, hay %', v_users; END IF;
  IF v_users2 <> 3 THEN RAISE EXCEPTION 'ERROR: se esperaban 3 usuarios perfil, hay %', v_users2; END IF;
  IF v_objs   < 15 THEN RAISE EXCEPTION 'ERROR: se esperaban >=15 objetivos, hay %', v_objs; END IF;
  IF v_krs    < 29 THEN RAISE EXCEPTION 'ERROR: se esperaban >=29 KRs, hay %', v_krs; END IF;
  IF v_prg    <> 2 THEN RAISE EXCEPTION 'ERROR: se esperaban 2 programas de transformación, hay %', v_prg; END IF;
  IF v_prc    <> 4 THEN RAISE EXCEPTION 'ERROR: se esperaban 4 ciclos de programa, hay %', v_prc; END IF;
  IF v_dlv    <> 2 THEN RAISE EXCEPTION 'ERROR: se esperaban 2 delivery programs, hay %', v_dlv; END IF;
  IF v_dph    <> 6 THEN RAISE EXCEPTION 'ERROR: se esperaban 6 delivery phases, hay %', v_dph; END IF;
  IF v_del    <> 14 THEN RAISE EXCEPTION 'ERROR: se esperaban 14 deliverables, hay %', v_del; END IF;
  IF v_sas    <> 2 THEN RAISE EXCEPTION 'ERROR: se esperaban 2 sector assessment sessions, hay %', v_sas; END IF;
  IF v_sa     <> 2 THEN RAISE EXCEPTION 'ERROR: se esperaban 2 sector assessments, hay %', v_sa; END IF;
  IF v_thr    <> 16 THEN RAISE EXCEPTION 'ERROR: se esperaban 16 threat scores, hay %', v_thr; END IF;
END $$;

COMMIT;
