# CHANGELOG — OKR System

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [13.0.0] — 2026-04-24 — Enterprise completeness

### Autenticación avanzada
- MFA TOTP (RFC 6238): setup con QR code, habilitación y deshabilitación con verificación de código
- Bloqueo de cuenta por intentos fallidos: 5 intentos en 15 minutos → lockout 15 minutos (`fn_check_login_attempts`, tabla `login_attempts`)
- `POST /auth/logout-all` — revoca todos los refresh tokens del usuario (`sp_revoke_all_tokens`)

### Perfil de usuario
- Tabla `user_profiles` con trigger de auto-creación al registrar usuario
- `GET /me/profile` + `PATCH /me/profile` — timezone, locale, preferencias de notificación
- `sp_update_user_profile` — actualización segura en DB

### Notificaciones en tiempo real
- `NotificationsGateway` — WebSocket gateway (Socket.io, namespace `/notifications`) con autenticación JWT vía cookie
- Rooms `user:{userId}` y `org:{orgId}` — push dirigido por usuario u organización
- `checkin:created` emitido al crear un check-in → invalida queries en frontend
- `notification:new` push desde cron del Risk Sentinel
- Frontend: `useSocket` hook + conexión en `AppShell` — reemplaza polling cada 60s

### Reportes PDF
- `GET /reports/export-pdf/:cycleId` — reporte ejecutivo en PDF A4 con pdfkit (sin Chrome)
- Botón "Descargar PDF" en dashboard ejecutivo y cycle health

### GDPR / Privacidad
- `GET /me/export-data` — exporta todos los datos del usuario como JSON attachment (`sp_export_user_data`)
- `DELETE /me/account` — anonimiza datos personales en todas las tablas + cierra sesión (`sp_anonymize_user`)

### Seguridad y auditoría
- `GET /reports/security-audit` — vista `v_security_audit` para OWNER/ADMIN (últimos 100 eventos)
- Health check extendido: verifica PostgreSQL + Redis con respuesta `{status, checks}`

### Settings (Frontend)
- Página Settings reescrita con 4 pestañas: Organización, Perfil, Seguridad, Privacidad
- Flujo MFA: mostrar QR, ingresar código de verificación, estado visible, desactivar con código
- "Cerrar todas las sesiones" con confirmación
- Export datos + eliminar cuenta con diálogo de confirmación

---

## [12.0.0] — 2026-04-24 — Despliegue y producción

### Infraestructura
- `ecosystem.config.js` — PM2 en cluster mode, logs separados por proceso
- `nginx/nginx.conf` + `nginx/conf.d/okr.conf` — SSL hardening, HSTS, CSP, rate limiting, proxy para backend/frontend/SSE
- `scripts/migrate.sh` — runner de migraciones SQL idempotente con tabla `_sql_migrations`
- `scripts/deploy.sh` — pipeline completo: backup → migraciones → build → PM2 reload → health check
- `scripts/backup.sh` — pg_dump gzip con retención 30 días
- `scripts/restore.sh` — restauración con detención/arranque automático de PM2
- `scripts/logs.sh` — acceso unificado a logs de PM2, Nginx y PostgreSQL

### CI/CD
- `.github/workflows/ci.yml` — GitHub Actions: typecheck + lint + test + build en backend y frontend; deploy SSH automático al merge en `main`

### Observabilidad
- Logging JSON estructurado en producción (`level`, `msg`, `ctx`, `ts`) compatible con PM2 y agregadores de logs
- Health check en `GET /api/v1/health` — verifica PostgreSQL y Redis con respuesta `{ status, checks }`
- Web Vitals tracking en frontend con forwarding opcional a endpoint de analytics

### Seguridad
- `.env.example` completo con todos los secrets documentados
- HSTS + Permissions-Policy + sameSite strict configurados

---

## [11.0.0] — 2026-04-24 — Seguridad, performance y calidad

### Seguridad
- Row Level Security (RLS) en 7 tablas con `FORCE ROW LEVEL SECURITY` y `fn_check_org_context`
- MCP audit log inmutable con triggers que retornan ERRCODE 55000 en UPDATE/DELETE
- `sameSite: strict` en cookies de autenticación
- Headers: HSTS (1 año + preload), Permissions-Policy, X-Frame-Options via Helmet
- Swagger UI solo disponible en desarrollo (`!isProd`)

### Performance
- Cache Redis en 4 dashboards pesados con TTL 300s y `getOrSet<T>` con fallback transparente
- Invalidación de cache al generar reporte de cierre
- 8 índices de performance para queries de dashboard ejecutivo

