# Modelo de Datos

## Entidades core

### Organization
Empresa o unidad de negocio independiente (multi-tenant root).
```
id, name, slug, plan, createdAt, updatedAt
```

### User
```
id, organizationId, email, passwordHash, name, avatarUrl, role (OWNER|ADMIN|MEMBER), createdAt
```

### Team
```
id, organizationId, name, description, parentTeamId (árbol de equipos), ownerId
```

### Cycle (Ciclo OKR)
Período de tiempo con inicio/fin. Puede ser anual, trimestral, mensual o personalizado.
```
id, organizationId, name, type (ANNUAL|QUARTERLY|MONTHLY|CUSTOM), startDate, endDate, status (DRAFT|ACTIVE|CLOSED)
```

### Objective (Objetivo)
El "qué" queremos lograr. Puede ser de empresa, área, equipo o individual.
```
id, organizationId, cycleId, parentObjectiveId (cascada), ownerId, teamId,
title, description, level (COMPANY|AREA|TEAM|INDIVIDUAL),
status (DRAFT|ACTIVE|CLOSED|CANCELLED),
progress (0-100, calculado desde KRs),
createdAt, updatedAt
```

### KeyResult (Resultado Clave)
El "cómo" medimos el éxito del objetivo. Métrica concreta y medible.
```
id, objectiveId, ownerId,
title, description,
type (INCREASE|DECREASE|MAINTAIN|ACHIEVE),
metricUnit (%, $, #, custom),
startValue, targetValue, currentValue,
confidence (0.0-1.0),
progress (calculado),
status (ON_TRACK|AT_RISK|BEHIND|COMPLETED|CANCELLED),
createdAt, updatedAt
```

### Initiative (Iniciativa)
Proyecto o conjunto de tareas que contribuyen a un KR. Puente entre OKRs y ejecución.
```
id, keyResultId, teamId, ownerId,
title, description,
status (BACKLOG|IN_PROGRESS|DONE|CANCELLED),
startDate, dueDate,
progress (0-100),
-- Para empresas ágiles:
sprintId (nullable), epicId (nullable), storyPoints (nullable)
```

### CheckIn
Actualización periódica del progreso de un KeyResult.
```
id, keyResultId, userId,
currentValue, confidence (0.0-1.0),
notes, mood (GREAT|GOOD|NEUTRAL|BAD),
createdAt
```

### SprintCycle (Solo empresas ágiles)
Vinculación entre sprints y ciclos OKR.
```
id, cycleId, teamId,
name, startDate, endDate,
velocity (nullable), status (PLANNED|ACTIVE|COMPLETED)
```

## Relaciones clave
```
Organization → 1:N → Cycles
Organization → 1:N → Teams
Cycle → 1:N → Objectives
Objective → 1:N → Objectives (parentObjectiveId — cascada)
Objective → 1:N → KeyResults
KeyResult → 1:N → Initiatives
KeyResult → 1:N → CheckIns
Cycle → 1:N → SprintCycles (opcional, para ágiles)
```

## Cálculo de progreso
- **KeyResult.progress**: derivado de (currentValue - startValue) / (targetValue - startValue) × 100
- **Objective.progress**: promedio ponderado de sus KRs activos
- **Cycle progress**: promedio de objetivos de nivel COMPANY del ciclo

## Soft delete
Todas las entidades usan `deletedAt` (nullable) en lugar de borrado físico.
