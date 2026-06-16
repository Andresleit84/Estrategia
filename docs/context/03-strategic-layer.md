# Capa Estratégica

## Definición
La capa estratégica gestiona los OKRs de nivel empresa y área/departamento. Los define la alta dirección y los VPs al inicio de cada ciclo.

## Jerarquía estratégica
```
COMPANY OKRs
  └── AREA OKRs (Marketing, Ventas, Tecnología, Operaciones...)
        └── [se conecta a capa táctica — TEAM OKRs]
```

## Flujo de trabajo estratégico

### 1. Definición de ciclo
- La dirección define el período (Q1, año fiscal, etc.)
- Se establece el contexto: misión, prioridades estratégicas del período
- Se abre el ciclo en estado DRAFT

### 2. Creación de OKRs de empresa
- CEO / dirección crea entre 3-5 objetivos de empresa
- Cada objetivo tiene 2-5 Key Results con métricas claras
- Regla: si no es medible, no es un KR

### 3. Cascada hacia áreas
- Los VPs y directores de área crean sus OKRs alineados
- Cada OKR de área debe referenciar al menos un OKR de empresa (parentObjectiveId)
- El sistema calcula el % de KRs de empresa cubiertos por áreas

### 4. Validación y publicación
- Revisión de alineación en la vista "Mapa estratégico"
- El ciclo pasa de DRAFT → ACTIVE
- Todos los miembros reciben notificación

### 5. Seguimiento estratégico
- Check-ins de KRs estratégicos: mínimo quincenal
- Business Review mensual: revisión de confianza y tendencias
- Quarterly Review: cierre del ciclo, retrospectiva, planificación del siguiente

## Vistas estratégicas

### Mapa de alineación
Visualiza el árbol completo de OKRs de empresa → área → equipo. Muestra:
- % progreso por nivel
- Objetivos sin cobertura táctica (riesgo)
- Objetivos con conflicto de prioridad

### Dashboard ejecutivo
- Heat map de confianza por área
- Trend de progreso últimas 4 semanas
- KRs en riesgo (confidence < 0.4)
- KRs completados antes de tiempo

### Reporte de cierre de ciclo
- OKRs completados vs planificados
- Análisis de causas en KRs fallidos
- Distribución de scores (0.0 – 1.0)
- Recomendaciones para el siguiente ciclo

## Reglas de negocio estratégicas
- Máximo 5 objetivos por nivel por ciclo (regla OKR)
- Máximo 5 KRs por objetivo
- Un objetivo COMPANY no puede cerrarse si tiene OKRs de área activos dependientes
- Los KRs estratégicos son públicos para toda la organización por defecto
- Score final de KR = currentValue / targetValue (capped at 1.0)
- Score de objetivo = promedio de scores de sus KRs
- Score ideal de ciclo: 0.6–0.7 (si es 1.0, los objetivos eran muy fáciles)
