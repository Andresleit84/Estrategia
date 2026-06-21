# Hoja de Ruta — Sistema OKR

> Cada hito se construye sobre el anterior. No avanzar al siguiente sin que el anterior esté funcional, testeado y con estándares de calidad aprobados.

---

## HITO 0 — Design System & Fundamentos UX/UI
**Objetivo**: Antes de escribir un solo componente de negocio, definir y construir el sistema de diseño completo. Todo el frontend se construirá sobre esta base.

### Entregables
- [x] Definir paleta de colores completa (semáforo OKR, marca, neutrales, dark mode)
- [x] Configurar design tokens en `frontend/src/design-system/tokens/` (CSS variables + Tailwind config)
- [x] Tipografía: instalar Inter + JetBrains Mono, escala tipográfica
- [x] Instalar y configurar shadcn/ui con el tema personalizado
- [x] Componentes base: Button, Input, Badge, Card, Drawer, Dialog, Dropdown, Tooltip
- [x] Componentes OKR específicos: ProgressRing, ConfidenceMeter, StatusChip, KRCard (shell)
- [x] Layout base: Sidebar, TopBar, PageHeader, EmptyState, SkeletonLoader
- [x] Dark mode funcional (CSS variables + next-themes)
- [x] Storybook o página `/design` para previsualizar componentes
- [x] Checklist de accesibilidad: focus visible, ARIA, contraste mínimo

**Estándar de salida**: cualquier desarrollador puede construir una pantalla nueva usando solo los componentes del design system sin inventar estilos ad-hoc.

**Estado**: ✅ COMPLETADO — 2026-04-22

---

## HITO 1 — Fundaciones técnicas + MCP Server base
**Objetivo**: Proyecto backend y frontend corriendo localmente, base de datos conectada, autenticación funcional, y esqueleto del MCP Server en pie.

### Base de datos
- [x] Extensiones PostgreSQL: `uuid-ossp`, `pg_trgm`, `unaccent`, `pgcrypto`
- [x] Tablas: `organizations`, `users`, `refresh_tokens`, `invitations`, `audit_log`, `mcp_audit_log`
- [x] Trigger `trg_updated_at` en tablas con `updated_at`
- [x] Trigger `trg_soft_delete` para borrado lógico vía `deleted_at`
- [x] Trigger `trg_audit_log` en `users` y `organizations` (sin loguear password_hash)
- [x] Función `fn_user_has_permission(user_id, resource, action)` — RBAC centralizado en DB
- [x] Función `sp_validate_login(email, password)` — valida con pgcrypto bcrypt, retorna sesión completa
- [x] Función `sp_register_user(org_id, email, password, name, role)` — hash en BD
- [x] Función `sp_create_organization(...)` — crea org + owner atómicamente, hash en BD
- [x] Función `sp_invite_user(org_id, email, role, invited_by_id)` — token aleatorio en BD
- [x] Función `sp_accept_invitation(token, name, password)` — activa invitación
- [x] Función `sp_refresh_token_raw(raw_token, device, ip)` — rotación segura con family, hash en BD
- [x] Función `fn_issue_refresh_token(user_id, device, ip)` — emite token, retorna plano una vez
- [x] Vista `v_user_session` — datos de usuario + org para JWT
- [x] Índices optimizados en todas las columnas de búsqueda frecuente

### Backend
- [x] Proyecto NestJS con TypeScript strict mode
- [x] `DbService`: pool de conexiones pg, métodos `query<T>`, `queryOne<T>`, `execute`, `withTransaction`
- [x] Migración ejecutada — todas las tablas y objetos DB del hito
- [x] Módulo `auth`: registro → `sp_create_organization`, login → `sp_validate_login`, JWT HttpOnly cookie, refresh → `sp_refresh_token_raw`
- [x] Guards: `JwtAuthGuard` (con decorador `@Public()`), `LocalAuthGuard`, `PermissionGuard`
- [x] Decoradores: `@CurrentUser()`, `@Public()`, `@RequirePermission(resource, action)`
- [x] Helmet.js + CORS + Rate limiting configurados
- [x] Health check: `GET /api/v1/health` (verifica conexión a DB)
- [x] **MCP Server base**: módulo `mcp/` con `tools/list`, `tools/call`, audit log en DB
- [x] Filtro global de excepciones con logging

### Frontend
- [x] Next.js 16 App Router integrado con design system del Hito 0
- [x] Páginas de auth: `/auth/login`, `/auth/register` usando componentes del design system
- [x] `lib/api-client.ts`: cliente HTTP tipado con credentials: include
- [x] `lib/auth.ts`: authApi con register, login, logout, me, refresh

**Estado**: ✅ COMPLETADO — 2026-04-22 | **Depende de**: Hito 0

---

## BACKLOG — Módulo de Seguridad Avanzada y Perfilamiento
> Agregado al backlog por solicitud. Se integrará como parte de un hito posterior (candidato: post Hito 2 o Hito 3).

### Seguridad de autenticación
- [ ] MFA (TOTP) — tablas `user_mfa_secrets`, función `sp_verify_totp(user_id, code)`, integración con TOTP de pgcrypto
- [ ] Política de contraseñas configurable por org — función `fn_validate_password_policy(org_id, password)`
- [ ] Detección de login sospechoso: país/IP desconocida → trigger `trg_detect_suspicious_login`
- [ ] Bloqueo de cuenta por intentos fallidos — función `fn_check_login_attempts(email, ip)`, tabla `login_attempts`
- [ ] Sesiones concurrentes limitadas por plan — vista `v_active_sessions`
- [ ] Revocación masiva de tokens (logout all devices) — procedimiento `sp_revoke_all_tokens(user_id)`
- [ ] Historial de contraseñas — tabla `password_history`, función `fn_check_password_reuse`

### Perfilamiento de usuarios
- [ ] Tabla `user_profiles` — preferencias, timezone, idioma, notificaciones
- [ ] Tabla `user_activity_log` — registro de acciones relevantes del usuario
- [ ] Vista `v_user_activity_summary` — resumen de actividad para el módulo de reportes
- [ ] Procedimiento `sp_update_user_profile(user_id, ...)` — actualización segura de perfil
- [ ] Avatar upload — integración con storage local (ruta configurable en `organizations.settings`)

### Administración y cumplimiento
- [ ] Vista `v_security_audit` — resumen de eventos de seguridad para OWNER/ADMIN
- [ ] Política de sesión por organización — tabla `org_security_policies`
- [ ] Export de datos GDPR — procedimiento `sp_export_user_data(user_id)`
- [ ] Soft delete con anonimización GDPR — `sp_anonymize_user(user_id)`

---

## HITO 2 — Multi-tenancy, equipos y onboarding
**Objetivo**: Una organización puede registrarse, configurar su workspace e invitar usuarios. La experiencia de onboarding es guiada y fluida.

### Base de datos
- [x] Tablas: `teams`, `team_members` (invitations en Hito 1)
- [x] Trigger `trg_validate_team_hierarchy` — impide ciclos en parentTeamId
- [x] Trigger `trg_audit_log` extendido a `teams` y `team_members`
- [x] Función `sp_create_organization` actualizada — crea org + owner + equipo raíz automáticamente
- [x] Función `sp_create_team(org_id, name, description, parent_team_id, owner_id)` — valida jerarquía
- [x] Función `sp_add_team_member(team_id, user_id, role, added_by)` — con validación cross-org
- [x] Función `sp_remove_team_member(team_id, user_id)`
- [x] Función `sp_accept_invitation(token, name, password)` — hash en BD
- [x] Función `fn_update_organization(org_id, name, mode, settings)`
- [x] Vista `v_org_members` — usuarios con roles y equipos agrupados en JSONB
- [x] Vista `v_team_tree` — árbol recursivo con depth, path, member_count
- [x] Vista `v_user_teams` — equipos donde el usuario es miembro
- [x] Función `fn_user_belongs_to_org(user_id, org_id)` — validación cross-tenant
- [x] Índices: `idx_team_members_user`, `idx_team_members_team`, `idx_teams_org`, `idx_teams_parent`

### Backend
- [x] Módulo `organizations`: GET/PATCH /me, GET /me/members, GET /me/team-tree
- [x] Módulo `teams`: list, create, getMembers, addMember, removeMember — todo via funciones de DB
- [x] Guards de rol: `PermissionGuard` llama `fn_user_has_permission` en DB
- [x] RLS efectivo vía `organization_id` inyectado desde JWT en todas las queries

### Frontend
- [x] Onboarding wizard (4 pasos): bienvenida → crear equipo → invitar → listo
- [x] AppShell (layout autenticado): Sidebar + TopBar con protección server-side via `cookies()`
- [x] Dashboard estratégico con empty state (sin ciclo activo)
- [x] Página `/teams`: árbol de equipos + panel de miembros + modal crear equipo
- [x] Página `/settings`: editar org (nombre, modo), lista de miembros con roles
- [x] Hooks: `useTeams`, `useOrganization`, `useOrgMembers` con TanStack Query
- [x] Zustand store: `useAuthStore` para sesión de usuario
- [x] `proxy.ts` para protección de rutas (Next.js 16)
- ⚠️ Requiere acción manual: `del D:\estrategia\frontend\src\middleware.ts` (conflicto Next.js 16)

### UX checkpoints
- [x] Empty state en dashboard estratégico
- [x] Skeleton loaders en páginas de equipos y settings
- [x] Feedback de guardado en settings de organización

**Estado**: ✅ COMPLETADO — 2026-04-22 (pendiente eliminar middleware.ts) | **Depende de**: Hito 1

---

## HITO 3 — Ciclos OKR
**Objetivo**: La organización gestiona sus ciclos de planificación. Solo un ciclo puede estar ACTIVE a la vez y es el contexto de toda la app.

### Base de datos
- [x] Tabla: `cycles`
- [x] Trigger `trg_validate_single_active_cycle` — BEFORE INSERT/UPDATE: rechaza si ya hay un ciclo ACTIVE en la org
- [x] Trigger `trg_audit_log` en `cycles`
- [x] Procedimiento `sp_activate_cycle(cycle_id, user_id)` — valida unicidad, cambia DRAFT→ACTIVE
- [x] Procedimiento `sp_close_cycle(cycle_id, user_id)` — cierra ciclo + snapshot del estado final (cascada de OKRs se completa en Hito 4)
- [x] Procedimiento `sp_create_cycle(...)` y función `fn_update_cycle(...)` — gestión completa de ciclos
- [x] Vista `v_cycles_with_stats` — ciclos con: nro objetivos, progreso promedio, score, estado, días restantes
- [x] Función `fn_get_cycle_score(cycle_id)` — stub; lógica real se completa en Hito 4
- [x] Índices: `idx_cycles_org_status`, `idx_cycles_dates`

### Backend
- [x] Módulo `cycles`: llama `sp_activate_cycle`, `sp_close_cycle`, `v_cycles_with_stats`
- [x] Endpoints: GET /cycles, GET /cycles/active, GET /cycles/:id, POST /cycles, PATCH /cycles/:id, POST /cycles/:id/activate, POST /cycles/:id/close, GET /cycles/:id/score
- [x] Regla de unicidad enforced en DB (trigger), no en código
- [x] **MCP Tools**: `list_cycles` → `v_cycles_with_stats`, `get_cycle_summary` → `fn_get_cycle_score`

### Frontend
- [x] Selector de ciclo global en el TopBar — muestra nombre del ciclo activo con enlace a /cycles
- [x] Vista `/cycles` — lista de ciclos agrupados por estado (activo / borradores / histórico)
- [x] Crear ciclo — modal con nombre, tipo, fechas, descripción
- [x] Badge de ciclo activo visible en TopBar (link a /cycles)
- [x] Ciclos link en Sidebar
- [x] Hooks: `useCycles`, `useActiveCycle`, `useCreateCycle`, `useActivateCycle`, `useCloseCycle`
- [x] Componentes UI: `Textarea`, `Select` (nativo estilizado)

### UX checkpoints
- [x] Empty state si no hay ciclos: CTA a crear el primero
- [x] Confirmación antes de cerrar un ciclo activo (acción irreversible)

**Estado**: ✅ COMPLETADO — 2026-04-22 | **Depende de**: Hito 2

---

## HITO 4 — OKRs estratégicos + OKR Coach AI
**Objetivo**: La dirección define OKRs de empresa y área con cascada. El OKR Coach AI ayuda a escribir mejores OKRs en tiempo real.

