# Benchmark — Decisiones de Stack

## Análisis de herramientas OKR existentes
| Herramienta | Fortalezas | Debilidades | Precio |
|-------------|-----------|-------------|--------|
| Workboard | Completo, enterprise | Caro, complejo UX | $$$$ |
| Perdoo | Buen UX, cascada clara | Sin ágil nativo | $$$ |
| Lattice | RRHH integrado | No es foco OKR | $$$ |
| Gtmhub (Quantive) | Integración Jira | Curva de aprendizaje | $$$ |
| 15Five | Simple, check-ins | Poco estratégico | $$ |
| Notion / Excel | Flexible, barato | Sin automatización | $ |

**Oportunidad**: un sistema que cubra cascada completa + modo ágil/tradicional + precio accesible para LATAM.

---

## Stack tecnológico — decisión final

### Backend: NestJS vs alternativas
| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| **NestJS** | TypeScript nativo, modular, decorators, DI, WebSockets built-in, gran ecosistema | Verboso, curva media | ✅ ELEGIDO |
| Express.js | Simple, flexible | Sin estructura forzada, TypeScript manual | ❌ |
| FastAPI (Python) | Rápido, autodocs | Cambio de lenguaje vs frontend | ❌ |
| Hono | Ultra ligero, Edge-ready | Ecosistema joven, menos plugins | ❌ para este scope |

**Razón NestJS**: el sistema tiene muchos módulos (auth, RBAC, WebSockets, CRON jobs para alertas). NestJS fuerza una estructura que escala bien en equipo.

### Frontend: Next.js vs alternativas
| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| **Next.js 14 (App Router)** | SSR/SSG, Server Actions, ecosistema React, Vercel | Complejidad App Router | ✅ ELEGIDO |
| Remix | Excelente para data-heavy | Ecosistema más pequeño | ❌ |
| SvelteKit | Ligero, DX excellent | Menos librerías enterprise UI | ❌ |
| Vite + React SPA | Simple | Sin SSR, SEO limitado | ❌ |

**Razón Next.js**: dashboards con Server Components para cargas rápidas, Route Handlers para APIs simples, Image Optimization nativa.

### ORM: Prisma vs alternativas
| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| **Prisma** | DX excelente, type-safe, migrations, Studio UI | Algo lento en queries complejas | ✅ ELEGIDO |
| Drizzle | Más rápido, SQL-like | Más joven, menos maduro | ❌ (futuro posible) |
| TypeORM | Maduro, decorators | DX inferior, bugs conocidos | ❌ |
| MikroORM | Sólido | Menos comunidad | ❌ |

### Base de datos: PostgreSQL
Decisión unánime. Justificación:
- JSON/JSONB para datos flexibles (configuración de org, metadata de KRs)
- Full-text search nativo para buscar OKRs
- Row Level Security (RLS) para multi-tenancy
- Madurez, confiabilidad, herramientas de gestión
- Compatible con Supabase si se quiere BaaS en el futuro

### UI Component Library
| Opción | Pros | Decisión |
|--------|------|----------|
| **shadcn/ui** | Headless, copy-paste, Tailwind, accesible | ✅ ELEGIDO |
| Ant Design | Completo pero pesado | ❌ |
| Chakra UI | Buen DX | Tailwind incompatible | ❌ |
| MUI | Enterprise look | Pesado, override difícil | ❌ |

### Estado global
- **Zustand**: estado de cliente (UI state, sesión)
- **TanStack Query v5**: estado del servidor (fetching, caching, invalidation)
- No Redux: overkill para este scope

### Visualizaciones / Charts
- **Recharts**: gráficos de progreso, burn-up, trend lines
- **@nivo/radar**: radar chart para salud de equipo
- Alternativa futura: Observable Plot para análisis avanzado

### Autenticación
- **JWT + Refresh Tokens** (implementación propia con NestJS)
- Futuro: OAuth (Google Workspace, Microsoft 365) para SSO enterprise

### Despliegue recomendado
| Componente | Opción 1 (Simple) | Opción 2 (Escalable) |
|------------|------------------|---------------------|
| Frontend | Vercel | AWS CloudFront + S3 |
| Backend | Railway / Render | AWS ECS / Fargate |
| DB | Supabase (Postgres) | AWS RDS |
| Redis | Upstash | AWS ElastiCache |

**Para arrancar**: Vercel (frontend) + Railway (backend + DB). Migración a AWS cuando escale.

---

## Conclusión del benchmark
El stack NestJS + Next.js + Prisma + PostgreSQL es el estándar para sistemas SaaS enterprise en TypeScript en 2025. Combina productividad de desarrollo, type-safety end-to-end, y capacidad de escala. La curva de aprendizaje inicial (NestJS decorators, App Router) se amortiza rápido por la estructura forzada que facilita el trabajo en equipo.
