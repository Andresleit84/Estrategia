# Estado de Implementación — Referencia de Sesión

> Actualizado: **2026-05-19**
> Leer este archivo **antes** de tocar cualquier módulo. Contiene el estado exacto de lo construido, decisiones críticas, y advertencias de errores pasados.

---

## Hitos completados (13/13) + Prioridades P1–P4 ✅

| Hito | Estado | Fecha |
|------|--------|-------|
| 0 — Design System + UX Foundation | ✅ | 2026-04-22 |
| 1 — Auth + MCP base | ✅ | 2026-04-22 |
| 2 — Multi-tenancy + Teams + Onboarding | ✅ | 2026-04-22 |
| 3 — Ciclos OKR | ✅ | 2026-04-22 |
| 4 — OKRs estratégicos + OKR Coach AI | ✅ | 2026-04-23 |
| 5 — OKRs tácticos + Diagnóstico Org | ✅ | 2026-04-23 |
| 6 — Check-ins + progreso + Check-in Assistant AI | ✅ | 2026-04-23 |
| 7 — Iniciativas y ejecución táctica | ✅ | 2026-04-23 |
| 8 — Modo ágil: Sprints y cadencia | ✅ | 2026-04-23 |
| 9 — AI Agents completos + MCP Tools avanzados | ✅ | 2026-04-24 |
| 10 — Reportes y dashboards ejecutivos | ✅ | 2026-04-24 |
| 11 — Seguridad, performance y calidad | ✅ | 2026-04-24 |
| 12 — Despliegue y producción (PM2 + Nginx + CI/CD) | ✅ | 2026-04-24 |
| 13 — Enterprise completeness (MFA, WebSockets, GDPR, PDF) | ✅ | 2026-04-24 |

### Mejoras post-hito completadas (cronológico)

| Mejora | Fecha |
|--------|-------|
| Agentes de automatización (Monitor, Test, Super + Telegram) | 2026-04-24 |
| Vista árbol OKR (`/strategic` toggle Lista/Árbol) | 2026-04-24 |
| Trazabilidad visual + progreso OKR jerárquico | 2026-04-28 |
| RLS org context interceptor (seguridad) | 2026-04-28 |
| Templates estructurados en formularios de artefactos | 2026-05-08 |
| Códigos de artefacto visibles en UI (badges `OBJ-1`, `KR-3`…) | 2026-05-08 |
| Pantalla de bienvenida personalizada (`/welcome`) | 2026-05-08 |
| Gobierno OKR — agenda de gobernanza (`/reports/governance`) | 2026-05-08 |
| Multi-empresa + Onboarding rediseñado + Settings jerárquico | 2026-05-09 |
| Auditoría QA — 8 bugs corregidos, 0 errores TypeScript | 2026-05-09 |
| Sprint auto-generation (`POST /sprints/generate`) | 2026-05-11 |
| Sprint board estilo Jira (STATUS_PILLS, AC readiness, edit inline) | 2026-05-11 |
| BacklogItemDialog extraído como componente compartido | 2026-05-11 |
| Performance frontend: next start vs next dev (160× más rápido) | 2026-05-11 |
| Menú restructurado en 5 grupos con puntos de color | 2026-05-11 |
| Búsqueda global — Command Palette Ctrl+K | 2026-05-11 |
| **P1:** Delivery advisor IA + sugerencias de fases y entregables | 2026-05-12 |
| **P2:** Cadencia de check-in configurable por KR | 2026-05-12 |
| **P3:** v_alignment_map 4 niveles + AlignmentCoveragePanel | 2026-05-12 |
| **P3:** Executive Briefer auto-trigger al cerrar ciclo | 2026-05-12 |
| **P3:** Sugerencias de OKRs de equipo (`/ai/suggest-team-okrs`) | 2026-05-12 |
| **P3:** Calendario de hitos — entregables de delivery como 2ª fuente | 2026-05-12 |
| **P4:** PDF ejecutivo mejorado — pdfkit → puppeteer + HTML visual | 2026-05-12 |
| **P4:** Presentación ejecutiva PPTX (`/reports/export-pptx/:cycleId`) | 2026-05-12 |
| **P4:** Guía de inicio `/getting-started` — checklist interactivo 7 pasos | 2026-05-12 |
| **P4:** Migration 023 aplicada — `okr_user` non-superuser activo | 2026-05-12 |
| Mapa estratégico: renombrado, sección Visión, categorías vacías toggle, tooltips, StatCards muted, códigos INT hover, sort activos/inactivos | 2026-05-19 |
| Trazabilidad: ver-todas-relaciones toggle, vista Pirámide (TraceabilityPyramid.tsx), export PNG html2canvas 1×/2×, UX (IconBtn, ActiveFilterBanner, StatPill Filter icon) | 2026-05-19 |

