# ADR-01 — Decisión de Stack Tecnológico

**Fecha**: 2026-04-22
**Estado**: Aceptado

## Contexto
Se necesita construir un sistema OKR completo para empresas ágiles y no ágiles. El sistema debe ser mantenible, escalable y construido con TypeScript end-to-end.

## Decisión
- **Backend**: NestJS (TypeScript)
- **Frontend**: Next.js 14 con App Router (TypeScript)
- **ORM**: Prisma
- **DB**: PostgreSQL
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand + TanStack Query v5
- **Charts**: Recharts + @nivo/radar

## Consecuencias positivas
- TypeScript end-to-end: los tipos del schema de Prisma se usan en NestJS y pueden compartirse con Next.js
- NestJS da estructura forzada que facilita escalar el equipo
- Next.js App Router + Server Components = dashboards rápidos sin fetching en cliente
- Prisma Studio permite inspeccionar datos sin SQL manual durante desarrollo

## Consecuencias negativas / trade-offs
- NestJS tiene más boilerplate que Express (compensado por la estructura)
- App Router de Next.js tiene curva de aprendizaje (Server vs Client components)
- Prisma puede tener N+1 queries en relaciones complejas → usar `include` con cuidado y agregar índices

## Alternativas consideradas
Ver `docs/benchmark.md` para análisis completo.
