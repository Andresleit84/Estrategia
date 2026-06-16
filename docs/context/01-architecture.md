# Arquitectura del Sistema

## Diagrama completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USUARIO (Browser)                            │
│                     Next.js 14 — App Router                         │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│   │  Dashboard  │  │  AI Chat UI  │  │  Reports / Exports        │ │
│   │  OKRs       │  │  (streaming) │  │  PDF / CSV                │ │
│   └──────┬──────┘  └──────┬───────┘  └──────────┬────────────────┘ │
└──────────┼────────────────┼─────────────────────┼──────────────────┘
           │ HTTP REST       │ Anthropic SDK        │ HTTP REST
           │ WebSocket       │ (streaming SSE)      │
           ▼                 ▼                      │
┌──────────────────────────────────────────────────▼──────────────────┐
│                     NestJS API — Puerto 3001                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  REST API  /api/v1/*                                         │   │
│  │  auth | organizations | cycles | objectives | key-results    │   │
│  │  initiatives | check-ins | teams | reports                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  MCP Server  /mcp/*                                          │   │
│  │  Herramientas expuestas a los agentes de IA:                 │   │
│  │  list_objectives | get_kr_details | get_checkin_history      │   │
│  │  predict_completion | analyze_alignment | run_scenario        │   │
│  │  create_checkin | generate_summary | validate_okr_quality     │   │
│  │                                                              │   │
│  │  Guards: JWT + RBAC + Rate Limit + Audit Log                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  AI Agents (NestJS services + cron jobs)                     │   │
│  │  Risk Sentinel | Alignment Auditor | Executive Briefer       │   │
│  │  Invocan Claude API internamente con MCP tools               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────┐   ┌─────────────────────────────────┐   │
│  │  pg (node-postgres)    │   │  WebSocket Gateway (WS)         │   │
│  │  db.query(view/sp/fn)  │   │  notificaciones en tiempo real  │   │
│  │  Prisma: solo migrate  │   └─────────────────────────────────┘   │
│  └────────────┬───────────┘                                          │
└───────────────┼──────────────────────────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
┌──────────────────┐  ┌──────────────┐
│   PostgreSQL     │  │    Redis     │
│                  │  │              │
│  TABLAS          │  │ - Sessions   │
│  VISTAS (v_)     │  │ - Rate limit │
│  FUNCIONES (fn_) │  │ - AI cache   │
│  PROCS (sp_)     │  │ - Job queue  │
│  TRIGGERS (trg_) │  └──────────────┘
│  AUDIT LOG       │
│  RLS por orgId   │
└──────────────────┘
                            │
                    ┌───────▼────────────────────┐
                    │  Claude API (Anthropic)     │
                    │  claude-sonnet-4-6 (default)│
                    │  claude-opus-4-7 (heavy)    │
                    │  claude-haiku-4-5 (fast)    │
                    └────────────────────────────┘
```

## Capas de la aplicación

### Frontend (Next.js 14 — App Router)
- `app/(auth)/` — login, registro, recuperación
- `app/(dashboard)/strategic/` — OKRs de empresa y área
- `app/(dashboard)/tactical/` — OKRs de equipo e individuales
- `app/(dashboard)/teams/` — equipos y roles
- `app/(dashboard)/reports/` — dashboards ejecutivos
- `app/(dashboard)/ai-assistant/` — chat con Strategy Advisor
- `app/(dashboard)/settings/` — organización, ciclos, configuración
- `design-system/` — tokens, componentes base

### Backend (NestJS) — capa delgada de orquestación
Los servicios de NestJS **no contienen lógica de negocio**. Son wrappers que:
1. Validan el DTO entrante (class-validator)
2. Verifican permisos (guard + `fn_user_has_permission`)
3. Llaman a la vista, función o procedimiento correspondiente en PostgreSQL
4. Devuelven el resultado formateado

**Módulos de negocio:**
- `auth` — JWT, refresh tokens, RBAC
- `organizations` — multi-tenancy
- `cycles` — ciclos OKR → llama `sp_activate_cycle`, `sp_close_cycle`
- `objectives` — jerarquía → llama `sp_create_objective`, `v_objectives_with_progress`
- `key-results` — KRs → llama `sp_create_key_result`, `v_key_results_with_trend`
- `initiatives` — proyectos → llama `v_initiative_timeline`
- `check-ins` — progreso → llama `sp_create_check_in` (el trigger hace el resto)
- `teams` — membresías → llama `sp_invite_user`
- `reports` — dashboards → llama `v_executive_dashboard`, `v_cycle_health`, `v_team_health`

**Módulo MCP:**
- `mcp/` — MCP Server con todas las herramientas
- `mcp/guards/` — autenticación + autorización + rate limiting
- `mcp/audit/` — log completo de llamadas AI

**Módulo AI:**
- `ai/` — agentes autónomos (Risk Sentinel, Briefer, Auditor)
- `ai/cron/` — tareas programadas (nightly risk scan, weekly briefing)

### Base de datos
PostgreSQL con:
- Row Level Security (RLS) por `organizationId` en tablas críticas
- Índices en: `(organizationId, cycleId)`, `(objectiveId, status)`, `(keyResultId, createdAt)`
- Full-text search en title/description de objectives con `tsvector`
- Tabla `McpAuditLog` para trazabilidad de acciones AI

## Patrones arquitectónicos

- **Multi-tenant**: organizationId en cada query, RLS como segunda línea
- **CQRS ligero**: servicios de lectura optimizados separados de escritura en objectives y reports
- **Event-driven**: check-ins emiten eventos internos → recalculan progreso → notifican vía WS
- **RBAC**: roles por organización (OWNER/ADMIN/MEMBER) + roles por equipo
- **MCP-first AI**: la IA solo accede a datos vía MCP tools — nunca directamente a la DB
- **Prompt caching**: contextos frecuentes cacheados en Anthropic para reducir costos

## Seguridad

### Autenticación y sesiones
- JWT (15 min) + Refresh Token (7 días, rotación en cada uso)
- Refresh tokens almacenados en Redis (revocables instantáneamente)
- HttpOnly cookies para tokens (no accesibles desde JS)

### Autorización
- Guard global en NestJS (todos los endpoints protegidos por defecto)
- Decorator `@Roles()` para restricción por rol
- Middleware de tenancy: inyecta `organizationId` desde el token en cada request

### API hardening
- Rate limiting: 100 req/min por IP, 1000 req/min por token
- Helmet.js: headers de seguridad (CSP, HSTS, X-Frame-Options)
- CORS: solo `FRONTEND_URL` permitido
- class-validator en todos los DTOs (no llega dato sin validar)
- Sanitización de inputs (strip HTML, prevent SQL injection via Prisma)

### MCP hardening
- Todas las tool calls requieren JWT válido
- Las tools de escritura requieren confirmación explícita del usuario
- Rate limiting separado para calls de AI (Redis)
- Audit log inmutable de todas las acciones AI

## Performance

### Backend
- Redis cache en queries de lectura frecuente (dashboard ejecutivo, alignment map)
- TTL: 5 min para datos de progreso, 24h para datos históricos
- Paginación cursor-based en todas las listas (no offset)
- Jobs pesados (generación de PDF, análisis AI) en cola BullMQ (Redis)

### Frontend
- Server Components para data inicial (sin waterfall)
- TanStack Query para revalidación y background refresh
- Virtualización de listas > 50 items
- Imágenes: next/image con lazy loading
- Code splitting por ruta automático (Next.js)
- Bundle target: < 150KB JS inicial (gzip)

## Observabilidad
- Logs estructurados en JSON con nivel (debug/info/warn/error)
- Tracing de requests con correlationId (propagado a logs de DB y AI)
- Métricas: tiempo de respuesta por endpoint, hit rate de cache, tokens AI usados
- Health check endpoint: `GET /health` (DB, Redis, AI API)
