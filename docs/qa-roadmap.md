# Plan de Pruebas y Validación — Sistema OKR
**Versión**: 1.0  
**Fecha**: 2026-04-27  
**Alcance**: Validación completa del sistema previo a producción  
**Preparado por**: Equipo de Desarrollo

---

## Resumen ejecutivo

Este documento define el plan de validación del Sistema OKR, cubriendo 12 módulos funcionales distribuidos en 4 fases de prueba: verificación funcional, integridad de datos, persistencia y carga. El objetivo es garantizar que el sistema opera correctamente en todos sus flujos de negocio antes del despliegue a usuarios finales.

**Esfuerzo total estimado**: 10 días hábiles  
**Perfiles requeridos**: 1 QA + acceso a base de datos PostgreSQL  
**Entorno de prueba**: `Estrategia_dev` (localhost:3021 backend / localhost:3001 frontend)

---

## Tipos de prueba

| Tipo | Código | Descripción |
|------|--------|-------------|
| Funcional | **F** | Cada flujo de usuario opera según el diseño |
| Regresión | **R** | Los cambios no rompen funcionalidades existentes |
| Persistencia | **P** | Los datos se guardan y recuperan correctamente tras reinicios |
| Integridad | **I** | Las reglas de negocio en DB (triggers, constraints, RLS) se respetan |
| Carga | **C** | Rendimiento bajo volumen de datos y usuarios concurrentes |

---

## Fase 1 — Verificación funcional por módulo

> **Duración**: 5 días hábiles (días 1–5)  
> **Criterio de entrada**: sistema corriendo en entorno dev  
> **Criterio de salida**: 100% de casos críticos en PASS, defectos no críticos documentados

---

### Módulo 1 — Autenticación y Seguridad
**Ruta**: `/auth/login`, `/auth/register`, `/auth/accept-invitation`  
**Tiempo estimado**: 4 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 1.1 | Registro de nueva organización con usuario OWNER | F | Alta | Org + usuario + equipo raíz creados; JWT emitido en HttpOnly cookie |
| 1.2 | Login con credenciales correctas | F | Alta | Sesión iniciada; redirige a dashboard |
| 1.3 | Login con contraseña incorrecta (1 intento) | F | Alta | Error 401 sin revelar si el email existe |
| 1.4 | Login con contraseña incorrecta 5 veces seguidas | F | Alta | Cuenta bloqueada 15 min; mensaje con fecha de desbloqueo |
| 1.5 | Login después del lockout (antes de 15 min) | I | Alta | Rechazado aunque la contraseña sea correcta |
| 1.6 | Login después de que expira el lockout | F | Alta | Login exitoso; intentos se limpian |
| 1.7 | Refresh token — expiración de sesión | F | Alta | Token rotado; sesión continúa transparente para el usuario |
| 1.8 | Logout — cookie eliminada | F | Alta | Cookie borrada; redirect a login |
| 1.9 | Acceder a ruta protegida sin sesión | F | Alta | Redirect a `/auth/login` |
| 1.10 | Invitación por email — flujo completo | F | Media | Token válido → formulario de nombre/contraseña → sesión iniciada |
| 1.11 | Invitación con token vencido o inválido | F | Media | Error claro; no crea usuario |
| 1.12 | Rate limiting en endpoint de login | F | Alta | Bloqueo por IP tras N intentos en ventana de tiempo |

---

### Módulo 2 — Organizaciones y Equipos
**Ruta**: `/settings`, `/teams`  
**Tiempo estimado**: 3 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 2.1 | Editar nombre y modo de la organización | F | Alta | Cambios persistidos; sin recarga forzada de página |
| 2.2 | Crear equipo raíz | F | Alta | Equipo creado sin padre |
| 2.3 | Crear equipo hijo (sub-equipo) | F | Alta | Jerarquía reflejada en árbol `/teams` |
| 2.4 | Intentar crear ciclo en equipo padre de sí mismo | I | Alta | Error de DB: `trg_validate_team_hierarchy` rechaza el ciclo |
| 2.5 | Agregar miembro a equipo | F | Alta | Usuario aparece en panel de miembros con rol correcto |
| 2.6 | Agregar usuario de otra organización a un equipo | I | Alta | Rechazado por `sp_add_team_member` |
| 2.7 | Eliminar miembro de equipo | F | Media | Miembro removido; sin afectar sus OKRs existentes |
| 2.8 | Vista de árbol de equipos con 3 niveles de profundidad | F | Media | Árbol colapsable renderizado correctamente |
| 2.9 | Invitar usuario externo a la organización | F | Alta | Email de invitación generado; token registrado en DB |
| 2.10 | Ver lista de miembros con roles | F | Media | Tabla con email, nombre, rol, equipos |