### Base de datos
- [x] Tablas: `objectives`, `key_results`
- [x] Trigger `trg_validate_objective_limits` — BEFORE INSERT: máx 5 objetivos por nivel/ciclo/org
- [x] Trigger `trg_validate_kr_limits` — BEFORE INSERT: máx 5 KRs activos por objetivo
- [x] Trigger `trg_updated_at` y `trg_audit_log` en ambas tablas
- [x] Función `fn_calculate_kr_progress(kr_id)` — lógica por tipo: INCREASE, DECREASE, MAINTAIN, ACHIEVE
- [x] Función `fn_calculate_objective_progress(obj_id)` — promedio ponderado de KRs activos
- [x] Función `fn_validate_okr_quality(title, description, type, target, unit)` → score 0-10 + issues[]
- [x] Procedimiento `sp_create_objective(org_id, cycle_id, parent_id, owner_id, team_id, level, title, description)` — valida límites vía trigger
- [x] Procedimiento `sp_create_key_result(obj_id, owner_id, title, type, unit, start_val, target_val)` — valida límites vía trigger
- [x] Vista `v_objectives_with_progress` — objetivos + progreso calculado + estado + strategic_intent_id
- [x] Vista `v_key_results_with_trend` — KRs + progreso + tendencia real (up/flat/down) + checkin_count
- [x] Vista `v_alignment_map` — árbol COMPANY→AREA con % de cobertura táctica
- [x] Índices: `idx_objectives_cycle_org`, `idx_objectives_parent`, `idx_key_results_objective`

### Backend
- [x] Módulo `objectives`: llama `sp_create_objective`, `v_objectives_with_progress`, `v_alignment_map`
- [x] Módulo `key-results`: llama `sp_create_key_result`, `v_key_results_with_trend`
- [x] Toda validación de negocio (límites, tipos) enforced en triggers y procedimientos
- [x] **MCP Tools**: `list_objectives` → vista, `validate_okr_quality` → función
- [x] **OKR Coach Agent**: llama `fn_validate_okr_quality` + Claude para sugerencias enriquecidas

### Frontend
- [x] Vista estratégica: lista de OKRs de empresa + área con ProgressRing y StatusChip
- [x] Detalle de objetivo: KRs con ConfidenceMeter, botón check-in por KR
- [x] Mapa de alineación: árbol visual de cascada COMPANY → AREA
- [x] Formulario de creación de OKR/KR con **OKR Coach inline**:
  - Sugerencias en tiempo real mientras el usuario escribe
  - Validación de calidad (score 0-10) con mejoras específicas
  - Sin bloquear — el usuario puede ignorar las sugerencias
- [x] Filtros: por nivel (empresa/área) y estado — dropdowns en la página estratégica

### UX checkpoints
- [x] Empty state estratégico: ilustración del mapa vacío + CTA a crear primer objetivo
- [x] El OKR Coach aparece como panel lateral no intrusivo (no modal)
- [x] Skeleton loaders en el árbol de cascada

**Estado**: ✅ COMPLETADO — 2026-04-23 | **Depende de**: Hito 3

---

## HITO 5 — OKRs tácticos + Alignment Auditor AI
**Objetivo**: Los equipos crean sus OKRs alineados. El Alignment Auditor detecta brechas automáticamente al publicar el ciclo.

### Base de datos
- [x] Trigger `trg_validate_tactical_alignment` — BEFORE INSERT en objectives con level=TEAM/INDIVIDUAL: exige `parent_objective_id` que apunte a AREA o COMPANY (ERRCODE P0010)
- [x] Trigger `trg_team_okr_permission` — BEFORE INSERT/UPDATE: valida que el user sea miembro del team
- [x] Función `fn_get_alignment_gaps(cycle_id, org_id)` — retorna: OKRs de empresa sin cobertura táctica, índice de alineación 0-100 *(migration 005)*
- [x] Función `fn_get_cascade_coverage(objective_id)` — % de KRs con OKR de equipo alineado *(migration 014)*
- [ ] Vista `v_alignment_map` extendida: COMPANY→AREA→TEAM→INDIVIDUAL con % cobertura por nivel *(diferido a Hito 9)*
- [x] Vista `v_team_objectives` — OKRs del equipo con progreso
- [x] Vista `v_my_objectives` — OKRs donde el user es owner
- [x] Índices: `idx_objectives_team`, `idx_objectives_level_cycle`
- [x] **Extra**: tablas `organizational_problems`, `strategic_intents`, `problem_intents` + vistas + procedimientos (Diagnóstico Org)

### Backend
- [x] Reutilizar módulos de objectives/key-results — filtros por `level` y `team_id`
- [x] Toda validación de permisos y alineación enforced en triggers
- [x] **MCP Tools**: `get_alignment_map` → vista, `analyze_alignment_gaps` → `fn_get_alignment_gaps` *(Hito 9)*
- [x] **Alignment Auditor Agent**: al activar ciclo + crear OKR de equipo, llama `fn_get_alignment_gaps` + Claude *(Hito 9)*
- [x] **Extra**: módulos `ProblemsModule` y `StrategicIntentsModule` con CRUD completo

### Frontend
- [x] Vista de equipo: OKRs del equipo con el mismo design system (ProgressRing, KRCard)
- [x] Vista individual: "Mis OKRs" — OKRs donde soy owner
- [x] Selector de objetivo padre (tree picker) al crear OKR de equipo
- [ ] Mapa de alineación extendido: COMPANY → AREA → TEAM → INDIVIDUAL *(diferido a Hito 9)*
- [ ] Panel de cobertura: alerta visual si hay objetivos de empresa sin OKRs de equipo alineados *(diferido a Hito 9)*
- [ ] Reporte de Alignment Auditor visible en la vista del ciclo *(diferido a Hito 9)*
- [x] **Extra**: páginas `/problems` (Diagnóstico) y `/strategy` (Intenciones Estratégicas) con CRUD completo

### UX checkpoints
- [x] Badge "sin alineación" en OKRs de equipo sin objetivo padre *(validación en DB)*
- [ ] El reporte del Auditor usa lenguaje claro *(diferido a Hito 9)*

**Estado**: ✅ COMPLETADO — 2026-04-23 | **Depende de**: Hito 4

> Nota: Alignment Auditor Agent y vistas de cobertura avanzada diferidos a Hito 9. Vista táctica completa con CRUD, selector de objetivo padre, y "Mis OKRs" entregados. Módulo de Diagnóstico Organizacional (problems + strategic intents) entregado como extensión de este hito.

---

## HITO 6 — Check-ins, progreso + Check-in Assistant AI
**Objetivo**: Los responsables actualizan el progreso fácilmente. El Check-in Assistant reduce la fricción y mejora la calidad de las notas.

### Base de datos
- [x] Tabla: `check_ins` (kr_id, user_id, checked_at, current_value, confidence, notes, mood)
- [x] Tabla: `notifications` (org, user, type, title, body, entity, read_at)
- [x] Trigger `trg_prevent_past_checkin` — BEFORE INSERT: rechaza si fecha < último check-in del KR
- [x] Trigger `trg_checkin_cascade_recalc` — AFTER INSERT: actualiza KR progress/status/completed_at → propaga a objetivo → objetivos padre. Auto-completa y notifica AT_RISK/COMPLETED en un solo trigger
- [x] Trigger `trg_audit_log` en `check_ins`
- [x] Función `fn_predict_kr_completion(kr_id)` — regresión lineal → `{probability, projected_value, projected_date, trend}`
- [x] Función `fn_days_since_last_checkin(kr_id)` — días desde el último check-in
- [x] Procedimiento `sp_create_check_in(kr_id, user_id, current_value, confidence, notes, mood)` — inserta, triggers hacen el resto
- [x] Procedimiento `sp_mark_stale_krs_at_risk(org_id)` — AT_RISK para KRs sin check-in > 14 días + notificaciones
- [x] Vista `v_check_in_history` — historial con delta vs check-in anterior
- [x] Vista `v_at_risk_krs` — KRs en riesgo ordenados por impacto estratégico (COMPANY primero)
- [x] Vista `v_cadence_dashboard` — todos los KRs con días desde último check-in + propietario + equipo
- [x] Vista `v_key_results_with_trend` actualizada — trend real (up/flat/down) + checkin_count
- [x] Índices: `idx_checkins_kr_created`, `idx_key_results_last_checkin`, `idx_notifications_user`

### Backend
- [x] Módulo `check-ins`: CRUD check-ins, historial, at-risk, cadencia, predicción, notificaciones
- [x] Cron nightly: `CheckInCronService` con setInterval — llama `sp_mark_stale_krs_at_risk` por org
- [x] Notificación WS: WebSocket en tiempo real *(implementado en Hito 13)*
- [x] **MCP Tools**: `get_checkin_history`, `predict_completion`, `create_checkin` *(Hito 9)*
- [x] **Check-in Assistant** (`POST /ai/checkin-assistant`): contexto del KR + historial → Claude sugiere nota
- [x] **Risk Sentinel** completo: Claude prioriza y redacta alertas *(Hito 9)*

### Frontend
- [x] Check-in Drawer: valor actual + preview progreso, slider confianza con color dinámico, mood picker, notas + "Generar nota con IA", predicción si ≥2 check-ins
- [x] Historial de check-ins: gráfico Recharts LineChart + tabla con delta y mood
- [x] Feed de actividad del equipo: check-ins recientes en orden cronológico — `/checkins/feed`
- [x] Dashboard de cadencia: tabla KR × propietario con semáforo de días (verde/ámbar/rojo)
- [x] Notificaciones in-app: `NotificationsBell` en TopBar con badge + dropdown, marcar leídas
- [x] Vista de KRs en riesgo: `/checkins` con grid priorizado por impacto estratégico

### UX checkpoints
- [x] El Check-in Assistant tiene un botón "Generar nota con IA" claro — no actúa sin clic
- [x] La predicción muestra la fecha proyectada ("si sigues a este ritmo, alcanzarás el objetivo en...")
- [x] El slider de confianza tiene etiquetas en los extremos ("Alto riesgo" / "Bajo riesgo")

**Estado**: ✅ COMPLETADO — 2026-04-23 | **Depende de**: Hito 5

---

## HITO 7 — Iniciativas y ejecución táctica
**Objetivo**: Los equipos vinculan proyectos concretos a sus KRs para gestionar la ejecución.

### Base de datos
- [x] Tablas: `initiatives`, `initiative_key_results` (M2M), `milestones`
- [x] Trigger `trg_initiative_progress_from_milestones` — AFTER INSERT/UPDATE de `milestones.status`: recalcula progress + auto-avanza status (TODO→IN_PROGRESS→DONE)
- [x] Trigger `trg_milestone_overdue_alert` — AFTER INSERT/UPDATE de `milestones.due_date/status`: inserta en `notifications` si vencido, con dedup
- [x] Trigger `trg_audit_log` en `initiatives`
- [x] Procedimiento `sp_create_initiative(org_id, cycle_id, team_id, owner_id, title, description, start_date, due_date, created_by, kr_ids[])` — crea la iniciativa y sus vínculos M2M
- [x] Procedimiento `sp_complete_milestone(milestone_id, user_id)` — marca completado y dispara recálculo de progreso
- [x] Función `fn_initiative_health(initiative_id)` → `{health, status, progress, days_overdue, completion_rate, blocking_milestones[]}`
- [x] Vista `v_initiative_timeline` — iniciativas con milestones JSONB, KRs JSONB, is_overdue, days_overdue
- [x] Vista `v_initiatives_by_kr` — iniciativas vinculadas a un KR con progreso
- [x] Vista `v_overdue_milestones` — milestones vencidos con responsable e impacto en KRs (JSONB)
- [x] Índices: `idx_initiatives_org`, `idx_initiatives_team_cycle`, `idx_initiative_krs_kr`, `idx_milestones_due_date`

### Backend
- [x] Módulo `initiatives`: CRUD completo, milestones CRUD, link/unlink KRs, `/health`, vistas
- [ ] Cron diario para overdue milestones *(actualmente vía trigger en tiempo real)*
- [x] **MCP Tools**: `list_initiatives_by_kr`, `get_initiative_timeline`, `flag_initiative_at_risk` *(Hito 11)*

### Frontend
- [x] Vista kanban de iniciativas por equipo (To Do / In Progress / Done)
- [x] Vista de iniciativas de un KR específico (en el drawer del check-in y hook `useKrInitiatives`)
- [x] Formulario de iniciativa: título, descripción, responsable, fechas, KRs vinculados (multi-select con buscador)
- [x] Milestones en modo lista con checkbox de completado y fecha
- [x] Alerta visual en iniciativas vencidas (borde rojo, badge "hitos vencidos", icono AlertCircle)