### Calidad
- 18 tests unitarios (Jest + ts-jest): AuthService, ReportsService, AiService
- Tests E2E con Playwright en `frontend/e2e/`
- `@nestjs/swagger` con `@ApiTags` y `@ApiCookieAuth` en todos los controllers
- `DbService.withOrgContext()` para activar contexto RLS
- `RedisService.getOrSet<T>()`, `del()`, `delPattern()` con batching

---

## [10.0.0] — 2026-04-24 — Reportes y dashboards ejecutivos

### Base de datos
- Vistas: `v_executive_dashboard`, `v_cycle_health`, `v_team_health`, `v_portfolio_dashboard`, `v_weekly_trend`
- Función `fn_generate_cycle_close_report(cycle_id, org_id)` — JSON completo del cierre
- Tabla `cycle_close_reports` con snapshots inmutables

### Backend
- 7 endpoints: dashboard ejecutivo, cycle health, team health, portfolio, weekly trend, close report, export CSV
- Activity feed (`GET /reports/activity-feed`) con filtro por ciclo y equipo
- Upcoming milestones (`GET /reports/upcoming-milestones`) con ventana de días configurable

### Frontend
- `/reports` — hub de reportes con 8 tarjetas de navegación
- `/reports/executive-dashboard` — heat map + KRs en riesgo + score del ciclo
- `/reports/risk-dashboard` — KRs en riesgo priorizados + cadencia de check-ins
- `/reports/cycle-health` — distribución de estados + proyección de cierre
- `/reports/team-health` — radar de equipos (progreso × confianza × cadencia)
- `/reports/portfolio` — Gantt de iniciativas por equipo
- `/reports/executive-briefing` — último briefing semanal generado por IA
- `/reports/upcoming-milestones` — calendario de hitos por urgencia (hoy/semana/más adelante)
- `/checkins/feed` — feed de actividad con filtro por equipo y mood emoji

---

## [9.0.0] — 2026-04-24 — AI Agents completos + MCP Tools avanzados

### MCP Tools (19 herramientas total)
- `predict_completion`, `compare_periods`, `run_scenario`, `generate_executive_summary`, `generate_okr_suggestions`
- `get_checkin_history`, `get_at_risk_krs`, `get_alignment_map`, `analyze_alignment_gaps`, `get_cadence_dashboard`
- `create_checkin`, `list_initiatives_by_kr`, `get_sprint_okr_impact`
- Rate limiting por plan (FREE/BASIC/PRO) con Redis

### AI Agents
- **Strategy Advisor**: chat en `/ai-assistant` con historial persistido, @ menciones de OKRs, action chips
- **Risk Sentinel**: cron nightly 2am, email digest, priorización por nivel estratégico
- **Executive Briefer**: cron Monday 8am, email HTML, score + highlights + riesgos
- **Alignment Auditor**: endpoint manual + disparo automático al activar ciclo

### Base de datos
- `fn_compare_cycles`, `fn_run_scenario`, `fn_get_alignment_gaps`
- `ai_briefings`, `ai_conversations`, `v_mcp_audit_summary`

---

## [8.0.0] — 2026-04-23 — Modo ágil: Sprints y cadencia OKR

### Base de datos
- Tablas `sprint_cycles`, `sprint_goal_krs`
- Triggers: `trg_validate_sprint_org_mode`, `trg_validate_sprint_dates`, `trg_single_active_sprint_per_team`
- `sp_close_sprint`, `fn_sprint_okr_impact`, `fn_calculate_burnup`
- Vistas: `v_sprint_board`, `v_sprint_velocity`, `v_cycle_sprint_timeline`

### Frontend
- Sprint Board kanban + sprint goal + KRs vinculados
- Burn-up de OKRs por sprint (Recharts)
- Wizard de cierre conversacional
- Vista de velocidad y timeline del ciclo

---

## [7.0.0] — 2026-04-23 — Iniciativas y ejecución táctica

### Base de datos
- Tablas `initiatives`, `initiative_key_results`, `milestones`
- Triggers: recálculo de progreso desde milestones, alertas de overdue
- `sp_create_initiative`, `sp_complete_milestone`, `fn_initiative_health`
- Vistas: `v_initiative_timeline`, `v_initiatives_by_kr`, `v_overdue_milestones`

### Frontend
- Kanban de iniciativas por equipo
- Formulario con KRs vinculados (multi-select con buscador)
- Milestones con checkbox de completado
- Vista Gantt con color por estado
- MCP Tools: `list_initiatives`, `get_initiative_timeline`, `flag_initiative_at_risk`