---

### Módulo 3 — Ciclos OKR
**Ruta**: `/cycles`  
**Tiempo estimado**: 2 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 3.1 | Crear ciclo en estado DRAFT | F | Alta | Ciclo aparece en lista como borrador |
| 3.2 | Activar ciclo DRAFT | F | Alta | Estado cambia a ACTIVE; selector global en TopBar lo muestra |
| 3.3 | Intentar activar un segundo ciclo con uno ya ACTIVE | I | Alta | `trg_validate_single_active_cycle` rechaza con error descriptivo |
| 3.4 | Cerrar ciclo activo | F | Alta | Confirmación requerida; ciclo pasa a CLOSED |
| 3.5 | Ver estadísticas del ciclo (nro objetivos, progreso, días restantes) | F | Media | Datos de `v_cycles_with_stats` correctos |
| 3.6 | Ciclo activo visible en TopBar después de recargar | P | Alta | Selector muestra el ciclo correcto tras F5 |
| 3.7 | Crear ciclo con fechas solapadas a otro | F | Media | Sistema permite; no hay restricción de solapamiento de fechas |

---

### Módulo 4 — OKRs Estratégicos (Empresa / Área)
**Ruta**: `/strategic`  
**Tiempo estimado**: 4 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 4.1 | Crear objetivo de nivel COMPANY | F | Alta | Objetivo aparece en vista estratégica con ProgressRing en 0% |
| 4.2 | Crear objetivo de nivel AREA | F | Alta | Objetivo aparece bajo empresa en vista de árbol |
| 4.3 | Intentar crear el 6º objetivo de empresa en el mismo ciclo | I | Alta | `trg_validate_objective_limits` rechaza con mensaje claro |
| 4.4 | Crear Key Result en un objetivo | F | Alta | KR aparece en la card del objetivo |
| 4.5 | Intentar crear el 6º KR en el mismo objetivo | I | Alta | `trg_validate_kr_limits` rechaza |
| 4.6 | OKR Coach — sugerencia al escribir título | F | Alta | Panel lateral con score 0-10 e issues específicos sin bloquear el formulario |
| 4.7 | OKR Coach — OKR de alta calidad (score ≥ 8) | F | Media | Sin issues; mensaje de validación positivo |
| 4.8 | OKR Coach — OKR vago sin métricas | F | Media | Issues: "falta valor objetivo", "unidad no definida" |
| 4.9 | Filtrar objetivos por nivel (empresa / área) | F | Media | Lista se actualiza sin recarga de página |
| 4.10 | Filtrar objetivos por estado (on track / at risk / behind) | F | Media | Filtro funcional |
| 4.11 | Mapa de alineación COMPANY → AREA visible | F | Media | Árbol con porcentaje de cobertura táctica |
| 4.12 | Progreso del objetivo se calcula desde sus KRs | I | Alta | Con 1 KR al 50%, el objetivo muestra 50% |

---