### Modo tradicional
- [x] Vista Gantt de iniciativas (timeline horizontal con milestones como puntos marcados)
- [x] Color de Gantt: en tiempo (azul) / en riesgo (ámbar) / retrasado (rojo) / completada (verde)

### UX checkpoints
- [x] La vinculación Initiative → KR es un multi-select con buscador (en formulario de creación)
- [x] El Gantt tiene hover sobre milestone mostrando título y fecha (via title attribute)

**Estado**: ✅ COMPLETADO — 2026-04-23 | **Depende de**: Hito 6

---

## HITO 8 — Modo ágil: Sprints y cadencia
**Objetivo**: Los equipos Scrum vinculan sus sprints al ciclo OKR, cerrando el loop entre objetivos y ejecución ágil.

### Base de datos
- [x] Tablas: `sprint_cycles`, `sprint_goal_krs` (M2M con `expected_contribution`)
- [x] Trigger `trg_validate_sprint_org_mode` — BEFORE INSERT en `sprint_cycles`: rechaza si la org no es AGILE o HYBRID
- [x] Trigger `trg_validate_sprint_dates` — BEFORE INSERT: valida que las fechas del sprint estén dentro del ciclo OKR padre
- [x] Trigger `trg_single_active_sprint_per_team` — BEFORE INSERT: máximo un sprint ACTIVE por equipo
- [x] Procedimiento `sp_close_sprint(sprint_id, velocity, user_id)` — marca COMPLETED, guarda velocidad real, prepara lista de check-ins sugeridos para KRs vinculados (no los crea — el usuario confirma)
- [x] Función `fn_sprint_okr_impact(sprint_id)` — retorna: KRs vinculados + progreso antes/después del sprint + contribución real vs esperada
- [x] Función `fn_calculate_burnup(cycle_id, team_id)` — retorna series de datos: progreso acumulado por sprint vs línea ideal
- [x] Vista `v_sprint_board` — iniciativas del sprint en columnas con sprint goal y KRs vinculados
- [x] Vista `v_sprint_velocity` — histórico de velocidad planeada vs real por sprint
- [x] Vista `v_cycle_sprint_timeline` — todos los sprints del ciclo en línea de tiempo
- [x] Índices: `idx_sprints_cycle_team`, `idx_sprint_goal_krs_sprint`

### Backend
- [x] Módulo `sprints`: llama `sp_close_sprint`, `fn_sprint_okr_impact`, vistas
- [x] Toda validación de modo y fechas en triggers — el servicio no valida
- [x] **MCP Tools**: `list_sprints` → vista, `get_sprint_okr_impact` → función, `close_sprint_with_checkins` → procedimiento *(Hito 11)*

### Frontend
- [x] Sprint Board: kanban de iniciativas del sprint activo + sprint goal visible + KRs vinculados
- [x] Burn-up de OKRs por sprint: gráfico de progreso acumulado sprint a sprint (Recharts)
- [x] Línea de proyección ideal (target) vs progreso real
- [x] Wizard de cierre de sprint: review de KRs afectados + confirmación de check-ins propuestos
- [x] Vista de velocidad: gráfico de barras plannedVelocity vs real por sprint
- [x] Timeline del ciclo: todos los sprints en una línea de tiempo horizontal

### UX checkpoints
- [x] El burn-up muestra visualmente si el equipo está por encima o debajo del ideal
- [x] El wizard de cierre de sprint es conversacional: un KR a la vez, no un formulario complejo

**Estado**: ✅ COMPLETADO — 2026-04-23 | **Depende de**: Hito 7

---

## HITO 9 — AI Agents completos + MCP Tools avanzados
**Objetivo**: Todos los agentes de IA están operativos y las herramientas MCP avanzadas funcionan. La app se vuelve inteligente.

### MCP Tools avanzadas
- [x] `predict_completion(keyResultId)` — regresión lineal sobre historial de check-ins
- [x] `compare_periods(cycleId1, cycleId2)` — `fn_compare_cycles` en DB + MCP tool
- [x] `run_scenario(keyResultId, assumptions)` — `fn_run_scenario` en DB: 3 escenarios
- [x] `generate_executive_summary(cycleId, periodType)` — Claude genera el briefing
- [x] `generate_okr_suggestions(context)` — Claude propone OKRs para el siguiente ciclo
- [x] Audit log completo: `v_mcp_audit_summary` + audit en cada tool call
- [x] Rate limiting por plan (FREE:50/día, BASIC:100/día, PRO:1000/día) con Redis

### Strategy Advisor (AI Chat completo)
- [x] Interfaz de chat en `/ai-assistant` con historial de conversaciones
- [x] Acceso a contexto del ciclo activo (objetivos, KRs en riesgo)
- [x] Historial de conversaciones persistido por ciclo (`ai_conversations`)
- [x] @ menciones de OKRs en el chat (dropdown con objetivos del ciclo activo)
- [x] Acciones sugeridas como chips clicables (navegan a la sección relevante)
- [x] Referencia de fuentes: cada respuesta muestra qué datos consultó

### Risk Sentinel (cron completo)
- [x] Cron nightly 2am: escaneo completo de KRs de toda la plataforma
- [x] Priorización por impacto: KR de nivel COMPANY > AREA > TEAM
- [x] Email digest automático al owner de la org cuando hay KRs en riesgo
- [x] Dashboard de riesgos: `/reports/risk-dashboard`

### Executive Briefer (cron completo)
- [x] Cron Monday 8am: genera resumen semanal por organización
- [x] Email HTML con: score, progreso del ciclo, highlights, riesgos, próximos pasos
- [x] Vista en app: `/reports/executive-briefing` con el briefing de la semana
- [ ] Al cerrar ciclo: reporte de cierre completo (diferido a Hito 10)

### Alignment Auditor (completo)
- [x] Endpoint manual `POST /ai/alignment-audit` + almacenado en `ai_briefings`
- [x] Reporte de alineación con índice numérico (0-100) y lista de brechas
- [x] Disparo automático al activar ciclo y al crear objetivo de equipo
- [ ] Sugerencia de OKRs de equipo faltantes para cubrir brechas (diferido a Hito 10)

**Estado**: ✅ COMPLETADO — 2026-04-24 | **Depende de**: Hito 8

---

## HITO 10 — Reportes y dashboards ejecutivos
**Objetivo**: La dirección tiene visibilidad completa del plan estratégico en tiempo real.

### Base de datos
- [x] Vista `v_executive_dashboard` — heat map por nivel, KRs en riesgo top 5, score
- [x] Vista `v_cycle_health` — distribución de estados, confianza promedio, proyección de cierre
- [x] Vista `v_team_health` — radar por equipo: cadencia × confianza × progreso
- [x] Vista `v_portfolio_dashboard` — iniciativas con Gantt por equipo
- [x] Vista `v_weekly_trend` — progreso del ciclo semana a semana (8 semanas)
- [x] Función `fn_generate_cycle_close_report(cycle_id, org_id)` — JSON completo del reporte de cierre
- [x] Función `fn_compare_cycles(cycle_id_1, cycle_id_2)` — ya existía desde Hito 9
- [x] Tabla `cycle_close_reports` — snapshots inmutables con UNIQUE(cycle_id)
- [x] 4 índices de performance sobre check_ins, initiatives, objectives, close_reports

### Backend
- [x] Módulo `reports` extendido: 7 nuevos endpoints — cero lógica TypeScript
- [x] Dashboard ejecutivo, cycle health, team health, portfolio, weekly trend
- [x] Reporte de cierre: `POST /reports/close-report/:cycleId`
- [x] Export CSV: `GET /reports/export-csv/:cycleId` — RFC-4180, stream directo
- [ ] Generación de PDF con puppeteer — diferido a fase 2

### Reportes exportables
- [x] Export CSV: todos los KRs con progreso, valores, check-ins y responsables
- [x] Reporte de cierre en JSON con top performers y needs improvement
- [ ] PDF con puppeteer — diferido
- [ ] Presentación ejecutiva slide-ready — diferido

### Vistas modo tradicional
- [x] Gantt de iniciativas por equipo con barras de tiempo y estado visual
- [ ] Calendario de hitos próximos 30 días — diferido a Hito 11

### UX checkpoints
- [x] Heat map usa color + número para cada nivel
- [x] Radar de equipos con 4 dimensiones: progreso, confianza, cadencia, cobertura

**Estado**: ✅ COMPLETADO — 2026-04-24 | **Depende de**: Hito 9

---

## HITO 11 — Seguridad, performance y calidad
**Objetivo**: El sistema cumple con los más altos estándares técnicos antes del despliegue en producción.

### Seguridad
- [x] Auditoría OWASP Top 10: SQL injection (parameterized queries), XSS (HttpOnly cookies), CSRF (sameSite: strict), auth (JWT rotation), logging seguro
- [x] Headers de seguridad: HSTS (producción, 1 año + preload), X-Content-Type-Options, X-Frame-Options, Permissions-Policy vía Helmet
- [x] Row Level Security de PostgreSQL: `fn_check_org_context`, RLS en 7 tablas con FORCE ROW LEVEL SECURITY, política `org_isolation`
- [x] MCP audit log inmutable: triggers `trg_mcp_audit_immutable` + `trg_ai_briefings_immutable` → ERRCODE 55000 en UPDATE/DELETE
- [x] Cookie seguridad: `sameSite: strict`, `httpOnly: true`, `secure` en producción
- [x] `err: unknown` en mapDbError — sin leakage de tipos en catch blocks
- [x] Swagger UI sólo en desarrollo (`!isProd`) — no expuesto en producción

### Performance
- [x] Redis cache en 4 dashboards pesados (executive-dashboard, cycle-health, team-health, portfolio) — TTL 300s, `getOrSet` con fallback si Redis no disponible
- [x] Invalidación de cache en `generateCloseReport` vía `delPattern('reports:*:orgId:*')`
- [x] 8 índices de performance para queries del dashboard ejecutivo, v_at_risk_krs, v_weekly_trend, v_portfolio_dashboard
- [x] Web Vitals tracking en frontend via `useReportWebVitals` + opción de forwarding a analytics endpoint
- [x] Bundle Analyzer integrado (`ANALYZE=true npm run build`) para control de bundle size

### Calidad
- [x] Tests unitarios (Jest + ts-jest): 18 tests en 3 suites — AuthService, ReportsService (cache behavior, getCycleHealth, getRiskDashboard, invalidación), AiService (isReady, generateText null safety)
- [x] Tests E2E (Playwright): configurados en `frontend/e2e/` — auth flow (redirect, login form, validation, invalid credentials, register), OKR flow (dashboard, objectives, create form, reports)
- [x] Swagger API docs: `@nestjs/swagger` instalado, SwaggerModule en main.ts, `@ApiTags` + `@ApiCookieAuth` en controllers auth y reports
- [x] `DbService.withOrgContext()` — helper para activar contexto RLS en queries que lo requieran
- [x] `RedisService` extendido: `del`, `delPattern` (con batching 100-keys), `getOrSet<T>` con retry transparente

**Estado**: ✅ COMPLETADO — 2026-04-24 | **Depende de**: Hito 10

---

## HITO 12 — Despliegue y producción
**Objetivo**: Sistema en producción, monitoreable, con CI/CD y documentación para operación.

### Infraestructura
- [x] PM2 en cluster mode — `ecosystem.config.js` con restart automático y merge de logs
- [x] Nginx como reverse proxy con SSL hardening, HSTS, CSP, rate limiting — `nginx/`
- [x] PostgreSQL y Redis instalados directamente en servidor — ver `INSTALL.md`
- [x] `.env.example` con todos los secrets documentados (CHANGE_ME)
- [x] DNS + HTTPS + SSL con Let's Encrypt — instrucciones en `INSTALL.md` paso 13
- [x] Backup automático de PostgreSQL diario con retención 30 días — `scripts/backup.sh`

### CI/CD
- [x] GitHub Actions: typecheck + lint + test + build en backend y frontend — `.github/workflows/ci.yml`
- [x] Deploy automático al merge en `main` via SSH con `appleboy/ssh-action`
- [x] Migraciones SQL automáticas en el pipeline — `scripts/migrate.sh apply`

