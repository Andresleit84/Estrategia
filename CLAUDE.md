# OKR System — CLAUDE.md

Piensa antes de actuar. Lee los archivos antes de escribir código.
Edita solo lo que cambia, no reescribas archivos enteros.
No releas archivos que ya hayas leído salvo que hayan cambiado.
No repitas código sin cambios en tus respuestas.
Sin preámbulos, sin resúmenes al final, sin explicar lo obvio.
Testea antes de dar por terminado.
No quiero que me consultes nada, construye tu, toma la mejor decision como experto

VERACIDAD ABSOLUTA
Nunca inventes información.
Nunca asumas datos que no te he dado.
Si no sabes algo, di claramente: “No lo sé”.
Si tienes dudas o la información es incompleta, dilo explícitamente.
No completes espacios con suposiciones.

CERO ALUCINACIONES
No generes datos falsos, nombres, cifras, estudios o referencias inexistentes.
No cites fuentes si no estás completamente seguro de que existen.
No intentes sonar convincente si no tienes certeza.

TRANSPARENCIA
Si tu respuesta se basa en suposiciones o probabilidades, indícalo claramente.
Diferencia entre hechos, estimaciones y opiniones.

PRECISIÓN SOBRE ELOCUENCIA
Prioriza ser correcto antes que sonar bien.
Evita rellenar con información innecesaria o ambigua.

TONO HUMANO Y NATURAL
Escribe como una persona inteligente hablándole a otra.
Evita lenguaje robótico, formal en exceso.
Sé claro, directo y fácil de entender.


## Proyecto
Sistema de gestión OKR de alta calidad técnica para empresas ágiles y no ágiles. Cubre capa estratégica (empresa/área) y táctica (equipo/individual), con agentes de IA integrados vía MCP y UX de primer nivel.

## Stack tecnológico
- **Backend**: NestJS (TypeScript) — REST API + WebSockets + MCP Server
- **Frontend**: Next.js 14 (App Router, TypeScript)
- **Base de datos**: PostgreSQL (con RLS y full-text search)
- **ORM**: Prisma
- **Cache / Queue**: Redis + BullMQ
- **Auth**: JWT (HttpOnly cookies) + Refresh tokens rotantes
- **UI**: Tailwind CSS + shadcn/ui + Design System propio
- **State**: Zustand + TanStack Query v5 + TanStack Virtual
- **Charts**: Recharts + @nivo/radar
- **IA**: Claude API (Anthropic SDK) vía MCP — sonnet-4-6 / opus-4-7 / haiku-4-5
- **Accesibilidad**: WCAG 2.1 AA

## Despliegue — instalación local en servidor (sin Docker)
- **Proceso manager**: PM2 (cluster mode) — config en `ecosystem.config.js`
- **Reverse proxy**: Nginx — config en `nginx/`
- **PostgreSQL**: instalado directamente en el servidor
- **Redis**: instalado directamente en el servidor
- **SSL**: Let's Encrypt (Certbot)
- Guía completa paso a paso: `INSTALL.md` (se actualiza en cada hito)
- Scripts de mantenimiento: `scripts/` (deploy, backup, restore, migrate, logs)
- Logs de PM2: `logs/`

## Estructura
```
backend/
  src/
    modules/       — auth, orgs, cycles, objectives, key-results, check-ins, initiatives, teams, reports
    mcp/           — MCP Server: tools, guards, audit
    ai/            — agentes autónomos (Risk Sentinel, Briefer, Auditor)
    common/        — guards, decorators, filters
  prisma/          — schema.prisma (fuente de verdad del modelo)
frontend/
  src/
    app/           — rutas Next.js (App Router)
    components/    — componentes de negocio + componentes AI
    design-system/ — tokens, componentes base
    hooks/         — custom hooks
    lib/           — utils, mcp-client, api-client
nginx/             — configuración de Nginx (reverse proxy + SSL)
scripts/           — deploy.sh, backup.sh, restore.sh, migrate.sh, logs.sh
logs/              — logs de PM2 (generados en servidor, en .gitignore)
backups/           — backups de DB (generados en servidor, en .gitignore)
ecosystem.config.js — configuración de PM2
INSTALL.md         — guía de instalación completa (se actualiza con cada hito)
docs/
  context/         — leer antes de tocar lógica de negocio
  roadmap.md       — hitos activos
  benchmark.md     — decisiones de stack
```

## REGLA CRÍTICA — Database-First (NO negociable)
**Toda la lógica de negocio vive en PostgreSQL. El backend es un wrapper delgado.**

- Las consultas de lectura son **vistas** (`SELECT * FROM v_nombre`)
- Las operaciones de escritura son **procedimientos** (`CALL sp_nombre(...)`)
- Los cálculos automáticos son **triggers** (progreso, estados, cascadas)
- La validación de reglas de negocio es **funciones** (`SELECT fn_nombre(...)`)
- **Prohibido** calcular progreso, evaluar estados o aplicar reglas en TypeScript
- **Prohibido** usar `prisma.tabla.findMany({ include: {...} })` para lógica compleja
- Prisma se usa **solo** para migraciones de esquema de tablas
- Las queries van con `pg` (node-postgres) directo: `db.query('SELECT * FROM v_...', [params])`

