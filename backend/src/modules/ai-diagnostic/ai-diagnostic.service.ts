import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DbService } from '../../database/db.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';

interface SwotItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: number;
  frequency: number;
  evidence?: string;
}

@Injectable()
export class AiDiagnosticService {
  private readonly logger = new Logger(AiDiagnosticService.name);
  private anthropic: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
    private readonly pdf: PdfGeneratorService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', ''),
    });
  }

  private get model() { return this.config.get<string>('AI_HEAVY_MODEL', 'claude-sonnet-4-6'); }

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_ai_diagnostic_reports WHERE organization_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
  }

  async findOne(orgId: string, id: string) {
    const row = await this.db.queryOne<any>(
      `SELECT r.*, u.name AS created_by_name
         FROM ai_diagnostic_reports r
         JOIN users u ON u.id = r.created_by
        WHERE r.id = $1 AND r.organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Reporte no encontrado');
    return row;
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  async generate(orgId: string, userId: string, dto: CreateDiagnosticDto): Promise<{ id: string }> {
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO ai_diagnostic_reports (organization_id, created_by, org_name, country_code, country_name, status)
       VALUES ($1, $2, $3, $4, $5, 'GENERATING') RETURNING id`,
      [orgId, userId, dto.orgName, dto.countryCode, dto.countryName],
    );

    // Run async — don't await
    this.runGeneration(row.id, orgId, dto).catch((err) =>
      this.logger.error(`Diagnostic generation failed for ${row.id}: ${err?.message}`),
    );

    return { id: row.id };
  }

  private async runGeneration(reportId: string, orgId: string, dto: CreateDiagnosticDto) {
    try {
      const content = await this.callClaude(dto);
      const pdfPath = await this.pdf.generate(reportId, { orgName: dto.orgName, countryName: dto.countryName, content });

      await this.db.execute(
        `UPDATE ai_diagnostic_reports SET status='READY', content=$1, pdf_path=$2, updated_at=NOW() WHERE id=$3`,
        [JSON.stringify(content), pdfPath, reportId],
      );
    } catch (err: any) {
      await this.db.execute(
        `UPDATE ai_diagnostic_reports SET status='ERROR', error_message=$1, updated_at=NOW() WHERE id=$2`,
        [err?.message ?? 'Error desconocido', reportId],
      );
    }
  }

  private async callClaude(dto: CreateDiagnosticDto): Promise<Record<string, unknown>> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    if (!apiKey.startsWith('sk-ant-')) throw new Error('API key de IA no configurada');

    const response = await this.anthropic.messages.create(
      {
        model: this.model,
        max_tokens: 16000,
        system: `Eres el agente especializado "Claude Strategic Research". Tu función es realizar investigaciones profundas (Deep Research) en el sector financiero cooperativo de América Latina.

        IMPORTANTE: Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido.
        - NO incluyas bloques de código markdown (\`\`\`JSON ... \`\`\`).
        - NO incluyas introducciones, explicaciones ni comentarios.
        - NO incluyas tu proceso de pensamiento en la respuesta final.
        - La respuesta debe comenzar con { y terminar con }.

        PROCESO DE PENSAMIENTO (Deep Research):
        1. Recupera datos regulatorios, normativas y leyes financieras actualizadas del país solicitado.
        2. Analiza el ecosistema competitivo usando benchmarks reales del sector (bancos, otras cooperativas, fintechs).
        3. Evalúa tendencias macroeconómicas y tecnológicas específicas de 2024-2025.
        4. Genera una síntesis estratégica de alta consultoría.`,
        messages: [{ role: 'user', content: `[DEEP RESEARCH MODE ENABLED] ${this.buildPrompt(dto)}` }],
      } as any
    );

    if (response.stop_reason === 'max_tokens') {
      this.logger.error(`Response truncated at max_tokens. Consider reducing prompt scope.`);
      throw new Error('La respuesta de IA fue truncada. Intenta de nuevo o contacta al soporte.');
    }

    const fullText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    this.logger.debug(`Claude raw response length: ${fullText.length}, stop_reason: ${response.stop_reason}`);
    return this.parseResponse(fullText, dto);
  }

  private buildPrompt(dto: CreateDiagnosticDto): string {
    return `Eres un consultor estratégico senior del sector financiero cooperativo de América Latina. Genera un diagnóstico estratégico completo para la siguiente entidad.

ENTIDAD: ${dto.orgName}
PAÍS: ${dto.countryName} (${dto.countryCode})

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta. Sin markdown, sin bloques de código, sin texto antes ni después del JSON:

{
  "entity_profile": {
    "type": "COOPERATIVE|BANK|FINTECH|SAVINGS_BANK|CREDIT_UNION|INSURANCE|MUTUAL",
    "sector": "Sector financiero específico (ej: Cooperativas de Ahorro y Crédito)",
    "estimated_size": "MICRO|SMALL|MEDIUM|LARGE",
    "geographic_scope": "LOCAL|REGIONAL|NATIONAL",
    "regulatory_classification": "Clasificación regulatoria oficial en ${dto.countryName}",
    "typical_structure": "Descripción de la estructura de gobierno y operativa típica de esta entidad en ${dto.countryName}",
    "key_services": ["Productos y servicios financieros principales que ofrece este tipo de entidad"],
    "member_or_client_profile": "Perfil típico de socios o clientes: segmento socioeconómico, edad, necesidades financieras predominantes",
    "market_position": "Posición competitiva estimada en el mercado de ${dto.countryName}: cuota, segmento atendido, diferenciadores",
    "strategic_moment": "Descripción del momento estratégico actual: qué está pasando en el entorno que define el contexto de esta entidad hoy",
    "key_figures": "Datos relevantes del sector en ${dto.countryName}: número de entidades similares, activos totales del sector, socios/clientes aproximados",
    "historical_context": "Origen y evolución del modelo de entidad en ${dto.countryName}: cuándo surgió, cómo ha evolucionado, hitos relevantes"
  },
  "executive_summary": "Resumen ejecutivo de 5-7 oraciones: quién es la entidad, en qué contexto opera, cuáles son sus principales oportunidades y riesgos, y qué prioridades estratégicas emergen del análisis.",
  "organizational_context": "Análisis detallado del contexto organizacional: situación macroeconómica de ${dto.countryName} que afecta al sector, tendencias del mercado financiero local, nivel de bancarización, competencia digital y tradicional, y posicionamiento estratégico de este tipo de entidad.",
  "regulatory_context": {
    "entities": [
      {"name": "Nombre oficial del organismo", "type": "SUPERINTENDENCY|CENTRAL_BANK|MINISTRY|ASSOCIATION|DEPOSIT_GUARANTEE", "role": "Función regulatoria específica sobre este tipo de entidad", "website": "URL oficial"}
    ],
    "key_frameworks": ["Leyes, decretos, normas y circulares aplicables con año si lo conoces"],
    "compliance_challenges": "Descripción de los principales desafíos de cumplimiento normativo actuales: nuevas regulaciones, plazos, costos de implementación"
  },
  "benchmark": {
    "sector": "COOPERATIVE|BANKING|MIXED|FINTECH",
    "national_players": [
      {"name": "Nombre de la entidad competidora o referente", "type": "BANK|COOPERATIVE|FINTECH|SAVINGS_BANK|INSURANCE", "market_share_approx": "Cuota estimada o ranking", "key_differentiator": "Por qué es relevante como referencia o competidor"}
    ],
    "latam_references": [
      {"name": "Entidad referente de LATAM o Caribe", "country": "País", "type": "COOPERATIVE|BANK|FINTECH", "relevance": "Qué práctica o modelo hace que sea un buen benchmark para esta entidad"}
    ],
    "industry_trends": ["Tendencias clave 2024-2025 del sector financiero cooperativo en LATAM que impactan a esta entidad"]
  },
  "swot": {
    "strengths": [
      {"id": "S1", "title": "Título descriptivo máx 8 palabras", "description": "Descripción con evidencia del mercado de ${dto.countryName}", "category": "PEOPLE|PROCESS|TECHNOLOGY|MARKET|CULTURE|FINANCIAL|OPERATIONAL", "severity": 4, "frequency": 3}
    ],
    "weaknesses": [
      {"id": "W1", "title": "Título descriptivo máx 8 palabras", "description": "Descripción con impacto específico en la operación", "category": "PEOPLE|PROCESS|TECHNOLOGY|MARKET|CULTURE|FINANCIAL|OPERATIONAL", "severity": 4, "frequency": 3}
    ],
    "opportunities": [
      {"id": "O1", "title": "Título descriptivo máx 8 palabras", "description": "Descripción con potencial de captura y condiciones actuales del mercado", "category": "MARKET|TECHNOLOGY|FINANCIAL|PROCESS|OPERATIONAL", "severity": 3, "frequency": 3}
    ],
    "threats": [
      {"id": "T1", "title": "Título descriptivo máx 8 palabras", "description": "Descripción con riesgo específico y probabilidad de materialización", "category": "MARKET|TECHNOLOGY|FINANCIAL|OPERATIONAL|PEOPLE", "severity": 4, "frequency": 3}
    ]
  },
  "strategic_recommendations": [
    {"priority": 1, "title": "Título accionable de la recomendación", "rationale": "Justificación de 2-3 oraciones: por qué ahora, qué problema resuelve o qué oportunidad captura", "timeline": "SHORT|MEDIUM|LONG", "type": "DEFENSE|ATTACK|IMPROVE|TRANSFORM"}
  ],
  "strategic_insights": [
    "Insight profundo sobre la ventaja competitiva o vulnerabilidad crítica de la entidad",
    "Observación sobre la tendencia de mercado más disruptiva para este modelo de negocio",
    "Analysis de la brecha entre la capacidad actual y la demanda del mercado futuro"
  ],
  "bibliography": [
    {"source": "Nombre de la institución o fuente", "title": "Título del reporte, ley o documento", "year": "Año", "url": "URL si aplica"}
  ]
}

Requisitos de cantidad: entre 6 y 8 ítems en cada cuadrante FODA (S1-S8, W1-W8, O1-O8, T1-T8), exactamente 6 recomendaciones estratégicas, entre 4 y 6 insights profundos, entre 4 y 5 actores nacionales, entre 4 y 5 referencias LATAM, entre 6 y 8 marcos normativos, entre 6 y 8 tendencias, y una bibliografía de al menos 5 fuentes clave. Descripciones detalladas y específicas para ${dto.orgName} en ${dto.countryName}.`;
  }

  private parseResponse(raw: string, dto: CreateDiagnosticDto): Record<string, unknown> {
    if (!raw?.trim()) throw new Error('La IA no devolvió contenido');

    // Strip markdown code fences if present
    let clean = raw.trim();
    const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) clean = fenceMatch[1].trim();

    // Find outermost JSON object
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) {
      this.logger.error(`No JSON found. Raw (first 500): ${raw.slice(0, 500)}`);
      throw new Error('La IA no devolvió un JSON válido');
    }

    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch (e: any) {
      this.logger.error(`JSON parse error: ${e.message}. Raw (first 500): ${raw.slice(0, 500)}`);
      throw new Error('Error al parsear la respuesta de IA');
    }
  }

  // ── Regenerate ────────────────────────────────────────────────────────────

  async regenerate(orgId: string, userId: string, id: string): Promise<{ id: string }> {
    const report = await this.findOne(orgId, id);
    await this.db.execute(
      `UPDATE ai_diagnostic_reports SET status='GENERATING', content='{}', error_message=NULL, updated_at=NOW() WHERE id=$1`,
      [id],
    );
    const dto: CreateDiagnosticDto = {
      orgName: report.org_name,
      countryCode: report.country_code,
      countryName: report.country_name,
    };
    this.runGeneration(id, orgId, dto).catch((err) =>
      this.logger.error(`Regeneration failed for ${id}: ${err?.message}`),
    );
    return { id };
  }

  // ── Remove ────────────────────────────────────────────────────────────────

  async remove(orgId: string, id: string): Promise<void> {
    const report = await this.findOne(orgId, id);
    // Delete PDF file if exists
    if (report.pdf_path) {
      const fs = await import('fs');
      if (fs.existsSync(report.pdf_path)) fs.unlinkSync(report.pdf_path);
    }
    await this.db.execute(`DELETE FROM ai_diagnostic_reports WHERE id=$1`, [id]);
  }

  // ── Download PDF ──────────────────────────────────────────────────────────

  getPdfPath(report: any): string {
    return this.pdf.getFilePath(report.id);
  }

  async regeneratePdf(orgId: string, id: string): Promise<string> {
    const report = await this.findOne(orgId, id);
    if (report.status !== 'READY') throw new BadRequestException('El reporte aún no está listo');
    const pdfPath = await this.pdf.generate(id, { orgName: report.org_name, countryName: report.country_name, content: report.content });
    await this.db.execute(`UPDATE ai_diagnostic_reports SET pdf_path=$1, updated_at=NOW() WHERE id=$2`, [pdfPath, id]);
    return pdfPath;
  }

  // ── Import SWOT items as organizational problems ───────────────────────────

  async importItems(orgId: string, userId: string, reportId: string, itemIds: string[]) {
    const report = await this.findOne(orgId, reportId);
    if (report.status !== 'READY') throw new BadRequestException('El reporte aún no está listo');

    const swot = report.content?.swot ?? {};
    const allItems: SwotItem[] = [
      ...(swot.strengths ?? []),
      ...(swot.weaknesses ?? []),
      ...(swot.opportunities ?? []),
      ...(swot.threats ?? []),
    ];

    const selected = allItems.filter((i) => itemIds.includes(i.id));
    if (!selected.length) throw new BadRequestException('No se seleccionaron ítems válidos');

    const validCategories = ['PEOPLE','PROCESS','TECHNOLOGY','MARKET','CULTURE','FINANCIAL','OPERATIONAL','OTHER'];

    const inserted: string[] = [];
    for (const item of selected) {
      const category = validCategories.includes(item.category) ? item.category : 'OTHER';
      const severity = Math.max(1, Math.min(5, item.severity ?? 3));
      const frequency = Math.max(1, Math.min(5, item.frequency ?? 3));

      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO organizational_problems
           (organization_id, created_by, title, description, category, severity, frequency)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [orgId, userId, item.title, item.description ?? '', category, severity, frequency],
      );
      inserted.push(row.id);
    }

    return { imported: inserted.length, ids: inserted };
  }
}
