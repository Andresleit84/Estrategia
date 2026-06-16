# Estrategia Database-First

## Principio rector
**La base de datos es el motor. La aplicación es la interfaz.**

Toda la lógica de negocio, cálculos, validaciones, cascadas y automatismos viven en PostgreSQL. El backend NestJS únicamente orquesta llamadas a la DB y expone los resultados vía API. Esto garantiza:

- Consistencia: la lógica no puede divergir entre el frontend, backend o un script externo
- Rendimiento: los cálculos ocurren dentro del motor de DB, sin viajes de red
- Mantenibilidad: cambiar una regla de negocio = editar un objeto de DB, no rastrear código
- Menor consumo: menos procesamiento en el servidor de aplicación, menos tokens en contexto AI

## Regla absoluta
> Ningún archivo `.ts` / `.js` contiene lógica de negocio que pueda vivir en la DB.
> Los servicios de NestJS solo llaman vistas, funciones y procedimientos.

---

## Qué vive en la base de datos

### Vistas (Views)
Toda consulta de lectura que combina tablas o calcula datos es una vista.
Los servicios hacen `SELECT * FROM v_nombre WHERE organization_id = $1`.

| Vista | Propósito |
|-------|-----------|
| `v_objectives_with_progress` | Objetivos con progreso calculado desde sus KRs |
| `v_key_results_with_trend` | KRs con valor actual, % progreso, tendencia (up/flat/down) |
| `v_check_in_history` | Historial de check-ins con delta respecto al anterior |
| `v_alignment_map` | Árbol completo de cascada COMPANY→AREA→TEAM→INDIVIDUAL con % cobertura |
| `v_at_risk_krs` | KRs en riesgo: sin check-in > 14 días o confianza < 0.4, ordenados por impacto |
| `v_cycle_health` | Métricas de salud del ciclo: score, distribución de estados, confianza promedio |
| `v_team_health` | Salud por equipo: cadencia de check-ins, KRs on track / at risk / behind |
| `v_executive_dashboard` | Datos agregados para el dashboard ejecutivo (una sola query) |
| `v_initiative_timeline` | Iniciativas con milestones, estado y días de retraso |
| `v_sprint_okr_impact` | Sprints con los KRs que impactan y progreso acumulado por sprint |
| `v_mcp_audit_summary` | Resumen de uso de herramientas AI por organización y día |

### Funciones (Functions)
Toda operación que devuelve un resultado calculado. Se llaman con `SELECT fn_nombre(...)`.

| Función | Propósito |
|---------|-----------|
| `fn_calculate_kr_progress(kr_id)` | Calcula el % de progreso de un KR según tipo (INCREASE/DECREASE/MAINTAIN/ACHIEVE) |
| `fn_calculate_objective_progress(obj_id)` | Promedio ponderado de progreso de los KRs activos del objetivo |
| `fn_predict_kr_completion(kr_id)` | Regresión lineal sobre historial de check-ins → fecha y valor proyectados |
| `fn_get_alignment_gaps(cycle_id, org_id)` | Retorna OKRs de empresa sin soporte táctico y el índice de alineación |
| `fn_get_cycle_score(cycle_id)` | Score final del ciclo (promedio de scores de OKRs de empresa) |
| `fn_validate_okr_quality(title, description, type, target, unit)` | Evalúa calidad del OKR, retorna score 0-10 y lista de issues |
| `fn_user_has_permission(user_id, resource, action)` | Verifica permisos RBAC antes de cualquier operación |

### Procedimientos almacenados (Stored Procedures)
Toda operación de escritura con lógica compleja. Se llaman con `CALL sp_nombre(...)`.

| Procedimiento | Propósito |
|---------------|-----------|
| `sp_create_check_in(kr_id, user_id, value, confidence, notes, mood)` | Crea check-in y dispara recálculo en cascada |
| `sp_create_objective(org_id, cycle_id, parent_id, owner_id, team_id, level, title, description)` | Valida límites (máx 5 por nivel) y crea el objetivo |
| `sp_create_key_result(obj_id, owner_id, title, type, unit, start, target)` | Valida límites (máx 5 por objetivo) y crea el KR |
| `sp_close_cycle(cycle_id, user_id)` | Cierra el ciclo, todos sus OKRs activos y genera el reporte de cierre |
| `sp_activate_cycle(cycle_id, user_id)` | Valida que no haya otro ciclo activo y activa el ciclo |
| `sp_close_sprint(sprint_id, velocity, user_id)` | Cierra el sprint, registra velocidad y propone check-ins automáticos |
| `sp_invite_user(org_id, email, role, invited_by)` | Genera token de invitación y registra la invitación |

### Triggers
Automatismos que se disparan solos ante eventos en la DB.

