# Integración con Marcos Ágiles

## Principio
Los OKRs y Agile son complementarios, no competidores. OKRs definen el DESTINO, los sprints son el CAMINO. Este sistema vincula ambos sin forzar uno sobre el otro.

## Modelos de integración soportados

### Scrum
- Los sprints se mapean dentro del ciclo OKR (un Q tiene ~6 sprints de 2 semanas)
- El Sprint Goal se vincula a uno o más KRs del equipo
- El Sprint Backlog contiene iniciativas y user stories que mueven esos KRs
- La Retrospectiva de Sprint incluye revisión de progreso en KRs afectados

### Kanban
- Las iniciativas funcionan como cards de Kanban con estados
- El WIP limit aplica a nivel de iniciativas activas por KR
- Los check-ins se disparan por eventos (card completada) no por frecuencia fija

### SAFe (Scaled Agile Framework)
- PI Objectives se mapean a OKRs de área/programa
- Features → Iniciativas
- Stories → Tareas dentro de iniciativas (no gestionadas en este sistema)
- Program Increment = Ciclo OKR trimestral

### Sin metodología ágil
- Ver `06-non-agile-framework.md`

## Entidades adicionales para equipos ágiles

### SprintCycle
Representa un sprint dentro de un ciclo OKR.
```
id, cycleId, teamId, name,
startDate, endDate,
sprintGoal,         -- texto libre del objetivo del sprint
status (PLANNED|ACTIVE|COMPLETED),
velocity,           -- puntos completados (post-sprint)
plannedVelocity
```

### SprintGoalKR (tabla pivote)
Vincula un sprint goal con los KRs que impacta.
```
sprintCycleId, keyResultId, expectedContribution (%)
```

## Flujo ágil típico (Scrum)

```
Ciclo Q1 (enero-marzo)
  ├── Sprint 1 (sem 1-2)
  │     Goal: "Lanzar MVP de onboarding" → impacta KR "Tasa de activación"
  ├── Sprint 2 (sem 3-4)
  │     Goal: "Reducir tiempo de carga" → impacta KR "Performance score"
  └── ... (6 sprints por Q)
```

## Check-in automático desde sprint
Al cerrar un sprint, el sistema puede:
1. Proponer un check-in para los KRs vinculados al sprint goal
2. Pre-rellenar el valor con la velocidad o el % de historias completadas
3. El responsable del KR confirma o ajusta el valor antes de guardar

## Vistas ágiles

### Sprint Board
- Sprint activo del equipo con su sprint goal
- KRs impactados y progreso actual vs objetivo del sprint
- Iniciativas en el sprint (kanban: To Do / In Progress / Done)

### Burn-up de OKRs por sprint
- Gráfico que muestra el progreso acumulado del KR sprint a sprint
- Proyección de cierre al ritmo actual
- Comparativa con target ideal (línea recta)

### Retrospectiva integrada
- Al cerrar sprint: formulario con preguntas de retro estándar + campo de impacto en OKRs
- El dato queda vinculado al sprint y al ciclo OKR

## Reglas de negocio ágiles
- Un sprint pertenece a un solo equipo y a un solo ciclo OKR
- Un KR puede estar vinculado a múltiples sprints (impacto distribuido)
- Si se cierra un ciclo con sprints ACTIVE → los sprints pasan a COMPLETED automáticamente
- La velocidad planificada vs real se reporta en el dashboard de cadencia del equipo