---

## Infraestructura activa

### Procesos PM2 (Windows)

| ID | Nombre | Puerto | Descripción |
|----|--------|--------|-------------|
| 0 | `okr-backend-dev` | 3021 | NestJS — `node dist/main.js` |
| 7 | `okr-frontend-dev` | 3001 | Next.js — `node_modules/next/dist/bin/next start -p 3001` |
| 8 | `okr-super-agent` | — | Telegram bot + supervisor de agentes |
| 9 | `okr-monitor` | — | Health polling + auto-restart |
| 10 | `okr-test-agent` | — | Tests nocturnos (cron 2am) |

**Importante PM2 en Windows**: usar `node_modules/next/dist/bin/next` (no `.bin/next` — es bash script, falla en Windows con SyntaxError).

### Base de datos

- PostgreSQL 16.13 en `127.0.0.1:5432`
- DB dev: `Estrategia_dev` / Superuser: `postgres` / `Andres`
- DB prod: `Estrategia` / User: `okr_user` (non-superuser)
- **Última migración aplicada: `patch_alignment_map_extended.sql`** (sesión 2026-05-12)
  - También: `039_global_search.sql` (sesión anterior)

### Paquetes instalados (sesión 2026-05-12)
- `puppeteer` v24.43.1 — PDF visual con Chromium headless
- `pptxgenjs` — generación de presentaciones PowerPoint

### Redis

- Puerto por defecto (6379), local

---

## Ambientes

| | Dev | Prod |
|--|-----|------|
| Backend | localhost:3021 | localhost:3020 |
| Frontend | localhost:3001 | localhost:3000 |
| DB | `Estrategia_dev` | `Estrategia` |
| PM2 config | `ecosystem.dev.config.js` | `ecosystem.config.js` |
| .env | `D:\estrategia\.env.dev` | `D:\estrategia\.env` |

---

## Credenciales dev

- URL: http://localhost:3001
- Email: andres.enrique@sendoagil.com
- Password: `Dev2026#Ok`
- Bloqueo tras intentos fallidos — limpiar: `DELETE FROM login_attempts WHERE email = '...'`

### IDs de referencia (dev)
- Ciclo Q2 2026 (QUARTERLY/ACTIVE): `ef279a4f-b614-4bce-b7ed-f8709425129a`
- Org ID (dev): `3ff4962e-074a-4b1e-853b-eba11bb72f13`
- User ID Andrés: `ca2f134b-983e-49e4-bb8d-b8d7dd8a578c`

---

## Decisiones críticas (no reversar sin análisis)

### 1. Passwords — pgcrypto ÚNICAMENTE
Ningún hash de contraseña se genera en TypeScript. Todo vía `crypt(password, gen_salt('bf', 12))` en PostgreSQL.

### 2. Next.js — `proxy.ts`, no `middleware.ts`
El middleware se llama `src/proxy.ts` con `export function proxy()`. **NUNCA** crear `src/middleware.ts` — Next.js lo detecta por nombre y causa 500 en todas las rutas.

### 3. Database-First
- Lecturas: vistas `v_*` (`SELECT * FROM v_nombre`)
- Escrituras con lógica: procedimientos `sp_*` (`CALL sp_nombre(...)`)
- Validaciones: triggers `trg_*`, funciones `fn_*`
- Prisma solo para migraciones de schema
- Queries con `node-postgres` directo: `db.query('SELECT ...', [params])`

### 4. Puertos
- Backend: **3021** (`.env` → `PORT=3021`)
- Frontend: **3001** (PM2 config)
- `NEXT_PUBLIC_API_URL=http://localhost:3021/api/v1` en `frontend/.env.local`

### 5. API client
```ts
import { api } from '@/lib/api-client'   // ✅
import { apiClient } from '@/lib/api-client'  // ❌ no existe
```

### 6. fn_update_key_result — captura v_obj_id PRIMERO
Bug histórico: `objective_id` es ambiguo en el UPDATE. Siempre capturar en variable: `SELECT kr.objective_id INTO v_obj_id FROM key_results kr WHERE kr.id = kr_id`.

### 7. DialogContent ya incluye Portal + Overlay
Solo usar `<DialogContent>` — ya envuelve con Portal y Overlay internamente. No anidar `<DialogPortal><DialogOverlay>`.

