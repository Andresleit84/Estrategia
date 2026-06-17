import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

type PdfDoc = PDFKit.PDFDocument;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = Record<string, any>;

const C = {
  navy:     '#0B2545',
  blue:     '#1565C0',
  orange:   '#E65100',
  white:    '#FFFFFF',
  offWhite: '#F8F9FA',
  gray:     '#6B7280',
  lightGray:'#E5E7EB',
  darkGray: '#374151',
  green:    '#166534',
  greenBg:  '#DCFCE7',
  red:      '#991B1B',
  redBg:    '#FEE2E2',
  amber:    '#92400E',
  amberBg:  '#FEF3C7',
  indigo:   '#3730A3',
  indigoBg: '#EEF2FF',
};

const ML = 60;   // margin left
const MR = 60;   // margin right
const PW = 595;  // page width A4
const PH = 842;  // page height A4
const CW = PW - ML - MR;  // content width
const CONTENT_TOP = 80;   // y after header
const FOOTER_Y = PH - 50; // y where footer starts

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  private get storageDir() {
    const dir = path.join(process.cwd(), 'reports', 'ai-diagnostic');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async generate(reportId: string, data: ReportData): Promise<string> {
    const filePath = path.join(this.storageDir, `${reportId}.pdf`);
    await this.buildPdf(filePath, data);
    return filePath;
  }

  getFilePath(reportId: string): string {
    return path.join(this.storageDir, `${reportId}.pdf`);
  }

  private buildPdf(filePath: string, d: ReportData): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0, compress: true });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      stream.on('error', reject);
      stream.on('finish', resolve);

      this.coverPage(doc, d);
      this.entityProfilePage(doc, d);
      this.execSummaryPage(doc, d);
      this.strategicInsightsPage(doc, d);
      this.regulatoryPage(doc, d);
      this.benchmarkPage(doc, d);
      this.swotPage(doc, d);
      this.recommendationsPage(doc, d);
      this.bibliographyPage(doc, d);

      doc.end();
    });
  }

  // ─── Cover ────────────────────────────────────────────────────────────────

  private coverPage(doc: PdfDoc, d: ReportData) {
    doc.rect(0, 0, PW, PH).fill(C.navy);
    doc.rect(0, 0, PW, 8).fill(C.orange);

    doc.save();
    doc.opacity(0.07);
    doc.circle(PW - 60, 80, 180).fill(C.white);
    doc.restore();

    doc.font('Helvetica').fontSize(9).fillColor(C.orange)
       .text('ANÁLISIS ESTRATÉGICO CONFIDENCIAL', ML, 90, { characterSpacing: 2 });

    doc.font('Helvetica-Bold').fontSize(30).fillColor(C.white)
       .text(d.orgName, ML, 160, { width: CW * 0.75, lineGap: 4 });

    const afterTitle = doc.y + 14;
    doc.font('Helvetica').fontSize(13).fillColor('rgba(255,255,255,0.65)')
       .text('Diagnóstico Estratégico Organizacional', ML, afterTitle, { width: CW });

    doc.moveTo(ML, afterTitle + 36).lineTo(ML + 80, afterTitle + 36).lineWidth(2).strokeColor(C.orange).stroke();

    doc.font('Helvetica').fontSize(11).fillColor('rgba(255,255,255,0.75)')
       .text(d.countryName ?? '', ML, afterTitle + 50)
       .text(`Generado: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, ML, afterTitle + 68);

    const boxY = PH - 170;
    doc.rect(ML, boxY, CW, 110).fill('rgba(255,255,255,0.05)');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.orange)
       .text('METODOLOGÍA', ML + 20, boxY + 18, { characterSpacing: 1.5 });
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.55)')
       .text('Análisis generado con inteligencia artificial (Claude AI) a partir de información pública, marcos regulatorios vigentes y benchmarks del sector financiero regional. Para uso interno exclusivamente.',
             ML + 20, boxY + 36, { width: CW - 40, lineGap: 3 });

    doc.rect(0, PH - 8, PW, 8).fill(C.orange);
  }

  // ─── Entity Profile ───────────────────────────────────────────────────────

  private entityProfilePage(doc: PdfDoc, d: ReportData) {
    doc.addPage();
    this.pageHeader(doc, 'PERFIL DE LA ENTIDAD', '01');
    const ep = d.content?.entity_profile ?? {};
    let y = CONTENT_TOP;

    // Badges
    const badges = [
      { label: 'Tipo', value: ep.type ?? '—', color: C.blue },
      { label: 'Tamaño', value: ep.estimated_size ?? '—', color: C.navy },
      { label: 'Alcance', value: ep.geographic_scope ?? '—', color: C.orange },
    ];
    for (let i = 0; i < badges.length; i++) {
      const b = badges[i];
      doc.rect(ML + i * 148, y, 138, 46).fill(b.color);
    }
    y += 58;

    // Sector row
    if (ep.sector || ep.regulatory_classification) {
      const sectorText = [ep.sector, ep.regulatory_classification].filter(Boolean).join('  ·  ');
      doc.font('Helvetica').fontSize(9);
      const sH = doc.heightOfString(sectorText, { width: CW - 28 });
      const rowH = Math.max(42, sH + 28);
      doc.rect(ML, y, CW, rowH).fill(C.offWhite);
      doc.rect(ML, y, 4, rowH).fill(C.blue);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.blue)
         .text('SECTOR / CLASIFICACIÓN REGULATORIA', ML + 14, y + 8, { characterSpacing: 0.5 });
      doc.font('Helvetica').fontSize(9).fillColor(C.darkGray)
         .text(sectorText, ML + 14, y + 22, { width: CW - 28 });
      y += rowH + 10;
    }

    const fields: Array<{ label: string; text: string }> = [
      { label: 'Estructura organizativa',        text: ep.typical_structure ?? '' },
      { label: 'Perfil de socios / clientes',    text: ep.member_or_client_profile ?? '' },
      { label: 'Posición en el mercado',         text: ep.market_position ?? '' },
      { label: 'Momento estratégico actual',     text: ep.strategic_moment ?? '' },
      { label: 'Datos clave del sector',         text: ep.key_figures ?? '' },
      { label: 'Contexto histórico',             text: ep.historical_context ?? '' },
    ];

    // Key services (grid layout)
    const services: string[] = ep.key_services ?? [];
    if (services.length) {
      y = this.checkPageBreak(doc, y, 60, d.orgName, 'PERFIL DE LA ENTIDAD (cont.)', '01');
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy)
         .text('Productos y servicios principales', ML, y);
      y = doc.y + 8;
      const colW = (CW - 10) / 2;
      for (let i = 0; i < services.length; i += 2) {
        doc.font('Helvetica').fontSize(9).fillColor(C.darkGray)
           .text(`›  ${services[i]}`, ML, y, { width: colW });
        if (services[i + 1]) {
          doc.font('Helvetica').fontSize(9).fillColor(C.darkGray)
             .text(`›  ${services[i + 1]}`, ML + colW + 10, y, { width: colW });
        }
        y += 15;
      }
      y += 8;
    }

    for (const f of fields) {
      if (!f.text.trim()) continue;
      y = this.checkPageBreak(doc, y, 80, d.orgName, 'PERFIL DE LA ENTIDAD (cont.)', '01');
      y = this.infoBox(doc, f.label, f.text, y) + 10;
    }

    this.pageFooter(doc, d.orgName);
  }

  // ─── Executive Summary ────────────────────────────────────────────────────

  private execSummaryPage(doc: PdfDoc, d: ReportData) {
    doc.addPage();
    this.pageHeader(doc, 'RESUMEN EJECUTIVO', '02');
    let y = CONTENT_TOP;

    const summary = d.content?.executive_summary ?? '';
    if (summary) {
      doc.font('Helvetica').fontSize(10.5).fillColor(C.darkGray).lineGap(5)
         .text(summary, ML, y, { width: CW });
      y = doc.y + 20;
    }

    const ctx = d.content?.organizational_context ?? '';
    if (ctx) {
      y = this.checkPageBreak(doc, y, 80, d.orgName, 'RESUMEN EJECUTIVO (cont.)', '02');
      this.infoBox(doc, 'Contexto organizacional y de mercado', ctx, y);
    }

    this.pageFooter(doc, d.orgName);
  }

  // ─── Strategic Insights ───────────────────────────────────────────────────

  private strategicInsightsPage(doc: PdfDoc, d: ReportData) {
    doc.addPage();
    this.pageHeader(doc, 'INSIGHTS ESTRATÉGICOS', '03');
    const insights: string[] = d.content?.strategic_insights ?? [];
    let y = CONTENT_TOP;

    if (insights.length) {
      for (const insight of insights) {
        const h = doc.heightOfString(insight, { width: CW - 60, lineGap: 4 }) + 30;
        y = this.checkPageBreak(doc, y, h + 15, d.orgName, 'INSIGHTS ESTRATÉGICOS (cont.)', '03');

        doc.rect(ML, y, CW, h).fill(C.indigoBg);
        doc.rect(ML, y, 4, h).fill(C.indigo);

        doc.font('Helvetica-Bold').fontSize(16).fillColor(C.indigo)
           .text('"', ML + 15, y + 10);

        doc.font('Helvetica').fontSize(10.5).fillColor(C.darkGray).lineGap(4)
           .text(insight, ML + 35, y + 15, { width: CW - 60 });

        y += h + 15;
      }
    }

    this.pageFooter(doc, d.orgName);
  }

  // ─── Regulatory ───────────────────────────────────────────────────────────

  private regulatoryPage(doc: PdfDoc, d: ReportData) {
    doc.addPage();
    this.pageHeader(doc, 'ENTORNO REGULATORIO', '04');
    const reg = d.content?.regulatory_context ?? {};
    const entities: Record<string, any>[] = reg.entities ?? [];
    let y = CONTENT_TOP;

    if (entities.length) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Organismos de Control', ML, y);
      y = doc.y + 10;

      for (const e of entities) {
        const roleText = `${e.type ?? ''} · ${e.role ?? ''}`;
        doc.font('Helvetica').fontSize(8.5);
        const roleH = doc.heightOfString(roleText, { width: CW - 28 });
        const eH = Math.max(52, roleH + 32);

        y = this.checkPageBreak(doc, y, eH + 8, d.orgName, 'ENTORNO REGULATORIO (cont.)', '04');
        doc.rect(ML, y, CW, eH).fill(C.offWhite);
        doc.rect(ML, y, 4, eH).fill(C.blue);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy)
           .text(e.name ?? '', ML + 14, y + 8, { width: CW - 28 });
        doc.font('Helvetica').fontSize(8.5).fillColor(C.gray)
           .text(roleText, ML + 14, y + 24, { width: CW - 28 });
        if (e.website) {
          doc.font('Helvetica').fontSize(8).fillColor(C.blue)
             .text(e.website, ML + 14, doc.y + 2, { width: CW - 28 });
        }
        y += eH + 8;
      }
    }

    const frameworks: string[] = reg.key_frameworks ?? [];
    if (frameworks.length) {
      y = this.checkPageBreak(doc, y, 40 + frameworks.length * 16, d.orgName, 'ENTORNO REGULATORIO (cont.)', '04');
      y += 8;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Marcos Normativos Clave', ML, y);
      y = doc.y + 8;
      for (const fw of frameworks) {
        doc.font('Helvetica').fontSize(9).fillColor(C.darkGray)
           .text(`›  ${fw}`, ML + 10, y, { width: CW - 10 });
        y = doc.y + 4;
      }
    }

    if (reg.compliance_challenges) {
      y += 12;
      y = this.checkPageBreak(doc, y, 80, d.orgName, 'ENTORNO REGULATORIO (cont.)', '04');
      this.infoBox(doc, 'Desafíos de cumplimiento', reg.compliance_challenges, y);
    }

    this.pageFooter(doc, d.orgName);
  }

  // ─── Benchmark ────────────────────────────────────────────────────────────

  private benchmarkPage(doc: PdfDoc, d: ReportData) {
    doc.addPage();
    this.pageHeader(doc, 'BENCHMARK COMPETITIVO', '05');
    const bm = d.content?.benchmark ?? {};
    const national: Record<string, any>[] = bm.national_players ?? [];
    const latam: Record<string, any>[] = bm.latam_references ?? [];
    const trends: string[] = bm.industry_trends ?? [];
    let y = CONTENT_TOP;

    if (national.length) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Actores nacionales', ML, y);
      y = doc.y + 8;
      y = this.tableBlock(doc, y, ['Entidad', 'Tipo', 'Diferenciador'], [140, 80, CW - 240], national.map(p => [p.name, p.type, p.key_differentiator]), d.orgName, '05');
    }

    if (latam.length) {
      y += 16;
      y = this.checkPageBreak(doc, y, 60, d.orgName, 'BENCHMARK (cont.)', '05');
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Referencias LATAM & Caribe', ML, y);
      y = doc.y + 8;
      y = this.tableBlock(doc, y, ['Entidad', 'País', 'Relevancia'], [140, 60, CW - 220], latam.map(p => [p.name, p.country, p.relevance]), d.orgName, '05');
    }

    if (trends.length) {
      y += 16;
      y = this.checkPageBreak(doc, y, 40 + trends.length * 16, d.orgName, 'BENCHMARK (cont.)', '05');
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Tendencias del sector 2024–2025', ML, y);
      y = doc.y + 8;
      for (const t of trends) {
        doc.font('Helvetica').fontSize(9).fillColor(C.darkGray)
           .text(`›  ${t}`, ML + 10, y, { width: CW - 10 });
        y = doc.y + 4;
      }
    }

    this.pageFooter(doc, d.orgName);
  }

  // ─── SWOT ─────────────────────────────────────────────────────────────────

  private swotPage(doc: PdfDoc, d: ReportData) {
    const swot = d.content?.swot ?? {};
    const half = (CW - 12) / 2;
    const qH = 340;
    const startY = CONTENT_TOP;

    // Page 1: Internal Analysis
    doc.addPage();
    this.pageHeader(doc, 'ANÁLISIS FODA: FACTORES INTERNOS', '06');
    this.swotQuadrant(doc, ML, startY, half, qH, 'FORTALEZAS', swot.strengths ?? [], C.green, C.greenBg, '▲');
    this.swotQuadrant(doc, ML + half + 12, startY, half, qH, 'DEBILIDADES', swot.weaknesses ?? [], C.red, C.redBg, '▼');
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.gray).fillOpacity(0.5)
       .text('ANÁLISIS INTERNO', ML, startY - 14, { width: CW, align: 'center' });
    doc.fillOpacity(1);
    this.pageFooter(doc, d.orgName);

    // Page 2: External Analysis
    doc.addPage();
    this.pageHeader(doc, 'ANÁLISIS FODA: FACTORES EXTERNOS', '06');
    this.swotQuadrant(doc, ML, startY, half, qH, 'OPORTUNIDADES', swot.opportunities ?? [], C.indigo, C.indigoBg, '◆');
    this.swotQuadrant(doc, ML + half + 12, startY, half, qH, 'AMENAZAS', swot.threats ?? [], C.amber, C.amberBg, '⚠');
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.gray).fillOpacity(0.5)
       .text('ANÁLISIS EXTERNO', ML, startY - 14, { width: CW, align: 'center' });
    doc.fillOpacity(1);
    this.pageFooter(doc, d.orgName);
  }

  private swotQuadrant(doc: PdfDoc, x: number, y: number, w: number, h: number, label: string, items: Record<string, any>[], color: string, bg: string, icon: string) {
    doc.rect(x, y, w, h).fill(bg);
    doc.rect(x, y, w, 26).fill(color);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
       .text(`${icon}  ${label}`, x + 10, y + 8, { width: w - 20 });

    let iy = y + 34;
    for (const item of items) {
      if (iy > y + h - 16) break;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(color)
         .text('• ', x + 8, iy, { continued: true });
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1F2937')
         .text(item.title ?? '', { width: w - 26 });
      iy = doc.y + 1;
      if (item.description && iy < y + h - 16) {
        const desc = item.description;
        doc.font('Helvetica').fontSize(7).fillColor(C.gray)
           .text(desc, x + 14, iy, { width: w - 26, lineGap: 1 });
        iy = doc.y + 4;
      }
    }
  }

  // ─── Recommendations ──────────────────────────────────────────────────────

  private recommendationsPage(doc: PdfDoc, d: ReportData) {
    doc.addPage();
    this.pageHeader(doc, 'RECOMENDACIONES ESTRATÉGICAS', '07');
    const recs: Record<string, any>[] = d.content?.strategic_recommendations ?? [];
    let y = CONTENT_TOP;

    const tColor = (t: string) => t === 'SHORT' ? C.green : t === 'MEDIUM' ? C.blue : C.orange;
    const tLabel = (t: string) => t === 'SHORT' ? 'Corto plazo' : t === 'MEDIUM' ? 'Mediano plazo' : 'Largo plazo';

    for (const [i, rec] of recs.entries()) {
      // Calculate actual box height from rationale text
      doc.font('Helvetica').fontSize(8.5);
      const rationaleH = doc.heightOfString(rec.rationale ?? '', { width: CW - 118, lineGap: 2 });
      const boxH = Math.max(68, rationaleH + 50);

      y = this.checkPageBreak(doc, y, boxH + 10, d.orgName, 'RECOMENDACIONES (cont.)', '07');

      doc.rect(ML, y, CW, boxH).fill(C.offWhite);
      doc.rect(ML, y, 4, boxH).fill(tColor(rec.timeline ?? ''));
      doc.rect(ML + 4, y, 28, boxH).fill(C.navy);

      doc.font('Helvetica-Bold').fontSize(15).fillColor(C.white)
         .text(`${i + 1}`, ML + 6, y + (boxH - 18) / 2, { width: 24, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy)
         .text(rec.title ?? '', ML + 42, y + 10, { width: CW - 118 });

      const afterTitle = doc.y + 2;
      doc.font('Helvetica').fontSize(8).fillColor(tColor(rec.timeline ?? ''))
         .text(tLabel(rec.timeline ?? ''), ML + 42, afterTitle);

      doc.font('Helvetica').fontSize(8.5).fillColor(C.gray)
         .text(rec.rationale ?? '', ML + 42, doc.y + 4, { width: CW - 118, lineGap: 2 });

      y += boxH + 10;
    }

    this.pageFooter(doc, d.orgName);
  }

  // ─── Bibliography ─────────────────────────────────────────────────────────

  private bibliographyPage(doc: PdfDoc, d: ReportData) {
    doc.addPage();
    this.pageHeader(doc, 'FUENTES Y BIBLIOGRAFÍA', '08');
    const bib: Record<string, any>[] = d.content?.bibliography ?? [];
    let y = CONTENT_TOP;

    if (bib.length) {
      doc.font('Helvetica').fontSize(9.5).fillColor(C.darkGray)
         .text('Este diagnóstico ha sido elaborado integrando datos de las siguientes fuentes oficiales, marcos regulatorios y reportes sectoriales:', ML, y, { width: CW, lineGap: 3 });
      y = doc.y + 20;

      for (const item of bib) {
        const title = item.title ?? 'Sin título';
        const source = item.source ?? 'Fuente no especificada';
        const year = item.year ? `(${item.year})` : '';
        const url = item.url ?? '';

        doc.font('Helvetica').fontSize(8.5);
        const h = doc.heightOfString(`${source}: ${title} ${year}`, { width: CW - 20, lineGap: 2 }) + (url ? 12 : 0) + 10;
        
        y = this.checkPageBreak(doc, y, h, d.orgName, 'FUENTES Y BIBLIOGRAFÍA (cont.)', '08');

        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.navy)
           .text(`${source}: `, ML, y, { continued: true })
           .font('Helvetica').fillColor(C.darkGray)
           .text(`${title} ${year}`, { width: CW - 20, lineGap: 2 });
        
        y = doc.y + 2;
        
        if (url) {
          doc.font('Helvetica').fontSize(8).fillColor(C.blue)
             .text(url, ML, y, { width: CW - 20, underline: true });
          y = doc.y + 6;
        } else {
          y = doc.y + 6;
        }
        
        y += 4;
      }
    } else {
      doc.font('Helvetica').fontSize(10).fillColor(C.gray)
         .text('No se han especificado fuentes bibliográficas para este reporte.', ML, y);
    }

    const boxY = FOOTER_Y - 80;
    doc.rect(ML, boxY, CW, 60).fill(C.offWhite);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
       .text('NOTA DE DESCARGO', ML + 15, boxY + 12);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gray)
       .text('La información contenida en este reporte proviene de modelos de lenguaje de gran escala (AI) entrenados con datos públicos. Se recomienda la validación de datos críticos antes de la toma de decisiones estratégicas de alto impacto.',
             ML + 15, boxY + 25, { width: CW - 30, lineGap: 2 });

    this.pageFooter(doc, d.orgName);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private pageHeader(doc: PdfDoc, title: string, num: string) {
    doc.rect(0, 0, PW, 56).fill(C.navy);
    doc.rect(0, 56, PW, 3).fill(C.orange);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
       .text(title, ML, 20, { width: CW - 40 });
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.5)')
       .text(num, PW - MR - 24, 24, { width: 24, align: 'right' });
  }

  private pageFooter(doc: PdfDoc, orgName: string) {
    doc.moveTo(ML, FOOTER_Y).lineTo(PW - MR, FOOTER_Y).lineWidth(0.5).strokeColor(C.lightGray).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gray)
       .text(orgName, ML, FOOTER_Y + 8, { width: CW / 2 });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.gray)
       .text('CONFIDENCIAL', PW - MR - 80, FOOTER_Y + 8, { width: 80, align: 'right' });
  }

  /** Draws an info box with exact height from text measurement. Returns bottom y. */
  private infoBox(doc: PdfDoc, label: string, text: string, startY: number): number {
    const PAD_TOP = 24;
    const PAD_BOTTOM = 12;
    doc.font('Helvetica').fontSize(9);
    const textH = doc.heightOfString(text, { width: CW - 28, lineGap: 3 });
    const h = PAD_TOP + textH + PAD_BOTTOM;

    doc.rect(ML, startY, CW, h).fill(C.offWhite);
    doc.rect(ML, startY, 4, h).fill(C.blue);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.blue)
       .text(label.toUpperCase(), ML + 14, startY + 9, { characterSpacing: 0.8, width: CW - 28 });
    doc.font('Helvetica').fontSize(9).fillColor(C.darkGray)
       .text(text, ML + 14, startY + PAD_TOP, { width: CW - 28, lineGap: 3 });

    return startY + h;
  }

  /** Renders a table block; returns y after last row. */
  private tableBlock(doc: PdfDoc, startY: number, headers: string[], widths: number[], rows: Record<string, any>[][], orgName: string, sectionNum: string): number {
    let y = startY;

    // Header row
    doc.rect(ML, y, CW, 22).fill(C.navy);
    let x = ML + 8;
    for (let i = 0; i < headers.length; i++) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
         .text(headers[i], x, y + 6, { width: widths[i] });
      x += widths[i];
    }
    y += 22;

    for (const row of rows) {
      // Calculate row height from tallest cell
      let maxH = 20;
      for (let i = 0; i < row.length; i++) {
        const val = String(row[i] ?? '');
        doc.font('Helvetica').fontSize(8.5);
        const cellH = doc.heightOfString(val, { width: widths[i] - 8 });
        maxH = Math.max(maxH, cellH + 14);
      }
      maxH = Math.max(maxH, 28);

      y = this.checkPageBreak(doc, y, maxH + 4, orgName, `(cont.)`, sectionNum);

      doc.rect(ML, y, CW, maxH).fill(C.offWhite);
      doc.moveTo(ML, y + maxH).lineTo(ML + CW, y + maxH).lineWidth(0.5).strokeColor(C.lightGray).stroke();

      x = ML + 8;
      for (let i = 0; i < row.length; i++) {
        const val = String(row[i] ?? '');
        doc.font('Helvetica').fontSize(8.5).fillColor(C.darkGray)
           .text(val, x, y + 7, { width: widths[i] - 8 });
        x += widths[i];
      }
      y += maxH;
    }

    return y;
  }

  /** Adds a new page if remaining space is insufficient. Returns safe y. */
  private checkPageBreak(doc: PdfDoc, y: number, neededH: number, orgName: string, title: string, num: string): number {
    if (y + neededH > FOOTER_Y - 10) {
      doc.addPage();
      this.pageHeader(doc, title, num);
      this.pageFooter(doc, orgName);
      return CONTENT_TOP;
    }
    return y;
  }
}


