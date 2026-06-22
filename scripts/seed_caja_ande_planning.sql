-- Seed RTN Q2 2026 para Caja de ANDE
-- org_id: 7e9fda53-426d-4e8e-b878-4e1b28eb4d38
-- cycle Q2 2026: 9a9ce59d-... (se consulta abajo)

DO $$
DECLARE
  v_org_id  UUID := '7e9fda53-426d-4e8e-b878-4e1b28eb4d38';
  v_cycle   UUID;
  v_sess    UUID;
BEGIN

-- Obtener el ciclo Q2 2026 activo
SELECT id INTO v_cycle
FROM cycles
WHERE organization_id = v_org_id
  AND type = 'QUARTERLY'
  AND name ILIKE '%Q2%2026%'
LIMIT 1;

IF v_cycle IS NULL THEN
  RAISE NOTICE 'Ciclo Q2 2026 no encontrado, usando NULL';
END IF;

-- Crear sesión RTN
INSERT INTO planning_sessions (id, organization_id, cycle_id, name, description, type, status, current_stage, started_at)
VALUES (
  gen_random_uuid(), v_org_id, v_cycle,
  'RTN Q2 2026',
  'Revisión Trimestral del Negocio para el ciclo Q2 2026. Foco en avance Brasilia, cumplimiento SGF y NPS.',
  'QUARTERLY', 'IN_PROGRESS', 8,
  '2026-03-03 08:00:00+00'
)
RETURNING id INTO v_sess;

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 1 — Cierre del CT Anterior (DONE)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 1, 'Retrospectiva Q1 2026', 'Análisis de logros vs. metas del CT anterior. OKRs completados: 3/4 objetivos, 61% promedio KRs.', 'Gerencia General', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 1, 'Reporte de métricas Q1', 'Dashboard final: Suficiencia patrimonial 14.8%, Morosidad 2.1%, NPS +38.', 'Gerencia Finanzas', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 1, 'Lecciones aprendidas', 'Integración Brasilia con retrasos de 3 semanas. SGF requirió más coordinación de la prevista.', 'Gerencia TI', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 1, 'Accionables identificados', 'Dedicar 2 personas adicionales a Brasilia Q2. Crear task force SGF cross-área.', 'Comité Directivo', 'DONE', 'ACTION'),
  (v_sess, v_org_id, 1, 'Matriz de impedimentos Q1', 'Impedimentos resueltos: presupuesto Brasilia, recursos TI. Pendiente: integración sistemas legados.', 'PMO', 'DONE', 'ARTIFACT');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 2 — Foco Estratégico (DONE)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 2, 'Revisión OKRs Anuales 2026', 'OKRs anuales validados con progreso Q1. Brasilia y cumplimiento SGF en foco crítico.', 'Gerencia Estrategia', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 2, 'Matriz impacto/esfuerzo Q2', 'Priorización: Alta prioridad → módulos Brasilia + hallazgos SGF. Media → nuevos productos. Baja → canales digitales.', 'Comité Directivo', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 2, 'OKRs Q2 priorizados', 'OT-Q2-TI: 4 módulos Brasilia. OT-Q2-FIN: 80% hallazgos SGF. OT-Q2-NEG: Seguro Educador piloto. OT-Q2-EXP: NPS +45.', 'Directivos de Área', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 2, 'Asignación de dueños Q2', 'TI → Gerente TI, Finanzas → CFO, Negocios → Gerente Comercial, Experiencia → Gerente Canales.', 'Gerencia General', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 2, 'Análisis de capacidad preliminar', 'TI: 8 personas disponibles (70% Brasilia). Finanzas: 4 personas (100% SGF Q2). Negocios: 5 personas.', 'RRHH + Gerencias', 'DONE', 'ACTION');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 3 — Reunión Ejecutiva (DONE)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 3, 'Cronograma Q2 presentado', 'Apr-Jun 2026: Hitos mensuales por área definidos. Entrega Brasilia módulo 3 en Mayo.', 'Presidencia', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 3, 'Compromisos VP documentados', 'VP TI: módulos 3 y 4 Brasilia en Mayo/Junio. VP Finanzas: task force SGF semana 1 Abril.', 'Comité Ejecutivo', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 3, 'Resumen del flujo Q2', 'Presentación ejecutiva 2 páginas distribuida al Consejo el 14-Mar-2026.', 'Presidencia', 'DONE', 'ARTIFACT');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 4 — Reunión Operativa (DONE)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 4, 'Trazabilidad OKR → Épica → Historia', 'OT-Q2-TI mapeado a 6 épicas Brasilia con 42 historias. OT-Q2-FIN mapeado a 3 épicas SGF.', 'POs TI + Finanzas', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 4, 'Configuración herramienta Q2', 'Ciclo Q2 activo en sistema. KRs configurados con owners y medición quincenal.', 'Gerencia TI', 'DONE', 'ACTION'),
  (v_sess, v_org_id, 4, 'Backlog Q2 refinado', 'Top 60 historias refinadas con criterios de aceptación. Sprint 1 listo.', 'POs + Scrum Masters', 'DONE', 'ARTIFACT');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 5 — Redacción de Objetivos (DONE)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 5, 'OKR TI redactado (Brasilia)', '"Implementar 4 módulos Brasilia para Go-Live comercial en Q3". KR: 4 módulos integrados, 0 errores críticos, capacitación 100% usuarios.', 'Gerente TI', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 5, 'OKR Finanzas redactado (SGF)', '"Cerrar el 80% de hallazgos regulatorios SGF en Q2". KR: 80% hallazgos resueltos, plan de los restantes 20% documentado.', 'CFO', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 5, 'OKR Negocios redactado (Nuevos Productos)', '"Lanzar piloto Seguro Educador con 200 socios". KR: 200 socios piloto, NPS producto >40, análisis de viabilidad entregado.', 'Gerente Comercial', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 5, 'OKR Experiencia redactado (NPS)', '"Elevar NPS global a +45 antes de cierre Q2". KR: NPS ≥45, tiempo respuesta reclamos <24h, encuesta trimestral ≥85% satisfacción.', 'Gerente Canales', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 5, 'Plan de medición Q2', 'Check-ins quincenales los viernes. Semáforo automático en sistema. Alerta ejecutiva si KR cae <50% confianza.', 'PMO', 'DONE', 'ACTION');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 6 — Interdependencias
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 6, 'Mapa de dependencias consolidado', 'Documento con todas las dependencias inter-área Q2. 3 críticas identificadas.', 'PMO', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 6, 'Acuerdos de interdependencia firmados', 'TI ↔ Negocios: API de integración Brasilia disponible para Mayo. Compliance ↔ Todas: formularios SGF actualizados Semana 1.', 'Directivos', 'IN_PROGRESS', 'ACTION'),
  (v_sess, v_org_id, 6, 'Plan de escalación de dependencias', 'Protocolo: si dependencia no resuelta en 5 días hábiles, escala a Comité Ejecutivo automáticamente.', 'Presidencia', 'TODO', 'ACTION');

