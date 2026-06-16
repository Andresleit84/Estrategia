import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse');
import { DbService } from '../../database/db.service';
import { EmailService } from '../../common/email/email.service';
import { PdfService } from '../reports/pdf.service';
import { buildSectorDiagnosisPdf, SectorPdfData } from './sector-assessment-pdf.template';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateThreatDto } from './dto/update-threat.dto';
import { CreateSessionDto } from './dto/create-session.dto';

interface SessionDocument {
  id: string;
  name: string;
  doc_type: string;
  content: string;
  size_chars: number;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
}

@Injectable()
export class SectorAssessmentService {
  private anthropic: Anthropic;
  private readonly logger = new Logger(SectorAssessmentService.name);

  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly pdf: PdfService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', ''),
    });
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async findAllSessions(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_sector_sessions
        WHERE organization_id = $1
        ORDER BY created_at DESC`,
      [orgId],
    );
  }

  async findSession(orgId: string, sessionId: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_sector_sessions
        WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId],
    );
    if (!row) throw new NotFoundException('Sesión no encontrada');
    return row;
  }

  async findMyParticipantSession(orgId: string, userId: string) {
    const row = await this.db.queryOne<{
      id: string; name: string; period_label: string;
      status: string; created_at: string; my_assessment_id: string | null;
    }>(
      `SELECT
         s.id, s.name, s.period_label, s.status, s.created_at,
         (SELECT sa.id FROM sector_assessments sa
          WHERE sa.session_id = s.id AND sa.created_by = $2 AND sa.deleted_at IS NULL
          ORDER BY sa.created_at DESC LIMIT 1) AS my_assessment_id
       FROM sector_assessment_sessions s
       JOIN sector_session_participants p ON p.session_id = s.id AND p.user_id = $2
       WHERE s.organization_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [orgId, userId],
    );
    return row ?? null;
  }

  async createSession(orgId: string, userId: string, dto: CreateSessionDto) {
    const [row] = await this.db.query<{ p_id: string }>(
      `CALL sp_create_sector_session($1, $2, $3, $4, NULL)`,
      [orgId, userId, dto.name, dto.period_label],
    );
    return this.findSession(orgId, row.p_id);
  }

  async deleteSession(orgId: string, sessionId: string) {
    await this.findSession(orgId, sessionId);
    await this.db.query(
      `UPDATE sector_assessment_sessions SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId],
    );
    return { deleted: true, id: sessionId };
  }

  async getSessionConsolidation(orgId: string, sessionId: string) {
    await this.findSession(orgId, sessionId);
    const row = await this.db.queryOne<{ data: unknown }>(
      `SELECT fn_session_consolidation($1, $2) AS data`,
      [sessionId, orgId],
    );
    return row?.data ?? { session: {}, meta: {}, threats: [] };
  }

  async generateSessionPdf(orgId: string, sessionId: string): Promise<Buffer> {
    const orgRow = await this.db.queryOne<{ name: string }>(
      `SELECT name FROM organizations WHERE id = $1`,
      [orgId],
    );
    const session = await this.findSession(orgId, sessionId);
    const data = await this.getSessionConsolidation(orgId, sessionId) as { session: any; meta: any; threats: any[] };

    const pdfData: SectorPdfData = {
      sessionName: String(session.name ?? 'Diagnóstico Sectorial'),
      periodLabel: String(session.period_label ?? ''),
      createdAt: String(session.created_at ?? new Date().toISOString()),
      orgName: String(orgRow?.name ?? ''),
      completedCount: Number(data.meta?.completed_count ?? 0),
      calibratedScores: (session.calibrated_scores as Record<string, number> | null) ?? null,
      sessionDocCount: Array.isArray(session.session_documents) ? session.session_documents.length : 0,
      aiPlan: session.ai_plan ?? {},
      threats: (data.threats ?? []).map((t: any) => ({
        threat_key: t.threat_key,
        avg_score: Number(t.avg_score),
        min_score: Number(t.min_score),
        max_score: Number(t.max_score),
        stddev: t.stddev != null ? Number(t.stddev) : null,
        count: Number(t.count),
        consensus_level: t.consensus_level ?? 'Bajo',
        calibrated_score: t.calibrated_score != null ? Number(t.calibrated_score) : null,
      })),
    };

    const html = buildSectorDiagnosisPdf(pdfData);
    return this.pdf.htmlToPdf(html);
  }

  async calibrateSession(orgId: string, sessionId: string, scores: Record<string, number>) {
    await this.findSession(orgId, sessionId);
    await this.db.query(
      `CALL sp_calibrate_session($1, $2, $3::jsonb)`,
      [sessionId, orgId, JSON.stringify(scores)],
    );
    return this.getSessionConsolidation(orgId, sessionId);
  }

  // ─── Session Documents ────────────────────────────────────────────────────

  async uploadDocument(
    orgId: string,
    sessionId: string,
    userId: string,
    userName: string,
    file: Express.Multer.File,
    docType: string,
  ) {
    await this.findSession(orgId, sessionId);

    const MAX_CHARS = 12_000;
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    let content = '';

    if (ext === 'pdf') {
      const parsed = await pdfParse(file.buffer);
      content = parsed.text.replace(/\s+/g, ' ').trim();
    } else if (['txt', 'md', 'csv'].includes(ext)) {
      content = file.buffer.toString('utf-8').replace(/\s+/g, ' ').trim();
    } else {
      throw new BadRequestException('Formato no soportado. Usa PDF, TXT o MD.');
    }

    const truncated = content.length > MAX_CHARS
      ? content.slice(0, MAX_CHARS) + `\n\n[Documento truncado — ${content.length} chars totales]`
      : content;

    const doc: SessionDocument = {
      id: randomUUID(),
      name: file.originalname,
      doc_type: docType || 'other',
      content: truncated,
      size_chars: content.length,
      uploaded_at: new Date().toISOString(),
      uploaded_by: userId,
      uploaded_by_name: userName,
    };

    await this.db.query(
      `UPDATE sector_assessment_sessions
          SET session_documents = session_documents || $1::jsonb,
              updated_at = NOW()
        WHERE id = $2 AND organization_id = $3`,
      [JSON.stringify([doc]), sessionId, orgId],
    );

    return this.findSession(orgId, sessionId);
  }

  async deleteDocument(orgId: string, sessionId: string, docId: string) {
    await this.findSession(orgId, sessionId);
    await this.db.query(
      `UPDATE sector_assessment_sessions
          SET session_documents = (
            SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) FROM jsonb_array_elements(session_documents) d
            WHERE d->>'id' != $1
          ),
              updated_at = NOW()
        WHERE id = $2 AND organization_id = $3`,
      [docId, sessionId, orgId],
    );
    return this.findSession(orgId, sessionId);
  }

  async analyzeSession(orgId: string, sessionId: string) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    const data = await this.getSessionConsolidation(orgId, sessionId) as {
      session: Record<string, unknown>;
      meta: Record<string, unknown>;
      threats: Record<string, unknown>[];
    };

    if (!data.threats || data.threats.length === 0) {
      throw new NotFoundException('No hay evaluaciones completadas para analizar');
    }

    if (!apiKey.startsWith('sk-ant-')) {
      await this.db.query(
        `UPDATE sector_assessment_sessions SET ai_plan = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({ error: 'AI no configurado' }), sessionId],
      );
      return this.findSession(orgId, sessionId);
    }

    const calibrated = data.session['calibrated_scores'] as Record<string, number> | null;
    const completedCount = (data.meta['completed_count'] as number) ?? 0;
    const today = new Date().toISOString().split('T')[0];
    const sessionName = (data.session['name'] as string) ?? 'Sesión';

    const [sessionRow] = await this.db.query<{ session_documents: SessionDocument[] }>(
      `SELECT session_documents FROM sector_assessment_sessions WHERE id = $1 AND organization_id = $2`,
      [sessionId, orgId],
    );
    const sessionDocs: SessionDocument[] = sessionRow?.session_documents ?? [];

    const threatSummary = data.threats
      .map((t) => {
        const calibScore = calibrated?.[t['threat_key'] as string];
        const effectiveScore = calibScore ?? t['avg_score'];
        const calibNote = calibScore ? ` → calibrado: ${calibScore}` : '';
        const consensusNote = t['consensus_level'] === 'LOW'
          ? `⚠ BAJO CONSENSO (stddev: ${t['stddev']})`
          : t['consensus_level'] === 'MEDIUM'
          ? `CONSENSO MEDIO (stddev: ${t['stddev']})`
          : `ALTO CONSENSO`;
        const individualScores = (t['scores'] as Record<string, unknown>[])
          .map(s => `${s['assessor_name'] ?? 'Evaluador'}: ${s['score']}`)
          .join(', ');
        return `• ${t['threat_key']}
  Score efectivo: ${effectiveScore}/5${calibNote}  Promedio: ${t['avg_score']}  Mín: ${t['min_score']}  Máx: ${t['max_score']}
  ${consensusNote}
  Evaluaciones (${t['count']}): ${individualScores}`;
      })
      .join('\n\n');

    // Compute strongest and weakest for the prompt
    const sorted = [...data.threats].sort((a, b) => {
      const aScore = (calibrated?.[a['threat_key'] as string] ?? a['avg_score']) as number;
      const bScore = (calibrated?.[b['threat_key'] as string] ?? b['avg_score']) as number;
      return bScore - aScore;
    });
    const topN = sorted.slice(0, 3).map(t => `${t['threat_key']} (${calibrated?.[t['threat_key'] as string] ?? t['avg_score']}/5)`).join(', ');
    const bottomN = sorted.slice(-3).map(t => `${t['threat_key']} (${calibrated?.[t['threat_key'] as string] ?? t['avg_score']}/5)`).join(', ');

    const docsSection = sessionDocs.length > 0
      ? `\n\nINSUMOS DE SOPORTE CARGADOS (${sessionDocs.length} documento${sessionDocs.length > 1 ? 's' : ''}):\n` +
        sessionDocs.map((d, i) =>
          `--- Documento ${i + 1}: "${d.name}" (${d.doc_type}) — ${d.size_chars} chars ---\n${d.content}\n---`,
        ).join('\n\n')
      : '';

    const prompt = `Eres un consultor senior especializado en diagnóstico y transformación de cooperativas financieras latinoamericanas. Tu rol es analizar los resultados de una sesión de diagnóstico sectorial y generar un plan de trabajo detallado con nivel de propuesta consultora, fundamentado tanto en los scores calibrados como en los insumos documentales aportados por el equipo.

SESIÓN: ${sessionName}
FECHA: ${today}
EVALUADORES: ${completedCount} personas completaron la valoración

RESULTADOS CONSOLIDADOS (scores calibrados por dimensión):
${threatSummary}

FORTALEZAS RELATIVAS: ${topN}
ÁREAS CRÍTICAS: ${bottomN}

BENCHMARKS SECTORIALES (WOCCU 2024):
- Alto desempeño: score promedio 3.8–4.5
- En transición: 2.8–3.7
- En riesgo: < 2.8
- Amenazas más críticas en LATAM: MARGIN_DEPENDENCY, DIGITAL_CAPABILITY, GOVERNANCE_MATURITY
${docsSection}

INSTRUCCIONES:
1. Integra los insumos documentales (si los hay) con los scores para enriquecer el diagnóstico — los documentos pueden confirmar, matizar o contradecir los scores numéricos.
2. El diagnóstico_general debe leer como un informe ejecutivo de consultoría: preciso, con hallazgos concretos, sin lenguaje genérico.
3. El plan_accion por amenaza debe incluir actividades específicas, responsables sugeridos y criterios de éxito — no frases vagas.
4. El roadmap debe ser coherente entre los 3 horizontes: las acciones_30d preparan el terreno para iniciativas_90d, que habilitan transformaciones_180d.
5. Los kpis deben ser medibles, con unidad y frecuencia sugerida.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto fuera del JSON):
{
  "generated_at": "ISO timestamp",
  "fortalezas": [
    { "threat_key": "THREAT_KEY", "score": 4.2, "razon": "Argumento concreto basado en scores e insumos" }
  ],
  "debilidades": [
    { "threat_key": "THREAT_KEY", "score": 1.8, "razon": "Argumento concreto con evidencia de documentos si disponible" }
  ],
  "diagnostico_general": "3-4 párrafos: estado sistémico actual, patrones críticos identificados, factores de riesgo estructural, oportunidades estratégicas. Tono de informe ejecutivo.",
  "insights_consenso": "Análisis de alineación entre evaluadores: amenazas con mayor dispersión, qué implica esa discrepancia, qué revelan los insumos documentales sobre esas brechas de percepción.",
  "resumen_insumos": "Síntesis de los principales hallazgos de los documentos de soporte y cómo complementan o contextualizan los scores. Omitir si no hay documentos.",
  "roadmap": {
    "acciones_30d": [
      "Acción específica: qué, quién, cómo medir — orientada a diagnóstico profundo y quick wins",
      "Acción 2",
      "Acción 3"
    ],
    "iniciativas_90d": [
      "Iniciativa con alcance, recursos necesarios y resultado esperado",
      "Iniciativa 2"
    ],
    "transformaciones_180d": [
      "Transformación estructural con impacto esperado en el score de la amenaza correspondiente",
      "Transformación 2"
    ]
  },
  "por_amenaza": {
    "THREAT_KEY": {
      "prioridad": "CRITICA|ALTA|MODERADA|BUENA|EXCELENTE",
      "diagnostico": "1-2 oraciones sobre el estado actual de esta amenaza específica",
      "plan_accion": "Plan detallado: 3-4 actividades concretas con responsable sugerido y plazo",
      "kpis": ["KPI medible con unidad y frecuencia — ej: Tasa de digitalización mensual > 15%", "KPI 2"]
    }
  }
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let plan: Record<string, unknown>;
    try {
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'El análisis no devolvió JSON válido' };
    } catch {
      plan = { error: 'La respuesta del agente fue demasiado extensa. Inténtalo de nuevo.' };
    }

    await this.db.query(
      `UPDATE sector_assessment_sessions SET ai_plan = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(plan), sessionId],
    );

    return this.findSession(orgId, sessionId);
  }

  // ─── Session Participants ─────────────────────────────────────────────────

  async getSessionParticipants(orgId: string, sessionId: string) {
    await this.findSession(orgId, sessionId);
    return this.db.query(
      `SELECT * FROM v_session_participant_status WHERE session_id = $1 ORDER BY user_name`,
      [sessionId],
    );
  }

  async addSessionParticipant(orgId: string, sessionId: string, userId: string, addedBy: string) {
    const session = await this.findSession(orgId, sessionId);

    const [member] = await this.db.query<{ id: string; name: string; email: string }>(
      `SELECT id, name, email FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true`,
      [userId, orgId],
    );
    if (!member) throw new ForbiddenException('El usuario no pertenece a la organización');

    await this.db.query(`CALL sp_add_session_participant($1, $2, $3)`, [sessionId, userId, addedBy]);
    return this.getSessionParticipants(orgId, sessionId);
  }

  async notifySessionParticipants(orgId: string, sessionId: string, notifiedBy: string) {
    const session = await this.findSession(orgId, sessionId);
    const participants = await this.db.query<{ user_id: string; user_name: string; user_email: string }>(
      `SELECT user_id, user_name, user_email FROM v_session_participant_status WHERE session_id = $1`,
      [sessionId],
    );
    if (participants.length === 0) return { sent: 0 };

    let sent = 0;
    for (const p of participants) {
      await this.sendParticipantInviteEmail(
        { name: p.user_name, email: p.user_email },
        session as Record<string, unknown>,
        orgId,
        notifiedBy,
      ).catch((err) => this.logger.warn(`Error enviando email a ${p.user_email}:`, err));
      sent++;
    }
    return { sent };
  }

  private async sendParticipantInviteEmail(
    participant: { name: string; email: string },
    session: Record<string, unknown>,
    orgId: string,
    addedById: string,
  ) {
    const [inviter] = await this.db.query<{ name: string }>(
      `SELECT name FROM users WHERE id = $1`,
      [addedById],
    );
    const [org] = await this.db.query<{ name: string; parameters: Record<string, unknown> }>(
      `SELECT name, parameters FROM organizations WHERE id = $1`,
      [orgId],
    );

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const smtp = org?.parameters?.smtp_host ? {
      host:  org.parameters.smtp_host as string,
      port:  Number(org.parameters.smtp_port ?? 587),
      user:  org.parameters.smtp_user as string,
      pass:  org.parameters.smtp_pass as string,
      from:  org.parameters.smtp_from as string,
    } : undefined;

    await this.email.sendAssessmentInvite(
      participant.email,
      participant.name,
      inviter?.name ?? 'Un administrador',
      org?.name ?? 'la organización',
      session['name'] as string,
      session['period_label'] as string,
      frontendUrl,
      smtp,
    );
  }

  async removeSessionParticipant(orgId: string, sessionId: string, userId: string) {
    await this.findSession(orgId, sessionId);
    await this.db.query(
      `DELETE FROM sector_session_participants WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    return this.getSessionParticipants(orgId, sessionId);
  }

  // ─── Individual Assessments ───────────────────────────────────────────────

  async findAll(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_sector_assessments
        WHERE organization_id = $1
        ORDER BY created_at DESC`,
      [orgId],
    );
  }

  async findBySession(orgId: string, sessionId: string) {
    return this.db.query(
      `SELECT * FROM v_sector_assessments
        WHERE organization_id = $1 AND session_id = $2
        ORDER BY created_at DESC`,
      [orgId, sessionId],
    );
  }

  async findOne(orgId: string, id: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_sector_assessment_detail
        WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Diagnóstico no encontrado');
    return row;
  }

  async create(orgId: string, userId: string, dto: CreateAssessmentDto, sessionId?: string) {
    const [row] = await this.db.query<{ p_id: string }>(
      `CALL sp_create_sector_assessment($1, $2, $3, $4, NULL, $5)`,
      [orgId, userId, dto.title, dto.engagement_type ?? 'DIAGNOSTIC', sessionId ?? null],
    );
    return this.findOne(orgId, row.p_id);
  }

  async updateThreat(orgId: string, id: string, dto: UpdateThreatDto) {
    await this.findOne(orgId, id);

    await this.db.query(
      `CALL sp_update_threat_score($1, $2, $3, $4, $5, $6)`,
      [id, dto.threat_key, dto.overall_score ?? null, dto.benchmark ?? null, dto.evidence ?? null, dto.ai_insights ?? null],
    );

    if (dto.dimensions && dto.dimensions.length > 0) {
      const [ts] = await this.db.query<{ id: string }>(
        `SELECT id FROM threat_scores WHERE assessment_id = $1 AND threat_key = $2`,
        [id, dto.threat_key],
      );
      if (ts) {
        await this.db.query(
          `CALL sp_upsert_dimension_scores($1, $2::jsonb)`,
          [ts.id, JSON.stringify(dto.dimensions)],
        );
      }
    }

    return this.findOne(orgId, id);
  }

  async complete(orgId: string, id: string) {
    await this.findOne(orgId, id);
    await this.db.query(`CALL sp_complete_assessment($1)`, [id]);
    return this.findOne(orgId, id);
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    await this.db.query(
      `UPDATE sector_assessments SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    return { deleted: true, id };
  }

  // ─── Org-level consolidation (legacy, kept for backwards compat) ──────────

  async consolidation(orgId: string) {
    const row = await this.db.queryOne<{ data: unknown }>(
      `SELECT fn_sector_consolidation($1) AS data`,
      [orgId],
    );
    return row?.data ?? { meta: { total_assessments: 0, completed_count: 0, earliest_date: null, latest_date: null }, threats: [] };
  }

  async getLatestPlan(orgId: string) {
    const rows = await this.db.query<{ ai_plan: unknown; assessment_count: number; created_at: string }>(
      `SELECT ai_plan, assessment_count, created_at
       FROM sector_consolidation_plans
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId],
    );
    return rows[0] ?? null;
  }

  async generateConsolidatedPlan(orgId: string) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    const data = await this.consolidation(orgId) as { meta: Record<string, unknown>; threats: Record<string, unknown>[] };

    if (!data.threats || data.threats.length === 0) {
      throw new NotFoundException('No hay evaluaciones completadas para consolidar');
    }

    if (!apiKey.startsWith('sk-ant-')) {
      return { error: 'AI no configurado' };
    }

    const completedCount = (data.meta['completed_count'] as number) ?? 0;
    const today = new Date().toISOString().split('T')[0];

    const threatSummary = data.threats
      .map((t) => {
        const consensusNote = t['consensus_level'] === 'LOW'
          ? `⚠ BAJO CONSENSO (stddev: ${t['stddev']})`
          : t['consensus_level'] === 'MEDIUM'
          ? `CONSENSO MEDIO (stddev: ${t['stddev']})`
          : `ALTO CONSENSO`;
        return `• ${t['threat_key']}: ${t['avg_score']}/5  Mín:${t['min_score']} Máx:${t['max_score']}  ${consensusNote}`;
      })
      .join('\n');

    const prompt = `Agente de consolidación sectorial. ${completedCount} diagnósticos. Fecha: ${today}.

${threatSummary}

JSON únicamente:
{
  "generated_at": "ISO",
  "overall_diagnosis": "...",
  "critical_areas": ["THREAT_KEY"],
  "strengths": ["THREAT_KEY"],
  "consensus_insights": "...",
  "roadmap": { "immediate_30d": [], "medium_90d": [], "long_180d": [] },
  "per_threat": { "THREAT_KEY": { "priority": "CRITICAL|HIGH_RISK|MODERATE|GOOD|EXCELLENT", "action_plan": "...", "kpis": [] } }
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'parse failed' };

    await this.db.query(
      `INSERT INTO sector_consolidation_plans (organization_id, ai_plan, assessment_count)
       VALUES ($1, $2, $3)`,
      [orgId, JSON.stringify(plan), completedCount],
    );

    return plan;
  }
}
