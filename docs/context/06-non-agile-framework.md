# Integración con Empresas No Ágiles

## Principio
Las empresas con gestión tradicional (waterfall, por proyectos, funcional clásica) tienen ciclos más largos y procesos de planificación más formales. El sistema se adapta sin imponer terminología ágil.

## Diferencias clave vs empresas ágiles

| Aspecto | Empresa ágil | Empresa no ágil |
|---------|-------------|-----------------|
| Ciclo de planificación | Trimestral + sprints | Anual + revisiones |
| Frecuencia de check-in | Semanal | Mensual / quincenal |
| Unidad de ejecución | Sprint / Kanban | Proyecto / Hito |
| Vocabulario | Sprint Goal, Velocity | Hito, Entregable, Fase |
| Estructura de equipo | Squads cross-funcionales | Departamentos funcionales |

## Configuración para empresas no ágiles

### Ciclos recomendados
- Ciclo principal: ANNUAL (plan estratégico del año)
- Sub-ciclos: QUARTERLY para revisiones intermedias
- Sin SprintCycles (módulo desactivable por organización)

### Iniciativas como proyectos
En lugar de sprints, las iniciativas funcionan como proyectos con:
```
Initiative
  ├── Fases (milestones)
  │     ├── Hito 1: Diagnóstico (fecha)
  │     ├── Hito 2: Diseño (fecha)
  │     └── Hito 3: Implementación (fecha)
  └── Responsable + equipo involucrado
```

### Milestone (Hito de proyecto)
Entidad adicional para empresas no ágiles:
```
id, initiativeId, title, dueDate,
status (PENDING|COMPLETED|DELAYED),
deliverable (descripción del entregable)
```

## Flujo de trabajo no ágil

### Planificación anual
1. Dirección define OKRs de empresa para el año
2. Cada área define sus OKRs anuales en cascada
3. Los equipos/departamentos definen proyectos (iniciativas) que soportan los KRs
4. Se establecen hitos trimestrales por proyecto

### Seguimiento mensual
- Business Review mensual: revisión de KRs de área
- Reporte de hitos: qué milestones se completaron, cuáles se retrasaron
- Actualización de confianza por parte de los responsables

### Revisión trimestral
- Revisión de OKRs de empresa (¿seguimos en el camino correcto?)
- Ajuste de iniciativas si el contexto cambió
- Re-planificación del siguiente trimestre si es necesario

### Cierre anual
- Score final de cada KR y objetivo
- Análisis de causas: logrado / parcial / no logrado
- Inputs para la planificación estratégica del siguiente año

## Vistas específicas para no ágiles

### Gantt de iniciativas
- Vista de línea de tiempo de todos los proyectos activos
- Hitos marcados en la línea de tiempo
- Código de color: en tiempo / en riesgo / retrasado

### Dashboard de portfolio
- Todos los proyectos/iniciativas de la organización por área
- Estado de avance vs plan original
- KRs afectados por cada proyecto

### Reporte ejecutivo mensual
- Progreso de OKRs por área en tabla de resumen
- Semáforo por KR: verde / amarillo / rojo
- Hitos del mes: completados y pendientes
- Próximos hitos críticos

## Configuración de la organización
En `settings`, la organización puede seleccionar su modo:
- **Modo ágil**: habilita SprintCycles, Sprint Board, Burn-up
- **Modo tradicional**: habilita Milestones, Gantt, Portfolio view
- **Modo híbrido**: disponible todo (para organizaciones en transición)

## Reglas de negocio no ágiles
- En modo tradicional, los ciclos duran mínimo 1 mes
- Los milestones de una iniciativa no pueden superar la fecha de fin de la iniciativa
- Un milestone DELAYED dispara una alerta al responsable de la iniciativa y al owner del KR
- El progreso de una iniciativa en modo tradicional = % de milestones completados