### Módulo 5 — OKRs Tácticos (Equipo / Individual)
**Ruta**: `/tactical`, `/strategy` (Mis OKRs)  
**Tiempo estimado**: 3 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 5.1 | Crear OKR de equipo con objetivo padre (AREA) | F | Alta | Creado con alineación; aparece en vista táctica |
| 5.2 | Intentar crear OKR de equipo sin objetivo padre | I | Alta | `trg_validate_tactical_alignment` rechaza con ERRCODE P0010 |
| 5.3 | Crear OKR de equipo para un equipo al que no pertenezco | I | Alta | `trg_team_okr_permission` rechaza |
| 5.4 | Crear OKR individual con objetivo padre de equipo | F | Media | Creado y visible en "Mis OKRs" |
| 5.5 | Selector de objetivo padre (tree picker) | F | Alta | Solo muestra objetivos de nivel superior disponibles |
| 5.6 | Vista "Mis OKRs" — solo muestra objetivos donde soy owner | F | Media | Filtrado correcto por `v_my_objectives` |
| 5.7 | Vista de equipo — solo muestra OKRs del equipo | F | Media | Filtrado correcto por `v_team_objectives` |
| 5.8 | Badge "sin alineación" en OKR sin padre | F | Media | Badge visible en card del objetivo |
| 5.9 | Crear Problema Organizacional (Diagnóstico) | F | Media | Problema aparece en `/problems` |
| 5.10 | Crear Intención Estratégica y vincular a problema | F | Media | Relación persistida; visible en `/strategy` |

---

### Módulo 6 — Check-ins y Progreso
**Ruta**: `/checkins`, `/checkins/feed`  
**Tiempo estimado**: 4 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 6.1 | Hacer check-in en un KR (valor + confianza + nota + mood) | F | Alta | Check-in guardado; progreso del KR actualizado en pantalla |
| 6.2 | Cascada de recálculo: check-in → KR → Objetivo → Objetivo padre | I | Alta | Progreso propagado correctamente en `trg_checkin_cascade_recalc` |
| 6.3 | Intentar check-in con fecha anterior al último | I | Alta | `trg_prevent_past_checkin` rechaza |
| 6.4 | Check-in Assistant — generar nota con IA | F | Alta | Botón "Generar nota" produce sugerencia editable; sin actuar sin clic |
| 6.5 | Slider de confianza con etiquetas en extremos | F | Media | "Alto riesgo" en 0.0, "En control" en 1.0 |
| 6.6 | Historial de check-ins — gráfico + tabla con deltas | F | Media | LineChart renderizado; tabla con Δ respecto al check-in anterior |
| 6.7 | Predicción de completación (con ≥ 2 check-ins) | F | Media | Fecha proyectada y probabilidad mostradas |
| 6.8 | Feed de actividad del equipo | F | Media | Check-ins recientes en orden cronológico |
| 6.9 | Dashboard de cadencia: semáforo de días | F | Media | Verde (<7 días), ámbar (7-14), rojo (>14) |
| 6.10 | Vista de KRs en riesgo ordenados por impacto | F | Alta | COMPANY primero; datos de `v_at_risk_krs` |
| 6.11 | Notificación in-app al pasar KR a AT_RISK | F | Media | Bell con badge; dropdown muestra la notificación |
| 6.12 | Notificaciones en tiempo real vía WebSocket | F | Media | Sin polling; actualización inmediata al hacer check-in desde otra pestaña |
| 6.13 | KR se completa automáticamente al alcanzar target | I | Alta | `status = COMPLETED` cuando `current_value >= target_value` |

---

### Módulo 7 — Iniciativas y Ejecución
**Ruta**: `/initiatives`  
**Tiempo estimado**: 3 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 7.1 | Crear iniciativa vinculada a uno o varios KRs | F | Alta | Iniciativa aparece en kanban; KRs vinculados listados |
| 7.2 | Multi-select de KRs en formulario de iniciativa | F | Alta | Búsqueda funcional; múltiples KRs seleccionables |
| 7.3 | Agregar milestone a una iniciativa | F | Alta | Milestone aparece en lista con checkbox y fecha |
| 7.4 | Completar milestone — recálculo de progreso | I | Alta | `trg_initiative_progress_from_milestones` actualiza progreso de la iniciativa |
| 7.5 | Iniciativa pasa a IN_PROGRESS al completar primer milestone | I | Media | Status auto-avanza: TODO → IN_PROGRESS |
| 7.6 | Alerta visual en iniciativa vencida | F | Media | Borde rojo + badge "hitos vencidos" |
| 7.7 | Notificación por milestone vencido | I | Media | `trg_milestone_overdue_alert` inserta notificación sin duplicados |
| 7.8 | Vista Gantt — iniciativas en línea de tiempo | F | Media | Barras con color: azul/ámbar/rojo/verde |
| 7.9 | Hover en milestone del Gantt muestra título y fecha | F | Baja | Tooltip visible |
| 7.10 | `fn_initiative_health` retorna estado correcto | I | Media | Health = AT_RISK si hay milestones vencidos |

