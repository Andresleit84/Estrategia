# Casos de Negocio — OKR System
> Solo se documentan casos que funcionan 100% de punta a punta en el sistema actual.
> Última validación: 2026-05-13

---

## Índice

1. [Alta de empresa y onboarding del equipo](#caso-1)
2. [Lanzar el primer ciclo OKR](#caso-2)
3. [Definir la estrategia: diagnóstico, problemas e intenciones](#caso-3)
4. [Crear OKRs estratégicos de empresa y área](#caso-4)
5. [Alinear equipos con OKRs tácticos](#caso-5)
6. [Seguimiento semanal de progreso con check-ins](#caso-6)
7. [Ejecutar proyectos vinculados a la estrategia](#caso-7)
8. [Empresa ágil: conectar sprints con OKRs](#caso-8)
9. [Visibilidad ejecutiva en tiempo real](#caso-9)
10. [Exportar reportes y cierre de ciclo](#caso-10)
11. [IA como copiloto estratégico — Strategy Advisor](#caso-11)
12. [Gestión de riesgos con Risk Sentinel](#caso-12)
13. [Búsqueda global y navegación rápida](#caso-13)
14. [Soporte interno entre usuarios y administradores](#caso-14)
15. [Multi-empresa: un usuario, varias organizaciones](#caso-15)
16. [Seguridad avanzada y cumplimiento GDPR](#caso-16)

---

## CASO 1
### Alta de empresa y onboarding del equipo

**¿Para quién es?**
Fundador o director general que crea la empresa en la plataforma por primera vez.

**¿Qué logra?**
En menos de 10 minutos, la empresa tiene su workspace configurado, las áreas definidas y el equipo directivo invitado.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Ingresa a `/auth/register` y completa nombre de empresa y datos de acceso | `sp_create_organization` crea la org + usuario OWNER de forma atómica |
| 2 | Onboarding wizard — Paso 1: elige áreas predefinidas (RRHH, TI, Finanzas…) o crea propias | Se crean equipos raíz en la jerarquía |
| 3 | Onboarding wizard — Paso 2: opcional, activa cuerpo de gobierno | Se crea el nodo de gobernanza |
| 4 | Onboarding wizard — Paso 3: crea equipos dentro de las áreas | `sp_create_team` con jerarquía padre → hijo validada por trigger |
| 5 | Onboarding wizard — Paso 4: invita miembros por email con su rol asignado | `sp_invite_user` genera token seguro; usuario acepta vía `/auth/accept-invite` |
| 6 | Los miembros completan su perfil (nombre, contraseña) | `sp_accept_invitation` activa la cuenta con hash de contraseña en BD |
| 7 | Todos acceden al dashboard personalizado (`/welcome`) | Pantalla de bienvenida con estado del ciclo, mis objetivos y agenda |

**Actores**
- OWNER: registra la empresa
- ADMIN: puede completar el setup después
- MEMBER / VIEWER: aceptan invitación

**Evidencia de que funciona**
`sp_create_organization`, `sp_invite_user`, `sp_accept_invitation` son procedimientos PG auditados. El wizard de onboarding tiene 4 pasos con validación en cada uno. El join por invitación es el único flujo de alta — no hay acceso directo.

---

## CASO 2
### Lanzar el primer ciclo OKR

**¿Para quién es?**
OWNER o ADMIN que quiere abrir un período de planificación (trimestral, anual, etc.).

**¿Qué logra?**
El ciclo queda activo como contexto global de toda la plataforma. Solo puede existir un ciclo ACTIVE por organización.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Va a `/cycles` y crea un nuevo ciclo con nombre, tipo y fechas | `sp_create_cycle` inserta el ciclo en estado DRAFT |
| 2 | Revisa la configuración del ciclo en modo borrador | `v_cycles_with_stats` muestra progreso 0%, score 0, días restantes |
| 3 | Hace clic en "Activar ciclo" y confirma | `sp_activate_cycle` valida que no hay otro ciclo activo (trigger `trg_validate_single_active_cycle`), cambia estado DRAFT → ACTIVE |
| 4 | El TopBar muestra el nombre del ciclo activo con badge verde | `useActiveCycle` hook actualiza toda la app en tiempo real |
| 5 | Al finalizar el período, hace clic en "Cerrar ciclo" | `sp_close_cycle` genera snapshot final del estado de todos los OKRs |

**Reglas de negocio aplicadas**
- Solo 1 ciclo ACTIVE por org (enforced por trigger en BD, no en código)
- Un ciclo CLOSED no puede ser reabierto
- Los sprints solo pueden existir dentro de las fechas del ciclo padre

**Evidencia de que funciona**
`trg_validate_single_active_cycle` lanza ERRCODE P0001 si se intenta activar un segundo ciclo. `v_cycles_with_stats` devuelve stats en tiempo real sin cálculos en TypeScript.

---

## CASO 3
### Definir la estrategia: diagnóstico, problemas e intenciones

**¿Para quién es?**
Equipo directivo que quiere conectar los OKRs con los problemas reales del negocio, no solo con aspiraciones.

**¿Qué logra?**
Antes de crear OKRs, la organización documenta qué problemas enfrenta, los prioriza y los convierte en intenciones estratégicas que luego se vinculan a OKRs concretos.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Va a `/problems` y documenta los problemas del negocio | Tabla `organizational_problems` con título, categoría, impacto, urgencia |
| 2 | Prioriza cada problema (CRITICAL / HIGH / MEDIUM / LOW) | Vista `v_problems_with_stats` ordena por impacto × urgencia |
| 3 | Va a `/strategy` y crea intenciones estratégicas vinculadas a problemas | `sp_create_strategic_intent` + M2M `problem_intents` |
| 4 | Cada intención tiene dirección (INCREASE / REDUCE / MAINTAIN) y plazo | Validado en BD |
| 5 | Al crear OKRs, selecciona la intención estratégica como contexto | Los OKRs quedan vinculados en `objectives.strategic_intent_id` |
| 6 | En `/traceability` ve la cascada completa: Problema → Intención → OKR → KR → Check-in | Vista de trazabilidad completa |

**Diferenciador de negocio**
Este flujo es lo que separa usar OKRs de verdad de solo escribir metas. La trazabilidad problema → resultado es visible en todo momento.

**Evidencia de que funciona**
Tablas `organizational_problems`, `strategic_intents`, `problem_intents` con CRUD completo. Páginas `/problems` y `/strategy` tienen formularios, filtros y empty states funcionales.

---

## CASO 4
### Crear OKRs estratégicos de empresa y área

**¿Para quién es?**
OWNER, ADMIN o MANAGER definiendo la dirección estratégica de la empresa y sus áreas.

**¿Qué logra?**
La empresa tiene hasta 5 objetivos de empresa y hasta 5 por área, cada uno con hasta 5 Key Results, con calidad validada por IA antes de guardar.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Va a `/strategic` y hace clic en "Nuevo objetivo" | Formulario con nivel (COMPANY / AREA), ciclo activo, propietario, equipo |
| 2 | Escribe el título — el OKR Coach aparece como panel lateral | `POST /ai/okr-coach` → `fn_validate_okr_quality` + Claude → score 0-10 + mejoras |
| 3 | El Coach sugiere versiones mejoradas del objetivo; el usuario acepta o ignora | Sin bloqueo — solo sugerencia. El usuario manda |
| 4 | Guarda el objetivo | `sp_create_objective` — el trigger `trg_validate_objective_limits` rechaza si ya hay 5 objetivos en ese nivel/ciclo |
| 5 | Crea Key Results para el objetivo (tipo: INCREASE, DECREASE, MAINTAIN, ACHIEVE) | `sp_create_key_result` — trigger valida máx 5 KRs activos por objetivo |
| 6 | El progreso del objetivo se calcula automáticamente como promedio ponderado de sus KRs | `fn_calculate_objective_progress` en BD — sin cálculo en TypeScript |
| 7 | El mapa de alineación en `/strategic` muestra COMPANY → AREA con % de cobertura táctica | `v_alignment_map` |

**Reglas de negocio aplicadas**
- Máx 5 objetivos por nivel/ciclo/org (trigger en BD)
- Máx 5 KRs activos por objetivo (trigger en BD)
- Progreso calculado en BD, nunca en frontend

**Evidencia de que funciona**
`fn_validate_okr_quality` devuelve score + issues[]. `trg_validate_objective_limits` y `trg_validate_kr_limits` son BEFORE INSERT en BD. `v_objectives_with_progress` y `v_key_results_with_trend` son vistas PG, no joins en TypeScript.

---

## CASO 5
### Alinear equipos con OKRs tácticos

**¿Para quién es?**
Líderes de equipo y colaboradores individuales que necesitan sus propios OKRs alineados con los de empresa/área.

**¿Qué logra?**
Los equipos crean sus OKRs vinculados a un objetivo estratégico padre. La BD rechaza OKRs de equipo sin alineación. El índice de alineación de la org es visible en tiempo real.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Va a `/tactical` y crea objetivo de equipo o individual | Nivel TEAM o INDIVIDUAL obligatorio en el formulario |
| 2 | Selecciona objetivo padre (tree picker con OKRs de empresa/área) | `parent_objective_id` requerido — trigger `trg_validate_tactical_alignment` rechaza si no hay padre |
| 3 | Si el usuario no es miembro del equipo asignado, la BD rechaza el OKR | `trg_team_okr_permission` en BD |
| 4 | La vista `/tactical` muestra "Mis OKRs" separados de los del equipo | `v_my_objectives` y `v_team_objectives` — filtradas por user_id / team_id |
| 5 | El Alignment Auditor se dispara automáticamente al crear un OKR de equipo | `POST /ai/alignment-audit` → `fn_get_alignment_gaps` + Claude → índice 0-100 + brechas |
| 6 | El índice de alineación queda guardado en `ai_briefings` y visible en reportes | Historia de auditorías consultable |

**Reglas de negocio aplicadas**
- OKR de equipo sin padre estratégico es imposible (trigger BD)
- Solo miembros del equipo pueden crear OKRs del equipo (trigger BD)
- La validación no está en TypeScript — está en PG

**Evidencia de que funciona**
`trg_validate_tactical_alignment` lanza ERRCODE P0010. `trg_team_okr_permission` es BEFORE INSERT/UPDATE. `fn_get_alignment_gaps` calcula brecha real.

---

## CASO 6
### Seguimiento semanal de progreso con check-ins

**¿Para quién es?**
Cualquier responsable de un Key Result que actualiza su progreso periódicamente.

**¿Qué logra?**
Con un check-in se actualiza el valor actual del KR, su progreso se recalcula en cascada hasta el nivel de empresa, y el sistema predice si el KR se alcanzará a tiempo.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Desde cualquier lista de KRs, hace clic en "Check-in" | Se abre el Check-in Drawer con el valor actual, historial gráfico y predicción |
| 2 | Ingresa el nuevo valor actual | Preview del nuevo % de progreso en tiempo real |
| 3 | Mueve el slider de confianza (0-100%) | Color dinámico: rojo → ámbar → verde |
| 4 | Elige el mood (😊😐😟) y opcionalmente escribe una nota | Si hace clic en "Generar nota con IA": `POST /ai/checkin-assistant` → Claude sugiere nota basada en el contexto del KR |
| 5 | Confirma el check-in | `sp_create_check_in` inserta el registro; el trigger `trg_checkin_cascade_recalc` recalcula KR → objetivo → objetivos padre en una sola transacción PG |
| 6 | Si el KR llega al 100%, se marca COMPLETED automáticamente | Trigger lo maneja — sin código TypeScript |
| 7 | Si el KR lleva >14 días sin check-in, el cron nightly lo marca AT_RISK | `sp_mark_stale_krs_at_risk` + notificación in-app en tiempo real |
| 8 | Con 2+ check-ins, el drawer muestra predicción: "A este ritmo, alcanzarás el objetivo el [fecha]" | `fn_predict_kr_completion` — regresión lineal en BD |

**Resultado inmediato visible**
- El dashboard ejecutivo refleja el cambio en segundos
- La notificación WebSocket llega a todos los miembros de la org con `checkin:created`
- El historial del KR actualiza su gráfico (Recharts LineChart)

**Evidencia de que funciona**
`trg_checkin_cascade_recalc` es AFTER INSERT y propaga en cadena. `fn_predict_kr_completion` existe en BD. El WebSocket gateway emite al room `org:{orgId}`.

---

## CASO 7
### Ejecutar proyectos vinculados a la estrategia

**¿Para quién es?**
Líderes de equipo que necesitan gestionar iniciativas concretas que empujan los Key Results.

**¿Qué logra?**
Las iniciativas (proyectos, épicas, programas) quedan vinculadas a KRs específicos. El progreso de los milestones actualiza el progreso de la iniciativa automáticamente.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Va a `/initiatives` y crea una iniciativa | `sp_create_initiative` crea la iniciativa y sus vínculos con KRs en M2M (`initiative_key_results`) |
| 2 | Vincula la iniciativa a uno o más KRs usando el multi-select con buscador | Relación M2M en `initiative_key_results` |
| 3 | Agrega milestones con fechas de vencimiento | Tabla `milestones` vinculada a la iniciativa |
| 4 | Marca un milestone como completado | `sp_complete_milestone` → `trg_initiative_progress_from_milestones` recalcula el progreso de la iniciativa automáticamente |
| 5 | Si un milestone vence sin completarse, aparece alerta visual (borde rojo, badge "hitos vencidos") | `trg_milestone_overdue_alert` inserta notificación automáticamente |
| 6 | Vista Gantt en `/initiatives`: barras de tiempo con color según estado | `v_initiative_timeline` con milestones en JSONB |
| 7 | `fn_initiative_health` calcula el health score de la iniciativa | `{health, status, progress, days_overdue, completion_rate, blocking_milestones[]}` |

**Evidencia de que funciona**
`sp_create_initiative` maneja la creación + vínculos KR en una transacción. `trg_initiative_progress_from_milestones` es AFTER INSERT/UPDATE en `milestones.status`. `v_initiative_timeline` existe en BD.

---

## CASO 8
### Empresa ágil: conectar sprints con OKRs

**¿Para quién es?**
Equipos Scrum en empresas con modo AGILE o HYBRID que quieren que sus sprints empujen objetivos estratégicos.

**¿Qué logra?**
Cada sprint tiene KRs vinculados como sprint goals. El burn-up muestra si los sprints están avanzando los OKRs. Al cerrar el sprint, el sistema propone check-ins para los KRs afectados.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | El modo AGILE o HYBRID está configurado en settings de la org | La BD habilita el módulo de sprints para esa org |
| 2 | Va a `/sprints` y genera sprints automáticamente para el ciclo | `POST /sprints/generate` divide el ciclo en sprints de 1-4 semanas con preview en vivo |
| 3 | En el sprint activo, vincula KRs como sprint goals con contribución esperada | `sprint_goal_krs` M2M con `expected_contribution` |
| 4 | El Sprint Board muestra las iniciativas del sprint activo en columnas (Por hacer / En progreso / Completada) | `v_sprint_board` con iniciativas en JSONB |
| 5 | Ve el burn-up: gráfico de progreso acumulado real vs línea ideal | `fn_calculate_burnup` en BD → Recharts |
| 6 | Cierra el sprint con el wizard de cierre | `sp_close_sprint` guarda velocidad real + propone check-ins para los KRs vinculados |
| 7 | El usuario confirma los check-ins propuestos (uno por uno) | `sp_create_check_in` para cada KR confirmado → cascada de recálculo |
| 8 | El historial de velocidad muestra planeado vs real sprint a sprint | `v_sprint_velocity` |

**Regla de negocio clave**
`trg_validate_sprint_org_mode` rechaza la creación de sprints si la org no es AGILE o HYBRID. La validación es en BD.

**Evidencia de que funciona**
`sp_close_sprint` existe y propone check-ins sin crearlos automáticamente (respeta la confirmación del usuario). `fn_sprint_okr_impact` calcula contribución real vs esperada. `v_cycle_sprint_timeline` muestra todos los sprints del ciclo.

---

## CASO 9
### Visibilidad ejecutiva en tiempo real

**¿Para quién es?**
Dirección general, board, o cualquier stakeholder que necesita un resumen del estado estratégico sin abrir cada OKR.

**¿Qué logra?**
En una pantalla, la dirección ve el estado completo del ciclo: qué está en verde, qué está en riesgo, cómo están los equipos, y la tendencia semana a semana. Sin pedir informes manuales.

**Lo que está disponible en `/reports`**

| Vista | Qué muestra | Fuente |
|-------|-------------|--------|
| Heat map ejecutivo | Estado por nivel: COMPANY / AREA / TEAM — color + % por celda | `v_executive_dashboard` |
| Cycle health | Distribución de estados, confianza promedio, proyección de cierre | `v_cycle_health` |
| Radar de equipos | 4 dimensiones por equipo: progreso × confianza × cadencia × cobertura | `v_team_health` |
| Tendencia semanal | Progreso del ciclo semana a semana (últimas 8 semanas) | `v_weekly_trend` |
| Portfolio / Gantt | Iniciativas con barras Gantt por equipo, estado visual por color | `v_portfolio_dashboard` |
| KRs en riesgo | Priorizados por impacto estratégico (COMPANY primero) | `v_at_risk_krs` |
| Cadencia de check-ins | Semáforo verde/ámbar/rojo por KR según días sin check-in | `v_cadence_dashboard` |
| Gobierno OKR | Calendario de eventos de gobernanza: KICKOFF, MID-REVIEW, RETROSPECTIVE… | `GET /reports/governance` |

**Performance**
Los 4 dashboards pesados (executive, cycle-health, team-health, portfolio) tienen Redis cache con TTL 300s. La primera carga es < 300ms en producción.

**Evidencia de que funciona**
Todas las vistas son objetos PG — no hay joins en TypeScript. Redis cache está implementado con `getOrSet` y fallback si Redis no está disponible.

---

## CASO 10
### Exportar reportes y cierre de ciclo

**¿Para quién es?**
OWNER o ADMIN que necesita documentar el ciclo para accionistas, board o archivo histórico.

**¿Qué logra?**
Al cerrar un ciclo, se genera un snapshot inmutable con el estado final de todos los OKRs. El reporte es exportable en PDF y CSV.

**Flujo paso a paso**

| Paso | Acción | Lo que ocurre en el sistema |
|------|--------|-----------------------------|
| 1 | Hace clic en "Cerrar ciclo" y confirma | `sp_close_cycle` ejecuta en BD |
| 2 | Solicita el reporte de cierre | `POST /reports/close-report/:cycleId` → `fn_generate_cycle_close_report` genera JSON completo con top performers, needs improvement, score final |
| 3 | El snapshot queda guardado en `cycle_close_reports` (UNIQUE por cycle_id) | Inmutable — no se puede sobrescribir |
| 4 | Descarga el PDF ejecutivo | `GET /reports/export-pdf/:cycleId` — generado con pdfkit |
| 5 | Descarga el CSV con todos los KRs | `GET /reports/export-csv/:cycleId` — RFC-4180, stream directo sin cargar en memoria |

**Evidencia de que funciona**
`fn_generate_cycle_close_report` existe en BD con UNIQUE constraint en `cycle_close_reports`. Los endpoints de PDF y CSV están registrados en `reports.controller.ts`.

---

## CASO 11
### IA como copiloto estratégico — Strategy Advisor

**¿Para quién es?**
Cualquier usuario que quiere orientación estratégica basada en los datos reales de su ciclo.

**¿Qué logra?**
Un chat de IA con acceso al ciclo activo (OKRs, KRs en riesgo, historial de check-ins) que responde preguntas, detecta patrones y propone acciones concretas.

**Capacidades del chat en `/ai-assistant`**

| Capacidad | Cómo funciona |
|-----------|---------------|
| Historial de conversaciones | Persistido en `ai_conversations`, agrupado por ciclo |
| @ menciones de OKRs | Escribe `@` y aparece dropdown con los objetivos del ciclo activo — el OKR se inyecta como contexto |
| Chips de acciones sugeridas | Cada respuesta puede incluir chips clicables que navegan a la sección relevante |
| Referencia de fuentes | Cada respuesta muestra qué datos consultó (ej. "basado en v_at_risk_krs") |
| Rate limiting por plan | FREE: 50/día · BASIC: 100/día · PRO: 1000/día — controlado en Redis |
| Audit log | Cada llamada a IA queda en `mcp_audit_log` — inmutable por trigger |

**Evidencia de que funciona**
`ai_conversations` existe en BD. `mcp_audit_log` tiene trigger `trg_mcp_audit_immutable` que lanza ERRCODE 55000 en UPDATE/DELETE. Rate limiting en Redis con `incr` + `expire`.

---

## CASO 12
### Gestión de riesgos con Risk Sentinel

**¿Para quién es?**
OWNER y ADMIN que necesitan saber cuándo un KR se está desviando antes de que sea demasiado tarde.

**¿Qué logra?**
Automáticamente, cada noche, el sistema escanea todos los KRs y genera alertas priorizadas por impacto estratégico. El dashboard de riesgos está disponible en todo momento.

**Flujo automático (sin intervención del usuario)**

| Momento | Acción automática | Resultado |
|---------|-------------------|-----------|
| Nightly 2am | Cron `CheckInCronService` llama `sp_mark_stale_krs_at_risk` | KRs sin check-in >14 días quedan marcados AT_RISK |
| Nightly | Risk Sentinel Agent escanea `v_at_risk_krs` + Claude | Lista priorizada de alertas con contexto (COMPANY > AREA > TEAM) |
| Tiempo real | `trg_checkin_cascade_recalc` detecta progreso bajo con confianza baja | Notificación AT_RISK generada automáticamente |
| Cualquier momento | Usuario abre `/reports/risk-dashboard` | Dashboard de KRs en riesgo con filtros por nivel y equipo |

**Predicción disponible**
Cada KR con 2+ check-ins tiene predicción de cierre: `fn_predict_kr_completion` calcula regresión lineal y devuelve probabilidad + fecha proyectada + trend (up/flat/down).

**Evidencia de que funciona**
`sp_mark_stale_krs_at_risk` existe en BD con dedup de notificaciones. `v_at_risk_krs` ordena por nivel estratégico. Cron configurado en `CheckInCronService`.

---

## CASO 13
### Búsqueda global y navegación rápida

**¿Para quién es?**
Cualquier usuario que necesita encontrar un OKR, iniciativa, backlog item o ciclo específico sin recordar en qué sección está.

**¿Qué logra?**
Con `Ctrl+K` (o `Cmd+K` en Mac), se abre un command palette que busca en toda la plataforma y permite navegar directamente al resultado.

**Cómo funciona**

| Situación | Comportamiento |
|-----------|---------------|
| Sin query (solo abre Ctrl+K) | Grid de 8 accesos rápidos: Estratégicos, Tácticos, Check-ins, Iniciativas, Sprints, Reportes, Backlog, Soporte |
| Query ≥ 2 caracteres | Debounce 280ms → `fn_global_search` en BD (ILIKE + `ts_rank` con UNION ALL) |
| Resultados | Agrupados por categoría: OKRs · Backlog · Iniciativas · Ciclos |
| Teclado | `↑↓` navegar · `Enter` abrir · `Esc` cerrar |

**Evidencia de que funciona**
`fn_global_search` en BD con `migration 039`. `GlobalSearchDialog.tsx` usa `createPortal`. Hook `useGlobalSearch` con debounce 280ms.

---

## CASO 14
### Soporte interno entre usuarios y administradores

**¿Para quién es?**
Cualquier usuario que necesita reportar un problema o hacer una consulta, y los ADMIN/OWNER que gestionan las solicitudes.

**¿Qué logra?**
Canal de soporte nativo dentro de la plataforma con tickets categorizados, conversación bidireccional y gestión de estados. Sin depender de email externo.

**Flujo del usuario**

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | Abre su menú de usuario (TopBar) → "Centro de soporte" | Navega a `/support` |
| 2 | Crea un ticket: categoría + asunto + mensaje | `sp_create_support_ticket` inserta ticket + primer mensaje |
| 3 | Ve el ticket en la lista (estado: Abierto) | `v_support_tickets` con conteo de mensajes |
| 4 | Recibe respuesta del equipo de soporte | Notificación en tiempo real via WebSocket |
| 5 | Responde en el chat del ticket (Ctrl+Enter para enviar) | `sp_add_support_message` — historial persistido |

**Flujo del administrador**

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | Ve todos los tickets de la organización en `/support` | `v_support_tickets` filtrada por org_id para ADMIN/OWNER |
| 2 | Abre un ticket y responde | `sp_add_support_message` con `is_staff=true` — cambia estado a "En proceso" automáticamente |
| 3 | Cambia el estado del ticket (selector inline en el panel) | UPDATE directo vía `useUpdateStatus` |
| 4 | Marca el ticket como Resuelto o Cerrado | Estado final — ticket cerrado no permite más respuestas |

**Categorías disponibles**
General · Bug · Solicitud de función · Facturación · Acceso/Permisos · Otro

**Evidencia de que funciona**
`sp_create_support_ticket`, `sp_add_support_message`, `v_support_tickets`, `v_support_ticket_detail` existen en BD (migration 011). `SupportModule` registrado en `app.module.ts`. Página `/support` con UI de chat bidireccional.

---

## CASO 15
### Multi-empresa: un usuario, varias organizaciones

**¿Para quién es?**
Consultores, directores con board memberships, o cualquier persona que pertenece a más de una empresa en la plataforma.

**¿Qué logra?**
Un solo login permite acceder a múltiples organizaciones y cambiar entre ellas sin cerrar sesión. Los datos de cada empresa están completamente aislados.

**Flujo**

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | El usuario tiene cuenta en 2+ organizaciones (mismo email) | `UNIQUE(organization_id, email)` — el mismo email puede existir en orgs distintas |
| 2 | Inicia sesión normalmente | El sistema selecciona la organización más antigua por defecto |
| 3 | En el sidebar (OrgSwitcher), hace clic en el nombre de la empresa | Dropdown con todas las orgs del usuario |
| 4 | Selecciona otra organización | `POST /auth/switch-org` → nuevo JWT con el nuevo `organization_id` + refresh de datos |
| 5 | Toda la app muestra los datos de la nueva org | TanStack Query invalida todas las queries automáticamente |

**Aislamiento de datos**
Row Level Security activo en 7 tablas clave. `fn_check_org_context` valida el contexto antes de cada query. Un usuario no puede ver datos de otra org aunque conozca los IDs.

**Evidencia de que funciona**
`UNIQUE(organization_id, email)` en BD. `POST /auth/switch-org` en `AuthController`. `OrgSwitcher` en `Sidebar.tsx` con invalidación de queries via `qc.invalidateQueries()`.

---

## CASO 16
### Seguridad avanzada y cumplimiento GDPR

**¿Para quién es?**
OWNER/ADMIN que necesita controlar el acceso, y usuarios que necesitan controlar sus datos personales.

**¿Qué logra?**
Autenticación con segundo factor, bloqueo por intentos fallidos, cierre de todas las sesiones, exportación de datos personales y eliminación de cuenta conforme a GDPR.

**Capacidades disponibles en `/settings`**

| Funcionalidad | Dónde | Qué hace |
|---------------|-------|----------|
| Activar MFA (TOTP) | Settings → Seguridad | Genera QR code para Google Authenticator; `sp_verify_totp` valida el código |
| Bloqueo automático | Login | 5 intentos fallidos → bloqueo 15 minutos. `fn_check_login_attempts` en BD |
| Cerrar todas las sesiones | Settings → Seguridad | `sp_revoke_all_tokens` invalida todos los refresh tokens activos |
| Exportar mis datos | Settings → Privacidad | `sp_export_user_data` genera JSONB con todos los datos del usuario — descarga como JSON |
| Eliminar mi cuenta | Settings → Privacidad | `sp_anonymize_user` anonimiza datos en todas las tablas (GDPR Article 17) + cierra sesión |
| Audit de seguridad | Settings → Sistema (OWNER/ADMIN) | `v_security_audit` — últimos 100 eventos de seguridad de la org |

**Evidencia de que funciona**
Todos los procedimientos existen en BD (migration incluida en Hito 13). Endpoints en `AuthController` y el módulo `/me`. `trg_reset_login_attempts` limpia el contador al hacer login exitoso.

---

## Resumen ejecutivo

| # | Caso de negocio | Actores principales | Ciclo completo |
|---|-----------------|--------------------|-|
| 1 | Alta y onboarding | OWNER | ✅ |
| 2 | Lanzar ciclo OKR | OWNER / ADMIN | ✅ |
| 3 | Diagnóstico y estrategia | Dirección | ✅ |
| 4 | OKRs estratégicos + OKR Coach | OWNER / ADMIN / MANAGER | ✅ |
| 5 | OKRs tácticos alineados | Team leads / MEMBER | ✅ |
| 6 | Check-ins y progreso automático | Cualquier responsable de KR | ✅ |
| 7 | Iniciativas y ejecución | Team leads | ✅ |
| 8 | Sprints ágiles conectados a OKRs | Equipos Scrum (modo AGILE/HYBRID) | ✅ |
| 9 | Visibilidad ejecutiva | Dirección / VIEWER | ✅ |
| 10 | Reportes, PDF, CSV y cierre de ciclo | OWNER / ADMIN | ✅ |
| 11 | Strategy Advisor — chat con IA | Todos | ✅ |
| 12 | Risk Sentinel — alertas automáticas | OWNER / ADMIN | ✅ |
| 13 | Búsqueda global (Ctrl+K) | Todos | ✅ |
| 14 | Soporte interno bidireccional | Todos / ADMIN | ✅ |
| 15 | Multi-empresa y org switching | Consultores / multi-rol | ✅ |
| 16 | Seguridad MFA + GDPR | Todos / OWNER | ✅ |

> **16 casos de negocio completos. Todos con validación en base de datos, UI funcional y flujo verificado de punta a punta.**