| Trigger | Tabla | Evento | Acción |
|---------|-------|--------|--------|
| `trg_checkin_cascade_recalc` | `check_ins` | AFTER INSERT | Recalcula progreso del KR → objetivo → objetivo padre |
| `trg_kr_auto_complete` | `key_results` | AFTER UPDATE de `current_value` | Si current_value ≥ target_value → status = COMPLETED |
| `trg_kr_auto_at_risk` | `key_results` | AFTER UPDATE de `last_checkin_at` | Si han pasado > 14 días → status = AT_RISK |
| `trg_objective_status_sync` | `key_results` | AFTER UPDATE de `status` | Si todos los KRs están COMPLETED → objetivo pasa a COMPLETED |
| `trg_validate_objective_limits` | `objectives` | BEFORE INSERT | Rechaza si ya hay 5 objetivos del mismo nivel en el ciclo |
| `trg_validate_kr_limits` | `key_results` | BEFORE INSERT | Rechaza si el objetivo ya tiene 5 KRs activos |
| `trg_audit_log` | Todas las tablas críticas | AFTER INSERT/UPDATE/DELETE | Inserta en `audit_log` con old/new values en JSONB |
| `trg_soft_delete` | Todas las tablas con `deleted_at` | BEFORE DELETE | Convierte DELETE en UPDATE de `deleted_at` (nunca borrado físico) |
| `trg_updated_at` | Todas las tablas con `updated_at` | BEFORE UPDATE | Actualiza `updated_at = NOW()` automáticamente |
| `trg_prevent_past_checkin` | `check_ins` | BEFORE INSERT | Rechaza si la fecha es anterior al último check-in del mismo KR |

---

## Cómo se usa en NestJS

### Lo que NO se hace
```typescript
// ❌ PROHIBIDO — lógica de negocio en el servicio
async createCheckIn(dto: CreateCheckInDto) {
  const kr = await this.prisma.keyResult.findUnique({ where: { id: dto.krId } });
  const progress = (dto.currentValue - kr.startValue) / (kr.targetValue - kr.startValue) * 100;
  await this.prisma.checkIn.create({ data: { ...dto, progress } });
  await this.prisma.keyResult.update({ where: { id: dto.krId }, data: { progress, currentValue: dto.currentValue } });
  // ... y así 50 líneas más
}
```

### Lo que SÍ se hace
```typescript
// ✅ CORRECTO — el servicio es un wrapper delgado
async createCheckIn(dto: CreateCheckInDto, userId: string) {
  await this.db.query(
    'CALL sp_create_check_in($1, $2, $3, $4, $5, $6)',
    [dto.krId, userId, dto.currentValue, dto.confidence, dto.notes, dto.mood]
  );
}

async getObjectives(cycleId: string, orgId: string) {
  return this.db.query(
    'SELECT * FROM v_objectives_with_progress WHERE cycle_id = $1 AND organization_id = $2',
    [cycleId, orgId]
  );
}
```

### Cliente de base de datos
Se usa `pg` (node-postgres) directamente para llamar a views y procedimientos, en lugar del ORM de Prisma. Prisma se mantiene **solo para migraciones de esquema**.

```typescript
// backend/src/database/db.service.ts
import { Pool } from 'pg';

@Injectable()
export class DbService {
  private pool: Pool;

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}
```

---

## Organización de los objetos de DB

Los objetos de base de datos viven en migrations de Prisma (archivos `.sql`):

```
backend/prisma/
├── schema.prisma               ← define las tablas (para migraciones)
└── migrations/
    ├── 001_initial_tables/
    │   └── migration.sql       ← CREATE TABLE ...
    ├── 002_views/
    │   └── migration.sql       ← CREATE OR REPLACE VIEW ...
    ├── 003_functions/
    │   └── migration.sql       ← CREATE OR REPLACE FUNCTION ...
    ├── 004_procedures/
    │   └── migration.sql       ← CREATE OR REPLACE PROCEDURE ...
    └── 005_triggers/
        └── migration.sql       ← CREATE TRIGGER ...
```

Cuando se modifica un objeto (ej. cambiar el cálculo de progreso de un KR):
1. Crear una nueva migración: `bash scripts/migrate.sh dev "fix_kr_progress_calculation"`
2. Escribir el `CREATE OR REPLACE` en el archivo de migración
3. Aplicar: `bash scripts/migrate.sh deploy`
4. **No tocar código TypeScript** — el cambio es solo en SQL

---

## Seguridad a nivel de DB

- Todo procedimiento verifica `organization_id` antes de operar (no puede haber cross-tenant)
- `fn_user_has_permission` se llama al inicio de cada procedimiento de escritura
- La tabla `audit_log` es de solo inserción — ningún proceso puede hacer UPDATE o DELETE en ella
- El usuario `postgres` de la app tiene permisos de EXECUTE en funciones/procedimientos, pero NO de DROP o ALTER
- Las vistas filtran siempre por `organization_id` (no existe vista global sin filtro de tenant)