Ver `docs/context/10-database-first.md` para el catálogo completo de objetos de DB.

## Contexto clave — leer antes de codear
| Archivo | Cuándo leerlo |
|---------|---------------|
| `docs/context/10-database-first.md` | Antes de cualquier línea de lógica de negocio |
| `docs/context/02-data-model.md` | Antes de cualquier módulo backend |
| `docs/context/07-ai-agents.md` | Antes de tocar módulo `ai/` o `mcp/` |
| `docs/context/08-ux-ui-standards.md` | Antes de crear cualquier componente UI |
| `docs/context/09-mcp-architecture.md` | Antes de agregar MCP tools |
| `docs/roadmap.md` | Al iniciar cada sesión — marcar hitos completados |

## Estándares de calidad — NO negociables
### Seguridad
- JWT en HttpOnly cookies — nunca en localStorage
- Todos los DTOs tienen validación con class-validator
- Guard global activo — cada endpoint nuevo necesita ser explícitamente público si aplica
- organizationId inyectado desde el token en cada request (nunca desde el body)
- Las MCP tools de escritura requieren confirmación del usuario antes de ejecutar
- Audit log en cada acción de agente IA

### Performance
- LCP < 2.5s, INP < 200ms, CLS < 0.1
- Paginación cursor-based (nunca offset en listas grandes)
- Cache en Redis para queries de dashboard (TTL 5 min)
- Jobs pesados en BullMQ (nunca bloquear el event loop)
- Bundle JS inicial < 150KB gzip

### UX/UI
- Empty states con acción en toda pantalla vacía
- Skeleton loaders (nunca spinners genéricos)
- Feedback optimista en todas las acciones de escritura
- Dark mode funcional desde el día 1
- Accesibilidad: focus visible, ARIA labels, contraste AA

## Convenciones de código
- Nombres en inglés en código, español en docs
- Fechas en ISO 8601 (UTC) — siempre
- IDs: UUID v4
- Progreso: 0-100 enteros en UI, floats en cálculos
- Confianza KR: 0.0–1.0 (estilo Google OKRs)
- Endpoints: `/api/v1/{recurso}` (plural, kebab-case)
- Módulo NestJS: `controller` + `service` + `dto/` — sin lógica en el service, solo llamadas a DB
- Componente React: PascalCase, un componente por archivo
- Hooks: `use` prefix, en `hooks/`

## Convenciones de objetos de base de datos
- Vistas: prefijo `v_` (ej. `v_objectives_with_progress`)
- Funciones: prefijo `fn_` (ej. `fn_calculate_kr_progress`)
- Procedimientos: prefijo `sp_` (ej. `sp_create_check_in`)
- Triggers: prefijo `trg_` (ej. `trg_checkin_cascade_recalc`)
- Índices: prefijo `idx_` (ej. `idx_objectives_cycle_org`)
- Todo en snake_case, nombres descriptivos en inglés

## Variables de entorno
Ver `.env` para todas las variables. Las que empiezan con `AI_` o `ANTHROPIC_` son para la capa de IA. **Nunca hardcodear credenciales.**

## Layout frontend — reglas NO negociables (2026-04-27)

### Cadena de altura
`html/body/Providers` usan `h-full`. **Nunca usar `min-h-screen`** dentro de esta cadena — rompe el layout.

### AppShell wrapper
El `<main>` de AppShell tiene dos modos según la ruta:
- **Constrained** (default): `max-w-5xl w-full min-h-full` — para páginas de cards/listas/formularios
- **Full-width**: `w-full min-h-full` — para páginas canvas/tablero que necesitan todo el ancho del monitor

Las rutas full-width están definidas en `FULL_WIDTH_ROUTES` en AppShell.tsx:
`/traceability`, `/backlog`, `/reports`, `/portfolio`, `/program`, `/delivery`, `/sprints`

Para agregar una nueva ruta full-width, añadirla a ese array. No editar el wrapper por página.

### Flex containers
- Siempre `min-w-0` en `flex-1` horizontal para evitar desbordamiento lateral
- Siempre `min-h-0` en `flex-1` vertical para que `overflow-y-auto` funcione (regla del sidebar)

### Grids con columnas fijas
```tsx
// Siempre responsive:
<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
```

Ver `docs/context/08-ux-ui-standards.md` sección "Layout del shell" para detalles completos.

## Agentes de IA disponibles
- **OKR Coach** — inline al crear/editar OKRs
- **Risk Sentinel** — automático (nightly cron)
- **Alignment Auditor** — al publicar ciclo o crear OKR de equipo
- **Check-in Assistant** — en el drawer de check-in
- **Executive Briefer** — semanal (Monday cron) + al cerrar ciclo
- **Strategy Advisor** — chat bajo demanda en `/ai-assistant`

Ver `docs/context/07-ai-agents.md` para diseño completo.