### 8. next.config.ts — sin `output: 'standalone'`
`output: 'standalone'` es incompatible con `next start` sin Nginx para servir `/_next/static`. No usarlo.

### 9. Actualización optimista en mutaciones
Siempre pasar `parent_id: value || null` (no `|| undefined`). `undefined` omite el campo del payload y el backend no actualiza; `null` envía explícitamente NULL y borra la relación.

### 10. UpdateBacklogItemDto — sin campo `type`
El DTO de actualización no tiene `type` (solo create). Enviarlo causa error 400 `property type should not exist`. Usar: `...(!editing && { type: form.type })`.

### 11. v_alignment_map — siempre DROP VIEW antes de recrear
`CREATE OR REPLACE VIEW` no puede agregar nuevas columnas a una vista existente. Usar `DROP VIEW IF EXISTS v_alignment_map; CREATE VIEW v_alignment_map AS ...`.

### 12. PDF con puppeteer — `@page` en CSS necesita escape en TS
En templates HTML dentro de template literals TypeScript, usar `@page { ... }` directamente (sin escape). El parser TS no tiene problema con `@` en strings.

---

## Migraciones SQL — catálogo completo

| Archivo | Contenido principal |
|---------|---------------------|
| `001_hito1_foundation.sql` | Tablas base, auth, tokens, audit_log, `sp_register_user`, `sp_refresh_token`, `fn_user_has_permission` |
| `002_hito2_teams.sql` | `teams`, `team_members`, `sp_create_team`, `v_team_tree`, `v_org_members` |
| `003_hito3_cycles.sql` | `cycles`, `sp_activate_cycle`, `sp_close_cycle`, `v_cycles_with_stats`, trigger unicidad |
| `004_hito4_objectives.sql` | `objectives`, `key_results`, `sp_create_objective`, `sp_create_key_result`, `fn_calculate_*`, `v_objectives_with_progress`, `v_key_results_with_trend`, `v_alignment_map` |
| `005_hito5_extended.sql` | `organizational_problems`, `strategic_intents`, `problem_intents`, `v_team_objectives`, `v_my_objectives` |
| `006_fix_auth_security.sql` | Email global único, `::INT` casts en vistas |
| `007_hito6_checkins.sql` | `check_ins`, `notifications`, `sp_create_check_in`, `trg_checkin_cascade_recalc`, `fn_predict_kr_completion`, vistas de cadencia |
| `008_hito7_initiatives.sql` | `initiatives`, `milestones`, `initiative_key_results`, `sp_create_initiative`, `fn_initiative_health`, vistas timeline |
| `009_hito8_sprints.sql` | `sprint_cycles`, `sprint_goal_krs`, `sp_close_sprint`, `fn_sprint_okr_impact`, `fn_calculate_burnup`, vistas sprint |
| `010_hito9_ai.sql` | `ai_briefings`, `ai_conversations`, `fn_compare_cycles`, `fn_run_scenario`, `v_mcp_audit_summary` |
| `011_hito10_reports.sql` | `v_executive_dashboard`, `v_cycle_health`, `v_team_health`, `v_portfolio_dashboard`, `v_weekly_trend`, `fn_generate_cycle_close_report`, `cycle_close_reports` |
| `012_hito11_security.sql` | RLS en 7 tablas, `fn_check_org_context`, 8 índices de performance |
| `013_hito12_deploy.sql` | `_sql_migrations` tracking table |
| `014_hito13_enterprise.sql` | `user_profiles`, `user_mfa_secrets`, `login_attempts`, `sp_update_user_profile`, `fn_check_login_attempts`, `sp_revoke_all_tokens`, `sp_export_user_data`, `sp_anonymize_user`, `v_security_audit` |
| `014b_pending_items.sql` | Fixes pendientes del QA |
| `015`–`019` | Mejoras de vistas, índices, fixes |
| `020_fix_strategic_intent.sql` | `strategic_intent_id` en `v_objectives_with_progress` |
| `021_objective_alignments.sql` | `objective_alignments` M:N, endpoints trazabilidad |
| `022_hierarchical_progress.sql` | `fn_calculate_objective_progress` jerárquica (hijos → padre) |
| `023_okr_user.sql` | ✅ APLICADO — `okr_user` non-superuser activo en ambos `.env` |
| `024`–`027` | Mejoras de seguridad, RLS, contexto de org |
| `028_governance_calendar.sql` | `fn_governance_calendar`, `fn_welcome_context` |
| `029b_governance_activities.sql` | Actividades de gobernanza personalizadas |
| `030_checkin_views_code.sql` | Actualización de vistas con campo `code` |
| `031_fix_report_views.sql` | Corrección de vistas de reportes |
| `032_areas_governance_org.sql` | `v_initiative_timeline` con áreas, `v_sprint_board` recreada |
| `033_welcome_context_codes.sql` | Códigos en contexto de bienvenida |
| `034_welcome_context_cycle_param.sql` | Parámetro de ciclo en welcome context |
| `035_fix_welcome_context_stats.sql` | Fix de estadísticas en welcome |
| `036_welcome_context_confidence.sql` | Confianza en welcome context |
| `037_delivery_management.sql` | Módulo de entregables (programs, phases, deliverables) |
| `038_traceability_links.sql` | `v_traceability_objective_links` |
| `039_global_search.sql` | `fn_global_search(org_id, query, limit)` — búsqueda global |
| `patch_alignment_map_extended.sql` | ✅ APLICADO — `v_alignment_map` 4 niveles COMPANY→AREA→TEAM→INDIVIDUAL con JSONB anidado |

