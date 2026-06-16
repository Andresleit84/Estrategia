# Agentes de IA — Diseño y Capacidades

## Principio
Los agentes de IA no reemplazan al usuario — lo amplifican. Cada agente actúa en su dominio específico con acceso controlado a los datos OKR a través del MCP Server. El usuario siempre puede aprobar, rechazar o corregir cualquier acción del agente.

## Arquitectura de agentes

```
Usuario / Cron
     |
[AI Chat UI / Trigger automático]
     |
[Claude API — claude-3-5-sonnet-latest]
     |
[MCP Client]  ←→  [MCP Server NestJS]  ←→  [PostgreSQL]
     |
[Agente especializado]
```

Cada agente es una **system prompt + conjunto de MCP tools** específicos. No son modelos separados — son configuraciones de Claude con contexto y herramientas acotadas.

---

## Agentes disponibles

### 1. OKR Coach
**Cuándo actúa**: cuando un usuario está creando o editando un Objetivo o Key Result.
**Función**: evalúa la calidad del OKR y sugiere mejoras.

**Capacidades:**
- Detecta OKRs vagos ("mejorar la satisfacción") y pide métricas concretas
- Valida que los KRs sean medibles, tienen fecha límite y responsable
- Evalúa si el objetivo está en la Goldilocks Zone (0.6–0.7 de dificultad esperada)
- Sugiere redacciones alternativas más ambiciosas pero realistas
- Revisa que no haya duplicidad con OKRs del ciclo anterior

**MCP tools que usa**: `get_cycle_objectives`, `get_historical_okrs`, `validate_okr_quality`

**Output**: sugerencias inline mientras el usuario escribe (no interrumpe, complementa).

---

### 2. Risk Sentinel (Centinela de Riesgo)
**Cuándo actúa**: automático — cada noche y cuando un check-in baja la confianza.
**Función**: detecta KRs en peligro antes de que se vuelvan críticos.

**Capacidades:**
- Monitorea KRs sin check-in en los últimos 14 días
- Detecta tendencia negativa: 3 check-ins consecutivos bajando
- Calcula probabilidad de cierre exitoso al ritmo actual (regresión lineal)
- Identifica dependencias: si KR A está en riesgo, advierte qué OKRs de área impacta
- Genera alertas priorizadas por impacto estratégico

**MCP tools que usa**: `list_at_risk_krs`, `get_checkin_history`, `predict_completion`, `get_objective_tree`

**Output**: notificaciones in-app + email digest semanal con KRs en riesgo priorizados.

---

### 3. Alignment Auditor (Auditor de Alineación)
**Cuándo actúa**: al publicar un ciclo y cuando se crean nuevos OKRs de equipo.
**Función**: verifica que la cascada estratégica esté completa y coherente.

**Capacidades:**
- Detecta OKRs de empresa sin cobertura táctica (huérfanos estratégicos)
- Identifica OKRs de equipo que no apuntan a ningún objetivo de área
- Calcula el índice de alineación del ciclo (% de KRs estratégicos con soporte táctico)
- Señala conflictos: dos equipos con OKRs que se contradicen
- Sugiere OKRs faltantes para cerrar brechas de alineación

**MCP tools que usa**: `get_alignment_map`, `get_coverage_gaps`, `list_objectives_by_level`

**Output**: reporte de alineación visible en el Mapa Estratégico + alertas al ADMIN.

---

### 4. Check-in Assistant (Asistente de Check-in)
**Cuándo actúa**: cuando el usuario abre el formulario de check-in.
**Función**: hace el check-in más rico e informativo con menos esfuerzo.

**Capacidades:**
- Pre-sugiere el valor actual basado en la tendencia histórica
- Genera preguntas contextuales: "¿Qué bloqueó el progreso esta semana?"
- Propone la nota del check-in basada en respuestas del usuario (el usuario edita y aprueba)
- Detecta cuando la confianza baja bruscamente y pregunta el motivo
- Recuerda al usuario sus check-ins pendientes con contexto del estado actual

**MCP tools que usa**: `get_kr_history`, `get_last_checkin`, `get_team_context`

**Output**: asistente conversacional en el drawer/modal de check-in.

---

### 5. Executive Briefer (Generador de Briefings Ejecutivos)
**Cuándo actúa**: automático — lunes por la mañana (semanal) y al cierre de ciclo.
**Función**: genera resúmenes ejecutivos listos para presentar.

**Capacidades:**
- Resumen semanal: "Esta semana: 3 KRs mejoraron, 2 entraron en riesgo, 1 se completó"
- Narrative de progreso por área: qué está yendo bien, qué necesita atención
- Comparativa con el período anterior (tendencia del ciclo)
- Proyección al cierre del ciclo al ritmo actual
- Reporte de cierre: análisis de por qué se lograron/fallaron los objetivos

**MCP tools que usa**: `get_cycle_summary`, `compare_periods`, `predict_cycle_close`, `get_team_highlights`

**Output**: email en HTML + vista en la app en `/reports/executive-briefing`.

---

### 6. Strategy Advisor (Asesor Estratégico)
**Cuándo actúa**: bajo demanda — el usuario lo invoca en el AI Chat.
**Función**: consultor estratégico conversacional con acceso completo al contexto OKR.

**Capacidades:**
- Responde preguntas en lenguaje natural sobre el estado del plan
  - "¿Qué área está más rezagada este trimestre?"
  - "¿Cuáles son los 3 KRs que más impactan el objetivo de empresa?"
  - "¿Deberíamos ajustar el objetivo de retención dado el ritmo actual?"
- Compara el desempeño con ciclos anteriores
- Propone re-priorización si el contexto cambió
- Genera escenarios: "si mantenemos este ritmo, ¿llegaremos al objetivo en Q4?"

**MCP tools que usa**: todos los de lectura + `run_scenario_analysis`

**Output**: interfaz de chat en `/ai-assistant` con historial de conversación por ciclo.

---

## Seguridad de los agentes
- Cada agente opera con el scope de permisos del usuario que lo invoca
- Las herramientas de escritura (crear check-in, crear iniciativa) requieren confirmación explícita del usuario
- Todas las acciones de agentes quedan en el audit log con prefijo `[AI]`
- Rate limiting: máx 100 llamadas AI/día por organización en plan básico
- Los datos de la organización nunca salen del MCP Server — Claude solo recibe lo que el tool devuelve
- Sin fine-tuning con datos de cliente: solo RAG en tiempo real vía MCP tools

## Modelo de IA
- **Producción**: `claude-3-5-sonnet-latest` (balance costo/calidad)
- **Tareas largas** (reporte de cierre, análisis de ciclo): `claude-3-5-sonnet-latest`
- **Sugerencias inline rápidas** (OKR Coach): `claude-3-5-haiku-latest`
- Implementación: Anthropic SDK con prompt caching para reducir costos en contextos repetidos