---

### Módulo 8 — Modo Ágil: Sprints
**Ruta**: `/sprints`  
**Tiempo estimado**: 3 horas  
> *Requiere organización en modo AGILE o HYBRID*

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 8.1 | Crear sprint vinculado a un ciclo OKR | F | Alta | Sprint en lista con fechas y estado PLANNED |
| 8.2 | Intentar crear sprint en org con modo TRADITIONAL | I | Alta | `trg_validate_sprint_org_mode` rechaza |
| 8.3 | Intentar crear sprint con fechas fuera del ciclo padre | I | Alta | `trg_validate_sprint_dates` rechaza |
| 8.4 | Activar sprint | F | Alta | Estado → ACTIVE; Sprint Board disponible |
| 8.5 | Intentar activar segundo sprint activo en el mismo equipo | I | Alta | `trg_single_active_sprint_per_team` rechaza |
| 8.6 | Sprint Board: kanban de iniciativas con sprint goal | F | Alta | Columnas TODO / IN_PROGRESS / DONE; KRs vinculados visibles |
| 8.7 | Wizard de cierre de sprint — propuesta de check-ins | F | Alta | Check-ins sugeridos por KR; usuario debe confirmar cada uno |
| 8.8 | Burn-up de OKRs: progreso real vs línea ideal | F | Media | Gráfico Recharts; línea ideal calculada por `fn_calculate_burnup` |
| 8.9 | Gráfico de velocidad: planeada vs real | F | Media | Barras por sprint histórico |
| 8.10 | Timeline del ciclo: todos los sprints en línea de tiempo | F | Media | Visualización horizontal correcta |

---

### Módulo 9 — Agentes de IA
**Ruta**: `/ai-assistant`, integrado en formularios y drawers  
**Tiempo estimado**: 5 horas  
> *Requiere `ANTHROPIC_API_KEY` configurada*

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 9.1 | OKR Coach: score en tiempo real al escribir título | F | Alta | Sugerencias en < 3s; sin bloquear el formulario |
| 9.2 | OKR Coach: recomendaciones específicas para KR ACHIEVE sin fecha | F | Alta | Issue: "falta fecha de cumplimiento" |
| 9.3 | Check-in Assistant: generar nota con historial de KR | F | Alta | Nota contextual generada; usuario puede editarla |
| 9.4 | Strategy Advisor: pregunta en lenguaje natural | F | Alta | Respuesta coherente con datos del ciclo activo |
| 9.5 | Strategy Advisor: @ mención de OKR específico | F | Media | Dropdown con objetivos del ciclo; respuesta incluye contexto del OKR |
| 9.6 | Strategy Advisor: acciones sugeridas como chips clicables | F | Media | Chips navegan a la sección correcta |
| 9.7 | Risk Sentinel: endpoint manual de escaneo | F | Alta | Retorna KRs en riesgo priorizados por impacto |
| 9.8 | Alignment Auditor: ejecutar al activar ciclo | F | Alta | Reporte con índice 0-100 y lista de brechas guardado en `ai_briefings` |
| 9.9 | Executive Briefer: generar briefing manual | F | Media | HTML con score, highlights, riesgos, próximos pasos |
| 9.10 | Audit log de IA: cada tool call registrado | I | Alta | `mcp_audit_log` con toolName, userId, success, durationMs |
| 9.11 | Rate limiting: superar límite diario de la org | F | Media | Error 429 con mensaje claro; contador en Redis |
| 9.12 | Historial de conversación persistido por ciclo | P | Media | Al recargar, el historial de chat se mantiene |
| 9.13 | Sin API key: mensaje de error informativo (no crash) | F | Alta | "API de IA no configurada" — sin stacktrace visible |