---

## Módulos backend — mapa completo

```
backend/src/modules/
  auth/           — register, login, refresh, logout, me, MFA, switch-org
  organizations/  — GET/PATCH /me, members, team-tree
  teams/          — list, create, members CRUD
  cycles/         — GET/POST/PATCH, activate, close, score (close dispara generateCycleCloseBriefing)
  objectives/     — list, tree, alignment, CRUD, alignments M:N
  key-results/    — CRUD por objective
  check-ins/      — CRUD, historial, at-risk, cadencia, predicción, notificaciones
  initiatives/    — CRUD, milestones, link/unlink KRs, health, overdue
  backlog/        — CRUD ítems (EPIC/FEATURE/STORY), filtros
  sprints/        — CRUD, active, board, velocity, burnup, close, generate
  reports/
    GET /risk-dashboard
    GET /executive-briefing
    GET /alignment
    GET /executive-dashboard
    GET /cycle-health
    GET /team-health
    GET /portfolio
    GET /weekly-trend
    GET /upcoming-milestones
    GET /activity-feed
    POST /close-report/:cycleId
    GET /export-csv/:cycleId
    GET /export-pdf/:cycleId        ← puppeteer, HTML visual
    GET /export-pptx/:cycleId       ← pptxgenjs, 5 slides
    GET /security-audit
    GET /governance/pdf
    GET /governance
    POST/PATCH/DELETE /governance/activities
    GET /welcome-context
  ai/
    POST /okr-coach
    POST /checkin-assistant
    POST /risk-sentinel
    POST /alignment-audit
    POST /executive-briefing
    POST /strategy-advisor
    POST /delivery-advisor
    POST /suggest-delivery
    POST /suggest-okrs
    POST /suggest-initiatives
    POST /suggest-backlog
    POST /suggest-team-okrs     ← nuevo: OKRs para gaps de cobertura de equipos
    GET  /briefings
    GET  /briefings/:id
    GET  /conversations
  search/         — GET /search?q= → fn_global_search
  system/         — GET /system/status (PM2 + agentes)
  problems/       — CRUD diagnóstico organizacional
  strategic-intents/ — CRUD intenciones estratégicas
  governance/     — cuerpos de gobierno, miembros
  delivery/       — programas, fases, entregables (GET /upcoming)
  areas/          — áreas de la organización
  users/          — perfil, seguridad, privacidad, export-data
  admin/          — solo superadmin: listar orgs, switch-org
```

---

## Servicios backend clave

```
backend/src/modules/reports/
  reports.service.ts   — toda la lógica de reportes
  pdf.service.ts       — PdfService: htmlToPdf() con puppeteer + buildExecutivePptx() con pptxgenjs
                          Mantiene instancia de browser reutilizable (cierra en onModuleDestroy)

backend/src/modules/ai/
  ai.service.ts
    generateCycleCloseBriefing(orgId, cycleId) — fire-and-forget desde cycles.service al cerrar ciclo
    suggestTeamOkrsForGaps(orgId, cycleId)     — busca v_alignment_map WHERE team_count=0, pide a Claude sugerencias
```

---

## Frontend — mapa de páginas

