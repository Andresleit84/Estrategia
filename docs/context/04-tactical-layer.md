# Capa Táctica

## Definición
La capa táctica gestiona los OKRs de equipo e individuales, las iniciativas concretas y el seguimiento de ejecución. Aquí es donde el trabajo ocurre.

## Jerarquía táctica
```
AREA OKRs
  └── TEAM OKRs (por equipo funcional o squad)
        └── INDIVIDUAL OKRs (por persona, opcional)
              └── Initiatives (proyectos / entregables concretos)
                    └── [vinculadas a tareas en herramientas externas]
```

## Flujo de trabajo táctico

### 1. Bajada de OKRs de área
- El team leader recibe los OKRs de área publicados
- Crea los OKRs del equipo que contribuyen a esos objetivos
- Debe haber trazabilidad: todo OKR de equipo → al menos un OKR de área

### 2. Definición de OKRs individuales (opcional)
- Cada miembro puede tener OKRs personales alineados al equipo
- Útil para roles de IC (individual contributor) con metas específicas
- No reemplaza la evaluación de desempeño

### 3. Creación de iniciativas
- Por cada KR del equipo se definen las iniciativas que lo harán avanzar
- Una iniciativa es un proyecto acotado con responsable, fechas y criterios de éxito
- Las iniciativas pueden vincularse a epics, sprints o cualquier elemento externo

### 4. Check-ins tácticos
- Frecuencia recomendada: semanal por KR (mínimo cada 2 semanas)
- El responsable actualiza: valor actual, confianza, notas de bloqueo
- El sistema calcula automáticamente el progreso del objetivo padre

### 5. Sprint Planning / Weekly (para equipos ágiles)
- Ver `05-agile-framework.md`

### 6. Retrospectiva táctica
- Al cierre del ciclo, cada equipo revisa sus KRs
- Se documentan aprendizajes en el campo `notes` del cierre

## Vistas tácticas

### Board de equipo
- OKRs del equipo con progreso visual (barras, semáforo)
- Iniciativas activas con responsable y fecha
- Timeline de check-ins recientes

### Vista individual
- Mis OKRs (individuales + como contribuyente en OKRs de equipo)
- Mis iniciativas activas
- Recordatorio de check-ins pendientes

### Radar de salud del equipo
- Distribución de confianza en los KRs del equipo
- Cadencia de check-ins (si hay KRs sin actualizar > 14 días → alerta)
- Velocidad de iniciativas (ratio completadas/planificadas)

## Reglas de negocio tácticas
- Un KR de equipo puede contribuir a múltiples KRs de área (many-to-many)
- Las iniciativas tienen un único responsable (ownerId) pero múltiples colaboradores
- Un check-in no puede tener fecha anterior al check-in previo del mismo KR
- Si un KR tiene currentValue ≥ targetValue → se marca automáticamente COMPLETED
- Si un KR no tiene check-in en 21 días → se marca AT_RISK automáticamente
- El progreso de un objective se recalcula en cada check-in de cualquiera de sus KRs