---

### Módulo 10 — Reportes y Dashboards Ejecutivos
**Ruta**: `/reports/*`  
**Tiempo estimado**: 3 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 10.1 | Dashboard ejecutivo: score del ciclo + heat map | F | Alta | Score calculado; heat map por nivel con colores correctos |
| 10.2 | Cycle Health: distribución de estados + confianza promedio | F | Alta | Datos de `v_cycle_health` correctos |
| 10.3 | Team Health: radar con 4 dimensiones por equipo | F | Media | `@nivo/radar` renderizado con datos de `v_team_health` |
| 10.4 | Weekly Trend: gráfico de progreso 8 semanas | F | Media | Línea de tendencia correcta |
| 10.5 | Portfolio Dashboard: Gantt de iniciativas por equipo | F | Media | Barras con estado visual |
| 10.6 | Risk Dashboard: KRs en riesgo con impacto estratégico | F | Alta | Lista priorizada; COMPANY primero |
| 10.7 | Executive Briefing: vista del último briefing generado | F | Media | Contenido formateado visible en `/reports/executive-briefing` |
| 10.8 | Exportar CSV del ciclo activo | F | Alta | Descarga archivo RFC-4180 con todos los KRs |
| 10.9 | Descargar PDF del ciclo (pdfkit) | F | Media | PDF descargable con datos del ciclo |
| 10.10 | Reporte de cierre al cerrar ciclo | F | Alta | Snapshot inmutable en `cycle_close_reports` |
| 10.11 | Cache Redis: segunda llamada al dashboard < 100ms | F | Media | TTL 300s activo; respuesta de cache sin hit a DB |

---

### Módulo 11 — Perfil, MFA y Privacidad (Enterprise)
**Ruta**: `/settings` (pestañas Perfil / Seguridad / Privacidad)  
**Tiempo estimado**: 4 horas

| # | Caso de prueba | Tipo | Prioridad | Resultado esperado |
|---|---------------|------|-----------|-------------------|
| 11.1 | Editar perfil: timezone, locale, preferencias de notificación | F | Media | Cambios guardados por `sp_update_user_profile` |
| 11.2 | Activar MFA: generar QR y verificar código TOTP | F | Alta | MFA habilitado; próximo login pide código |
| 11.3 | Login con MFA activo — código correcto | F | Alta | Sesión iniciada |
| 11.4 | Login con MFA activo — código incorrecto | F | Alta | Rechazado; sesión no creada |
| 11.5 | Desactivar MFA | F | Media | MFA desactivado; login vuelve a ser solo contraseña |
| 11.6 | Cerrar todas las sesiones (`sp_revoke_all_tokens`) | F | Alta | Todos los refresh tokens revocados; otras pestañas pierden sesión |
| 11.7 | Exportar mis datos (GDPR) | F | Media | JSON descargable con todos los datos del usuario |
| 11.8 | Eliminar mi cuenta (`sp_anonymize_user`) | F | Media | Datos anonimizados; sesión cerrada; no puede hacer login |
| 11.9 | Security Audit: visible solo para OWNER/ADMIN | F | Alta | MEMBER recibe 403; OWNER/ADMIN ven los últimos 100 eventos |
| 11.10 | Upcoming Milestones: próximos 30 días | F | Media | Lista ordenada por fecha con responsable |

---

## Fase 2 — Pruebas de Integridad de Base de Datos

> **Duración**: 1 día hábil (día 6)  
> **Herramienta**: psql directo a `Estrategia_dev`  
> **Criterio de salida**: todos los objetos de DB respetan sus contratos

### Verificaciones a ejecutar