INSERT INTO planning_dependencies (session_id, organization_id, from_area, to_area, description, status, owner)
VALUES
  (v_sess, v_org_id, 'TI', 'Negocios', 'API de integración Brasilia necesaria para lanzamiento del piloto Seguro Educador en Mayo', 'OPEN', 'Gerente TI'),
  (v_sess, v_org_id, 'Compliance / Finanzas', 'Todas las áreas', 'Formularios SGF actualizados deben estar disponibles antes del 7-Abr para todos los procesos', 'RESOLVED', 'CFO'),
  (v_sess, v_org_id, 'Negocios', 'TI', 'Plataforma digital de socios necesaria para el piloto de nuevos productos (módulo CRM Brasilia)', 'OPEN', 'Gerente Comercial'),
  (v_sess, v_org_id, 'Experiencia / Canales', 'TI', 'Dashboard NPS en tiempo real necesario para monitoreo quincenal del KR', 'DEFERRED', 'Gerente Canales');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 7 — Capacidad (DONE)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 7, 'Tabla de capacidad Q2 aprobada', 'Capacidad validada por todos los líderes. Sin sobreasignación crítica. TI al 88% de carga.', 'RRHH', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 7, 'Cálculo de velocidad por equipo', 'TI: 42pts/sprint, Finanzas: 18pts/sprint, Negocios: 25pts/sprint. Buffer 20% para operaciones corrientes.', 'Scrum Masters', 'DONE', 'ARTIFACT'),
  (v_sess, v_org_id, 7, 'Plan de distribución temporal', 'Abril: SGF + Brasilia módulo 3. Mayo: Brasilia módulo 4 + piloto Seguro Educador. Junio: validación + NPS.', 'PMO', 'DONE', 'ACTION');