```
src/app/(app)/
  welcome/           — Dashboard personalizado post-login
  getting-started/   — Guía de inicio: checklist 7 pasos interactivo (NUEVO 2026-05-12)
  problems/          — Diagnóstico organizacional (matriz severidad/frecuencia)
  strategy/          — Intenciones estratégicas
  cycles/            — Gestión de ciclos OKR
  strategic/         — OKRs estratégicos (lista + árbol + cobertura + OKR Coach AI)
  traceability/      — Trazabilidad visual (mapa bezier + árbol)
  tactical/          — OKRs tácticos + Mis OKRs
  checkins/          — Check-ins en riesgo + cadencia
  initiatives/       — Iniciativas (kanban + Gantt)
  delivery/          — Módulo de entregables
  backlog/           — Backlog ágil (EPIC/FEATURE/STORY)
  sprints/           — Sprint board + generación automática
  reports/           — Página índice de reportes (con datos live de milestones)
  reports/executive-dashboard/   — Dashboard + botones PDF y PPTX
  reports/executive-briefing/
  reports/risk-dashboard/
  reports/team-health/
  reports/portfolio/
  reports/upcoming-milestones/   — Milestones de iniciativas + entregables de delivery
  reports/governance/
  reports/guide/     — Guía del sistema (jerarquía completa, reglas, entornos)
  ai-assistant/      — Chat con Strategy Advisor
  settings/          — Settings jerárquico (Empresa, Mi Cuenta, Sistema)
```

---

## Frontend — componentes clave

```
src/components/
  layout/
    AppShell.tsx          — wrapper con Sidebar + TopBar + main content
    Sidebar.tsx           — 5 grupos + "Guía de inicio" en grupo home
    TopBar.tsx            — ciclo activo + trigger búsqueda Ctrl+K + tema + notificaciones
    GlobalSearchDialog.tsx — Command Palette (portal, backdrop-blur, Ctrl+K, accesos rápidos, teclado)
    NotificationsBell.tsx — campana con badge + dropdown

  backlog/
    BacklogItemDialog.tsx — Dialog compartido create/edit para EPIC/FEATURE/STORY
    backlog-config.ts     — TYPE_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, STORY_POINTS, templates AC

  sprints/
    SprintBoard.tsx       — Board con STATUS_PILLS, AC readiness, edit inline
    GenerateSprintsDialog.tsx — Generación automática de sprints

  okr/
    OkrCoachPanel.tsx        — evaluación en tiempo real (debounce 800ms)
    OkrTreeView.tsx          — árbol SVG bezier, colapsable, colores por nivel
    AlignmentCoveragePanel.tsx — cobertura 4 niveles + gaps alert + sugerencias IA
    TraceabilityView.tsx     — vista mapa bezier SVG con showAllRelations toggle
    TraceabilityPyramid.tsx  — vista pirámide 6 bandas, cadena bidireccional (NUEVO 2026-05-19)
    ProgressRing.tsx         — círculo SVG 0-100%
    StatusChip.tsx           — semáforo estado OKR
    ConfidenceMeter.tsx      — barra 0.0-1.0

  settings/
    MonitorTab.tsx        — estado PM2 + agentes (refresca 30s)
    TeamsSettingsPanel.tsx
    UsersTab.tsx

  shared/
    FilterToggle.tsx      — toggle de filtros reutilizable
    EmptyState.tsx
```

---

## Frontend — hooks clave

```
src/hooks/
  useAuth.ts           — useAuth(), useLogin(), useLogout()
  useCycles.ts         — useCycles(), useActiveCycle(), useCreateCycle(), useActivateCycle(), useCloseCycle()
  useObjectives.ts     — useObjectives(), useObjectiveTree(), useAlignmentMap(), useCreateObjective(), ...
                          AlignmentMapEntry: 4 niveles (area_objectives → team_objectives → individual_objectives)
  useKeyResults.ts     — useKeyResults(), useCreateKeyResult(), useUpdateKeyResult()
  useCheckIns.ts       — useAtRiskKRs(), useCadenceDashboard(), useCreateCheckIn(), useCheckInHistory()
  useInitiatives.ts    — useInitiatives(), useCreateInitiative(), useUpdateInitiative()
  useBacklog.ts        — useBacklog(), useCreateBacklogItem(), useUpdateBacklogItem(), useDeleteBacklogItem()
  useSprints.ts        — useSprints(), useSprintBoard(), useActiveSprint(), useGenerateSprints(), useCloseSprint()
  useGlobalSearch.ts   — useGlobalSearch(q) — debounced, enabled si q >= 2 chars
  useReports.ts        — useWelcomeContext(), useExecutiveDashboard(), useCycleHealth(), useTeamHealth(), useUpcomingMilestones()
  useDelivery.ts       — useUpcomingDeliverables(days) — entregables próximos
  useAI.ts             — useSuggestOkrs(), useSuggestInitiatives(), useSuggestTeamOkrs(), useDeliveryAdvisor(), ...
  useSystemStatus.ts   — estado PM2 + agentes (refresca 30s)
```

