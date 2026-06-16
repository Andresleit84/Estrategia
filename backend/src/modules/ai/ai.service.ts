import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DbService } from '../../database/db.service';
import { OkrCoachDto } from './dto/okr-coach.dto';
import { CheckInAssistantDto } from './dto/checkin-assistant.dto';
import { StrategyAdvisorDto } from './dto/strategy-advisor.dto';
import { RunAgentDto } from './dto/run-agent.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', 'no-key'),
    });
  }

  private get apiKey() { return this.config.get<string>('ANTHROPIC_API_KEY', ''); }
  private get isApiValid() { return this.apiKey.startsWith('sk-ant-') && this.apiKey.length > 20; }
  private get modelDefault() { return this.config.get<string>('AI_DEFAULT_MODEL', 'claude-sonnet-4-6'); }
  private get modelFast() { return this.config.get<string>('AI_FAST_MODEL', 'claude-haiku-4-5-20251001'); }
  private get modelHeavy() { return this.config.get<string>('AI_HEAVY_MODEL', 'claude-sonnet-4-6'); }
  private get maxTokens() { return parseInt(this.config.get<string>('AI_MAX_TOKENS', '4096')); }

  // ── OKR Coach ─────────────────────────────────────────────────────────────

  async coachOkr(dto: OkrCoachDto) {
    const [quality] = await this.db.query<{ fn_validate_okr_quality: Record<string, unknown> }>(
      `SELECT fn_validate_okr_quality($1, $2, $3, $4, $5)`,
      [dto.title, dto.description ?? null, dto.type ?? 'INCREASE', dto.target ?? null, dto.unit ?? null],
    );
    const dbResult = quality.fn_validate_okr_quality as { score: number; max: number; issues: string[]; quality: string };
    if (dbResult.score >= 9 || !this.isApiValid) {
      return { score: dbResult.score, quality: dbResult.quality, issues: dbResult.issues, suggestions: [] };
    }
    try {
      const prompt = `Eres un experto en metodología OKR. Evalúa este Resultado Clave y proporciona sugerencias concretas.

Resultado Clave: "${dto.title}"
Descripción: "${dto.description ?? '(sin descripción)'}"
Tipo: ${dto.type ?? 'INCREASE'} | Objetivo: ${dto.target ?? 'no especificado'} ${dto.unit ?? ''}
Problemas detectados: ${dbResult.issues.length > 0 ? dbResult.issues.join(', ') : 'ninguno'}

Proporciona exactamente 2-3 sugerencias concretas y accionables. Una por línea, comenzando con "•". En español.`;
      const response = await this.anthropic.messages.create({
        model: this.modelFast, max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const suggestions = text.split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^•\s*/, '').trim()).filter(Boolean).slice(0, 3);
      return { score: dbResult.score, quality: dbResult.quality, issues: dbResult.issues, suggestions };
    } catch (err) {
      this.logger.warn(`OKR Coach AI failed: ${err instanceof Error ? err.message : String(err)}`);
      return { score: dbResult.score, quality: dbResult.quality, issues: dbResult.issues, suggestions: [] };
    }
  }

  // ── Check-in Assistant ────────────────────────────────────────────────────

  async checkinAssistant(orgId: string, dto: CheckInAssistantDto) {
    const kr = await this.db.queryOne<Record<string, unknown>>(
      `SELECT kr.*, o.title AS objective_title, o.level, u.name AS owner_name,
         (SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id) AS last_checkin_at,
         (SELECT COUNT(*) FROM check_ins ci WHERE ci.kr_id = kr.id) AS total_checkins
       FROM key_results kr
       JOIN objectives o ON kr.objective_id = o.id
       LEFT JOIN users u ON kr.owner_id = u.id
       WHERE kr.id = $1 AND o.organization_id = $2 AND kr.deleted_at IS NULL`,
      [dto.kr_id, orgId],
    );
    if (!kr) return { suggestion: null, questions: [], question: null };

    const history = await this.db.query<Record<string, unknown>>(
      `SELECT current_value, confidence, notes, mood, checked_at FROM check_ins WHERE kr_id = $1 ORDER BY checked_at DESC LIMIT 4`,
      [dto.kr_id],
    );

    const FALLBACK_QUESTIONS = [
      '¿Qué acción concreta impulsó este resultado esta semana?',
      '¿Qué obstáculo específico podría frenar el avance la próxima semana?',
      '¿Hay algo que el equipo necesita saber sobre este KR ahora mismo?',
    ];

    if (!this.isApiValid) {
      return { suggestion: null, questions: FALLBACK_QUESTIONS, question: FALLBACK_QUESTIONS[0] };
    }

    try {
      const historyText = history.length
        ? history.map((h) => `- ${new Date(String(h['checked_at'])).toLocaleDateString('es')}: valor=${h['current_value']}, confianza=${Math.round(Number(h['confidence']) * 100)}%${h['notes'] ? ', nota: "' + String(h['notes']) + '"' : ''}`).join('\n')
        : '(primer check-in)';
      const delta = dto.current_value - Number(kr['current_value']);
      const deltaText = delta > 0 ? `+${delta.toFixed(1)} (mejora)` : delta < 0 ? `${delta.toFixed(1)} (retroceso)` : 'sin cambio';
      const prompt = `Eres el Check-in Assistant de un sistema OKR. Genera preguntas de reflexion y una nota de actualizacion.
KR: "${kr['title']}" | Objetivo: "${kr['objective_title']}" | Nivel: ${kr['level']}
Tipo: ${kr['type']} | Meta: ${kr['target_value']} ${kr['metric_unit'] || ''}
Valor anterior: ${kr['current_value']} → Ahora: ${dto.current_value} (${deltaText}) | Confianza: ${Math.round(dto.confidence * 100)}%
Historial reciente: ${historyText}

Responde SOLO JSON sin markdown:
{
  "questions": ["pregunta 1 especifica al contexto", "pregunta 2", "pregunta 3"],
  "suggestion": "nota 2-3 oraciones para el check-in actual"
}
Las preguntas deben ser concretas, utiles y adaptadas a esta situacion especifica (tendencia, tipo de KR, nivel de confianza).`;
      const response = await this.anthropic.messages.create({
        model: this.modelFast, max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      try {
        const p = JSON.parse(jsonStr);
        const questions: string[] = Array.isArray(p.questions) ? p.questions.slice(0, 3) : FALLBACK_QUESTIONS;
        return { suggestion: p.suggestion ?? null, questions, question: questions[0] ?? null };
      } catch {
        return { suggestion: raw, questions: FALLBACK_QUESTIONS, question: FALLBACK_QUESTIONS[0] };
      }
    } catch (err) {
      this.logger.warn(`Check-in Assistant failed: ${err instanceof Error ? err.message : String(err)}`);
      return { suggestion: null, questions: FALLBACK_QUESTIONS, question: FALLBACK_QUESTIONS[0] };
    }
  }

  async generateCheckinSummary(orgId: string, checkInId: string) {
    const ci = await this.db.queryOne<Record<string, unknown>>(
      `SELECT ci.current_value, ci.confidence, ci.notes, ci.mood, ci.checked_at,
         kr.title AS kr_title, kr.target_value, kr.metric_unit, kr.type AS kr_type,
         o.title AS objective_title, o.level,
         u.name AS owner_name,
         prev.current_value AS prev_value
       FROM check_ins ci
       JOIN key_results kr ON kr.id = ci.kr_id
       JOIN objectives o ON o.id = kr.objective_id
       LEFT JOIN users u ON u.id = ci.user_id
       LEFT JOIN LATERAL (
         SELECT current_value FROM check_ins c2
         WHERE c2.kr_id = ci.kr_id AND c2.checked_at < ci.checked_at
         ORDER BY c2.checked_at DESC LIMIT 1
       ) prev ON true
       WHERE ci.id = $1 AND o.organization_id = $2`,
      [checkInId, orgId],
    );
    if (!ci) return { summary: null };

    if (!this.isApiValid) {
      const prog = ci['current_value'] != null
        ? `El valor actual es ${ci['current_value']} ${ci['metric_unit'] || ''}`.trim()
        : '';
      return { summary: `${ci['owner_name'] || 'El responsable'} actualizó "${ci['kr_title']}". ${prog}. ${ci['notes'] || ''}`.trim() };
    }

    try {
      const delta = ci['prev_value'] != null
        ? ` (anterior: ${ci['prev_value']}, cambio: ${(Number(ci['current_value']) - Number(ci['prev_value'])).toFixed(1)})`
        : '';

      // Include forecast data for richer manager summary
      const [forecastRow] = await this.db.query<{ fn_kr_forecast: Record<string, unknown> }>(
        `SELECT fn_kr_forecast(kr_id) FROM check_ins WHERE id = $1`,
        [checkInId],
      ).catch(() => []);
      const fc = forecastRow?.fn_kr_forecast as Record<string, unknown> | undefined;
      const forecastLine = fc && !fc['insufficient_data']
        ? `\nPrediccion cierre del ciclo: ${fc['projected_completion_pct']}% (${fc['action_type']}) — ${fc['days_remaining']} dias restantes.${Number(fc['gap_units']) > 0 ? ` Brecha: ${fc['gap_units']} ${fc['metric_unit']}.` : ''}`
        : '';

      const prompt = `Genera un resumen ejecutivo breve (2-3 oraciones) de este check-in para compartir con el manager. Tono profesional, en espanol, tercera persona. Si hay prediccion negativa, menciona la alerta de forma clara.
Responsable: ${ci['owner_name'] || 'el equipo'}
KR: "${ci['kr_title']}" | Meta: ${ci['target_value']} ${ci['metric_unit'] || ''}
Valor actual: ${ci['current_value']}${delta} | Confianza: ${Math.round(Number(ci['confidence']) * 100)}%
Notas del responsable: ${ci['notes'] || '(sin notas)'}
Animo: ${ci['mood'] || 'no indicado'}${forecastLine}

Responde solo el parrafo, sin encabezado.`;
      const response = await this.anthropic.messages.create({
        model: this.modelFast, max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });
      const summary = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
      return { summary };
    } catch (err) {
      this.logger.warn(`Checkin summary failed: ${err instanceof Error ? err.message : String(err)}`);
      return { summary: null };
    }
  }

  // ── Risk Sentinel ─────────────────────────────────────────────────────────

  async runRiskSentinel(orgId: string, cycleId?: string): Promise<Record<string, unknown>> {
    const cycle = cycleId
      ? await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE id = $1 AND organization_id = $2`, [cycleId, orgId])
      : await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [orgId]);

    const atRiskParams: unknown[] = [orgId];
    if (cycle) atRiskParams.push(cycle.id);

    const [atRiskKrs, cadence, objectivesPace] = await Promise.all([
      this.db.query<Record<string, unknown>>(
        `SELECT * FROM v_at_risk_krs WHERE organization_id = $1${cycle ? ' AND cycle_id = $2' : ''} ORDER BY (objective_level = 'COMPANY') DESC, days_since_checkin DESC LIMIT 20`,
        atRiskParams,
      ),
      this.db.query<Record<string, unknown>>(
        `SELECT * FROM v_cadence_dashboard WHERE organization_id = $1${cycle ? ' AND cycle_id = $2' : ''} ORDER BY days_since_checkin DESC NULLS LAST LIMIT 10`,
        atRiskParams,
      ),
      cycle
        ? this.db.query<{ id: string; title: string; level: string; code: string | null; progress: number; days_elapsed: number; days_remaining: number }>(
            `SELECT
               o.id, o.title, o.level, o.code,
               fn_calculate_objective_progress(o.id)::float AS progress,
               GREATEST(1, CURRENT_DATE - c.start_date::date)::int AS days_elapsed,
               GREATEST(0, c.end_date::date - CURRENT_DATE)::int  AS days_remaining
             FROM objectives o
             JOIN cycles c ON c.id = o.cycle_id
             WHERE o.organization_id = $1 AND c.id = $2
               AND o.status = 'ACTIVE' AND o.deleted_at IS NULL`,
            [orgId, cycle.id],
          )
        : Promise.resolve([] as { id: string; title: string; level: string; code: string | null; progress: number; days_elapsed: number; days_remaining: number }[]),
    ]);

    // ── Early warnings: objectives not yet at risk but projected to fail ──────
    const atRiskObjTitles = new Set(atRiskKrs.map((k) => String(k['objective_title'])));
    type EarlyWarning = { objective_id: string; objective_title: string; level: string; code: string | null; current_progress: number; projected_progress: number; days_remaining: number; pace_per_day: number; already_at_risk: boolean };
    const earlyWarnings: EarlyWarning[] = objectivesPace
      .filter((o) => {
        const progress = Number(o.progress);
        const daysElapsed = Number(o.days_elapsed);
        const daysRemaining = Number(o.days_remaining);
        if (daysElapsed <= 0 || daysRemaining <= 0) return false;
        const pace = progress / daysElapsed;
        const projected = Math.min(100, progress + pace * daysRemaining);
        return projected < 70 && progress < 85;
      })
      .map((o) => {
        const progress = Number(o.progress);
        const daysElapsed = Number(o.days_elapsed);
        const daysRemaining = Number(o.days_remaining);
        const pace = progress / daysElapsed;
        return {
          objective_id: o.id,
          objective_title: o.title,
          level: o.level,
          code: o.code,
          current_progress: Math.round(progress),
          projected_progress: Math.round(Math.min(100, progress + pace * daysRemaining)),
          days_remaining: daysRemaining,
          pace_per_day: Math.round(pace * 10) / 10,
          already_at_risk: atRiskObjTitles.has(o.title),
        };
      })
      .sort((a, b) => a.projected_progress - b.projected_progress)
      .slice(0, 6);

    const summary = {
      total_at_risk: atRiskKrs.length,
      company_level_at_risk: atRiskKrs.filter((k) => k['objective_level'] === 'COMPANY').length,
      at_risk_krs: atRiskKrs.slice(0, 10),
      stale_krs: cadence.filter((k) => Number(k['days_since_checkin']) > 14).length,
      cycle: cycle?.name,
      early_warnings: earlyWarnings,
    };

    let analysis = 'Sin análisis de IA disponible. Revisar los KRs en riesgo manualmente.';
    let priorities: string[] = [];
    let recommendations: string[] = [];
    let early_warnings_analysis = '';
    let early_warning_actions: { objective: string; action: string; urgency: 'critical' | 'high' | 'medium' }[] = [];

    if (this.isApiValid && (atRiskKrs.length > 0 || earlyWarnings.length > 0)) {
      try {
        const krList = atRiskKrs.slice(0, 10).map((k) =>
          `- [${k['level']}] "${k['kr_title']}" (obj: "${k['objective_title']}"): confianza=${Math.round(Number(k['confidence'] ?? 0) * 100)}%, progreso=${Math.round(Number(k['progress'] ?? 0))}%, días sin check-in=${k['days_since_checkin'] ?? 'N/A'}`
        ).join('\n');
        const warningList = earlyWarnings.length > 0
          ? earlyWarnings.map((w) =>
              `- [${w.level}] "${w.objective_title}": progreso actual=${w.current_progress}%, proyección al cierre=${w.projected_progress}%, días restantes=${w.days_remaining}, ritmo=${w.pace_per_day}%/día`
            ).join('\n')
          : 'Ninguno';

        const prompt = `Eres el Risk Sentinel de un sistema OKR. Tienes dos tipos de señales: riesgos actuales y alertas tempranas (objetivos que AÚN no están en riesgo pero van a fallar al ritmo actual).

${atRiskKrs.length > 0 ? `KRs actualmente en riesgo (${atRiskKrs.length}):\n${krList}` : 'Sin KRs en riesgo actualmente.'}

Alertas tempranas — objetivos que fallarán si no se actúa ahora (${earlyWarnings.length}):
${warningList}

Genera en JSON (sin markdown, solo JSON):
{
  "analysis": "párrafo ejecutivo de 3-4 oraciones sobre el estado de riesgo global del ciclo",
  "priorities": ["top 3 KRs o alertas más críticos como strings"],
  "recommendations": ["3-4 recomendaciones de gestión a nivel ciclo"],
  "early_warnings_analysis": "párrafo de 2-3 oraciones explicando qué objetivos fallarán si no hay intervención en las próximas 2 semanas y por qué",
  "early_warning_actions": [
    {"objective": "título exacto del objetivo", "action": "acción específica concreta en 1-2 oraciones", "urgency": "critical|high|medium"}
  ]
}

KRs en riesgo (ordenados por impacto):
${krList}

Genera en JSON:
{
  "analysis": "párrafo ejecutivo de 3-4 oraciones explicando el estado general de riesgo",
  "priorities": ["top 3 KRs críticos que necesitan atención inmediata como strings"],
  "recommendations": ["3 recomendaciones accionables como strings"]
}`;
        const response = await this.anthropic.messages.create({ model: this.modelDefault, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] });
        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
          analysis = parsed.analysis ?? analysis;
          priorities = parsed.priorities ?? [];
          recommendations = parsed.recommendations ?? [];
          early_warnings_analysis = parsed.early_warnings_analysis ?? '';
          early_warning_actions = parsed.early_warning_actions ?? [];
        }
      } catch (err) { this.logger.warn(`Risk Sentinel AI failed: ${err instanceof Error ? err.message : String(err)}`); }
    }

    const report = {
      ...summary,
      analysis,
      priorities,
      recommendations,
      early_warnings_analysis,
      early_warning_actions,
      generated_at: new Date().toISOString(),
      generated_by: '[AI] Risk Sentinel',
    };
    await this.storeBriefing(orgId, cycle?.id ?? null, 'risk_sentinel', `Risk Sentinel — ${cycle?.name ?? 'Ciclo activo'}`, report, null);
    return report;
  }

  // ── Executive Briefer ─────────────────────────────────────────────────────

  async generateExecutiveBriefing(orgId: string, userId: string, cycleId?: string): Promise<Record<string, unknown>> {
    const cycle = cycleId
      ? await this.db.queryOne<Record<string, unknown>>(`SELECT * FROM v_cycles_with_stats WHERE id = $1 AND organization_id = $2`, [cycleId, orgId])
      : await this.db.queryOne<Record<string, unknown>>(`SELECT * FROM v_cycles_with_stats WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [orgId]);

    if (!cycle) return { error: 'No hay ciclo activo' };

    const objectives = await this.db.query<Record<string, unknown>>(
      `SELECT title, level, status, fn_calculate_objective_progress(id) as progress FROM objectives WHERE cycle_id = $1 AND deleted_at IS NULL ORDER BY level, status`,
      [cycle['id']],
    );
    const atRisk = await this.db.query(`SELECT * FROM v_at_risk_krs WHERE organization_id = $1 AND cycle_id = $2 LIMIT 5`, [orgId, cycle['id']]);
    const score = await this.db.queryOne<{ fn_get_cycle_score: number }>(`SELECT fn_get_cycle_score($1)`, [cycle['id']]);

    const stats = {
      cycle_name: cycle['name'],
      cycle_status: cycle['status'],
      total_objectives: objectives.length,
      on_track: objectives.filter((o) => o['status'] === 'ACTIVE' && Number(o['progress']) >= 60).length,
      behind: objectives.filter((o) => o['status'] === 'ACTIVE' && Number(o['progress']) < 40).length,
      completed: objectives.filter((o) => o['status'] === 'COMPLETED').length,
      at_risk_count: atRisk.length,
      cycle_score: score?.fn_get_cycle_score ?? 0,
    };

    let narrative = `Ciclo "${cycle['name']}": ${stats.total_objectives} objetivos activos, ${stats.on_track} en camino, ${stats.behind} rezagados. Score del ciclo: ${stats.cycle_score}.`;
    let highlights: string[] = [];
    let risks: string[] = [];
    let nextSteps: string[] = [];

    if (this.isApiValid) {
      try {
        const objList = objectives.slice(0, 8).map((o) => `- [${o['level']}] "${o['title']}": ${Math.round(Number(o['progress'] ?? 0))}% (${o['status']})`).join('\n');
        const prompt = `Eres el Executive Briefer de un sistema OKR. Genera el briefing semanal ejecutivo.

Ciclo: "${cycle['name']}" | Score: ${(stats.cycle_score / 10).toFixed(1)}/10
Objetivos (${stats.total_objectives} total, ${stats.on_track} en camino, ${stats.behind} rezagados):
${objList}
KRs en riesgo: ${atRisk.length}

Genera en JSON:
{
  "narrative": "párrafo ejecutivo de 3-4 oraciones sobre el estado del ciclo",
  "highlights": ["3 puntos positivos o logros destacables como strings"],
  "risks": ["2-3 riesgos o áreas de atención como strings"],
  "next_steps": ["3 acciones recomendadas para la próxima semana como strings"]
}`;
        const response = await this.anthropic.messages.create({ model: this.modelDefault, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
        const jsonStart = text.indexOf('{'); const jsonEnd = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
          narrative = parsed.narrative ?? narrative;
          highlights = parsed.highlights ?? [];
          risks = parsed.risks ?? [];
          nextSteps = parsed.next_steps ?? [];
        }
      } catch (err) { this.logger.warn(`Executive Briefer AI failed: ${err instanceof Error ? err.message : String(err)}`); }
    }

    const report = { ...stats, narrative, highlights, risks, next_steps: nextSteps, generated_at: new Date().toISOString(), generated_by: '[AI] Executive Briefer' };
    await this.storeBriefing(orgId, cycle['id'] as string, 'executive_briefing', `Briefing — ${cycle['name']}`, report, userId);
    return report;
  }

  // ── Personal Briefer ──────────────────────────────────────────────────────

  async generatePersonalBriefing(orgId: string, userId: string): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<{ fn_personal_briefing: Record<string, unknown> }>(
      `SELECT fn_personal_briefing($1, $2)`,
      [orgId, userId],
    );

    if (!row?.fn_personal_briefing) return { error: 'No hay datos para este usuario' };
    const data = row.fn_personal_briefing;

    const atRiskKrs     = (data['at_risk_krs']   as Record<string, unknown>[]) ?? [];
    const agreementsDue = (data['agreements_due'] as Record<string, unknown>[]) ?? [];
    const sprintItems   = (data['sprint_items']   as Record<string, unknown>[]) ?? [];

    let bullets: string[] = [];

    if (this.isApiValid) {
      try {
        const krList = atRiskKrs.slice(0, 3).map(k =>
          `- "${k['kr_title']}" (${k['objective_title']}): ${k['progress']}% · confianza ${Math.round(Number(k['confidence']) * 100)}%${Number(k['days_since_checkin']) > 14 ? ` · sin check-in ${k['days_since_checkin']}d` : ''}`
        ).join('\n') || 'Ninguno';
        const agrList = agreementsDue.slice(0, 3).map(a =>
          `- "${a['title']}" — ${a['is_overdue'] ? `vencido hace ${Math.abs(Number(a['days_remaining']))}d` : `vence en ${a['days_remaining']}d`}`
        ).join('\n') || 'Ninguno';
        const storyList = sprintItems.slice(0, 3).map(s =>
          `- [${s['status']}] "${s['title']}" (${s['priority']})`
        ).join('\n') || 'Ninguno';

        const prompt = `Eres el asistente pre-reunión de ${data['user_name']}. Generá exactamente 3 bullets accionables para que llegue preparado a la reunión del lunes.\n\nOKRs en riesgo (${atRiskKrs.length}):\n${krList}\n\nAcuerdos urgentes (${agreementsDue.length}):\n${agrList}\n\nHistorias activas en sprint (${sprintItems.length}):\n${storyList}\n\nReglas: exactamente 3 bullets, máx 25 palabras cada uno, iniciá con verbo de acción, tono directo.\n\nRespondé SOLO en JSON: {"bullets":["bullet1","bullet2","bullet3"]}`;

        const response = await this.anthropic.messages.create({
          model: this.modelFast,
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
        const jsonStart = text.indexOf('{'); const jsonEnd = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd)) as { bullets?: unknown };
          bullets = (Array.isArray(parsed.bullets) ? parsed.bullets as string[] : []).slice(0, 3);
        }
      } catch (err) {
        this.logger.warn(`Personal Briefer AI failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (bullets.length < 3) {
      const fallbacks: string[] = [];
      if (atRiskKrs.length > 0)    fallbacks.push(`Revisar ${atRiskKrs.length} KR${atRiskKrs.length > 1 ? 's' : ''} en riesgo antes de la reunión`);
      if (agreementsDue.length > 0) fallbacks.push(`Cerrar ${agreementsDue.length} acuerdo${agreementsDue.length > 1 ? 's' : ''} que vence${agreementsDue.length > 1 ? 'n' : ''} esta semana`);
      if (sprintItems.length > 0)   fallbacks.push(`Reportar avance de ${sprintItems.length} historia${sprintItems.length > 1 ? 's' : ''} activa${sprintItems.length > 1 ? 's' : ''} en sprint`);
      while (fallbacks.length < 3)  fallbacks.push('Actualizar progreso de OKRs para la revisión semanal');
      bullets = [...bullets, ...fallbacks.slice(0, 3 - bullets.length)];
    }

    const cycleId = (data['cycle_id'] as string | null) ?? null;
    const report: Record<string, unknown> = { ...data, bullets, generated_at: new Date().toISOString(), generated_by: '[AI] Personal Briefer' };
    await this.storeBriefing(orgId, cycleId, 'personal_briefing', `Briefing personal — ${String(data['user_name'])}`, report, userId);
    return report;
  }

  async getLatestPersonalBriefing(orgId: string, userId: string): Promise<Record<string, unknown> | null> {
    return this.db.queryOne<Record<string, unknown>>(
      `SELECT id, type, title, cycle_id, content, created_at FROM ai_briefings WHERE organization_id = $1 AND type = 'personal_briefing' AND created_by = $2 ORDER BY created_at DESC LIMIT 1`,
      [orgId, userId],
    );
  }

  // ── Alignment Auditor ─────────────────────────────────────────────────────

  async runAlignmentAudit(orgId: string, cycleId?: string): Promise<Record<string, unknown>> {
    const cycle = cycleId
      ? await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE id = $1 AND organization_id = $2`, [cycleId, orgId])
      : await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [orgId]);

    if (!cycle) return { error: 'No hay ciclo activo' };

    const [gaps] = await this.db.query<{ fn_get_alignment_gaps: Record<string, unknown> }>(
      `SELECT fn_get_alignment_gaps($1, $2)`,
      [cycle.id, orgId],
    );
    const gapsData = gaps?.fn_get_alignment_gaps ?? {};
    const alignmentMap = await this.db.query(
      `SELECT * FROM v_alignment_map WHERE organization_id = $1 AND cycle_id = $2`,
      [orgId, cycle.id],
    );

    let analysis = 'Revisar el mapa de alineación para identificar brechas manualmente.';
    let alignmentScore = 50;
    let suggestions: string[] = [];

    if (this.isApiValid) {
      try {
        const mapText = alignmentMap.slice(0, 5).map((m) =>
          `- "${m['company_title']}" → ${m['area_count'] ?? 0} áreas, ${m['team_count'] ?? 0} equipos`
        ).join('\n');
        const prompt = `Eres el Alignment Auditor de un sistema OKR. Analiza la alineación estratégica.

Ciclo: "${cycle.name}"
Mapa de alineación (primeros 5 objetivos empresa):
${mapText}
Datos de brechas: ${JSON.stringify(gapsData).slice(0, 500)}

Genera en JSON:
{
  "alignment_score": número del 0-100 indicando nivel de alineación,
  "analysis": "párrafo de 2-3 oraciones sobre el estado de alineación",
  "suggestions": ["3 sugerencias específicas para mejorar la alineación como strings"]
}`;
        const response = await this.anthropic.messages.create({ model: this.modelDefault, max_tokens: 800, messages: [{ role: 'user', content: prompt }] });
        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
        const jsonStart = text.indexOf('{'); const jsonEnd = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
          analysis = parsed.analysis ?? analysis;
          alignmentScore = parsed.alignment_score ?? alignmentScore;
          suggestions = parsed.suggestions ?? [];
        }
      } catch (err) { this.logger.warn(`Alignment Auditor AI failed: ${err instanceof Error ? err.message : String(err)}`); }
    }

    const report = {
      cycle_name: cycle.name,
      cycle_id: cycle.id,
      alignment_score: alignmentScore,
      gaps: gapsData,
      analysis,
      suggestions,
      alignment_map_count: alignmentMap.length,
      generated_at: new Date().toISOString(),
      generated_by: '[AI] Alignment Auditor',
    };
    await this.storeBriefing(orgId, cycle.id, 'alignment_audit', `Auditoría Alineación — ${cycle.name}`, report, null);
    return report;
  }

  // ── Strategy Advisor ──────────────────────────────────────────────────────

  async strategyAdvisor(orgId: string, userId: string, dto: StrategyAdvisorDto): Promise<Record<string, unknown>> {
    const activeCycle = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM v_cycles_with_stats WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [orgId]
    );
    const objectives = activeCycle
      ? await this.db.query(`SELECT title, level, status, fn_calculate_objective_progress(id) as progress FROM objectives WHERE cycle_id = $1 AND deleted_at IS NULL LIMIT 10`, [activeCycle['id']])
      : [];
    const atRisk = activeCycle
      ? await this.db.query(`SELECT kr_title, objective_title, confidence, progress FROM v_at_risk_krs WHERE organization_id = $1 AND cycle_id = $2 LIMIT 5`, [orgId, activeCycle['id']])
      : [];

    let conversationId = dto.conversation_id;
    let messages: Array<{ role: string; content: string }> = [];

    if (conversationId) {
      const conv = await this.db.queryOne<{ messages: unknown }>(`SELECT messages FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversationId, userId]);
      if (conv) messages = conv.messages as Array<{ role: string; content: string }>;
    }

    const systemPrompt = `Eres el Strategy Advisor de un sistema OKR. Eres un consultor estratégico experto que ayuda a la organización a mejorar su ejecución estratégica.

CONTEXTO ACTUAL:
${activeCycle ? `Ciclo activo: "${activeCycle['name']}" | Score: ${activeCycle['score'] ?? 0}` : 'Sin ciclo activo'}
${objectives.length > 0 ? `Objetivos (${objectives.length}):\n${objectives.map((o) => `- [${o['level']}] "${o['title']}": ${Math.round(Number(o['progress'] ?? 0))}%`).join('\n')}` : ''}
${atRisk.length > 0 ? `KRs en riesgo:\n${atRisk.map((k) => `- "${k['kr_title']}": ${Math.round(Number(k['confidence'] ?? 0) * 100)}% confianza`).join('\n')}` : ''}

Responde en español, de forma concisa y accionable. Cuando hagas referencias a datos específicos del contexto, cítalos.`;

    messages.push({ role: 'user', content: dto.message });

    let reply = 'El Strategy Advisor no está disponible en este momento. Revisa la configuración de la API de IA.';
    let sources: string[] = [];
    let suggestedActions: string[] = [];

    if (this.isApiValid) {
      try {
        const response = await this.anthropic.messages.create({
          model: this.modelDefault,
          max_tokens: 1500,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        });
        reply = response.content[0].type === 'text' ? response.content[0].text : reply;
        if (activeCycle) sources.push(`Ciclo: ${activeCycle['name']}`);
        if (objectives.length) sources.push(`${objectives.length} objetivos del ciclo activo`);
        if (atRisk.length) sources.push(`${atRisk.length} KRs en riesgo`);

        // Derive suggested actions from reply content
        if (/riesgo|en riesgo|at.risk/i.test(reply)) suggestedActions.push('Ver Risk Dashboard');
        if (/check.in|cadencia/i.test(reply)) suggestedActions.push('Ver Check-ins');
        if (/alineaci[oó]n|brecha/i.test(reply)) suggestedActions.push('Ver Alineación');
        if (/briefing|resumen ejecutivo/i.test(reply)) suggestedActions.push('Ver Briefing Ejecutivo');
        if (/objetivo|okr/i.test(reply)) suggestedActions.push('Ver OKRs');
      } catch (err) { this.logger.warn(`Strategy Advisor AI failed: ${err instanceof Error ? err.message : String(err)}`); }
    }

    messages.push({ role: 'assistant', content: reply });

    if (!conversationId) {
      const conv = await this.db.queryOne<{ id: string }>(
        `INSERT INTO ai_conversations (organization_id, user_id, cycle_id, title, messages)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [orgId, userId, activeCycle?.['id'] ?? null, dto.message.slice(0, 60), JSON.stringify(messages)],
      );
      conversationId = conv?.id;
    } else {
      await this.db.execute(
        `UPDATE ai_conversations SET messages = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(messages), conversationId],
      );
    }

    return { reply, conversation_id: conversationId, sources, suggested_actions: suggestedActions };
  }

  // ── Suggest Delivery (fases + entregables) ────────────────────────────────

  async suggestDelivery(orgId: string, programId: string): Promise<Record<string, unknown>> {
    if (!this.isApiValid) {
      return { phases: [], error: 'API de IA no configurada. Configura ANTHROPIC_API_KEY.' };
    }

    try {
      const program = await this.db.queryOne<Record<string, unknown>>(
        `SELECT name, description, status FROM v_program_dashboard WHERE id = $1 AND organization_id = $2`,
        [programId, orgId],
      );
      if (!program) return { phases: [], error: 'Programa no encontrado.' };

      const existingPhases = await this.db.query<{ name: string }>(
        `SELECT name FROM delivery_phases WHERE program_id = $1 ORDER BY order_index`,
        [programId],
      );

      const existingText = existingPhases.length > 0
        ? `\nFASES YA EXISTENTES (no duplicar):\n` + existingPhases.map(p => `- ${p.name}`).join('\n')
        : '';

      const prompt = `Eres experto en gestión de proyectos. Propón 3-5 fases con 2-4 entregables cada una para:

PROGRAMA: "${program['name']}"
${program['description'] ? `Descripción: ${program['description']}` : ''}
${existingText}

Responde SOLO con JSON válido:
{"phases":[{"name":"...","description":"...","gate_criteria":"...","deliverables":[{"title":"...","description":"...","acceptance_criteria":"..."}]}]}`;

      const response = await this.anthropic.messages.create({
        model: this.modelFast,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { phases: [], error: 'La IA no devolvió un JSON válido.' };

      const parsed = JSON.parse(jsonMatch[0]) as { phases: unknown[] };
      return { phases: parsed.phases ?? [] };
    } catch (err) {
      this.logger.warn(`suggestDelivery failed: ${err instanceof Error ? err.message : String(err)}`);
      return { phases: [], error: 'Error al generar sugerencias. Intenta de nuevo.' };
    }
  }

  // ── Delivery Advisor ──────────────────────────────────────────────────────

  async deliveryAdvisor(orgId: string, userId: string, dto: { program_id?: string; message: string; conversation_id?: string }): Promise<Record<string, unknown>> {
    try {
    let systemPrompt: string;
    let sources: string[];
    let conversationTitle: string;

    if (dto.program_id) {
      // Single-program context
      const program = await this.db.queryOne<Record<string, unknown>>(
        `SELECT * FROM v_program_dashboard WHERE id = $1 AND organization_id = $2`,
        [dto.program_id, orgId],
      );
      if (!program) return { reply: 'Programa no encontrado.', conversation_id: null, sources: [] };

      const phases = await this.db.query<{ id: string; name: string; status: string; completion_pct: number; total_deliverables: number; approved_count: number }>(
        `SELECT id, name, status, completion_pct, total_deliverables, approved_count FROM v_phase_progress WHERE program_id = $1 ORDER BY order_index`,
        [dto.program_id],
      );

      const phaseIds = phases.map((p) => p.id);
      const deliverables = phaseIds.length > 0
        ? await this.db.query<{ phase_id: string; title: string; status: string; due_date: string | null; acceptance_criteria: string | null }>(
            `SELECT phase_id, title, status, due_date, acceptance_criteria FROM deliverables WHERE phase_id = ANY($1) AND deleted_at IS NULL ORDER BY created_at`,
            [`{${phaseIds.join(',')}}`],
          )
        : [];

      const phaseContext = phases.map((p, i) => {
        const phaseDelivs = deliverables.filter((d) => d.phase_id === p.id);
        const lines = phaseDelivs.map((d) =>
          `  • [${d.status}] ${d.title}${d.due_date ? ` (vence: ${d.due_date.slice(0, 10)})` : ''}${d.acceptance_criteria ? ` — criterio: ${d.acceptance_criteria.slice(0, 80)}` : ''}`,
        ).join('\n');
        return `Fase ${i + 1}: "${p.name}" (${p.status}) — ${p.approved_count}/${p.total_deliverables} completados (${Math.round(p.completion_pct)}%)\n${lines || '  (sin entregables)'}`;
      }).join('\n\n');

      systemPrompt = `Eres un Delivery Coach experto en gestión de proyectos, entregables y ejecución estratégica. Tu rol es ayudar al equipo a completar su programa de entrega con calidad y a tiempo.

PROGRAMA: "${program['name']}"
Estado: ${program['status']} | Progreso general: ${Math.round(Number(program['completion_pct'] ?? 0))}%
Fases: ${program['phase_count']} | Entregables: ${program['total_deliverables']} total (${program['approved_count']} completados)
${program['description'] ? `Descripción: ${program['description']}` : ''}

DETALLE POR FASES:
${phaseContext || '(Sin fases configuradas)'}

Fecha actual: ${new Date().toLocaleDateString('es-ES')}

INSTRUCCIONES:
- Responde en español, de forma directa y accionable.
- Cuando identifiques riesgos (entregables vencidos, fases bloqueadas, baja completitud), señálalos claramente.
- Puedes sugerir qué entregables priorizar, cómo redactar criterios de aceptación, o qué documentos son clave para cada fase.
- Si el usuario pregunta qué falta, revisa el estado de cada entregable y sé específico.`;

      sources = [`Programa: ${program['name']}`, `${phases.length} fases`, `${deliverables.length} entregables`];
      conversationTitle = `Delivery: ${String(program['name']).slice(0, 50)}`;
    } else {
      // All-programs context (list page)
      const programs = await this.db.query<Record<string, unknown>>(
        `SELECT name, status, completion_pct, phase_count, total_deliverables, approved_count FROM v_program_dashboard WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [orgId],
      );

      const programSummary = programs.map((p) =>
        `• "${p['name']}" (${p['status']}) — ${Math.round(Number(p['completion_pct'] ?? 0))}% completado, ${p['approved_count']}/${p['total_deliverables']} entregables`,
      ).join('\n');

      systemPrompt = `Eres un Delivery Coach experto en gestión de proyectos y entregables. Ayudas al equipo a gestionar todos sus programas de entrega con claridad y criterio.

PORTAFOLIO DE PROGRAMAS (${programs.length} total):
${programSummary || '(Sin programas configurados)'}

Fecha actual: ${new Date().toLocaleDateString('es-ES')}

INSTRUCCIONES:
- Responde en español, de forma directa y accionable.
- Puedes hablar de todos los programas o de uno en particular según la pregunta.
- Identifica cuáles programas tienen más riesgo o necesitan atención.
- Si el usuario pregunta por un programa específico, responde con la información disponible.
- Puedes orientar sobre mejores prácticas de delivery, criterios de aceptación y gestión de fases.`;

      sources = [`${programs.length} programas`, `${programs.filter((p) => p['status'] === 'ACTIVE').length} activos`];
      conversationTitle = `Delivery Coach — portafolio`;
    }

    let conversationId = dto.conversation_id;
    let messages: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      const conv = await this.db.queryOne<{ messages: unknown }>(`SELECT messages FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversationId, userId]);
      if (conv) messages = conv.messages as Array<{ role: string; content: string }>;
    }

    messages.push({ role: 'user', content: dto.message });

    let reply = 'El Delivery Coach no está disponible. Verifica la configuración de la API de IA.';

    if (this.isApiValid) {
      try {
        const response = await this.anthropic.messages.create({
          model: this.modelDefault,
          max_tokens: 1500,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        });
        reply = response.content[0].type === 'text' ? response.content[0].text : reply;
      } catch (err) {
        this.logger.warn(`Delivery Advisor AI failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    messages.push({ role: 'assistant', content: reply });

    if (!conversationId) {
      const conv = await this.db.queryOne<{ id: string }>(
        `INSERT INTO ai_conversations (organization_id, user_id, cycle_id, title, messages) VALUES ($1, $2, NULL, $3, $4) RETURNING id`,
        [orgId, userId, conversationTitle, JSON.stringify(messages)],
      );
      conversationId = conv?.id;
    } else {
      await this.db.execute(`UPDATE ai_conversations SET messages = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(messages), conversationId]);
    }

    return { reply, conversation_id: conversationId, sources };
    } catch (err) {
      this.logger.warn(`deliveryAdvisor failed: ${err instanceof Error ? err.message : String(err)}`);
      return { reply: 'Error al procesar la consulta. Intenta de nuevo.', conversation_id: dto.conversation_id ?? null, sources: [] };
    }
  }

  // ── Cycle Close Briefer ───────────────────────────────────────────────────

  async generateCycleCloseBriefing(orgId: string, cycleId: string): Promise<Record<string, unknown>> {
    const cycle = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM v_cycles_with_stats WHERE id = $1 AND organization_id = $2`,
      [cycleId, orgId],
    );
    if (!cycle) return {};

    const [objectives, atRisk, scoreRow] = await Promise.all([
      this.db.query<Record<string, unknown>>(
        `SELECT title, level, status, fn_calculate_objective_progress(id) AS progress
           FROM objectives WHERE cycle_id = $1 AND deleted_at IS NULL
           ORDER BY level, status`,
        [cycleId],
      ),
      this.db.query<Record<string, unknown>>(
        `SELECT kr_title, objective_title, confidence, progress, objective_level
           FROM v_at_risk_krs WHERE organization_id = $1 AND cycle_id = $2 LIMIT 8`,
        [orgId, cycleId],
      ),
      this.db.queryOne<{ fn_get_cycle_score: number }>(
        `SELECT fn_get_cycle_score($1)`, [cycleId],
      ),
    ]);

    const cycleName  = String(cycle['name']);
    const cycleScore = scoreRow?.fn_get_cycle_score ?? 0;
    const completed  = objectives.filter((o) => o['status'] === 'COMPLETED').length;
    const active     = objectives.filter((o) => o['status'] === 'ACTIVE').length;
    const cancelled  = objectives.filter((o) => o['status'] === 'CANCELLED').length;
    const completionRate = objectives.length > 0 ? Math.round((completed / objectives.length) * 100) : 0;

    let narrative = `El ciclo "${cycleName}" ha sido cerrado con un score de ${(cycleScore / 10).toFixed(1)}/10. ${completed} de ${objectives.length} objetivos completados (${completionRate}%).`;
    let achievements: string[] = [];
    let misses: string[] = [];
    let learnings: string[] = [];
    let nextCycleRecommendations: string[] = [];

    if (this.isApiValid && objectives.length > 0) {
      try {
        const objList = objectives.slice(0, 10).map((o) =>
          `- [${o['level']}] "${o['title']}": ${Math.round(Number(o['progress'] ?? 0))}% (${o['status']})`
        ).join('\n');
        const riskList = atRisk.length > 0
          ? atRisk.map((k) => `- "${k['kr_title']}" (${k['objective_level']}): ${Math.round(Number(k['confidence'] ?? 0) * 100)}% confianza`).join('\n')
          : '(ninguno)';

        const prompt = `Eres el Executive Briefer de un sistema OKR. Se acaba de cerrar el ciclo "${cycleName}". Genera el briefing ejecutivo de cierre.

Ciclo: "${cycleName}" | Score: ${(cycleScore / 10).toFixed(1)}/10
Objetivos — Total: ${objectives.length} | Completados: ${completed} | Activos no cerrados: ${active} | Cancelados: ${cancelled}
Tasa de completitud: ${completionRate}%

Detalle:
${objList}

KRs que quedaron en riesgo al cierre:
${riskList}

Genera en JSON:
{
  "narrative": "párrafo ejecutivo de 3-4 oraciones sobre el cierre: qué se logró, qué no, y el estado general",
  "achievements": ["3 logros más destacados del ciclo"],
  "misses": ["2-3 objetivos o resultados que no se cumplieron y por qué"],
  "learnings": ["3 aprendizajes clave para el equipo"],
  "next_cycle_recommendations": ["3 recomendaciones concretas para el próximo ciclo"]
}`;

        const response = await this.anthropic.messages.create({
          model: this.modelDefault,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
        const jsonStart = text.indexOf('{');
        const jsonEnd   = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
          narrative                  = parsed.narrative                   ?? narrative;
          achievements               = parsed.achievements                ?? [];
          misses                     = parsed.misses                      ?? [];
          learnings                  = parsed.learnings                   ?? [];
          nextCycleRecommendations   = parsed.next_cycle_recommendations  ?? [];
        }
      } catch (err) {
        this.logger.warn(`Cycle Close Briefer AI failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const report = {
      cycle_name: cycleName,
      cycle_id: cycleId,
      cycle_score: Math.round(cycleScore) / 10,
      total_objectives: objectives.length,
      completed,
      active_at_close: active,
      cancelled,
      completion_rate: completionRate,
      at_risk_count: atRisk.length,
      narrative,
      achievements,
      misses,
      learnings,
      next_cycle_recommendations: nextCycleRecommendations,
      generated_at: new Date().toISOString(),
      generated_by: '[AI] Executive Briefer — Cierre',
    };

    await this.storeBriefing(orgId, cycleId, 'cycle_close', `Cierre del ciclo — ${cycleName}`, report, null);
    return report;
  }

  // ── Briefing History ──────────────────────────────────────────────────────

  async getBriefings(orgId: string, type?: string): Promise<unknown[]> {
    const params: unknown[] = [orgId];
    let sql = `SELECT id, type, title, cycle_id, created_at, content->>'cycle_name' as cycle_name FROM ai_briefings WHERE organization_id = $1`;
    if (type) { params.push(type); sql += ` AND type = $${params.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT 20`;
    return this.db.query(sql, params);
  }

  async getBriefing(orgId: string, briefingId: string): Promise<unknown> {
    return this.db.queryOne(
      `SELECT * FROM ai_briefings WHERE id = $1 AND organization_id = $2`,
      [briefingId, orgId],
    );
  }

  async getBriefingForCycle(orgId: string, cycleId: string): Promise<unknown> {
    return this.db.queryOne(
      `SELECT * FROM ai_briefings WHERE organization_id = $1 AND cycle_id = $2 AND type = 'cycle_close' ORDER BY created_at DESC LIMIT 1`,
      [orgId, cycleId],
    );
  }

  // ── Engagement ROI Analysis ───────────────────────────────────────────────────

  async generateEngagementAnalysis(orgId: string, cycleId: string): Promise<Record<string, unknown>> {
    const cycle = await this.db.queryOne<Record<string, unknown>>(
      `SELECT name FROM cycles WHERE id = $1 AND organization_id = $2`,
      [cycleId, orgId],
    );
    if (!cycle) return {};

    const [agreements, objectives, work, scoreRow] = await Promise.all([
      this.db.query<Record<string, unknown>>(
        `SELECT title, status FROM agreements WHERE cycle_id = $1 AND deleted_at IS NULL`,
        [cycleId],
      ),
      this.db.query<Record<string, unknown>>(
        `SELECT title, level, status, fn_calculate_objective_progress(id) AS progress
           FROM objectives WHERE cycle_id = $1 AND organization_id = $2 AND deleted_at IS NULL AND status != 'CANCELLED'
           ORDER BY level, progress DESC`,
        [cycleId, orgId],
      ),
      this.db.queryOne<Record<string, unknown>>(
        `SELECT
            COUNT(DISTINCT CASE WHEN bi.type = 'EPIC'    THEN bi.id END) AS epics,
            COUNT(DISTINCT CASE WHEN bi.type = 'FEATURE' THEN bi.id END) AS features,
            COUNT(DISTINCT CASE WHEN bi.type = 'STORY'   THEN bi.id END) AS stories,
            COUNT(DISTINCT ini.id) AS initiatives
           FROM initiatives ini
           LEFT JOIN backlog_items bi ON bi.initiative_id = ini.id AND bi.status != 'CANCELLED'
          WHERE ini.organization_id = $1 AND ini.cycle_id = $2 AND ini.deleted_at IS NULL`,
        [orgId, cycleId],
      ),
      this.db.queryOne<{ fn_get_cycle_score: number }>(
        `SELECT fn_get_cycle_score($1)`, [cycleId],
      ),
    ]);

    const cycleName     = String(cycle['name']);
    const cycleScore    = scoreRow?.fn_get_cycle_score ?? 0;
    const fulfilled     = agreements.filter((a) => a['status'] === 'FULFILLED').length;
    const agreementRate = agreements.length > 0 ? Math.round((fulfilled / agreements.length) * 100) : 0;
    const completed     = objectives.filter((o) => o['status'] === 'COMPLETED' || Number(o['progress'] ?? 0) >= 70).length;
    const objectiveRate = objectives.length > 0 ? Math.round((completed / objectives.length) * 100) : 0;
    const workEpics     = Number(work?.['epics']       ?? 0);
    const workFeatures  = Number(work?.['features']    ?? 0);
    const workStories   = Number(work?.['stories']     ?? 0);
    const workInits     = Number(work?.['initiatives'] ?? 0);

    let headline              = `${cycleName} — ${objectiveRate}% de objetivos logrados`;
    let narrative             = `Durante el ciclo "${cycleName}" la organización logró el ${objectiveRate}% de sus objetivos comprometidos, con un score general de ${(cycleScore / 10).toFixed(1)}/10.`;
    let highlights: string[]  = [];
    let risks: string[]       = [];
    let renewalRec            = '';
    let nextFocus: string[]   = [];

    if (this.isApiValid && (objectives.length > 0 || agreements.length > 0)) {
      try {
        const agreementsList = agreements.length > 0
          ? agreements.slice(0, 8).map((a) => `- "${a['title']}": ${a['status']}`).join('\n')
          : '(sin acuerdos registrados)';
        const objList = objectives.slice(0, 10).map((o) =>
          `- [${o['level']}] "${o['title']}": ${Math.round(Number(o['progress'] ?? 0))}% (${o['status']})`
        ).join('\n');

        const prompt = `Eres un consultor estratégico senior que prepara el análisis de ROI de engagement para presentar al directorio o a un cliente C-level. Tu análisis debe ser preciso, ejecutivo y orientado a decisiones de renovación.

CICLO: "${cycleName}" | Score: ${(cycleScore / 10).toFixed(1)}/10
ACUERDOS: ${agreements.length} totales, ${fulfilled} cumplidos (${agreementRate}%)
OBJETIVOS: ${objectives.length} comprometidos, ${completed} logrados (${objectiveRate}%)
TRABAJO GENERADO: ${workInits} iniciativas, ${workEpics} épicas, ${workFeatures} features, ${workStories} historias

Detalle de acuerdos:
${agreementsList}

Detalle de objetivos:
${objList}

Genera el análisis en JSON EXACTAMENTE así (sin texto fuera del JSON):
{
  "headline": "frase de impacto ejecutivo (máx 12 palabras, enfocada en el resultado más relevante del ciclo)",
  "narrative": "párrafo ejecutivo de 3-4 oraciones. Tono directo, datos concretos. Para directorio o cliente C-level. Sin jerga.",
  "highlights": ["3 logros concretos y medibles del ciclo — datos específicos, sin adornos"],
  "risks": ["2 áreas de atención con recomendación accionable concreta"],
  "renewal_recommendation": "recomendación directa sobre continuidad: viabilidad Alta/Media/Baja + razón en una oración",
  "next_cycle_focus": ["2-3 prioridades estratégicas recomendadas para el próximo ciclo"]
}`;

        const response = await this.anthropic.messages.create({
          model: this.modelDefault,
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
        const jsonStart = text.indexOf('{');
        const jsonEnd   = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0) {
          const parsed       = JSON.parse(text.slice(jsonStart, jsonEnd));
          headline           = parsed.headline              ?? headline;
          narrative          = parsed.narrative             ?? narrative;
          highlights         = parsed.highlights            ?? [];
          risks              = parsed.risks                 ?? [];
          renewalRec         = parsed.renewal_recommendation ?? '';
          nextFocus          = parsed.next_cycle_focus      ?? [];
        }
      } catch (err) {
        this.logger.warn(`Engagement Analysis AI failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const report = {
      cycle_name: cycleName,
      cycle_id: cycleId,
      cycle_score: Math.round(cycleScore) / 10,
      agreement_rate: agreementRate,
      objective_rate: objectiveRate,
      headline,
      narrative,
      highlights,
      risks,
      renewal_recommendation: renewalRec,
      next_cycle_focus: nextFocus,
      generated_at: new Date().toISOString(),
      generated_by: '[AI] Executive Briefer — Engagement ROI',
    };

    await this.storeBriefing(orgId, cycleId, 'engagement_roi', `Análisis de Engagement — ${cycleName}`, report, null);
    return report;
  }

  async getEngagementAnalysis(orgId: string, cycleId: string): Promise<unknown> {
    return this.db.queryOne(
      `SELECT * FROM ai_briefings WHERE organization_id = $1 AND cycle_id = $2 AND type = 'engagement_roi' ORDER BY created_at DESC LIMIT 1`,
      [orgId, cycleId],
    );
  }

  async getConversations(orgId: string, userId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT id, title, cycle_id, created_at, updated_at, jsonb_array_length(messages) as message_count FROM ai_conversations WHERE organization_id = $1 AND user_id = $2 ORDER BY updated_at DESC LIMIT 20`,
      [orgId, userId],
    );
  }

  // ── Strategy Intent Suggester ─────────────────────────────────────────────

  async suggestStrategicIntents(orgId: string): Promise<Record<string, unknown>> {
    if (!this.isApiValid) {
      return { suggestions: [], error: 'API de IA no configurada. Configura ANTHROPIC_API_KEY en el backend.' };
    }

    try {
      const problems = await this.db.query<Record<string, unknown>>(
        `SELECT title, description, category, severity, frequency, priority_score
           FROM v_problems_with_stats
          WHERE organization_id = $1 AND status != 'RESOLVED'
          ORDER BY priority_score DESC
          LIMIT 15`,
        [orgId],
      );

      if (problems.length === 0) return { suggestions: [] };

      const currentYear = new Date().getFullYear();
      const problemsText = problems.map((p, i) =>
        `${i + 1}. "${p['title']}"${p['description'] ? `: ${String(p['description']).slice(0, 200)}` : ''} [Categoría: ${p['category'] ?? 'general'}, Severidad: ${p['severity']}, Frecuencia: ${p['frequency']}]`
      ).join('\n');

      const prompt = `Eres un consultor estratégico experto en metodología OKR y estrategia empresarial.
Analiza los problemas organizacionales identificados y propone intenciones estratégicas de largo plazo.

PROBLEMAS IDENTIFICADOS:
${problemsText}

Propone entre 3 y 5 intenciones estratégicas de largo plazo (3-5 años) que aborden las causas raíz y transformen estos dolores en oportunidades de mejora.

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "suggestions": [
    {
      "title": "Intención estratégica concisa y aspiracional (máx 80 caracteres)",
      "description": "Situación: [brecha o problema actual en 1 oración]\\nDirección: [hacia dónde queremos movernos en 1 oración]\\nImpacto: [qué cambia para la organización cuando lo logremos en 1 oración]",
      "category": "GROWTH|EFFICIENCY|CULTURE|INNOVATION|SUSTAINABILITY|OTHER",
      "horizon_years": 3,
      "target_year": ${currentYear + 3},
      "rationale": "Qué problemas específicos aborda esta intención (1-2 oraciones)"
    }
  ]
}

Reglas: máx 5 sugerencias, cada una vinculada a al menos un problema, variar categorías cuando sea posible, tono aspiracional pero realista.`;

      const response = await this.anthropic.messages.create({
        model: this.modelFast,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      if (jsonStart >= 0) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
        return { suggestions: parsed.suggestions ?? [] };
      }
      return { suggestions: [] };
    } catch (err) {
      this.logger.warn(`Strategy Suggester failed: ${err instanceof Error ? err.message : String(err)}`);
      return { suggestions: [], error: 'Error al generar sugerencias. Intenta de nuevo.' };
    }
  }

  // ── Team OKR Gap Suggester ───────────────────────────────────────────────

  async suggestTeamOkrsForGaps(orgId: string, cycleId: string): Promise<Record<string, unknown>> {
    if (!this.isApiValid) {
      return { gap_suggestions: [], error: 'API de IA no configurada. Configura ANTHROPIC_API_KEY.' };
    }

    try {
      const gaps = await this.db.query<{
        company_obj_id: string;
        company_title: string;
        company_progress: number;
        area_count: number;
      }>(
        `SELECT company_obj_id, company_title, company_progress, area_count
           FROM v_alignment_map
          WHERE organization_id = $1 AND cycle_id = $2 AND team_count = 0
          ORDER BY company_title`,
        [orgId, cycleId],
      );

      if (gaps.length === 0) return { gap_suggestions: [] };

      const cycle = await this.db.queryOne<{ name: string }>(
        `SELECT name FROM cycles WHERE id = $1`, [cycleId],
      );

      const gapsList = gaps.map((g, i) =>
        `${i + 1}. "${g.company_title}" (progreso: ${Math.round(Number(g.company_progress ?? 0))}%, áreas vinculadas: ${g.area_count ?? 0})`
      ).join('\n');

      const prompt = `Eres un experto en metodología OKR. La organización tiene objetivos de empresa en el ciclo "${cycle?.name ?? ''}" que NO tienen cobertura de equipos. Sugiere OKRs de nivel EQUIPO para cada brecha.

OBJETIVOS DE EMPRESA SIN COBERTURA DE EQUIPO:
${gapsList}

Para CADA objetivo de empresa, propón 1-2 OKRs tácticos que un equipo debería tener para contribuir a ese objetivo.

Responde ÚNICAMENTE con JSON válido:
{
  "gap_suggestions": [
    {
      "company_obj_index": 1,
      "company_title": "título exacto del objetivo empresa",
      "team_okrs": [
        {
          "title": "Objetivo de equipo aspiracional (máx 90 caracteres)",
          "description": "Contexto: [por qué este equipo debe tomar esto]\\nResultado esperado: [qué cambia al lograrlo]",
          "rationale": "Cómo contribuye al objetivo de empresa (1 oración)",
          "key_results": [
            {
              "title": "Resultado clave medible y específico",
              "type": "INCREASE",
              "metric_unit": "%",
              "start_value": 0,
              "target_value": 100
            }
          ]
        }
      ]
    }
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: this.modelFast,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd   = text.lastIndexOf('}') + 1;
      if (jsonStart >= 0) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd)) as {
          gap_suggestions: Array<{ company_obj_index: number; company_title: string; team_okrs: unknown[] }>;
        };
        const enriched = (parsed.gap_suggestions ?? []).map((s) => {
          const idx = (s.company_obj_index ?? 0) - 1;
          const gap = gaps[idx] ?? gaps.find((g) => g.company_title === s.company_title);
          return { company_obj_id: gap?.company_obj_id ?? null, company_title: s.company_title, team_okrs: s.team_okrs ?? [] };
        });
        return { gap_suggestions: enriched };
      }
      return { gap_suggestions: [] };
    } catch (err) {
      this.logger.warn(`Team OKR Gap Suggester failed: ${err instanceof Error ? err.message : String(err)}`);
      return { gap_suggestions: [], error: 'Error al generar sugerencias. Intenta de nuevo.' };
    }
  }

  // ── Backlog Suggester ─────────────────────────────────────────────────────

  async suggestBacklog(orgId: string, cycleId?: string): Promise<Record<string, unknown>> {
    if (!this.isApiValid) {
      return { suggestions: [], error: 'API de IA no configurada. Configura ANTHROPIC_API_KEY.' };
    }

    try {
      const [initiatives, existingEpics, activeObjectives] = await Promise.all([
        this.db.query<Record<string, unknown>>(
          `SELECT title, description FROM initiatives
            WHERE organization_id = $1 AND status NOT IN ('DONE','CANCELLED') AND deleted_at IS NULL
            ORDER BY created_at DESC LIMIT 8`,
          [orgId],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT title FROM backlog_items
            WHERE organization_id = $1 AND type = 'EPIC' AND deleted_at IS NULL
            ORDER BY created_at DESC LIMIT 10`,
          [orgId],
        ),
        cycleId
          ? this.db.query<Record<string, unknown>>(
              `SELECT o.title, o.level,
                      fn_calculate_objective_progress(o.id) AS progress
                 FROM objectives o
                WHERE o.organization_id = $1
                  AND o.cycle_id = $2
                  AND o.status = 'ACTIVE'
                  AND o.deleted_at IS NULL
                ORDER BY o.level, o.title LIMIT 8`,
              [orgId, cycleId],
            )
          : this.db.query<Record<string, unknown>>(
              `SELECT o.title, o.level
                 FROM objectives o
                JOIN cycles c ON c.id = o.cycle_id
                WHERE o.organization_id = $1
                  AND o.status = 'ACTIVE'
                  AND c.status = 'ACTIVE'
                  AND o.deleted_at IS NULL
                ORDER BY o.level, o.title LIMIT 8`,
              [orgId],
            ),
      ]);

      const existingText = existingEpics.length > 0
        ? `\nÉPICAS YA EXISTENTES (no duplicar):\n${existingEpics.map(e => `- ${e['title']}`).join('\n')}`
        : '';
      const initiativesText = initiatives.length > 0
        ? `\nINICIATIVAS ACTIVAS (alinear las épicas a estas cuando sea posible):\n${initiatives.map(i => `- ${i['title']}${i['description'] ? `: ${String(i['description']).slice(0, 120)}` : ''}`).join('\n')}`
        : '';
      const objectivesText = activeObjectives.length > 0
        ? `\nOBJETIVOS ACTIVOS:\n${activeObjectives.map(o => `- ${o['title']} (${o['level']})${o['progress'] !== undefined ? ` — ${Math.round(Number(o['progress']))}%` : ''}`).join('\n')}`
        : '';

      const prompt = `Eres un experto en Product Management y metodologías ágiles. Tu rol es proponer épicas de producto concretas y bien definidas para el backlog de desarrollo de software.

CONTEXTO:${objectivesText}${initiativesText}${existingText}

Propón exactamente 3 épicas distintas y accionables. Cada épica debe:
1. Resolver una necesidad de negocio real alineada a los objetivos e iniciativas
2. Ser implementable por un equipo técnico en 1-3 sprints
3. No duplicar las épicas ya existentes
4. Incluir 2-3 features (capacidades concretas) que la componen

Responde ÚNICAMENTE con JSON válido:
{
  "suggestions": [
    {
      "title": "Título de la épica (máx 100 caracteres)",
      "description": "Como:\\n[stakeholder o área que tiene la necesidad]\\n\\nNecesito:\\n[capacidad o solución de alto nivel requerida]\\n\\nPara:\\n[objetivo de negocio que se logra al completarla]",
      "acceptance_criteria": "- [ ] Capacidad entregada y disponible en producción\\n- [ ] Validado y aceptado por el sponsor o área responsable\\n- [ ] Métricas de éxito definidas y medibles",
      "priority": "CRITICAL | HIGH | MEDIUM | LOW",
      "rationale": "Por qué esta épica es prioritaria ahora (1 oración)",
      "initiative_hint": "Nombre exacto de la iniciativa a la que se alinea (o null)",
      "features": [
        {
          "title": "Nombre de la feature concreta",
          "description": "Capacidad que entrega:\\n[qué funcionalidad aporta]\\n\\nComportamiento esperado:\\n[cómo debe funcionar]\\n\\nDependencias técnicas:\\n[qué requiere para implementarse]",
          "acceptance_criteria": "- [ ] El sistema permite [comportamiento esperado]\\n- [ ] Los casos de borde están cubiertos\\n- [ ] Sin regresiones en funcionalidades existentes"
        }
      ]
    }
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: this.modelFast,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd   = text.lastIndexOf('}') + 1;
      if (jsonStart >= 0) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
        return { suggestions: parsed.suggestions ?? [] };
      }
      return { suggestions: [] };
    } catch (err) {
      this.logger.warn(`Backlog Suggester failed: ${err instanceof Error ? err.message : String(err)}`);
      return { suggestions: [], error: 'Error al generar sugerencias. Intenta de nuevo.' };
    }
  }

  // ── OKR Suggester ────────────────────────────────────────────────────────

  async suggestOkrs(orgId: string, cycleId: string, level: string, cycleType: string): Promise<Record<string, unknown>> {
    if (!this.isApiValid) {
      return { suggestions: [], error: 'API de IA no configurada. Configura ANTHROPIC_API_KEY en el backend.' };
    }

    try {
      const [cycle] = await this.db.query<Record<string, unknown>>(
        `SELECT name, type, start_date, end_date FROM cycles WHERE id = $1 AND organization_id = $2`,
        [cycleId, orgId],
      );
      if (!cycle) return { suggestions: [] };

      const [existing, problems, intents] = await Promise.all([
        this.db.query<Record<string, unknown>>(
          `SELECT title FROM objectives WHERE cycle_id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
          [cycleId, orgId],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT title, category FROM v_problems_with_stats WHERE organization_id = $1 AND status != 'RESOLVED' ORDER BY priority_score DESC LIMIT 5`,
          [orgId],
        ),
        this.db.query<Record<string, unknown>>(
          `SELECT title, description FROM strategic_intents WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 5`,
          [orgId],
        ),
      ]);

      const cycleLabel = cycleType === 'CUSTOM' ? 'estratégico (3-5 años)' : cycleType === 'ANNUAL' ? 'anual' : 'trimestral';
      const levelLabel = level === 'COMPANY' ? 'empresa' : level === 'AREA' ? 'área/departamento' : level === 'TEAM' ? 'equipo' : 'individual';
      const existingText = existing.length > 0
        ? `\nOBJETIVOS YA EXISTENTES (no repetir):\n${existing.map(e => `- ${e['title']}`).join('\n')}`
        : '';
      const problemsText = problems.length > 0
        ? `\nPROBLEMAS ORGANIZACIONALES DETECTADOS:\n${problems.map(p => `- ${p['title']} [${p['category']}]`).join('\n')}`
        : '';
      const intentsText = intents.length > 0
        ? `\nINTENCIONES ESTRATÉGICAS ACTIVAS:\n${intents.map(i => `- ${i['title']}: ${String(i['description'] ?? '').slice(0, 150)}`).join('\n')}`
        : '';

      const prompt = `Eres un experto en metodología OKR y estrategia empresarial. Propone OKRs de alta calidad para el ciclo "${cycle['name']}" (tipo: ${cycleLabel}, nivel: ${levelLabel}).${existingText}${problemsText}${intentsText}

Propone exactamente 3 objetivos distintos y ambiciosos. Para cada uno incluye 2-3 Key Results medibles.

Reglas OKR:
- Objetivos: aspiracionales, cualitativos, motivadores, sin métricas en el título
- Key Results: específicos, medibles, con valor inicio y meta numéricos
- Tipos: INCREASE (aumentar), DECREASE (reducir), MAINTAIN (mantener rango), ACHIEVE (sí/no)
- Dificultad Goldilocks: 0.6-0.7 (ambicioso pero alcanzable)

Responde ÚNICAMENTE con JSON válido:
{
  "suggestions": [
    {
      "title": "Objetivo aspiracional sin métricas (máx 90 caracteres)",
      "description": "Contexto: [por qué este objetivo es crítico ahora]\\nResultado esperado: [cambio visible al lograrlo]\\nDependencias: [qué debe estar alineado o resuelto]",
      "rationale": "Qué problema u oportunidad aborda (1 oración)",
      "key_results": [
        {
          "title": "Resultado clave medible y específico",
          "description": "Línea base: [situación inicial de la métrica]\\nMétodo de medición: [cómo y con qué frecuencia se mide]\\nRiesgo principal: [qué podría impedir alcanzar la meta]",
          "type": "INCREASE",
          "metric_unit": "%",
          "start_value": 0,
          "target_value": 100
        }
      ]
    }
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: this.modelFast,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      if (jsonStart >= 0) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
        return { suggestions: parsed.suggestions ?? [] };
      }
      return { suggestions: [] };
    } catch (err) {
      this.logger.warn(`OKR Suggester failed: ${err instanceof Error ? err.message : String(err)}`);
      return { suggestions: [], error: 'Error al generar sugerencias. Intenta de nuevo.' };
    }
  }

  async suggestInitiatives(orgId: string, cycleId: string): Promise<Record<string, unknown>> {
    if (!this.isApiValid) {
      return { suggestions: [], error: 'API de IA no configurada. Configura ANTHROPIC_API_KEY.' };
    }

    try {
    const [cycle, objectives, existingInits, atRiskKRs, areas] = await Promise.all([
      this.db.query<Record<string, unknown>>(
        `SELECT name, type, start_date, end_date FROM cycles WHERE id = $1 AND organization_id = $2`,
        [cycleId, orgId],
      ),
      this.db.query<Record<string, unknown>>(
        `SELECT o.code, o.title, o.level, o.status,
                c.type AS cycle_type, c.name AS cycle_name,
                fn_calculate_objective_progress(o.id) AS progress
         FROM objectives o
         JOIN cycles c ON c.id = o.cycle_id
         WHERE o.organization_id = $1
           AND o.deleted_at IS NULL
           AND o.status IN ('ACTIVE','DRAFT')
           AND c.status = 'ACTIVE'
         ORDER BY c.type, o.level, o.title`,
        [orgId],
      ),
      this.db.query<Record<string, unknown>>(
        `SELECT title FROM initiatives WHERE organization_id = $1 AND status != 'DONE' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
        [orgId],
      ),
      this.db.query<Record<string, unknown>>(
        `SELECT kr.code, kr.title, o.title AS objective_title, kr.confidence
         FROM key_results kr
         JOIN objectives o ON o.id = kr.objective_id
         WHERE o.organization_id = $1
           AND kr.deleted_at IS NULL
           AND kr.status NOT IN ('COMPLETED','CANCELLED')
           AND (kr.confidence < 0.4 OR kr.status IN ('AT_RISK','BEHIND'))
         ORDER BY kr.confidence ASC NULLS LAST
         LIMIT 8`,
        [orgId],
      ),
      this.db.query<Record<string, unknown>>(
        `SELECT id, name FROM areas WHERE org_id = $1 AND is_active = true ORDER BY sort_order, name`,
        [orgId],
      ),
    ]);

    if (!cycle[0]) return { suggestions: [] };

    const cycleRow = cycle[0];

    const typeLabel = (t: unknown) =>
      t === 'CUSTOM' ? 'Estratégico (3-5 años)' : t === 'ANNUAL' ? 'Anual' : 'Trimestral';
    const levelLabel = (l: unknown) =>
      l === 'COMPANY' ? 'Empresa' : l === 'AREA' ? 'Área' : l === 'TEAM' ? 'Equipo' : 'Individual';

    const areasText = areas.length > 0
      ? `\nÁREAS ORGANIZATIVAS DISPONIBLES (usa los nombres exactos):\n` + areas.map(a => `- ${a['name']}`).join('\n')
      : '';

    const objectivesText = objectives.length > 0
      ? `\nOBJETIVOS ACTIVOS POR CICLO:\n` + objectives.map(o =>
          `- [${typeLabel(o['cycle_type'])} — ${o['cycle_name']}] ${o['code'] ?? ''} ${o['title']} (${levelLabel(o['level'])}) — Avance: ${Math.round(Number(o['progress'] ?? 0))}%`
        ).join('\n')
      : '';

    const existingText = existingInits.length > 0
      ? `\nINICIATIVAS YA EXISTENTES (no duplicar):\n` + existingInits.map(i => `- ${i['title']}`).join('\n')
      : '';

    const atRiskText = atRiskKRs.length > 0
      ? `\nKEY RESULTS EN RIESGO (priorizar soporte):\n` + atRiskKRs.map(k =>
          `- ${k['code'] ?? ''} ${k['title']} (KR de: ${k['objective_title']}) — Confianza: ${Math.round(Number(k['confidence'] ?? 0) * 100)}%`
        ).join('\n')
      : '';

    const prompt = `Eres un experto en gestión de proyectos, metodología OKR y estrategia empresarial. Tu rol es sugerir iniciativas (proyectos) concretos que impulsen el cumplimiento de los objetivos de la organización.

CONTEXTO DEL CICLO ACTIVO: ${cycleRow['name']} (${typeLabel(cycleRow['type'])})
${objectivesText}${existingText}${atRiskText}${areasText}

Tu tarea: Proponer exactamente 3 iniciativas (proyectos) distintas y accionables que:
1. Estén directamente alineadas a los objetivos definidos (menciona cuál/cuáles)
2. Prioricen resolver los KRs en riesgo si los hay
3. Sean concretas, ejecutables con un alcance razonable para el ciclo correspondiente
4. No dupliquen las iniciativas ya existentes
5. target_cycle_horizon debe reflejar el ciclo OKR que la iniciativa apoya: CUSTOM=estratégico 3-5 años, ANNUAL=anual, QUARTERLY=trimestral
6. Si hay áreas organizativas disponibles, indica cuál es la principal responsable y cuáles más estarán involucradas
7. Identifica dependencias clave (bloqueadores) que hay que resolver para avanzar

Para cada iniciativa incluye 2-3 hitos concretos y medibles.
La descripción DEBE seguir EXACTAMENTE este formato de cuatro secciones:

Problema que resuelve:
[qué brecha u oportunidad concreta atiende esta iniciativa]

Alcance (qué incluye / qué no):
[qué está dentro del alcance y qué queda excluido explícitamente]

Criterio de éxito:
[cómo mediremos que la iniciativa terminó bien, con indicador cuantificable si aplica]

Dependencias:
[qué debe estar listo o resuelto antes de iniciar o completar esta iniciativa]

Responde ÚNICAMENTE con JSON válido:
{
  "suggestions": [
    {
      "title": "Título del proyecto (máx 120 caracteres)",
      "description": "Problema que resuelve:\\n[texto]\\n\\nAlcance (qué incluye / qué no):\\n[texto]\\n\\nCriterio de éxito:\\n[texto]\\n\\nDependencias:\\n[texto]",
      "rationale": "Qué objetivo(s) apoya directamente (1 oración)",
      "priority": "HIGH | MEDIUM | LOW",
      "target_cycle_horizon": "CUSTOM | ANNUAL | QUARTERLY",
      "estimated_duration_weeks": 8,
      "aligned_objectives": ["Título objetivo 1", "Título objetivo 2"],
      "primary_area": "Nombre exacto del área principal (o null si no aplica)",
      "involved_areas": ["Área 1", "Área 2"],
      "suggested_dependencies": [
        {
          "description": "Qué hay que destrabar (ej: Aprobación presupuesto TI Q2)",
          "type": "INTERNAL | EXTERNAL | DECISION"
        }
      ],
      "milestones": [
        {
          "title": "Hito concreto y medible",
          "week_offset": 2
        }
      ]
    }
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: this.modelFast,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      if (jsonStart >= 0) {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
        return { suggestions: parsed.suggestions ?? [] };
      }
      return { suggestions: [] };
    } catch (err) {
      this.logger.warn(`Initiative Suggester failed: ${err instanceof Error ? err.message : String(err)}`);
      return { suggestions: [], error: 'Error al generar sugerencias. Intenta de nuevo.' };
    }
  }

  // ── Convert Agreement to Epic ─────────────────────────────────────────────

  async convertAgreementToEpic(orgId: string, agreementId: string) {
    let agreement: Record<string, unknown> | null;
    try {
      agreement = await this.db.queryOne<Record<string, unknown>>(
        `SELECT * FROM v_agreements WHERE id = $1 AND organization_id = $2`,
        [agreementId, orgId],
      );
    } catch {
      return { epic_title: null, epic_description: null, suggested_objective_id: null, suggested_objective_title: null, rationale: 'ID de acuerdo inválido.' };
    }
    if (!agreement) return { epic_title: null, epic_description: null, suggested_objective_id: null, suggested_objective_title: null, rationale: 'Acuerdo no encontrado.' };

    const objectives = await this.db.query<Record<string, unknown>>(
      `SELECT id, title, level FROM v_objectives_with_progress WHERE organization_id = $1 AND status = 'ACTIVE' ORDER BY level, title`,
      [orgId],
    );

    if (!this.isApiValid) {
      return {
        epic_title: `Épica: ${agreement.title}`,
        epic_description: agreement.description ?? `Épica derivada del acuerdo "${agreement.title}"`,
        suggested_objective_id: null,
        suggested_objective_title: null,
        rationale: 'Sugerencia básica generada sin IA. Configura ANTHROPIC_API_KEY para sugerencias inteligentes.',
      };
    }

    try {
      const objList = objectives.slice(0, 15).map((o, i) => `${i + 1}. [${o.id}] ${o.title} (${o.level})`).join('\n');
      const prompt = `Eres un experto en metodología OKR y gestión ágil. Debes convertir un acuerdo organizacional en una Épica del backlog.

ACUERDO:
Título: ${agreement.title}
Descripción: ${agreement.description ?? '(sin descripción)'}
Origen: ${agreement.source ?? '(no especificado)'}
Prioridad: ${agreement.priority}

OBJETIVOS ACTIVOS (elige el más relevante para alinear la épica):
${objList || '(sin objetivos activos)'}

Responde SOLO con JSON válido, sin explicaciones adicionales:
{
  "epic_title": "Título de la épica (máx 150 chars, formato: verbo + objeto)",
  "epic_description": "Descripción de la épica (2-3 oraciones explicando qué se construye, por qué, y cómo medir el éxito)",
  "suggested_objective_id": "UUID del objetivo más relevante o null",
  "suggested_objective_title": "Título del objetivo sugerido o null",
  "rationale": "1 oración explicando por qué esa épica ejecuta el acuerdo"
}`;

      const response = await this.anthropic.messages.create({
        model: this.modelDefault, max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      if (jsonStart >= 0) {
        return JSON.parse(text.slice(jsonStart, jsonEnd));
      }
      return { epic_title: null, epic_description: null, suggested_objective_id: null, suggested_objective_title: null, rationale: 'No se pudo parsear la respuesta.' };
    } catch (err) {
      this.logger.warn(`convertAgreementToEpic failed: ${err instanceof Error ? err.message : String(err)}`);
      return { epic_title: null, epic_description: null, suggested_objective_id: null, suggested_objective_title: null, rationale: 'Error al generar sugerencia.' };
    }
  }

  // ── Demo Strategy Wizard ─────────────────────────────────────────────────

  async suggestDemoStrategy(company: string, industry: string, challenge: string) {
    const ind = industry || 'el sector';
    const FALLBACK = {
      objectives: [
        {
          title: `Consolidar posición competitiva en ${ind}`,
          description: 'Establecer ventajas sostenibles frente a competidores clave.',
          key_results: [
            { title: 'Aumentar market share de 15% a 25%', target_value: 25, metric_unit: '%' },
            { title: 'Alcanzar NPS de 60 o superior', target_value: 60, metric_unit: 'NPS' },
          ],
        },
        {
          title: 'Acelerar el crecimiento de ingresos recurrentes',
          description: 'Diversificar fuentes de ingreso y aumentar retención de clientes.',
          key_results: [
            { title: 'Incrementar ARR en un 40%', target_value: 40, metric_unit: '%' },
            { title: 'Reducir churn mensual a menos del 2%', target_value: 2, metric_unit: '%' },
          ],
        },
        {
          title: 'Desarrollar capacidades organizacionales críticas',
          description: 'Fortalecer el equipo y los procesos que soportan la estrategia.',
          key_results: [
            { title: 'Alcanzar eNPS de 40 o superior', target_value: 40, metric_unit: 'eNPS' },
            { title: 'Implementar 3 procesos clave documentados', target_value: 3, metric_unit: 'procesos' },
          ],
        },
      ],
      problems: [
        { title: `Presión competitiva creciente en ${ind}`, description: 'La empresa enfrenta nuevos actores sin una estrategia clara de diferenciación.', category: 'MARKET', severity: 4, frequency: 4 },
        { title: 'Falta de alineación entre áreas y estrategia corporativa', description: 'Los equipos operativos trabajan sin visibilidad de los objetivos de alto nivel.', category: 'PROCESS', severity: 3, frequency: 5 },
        { title: 'Capacidades del equipo insuficientes para la escala requerida', description: 'El talento disponible no cubre las necesidades del crecimiento planificado.', category: 'PEOPLE', severity: 4, frequency: 3 },
      ],
      strategic_intents: [
        { title: 'Ser referente en excelencia operativa en el sector', description: 'Construir procesos y capacidades que nos posicionen como líderes en eficiencia y calidad.', category: 'EFFICIENCY', horizon_years: 3, problem_indices: [1, 2] },
        { title: 'Transformar la propuesta de valor hacia el cliente', description: 'Rediseñar el modelo de negocio centrado en resultados y experiencia del cliente.', category: 'GROWTH', horizon_years: 5, problem_indices: [0] },
      ],
      area_okrs: [
        { company_obj_index: 0, title: `Fortalecer presencia de ${company} en segmentos clave`, description: 'Capturar cuota de mercado en los segmentos de mayor rentabilidad del sector.', key_results: [{ title: 'Incrementar clientes activos en segmento premium en 30%', target_value: 30, metric_unit: '%' }] },
        { company_obj_index: 1, title: 'Optimizar procesos de generación de ingresos del área comercial', description: 'Mejorar la eficiencia del ciclo de ventas y reducir el costo de adquisición.', key_results: [{ title: 'Reducir CAC en un 20%', target_value: 20, metric_unit: '%' }] },
        { company_obj_index: 2, title: 'Implementar programa de desarrollo de talento en RRHH', description: 'Elevar las capacidades del equipo para soportar el crecimiento planificado.', key_results: [{ title: 'Completar plan de desarrollo para el 80% del equipo', target_value: 80, metric_unit: '%' }] },
      ],
      team_okrs: [
        { area_okr_index: 0, title: 'Equipo de Ventas: capturar nuevos clientes premium', description: 'Ejecutar tácticamente la estrategia de expansión en segmento premium.', key_results: [{ title: 'Cerrar 15 nuevas cuentas premium por trimestre', target_value: 15, metric_unit: 'cuentas' }] },
        { area_okr_index: 1, title: 'Equipo de Marketing: posicionar propuesta de valor', description: 'Generar demanda calificada y reducir el costo de adquisición.', key_results: [{ title: 'Reducir costo por lead calificado a $50 o menos', target_value: 50, metric_unit: '$' }] },
      ],
      initiatives: [
        { area_okr_index: 0, title: 'Programa de expansión en segmento premium', description: 'Desarrollar capacidades comerciales y de producto para penetrar el segmento de mayor valor.', stories: [
          { title: 'Como gerente comercial, quiero un playbook de ventas para segmento premium', acceptance_criteria: 'Playbook documentado con 5+ tácticas validadas, aprobado por director.', story_points: 8 },
          { title: 'Como ejecutivo de cuentas, quiero acceso a un CRM actualizado con datos de prospectos premium', acceptance_criteria: 'CRM con al menos 100 prospectos calificados, datos actualizados en <24h.', story_points: 5 },
          { title: 'Como cliente premium, quiero onboarding dedicado en menos de 48h', acceptance_criteria: 'Proceso de onboarding documentado, tiempo promedio ≤48h medido en 3 pilotos.', story_points: 13 },
        ]},
        { area_okr_index: 1, title: 'Optimización del ciclo de generación de demanda', description: 'Rediseñar el funnel de marketing para reducir el costo de adquisición y mejorar la conversión.', stories: [
          { title: 'Como director de marketing, quiero dashboards de atribución multicanal', acceptance_criteria: 'Dashboard en tiempo real con métricas de CAC por canal, datos de últimos 90 días.', story_points: 8 },
          { title: 'Como analista, quiero automatizar el scoring de leads con reglas claras', acceptance_criteria: 'Modelo de scoring activo, leads clasificados en <1h, precisión ≥70% vs ventas.', story_points: 13 },
        ]},
      ],
    };

    if (!this.isApiValid) return FALLBACK;

    const prompt = `Eres un consultor estratégico experto en OKRs y diagnóstico organizacional. Analiza el contexto y genera una estrategia completa: problemas identificados, intenciones estratégicas, objetivos de empresa y objetivos de área.

Empresa: ${company}
Industria: ${industry}
Desafío principal: ${challenge}

Responde SOLO con JSON válido, sin markdown, sin texto adicional:
{
  "objectives": [
    {
      "title": "string (máx 80 chars, verbo + resultado aspiracional)",
      "description": "string (1 oración explicando el por qué)",
      "key_results": [
        {
          "title": "string (métrica: Aumentar X de A a B)",
          "target_value": number,
          "metric_unit": "string (%, $, NPS, unidades)"
        }
      ]
    }
  ],
  "problems": [
    {
      "title": "string (problema concreto identificado, máx 100 chars)",
      "description": "string (impacto del problema en el negocio, 1-2 oraciones)",
      "category": "MARKET|PROCESS|PEOPLE|TECHNOLOGY|FINANCIAL|OPERATIONAL|CULTURE|OTHER",
      "severity": number,
      "frequency": number
    }
  ],
  "strategic_intents": [
    {
      "title": "string (aspiración a largo plazo, máx 120 chars)",
      "description": "string (la visión detrás de la intención, 1-2 oraciones)",
      "category": "GROWTH|EFFICIENCY|CULTURE|INNOVATION|SUSTAINABILITY|OTHER",
      "horizon_years": number,
      "problem_indices": [0, 1]
    }
  ],
  "area_okrs": [
    {
      "company_obj_index": number,
      "title": "string (objetivo de área funcional, máx 90 chars)",
      "description": "string (qué área y por qué, 1 oración)",
      "key_results": [
        {
          "title": "string (resultado medible del área)",
          "target_value": number,
          "metric_unit": "string"
        }
      ]
    }
  ],
  "team_okrs": [
    {
      "area_okr_index": number,
      "title": "string (objetivo de equipo táctico, máx 90 chars, incluye nombre del equipo)",
      "description": "string (qué equipo específico y qué ejecuta, 1 oración)",
      "key_results": [
        {
          "title": "string (resultado medible del equipo)",
          "target_value": number,
          "metric_unit": "string"
        }
      ]
    }
  ],
  "initiatives": [
    {
      "area_okr_index": number,
      "title": "string (nombre de la iniciativa, máx 100 chars)",
      "description": "string (qué se construye o implementa, 1-2 oraciones)",
      "stories": [
        {
          "title": "string (historia de usuario en formato: Como [rol], quiero [acción])",
          "acceptance_criteria": "string (criterios medibles y verificables)",
          "story_points": number
        }
      ]
    }
  ]
}

Reglas:
- Exactamente 3 objectives, cada uno con exactamente 2 key_results
- Exactamente 3 problems relevantes al desafío específico
- Exactamente 2 strategic_intents (horizon_years: 3 o 5, severity/frequency entre 1 y 5)
- Exactamente 3 area_okrs (company_obj_index: 0, 1, 2 — uno por objetivo de empresa)
- Exactamente 2 team_okrs (area_okr_index: 0 y 1 — uno cada uno, distintos equipos tácticos)
- Exactamente 2 initiatives (area_okr_index: 0 y 1), cada una con exactamente 3 stories
- severity y frequency deben ser enteros entre 1 y 5
- horizon_years debe ser 3 o 5
- story_points: 1, 2, 3, 5, 8, 13 (Fibonacci)
- Todo en español, relevante al desafío específico
- Los area_okrs son de nivel táctico (un área funcional que soporta la estrategia de empresa)
- Los team_okrs son operativos (equipo específico dentro de un área)
- Las stories siguen formato "Como [rol], quiero [acción]"`;

    // Use fast model with backend-side timeout — demo must respond in < 50s
    const timeoutMs = 48_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Anthropic timeout')), timeoutMs)
    );
    try {
      const apiCall = this.anthropic.messages.create({
        model: this.modelFast,   // haiku — más rápido para el demo wizard
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });
      const resp = await Promise.race([apiCall, timeoutPromise]);
      const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '';
      // Strip markdown code fences if model wraps response
      const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = this.fixUtf8(JSON.parse(clean)) as typeof FALLBACK;
      if (Array.isArray(parsed.objectives) && parsed.objectives.length > 0) return parsed;
      this.logger.warn('[demo-strategy] AI returned unexpected structure, using fallback');
      return FALLBACK;
    } catch (err) {
      this.logger.warn(`[demo-strategy] AI call failed: ${err instanceof Error ? err.message : String(err)}`);
      return FALLBACK;
    }
  }

  // ── Public AI helper (for MCP service) ───────────────────────────────────

  get isReady(): boolean { return this.isApiValid; }

  async generateText(prompt: string, maxTokens = 2000): Promise<string | null> {
    if (!this.isApiValid) return null;
    try {
      const response = await this.anthropic.messages.create({
        model: this.modelDefault,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    } catch (err) {
      this.logger.warn(`generateText failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Fix double-encoded UTF-8: some model outputs ó as U+00C3 U+00B3 instead of U+00F3
  private fixUtf8(obj: unknown): unknown {
    if (typeof obj === 'string') {
      try { return decodeURIComponent(escape(obj)); } catch { return obj; }
    }
    if (Array.isArray(obj)) return obj.map(i => this.fixUtf8(i));
    if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, this.fixUtf8(v)]));
    }
    return obj;
  }

  // ── First Day Narrative ────────────────────────────────────────────────────

  async generateFirstDayNarrative(orgId: string, userId: string): Promise<{ narrative: string }> {
    if (!this.isApiValid) {
      return { narrative: 'Tu trabajo es parte de algo más grande. Cada tarea que completes contribuye directamente a los objetivos de tu equipo y a la visión de la empresa. ¡Bienvenido/a al equipo!' };
    }

    try {
      const [ctxRow] = await this.db.query<{ fn_first_day_context: Record<string, unknown> }>(
        `SELECT fn_first_day_context($1, $2)`,
        [orgId, userId],
      );
      const ctx = ctxRow?.fn_first_day_context ?? {};
      const org   = ctx['org']   as Record<string, unknown> | null;
      const cycle = ctx['active_cycle'] as Record<string, unknown> | null;
      const companyObjs = (ctx['company_objectives'] as Array<Record<string, unknown>> | null) ?? [];
      const team  = ctx['my_team'] as Record<string, unknown> | null;
      const teamObj = ctx['team_objective'] as Record<string, unknown> | null;
      const myKrs = (ctx['my_krs'] as Array<Record<string, unknown>> | null) ?? [];
      const items = (ctx['my_backlog_items'] as Array<Record<string, unknown>> | null) ?? [];

      const prompt = `Eres un coach estratégico que da la bienvenida a un nuevo empleado.
Tu misión: escribir UN párrafo cálido (150-200 palabras) que explique por qué el trabajo de esta persona importa.
El tono debe ser inspirador pero concreto: usa los datos reales de abajo.

EMPRESA: ${org?.['name'] ?? 'la organización'}
VISIÓN: ${org?.['vision'] ?? '(sin definir)'}
MISIÓN: ${org?.['mission'] ?? '(sin definir)'}
CICLO ACTIVO: ${cycle?.['name'] ?? '(sin ciclo)'} — ${cycle?.['days_remaining'] ?? '?'} días restantes, ${cycle?.['progress_pct'] ?? '?'}% del camino recorrido
OBJETIVOS EMPRESA:
${companyObjs.slice(0, 3).map((o, i) => `  ${i + 1}. [${o['code'] ?? '?'}] ${o['title']} — ${o['progress'] ?? 0}% progreso`).join('\n') || '  (sin objetivos de empresa)'}
EQUIPO: ${team?.['name'] ?? '(sin equipo asignado)'}
OBJETIVO DEL EQUIPO: ${teamObj?.['title'] ?? '(sin objetivo de equipo)'}
MIS KRs ASIGNADOS:
${myKrs.slice(0, 3).map((kr, i) => `  ${i + 1}. [${kr['code'] ?? '?'}] ${kr['title']} — ${kr['progress'] ?? 0}%`).join('\n') || '  (sin KRs asignados aún)'}
MI PRIMERA HISTORIA:
${items[0] ? `  [${items[0]['code'] ?? '?'}] ${items[0]['title']}: ${String(items[0]['description'] ?? '').slice(0, 150)}` : '  (sin historia asignada aún)'}

Escribe el párrafo. Solo el párrafo, sin títulos, sin saludos de apertura como "Hola" o "Bienvenido/a".
Conecta explícitamente el trabajo concreto con el objetivo de equipo y la visión de empresa.
Finaliza con una frase motivadora y específica sobre el impacto real de esta persona.`;

      const msg = await this.anthropic.messages.create({
        model: this.modelFast,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = (msg.content[0] as { type: string; text: string }).text?.trim() ?? '';
      return { narrative: text || 'Tu contribución conecta directamente con la estrategia de la empresa. Cada historia que entreguem construye el producto y acerca al equipo a sus metas.' };
    } catch (err) {
      this.logger.warn(`First Day Narrative failed: ${err instanceof Error ? err.message : String(err)}`);
      return { narrative: 'Tu trabajo es parte de algo más grande. Cada tarea que completes contribuye directamente a los objetivos de tu equipo y a la visión de la empresa.' };
    }
  }

  private async storeBriefing(orgId: string, cycleId: string | null, type: string, title: string, content: Record<string, unknown>, userId: string | null) {
    try {
      await this.db.execute(
        `INSERT INTO ai_briefings (organization_id, cycle_id, type, title, content, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, cycleId, type, title, JSON.stringify(content), userId],
      );
    } catch (err) { this.logger.warn(`Failed to store briefing: ${err instanceof Error ? err.message : String(err)}`); }
  }
}