### Observabilidad en producción
- [x] Logs estructurados en JSON (level, msg, ctx, ts) en producción — `main.ts`
- [x] Health check `GET /api/v1/health` verifica PostgreSQL + Redis
- [x] Web Vitals tracking en frontend con forwarding opcional
- [ ] Alertas externas (UptimeRobot/BetterUptime) — configurar en el panel del proveedor con `/api/v1/health`

### Operación
- [x] Runbook completo — `INSTALL.md` §15-18: mantenimiento, actualizaciones, backup, troubleshooting
- [x] Swagger UI en `/api/docs` solo en development
- [x] CHANGELOG con todos los hitos completados — `CHANGELOG.md`

**Estado**: ✅ COMPLETADO — 2026-04-24 | **Depende de**: Hito 11

---

## Resumen de hitos

| # | Hito | Objetos DB creados | IA involucrada | Estado |
|---|------|--------------------|----------------|--------|
| 0 | Design System & UX Foundation | — | — | ✅ 2026-04-22 |
| 1 | Fundaciones + Auth + MCP base | tablas base, `sp_register_user`, `sp_refresh_token`, `trg_audit_log`, `trg_updated_at`, `trg_soft_delete` | MCP base | ✅ 2026-04-22 |
| 2 | Multi-tenancy + Onboarding | `sp_create_organization`, `sp_invite_user`, `v_team_tree`, `fn_user_belongs_to_org` | — | ✅ 2026-04-22 |
| 3 | Ciclos OKR | `sp_activate_cycle`, `sp_close_cycle`, `v_cycles_with_stats`, `fn_get_cycle_score`, `trg_validate_single_active_cycle` | MCP tools base | ✅ 2026-04-22 |
| 4 | OKRs estratégicos + OKR Coach | `sp_create_objective`, `sp_create_key_result`, `v_objectives_with_progress`, `v_key_results_with_trend`, `fn_calculate_*`, `fn_validate_okr_quality`, triggers de límites | **OKR Coach** ✅ | ✅ 2026-04-23 |
| 5 | OKRs tácticos + Diagnóstico Org | `v_team_objectives`, `v_my_objectives`, triggers de alineación y permisos, `organizational_problems`, `strategic_intents`, `problem_intents` | Alignment Auditor *(diferido)* | ✅ 2026-04-23 |
| 6 | Check-ins + progreso + Check-in Assistant | `check_ins`, `notifications`, `sp_create_check_in`, `sp_mark_stale_krs_at_risk`, `v_check_in_history`, `v_at_risk_krs`, `v_cadence_dashboard`, `fn_predict_kr_completion`, `trg_checkin_cascade_recalc` | **Check-in Assistant** ✅ · Risk Sentinel *(diferido)* | ✅ 2026-04-23 |
| 7 | Iniciativas y ejecución táctica | `initiatives`, `milestones`, `sp_create_initiative`, `sp_complete_milestone`, `v_initiative_timeline`, `fn_initiative_health`, `trg_initiative_progress_from_milestones` | — | ✅ 2026-04-23 |
| 8 | Modo ágil (Sprints) | `sprint_cycles`, `sp_close_sprint`, `fn_sprint_okr_impact`, `fn_calculate_burnup`, `v_sprint_board`, `v_sprint_velocity` | — | ✅ 2026-04-23 |
| 9 | AI Agents completos + MCP avanzado | `fn_compare_cycles`, `fn_run_scenario`, `fn_get_alignment_gaps`, `ai_briefings`, `ai_conversations`, `v_mcp_audit_summary` | **Todos los agentes** operativos, 19 MCP tools, cron + email digest, rate limiting Redis, @ menciones, action chips | ✅ 2026-04-24 |
| 10 | Reportes + Dashboards ejecutivos | `v_executive_dashboard`, `v_cycle_health`, `v_team_health`, `v_portfolio_dashboard`, `v_weekly_trend`, `fn_generate_cycle_close_report`, `cycle_close_reports` | Dashboard ejecutivo, heat map, radar equipos, Gantt portfolio, CSV export, reporte cierre | ✅ 2026-04-24 |
| 11 | Seguridad, performance y calidad | `fn_check_org_context`, RLS en 7 tablas, `fn_prevent_audit_modification`, 8 índices de performance, `v_mcp_audit_summary` | Web Vitals tracking | ✅ 2026-04-24 |
| 12 | Despliegue y producción | `_sql_migrations` | Web Vitals + JSON logging | ✅ 2026-04-24 |

| 13 | Enterprise completeness | `user_profiles`, `user_mfa_secrets`, `login_attempts` | WebSockets, MFA, PDF, GDPR | ✅ 2026-04-24 |

**Progreso**: 13 de 13 hitos completados (Hitos 0–13). ✅ Sistema completo.

---

## HITO 13 — Enterprise completeness
**Objetivo**: Cerrar los gaps que separan el sistema de un SaaS enterprise completo: autenticación avanzada, tiempo real, exportación ejecutiva y compliance.

### Base de datos
- [x] Tabla `user_profiles` — timezone, locale, preferencias de notificación
- [x] Tabla `user_mfa_secrets` — secreto TOTP por usuario (cifrado en BD)
- [x] Tabla `login_attempts` — registro de intentos fallidos por email/IP
- [x] Procedimiento `sp_update_user_profile(user_id, timezone, locale, notify_at_risk, notify_checkin_reminder)`
- [x] Función `fn_check_login_attempts(email)` → `{is_locked, attempts, locked_until}`
- [x] Trigger `trg_reset_login_attempts` — limpia intentos al hacer login exitoso
- [x] Procedimiento `sp_revoke_all_tokens(user_id)` — cierra todas las sesiones activas
- [x] Procedimiento `sp_export_user_data(user_id)` → JSONB con todos los datos del usuario
- [x] Procedimiento `sp_anonymize_user(user_id)` — GDPR: anonimiza datos en todas las tablas
- [x] Vista `v_security_audit` — últimos 100 eventos de seguridad para OWNER/ADMIN

### Backend
- [x] `NotificationsGateway` — WebSocket gateway (Socket.io) con rooms `user:{userId}` y `org:{orgId}`
- [x] MFA endpoints: `POST /me/mfa/setup`, `POST /me/mfa/enable`, `POST /me/mfa/disable`
- [x] Login flow actualizado: bloqueo por intentos fallidos (5 en 15 min → lockout 15 min)
- [x] `POST /auth/logout-all` — revoca todos los refresh tokens del usuario
- [x] `GET /me/profile` + `PATCH /me/profile` — perfil de usuario
- [x] `GET /me/export-data` — GDPR export como JSON attachment
- [x] `DELETE /me/account` — anonimización GDPR + cierre de sesión
- [x] `GET /reports/security-audit` — para OWNER/ADMIN
- [x] `GET /reports/export-pdf/:cycleId` — reporte ejecutivo en PDF (pdfkit)
- [x] Emitir evento WebSocket tras crear check-in (`checkin:created`) al room de la org

### Frontend
- [x] Settings: pestaña **Perfil** — timezone, locale, preferencias de notificación
- [x] Settings: pestaña **Seguridad** — activar/desactivar MFA con QR code, "Cerrar todas las sesiones"
- [x] Settings: pestaña **Privacidad** — exportar mis datos (JSON), eliminar mi cuenta
- [x] Notificaciones en tiempo real: WebSocket (`socket.io-client`) reemplaza polling 60s
- [x] Reportes: botón "Descargar PDF" en dashboard ejecutivo y cycle health

**Estado**: ✅ COMPLETADO — 2026-04-24 | **Depende de**: Hito 12

> Excluido deliberadamente: SSO/OAuth (requiere registro externo de app), Stripe/billing (decisión de negocio), detección de login sospechoso por IP/geo (requiere DB externa de geolocalización).

---

> Cuando se complete un hito: marcar los ítems con ✅, cambiar Estado a "Completado", y actualizar la tabla de resumen antes de avanzar al siguiente.

---

## Mejoras Post-Hito (mejoras incrementales post Hito 13)

### Templates estructurados en formularios de artefactos
**Completado**: 2026-05-08

Todos los formularios de creación de artefactos tienen un template pre-cargado en el campo descripción para guiar al usuario a escribir descripciones de alta calidad. El template se descarta automáticamente si el usuario no lo modifica antes de guardar.

| Artefacto | Template |
|-----------|---------|
| Objetivo estratégico y táctico | `Contexto:\nResultado esperado:\nDependencias:` |
| Key Result | `Línea base:\nMétodo de medición:\nRiesgo principal:` |
| Iniciativa | `Problema que resuelve:\nAlcance:\nCriterio de éxito:` |
| Sprint | `Meta:\nCapacidad del equipo:\nRiesgo identificado:` |

Los prompts del OKR Coach AI también se actualizaron para devolver sugerencias con el mismo formato estructurado.

### Códigos de artefacto visibles en UI (badges)
**Completado**: 2026-05-08

Todos los listados, tarjetas y vistas muestran el código de artefacto (ej. `OBJ-1`, `KR-3`, `INI-2`) antes del título, usando el patrón tipográfico `text-[10px] font-mono font-semibold text-muted-foreground`. Páginas actualizadas: `/strategic`, `/tactical`, `/problems`, `/strategy`, `/backlog`, `/initiatives`, `/sprints` (SprintBoard), Gantt, KRCard, InitiativeDrawer.

### Pantalla de bienvenida personalizada (`/welcome`)
**Completado**: 2026-05-08

Pantalla post-login con:
- Saludo adaptado a la hora del día ("Buenos días/tardes/noches [nombre]")
- Estado del ciclo activo con barra de progreso y días restantes
- Sección "Requiere tu atención": check-ins pendientes + KRs en riesgo
- "Mis objetivos activos" con progreso individual
- "Agenda de gobierno": próximos eventos de gobernanza en los siguientes 14 días
- "Estado organizacional": métricas clave de la org
- Links rápidos a las secciones principales

El login redirige a `/welcome` en lugar de `/strategic`.

**Backend**: `GET /api/v1/reports/welcome-context` — `reports.service.ts::getWelcomeContext()` — usa 7 queries SELECT en paralelo (`Promise.all`). No requiere migración pendiente.

### Gobierno OKR — Agenda de gobernanza (`/reports/governance`)
**Completado**: 2026-05-08

Página de calendario de gobernanza con:
- **7 tipos de eventos** generados automáticamente por ciclo: KICKOFF, CHECK_IN_HEALTH, MID_REVIEW, CYCLE_REVIEW, RETROSPECTIVE, STRATEGIC_REVIEW (ciclos anuales), ANNUAL_PLANNING (ciclos anuales)
- **Estado inteligente**: UPCOMING / IN_PROGRESS / COMPLETED / OVERDUE — calculado en base a fechas reales y datos del ciclo (objetivos creados, health de check-ins, ciclo cerrado)
- **3 horizontes de vista**: Trimestral (±4 meses), Anual (±15 meses), 3 Años (±48 meses)
- **Filtro por estado** y agrupación por mes
- Tarjeta expandible con descripción, entregable, responsable y frecuencia de cada evento

**Backend**: `GET /api/v1/reports/governance?horizon=ANNUAL` — `reports.service.ts::getGovernanceCalendar()` — lógica de generación de eventos en TypeScript con SELECTs simples sobre `cycles`. No requiere migración pendiente.

**Sidebar**: ítem "Gobierno OKR" con `ShieldCheck` en grupo `org`. Visible para ADMIN, MANAGER y VIEWER.
**Reports index** (`/reports`): card de acceso al Gobierno OKR.

#### Migración 028 — pendiente de aplicar con superusuario
El archivo `backend/src/database/migrations/028_governance_calendar.sql` contiene las funciones PostgreSQL equivalentes (`fn_governance_calendar`, `fn_welcome_context`) para cumplir la regla database-first. No se pudo aplicar porque `okr_user` carece de permiso `CREATE FUNCTION` en el esquema `public`. La lógica equivalente está implementada en TypeScript como workaround funcional.

Para aplicar cuando se tenga acceso al superusuario de PostgreSQL:
```powershell
.\scripts\migrate-dev.ps1
# introducir password del usuario postgres cuando se solicite
```

---

### Multi-empresa + Onboarding rediseñado + Settings jerárquico
**Completado**: 2026-05-09

#### Multi-empresa
- `sp_create_organization`: eliminado check global de email — el modelo correcto es `UNIQUE(organization_id, email)`. Una persona puede pertenecer a múltiples empresas con el mismo email.
- `sp_validate_login`: añadido `ORDER BY created_at ASC LIMIT 1` para seleccionar la org más antigua cuando el mismo email existe en varias.
- `auth.service.ts`: `mapDbError` actualizado para capturar `users_organization_id_email_key` (constraint correcto) en lugar de `EMAIL_ALREADY_EXISTS`.
- `EmpresasTab.tsx`: eliminado botón "Cambiar" (generaba confusión — el usuario pensaba que movía datos entre empresas).