INSERT INTO planning_capacity (session_id, organization_id, area, objective_title, total_people, allocated, notes)
VALUES
  (v_sess, v_org_id, 'Tecnología de Información', 'Brasilia — 4 módulos Q2', 8, 7, 'Semana 1 dedicada al cierre de deuda técnica de Q1'),
  (v_sess, v_org_id, 'Finanzas / Compliance', 'Cierre hallazgos SGF 80%', 4, 4, '100% dedicación al task force SGF. Operaciones cubiertas por temporales.'),
  (v_sess, v_org_id, 'Negocios / Comercial', 'Piloto Seguro Educador', 5, 4, '1 persona en actividades regulatorias no aplazables.'),
  (v_sess, v_org_id, 'Experiencia y Canales', 'NPS +45', 3, 3, 'Canales digitales y presenciales incluidos.'),
  (v_sess, v_org_id, 'PMO / Estrategia', 'Coordinación RTN + reporting', 2, 2, 'Acompañamiento transversal a todas las áreas.');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 8 — Validación Final (CURRENT)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, status, item_type)
VALUES
  (v_sess, v_org_id, 8, 'Revisión final OKRs Q2', 'Validar que todos los KRs tienen owner, fecha, métrica clara y confianza inicial ≥70%.', 'Gerencia Estrategia', 'IN_PROGRESS', 'ACTION'),
  (v_sess, v_org_id, 8, 'Acta de aprobación RTN Q2', 'Documento formal de aprobación. Requiere firma del Presidente y 3 VPs.', 'Presidencia', 'IN_PROGRESS', 'ARTIFACT'),
  (v_sess, v_org_id, 8, 'Documento de referencia Q2 2026', 'Consolidado de OKRs, capacidad, dependencias y cronograma para distribución.', 'PMO', 'TODO', 'ARTIFACT'),
  (v_sess, v_org_id, 8, 'Firma del Comité Directivo', 'Sesión de firma programada para 25-Mar-2026.', 'Presidencia', 'TODO', 'ACTION'),
  (v_sess, v_org_id, 8, 'Check de riesgos pre-aprobación', 'Verificar que los 3 riesgos críticos (Brasilia, SGF, capacidad TI) tienen mitigación documentada.', 'PMO', 'BLOCKED', 'RISK');

-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPAS 9-11 — Pendientes (TODO)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO planning_items (session_id, organization_id, stage, title, description, assignee, due_date, status, item_type)
VALUES
  (v_sess, v_org_id, 9, 'Presentación oficial Q2 a toda la org', 'All-hands meeting. Objetivos, plan y cómo cada equipo contribuye.', 'Presidencia', '2026-03-28', 'TODO', 'ARTIFACT'),
  (v_sess, v_org_id, 9, 'Grabación y distribución', 'Video grabado y publicado en intranet. Deck compartido en SharePoint.', 'Comunicaciones', '2026-03-28', 'TODO', 'ACTION'),
  (v_sess, v_org_id, 9, 'RACI Q2 publicado', 'Matriz RACI de todos los OKRs distribuida a responsables.', 'PMO', '2026-03-25', 'TODO', 'ARTIFACT'),

  (v_sess, v_org_id, 10, 'Sprint 1 100% listo', 'Sprint 1 (Apr 1-14): todas las historias con criterios de aceptación, estimadas y priorizadas.', 'Scrum Masters', '2026-03-28', 'TODO', 'ARTIFACT'),
  (v_sess, v_org_id, 10, 'Sprint 2 en draft', 'Sprint 2 (Apr 15-28): top 25 historias identificadas con épica y objetivo padre.', 'POs', '2026-03-28', 'TODO', 'ARTIFACT'),
  (v_sess, v_org_id, 10, 'Coordinación BRP — sala y facilitación', 'Reserva de sala grande (50+ personas). Facilitador externo confirmado.', 'PMO', '2026-03-26', 'TODO', 'ACTION'),

  (v_sess, v_org_id, 11, 'Demo de capacidades Q2 a stakeholders', 'Demostración de lo que los equipos entregarán en Q2. Feedback documentado.', 'Gerentes de Área', '2026-03-31', 'TODO', 'ARTIFACT'),
  (v_sess, v_org_id, 11, 'Onboarding nuevos integrantes Q2', 'Brief de 1h para personas nuevas o rotadas: OKRs, herramienta, proceso.', 'RRHH + POs', '2026-04-02', 'TODO', 'ACTION'),
  (v_sess, v_org_id, 11, 'Feedback stakeholders documentado', 'Consolidar retroalimentación del Demo Day para ajustes de último momento.', 'PMO', '2026-04-01', 'TODO', 'ARTIFACT');

RAISE NOTICE 'Seed RTN Q2 2026 completado. Session ID: %', v_sess;
END $$;
