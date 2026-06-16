import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AiService } from '../modules/ai/ai.service';
import { RedisService } from '../common/redis/redis.service';
import { McpTool, McpToolCall, McpToolResult } from './types/mcp.types';

const PLAN_LIMITS: Record<string, number> = { FREE: 50, BASIC: 100, PRO: 1000 };

// Registro de herramientas MCP disponibles.
// Hito 1: 6 herramientas base. Hito 9: +12 herramientas avanzadas.
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly db: DbService,
    private readonly ai: AiService,
    private readonly redis: RedisService,
  ) {}

  getTools(): McpTool[] {
    return [
      // ── Base (Hito 1) ──────────────────────────────────────────────────────
      {
        name: 'health_check',
        description: 'Verifica el estado del sistema OKR y la conexión a la base de datos.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'get_organization_summary',
        description: 'Obtiene el resumen de la organización: usuarios activos, ciclos, OKRs activos.',
        inputSchema: {
          type: 'object',
          properties: {
            organization_id: { type: 'string', format: 'uuid' },
          },
          required: ['organization_id'],
        },
      },
      {
        name: 'list_cycles',
        description: 'Lista todos los ciclos OKR de la organización con estadísticas (progreso, score, estado).',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'get_cycle_summary',
        description: 'Obtiene el resumen detallado de un ciclo OKR: score ponderado, estado, fechas.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'ID del ciclo OKR' },
          },
          required: ['cycle_id'],
        },
      },
      {
        name: 'list_objectives',
        description: 'Lista los objetivos estratégicos de la organización en el ciclo activo, con progreso calculado.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'ID del ciclo (opcional, usa el activo si se omite)' },
            level:    { type: 'string', enum: ['COMPANY', 'AREA', 'TEAM', 'INDIVIDUAL'], description: 'Filtrar por nivel' },
          },
          required: [],
        },
      },
      {
        name: 'validate_okr_quality',
        description: 'Evalúa la calidad de un OKR y retorna un score 0-10 con issues específicos.',
        inputSchema: {
          type: 'object',
          properties: {
            title:       { type: 'string' },
            description: { type: 'string' },
            type:        { type: 'string', enum: ['INCREASE', 'DECREASE', 'MAINTAIN', 'ACHIEVE'] },
            target:      { type: 'number' },
            unit:        { type: 'string' },
          },
          required: ['title'],
        },
      },

      // ── Avanzadas (Hito 9) ─────────────────────────────────────────────────
      {
        name: 'predict_completion',
        description: 'Predice la probabilidad de completar un KR al cierre del ciclo, con valor proyectado y tendencia.',
        inputSchema: {
          type: 'object',
          properties: {
            kr_id: { type: 'string', format: 'uuid', description: 'ID del Key Result' },
          },
          required: ['kr_id'],
        },
      },
      {
        name: 'get_checkin_history',
        description: 'Obtiene el historial de check-ins de un KR con la evolución de valores y confianza.',
        inputSchema: {
          type: 'object',
          properties: {
            kr_id: { type: 'string', format: 'uuid', description: 'ID del Key Result' },
            limit: { type: 'number', description: 'Máximo de entradas a retornar (default 20)' },
          },
          required: ['kr_id'],
        },
      },
      {
        name: 'get_at_risk_krs',
        description: 'Retorna los KRs en riesgo de la organización: baja confianza, sin check-in reciente o retrasados.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'ID del ciclo (opcional, usa el activo)' },
          },
          required: [],
        },
      },
      {
        name: 'get_alignment_map',
        description: 'Retorna el mapa de alineación estratégica: cómo los objetivos de equipo se conectan con los de empresa.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'ID del ciclo (opcional, usa el activo)' },
          },
          required: [],
        },
      },
      {
        name: 'analyze_alignment_gaps',
        description: 'Analiza las brechas de alineación en el ciclo: objetivos empresa sin cobertura en equipos/áreas.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'ID del ciclo (opcional, usa el activo)' },
          },
          required: [],
        },
      },
      {
        name: 'compare_periods',
        description: 'Compara dos ciclos OKR: progreso promedio, score, número de objetivos y tendencia.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id_1: { type: 'string', format: 'uuid', description: 'Primer ciclo (anterior)' },
            cycle_id_2: { type: 'string', format: 'uuid', description: 'Segundo ciclo (más reciente)' },
          },
          required: ['cycle_id_1', 'cycle_id_2'],
        },
      },
      {
        name: 'run_scenario',
        description: 'Genera tres escenarios (optimista, base, pesimista) para un KR basados en su ritmo actual.',
        inputSchema: {
          type: 'object',
          properties: {
            kr_id:              { type: 'string', format: 'uuid', description: 'ID del Key Result' },
            optimistic_factor:  { type: 'number', description: 'Factor optimista (default 1.3)' },
            pessimistic_factor: { type: 'number', description: 'Factor pesimista (default 0.6)' },
          },
          required: ['kr_id'],
        },
      },
      {
        name: 'generate_executive_summary',
        description: 'Genera un briefing ejecutivo con IA: estado del ciclo, highlights, riesgos y próximos pasos.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'ID del ciclo (opcional, usa el activo)' },
          },
          required: [],
        },
      },
      {
        name: 'list_initiatives_by_kr',
        description: 'Lista las iniciativas asociadas a un Key Result con su estado, progreso y fechas.',
        inputSchema: {
          type: 'object',
          properties: {
            kr_id: { type: 'string', format: 'uuid', description: 'ID del Key Result' },
          },
          required: ['kr_id'],
        },
      },
      {
        name: 'get_sprint_okr_impact',
        description: 'Calcula el impacto de un sprint en los KRs de la organización.',
        inputSchema: {
          type: 'object',
          properties: {
            sprint_id: { type: 'string', format: 'uuid', description: 'ID del sprint' },
          },
          required: ['sprint_id'],
        },
      },
      {
        name: 'create_checkin',
        description: 'Registra un nuevo check-in para un KR. Requiere confirmación del usuario antes de ejecutar.',
        inputSchema: {
          type: 'object',
          properties: {
            kr_id:         { type: 'string', format: 'uuid', description: 'ID del Key Result' },
            current_value: { type: 'number', description: 'Valor actual del KR' },
            confidence:    { type: 'number', description: 'Confianza de 0.0 a 1.0' },
            notes:         { type: 'string', description: 'Notas del check-in (opcional)' },
            mood:          { type: 'string', enum: ['GREAT', 'GOOD', 'NEUTRAL', 'BAD', 'TERRIBLE'], description: 'Estado de ánimo (opcional)' },
          },
          required: ['kr_id', 'current_value', 'confidence'],
        },
      },
      {
        name: 'get_cadence_dashboard',
        description: 'Muestra el dashboard de cadencia: frecuencia de check-ins, KRs sin actualizar, alertas.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'ID del ciclo (opcional, usa el activo)' },
          },
          required: [],
        },
      },
      {
        name: 'generate_okr_suggestions',
        description: 'Claude propone OKRs para el siguiente ciclo basándose en el historial del ciclo actual y el nivel estratégico indicado.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id:  { type: 'string', format: 'uuid', description: 'Ciclo base para el análisis (opcional, usa el activo)' },
            level:     { type: 'string', enum: ['COMPANY', 'AREA', 'TEAM'], description: 'Nivel para el que se sugieren OKRs' },
            team_id:   { type: 'string', format: 'uuid', description: 'Equipo específico (solo para level=TEAM)' },
            count:     { type: 'number', description: 'Número de objetivos a sugerir (default 3)' },
          },
          required: [],
        },
      },

      // ── Hitos 7 y 8 — diferidos a Hito 9, implementados en Hito 11 ───────────
      {
        name: 'list_initiatives',
        description: 'Lista iniciativas de la organización con progreso, estado, milestones y KRs vinculados.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'Filtrar por ciclo (opcional)' },
            team_id:  { type: 'string', format: 'uuid', description: 'Filtrar por equipo (opcional)' },
            status:   { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'], description: 'Filtrar por estado (opcional)' },
          },
          required: [],
        },
      },
      {
        name: 'get_initiative_timeline',
        description: 'Obtiene la línea de tiempo completa de una iniciativa: milestones, KRs vinculados, progreso y fechas.',
        inputSchema: {
          type: 'object',
          properties: {
            initiative_id: { type: 'string', format: 'uuid', description: 'ID de la iniciativa' },
          },
          required: ['initiative_id'],
        },
      },
      {
        name: 'flag_initiative_at_risk',
        description: 'Marca una iniciativa como en riesgo añadiendo una nota de alerta. Requiere confirmación del usuario.',
        inputSchema: {
          type: 'object',
          properties: {
            initiative_id: { type: 'string', format: 'uuid', description: 'ID de la iniciativa' },
            reason:        { type: 'string', description: 'Motivo del riesgo (se añade como nota)' },
          },
          required: ['initiative_id', 'reason'],
        },
      },
      {
        name: 'list_sprints',
        description: 'Lista los sprints de la organización en un ciclo, con estado, fechas y KRs vinculados.',
        inputSchema: {
          type: 'object',
          properties: {
            cycle_id: { type: 'string', format: 'uuid', description: 'Ciclo OKR (opcional, usa el activo)' },
            team_id:  { type: 'string', format: 'uuid', description: 'Filtrar por equipo (opcional)' },
          },
          required: [],
        },
      },
      {
        name: 'close_sprint_with_checkins',
        description: 'Cierra un sprint registrando la velocidad real y retorna los check-ins sugeridos para sus KRs. Requiere confirmación del usuario.',
        inputSchema: {
          type: 'object',
          properties: {
            sprint_id: { type: 'string', format: 'uuid', description: 'ID del sprint a cerrar' },
            velocity:  { type: 'number', description: 'Velocidad real del sprint (story points completados)' },
          },
          required: ['sprint_id', 'velocity'],
        },
      },
    ];
  }

  async callTool(
    call: McpToolCall,
    userId: string,
    organizationId: string,
  ): Promise<McpToolResult> {
    const startMs = Date.now();
    let error: string | undefined;
    let outputSummary: string;

    // Rate limiting por plan
    try {
      const org = await this.db.queryOne<{ plan: string }>(
        `SELECT plan FROM organizations WHERE id = $1 AND deleted_at IS NULL`, [organizationId],
      );
      const plan = org?.plan ?? 'FREE';
      const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
      const today = new Date().toISOString().slice(0, 10);
      const rl = await this.redis.checkRateLimit(`mcp_rate:${organizationId}:${today}`, limit, 86400);
      if (!rl.allowed) {
        throw new ForbiddenException(`Límite diario de herramientas MCP alcanzado (${limit} para plan ${plan})`);
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      // Redis unavailable — allow by default
    }

    try {
      const result = await this.dispatch(call, userId, organizationId);
      outputSummary = result.content[0]?.text?.slice(0, 200) ?? '';

      await this.auditLog({
        toolName: call.name,
        userId,
        organizationId,
        inputSummary: JSON.stringify(call.input).slice(0, 200),
        outputSummary,
        durationMs: Date.now() - startMs,
      });

      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      await this.auditLog({
        toolName: call.name,
        userId,
        organizationId,
        inputSummary: JSON.stringify(call.input).slice(0, 200),
        outputSummary: '',
        durationMs: Date.now() - startMs,
        error,
      });
      return {
        content: [{ type: 'text', text: `Error: ${error}` }],
        isError: true,
      };
    }
  }

  private async dispatch(
    call: McpToolCall,
    userId: string,
    organizationId: string,
  ): Promise<McpToolResult> {
    switch (call.name) {

      // ── Base ───────────────────────────────────────────────────────────────

      case 'health_check': {
        const ok = await this.db.healthCheck();
        return { content: [{ type: 'text', text: JSON.stringify({ status: ok ? 'ok' : 'error' }) }] };
      }

      case 'get_organization_summary': {
        const orgId = call.input['organization_id'] as string ?? organizationId;
        const row = await this.db.queryOne<Record<string, unknown>>(
          `SELECT
             o.name,
             o.slug,
             o.plan,
             o.mode,
             (SELECT count(*) FROM users u WHERE u.organization_id = o.id AND u.deleted_at IS NULL AND u.is_active) AS active_users
           FROM organizations o
           WHERE o.id = $1 AND o.deleted_at IS NULL`,
          [orgId],
        );
        return { content: [{ type: 'text', text: JSON.stringify(row) }] };
      }

      case 'list_cycles': {
        const cycles = await this.db.query(
          `SELECT * FROM v_cycles_with_stats WHERE organization_id = $1 ORDER BY start_date DESC`,
          [organizationId],
        );
        return { content: [{ type: 'text', text: JSON.stringify(cycles) }] };
      }

      case 'get_cycle_summary': {
        const cycleId = call.input['cycle_id'] as string;
        const cycle = await this.db.queryOne(
          `SELECT * FROM v_cycles_with_stats WHERE id = $1 AND organization_id = $2`,
          [cycleId, organizationId],
        );
        if (!cycle) {
          return { content: [{ type: 'text', text: 'Ciclo no encontrado' }], isError: true };
        }
        const scoreRow = await this.db.queryOne<{ score: number }>(
          `SELECT fn_get_cycle_score($1) AS score`,
          [cycleId],
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ ...cycle, weighted_score: scoreRow?.score ?? 0 }),
          }],
        };
      }

      case 'list_objectives': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const level   = call.input['level'] as string | undefined;
        const params: unknown[] = [organizationId];
        let sql = 'SELECT * FROM v_objectives_with_progress WHERE organization_id = $1';
        if (cycleId) { params.push(cycleId); sql += ` AND cycle_id = $${params.length}`; }
        if (level)   { params.push(level);   sql += ` AND level = $${params.length}`; }
        sql += ' ORDER BY level, created_at';
        const objs = await this.db.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify(objs) }] };
      }

      case 'validate_okr_quality': {
        const { title, description, type, target, unit } = call.input as Record<string, unknown>;
        const [result] = await this.db.query<{ fn_validate_okr_quality: unknown }>(
          `SELECT fn_validate_okr_quality($1, $2, $3, $4, $5)`,
          [title, description ?? null, type ?? 'INCREASE', target ?? null, unit ?? null],
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.fn_validate_okr_quality) }] };
      }

      // ── Avanzadas (Hito 9) ─────────────────────────────────────────────────

      case 'predict_completion': {
        const krId = call.input['kr_id'] as string;
        const [row] = await this.db.query<{ fn_predict_kr_completion: unknown }>(
          `SELECT fn_predict_kr_completion($1)`, [krId],
        );
        return { content: [{ type: 'text', text: JSON.stringify(row?.fn_predict_kr_completion) }] };
      }

      case 'get_checkin_history': {
        const krId = call.input['kr_id'] as string;
        const limit = (call.input['limit'] as number) ?? 20;
        const rows = await this.db.query(
          `SELECT * FROM v_check_in_history WHERE kr_id = $1 ORDER BY checked_at DESC LIMIT $2`,
          [krId, limit],
        );
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'get_at_risk_krs': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const params: unknown[] = [organizationId];
        let sql = `SELECT * FROM v_at_risk_krs WHERE organization_id = $1`;
        if (cycleId) { params.push(cycleId); sql += ` AND cycle_id = $${params.length}`; }
        sql += ` ORDER BY is_company_okr DESC, days_since_checkin DESC`;
        const rows = await this.db.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'get_alignment_map': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const params: unknown[] = [organizationId];
        let sql = `SELECT * FROM v_alignment_map WHERE organization_id = $1`;
        if (cycleId) { params.push(cycleId); sql += ` AND cycle_id = $${params.length}`; }
        const rows = await this.db.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'analyze_alignment_gaps': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const cycle = cycleId
          ? await this.db.queryOne<{ id: string }>(`SELECT id FROM cycles WHERE id = $1 AND organization_id = $2`, [cycleId, organizationId])
          : await this.db.queryOne<{ id: string }>(`SELECT id FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [organizationId]);
        if (!cycle) return { content: [{ type: 'text', text: 'No hay ciclo activo' }], isError: true };
        const [row] = await this.db.query<{ fn_get_alignment_gaps: unknown }>(
          `SELECT fn_get_alignment_gaps($1, $2)`, [cycle.id, organizationId],
        );
        return { content: [{ type: 'text', text: JSON.stringify(row?.fn_get_alignment_gaps) }] };
      }

      case 'compare_periods': {
        const cycleId1 = call.input['cycle_id_1'] as string;
        const cycleId2 = call.input['cycle_id_2'] as string;
        const [row] = await this.db.query<{ fn_compare_cycles: unknown }>(
          `SELECT fn_compare_cycles($1, $2)`, [cycleId1, cycleId2],
        );
        return { content: [{ type: 'text', text: JSON.stringify(row?.fn_compare_cycles) }] };
      }

      case 'run_scenario': {
        const krId = call.input['kr_id'] as string;
        const optimisticFactor  = (call.input['optimistic_factor'] as number) ?? 1.3;
        const pessimisticFactor = (call.input['pessimistic_factor'] as number) ?? 0.6;
        const [row] = await this.db.query<{ fn_run_scenario: unknown }>(
          `SELECT fn_run_scenario($1, $2, $3)`, [krId, optimisticFactor, pessimisticFactor],
        );
        return { content: [{ type: 'text', text: JSON.stringify(row?.fn_run_scenario) }] };
      }

      case 'generate_executive_summary': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const result = await this.ai.generateExecutiveBriefing(organizationId, userId, cycleId);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      }

      case 'list_initiatives_by_kr': {
        const krId = call.input['kr_id'] as string;
        const rows = await this.db.query(
          `SELECT * FROM v_initiatives_by_kr WHERE kr_id = $1 ORDER BY start_date`,
          [krId],
        );
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'get_sprint_okr_impact': {
        const sprintId = call.input['sprint_id'] as string;
        const [row] = await this.db.query<{ fn_sprint_okr_impact: unknown }>(
          `SELECT fn_sprint_okr_impact($1)`, [sprintId],
        );
        return { content: [{ type: 'text', text: JSON.stringify(row?.fn_sprint_okr_impact) }] };
      }

      case 'create_checkin': {
        const { kr_id, current_value, confidence, notes, mood } = call.input as Record<string, unknown>;
        await this.db.execute(
          `CALL sp_create_check_in($1, $2, $3, $4, $5, $6)`,
          [kr_id, userId, current_value, confidence, notes ?? null, mood ?? null],
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, kr_id, current_value, confidence }) }] };
      }

      case 'get_cadence_dashboard': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const params: unknown[] = [organizationId];
        let sql = `SELECT * FROM v_cadence_dashboard WHERE organization_id = $1`;
        if (cycleId) { params.push(cycleId); sql += ` AND cycle_id = $${params.length}`; }
        sql += ` ORDER BY days_since_checkin DESC NULLS LAST`;
        const rows = await this.db.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'generate_okr_suggestions': {
        const level = (call.input['level'] as string) ?? 'COMPANY';
        const count = (call.input['count'] as number) ?? 3;
        const cycleId = call.input['cycle_id'] as string | undefined;

        const cycle = cycleId
          ? await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE id = $1 AND organization_id = $2`, [cycleId, organizationId])
          : await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [organizationId]);

        const objectives = cycle
          ? await this.db.query<Record<string, unknown>>(
              `SELECT title, level, status, fn_calculate_objective_progress(id) as progress FROM objectives WHERE cycle_id = $1 AND level = $2 AND deleted_at IS NULL`,
              [cycle.id, level],
            )
          : [];

        const atRisk = cycle
          ? await this.db.query(`SELECT kr_title, objective_title, confidence, progress FROM v_at_risk_krs WHERE organization_id = $1 AND cycle_id = $2 LIMIT 5`, [organizationId, cycle.id])
          : [];

        const suggestions: Array<{ objective: string; key_results: string[]; rationale: string }> = [];

        if (this.ai.isReady) {
          const objList = objectives.map((o) => `- "${o['title']}": ${Math.round(Number(o['progress'] ?? 0))}% (${o['status']})`).join('\n') || '(sin objetivos en este nivel)';
          const riskList = atRisk.map((k) => `- "${(k as Record<string, unknown>)['kr_title']}": ${Math.round(Number((k as Record<string, unknown>)['confidence'] ?? 0) * 100)}% confianza`).join('\n') || '(ninguno)';

          const prompt = `Eres un experto en metodología OKR. Basándote en el historial del ciclo actual, propone ${count} OKRs para el SIGUIENTE ciclo al nivel ${level}.

CICLO ACTUAL: ${cycle?.name ?? 'Activo'}
OBJETIVOS ${level} ACTUALES:
${objList}
KRS EN RIESGO:
${riskList}

Genera exactamente ${count} objetivos con 2-3 KRs cada uno. Responde en JSON:
[
  {
    "objective": "título del objetivo (inspirador, no medible)",
    "key_results": ["KR 1 medible con meta", "KR 2 medible con meta"],
    "rationale": "por qué este objetivo para el siguiente ciclo (1 oración)"
  }
]`;
          const text = await this.ai.generateText(prompt, 2000);
          if (text) {
            try {
              const jsonStart = text.indexOf('['); const jsonEnd = text.lastIndexOf(']') + 1;
              if (jsonStart >= 0) suggestions.push(...JSON.parse(text.slice(jsonStart, jsonEnd)));
            } catch (err) { this.logger.warn(`generate_okr_suggestions parse failed: ${err instanceof Error ? err.message : String(err)}`); }
          }
        }

        if (suggestions.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'AI no disponible. Configura ANTHROPIC_API_KEY para usar esta herramienta.' }) }], isError: true };
        }

        return { content: [{ type: 'text', text: JSON.stringify({ cycle: cycle?.name, level, suggestions }) }] };
      }

      // ── Hito 7 y 8 ───────────────────────────────────────────────────────────

      case 'list_initiatives': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const teamId  = call.input['team_id']  as string | undefined;
        const status  = call.input['status']   as string | undefined;
        const params: unknown[] = [organizationId];
        let sql = `SELECT * FROM v_initiative_timeline WHERE organization_id = $1`;
        if (cycleId) { params.push(cycleId); sql += ` AND cycle_id = $${params.length}`; }
        if (teamId)  { params.push(teamId);  sql += ` AND team_id = $${params.length}`; }
        if (status)  { params.push(status);  sql += ` AND status = $${params.length}`; }
        sql += ` ORDER BY due_date NULLS LAST, title`;
        const rows = await this.db.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'get_initiative_timeline': {
        const initiativeId = call.input['initiative_id'] as string;
        const row = await this.db.queryOne(
          `SELECT * FROM v_initiative_timeline WHERE id = $1 AND organization_id = $2`,
          [initiativeId, organizationId],
        );
        if (!row) return { content: [{ type: 'text', text: 'Iniciativa no encontrada' }], isError: true };
        const health = await this.db.queryOne<{ fn_initiative_health: unknown }>(
          `SELECT fn_initiative_health($1)`, [initiativeId],
        );
        return { content: [{ type: 'text', text: JSON.stringify({ ...row, health: health?.fn_initiative_health }) }] };
      }

      case 'flag_initiative_at_risk': {
        const initiativeId = call.input['initiative_id'] as string;
        const reason = call.input['reason'] as string;
        const initiative = await this.db.queryOne<{ id: string; description: string | null }>(
          `SELECT id, description FROM initiatives WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
          [initiativeId, organizationId],
        );
        if (!initiative) return { content: [{ type: 'text', text: 'Iniciativa no encontrada' }], isError: true };
        const timestamp = new Date().toISOString().slice(0, 10);
        const riskNote = `[RIESGO ${timestamp}] ${reason}`;
        const newDescription = initiative.description
          ? `${initiative.description}\n\n${riskNote}`
          : riskNote;
        await this.db.execute(
          `UPDATE initiatives SET description = $1, updated_at = NOW() WHERE id = $2`,
          [newDescription, initiativeId],
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, initiative_id: initiativeId, risk_note: riskNote }) }] };
      }

      case 'list_sprints': {
        const cycleId = call.input['cycle_id'] as string | undefined;
        const teamId  = call.input['team_id']  as string | undefined;
        const resolvedCycleId = cycleId ?? (await this.db.queryOne<{ id: string }>(
          `SELECT id FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`,
          [organizationId],
        ))?.id;
        if (!resolvedCycleId) return { content: [{ type: 'text', text: '[]' }] };
        const params: unknown[] = [resolvedCycleId, organizationId];
        let sql = `SELECT * FROM v_cycle_sprint_timeline WHERE cycle_id = $1 AND organization_id = $2`;
        if (teamId) { params.push(teamId); sql += ` AND team_id = $${params.length}`; }
        sql += ` ORDER BY start_date`;
        const rows = await this.db.query(sql, params);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'close_sprint_with_checkins': {
        const sprintId  = call.input['sprint_id'] as string;
        const velocity  = call.input['velocity']  as number;
        const sprint = await this.db.queryOne<{ id: string; team_id: string }>(
          `SELECT sc.id, sc.team_id FROM sprint_cycles sc
           JOIN cycles c ON c.id = sc.cycle_id
           WHERE sc.id = $1 AND c.organization_id = $2`,
          [sprintId, organizationId],
        );
        if (!sprint) return { content: [{ type: 'text', text: 'Sprint no encontrado' }], isError: true };
        await this.db.execute(`CALL sp_close_sprint($1, $2, $3)`, [sprintId, velocity, userId]);
        const impact = await this.db.queryOne<{ fn_sprint_okr_impact: unknown }>(
          `SELECT fn_sprint_okr_impact($1)`, [sprintId],
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              sprint_id: sprintId,
              velocity_recorded: velocity,
              okr_impact: impact?.fn_sprint_okr_impact,
            }),
          }],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Herramienta desconocida: ${call.name}` }], isError: true };
    }
  }

  private async auditLog(data: {
    toolName: string;
    userId: string;
    organizationId: string;
    inputSummary: string;
    outputSummary: string;
    durationMs: number;
    error?: string;
  }): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO mcp_audit_log
           (tool_name, user_id, organization_id, input_summary, output_summary, duration_ms, error)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          data.toolName, data.userId, data.organizationId,
          data.inputSummary, data.outputSummary, data.durationMs,
          data.error ?? null,
        ],
      );
    } catch (err) {
      this.logger.error(`Failed to write MCP audit log: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