#### Onboarding 4 pasos (flujo organizacional)
Flujo rediseñado: **Bienvenida → Estructura (Áreas + Gobierno) → Equipos → Miembros → Listo**
- Paso 1: Chips preset de áreas (RRHH, TI, Finanzas, etc.) + opción de área personalizada + toggle opcional de cuerpo de gobierno.
- Hooks usados: `useCreateArea`, `useCreateGovernanceBody`.
- Bug corregido: índices erróneos en `Promise.allSettled` al mapear resultados de invitaciones — ahora usa `Map<email, result>`.

#### Settings con navegación jerárquica
- Reemplazadas pestañas horizontales por sidebar de dos niveles.
- **Empresa activa**: Configuración · Gobierno · Áreas · Equipos · Usuarios · Permisos.
- **Mis Empresas** (solo OWNER).
- **Mi Cuenta**: Perfil · Seguridad · Privacidad.
- **Sistema**: Monitoreo.
- `OrgTab` reducida a solo configuración de empresa (nombre, slug, modo).
- `UsersTab` nueva: miembros + invitaciones (extraída de OrgTab).
- `TeamsSettingsPanel` nuevo componente en `components/settings/`.
- Equipos eliminados del sidebar principal → redirigen a `/settings?tab=teams`.
- `PermissionsTab`: corregido cast de tipo `(org?.settings as any)` → `Record<string, unknown>`.

### Mejoras UX/Sprint/Búsqueda — Sesión 2026-05-11
**Completado**: 2026-05-11

#### Sprint — Generación automática
- `POST /api/v1/sprints/generate` — endpoint nuevo en `SprintsController` (ANTES del `@Post()` genérico para evitar conflicto de ruta)
- `GenerateSprintsDto`: `cycle_id`, `team_id`, `sprint_length_weeks` (1-4), `planned_velocity?`, `start_from?`
- `SprintsService.generate()`: genera hasta 52 sprints, ancla a fechas del ciclo, divide equitativamente
- `GenerateSprintsDialog.tsx` (`components/sprints/`) — selección de equipo, botones 1-4 semanas, preview en vivo, warning si hay sprints PLANNING existentes
- `useGenerateSprints` hook en `hooks/useSprints.ts`

#### Sprint Board — Tarjetas estilo Jira
- `StoryCard` rediseñada: borde izquierdo de color por prioridad, indicador AC readiness (verde/rojo), status editable inline
- STATUS_PILLS — 3 pastillas siempre visibles (Por hacer / En progreso / Completada) en lugar de botón lineal
- Botón ✏️ en hover de la tarjeta abre `BacklogItemDialog` para editar historia sin salir del tablero
- Cadena: `SprintBoardView.onEdit → StoryCard.onEdit → sprints/page.tsx → BacklogItemDialog`

#### Backlog — Componentes compartidos extraídos
- `components/backlog/BacklogItemDialog.tsx` — dialog de creación/edición compartido entre `/backlog` y `/sprints`
- `components/backlog/backlog-config.ts` — constantes y helpers compartidos: `TYPE_CONFIG`, `PRIORITY_CONFIG`, `STATUS_CONFIG`, `STORY_POINTS`, templates de descripción/AC, hints

#### Bugs corregidos
| Bug | Fix |
|-----|-----|
| Al editar historia para quitar padre, presionar Guardar no hacía nada | `parent_id: form.parent_id \|\| null` (no `undefined`) — `null` envía explícitamente NULL al backend, `undefined` omite el campo |
| "property type should not exist" al guardar edición | `type` excluido del payload cuando `editing` es verdadero: `...(!editing && { type: form.type })` |

#### Performance — Frontend
- Causa raíz de lentitud extrema: `next dev` recompila cada página en caliente (~16s por visita)
- Solución: build de producción + `next start` → 98ms por petición (mejora 160×)
- `next.config.ts`: eliminado `output: 'standalone'` (incompatible con `next start` sin Nginx para servir `/_next/static`); añadido `compress: true`, `poweredByHeader: false`, `optimizePackageImports` para lucide-react, radix-ui, recharts
- `D:\estrategia\frontend-start.config.js` — PM2 config usando `node_modules/next/dist/bin/next` (no `.bin/next` — es bash script, falla en Windows)

#### Menú — Restructura en 5 grupos (con puntos de color)
Reorganización del sidebar de 4 grupos planos a 5 grupos semánticos con indicador de color:
- **Estrategia** (azul): Diagnóstico, Estrategia, Ciclos, OKRs, Trazabilidad — Ciclos movido desde Planificación
- **Táctico** (violeta): OKRs Tácticos, Check-ins, Iniciativas
- **Operativo** (verde): Entregables, Backlog, Sprints
- **Análisis** (ámbar): Reportes, Gobierno OKR
- **Sistema** (gris): IA Asistente, Configuración

#### Búsqueda global — Command Palette (Ctrl+K)
- Migration `039_global_search.sql` — función `fn_global_search(org_id, query, limit)`: UNION ALL sobre objectives, backlog_items, initiatives, cycles con ILIKE + `ts_rank`. Retorna: `id, title, subtitle, type_key, category, href`
- `backend/src/modules/search/` — `SearchModule`, `SearchController` (`GET /search?q=`), `SearchService`
- `frontend/src/hooks/useGlobalSearch.ts` — hook con debounce 280ms, `enabled` si `q.length >= 2`
- `frontend/src/components/layout/GlobalSearchDialog.tsx` — Command Palette completo via `createPortal`:
  - Trigger en TopBar (visual, no input funcional) + atajo `Ctrl+K` / `Cmd+K` global
  - Sin query: grid de 8 accesos rápidos con iconos de color
  - Con query: skeleton loader → resultados agrupados por categoría (OKRs / Backlog / Iniciativas / Ciclos)
  - Teclado completo: `↑↓` navegar, `Enter` abrir, `Esc` cerrar
  - Footer con hints de teclado

---

### Auditoría QA + corrección de deuda técnica
**Completado**: 2026-05-09

Auditoría completa de frontend, backend y base de datos. Hallazgos y correcciones:

#### Errores TypeScript corregidos (0 errores tras la sesión)
- `backlog/page.tsx`: `FilterToggle` no importado → extraído a `components/shared/FilterToggle.tsx`, importado en `backlog` y `checkins`.
- `initiatives/page.tsx`: tipo de `prefill` demasiado estrecho → extendido con `primary_area`, `involved_areas`, `suggested_dependencies`.
- `useInitiatives.ts`: `useCreateInitiative` DTO extendido con `primary_area_id` y `involved_area_ids`.
- `GovernancePanel.tsx`: `useState<string>` para tipo de cuerpo → `useState<GovernanceBody["type"]>` con `BODY_TYPES` tipado como literal union.
- `onboarding/page.tsx`: `govType` tipado como union literal, `sort_order` eliminado del `useCreateArea` call.

#### Bugs de lógica corregidos
| Severidad | Archivo | Bug | Fix |
|-----------|---------|-----|-----|
| HIGH | `onboarding/page.tsx` | Índices erróneos al mapear `Promise.allSettled` vs invites totales — estados se asignaban al invite incorrecto | `Map<email, result>` en lugar de índice posicional |
| HIGH | `GovernancePanel.tsx` | `handleAdd()` sin try/catch — errores de agregar miembro silenciosos | `try/catch` + estado `addError` + display en UI |
| MEDIUM | `useAreas.ts` | `useRemoveTeamFromArea` tipado como `api.delete<Area>` en vez de `api.delete<void>` | Corregido tipo de retorno |
| MEDIUM | `useGovernance.ts` | `type: string` en DTOs de mutación — acepta valores fuera del enum | `type: GovernanceBody["type"]` en create/update |
| MEDIUM | `api-client.ts` | Sin tipo exportado para errores de API — todos los catch usaban `any` | Exportado `ApiError` interface |
| MEDIUM | `MonitorTab.tsx` | Cast `agent.status as StatusLevel` sin validación — crash con valor desconocido | `VALID_STATUS_LEVELS` Set con fallback a `"unknown"` |
| MEDIUM | `AreasPanel.tsx` | `allTeams.filter((t: any) => !t.area_id)` — `TeamNode` no tiene `area_id`, mostraba equipos ya asignados a otras áreas | Construye `allAssignedIds` desde `useAreas()` |
| LOW | `settings/page.tsx` | `(org?.settings as any)` en PermissionsTab | `Record<string, unknown>` con narrowing explícito |

#### Verificación de arquitectura (sin cambios — todo correcto)
- Guard global `JwtAuthGuard` registrado como `APP_GUARD` en `app.module.ts` → todos los controllers protegidos sin necesidad de decorator por ruta.
- Todas las vistas y procedimientos SQL referenciados en TypeScript existen en las migraciones.
- `switchOrg`: `org_id` del body es correcto — el service valida acceso por `(email, org_id)` en DB.

#### Migraciones
- Renombradas migraciones con número duplicado: `014_pending_items.sql` → `014b_pending_items.sql`, `029_governance_activities.sql` → `029b_governance_activities.sql`.
- Migración 032: `v_initiative_timeline` extendida con `primary_area_id`, `primary_area_name`, `primary_area_color`, `involved_areas` (JSONB), `dependencies` (JSONB), `open_dependencies_count`. `v_sprint_board` correctamente recreada tras DROP CASCADE.

---

### Telegram + Trial UX — Sesión 2026-05-12
**Completado**: 2026-05-12

- `TelegramService` global en `src/common/telegram/` — HTML, barras de progreso ▓░, `esc()`, `bar()`
- `ai-cron.service.ts` — 4 crons con alertas Telegram: Risk Sentinel, Executive Briefer, Check-in Reminder (jueves 10am), Cycle Closure (diario 9am)
- `scripts/super-agent.js` — reescrito con HTML, inline keyboard en `/status` y `/agents`, callback_query handler
- Los 3 scripts de agentes leen `.env.dev` como primera opción
- Trial: `TrialCountdownBanner` en `/welcome`, secciones ocultas en settings, redirect a `/onboarding` al registrar
- OrgSwitcher: usa `/auth/my-orgs` (no `/admin/organizations` — era bug de seguridad)
- EmpresasTab: plan correcto, trial countdown badge
- Monitor tab: port dinámico desde `FRONTEND_URL`, PM2 `startsWith()` para dev suffix, live check > stale state

---

## BACKLOG — Pendientes para lanzamiento comercial
> Actualizado: 2026-05-12. Ordenado por impacto en capacidad de venta.

### 🔴 Prioridad 1 — Bloqueantes comerciales

- [x] **Pasarela de pago** — Stripe + MercadoPago integrados. Migration 042 (billing_events, sp_apply_billing_upgrade, v_plan_limits). Módulo `billing` NestJS con checkout, webhooks idempotentes y Customer Portal. `STRIPE_SECRET_KEY`/`MP_ACCESS_TOKEN` activados desde env.
- [x] **Conversión trial → pago** — `/pricing` (pública), `/upgrade` (con toggle mensual/anual, ahorro -17% anual), `/upgrade/success`. TrialBanner en AppShell linkeado a /upgrade con urgencia visual en los últimos 2 días.
- [x] **Sentry (error tracking)** — `@sentry/nestjs` en backend (AllExceptionsFilter, solo 5xx) + `@sentry/nextjs` en frontend (global-error, instrumentation, onRequestError). Activa solo con `SENTRY_DSN` en env. Source maps en CI con `SENTRY_AUTH_TOKEN`.
- [x] **Password reset** — flujo completo implementado: `/auth/forgot-password` → email con link → `/auth/reset-password/[token]` → redirect a `/welcome`. En dev el link se loguea en consola (sin SMTP configurado).
- [x] **Invitación por email verificada** — flujo completo: `sp_invite_user` → email (con fallback `[DEV] Invitation link` en consola cuando SMTP falla) → `GET /auth/invitation?token` → `POST /auth/accept-invitation` → redirect a `/welcome`.

### 🟠 Prioridad 2 — Módulos por auditar

