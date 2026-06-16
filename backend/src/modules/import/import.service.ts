import { Injectable, ForbiddenException, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';
import { DbService } from '../../database/db.service';
import { orgContextStorage } from '../../database/org-context';
import { randomUUID } from 'crypto';

export interface ImportSource {
  label: string;
  content: string;
}

export interface ImportedIntent {
  title: string;
  description?: string;
  category: string;
}

export interface ImportedObjective {
  title: string;
  description?: string;
  level: string;
  cycle_duration: string;
  cycle_year?: number;
}

export interface ImportedKeyResult {
  title: string;
  objective_title?: string;
  type: string;
  target?: number | null;
  unit?: string | null;
}

export interface ImportedInitiative {
  title: string;
  description?: string;
}

export interface ImportData {
  strategic_intents: ImportedIntent[];
  cycles: Array<{ name: string; duration: string; year?: number; quarter?: number | null }>;
  objectives: ImportedObjective[];
  key_results: ImportedKeyResult[];
  initiatives: ImportedInitiative[];
}

export interface ImportSummary {
  strategicIntents: number;
  objectives3year: number;
  objectivesAnnual: number;
  objectivesQuarterly: number;
  keyResults: number;
  initiatives: number;
}

export interface ImportAnalysis {
  summary: ImportSummary;
  data: ImportData;
}

const VALID_CATEGORIES = new Set(['GROWTH', 'EFFICIENCY', 'CULTURE', 'INNOVATION', 'SUSTAINABILITY', 'OTHER']);
const VALID_LEVELS = new Set(['COMPANY', 'AREA', 'TEAM']);
const VALID_KR_TYPES = new Set(['INCREASE', 'DECREASE', 'MAINTAIN', 'ACHIEVE']);

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', 'no-key'),
    });
  }

  private get isApiValid() {
    const key = this.config.get<string>('ANTHROPIC_API_KEY', '');
    return key.startsWith('sk-ant-') && key.length > 20;
  }

  private buildSummary(data: ImportData): ImportSummary {
    return {
      strategicIntents: data.strategic_intents.length,
      objectives3year: data.objectives.filter(o => o.cycle_duration === '3Y').length,
      objectivesAnnual: data.objectives.filter(o => o.cycle_duration === 'ANNUAL').length,
      objectivesQuarterly: data.objectives.filter(o => o.cycle_duration === 'QUARTERLY').length,
      keyResults: data.key_results.length,
      initiatives: data.initiatives.length,
    };
  }

  private normalizeContent(raw: string): string {
    // Collapse newlines inside double-quoted TSV cells (e.g. "Header\ncontinuation")
    // so they don't become spurious data rows in the parser
    const collapsed = raw.replace(/"[^"]*"/g, m => m.replace(/[\r\n]+/g, ' '));
    const allLines = collapsed.split(/\r?\n/);
    const lines = allLines.filter(l => l.trim().length > 0);
    if (lines.length === 0) return raw;

    const tabLines = lines.filter(l => l.includes('\t')).length;
    if (tabLines / lines.length < 0.3) return raw; // Not a TSV, return as-is

    // Find the header row (first row with ≥4 non-empty columns)
    const headerIdx = lines.findIndex(l => l.split('\t').filter(c => c.trim()).length >= 4);
    if (headerIdx < 0) return raw;

    const headers = lines[headerIdx].split('\t').map(h => h.trim().replace(/^["']|["']$/g, ''));

    // Build a column-index mapping for known fields
    const findCol = (...candidates: string[]) => {
      for (const c of candidates) {
        const i = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
        if (i >= 0) return i;
      }
      return -1;
    };

    // Column detection
    const intentionCol = findCol('Intención', 'intencion');
    const objectiveCol = findCol('Objetivo Estratégico', 'Objetivo');
    const epicCol = findCol('Épica', 'Epica', 'épica');
    const krCol = findCol("KR's Intenciones", "KR's de Objetivos", 'KR');
    const metaCol = findCol('META 2026', 'META 2025', 'META');
    const indicatorCol = findCol('Indicadores', 'KR', 'title');

    const readable: string[] = [];
    let lastIntent = '';
    let lastObjective = '';

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = lines[i].split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.every(c => !c)) continue;

      // Update context from non-empty leading columns
      if (intentionCol >= 0 && cols[intentionCol]) lastIntent = cols[intentionCol];
      if (objectiveCol >= 0 && cols[objectiveCol]) lastObjective = cols[objectiveCol];

      // Extract main item text (from KR col or epic col or indicator col)
      const mainItem = (epicCol >= 0 ? cols[epicCol] : '') ||
                       (indicatorCol >= 0 && indicatorCol !== krCol ? cols[indicatorCol] : '') || '';
      const krContext = krCol >= 0 ? cols[krCol] : '';
      const meta = metaCol >= 0 ? cols[metaCol] : '';

      // Build readable line
      const parts: string[] = [];
      if (lastIntent) parts.push(`Intención: ${lastIntent}`);
      if (lastObjective) parts.push(`Objetivo: ${lastObjective}`);
      if (krContext && krContext !== lastIntent && krContext !== lastObjective) parts.push(`Contexto: ${krContext}`);
      if (mainItem) parts.push(`Elemento: ${mainItem}`);
      if (meta) parts.push(`Meta: ${meta}`);

      if (parts.length >= 2) readable.push(parts.join(' | '));
    }

    // If we got a good extraction, return it; otherwise return original
    return readable.length >= 5 ? readable.join('\n') : raw;
  }

  async analyzeContent(sources: ImportSource[]): Promise<ImportAnalysis> {
    const empty: ImportData = {
      strategic_intents: [], cycles: [], objectives: [], key_results: [], initiatives: [],
    };

    if (!this.isApiValid) {
      throw new BadRequestException('El agente de IA no tiene saldo disponible. Para activarlo, acredita créditos en console.anthropic.com → Billing.');
    }

    // Pre-process content: convert TSV/CSV tables to readable text
    const combinedText = sources
      .map(s => `=== ${s.label || 'Fuente'} ===\n${this.normalizeContent(s.content).slice(0, 20000)}`)
      .join('\n\n')
      .slice(0, 40000);

    const currentYear = new Date().getFullYear();

    const prompt = `Eres un experto en metodología OKR con amplia experiencia transformando documentación estratégica empresarial en estructuras OKR accionables.

Analiza el siguiente texto (puede ser un plan estratégico, informe de gestión, presentación ejecutiva, acta de reunión, lista de metas, presupuesto u otro documento de negocio) y extrae TODA la información que pueda representar intenciones estratégicas, objetivos, métricas o iniciativas, aunque NO esté redactada en formato OKR.

INSTRUCCIONES DE EXTRACCIÓN (aplica siempre, incluso con contenido no estructurado):
- Cualquier meta, prioridad, propósito o dirección estratégica → strategic_intents
- Cualquier objetivo, logro esperado, foco o resultado buscado → objectives
- Cualquier métrica, indicador, target, porcentaje, cifra meta → key_results
- Cualquier proyecto, acción, iniciativa, tarea o programa → initiatives
- Si el texto menciona un período (año, trimestre, plan X años) → cycles
- Infiere el level del objetivo según el contexto: corporativo/empresa=COMPANY, área/departamento=AREA, equipo=TEAM
- Infiere el cycle_duration: plan plurianual/estratégico=3Y, anual=ANNUAL, trimestral=QUARTERLY
- Para key_results: si hay un número/porcentaje de mejora→INCREASE, reducción→DECREASE, mantener nivel→MAINTAIN, lograr algo binario→ACHIEVE
- Si no hay año explícito usa ${currentYear}
- Sé generoso en la extracción: es mejor extraer de más que dejar información sin mapear

TEXTO:
${combinedText}

Responde ÚNICAMENTE con JSON válido (sin bloques markdown, sin texto adicional):

{
  "strategic_intents": [{"title": "string", "description": "string", "category": "GROWTH"}],
  "cycles": [{"name": "string", "duration": "ANNUAL", "year": ${currentYear}, "quarter": null}],
  "objectives": [{"title": "string", "description": "string", "level": "COMPANY", "cycle_duration": "ANNUAL", "cycle_year": ${currentYear}}],
  "key_results": [{"title": "string", "objective_title": "string", "type": "INCREASE", "target": 100, "unit": "%"}],
  "initiatives": [{"title": "string", "description": "string"}]
}

Valores válidos:
- category: GROWTH, EFFICIENCY, CULTURE, INNOVATION, SUSTAINABILITY, OTHER
- level: COMPANY, AREA, TEAM
- cycle_duration: 3Y, ANNUAL, QUARTERLY
- KR type: INCREASE, DECREASE, MAINTAIN, ACHIEVE
- objective_title debe coincidir EXACTAMENTE con el title del objetivo asociado`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.config.get<string>('AI_DEFAULT_MODEL', 'claude-sonnet-4-6'),
        max_tokens: 16384,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      if (response.stop_reason === 'max_tokens') {
        throw new Error('Response truncated: document too large, reduce input size');
      }

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const raw = JSON.parse(jsonrepair(jsonMatch[0])) as ImportData;

      const data: ImportData = {
        strategic_intents: (Array.isArray(raw.strategic_intents) ? raw.strategic_intents : [])
          .filter(i => i?.title)
          .map(i => ({
            title: String(i.title).slice(0, 500),
            description: i.description ? String(i.description) : undefined,
            category: VALID_CATEGORIES.has(String(i.category)) ? String(i.category) : 'OTHER',
          }))
          .slice(0, 20),
        cycles: (Array.isArray(raw.cycles) ? raw.cycles : [])
          .filter(c => c?.name)
          .slice(0, 20),
        objectives: (Array.isArray(raw.objectives) ? raw.objectives : [])
          .filter(o => o?.title)
          .map(o => ({
            title: String(o.title).slice(0, 500),
            description: o.description ? String(o.description) : undefined,
            level: VALID_LEVELS.has(String(o.level)) ? String(o.level) : 'COMPANY',
            cycle_duration: ['3Y', 'ANNUAL', 'QUARTERLY'].includes(String(o.cycle_duration))
              ? String(o.cycle_duration) : 'ANNUAL',
            cycle_year: typeof o.cycle_year === 'number' ? o.cycle_year : currentYear,
          }))
          .slice(0, 50),
        key_results: (Array.isArray(raw.key_results) ? raw.key_results : [])
          .filter(k => k?.title)
          .map(k => ({
            title: String(k.title).slice(0, 500),
            objective_title: k.objective_title ? String(k.objective_title) : undefined,
            type: VALID_KR_TYPES.has(String(k.type)) ? String(k.type) : 'INCREASE',
            target: typeof k.target === 'number' ? k.target : null,
            unit: k.unit ? String(k.unit).slice(0, 50) : null,
          }))
          .slice(0, 100),
        initiatives: (Array.isArray(raw.initiatives) ? raw.initiatives : [])
          .filter(i => i?.title)
          .map(i => ({
            title: String(i.title).slice(0, 500),
            description: i.description ? String(i.description) : undefined,
          }))
          .slice(0, 100),
      };

      return { summary: this.buildSummary(data), data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import analyze failed: ${msg}`);
      if (msg.includes('credit balance') || msg.includes('insufficient_quota') || msg.includes('billing') || msg.includes('credits') || msg.includes('402') || msg.includes('payment')) {
        throw new BadRequestException('El agente de IA no tiene saldo disponible. Para activarlo, acredita créditos en console.anthropic.com → Billing.');
      }
      if (msg.includes('truncated') || msg.includes('too large')) {
        throw new BadRequestException('El documento es demasiado extenso para analizarlo de una vez. Divídelo en secciones más pequeñas e impórtalas por separado.');
      }
      throw new ServiceUnavailableException('Error al procesar el documento con IA. Intenta de nuevo en unos segundos.');
    }
  }

  private async getOrCreateCycle(
    organizationId: string, userId: string,
    type: string, name: string, startDate: string, endDate: string,
  ): Promise<string> {
    const existing = await this.db.query<{ id: string }>(
      `SELECT id FROM cycles WHERE organization_id=$1 AND type=$2 AND start_date=$3::date AND deleted_at IS NULL LIMIT 1`,
      [organizationId, type, startDate],
    );
    if (existing.length) return existing[0].id;

    const cycleId = randomUUID();
    await this.db.query(
      `INSERT INTO cycles (id, organization_id, name, type, status, start_date, end_date, created_by)
       VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7)`,
      [cycleId, organizationId, name, type, startDate, endDate, userId],
    );
    return cycleId;
  }

  private async getOrCreateDefaultTeam(organizationId: string, userId: string): Promise<string | null> {
    const teams = await this.db.query<{ id: string }>(
      `SELECT id FROM teams WHERE organization_id=$1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [organizationId],
    );
    if (teams.length) return teams[0].id;

    const teamId = randomUUID();
    await this.db.query(
      `INSERT INTO teams (id, organization_id, name, owner_id) VALUES ($1,$2,'General',$3)`,
      [teamId, organizationId, userId],
    );
    return teamId;
  }

  private async _clearOkrData(organizationId: string): Promise<void> {
    // Hard-delete check_ins (no deleted_at column)
    await this.db.query(
      `DELETE FROM check_ins WHERE kr_id IN (
         SELECT id FROM key_results WHERE objective_id IN (
           SELECT id FROM objectives WHERE organization_id=$1 AND deleted_at IS NULL
         )
       )`,
      [organizationId],
    );
    // Soft-delete in dependency order (leaf → root)
    await this.db.query(
      `UPDATE key_results SET deleted_at=NOW() WHERE objective_id IN (
         SELECT id FROM objectives WHERE organization_id=$1 AND deleted_at IS NULL
       ) AND deleted_at IS NULL`,
      [organizationId],
    );
    await this.db.query(
      `UPDATE initiatives SET deleted_at=NOW() WHERE organization_id=$1 AND deleted_at IS NULL`,
      [organizationId],
    );
    await this.db.query(
      `UPDATE objectives SET deleted_at=NOW() WHERE organization_id=$1 AND deleted_at IS NULL`,
      [organizationId],
    );
    // Soft-delete cycles — avoids triggering the ai_briefings ON DELETE FK
    await this.db.query(
      `UPDATE cycles SET deleted_at=NOW() WHERE organization_id=$1 AND deleted_at IS NULL`,
      [organizationId],
    );
    await this.db.query(
      `UPDATE strategic_intents SET deleted_at=NOW() WHERE organization_id=$1 AND deleted_at IS NULL`,
      [organizationId],
    );
    this.logger.log(`[import] cleared OKR data for org=${organizationId}`);
  }

  async loadImport(
    organizationId: string, userEmail: string, data: ImportData, clearFirst = false,
  ): Promise<{ success: boolean; message: string }> {
    // Run all queries in the target org's RLS context (user may be JWT-authenticated into a different org)
    return orgContextStorage.run(organizationId, async () => {
      // Look up the user by email within the target org (user_id differs per org for multi-org users)
      const rows = await this.db.query<{ id: string; role: string }>(
        `SELECT id, role FROM users WHERE lower(email)=lower($1) AND organization_id=$2 AND deleted_at IS NULL AND is_active=true LIMIT 1`,
        [userEmail, organizationId],
      );
      if (!rows.length || rows[0].role !== 'OWNER') {
        throw new ForbiddenException('Solo el propietario puede cargar datos en esta organización');
      }
      if (clearFirst) await this._clearOkrData(organizationId);
      return this._doLoad(organizationId, rows[0].id, data);
    });
  }

  private async _doLoad(
    organizationId: string, userId: string, data: ImportData,
  ): Promise<{ success: boolean; message: string }> {

    // Disable effective limits during bulk import (set high enough to never trigger)
    await this.db.query(
      `UPDATE organizations SET parameters = COALESCE(parameters, '{}'::jsonb) || $1::jsonb WHERE id=$2`,
      [JSON.stringify({ max_objectives_per_level: 999, max_krs_per_objective: 999 }), organizationId],
    );

    const currentYear = new Date().getFullYear();

    const yearsNeeded = [...new Set(data.objectives.map(o => o.cycle_year || currentYear))];
    if (!yearsNeeded.includes(currentYear)) yearsNeeded.push(currentYear);

    const has3Y = data.objectives.some(o => o.cycle_duration === '3Y');
    const hasQuarterly = data.objectives.some(o => o.cycle_duration === 'QUARTERLY');
    const cycleMap = new Map<string, string>();

    for (const year of yearsNeeded) {
      const id = await this.getOrCreateCycle(
        organizationId, userId,
        'ANNUAL', `Año ${year}`, `${year}-01-01`, `${year}-12-31`,
      );
      cycleMap.set(`ANNUAL:${year}`, id);
    }

    if (has3Y) {
      const startYear = Math.min(...yearsNeeded);
      const id = await this.getOrCreateCycle(
        organizationId, userId,
        'CUSTOM', `Plan Estratégico ${startYear}–${startYear + 2}`, `${startYear}-01-01`, `${startYear + 2}-12-31`,
      );
      cycleMap.set('3Y', id);
    }

    if (hasQuarterly) {
      const quarterDates = [
        { q: 1, start: '-01-01', end: '-03-31' },
        { q: 2, start: '-04-01', end: '-06-30' },
        { q: 3, start: '-07-01', end: '-09-30' },
        { q: 4, start: '-10-01', end: '-12-31' },
      ];
      for (const year of yearsNeeded) {
        for (const { q, start, end } of quarterDates) {
          const id = await this.getOrCreateCycle(
            organizationId, userId,
            'QUARTERLY', `Q${q} ${year}`, `${year}${start}`, `${year}${end}`,
          );
          cycleMap.set(`QUARTERLY:${year}:${q}`, id);
        }
      }
    }

    const defaultCycleId = cycleMap.get(`ANNUAL:${currentYear}`)!;

    let newIntentsCount = 0;
    for (const intent of data.strategic_intents) {
      const existing = await this.db.query<{ id: string }>(
        `SELECT id FROM strategic_intents WHERE organization_id=$1 AND lower(title)=lower($2) AND deleted_at IS NULL LIMIT 1`,
        [organizationId, intent.title],
      );
      if (!existing.length) {
        await this.db.query(
          `INSERT INTO strategic_intents (id, organization_id, title, category, horizon_years, target_year, status, created_by, description)
           VALUES ($1,$2,$3,$4,3,$5,'ACTIVE',$6,$7)`,
          [randomUUID(), organizationId, intent.title, intent.category || 'OTHER', currentYear + 2, userId, intent.description ?? null],
        );
        newIntentsCount++;
      }
    }

    const objectiveIdMap = new Map<string, string>();
    let newObjectivesCount = 0;
    for (const obj of data.objectives) {
      const year = obj.cycle_year || currentYear;
      let cycleId: string;
      if (obj.cycle_duration === '3Y') {
        cycleId = cycleMap.get('3Y') ?? defaultCycleId;
      } else if (obj.cycle_duration === 'QUARTERLY') {
        const now = new Date();
        const q = year === now.getFullYear() ? Math.ceil((now.getMonth() + 1) / 3) : 1;
        cycleId = cycleMap.get(`QUARTERLY:${year}:${q}`) ?? cycleMap.get(`ANNUAL:${year}`) ?? defaultCycleId;
      } else {
        cycleId = cycleMap.get(`ANNUAL:${year}`) ?? defaultCycleId;
      }

      const existingObj = await this.db.query<{ id: string }>(
        `SELECT id FROM objectives WHERE organization_id=$1 AND cycle_id=$2 AND lower(title)=lower($3) AND deleted_at IS NULL LIMIT 1`,
        [organizationId, cycleId, obj.title],
      );
      const objId = existingObj.length ? existingObj[0].id : randomUUID();
      objectiveIdMap.set(obj.title, objId);

      if (!existingObj.length) {
        await this.db.query(
          `INSERT INTO objectives (id, organization_id, cycle_id, title, description, level, status, owner_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8)`,
          [objId, organizationId, cycleId, obj.title, obj.description ?? null, obj.level || 'COMPANY', userId, userId],
        );
        newObjectivesCount++;
      }
    }

    let krCount = 0;
    for (const kr of data.key_results) {
      const objId = kr.objective_title ? objectiveIdMap.get(kr.objective_title) : undefined;
      if (!objId) continue;

      const existingKr = await this.db.query<{ id: string }>(
        `SELECT id FROM key_results WHERE objective_id=$1 AND lower(title)=lower($2) AND deleted_at IS NULL LIMIT 1`,
        [objId, kr.title],
      );
      if (!existingKr.length) {
        await this.db.query(
          `INSERT INTO key_results (id, objective_id, title, type, metric_unit, start_value, target_value, current_value, confidence, status, owner_id, created_by)
           VALUES ($1,$2,$3,$4,$5,0,$6,0,0.7,'ON_TRACK',$7,$8)`,
          [randomUUID(), objId, kr.title, kr.type || 'INCREASE', kr.unit || '%', kr.target ?? 100, userId, userId],
        );
        krCount++;
      }
    }

    let initiativeCount = 0;
    if (data.initiatives.length > 0) {
      const teamId = await this.getOrCreateDefaultTeam(organizationId, userId);
      if (teamId) {
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = `${currentYear}-12-31`;
        for (const ini of data.initiatives) {
          const existingIni = await this.db.query<{ id: string }>(
            `SELECT id FROM initiatives WHERE organization_id=$1 AND lower(title)=lower($2) AND deleted_at IS NULL LIMIT 1`,
            [organizationId, ini.title],
          );
          if (!existingIni.length) {
            await this.db.query(
              `INSERT INTO initiatives (id, organization_id, cycle_id, team_id, owner_id, title, description, start_date, due_date, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [randomUUID(), organizationId, defaultCycleId, teamId, userId, ini.title, ini.description ?? null, startDate, endDate, userId],
            );
            initiativeCount++;
          }
        }
      }
    }

    this.logger.log(
      `[import] org=${organizationId}: +${newIntentsCount} intents, ` +
      `+${newObjectivesCount} objs, +${krCount} KRs, +${initiativeCount} initiatives`,
    );

    const parts: string[] = [];
    if (newIntentsCount) parts.push(`${newIntentsCount} intenciones`);
    if (newObjectivesCount) parts.push(`${newObjectivesCount} objetivos`);
    if (krCount) parts.push(`${krCount} key results`);
    if (initiativeCount) parts.push(`${initiativeCount} iniciativas`);

    return {
      success: true,
      message: parts.length
        ? `Cargado exitosamente: ${parts.join(', ')}`
        : 'Sin cambios — todos los elementos ya existían',
    };
  }
}