---

## [6.0.0] — 2026-04-23 — Check-ins, progreso + Check-in Assistant AI

### Base de datos
- Tablas `check_ins`, `notifications`
- Trigger `trg_checkin_cascade_recalc` — recálculo en cascada KR → objetivo → padres
- `sp_create_check_in`, `sp_mark_stale_krs_at_risk`, `fn_predict_kr_completion`
- Vistas: `v_check_in_history`, `v_at_risk_krs`, `v_cadence_dashboard`

### Frontend
- Check-in Drawer: slider de confianza, mood picker, "Generar nota con IA"
- Historial gráfico (LineChart Recharts) con delta y mood
- Dashboard de cadencia con semáforo de días
- NotificationsBell en TopBar con badge
- Vista KRs en riesgo priorizada por nivel estratégico

---

## [5.0.0] — 2026-04-23 — OKRs tácticos + Diagnóstico Organizacional

### Base de datos
- Triggers de alineación táctica y permisos de equipo
- Vistas: `v_team_objectives`, `v_my_objectives`
- Módulo de Diagnóstico Org: `organizational_problems`, `strategic_intents`, `problem_intents`

### Frontend
- Vista de equipo y "Mis OKRs" con ProgressRing y KRCard
- Selector de objetivo padre (tree picker)
- Páginas `/problems` y `/strategy` con CRUD completo

---

## [4.0.0] — 2026-04-23 — OKRs estratégicos + OKR Coach AI

### Base de datos
- Tablas `objectives`, `key_results`
- Triggers de límites (5 objetivos/nivel, 5 KRs/objetivo)
- `fn_calculate_kr_progress`, `fn_calculate_objective_progress`, `fn_validate_okr_quality`
- `sp_create_objective`, `sp_create_key_result`
- Vistas: `v_objectives_with_progress`, `v_key_results_with_trend`, `v_alignment_map`

### Frontend
- Vista estratégica con heat map por nivel
- Detalle de objetivo con KRs y ConfidenceMeter
- Mapa de alineación COMPANY → AREA
- Formulario de OKR con **OKR Coach inline** (score 0-10 + sugerencias en tiempo real)
- Filtros por nivel y estado en vista estratégica

---

## [3.0.0] — 2026-04-22 — Ciclos OKR

### Base de datos
- Tabla `cycles`, trigger de unicidad, `sp_activate_cycle`, `sp_close_cycle`
- Vista `v_cycles_with_stats`, función `fn_get_cycle_score`

### Frontend
- Selector de ciclo activo en TopBar
- `/cycles` — gestión de ciclos con estados y acciones

---

## [2.0.0] — 2026-04-22 — Multi-tenancy + Equipos + Onboarding

### Base de datos
- Tablas `teams`, `team_members`, `invitations`
- `sp_create_team`, `sp_add_team_member`, `sp_accept_invitation`
- Vistas: `v_team_tree`, `v_org_members`, `v_user_teams`

### Frontend
- Onboarding wizard (4 pasos)
- AppShell con Sidebar + TopBar
- `/teams` con árbol y miembros
- `/settings` con gestión de la organización

---

## [1.0.0] — 2026-04-22 — Fundaciones técnicas + Auth + MCP base

### Base de datos
- Tablas base: `organizations`, `users`, `refresh_tokens`, `audit_log`, `mcp_audit_log`
- `sp_create_organization`, `sp_register_user`, `sp_validate_login`, `sp_refresh_token_raw`
- `fn_user_has_permission`, `v_user_session`
- Triggers: `trg_updated_at`, `trg_soft_delete`, `trg_audit_log`

### Backend
- NestJS con TypeScript strict, `DbService`, módulo `auth`, guards JWT
- Global prefix `/api/v1`, Helmet, CORS, rate limiting
- MCP Server base (`tools/list`, `tools/call`) con audit log

### Frontend
- Next.js 14 App Router
- Páginas `/auth/login` y `/auth/register`
- `lib/api-client.ts` con credentials: include

---

## [0.0.0] — 2026-04-22 — Design System & Fundamentos UX/UI

- Design tokens en CSS variables + Tailwind
- Componentes base: Button, Input, Badge, Card, Drawer, Dialog, Dropdown, Tooltip
- Componentes OKR: ProgressRing, ConfidenceMeter, StatusChip, KRCard
- Layout: Sidebar, TopBar, PageHeader, EmptyState, SkeletonLoader
- Dark mode funcional con `next-themes`
- Accesibilidad WCAG 2.1 AA: focus visible, ARIA, contraste mínimo