```sql
-- I-1: RLS activo en las 7 tablas críticas
SELECT tablename, rowsecurity, forcerolevls 
FROM pg_tables t 
JOIN pg_class c ON c.relname = t.tablename
WHERE tablename IN ('objectives','key_results','check_ins',
                    'initiatives','cycles','teams','notifications');

-- I-2: Triggers críticos existentes
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_%'
ORDER BY trigger_name;

-- I-3: Audit log inmutable — intentar modificar y verificar que falla
UPDATE audit_log SET action = 'TAMPERED' WHERE id = (SELECT id FROM audit_log LIMIT 1);
-- Debe fallar con ERRCODE 55000

-- I-4: Cálculo de progreso KR INCREASE
-- KR con start=0, target=100, current=60 → debe mostrar 60%
SELECT fn_calculate_kr_progress('<kr_id>');

-- I-5: Cálculo de progreso KR DECREASE
-- KR con start=100, target=0, current=40 → debe mostrar 60%
SELECT fn_calculate_kr_progress('<kr_id>');

-- I-6: Cascada: check-in actualiza objetivo padre
-- Insertar check-in y verificar que v_objectives_with_progress se actualiza

-- I-7: Isolación de tenants (cross-org imposible)
-- Query con org_id de otra organización debe retornar 0 filas
SELECT * FROM v_objectives_with_progress WHERE organization_id = '<otra_org_id>';

-- I-8: Límites (máx 5 objetivos por nivel/ciclo)
-- Insertar 6to objetivo debe lanzar excepción

-- I-9: Único ciclo activo
-- Intentar activar segundo ciclo con uno activo debe fallar
```

---

## Fase 3 — Pruebas de Persistencia

> **Duración**: 4 horas (día 7 mañana)  
> **Objetivo**: los datos sobreviven reinicios del servidor y del navegador

| # | Escenario | Verificación |
|---|-----------|-------------|
| P-1 | Reiniciar backend (`pm2 restart okr-backend`) | OKRs, check-ins y ciclo activo intactos |
| P-2 | Reiniciar PostgreSQL | Todos los datos persisten; vistas calculan correctamente |
| P-3 | Cerrar y reabrir el navegador | Sesión activa por cookie HttpOnly; sin login nuevo |
| P-4 | Crear check-in → reiniciar backend → verificar en DB | Check-in en tabla + progreso del KR actualizado |
| P-5 | Historial de conversación AI | Al reabrir `/ai-assistant`, el historial del ciclo se muestra |
| P-6 | Notificaciones no leídas | Badge se mantiene tras reload |
| P-7 | Preferencias de perfil (timezone/locale) | Persisten tras cerrar y abrir sesión |
| P-8 | Cache Redis: reiniciar Redis | Dashboard sigue funcionando (fallback a DB directo) |

---

## Fase 4 — Pruebas de Carga