- [x] **Governance module** — auditado y corregido: `fn_governance_calendar` reconstruida con `is_custom` + UNION ALL de `governance_activities`. CRUD completo verificado.
- [x] **Delivery module** — auditado y corregido: vistas v_program_dashboard, v_phase_progress, v_deliverables_full, v_upcoming_deliverables renombradas/extendidas. PhaseStatus CANCELLED→ON_HOLD. owner_id añadido a delivery_phases.
- [x] **Areas module** — auditado y corregido: v_areas_with_teams GROUP BY a.id,u.name,u.avatar_url → GROUP BY a.id,u.id (fix de correctness).
- [x] **Reports module completo** — auditado: sin mismatches. v_at_risk_krs ya tiene kr_code/obj_code (migration 030). is_custom en fn_governance_calendar operativo. risk-dashboard line 336 es seguro (ternary guard).
- [x] **Mobile responsiveness** — auditado. Fix: mood buttons CheckInDrawer `flex-wrap` para evitar overflow en 320px. Grids 2/3 cols son correctos. Tables tienen overflow-x-auto. Sin regresiones.

### 🟡 Prioridad 3 — Features diferidas del roadmap

- [x] **Migration 028** — `fn_governance_calendar` + `fn_welcome_context` aplicadas con superusuario postgres. Verificado 2026-05-13.
- [x] **Alignment map extendido** — `v_alignment_map` COMPANY→AREA→TEAM→INDIVIDUAL + panel de cobertura visual.
- [x] **Executive Briefer al cerrar ciclo** — trigger automático de reporte de cierre cuando se cierra un ciclo.
- [x] **Sugerencias de OKRs de equipo** — Alignment Auditor sugiere OKRs faltantes para cubrir brechas.
- [x] **Calendario de hitos próximos 30 días** — vista en `/reports` con milestones que vencen pronto.

### 🟢 Prioridad 4 — UX y operación

- [~] **UptimeRobot/BetterUptime** — endpoint `/api/v1/health` implementado y público. Pendiente: crear monitor en UptimeRobot apuntando a `https://tudominio.com/api/v1/health`.
- [x] **Guía de inicio para el usuario** — mínimo: video de 5 min o guía de 5 páginas "cómo crear tu primer OKR". Reduce abandono en onboarding.
- [x] **PDF ejecutivo mejorado** — reemplazar pdfkit por puppeteer para reportes más visuales (charts, colores).
- [x] **Presentación ejecutiva** — export slide-ready del reporte de ciclo (PowerPoint o Google Slides via API).
- [x] **Migration 023** — aplicar `023_okr_user.sql` y actualizar `DATABASE_URL` a usar `okr_user` en vez de superusuario.

---

## AUDITORÍA EXPERTA — Sprint hacia primer cliente
> Identificado: 2026-05-13. Ordenado por impacto en capacidad de entregar a una empresa real.

### 🔴 Bloquea entrega comercial

- [x] **Páginas legales** — Crear `/terms` (Términos de servicio) y `/privacy` (Política de privacidad). Sin estas páginas no se puede cobrar suscripciones en ningún mercado. Mínimo: texto estándar SaaS adaptado. Agregar links en el footer de `/pricing`, `/upgrade`, `/auth/register` y en el onboarding.
- [x] **Stripe modo live** — Handlers `invoice.payment_failed` y `customer.subscription.updated` implementados. `.env.example` actualizado con guía paso a paso. **Acción manual pendiente**: crear productos en Stripe live, configurar webhook con los 5 eventos, pegar claves en `.env` de producción.
- [ ] **SMTP real en producción** — Contratar Resend (plan gratuito alcanza para empezar), verificar dominio remitente, configurar `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` en `.env`. Verificar que llegan: email de invitación, password reset, briefing semanal, alertas de riesgo.

### 🟠 Traducción incompleta

- [x] **`greeting()` en `welcome/page.tsx`** — Renombrada a `greetingKey()`, devuelve clave i18n. `TrialCountdownBanner`, `CycleSelector` y `WelcomePage` completos: 40+ strings + locales de fecha traducidos.
- [x] **`formatDate` locale hardcodeado en `tactical/page.tsx` y `welcome/page.tsx`** — Reemplazados con `useLocale()` de next-intl.
- [x] **`LEVEL_OPTIONS` sin traducir en `CreateObjectiveDialog` (strategic)** — Movido dentro del componente, usa `t("level.COMPANY")` etc.
- [x] **Aria-labels en español en filtros (strategic page)** — Claves `ariaFilterLevel`/`ariaFilterStatus` agregadas a ambos JSON y usadas en los `<select>`.
- [x] **Emails en español fijo** — `sendInvitation` y `sendPasswordReset` ahora reciben `locale?: string`. Callers en `auth.service.ts` y `organizations.service.ts` consultan `user_profiles.locale` y lo pasan. Strings en-/es- completos en `EMAIL_STRINGS` constante en `email.service.ts`.

### 🟡 Deuda técnica

- [x] **Tests insuficientes** — 296/296 tests en 13 suites (198 unit + 78 integrity + 20 HTTP). Flujos críticos cubiertos: check-ins+cascade, KR types INCREASE/DECREASE, billing webhook idempotente (15+ casos), auth completo login→refresh→logout. Objetivo 60+ superado.
- [x] **Playwright E2E — verificar que pasan** — Tests actualizados para reflejar rutas reales (`/auth/login`, `/auth/register`), labels i18n correctos y selectores robustos (`#email`, `#password`). 5/5 auth tests pasan. OKR tests requieren credenciales (`E2E_EMAIL`/`E2E_PASSWORD`) y están correctamente skipped sin ellas. Default port actualizado a 3001.
- [ ] **Verificar Migration 023 en producción** — El roadmap la marca `[x]` pero confirmar que `DATABASE_URL` en el `.env` de producción usa `okr_user` y no el superusuario `postgres`. Ejecutar `SELECT current_user;` desde la app para verificar.
- [x] **`setInterval` → `@nestjs/schedule`** — `check-in-cron.service.ts` migrado a `@Cron('0 1 * * *')`. `ai-cron.service.ts` ya usaba `@Cron`. `ScheduleModule.forRoot()` ya estaba en `app.module.ts`.
- [x] **Cache Redis no invalida en escritura** — `objectives.service.ts` llama `delPattern('reports:*:orgId:*')` en `create`, `update`, `cancel`. `check-ins.service.ts` llama `delPattern` en `create`. `RedisService` inyectado en ambos (global module, sin cambios en los .module.ts).
- [x] **`any` types restantes** — `getApiErrorMessage(err, fallback)` + `isApiError()` helpers en `api-client.ts`. Todos los `catch (err: any)` (26 ocurrencias en 14 archivos) migrados a `catch (err: unknown)`. 0 errores TS.

### 🟢 Operación y crecimiento

- [ ] **UptimeRobot** — Crear monitor HTTP en uptimerobot.com apuntando a `https://tudominio.com/api/v1/health`, cada 5 minutos. Configurar alerta a email/Telegram cuando caiga.
- [x] **Canal de soporte definido** — `NEXT_PUBLIC_SUPPORT_EMAIL` en `.env.example`. Email visible en sidebar (LifeBuoy icon) y en footer de `/upgrade`. Fallback a `soporte@sendoagil.com`. **Acción manual pendiente**: reemplazar `soporte@sendoagil.com` con el email real en `.env`.
- [x] **Documentación de usuario** — Hub `/docs` con 8 secciones: Ciclos, Equipos/roles, Crear OKRs, Check-ins, Agentes de IA, Dashboards, Governance, Configuración. Enlace en sidebar (BookOpen icon). Links bidireccionales con `/getting-started` y `/reports/guide`. 0 errores TS.
- [ ] **Login social (Google / Microsoft)** — No es bloqueante para el primer cliente, pero en empresas B2B la adopción se duplica cuando hay SSO disponible. Requiere registrar app en Google Cloud Console y Microsoft Azure AD. Backend: `passport-google-oauth20` + nuevo endpoint `/auth/google`. Diferido hasta tener demanda real.
- [x] **Templates de email en HTML** — Verificado: `email.service.ts` ya tiene templates HTML completos con header, CTA button y footer para: invitation, passwordReset, riskDigest, executiveBriefing, trialConfirmation. No plain text.

---

### Módulo de Acuerdos (`/agreements`)
**Completado**: 2026-05-20

Registra compromisos externos (junta, cliente, reguladores) y los conecta con la ejecución interna.

**Backend:**
- Migration `057_agreements.sql`: tabla `agreements`, tabla M2M `agreement_backlog_items`, vista `v_agreements`, `sp_create_agreement`, `fn_update_agreement`, triggers `code` y `updated_at`, 3 índices
- Módulo `AgreementsModule` en `src/modules/agreements/` — CRUD + `/stats` + `/items` link/unlink
- AI endpoint: `POST /ai/convert-agreement-epic` — analiza acuerdo + objetivos activos y sugiere épica alineada con Claude

**Frontend:**
- `hooks/useAgreements.ts` — tipos + queries + mutations + `useConvertAgreementToEpic()`
- `app/(app)/agreements/page.tsx` — lista con stats, filtros, formulario inline, `AgreementCard` con expand, `ConvertEpicDialog` (genera + confirma creación en backlog)
- Sidebar: ítem `agreements` (Handshake icon) en grupo `planning`, visible ADMIN/MANAGER

**Flujo estrella (demo conferencia):** Acuerdo → botón "Épica" → IA sugiere título/descripción/objetivo → usuario confirma → épica en backlog alineada al OKR

**Estimación de esfuerzo:**
| Tarea | Horas |
|-------|-------|
| DB + Backend | 4 h |
| Frontend (página + hooks) | 4 h |
| AI endpoint | 1.5 h |
| Total | ~10 h |

---

### Roadmap del Consultor (`/consultant-roadmap`)
**Completado**: 2026-05-20

Guía metodológica de implementación OKR para consultores con seguimiento de progreso por fase.

- 5 fases: Diagnóstico → Diseño estratégico → OKRs → Ejecución → Revisión y cierre
- Cada fase con: duración, horas consultor, actividades con links directos a las secciones del sistema
- Progress bar de engagement (% de fases completadas)
- Estado por fase persistido en `org.settings.consultant_phases` (sin migración adicional)
- Tabla de estimación de esfuerzo total: 40–60 h consultor / ciclo de 90 días
- Nota de demo: flujo de 5 min desde acuerdo hasta trazabilidad

**Estimación de esfuerzo:**
| Tarea | Horas |
|-------|-------|
| Diseño + contenido | 3 h |
| Frontend (página + estado) | 3 h |
| Total | ~6 h |

---

### Mapa estratégico — UX refactor completo
**Completado**: 2026-05-19

- Título renombrado: "Estrategia" → "Mapa estratégico" (i18n es + en)
- `VisionCard`: sección editable de visión organizacional, guardada en `org.settings.vision` (JSONB) sin migración
- Categorías vacías ocultas por defecto con toggle "Mostrar/Ocultar vacías"
- Descripciones de categorías convertidas a tooltip ⓘ (hover)
- `StatCard`: valores cero → `opacity-50` + `text-muted-foreground`
- Códigos INT: ocultos, aparecen solo en hover del título (`group-hover/title:opacity-100`)
- Intents: activos (opacity-100) agrupados primero, inactivos debajo con separador + `opacity-50`
- Categorías: ordenadas → primero las que tienen intents activos

### Trazabilidad — Vista Pirámide + Ver todas las relaciones + Export PNG
**Completado**: 2026-05-19

- **Ver todas las relaciones** (modo Mapa): toggle dibuja todos los edges a 22% opacidad; con selección: resaltados 80%, resto 8%
- **Vista Pirámide** (`TraceabilityPyramid.tsx` nuevo): 6 bandas horizontales (Intenciones → Épicas), márgenes CSS decrecientes (34%→0%) forman pirámide; click en chip resalta cadena completa bidireccional (ascendente + descendente)
- **Export PNG**: html2canvas con import dinámico; descarga la vista activa (Mapa/Árbol/Pirámide); opciones 1× estándar y 2× alta resolución
- **UX mejorado**: `IconBtn` (icon-only + tooltip), `ActiveFilterBanner` flotante sobre canvas en todas las vistas con botón ×clear, `StatPill` con `Filter` icon hint en hover/activo, click-outside handler para menú de descarga

---

## Roadmap WOW — Casos de Negocio

> Estos no son features. Son momentos. Cada uno es una situación real donde alguien dice "wow" porque el sistema hizo algo que no esperaba o que le ahorró horas.

---

### Consultor — 5 WOW que cierran contratos y renuevan

