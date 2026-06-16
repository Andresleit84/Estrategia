# Arquitectura MCP (Model Context Protocol)

## ¿Qué es MCP en este sistema?
El MCP Server expone las capacidades del sistema OKR como herramientas que los agentes de IA (Claude) pueden usar de forma segura y controlada. Es la capa de integración entre la IA y los datos de negocio.

## Diagrama completo

```
┌─────────────────────────────────────────────────────────┐
│                     USUARIO                             │
│         (browser — Next.js Web App)                     │
└────────────┬────────────────────────┬───────────────────┘
             │ HTTP/WS REST           │ AI Chat UI
             │                        │
┌────────────▼────────────┐  ┌────────▼────────────────────┐
│   NestJS REST API       │  │   Claude API (Anthropic)    │
│   /api/v1/*             │  │   claude-3-5-sonnet-latest  │
│                         │  │                             │
│   ┌─────────────────┐   │  │   System Prompt + Context   │
│   │  Business Logic │   │  │   Tool calls via MCP        │
│   │  Modules        │   │  └────────────┬────────────────┘
│   └────────┬────────┘   │               │ MCP Protocol
│            │            │  ┌────────────▼────────────────┐
│   ┌────────▼────────┐   │  │   MCP Server (NestJS)       │
│   │  Prisma ORM     │◄──┼──│   /mcp/*                    │
│   └────────┬────────┘   │  │                             │
└────────────┼────────────┘  │   Tools expuestas:          │
             │               │   - list_objectives         │
┌────────────▼────────────┐  │   - get_key_result_details  │
│      PostgreSQL         │  │   - get_checkin_history     │
│                         │  │   - predict_completion      │
│   ┌──────────────────┐  │  │   - analyze_alignment       │
│   │  Row Level       │  │  │   - create_checkin (write)  │
│   │  Security        │  │  │   - run_scenario            │
│   └──────────────────┘  │  │   - generate_summary        │
└─────────────────────────┘  └─────────────────────────────┘
             ▲                            │
┌────────────┴────────────┐               │ Audit log
│  Redis (Cache + Queue)  │◄──────────────┘
│  - AI call rate limits  │
│  - Agent job queue      │
│  - Response cache       │
└─────────────────────────┘
```

## Estructura del MCP Server

### Ubicación
```
backend/src/mcp/
├── mcp.module.ts
├── mcp.server.ts          ← registro de herramientas
├── guards/
│   └── mcp-auth.guard.ts  ← valida JWT + permisos antes de cada tool call
├── tools/
│   ├── objectives.tools.ts
│   ├── key-results.tools.ts
│   ├── check-ins.tools.ts
│   ├── analysis.tools.ts  ← predict, scenario, alignment
│   └── reports.tools.ts
└── audit/
    └── mcp-audit.service.ts ← log de todas las llamadas AI
```

## Herramientas MCP expuestas

### Herramientas de lectura (READ)
```typescript
list_objectives(cycleId, level?, teamId?, status?)
  → Objective[] con KRs resumidos

get_objective_details(objectiveId)
  → Objective con KRs completos + historial de check-ins

list_key_results(objectiveId)
  → KeyResult[] con métricas actuales

get_checkin_history(keyResultId, limit?)
  → CheckIn[] ordenados por fecha desc

get_alignment_map(cycleId)
  → árbol completo de cascada con % cobertura

get_team_okr_health(teamId, cycleId)
  → resumen de salud: KRs on track / at risk / behind / completed
```

### Herramientas de análisis (ANALYSIS)
```typescript
predict_completion(keyResultId)
  → { probability: 0-1, projectedValue: number, projectedDate: Date, trend: 'up'|'flat'|'down' }
  Algoritmo: regresión lineal sobre los últimos N check-ins

analyze_alignment_gaps(cycleId)
  → { coveredKRs: [], uncoveredKRs: [], alignmentScore: 0-100 }

compare_periods(cycleId1, cycleId2)
  → { delta: {}, topImprovers: [], topDecliners: [] }

run_scenario(keyResultId, assumptions)
  → { scenarios: [{name, probability, projectedValue}] }
  Simula 3 escenarios: optimista / base / pesimista

validate_okr_quality(title, description, type, targetValue, metricUnit)
  → { score: 0-10, issues: [], suggestions: [] }
```

### Herramientas de escritura (WRITE — requieren confirmación del usuario)
```typescript
create_checkin(keyResultId, currentValue, confidence, notes, mood?)
  → CheckIn creado + progreso recalculado

update_key_result_confidence(keyResultId, confidence, reason)
  → KeyResult actualizado

flag_kr_at_risk(keyResultId, reason)
  → KR marcado AT_RISK + notificación al owner del objetivo
```

### Herramientas de generación (GENERATE)
```typescript
generate_executive_summary(cycleId, periodType: 'weekly'|'monthly'|'cycle-close')
  → { summary: string, highlights: [], risks: [], recommendations: [] }

generate_okr_suggestions(context: { teamId, cycleId, areaObjectives[] })
  → { suggestedObjectives: [{ title, rationale, suggestedKRs[] }] }
```

## Seguridad del MCP Server

### Autenticación
- Cada llamada al MCP Server requiere un token JWT válido
- El token define el `organizationId` y `userId` — todas las queries aplican estos filtros automáticamente
- Un agente nunca puede acceder a datos de otra organización

### Autorización por herramienta
```
MEMBER    → solo tools READ del scope de su equipo
ADMIN     → todas las tools READ + tools ANALYSIS de toda la organización
OWNER     → acceso completo incluidas tools WRITE y GENERATE
```

### Audit Trail
Cada tool call registra en tabla `McpAuditLog`:
```
id, organizationId, userId, toolName, inputHash, outputSummary,
tokensUsed, durationMs, success, createdAt
```

### Rate Limiting
- Plan básico: 100 AI tool calls / día / organización
- Plan pro: 1.000 AI tool calls / día
- Plan enterprise: sin límite con fair-use policy
- Redis gestiona los contadores con TTL de 24h

## Configuración del cliente MCP en frontend
```typescript
// frontend/src/lib/mcp-client.ts
// El AI Chat hace streaming de responses usando el SDK de Anthropic
// con las tools del MCP Server como herramientas disponibles
const client = new Anthropic();
const tools = await fetchMCPTools(session.token); // from /mcp/tools
```

## Variables de entorno adicionales para MCP/AI
```env
ANTHROPIC_API_KEY=sk-ant-...
AI_DEFAULT_MODEL=claude-3-5-sonnet-latest
AI_HEAVY_MODEL=claude-3-5-sonnet-latest
AI_FAST_MODEL=claude-3-5-haiku-latest
AI_MAX_TOKENS=4096
AI_RATE_LIMIT_DAILY=100
MCP_SERVER_PATH=/mcp
```