> **Duración**: 2 días hábiles (días 8–9)  
> **Herramienta recomendada**: [k6](https://k6.io) o Artillery  
> **Entorno**: preferentemente en servidor dedicado, no en localhost

### Escenarios de carga

#### Escenario C-1: Carga base sostenida
- **Usuarios concurrentes**: 50
- **Duración**: 10 minutos
- **Flujo**: login → ver dashboard → ver OKRs → hacer check-in → logout
- **Métricas objetivo**:
  - P95 de respuesta < 500ms
  - P99 de respuesta < 1.500ms
  - Error rate < 1%

#### Escenario C-2: Pico de uso
- **Usuarios concurrentes**: 200
- **Duración**: 2 minutos (simula inicio de jornada laboral)
- **Flujo**: login masivo + carga de dashboard ejecutivo
- **Métricas objetivo**:
  - P95 < 2.000ms
  - Error rate < 2%

#### Escenario C-3: Volumen de datos
- Insertar 10.000 check-ins en 50 KRs distribuidos en 5 ciclos
- Verificar que `v_check_in_history`, `v_at_risk_krs` y `fn_predict_kr_completion` responden en < 200ms
- Confirmar que índices `idx_checkins_kr_created` están siendo usados (EXPLAIN ANALYZE)

#### Escenario C-4: Cache bajo carga
- 100 usuarios concurrentes accediendo al dashboard ejecutivo
- Primera llamada: tiempo sin cache (baseline)
- Llamadas 2–100: tiempo con cache Redis (debe ser < 50ms)
- Confirmar TTL de 300s respetado

#### Escenario C-5: WebSocket bajo carga
- 100 usuarios conectados simultáneamente
- Emitir 50 check-ins en paralelo
- Verificar que todos los usuarios en el room `org:{orgId}` reciben `checkin:created` en < 1s

### Comando de ejemplo con k6

```javascript
// k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 50,
  duration: '10m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const login = http.post('http://localhost:3021/api/v1/auth/login', 
    JSON.stringify({ email: 'test@org.com', password: 'Test1234!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(login, { 'login 200': (r) => r.status === 200 });
  sleep(1);
}
```

---

## Cronograma

```
Semana 1
┌──────────────────────────────────────────────────────────┐
│ Día 1  │ Módulo 1 (Auth) + Módulo 2 (Org/Equipos)       │
│ Día 2  │ Módulo 3 (Ciclos) + Módulo 4 (OKRs Estratég.)  │
│ Día 3  │ Módulo 5 (OKRs Tácticos) + Módulo 6 (Check-ins)│
│ Día 4  │ Módulo 7 (Iniciativas) + Módulo 8 (Sprints)     │
│ Día 5  │ Módulo 9 (Agentes IA) + Módulo 10 (Reportes)   │
└──────────────────────────────────────────────────────────┘

Semana 2
┌──────────────────────────────────────────────────────────┐
│ Día 6  │ Módulo 11 (Enterprise) + Fase 2 (Integridad DB) │
│ Día 7  │ Fase 3 (Persistencia) + preparación de carga    │
│ Día 8  │ Fase 4 (Carga) — escenarios C-1, C-2, C-3       │
│ Día 9  │ Fase 4 (Carga) — C-4, C-5 + análisis resultados│
│ Día 10 │ Regresión completa + documentación de defectos  │
└──────────────────────────────────────────────────────────┘
```

**Total**: 10 días hábiles (~2 semanas de trabajo)

---

## Resumen de casos de prueba

| Módulo | Casos F | Casos I | Casos P | Casos C | Total |
|--------|---------|---------|---------|---------|-------|
| 1. Autenticación | 10 | 2 | — | — | 12 |
| 2. Org & Equipos | 8 | 2 | — | — | 10 |
| 3. Ciclos | 6 | 1 | 1 | — | 8 |
| 4. OKRs Estratégicos | 10 | 2 | — | — | 12 |
| 5. OKRs Tácticos | 8 | 2 | — | — | 10 |
| 6. Check-ins | 10 | 3 | — | — | 13 |
| 7. Iniciativas | 7 | 3 | — | — | 10 |
| 8. Sprints | 8 | 2 | — | — | 10 |
| 9. Agentes IA | 11 | 2 | 1 | — | 13 (+ requiere API key) |
| 10. Reportes | 9 | 1 | — | 1 | 11 |
| 11. Enterprise | 9 | 1 | 2 | — | 10 |
| Fase 2 — Integridad DB | — | 9 | — | — | 9 |
| Fase 3 — Persistencia | — | — | 8 | — | 8 |
| Fase 4 — Carga | — | — | — | 5 | 5 |
| **Total** | **96** | **30** | **12** | **6** | **141** |

---

## Registro de defectos

| ID | Módulo | Caso | Severidad | Estado | Descripción |
|----|--------|------|-----------|--------|-------------|
| — | — | — | — | — | (completar durante la ejecución) |

**Severidades**:
- **Crítica**: bloquea el flujo de negocio principal; debe resolverse antes de producción
- **Alta**: afecta una funcionalidad importante; debe resolverse antes de producción
- **Media**: funcionalidad degradada; puede ir a producción con workaround documentado
- **Baja**: mejora o cosmético; puede diferirse

---

## Criterios de aceptación para producción

| Criterio | Umbral |
|----------|--------|
| Defectos críticos abiertos | 0 |
| Defectos de alta severidad abiertos | 0 |
| Casos funcionales en PASS | ≥ 95% |
| P95 de respuesta en carga base | < 500ms |
| Error rate en carga base | < 1% |
| Triggers de integridad verificados | 100% |
| Datos persistentes tras reinicio | 100% |

---

*Documento generado el 2026-04-27. Actualizar el registro de defectos durante la ejecución.*