| # | WOW Moment | Descripción | Estado |
|---|------------|-------------|--------|
| C1 | **El demo cerró el contrato** | Un prospecto ve su propia estrategia en 15 min durante una reunión de ventas | ✅ Completo (2026-05-20) |
| C2 | **Mi cliente quedó sin palabras con el mapa** | Trazabilidad visual en vivo + exportar PNG para el deck → el cliente VE la conexión | ✅ Completo (2026-05-20) |
| C3 | **Me ahorré 3 horas preparando el comité** | PDF ejecutivo + PPTX en 1 clic con datos reales del ciclo | ✅ Completo (2026-05-20) |
| C4 | **El acuerdo del board ya está en el backlog** | Acuerdo junta → IA sugiere épica → vinculada al OKR. Loop board-estrategia-ejecución cerrado | ✅ Completo (2026-05-20) |
| C5 | **Me avisó que íbamos a fallar 2 semanas antes** | Risk Sentinel con alerta temprana + recomendaciones específicas por objetivo | ✅ Completo (2026-05-20) |

---

### Cliente — 5 WOW que aseguran la adopción

| # | WOW Moment | Descripción | Estado |
|---|------------|-------------|--------|
| K1 | **Entendí toda nuestra estrategia en 5 minutos** | Mapa estratégico visual + trazabilidad desde el día 1, sin Excel | ✅ Completo |
| K2 | **Todos saben qué deben hacer y por qué** | Cada miembro ve su objetivo conectado directo a la estrategia de empresa | ✅ Completo (2026-05-20) |
| K3 | **El check-in semanal dura 10 minutos y es útil** | Check-in asistido por IA con preguntas contextuales + resumen automático para manager | ✅ Completo (2026-05-20) |
| K4 | **Los directivos ven el progreso en tiempo real** | Executive Dashboard live sin reportes manuales + alertas automáticas al desviarse | ✅ Completo (2026-05-21) |
| K5 | **Cerramos el ciclo y sabemos qué aprender** | Executive Briefer genera cierre + aprendizajes del ciclo para el siguiente | ✅ Completo (2026-05-21) |
| K6 | **El cliente renovó sin que lo llamaras** | A los 90 días el cliente ve en pantalla el ROI real: acuerdos cumplidos, objetivos logrados, trabajo generado. El sistema justifica la renovación sin discurso comercial. | ✅ Completo (2026-05-28) |
| K7 | **La presidenta respondió en 10 segundos en la junta** | Alguien pregunta por un acuerdo. La presidenta abre Telegram, escribe `/acuerdo AGR-5` y muestra el estado en tiempo real. | ✅ Completo (2026-05-29) |

---

### K7 — "La presidenta respondió en 10 segundos en la junta"
**Completado**: 2026-05-29

Objetivo: en una junta, cualquier directivo puede consultar el estado de un acuerdo en segundos desde el teléfono, y todos quedan notificados al instante cuando algo cambia.

**Entregables:**

#### ✅ Telegram bot — consulta bajo demanda + notificaciones
- `backend/src/modules/internal/internal.controller.ts` — `GET /api/v1/internal/agreements[?code=AGR-N]`
  - `@Public()` + valida `Authorization: Bearer SUPER_AGENT_TOKEN`
  - Con `code`: detalle de 1 acuerdo. Sin `code`: lista top-20 activos por prioridad
- `backend/src/modules/internal/internal.module.ts` + registrado en `AppModule`
- `scripts/super-agent.js` — UX completa con inline keyboard:
  - Menú principal 2×2: Acuerdos / Empresa / Sistema / Ayuda
  - `/empresa` → lista de orgs como botones, selección persistida en `agent-state.json`
  - `/acuerdos` → lista con semáforo, cada acuerdo es un botón → abre detalle en el mismo mensaje (editMessageText)
  - `/acuerdo AGR-N` → detalle: estado, prioridad, plazo, responsable (o "Sin responsable asignado"), nota de transición
  - Selección de empresa multi-org, persistida entre sesiones
- `backend/src/modules/agreements/agreements.service.ts` — notificación Telegram en cada cambio de estado:
  - Detecta `dto.status !== before.status` tras el update
  - Mensaje: `🔔 org · 📋 código · transición · 👤 responsable · 📅 plazo · 💬 nota`
  - Inyecta `TelegramService` (global, sin cambiar el módulo)

#### ✅ Transición obligatoria con nota — web
- `TransitionNoteDialog` reemplaza `FulfillNoteDialog`: aparece en **todo** cambio de estado
- Nota **obligatoria** — botón deshabilitado hasta que haya texto
- Placeholder contextual por estado destino (FULFILLED / CANCELLED / IN_PROGRESS / PENDING)
- La nota se guarda en `completion_notes` y se muestra en la tarjeta con color según estado
- Kanban drag-and-drop también abre el dialog — la tarjeta no se mueve hasta confirmar
- `ActionMenu`: `onTransition(s)` unificado para todos los estados (antes: `onFulfill` + `onStatusChange` separados)
- La nota es el contenido principal de la notificación Telegram

**Variables de entorno requeridas:**
```
SUPER_AGENT_TOKEN=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
PRIMARY_ORG_ID=<SELECT id FROM organizations LIMIT 1>
BACKEND_URL=http://localhost:3021
```
Luego: `pm2 restart okr-super-agent`

---

### C1 — "El demo cerró el contrato"
**Completado**: 2026-05-20

Objetivo: en una reunión de ventas, el consultor lleva al prospecto a ver SU propia estrategia en 15 minutos.

**Entregables:**
- Wizard Express de Demo (`/demo-setup`): 4 pasos guiados — empresa/desafío → IA genera 3 objetivos → 2 KRs cada uno → lanzar
- Modo Presentación: AppShell sin sidebar/topbar, banner con nombre empresa + botón "Salir del demo"
- `POST /ai/suggest-demo-strategy`: genera 3 objetivos + KRs desde industria + descripción del desafío

**Estimación de esfuerzo:**
| Tarea | Horas |
|-------|-------|
| AI endpoint backend | 1 h |
| UIStore + AppShell presentación | 1 h |
| Wizard 4 pasos | 5 h |
| Sidebar + i18n | 0.5 h |
| Total | ~8 h |

---

### C2 — "Mi cliente quedó sin palabras con el mapa"
**Completado**: 2026-05-20

Objetivo: en una sesión de seguimiento, el consultor abre la trazabilidad y el cliente VE en tiempo real cómo cada acuerdo del board se conecta hasta la épica en ejecución.

**Entregables:**
- `GET /agreements/links` — endpoint que retorna todos los pares `{agreement_id, backlog_item_id}` de la org
- `useAgreementLinks()` hook en `useAgreements.ts`
- `TraceabilityPyramid.tsx` — banda "Acuerdos" en la cima de la pirámide (marginPct 42%, rose), chain computation bidireccional acuerdo↔épica; cuando se selecciona un acuerdo se iluminan las épicas que generó y toda su cadena descendente
- `traceability/page.tsx`:
  - StatPill "Acuerdos" (visible cuando hay datos)
  - Botón **Recorrido** (tour auto-play): muestra cada elemento uno a uno (2.8s/item), cambia automáticamente a vista Pirámide, banner flotante con nombre del elemento y progreso N/total
  - Botón **Presentar**: activa el Modo Presentación (sin sidebar/topbar) directamente desde la trazabilidad

**Estimación de esfuerzo:**
| Tarea | Horas |
|-------|-------|
| Backend endpoint | 0.5 h |
| Pyramid + chain computation | 2 h |
| Tour mode + Presentar button | 2 h |
| Total | ~4.5 h |

---

### C5 — "Me avisó que íbamos a fallar 2 semanas antes"
**Completado**: 2026-05-20

Objetivo: el Risk Sentinel no solo detecta KRs ya en riesgo, sino que proyecta cuáles objetivos FALLARÁN al cierre del ciclo si se continúa al ritmo actual — anticipando el problema con semanas de antelación.

**Entregables:**
- `runRiskSentinel()` ampliado con cálculo de `early_warnings`: para cada objetivo activo, calcula `pace_per_day = progress / days_elapsed` y `projected_progress = progress + pace × days_remaining`. Si `projected < 70%` → alerta temprana
- Prompt IA actualizado: incluye early warnings además de KRs en riesgo; genera `early_warnings_analysis` (narrativa predictiva) + `early_warning_actions` (acción específica por objetivo con urgency: critical/high/medium)
- `RiskSentinelReport` type en `useAI.ts` ampliado con `EarlyWarning[]`, `EarlyWarningAction[]`, `early_warnings_analysis`
- `EarlyWarningCard`: tarjeta con doble barra (hoy vs proyectado), indicador ≥70% meta, días restantes, acción IA específica
- `EarlyWarningsSection`: panel completo que aparece cuando el sentinel ha corrido y hay alertas, con análisis narrativo + grid de cards
- Se inserta ANTES de la matriz de riesgo → lo primero que ve el consultor

**Estimación de esfuerzo:**
| Tarea | Horas |
|-------|-------|
| Cálculo predictivo + actualizar IA prompt | 2 h |
| Tipos frontend + EarlyWarningCard/Section | 2 h |
| Integración en página | 0.5 h |
| Total | ~4.5 h |

---

### C3 — "Me ahorré 3 horas preparando el comité"
**Completado**: 2026-05-20

Objetivo: el consultor exporta el reporte del comité en 1 clic y obtiene un PDF y PPTX con todos los datos relevantes del ciclo, sin preparar manualmente.

**Entregables:**
- `fetchReportData()` método privado en `reports.service.ts`: fetch paralelo de ciclo, org, dashboard, riesgos, objetivos, acuerdos y top iniciativas
- `buildExecutiveReportHtml()` reescrito con: header degradado con nombre org + score, 6 KPIs (Progreso/Objetivos/Completados/En riesgo/Acuerdos/Cumplimiento), banda victorias, tabla objetivos, tabla iniciativas, sección acuerdos con 3 cajas + barra de cumplimiento, tabla KRs en riesgo
- `buildExecutivePptx()` ampliado con `orgName`, `agreementStats`, `topInitiatives`: 7 slides — portada con org, métricas (5 KPIs + barra cumplimiento), objetivos, iniciativas estratégicas (nueva), compromisos del comité (nueva), KRs en riesgo, cierre

**Estimación de esfuerzo:**
| Tarea | Horas |
|-------|-------|
| fetchReportData + refactor | 1 h |
| HTML template PDF | 2 h |
| PPTX slides nuevos | 2 h |
| Total | ~5 h |

---

### K2 — "Todos saben qué deben hacer y por qué"
**Completado**: 2026-05-20

Objetivo: cada persona del equipo entra al sistema y en < 30 segundos entiende qué KRs tiene asignados, cómo va su progreso y cómo conecta con la estrategia de la empresa.

**Entregables:**
- `GET /me/my-work?cycleId=` — endpoint en `users.controller.ts` → `users.service.ts` con query SQL: KRs donde `kr.owner_id = userId`, con objetivo padre, equipo, área, última fecha de check-in y días sin check-in; más objetivos COMPANY del ciclo activo como "norte estrella"
- `useMyWork.ts` hook: tipos `MyKR`, `NorthStarObjective`, `MyWorkCycle`; staleTime 2min
- `/my-okrs` page — "Mi Estrategia": stats (KRs, progreso promedio, check-ins pendientes), sección "Por qué importa" (north star company objectives), KRs agrupados por objetivo con barra de progreso dual, nudge de check-in por días sin actualización, botón rápido de check-in por KR
- Sidebar: `my-okrs` (User icon) en grupo "home", visible para todos los roles (ADMIN/MANAGER/MEMBER/VIEWER)

---

### K6 — "El cliente renovó sin que lo llamaras"
**Completado**: 2026-05-28

Objetivo: a los 90 días el cliente abre una página y ve en números grandes: cuántos acuerdos comprometió vs cuántos cumplió, cuántos objetivos logró, cuántas épicas y features generó. El sistema muestra el ROI del ciclo sin necesidad de un deck de PowerPoint ni una llamada de ventas.