---

## Errores importantes (no repetir)

| Error | Causa | Solución |
|-------|-------|----------|
| `property type should not exist` al editar backlog item | `UpdateBacklogItemDto` no tiene `type`; NestJS forbidNonWhitelisted lo rechaza | `...(!editing && { type: form.type })` |
| `parent_id` no se actualiza al guardar | `"" \|\| undefined` omite el campo; backend no lo toca | `"" \|\| null` envía NULL explícitamente |
| `SyntaxError: missing ) after argument list` en PM2 Next.js | `.bin/next` es bash script, falla en Windows | Usar `node_modules/next/dist/bin/next` |
| `output: 'standalone'` + `next start` → 404 en `/_next/static` | standalone espera Nginx para servir estáticos | Eliminar `output: 'standalone'` de next.config.ts |
| `@Post('generate')` conflicto con `@Post()` | NestJS procesa rutas en orden; `generate` es absorbido por el genérico | Definir `@Post('generate')` ANTES de `@Post()` |
| `cookie-parser is not a function` | CommonJS default export | `import * as cookieParser from 'cookie-parser'` |
| `column "objective_id" ambiguous` en fn_update_key_result | Nombre ambiguo en UPDATE | `SELECT kr.objective_id INTO v_obj_id` en DECLARE |
| BigInt en vistas (COUNT retorna bigint) | pg retorna bigint como string | Añadir `::INT` en todos los COUNT() de vistas |
| `strategic_intent_id` NULL hardcoded | Migration 004 no incluía la columna | Agregar `o.strategic_intent_id` a la vista |
| `DialogContent` duplica Portal/Overlay | Ya lo incluye internamente | Usar solo `<DialogContent>` |
| `next dev` extremadamente lento (16s/página) | JIT compilation en cada visita | Usar `npm run build` + `next start` |
| `CREATE OR REPLACE VIEW` falla al agregar columnas | PostgreSQL no permite cambiar schema de vista existente | `DROP VIEW IF EXISTS v_nombre; CREATE VIEW ...` |
| `networkidle0` no es tipo válido en puppeteer v24 | API de puppeteer v24 solo acepta `'load' \| 'domcontentloaded'` | Usar `waitUntil: 'domcontentloaded'` |
| `opacity-55` no tiene efecto en Tailwind v3 | Tailwind v3 solo genera clases que existen explícitamente; 55 no está en la escala | Usar `opacity-50` |
| `inFilterView` / `isFiltering` usados antes de declararse dentro de `useLayoutEffect` | Las variables se declaraban después del hook pero se usaban dentro | Mover las declaraciones ANTES del `useLayoutEffect` |
| `svg` posiblemente null dentro de closure `drawEdge` | TypeScript no puede narrowing en funciones anidadas aunque se verificó arriba | Usar `svg!.appendChild(path)` (non-null assertion) |

---

## Pendientes (no críticos)

| Item | Estado |
|------|--------|
| UptimeRobot/BetterUptime | Endpoint `/api/v1/health` implementado y público. Pendiente crear monitor externo apuntando a `https://tudominio.com/api/v1/health` |
| Añadir a `_sql_migrations` las migraciones aplicadas manualmente | Para mantener el tracking sincronizado |

---

## Cómo operar el sistema

### Compilar y reiniciar todo
```powershell
# Backend
cd D:\estrategia\backend
npm run build
pm2 reload okr-backend-dev

# Frontend
cd D:\estrategia\frontend
npx next build
pm2 reload okr-frontend-dev
```

### Aplicar migración SQL
```powershell
# Dev
psql -U postgres -h 127.0.0.1 -d Estrategia_dev -f src/database/migrations/NNN_nombre.sql
# Password: Andres
```

### Ver logs
```powershell
pm2 logs okr-backend-dev --lines 50 --nostream
pm2 logs okr-frontend-dev --lines 20 --nostream
```

### Verificar estado
```powershell
pm2 list
```

### Verificar TypeScript (0 errores esperado)
```powershell
cd D:\estrategia\backend; npx tsc --noEmit
cd D:\estrategia\frontend; npx tsc --noEmit
```