**Entregables:**
- `GET /api/v1/reports/engagement-roi/:cycleId` — endpoint que agrega en paralelo: acuerdos (total/cumplidos/tasa), objetivos (comprometidos/logrados/parciales/fallidos), backlog (épicas/features/historias/story points), iniciativas, check-ins
- `useEngagementRoi(cycleId)` hook con tipos `EngagementRoi`, `EngagementAgreement`, `EngagementObjective`
- `/reports/engagement` — página completa con:
  - **Narrative hero**: frase dinámica "Cumplimos el X% de los compromisos adquiridos, generamos N épicas"
  - **4 KPI tiles**: acuerdos cumplidos, objetivos logrados, épicas generadas, check-ins
  - **3 gauges**: % cumplimiento acuerdos / % logro objetivos / % story points entregados + score del ciclo con estrellas
  - **Tabla de acuerdos**: cada acuerdo con código, origen, épicas vinculadas, badge de estado (color)
  - **Tabla de objetivos**: progreso final por objetivo con barra de color (verde/ámbar/rojo)
  - **Cards de trabajo generado**: épicas / features / historias / iniciativas con barra de completados
  - **Barra de story points**: si hay story points registrados en el ciclo
  - **Selector de ciclo** y **export PDF/PPTX**
- Sidebar: ítem "Retorno del Engagement" (TrendingUp icon) en grupo `analysis`
- Card en `/reports` index con preview de stats del ciclo activo

**Estimación de esfuerzo:**
| Tarea | Horas |
|-------|-------|
| Backend endpoint | 1.5 h |
| Hook + tipos | 0.5 h |
| Página UI completa | 4 h |
| Sidebar + reports index | 0.5 h |
| Total | ~6.5 h |

---

## Sesión 2026-05-25 — Kanban estándar + Demo fix

### Estándar kanban en todas las pantallas
**Completado**: 2026-05-25

Se estandarizó la experiencia kanban en todas las pantallas del sistema: **Backlog**, **Iniciativas** y **Delivery**. El comportamiento ahora es idéntico a la pantalla de Acuerdos (referencia).

**Patrón implementado en las 3 pantallas:**
- **HTML5 drag-and-drop entre columnas**: `draggable`, `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`; columna objetivo recibe highlight `ring-2 ring-primary` + placeholder "Soltar aquí" al hover
- **Menú `...` con Avanzar / Retroceder**: helpers `getNextStatus` / `getPrevStatus` calculan el estado anterior/siguiente en el flujo; la opción aparece solo si hay estado adyacente (no se muestra si ya es el primero/último)
- **Mutación optimista**: `useUpdateBacklogItem`, `useUpdateInitiative`, `useUpdateDeliverable` — el cambio de estado se persiste en backend inmediatamente al soltar o al seleccionar la opción del menú

**Cambios por archivo:**

`app/(app)/backlog/page.tsx`:
- Flujo de estados: `OPEN → IN_PROGRESS → DONE`
- `ItemMenu` extendido: `status?`, `onStatusChange?` → muestra Avanzar/Retroceder con labels en español
- `BacklogCard` y `TreeRow` pasan `status` + `onStatusChange` a `ItemMenu`
- `draggingId` / `dropTarget` states + handlers en columnas kanban

`app/(app)/initiatives/page.tsx`:
- Flujo de estados: `TODO → IN_PROGRESS → DONE` (CANCELLED como opción especial)
- `InitiativeCard` con DropdownMenu nativo (Avanzar/Retroceder/Cancelar, opacity-0 group-hover:opacity-100)
- `KanbanColumn` reescrita para aceptar props de drag

`app/(app)/delivery/[id]/page.tsx`:
- Flujo de estados: `NOT_STARTED → IN_PROGRESS → IN_REVIEW → APPROVED`
- Opciones especiales: `BLOCKED` / `CANCELLED` en el menú (no parte del flujo lineal)
- `KanbanCard` dropdown reemplazado: antes listaba todos los estados, ahora solo Avanzar/Retroceder/Bloqueado/Cancelar
- Drop target indexado por `{ phaseId, status }` para soportar fases múltiples en el mismo tablero

### Patrón de filtros estándar — Backlog y Check-ins
**Completado**: 2026-05-25

Se reemplazó el UI de 3 dropdowns visibles por el patrón **búsqueda + botón "Filtros" colapsable + chips** (igual que la pantalla de Acuerdos).

**Cambios por archivo:**

`app/(app)/backlog/page.tsx`:
- Eliminado `FilterToggle`; reemplazado por: `<Input>` de búsqueda + botón `SlidersHorizontal` "Filtros" con badge de activos + panel colapsable con `<select>` para tipo/estado/prioridad + chips para filtros activos con botón ×

`app/(app)/checkins/page.tsx`:
- Mismo patrón. El panel colapsable adapta sus campos según el tab activo (risk vs cadence)
- Fix TypeScript: chips con `Record<string, string>` cast para `statusFilter` de tipo union

### Fix Demo Express — límite de objetivos + confirmación
**Completado**: 2026-05-25

**Problema raíz:** `POST /api/v1/demo/clean → 500` por FK `NO ACTION` en `program_cycles.cycle_id → cycles`. Al intentar borrar la fila de `cycles`, PostgreSQL rechazaba porque `program_cycles` tenía filas referenciando ese ciclo.

**Problema secundario:** Al ejecutar el demo por segunda vez, `sp_create_objective` devolvía `400: "Se alcanzó el límite de 5 objetivos por nivel (COMPANY) en este ciclo."` porque los objetivos del primer run seguían en la tabla.

**Fixes:**

`backend/src/modules/demo/demo.service.ts`:
- `cleanOrg()`: añadidas 3 eliminaciones ANTES de `DELETE FROM cycles`:
  1. `DELETE FROM program_cycles WHERE cycle_id IN (SELECT id FROM cycles WHERE organization_id = $1)`
  2. `DELETE FROM delivery_programs WHERE organization_id = $1` (fases y entregables cascadean)
  3. `DELETE FROM cycle_close_reports WHERE cycle_id IN (SELECT id FROM cycles WHERE organization_id = $1)`
- Nuevo método `resetDemoObjectives(orgId, cycleId, userId)`: soft-delete de todos los objetivos del ciclo (`UPDATE objectives SET deleted_at = NOW() WHERE ...`)

`backend/src/modules/demo/demo.controller.ts`:
- Nuevo DTO `ResetObjectivesDto` con `organizationId` + `cycleId` (ambos `@IsUUID()`)
- Nuevo endpoint `POST /demo/reset-objectives` → `svc.resetDemoObjectives(...)`

`frontend/src/app/(app)/demo-setup/page.tsx`:
- En `launch()`: llama `POST /demo/reset-objectives` ANTES de crear objetivos → elimina el error de límite
- Mensajes de error mejorados: distingue error de límite de otros errores
- **Confirmación de organización** en paso 3: bloque amber con org name real (`currentUser.org_name` de `useAuthStore`) y ciclo activo. Checkbox de confirmación — el botón "Ver mapa estratégico" permanece deshabilitado hasta que se marca
- Import: `useAuthStore` + `api` (api-client)

---

### Trazabilidad — Vista Despliegue Estratégico v1
**Completado**: 2026-06-11

Vista inicial "Despliegue" en `/traceability` con árbol progresivo, cobertura por OKR, conectores T y KRs con datos reales.

---

### Trazabilidad — Vista Despliegue Estratégico v2 (rediseño 10x)
**Completado**: 2026-06-12

Rediseño completo del componente `TraceabilityDeployTree.tsx` (~950 líneas). Supera al HTML de referencia `P4_OKR_Tree v2.html` en todas las dimensiones.

**Nuevos campos en `key_results` (migraciones 072 + 073):**
- `kr_category TEXT` — RESULTADO / CAPACIDAD / BALANCE
- `kpi_description TEXT` — texto del KPI (ej. "Evolución del portafolio / IEA")
- `gap_note TEXT` — análisis de brecha por KR
- `recommendation TEXT` — recomendación accionable
- `refs_data JSONB` — links de cascada + FODA + SUGEF + dependencias por KR
  ```json
  {
    "links_down": {"annual": ["OA-A · KR1"], "quarterly": ["OT-A Q2 · KR1"]},
    "links_up": ["2030 · KR1"],
    "foda": [{"code": "D7", "desc": "..."}],
    "sugef": [{"code": "D3", "desc": "...", "status": "inicial"}],
    "deps": [{"pilar": "P4", "rel": "Dueño"}]
  }
  ```

**`v_key_results_with_trend` reconstruida** para incluir los 5 campos nuevos.

**Tree query actualizado** en `objectives.service.ts` — incluye todos los campos nuevos en `json_agg`.

**`TraceabilityDeployTree.tsx` — características:**
- **Tab "Árbol"**: árbol progresivo estratégico→anual→trimestral
- **Tab "Brechas (N)"**: panel de tarjetas gap/partial con badge contador rojo/ámbar
- **KR rows mejoradas**: badge de categoría (Resultado/Capacidad/Balance) + descripción narrativa + KPI italic + coverage badge por KR + chips de cascada desde `refs_data`
- **Conectores visibles**: líneas 3px slate-500 + punto central en T-connector
- **KR Detail Panel enriquecido**: sección Cascada (↓ y ↑), Análisis de brecha, Recomendación, FODA, SUGEF, Dependencias
- **GapCard**: tarjetas por cada KR con gap — severidad, descripción, recomendación, badges FODA/SUGEF/pilar
- **Coverage strip** con 4 estadísticas

**Fix crítico en `traceability/page.tsx`:**
- Problema: el tree query parte de los OKRs raíz del ciclo CUSTOM y en cascada incluye anuales y trimestrales (cross-cycle via `parent_objective_id`). Las queries separadas para ANNUAL y QUARTERLY devolvían `[]` porque sus OBJs tienen `parent_objective_id` apuntando a otro ciclo.
- Solución: usar una sola query `useObjectiveTree(strategicCycle.id)` y filtrar por `depth` (0=estratégico, 1=anual, ≥2=trimestral). Filtrar por `level` era incorrecto — algunos orgs tienen OBJs anuales con `level=COMPANY`.

**Migraciones aplicadas:**
| # | Descripción |
|---|-------------|
| 071 | Fix v_user_session (sesión anterior) |
| 072 | kr_category, kpi_description, gap_note, recommendation + view rebuild |
| 073 | refs_data JSONB + view rebuild final |

---

## BACKLOG — Seguridad e Infraestructura (2026-06-19)

Gaps identificados en auditoría del servidor. No bloquean operación actual pero son necesarios antes de exponer el sistema a clientes o datos sensibles.

### Prioridad Alta
- [ ] **SSL/TLS + Nginx activo** — todo el tráfico es HTTP puro. Activar Nginx como reverse proxy con Let's Encrypt. Sin esto las cookies JWT viajan en texto plano.
- [ ] **SMTP configurado** — password reset, invitaciones y notificaciones email no funcionan. Requiere credenciales Brevo/SendGrid en `.env`.
- [ ] **Sentry DSN** — errores de producción son invisibles. Crear proyecto en sentry.io, agregar `SENTRY_DSN` al `.env`.

### Prioridad Media
- [ ] **Secrets en vault** — JWT secrets y API keys viven en `.env` plano. Migrar a HashiCorp Vault o variables de entorno del sistema operativo.
- [ ] **MFA para acceso admin** — solo password. Agregar TOTP (Google Authenticator) para usuarios con rol `ADMIN` o `SUPER_ADMIN`.
- [ ] **Backups verificados** — scripts de backup existen pero nunca se ha probado un restore completo. Ejecutar drill de restore mensual.
- [ ] **Cifrado en reposo** — PostgreSQL sin cifrado at-rest. Evaluar pg_crypto a nivel de columnas sensibles o cifrado de disco.

### Prioridad Baja (escala / compliance)
- [ ] **WAF + DDoS protection** — sin Cloudflare ni similar. Necesario si el sistema queda expuesto a internet público.
- [ ] **Multi-región / DR plan** — servidor único. Documentar y probar procedimiento de disaster recovery.
- [ ] **Pen test formal** — nunca realizado. Contratar o ejecutar con herramientas (OWASP ZAP, Burp Suite) antes de go-live con clientes.
- [ ] **SOC 2 / ISO 27001** — requerido si se vende a empresas reguladas (finanzas, salud, gobierno).

### Resuelto en sesión 2026-06-19
- [x] Redis sin contraseña → contraseña configurada (`requirepass`) y persistida
- [x] Health endpoint sin `@SkipThrottle` → corregido, monitor no puede recibir 429
- [x] PM2 log rotation → instalado `pm2-logrotate` (50MB máx, 7 archivos, comprimido)
- [x] PM2 auto-start al reboot → `PM2_OKR_Autostart.bat` en carpeta Startup de Windows
- [x] Bug JSONB slice en `updateSentAt` → `[0:4]` reemplazado por `jsonb_path_query_array`
