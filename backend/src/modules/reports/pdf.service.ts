import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Browser, launch } from 'puppeteer';
import PptxGenJS from 'pptxgenjs';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }
    return this.browser;
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
      return Buffer.from(buffer);
    } finally {
      await page.close();
    }
  }

  buildExecutiveReportHtml(data: {
    orgName: string;
    cycleName: string;
    cycleStartDate?: string | null;
    cycleEndDate: string | null;
    score: number;
    avgProgress: number;
    totalObjectives: number;
    completedObjectives: number;
    atRisk: { kr_title: string; objective_title: string; level: string; confidence: number }[];
    objectives: { code: string | null; title: string; level: string; status: string; progress: number }[];
    agreementStats: { total: number; pending: number; in_progress: number; fulfilled: number; overdue: number };
    topInitiatives: { title: string; status: string; progress: number; owner_name: string | null }[];
    agreements?: { title: string; status: string; priority: string; owner_name: string | null; is_overdue: boolean; due_date: string | null; days_remaining: number | null }[];
    aiNarrative?: string;
    achievements?: string[];
    misses?: string[];
    learnings?: string[];
    nextCycleRecs?: string[];
  }): string {
    const { orgName, cycleName, cycleStartDate, score, avgProgress, totalObjectives, completedObjectives, atRisk, objectives, agreementStats, topInitiatives, agreements = [], aiNarrative, achievements = [], misses = [], learnings = [], nextCycleRecs = [] } = data;
    const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const cycleRange = cycleStartDate
      ? (() => {
          const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
          return `${fmt(cycleStartDate)} – ${data.cycleEndDate ? fmt(data.cycleEndDate) : 'activo'}`;
        })()
      : null;
    const scorePct = Math.round(score * 10);
    const scoreColor = score >= 7 ? '#16a34a' : score >= 5 ? '#d97706' : '#dc2626';
    const fulfillmentPct = agreementStats.total > 0 ? Math.round((agreementStats.fulfilled / agreementStats.total) * 100) : 0;

    const levelLabel = (l: string) =>
      l === 'COMPANY' ? 'Empresa' : l === 'AREA' ? 'Área' : l === 'TEAM' ? 'Equipo' : 'Individual';
    const statusLabel = (s: string) =>
      s === 'COMPLETED' ? 'Completado' : s === 'IN_PROGRESS' ? 'En curso' : s === 'ACTIVE' ? 'Activo' : s === 'AT_RISK' ? 'En riesgo' : s === 'OFF_TRACK' ? 'Desviado' : 'En curso';
    const statusColor = (s: string) =>
      s === 'COMPLETED' ? '#16a34a' : s === 'AT_RISK' ? '#dc2626' : s === 'OFF_TRACK' ? '#d97706' : '#2563eb';

    const progressBar = (pct: number, color: string, h = '7px') => `
      <div style="background:#e5e7eb;border-radius:4px;height:${h};overflow:hidden;width:100%">
        <div style="background:${color};height:100%;width:${Math.min(Math.max(pct, 0), 100)}%;border-radius:4px"></div>
      </div>`;

    const winCount = objectives.filter(o => o.status === 'COMPLETED').length;
    const winTitles = objectives.filter(o => o.status === 'COMPLETED').slice(0, 3).map(o => o.title);

    const objectiveRows = objectives.map(o => `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:7px 10px;font-size:10px;color:#6b7280">${levelLabel(o.level)}</td>
        <td style="padding:7px 10px;font-size:11px;color:#111827">${o.code ? `<span style="font-size:9px;color:#9ca3af;margin-right:4px">${o.code}</span>` : ''}${o.title}</td>
        <td style="padding:7px 10px;min-width:110px">
          ${progressBar(o.progress, statusColor(o.status))}
          <span style="font-size:9px;color:#6b7280">${Math.round(o.progress)}%</span>
        </td>
        <td style="padding:7px 10px;text-align:center">
          <span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:600;
            background:${statusColor(o.status)}1a;color:${statusColor(o.status)}">
            ${statusLabel(o.status)}
          </span>
        </td>
      </tr>`).join('');

    const atRiskRows = atRisk.map(kr => `
      <tr style="border-bottom:1px solid #fef2f2">
        <td style="padding:7px 10px;font-size:10px;color:#6b7280">${levelLabel(kr.level)}</td>
        <td style="padding:7px 10px;font-size:11px;color:#111827">${kr.kr_title}</td>
        <td style="padding:7px 10px;font-size:10px;color:#6b7280">${kr.objective_title}</td>
        <td style="padding:7px 10px;text-align:center">
          <span style="font-size:10px;font-weight:700;color:#dc2626">${Math.round(Number(kr.confidence) * 100)}%</span>
        </td>
      </tr>`).join('');

    const initiativeRows = topInitiatives.map(i => `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:7px 10px;font-size:11px;color:#111827">${i.title}</td>
        <td style="padding:7px 10px;font-size:10px;color:#6b7280">${i.owner_name ?? '—'}</td>
        <td style="padding:7px 10px;min-width:100px">
          ${progressBar(i.progress, '#059669')}
          <span style="font-size:9px;color:#6b7280">${i.progress}%</span>
        </td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; }
  @page { size: A4; margin: 0; }
  .section { padding: 20px 44px; }
  .section-title { font-size:13px;font-weight:700;color:#111827;margin-bottom:14px;display:flex;align-items:center;gap:8px; }
  .section-title span { display:inline-block;width:3px;height:15px;border-radius:2px; }
  table { width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden; }
  thead tr { background:#f9fafb; }
  th { padding:9px 10px;text-align:left;font-size:10px;color:#6b7280;font-weight:600; }
</style>
</head>
<body>

<!-- ── Header ── -->
<div style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%);padding:32px 44px 28px;color:#fff">
  <div style="display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;opacity:.6;margin-bottom:6px">Reporte Ejecutivo · OKR System</div>
      ${orgName ? `<div style="font-size:14px;font-weight:600;opacity:.85;margin-bottom:3px">${orgName}</div>` : ''}
      <h1 style="font-size:26px;font-weight:800;margin-bottom:3px;letter-spacing:-.3px">${cycleName}</h1>
      <div style="font-size:11px;opacity:.6">${cycleRange ? `${cycleRange}  ·  ` : ''}Generado el ${date}</div>
    </div>
    <div style="text-align:right;background:rgba(255,255,255,.12);border-radius:12px;padding:16px 20px;min-width:110px">
      <div style="font-size:10px;opacity:.7;margin-bottom:2px;text-transform:uppercase;letter-spacing:1px">Score</div>
      <div style="font-size:44px;font-weight:900;line-height:1;color:#fff">${Number(score).toFixed(1)}</div>
      <div style="font-size:11px;opacity:.5">/ 10.0</div>
      <div style="margin-top:8px;height:4px;background:rgba(255,255,255,.25);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${scorePct}%;background:#fff;border-radius:3px"></div>
      </div>
    </div>
  </div>
</div>

<!-- ── KPI row ── -->
<div style="display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid #e5e7eb">
  ${[
    { label: 'Progreso',       value: `${Math.round(avgProgress)}%`,         color: '#1d4ed8', bar: true,  pct: avgProgress },
    { label: 'Objetivos',      value: String(totalObjectives),                color: '#7c3aed', bar: false, pct: 0 },
    { label: 'Completados',    value: String(completedObjectives),            color: '#16a34a', bar: false, pct: 0 },
    { label: 'En riesgo',      value: String(atRisk.length),                  color: atRisk.length > 0 ? '#dc2626' : '#16a34a', bar: false, pct: 0 },
    { label: 'Acuerdos',       value: String(agreementStats.total),          color: '#0891b2', bar: false, pct: 0 },
    { label: 'Cumplidos',      value: `${fulfillmentPct}%`,                  color: agreementStats.overdue > 0 ? '#d97706' : '#16a34a', bar: false, pct: 0 },
  ].map((m, i) => `
    <div style="padding:16px 14px;${i < 5 ? 'border-right:1px solid #e5e7eb;' : ''}text-align:center">
      <div style="font-size:24px;font-weight:800;color:${m.color};line-height:1;margin-bottom:${m.bar ? '8px' : '4px'}">${m.value}</div>
      ${m.bar ? progressBar(m.pct, m.color, '5px') : ''}
      <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">${m.label}</div>
    </div>`).join('')}
</div>

${winCount > 0 ? `
<!-- ── Victorias ── -->
<div class="section" style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding-top:16px;padding-bottom:16px">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <span style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1px;white-space:nowrap">✓ ${winCount} objetivo${winCount !== 1 ? 's' : ''} completado${winCount !== 1 ? 's' : ''}</span>
    ${winTitles.map(t => `<span style="font-size:10px;color:#166534;background:#dcfce7;padding:2px 10px;border-radius:10px">${t}</span>`).join('')}
    ${winCount > 3 ? `<span style="font-size:10px;color:#6b7280">+${winCount - 3} más</span>` : ''}
  </div>
</div>` : ''}

${aiNarrative ? `
<!-- ── Resumen IA ── -->
<div class="section" style="padding-top:20px;padding-bottom:20px;background:#eff6ff;border-bottom:1px solid #bfdbfe">
  <div style="display:flex;align-items:flex-start;gap:12px">
    <div style="font-size:18px;line-height:1;padding-top:1px">🤖</div>
    <div>
      <div style="font-size:9px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Resumen ejecutivo · Análisis IA</div>
      <p style="font-size:12px;color:#1e3a8a;line-height:1.65;margin:0">${aiNarrative}</p>
    </div>
  </div>
</div>` : ''}

${(achievements.length > 0 || misses.length > 0 || learnings.length > 0) ? `
<!-- ── Logros / Misses / Learnings ── -->
<div class="section" style="padding-top:18px;padding-bottom:18px">
  <div class="section-title"><span style="background:#059669"></span>Análisis del ciclo</div>
  <div style="display:grid;grid-template-columns:${[achievements.length, misses.length, learnings.length].filter(Boolean).length === 3 ? '1fr 1fr 1fr' : [achievements.length, misses.length, learnings.length].filter(Boolean).length === 2 ? '1fr 1fr' : '1fr'};gap:12px">
    ${achievements.length > 0 ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px">
      <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">✅ Logros destacados</div>
      ${achievements.slice(0, 4).map(a => `<div style="font-size:11px;color:#166534;margin-bottom:6px;padding-left:10px;border-left:2px solid #4ade80;line-height:1.4">${a}</div>`).join('')}
    </div>` : ''}
    ${misses.length > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px">
      <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">⚠️ No se cumplió</div>
      ${misses.slice(0, 4).map(m => `<div style="font-size:11px;color:#78350f;margin-bottom:6px;padding-left:10px;border-left:2px solid #fbbf24;line-height:1.4">${m}</div>`).join('')}
    </div>` : ''}
    ${learnings.length > 0 ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px">
      <div style="font-size:10px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💡 Aprendizajes</div>
      ${learnings.slice(0, 4).map(l => `<div style="font-size:11px;color:#1e3a8a;margin-bottom:6px;padding-left:10px;border-left:2px solid #60a5fa;line-height:1.4">${l}</div>`).join('')}
    </div>` : ''}
  </div>
</div>` : ''}

${nextCycleRecs.length > 0 ? `
<!-- ── Recomendaciones próximo ciclo ── -->
<div class="section" style="padding-top:0;padding-bottom:18px">
  <div class="section-title"><span style="background:#7c3aed"></span>Recomendaciones para el próximo ciclo</div>
  <div style="display:grid;grid-template-columns:repeat(${Math.min(nextCycleRecs.length, 3)},1fr);gap:10px">
    ${nextCycleRecs.slice(0, 3).map((r, i) => `
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:20px;height:20px;border-radius:50%;background:#7c3aed;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</span>
        <span style="font-size:9px;font-weight:700;color:#5b21b6;text-transform:uppercase;letter-spacing:.5px">Recomendación</span>
      </div>
      <p style="font-size:11px;color:#3b0764;line-height:1.5;margin:0">${r}</p>
    </div>`).join('')}
  </div>
</div>` : ''}

<!-- ── Objetivos ── -->
<div class="section">
  <div class="section-title"><span style="background:#1d4ed8"></span>Objetivos del ciclo</div>
  <table>
    <thead><tr>
      <th style="width:70px">Nivel</th><th>Objetivo</th>
      <th style="width:130px">Progreso</th><th style="width:90px;text-align:center">Estado</th>
    </tr></thead>
    <tbody>${objectiveRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;font-size:11px">Sin objetivos registrados</td></tr>'}</tbody>
  </table>
</div>

${topInitiatives.length > 0 ? `
<!-- ── Iniciativas ── -->
<div class="section" style="padding-top:0">
  <div class="section-title"><span style="background:#059669"></span>Iniciativas estratégicas</div>
  <table>
    <thead><tr><th>Iniciativa</th><th style="width:140px">Responsable</th><th style="width:130px">Progreso</th></tr></thead>
    <tbody>${initiativeRows}</tbody>
  </table>
</div>` : ''}

${agreementStats.total > 0 ? `
<!-- ── Acuerdos del comité ── -->
<div class="section" style="padding-top:0">
  <div class="section-title"><span style="background:#0891b2"></span>Compromisos del comité</div>
  <!-- Resumen -->
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
    ${[
      { label: 'Vigentes', value: agreementStats.pending + agreementStats.in_progress, color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Cumplidos', value: agreementStats.fulfilled, color: '#16a34a', bg: '#f0fdf4' },
      { label: 'Vencidos', value: agreementStats.overdue, color: '#dc2626', bg: '#fef2f2' },
    ].map(s => `
      <div style="flex:1;min-width:80px;padding:10px 12px;border-radius:8px;background:${s.bg};text-align:center">
        <div style="font-size:24px;font-weight:800;color:${s.color};line-height:1">${s.value}</div>
        <div style="font-size:9px;color:#6b7280;margin-top:3px;text-transform:uppercase;letter-spacing:.5px">${s.label}</div>
      </div>`).join('')}
    <div style="flex:2;min-width:140px;padding:10px 14px;border-radius:8px;background:#f9fafb;display:flex;flex-direction:column;justify-content:center;gap:5px">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Tasa de cumplimiento</div>
      ${progressBar(fulfillmentPct, fulfillmentPct >= 70 ? '#16a34a' : fulfillmentPct >= 40 ? '#d97706' : '#dc2626', '8px')}
      <div style="font-size:13px;font-weight:700;color:${fulfillmentPct >= 70 ? '#16a34a' : '#d97706'}">${fulfillmentPct}%</div>
    </div>
  </div>
  ${agreements.length > 0 ? `
  <!-- Detalle individual -->
  <table>
    <thead><tr>
      <th>Acuerdo</th>
      <th style="width:130px">Responsable</th>
      <th style="width:75px;text-align:center">Prioridad</th>
      <th style="width:90px;text-align:center">Estado</th>
    </tr></thead>
    <tbody>
      ${agreements.map(a => {
        const SC: Record<string, string> = { FULFILLED: '#16a34a', CANCELLED: '#6b7280', PENDING: '#1d4ed8', IN_PROGRESS: '#0891b2' };
        const SL: Record<string, string> = { FULFILLED: 'Cumplido', PENDING: 'Pendiente', IN_PROGRESS: 'En curso', CANCELLED: 'Cancelado' };
        const PC: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#9ca3af' };
        const PL: Record<string, string> = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
        const sc = a.is_overdue ? '#dc2626' : (SC[a.status] ?? '#6b7280');
        const sl = a.is_overdue ? 'Vencido' : (SL[a.status] ?? a.status);
        const pc = PC[a.priority] ?? '#9ca3af';
        const pl = PL[a.priority] ?? a.priority;
        return `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:7px 10px;font-size:11px;color:#111827">${a.title}${a.due_date ? `<span style="font-size:9px;color:#9ca3af;margin-left:6px">${a.due_date}</span>` : ''}</td>
          <td style="padding:7px 10px;font-size:10px;color:#6b7280">${a.owner_name ?? '—'}</td>
          <td style="padding:7px 10px;text-align:center"><span style="font-size:9px;font-weight:600;color:${pc}">● ${pl}</span></td>
          <td style="padding:7px 10px;text-align:center">
            <span style="display:inline-block;padding:2px 6px;border-radius:8px;font-size:9px;font-weight:600;background:${sc}1a;color:${sc}">${sl}</span>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : ''}
</div>` : ''}

${atRisk.length > 0 ? `
<!-- ── KRs en riesgo ── -->
<div class="section" style="padding-top:0">
  <div class="section-title"><span style="background:#dc2626"></span>KRs que requieren atención (${atRisk.length})</div>
  <table style="border:1px solid #fecaca">
    <thead><tr style="background:#fef2f2">
      <th style="color:#991b1b;width:70px">Nivel</th>
      <th style="color:#991b1b">Key Result</th>
      <th style="color:#991b1b">Objetivo asociado</th>
      <th style="color:#991b1b;width:75px;text-align:center">Confianza</th>
    </tr></thead>
    <tbody>${atRiskRows}</tbody>
  </table>
</div>` : ''}

<!-- ── Footer ── -->
<div style="padding:14px 44px;background:#f9fafb;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
  <span style="font-size:9px;color:#9ca3af">OKR System · Documento confidencial · Uso interno</span>
  <span style="font-size:9px;color:#9ca3af">${date}${orgName ? ` · ${orgName}` : ''}</span>
</div>
</body>
</html>`;
  }

  buildGovernancePdfHtml(data: {
    horizonLabel: string;
    events: { event_type: string; title: string; responsible: string | null; scheduled_date: string; due_date: string | null; status: string; cycle_name: string | null }[];
  }): string {
    const { horizonLabel, events } = data;
    const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    const STATUS_LABELS: Record<string, string> = {
      COMPLETED: 'Completado', IN_PROGRESS: 'En curso', UPCOMING: 'Próximo', OVERDUE: 'Vencido',
    };
    const STATUS_COLORS: Record<string, string> = {
      COMPLETED: '#16a34a', IN_PROGRESS: '#2563eb', UPCOMING: '#6b7280', OVERDUE: '#dc2626',
    };
    const EVENT_LABELS: Record<string, string> = {
      KICKOFF: 'Arranque', REVIEW: 'Revisión', RETROSPECTIVE: 'Retrospectiva', STRATEGY_REVIEW: 'Rev. Estratégica', CUSTOM: 'Personalizado',
    };

    // Group by month
    const byMonth = new Map<string, typeof events>();
    for (const ev of events) {
      const key = ev.scheduled_date?.toString().slice(0, 7) ?? 'unknown';
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(ev);
    }

    const monthSections = Array.from(byMonth.entries()).map(([key, evs]) => {
      const d = new Date(key + '-01T00:00:00');
      const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

      const rows = evs.map(ev => {
        const sc = STATUS_COLORS[ev.status] ?? '#6b7280';
        const sl = STATUS_LABELS[ev.status] ?? ev.status;
        const el = EVENT_LABELS[ev.event_type] ?? ev.event_type;
        return `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:8px 12px">
            <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;background:${sc}1a;color:${sc}">${el}</span>
          </td>
          <td style="padding:8px 12px;font-size:12px;color:#111827">${ev.title}</td>
          <td style="padding:8px 12px;font-size:11px;color:#6b7280">${ev.responsible ?? '—'}</td>
          <td style="padding:8px 12px;font-size:11px;color:#6b7280">${ev.scheduled_date?.toString().slice(0, 10) ?? ''}</td>
          <td style="padding:8px 12px;text-align:center">
            <span style="font-size:10px;font-weight:600;color:${sc}">${sl}</span>
          </td>
        </tr>`;
      }).join('');

      return `
      <div style="margin-bottom:24px">
        <h2 style="font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb">
          ${label}
        </h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280;font-weight:600;width:110px">Tipo</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280;font-weight:600">Evento</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280;font-weight:600;width:140px">Responsable</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6b7280;font-weight:600;width:100px">Fecha</th>
              <th style="padding:8px 12px;text-align:center;font-size:10px;color:#6b7280;font-weight:600;width:90px">Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; padding: 0 40px 80px; }
</style>
</head>
<body>
<div style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:28px 0 24px;color:#fff;margin:0 -40px 28px">
  <div style="padding:0 40px;display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-bottom:6px">Gobierno OKR</div>
      <h1 style="font-size:24px;font-weight:700">Horizonte ${horizonLabel}</h1>
    </div>
    <div style="font-size:11px;opacity:.75">${date}</div>
  </div>
</div>

<div style="margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap">
  ${Object.entries(STATUS_LABELS).map(([k, v]) => `
    <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#374151">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${STATUS_COLORS[k]}"></span>${v}
    </span>`).join('')}
</div>

${monthSections || '<p style="color:#9ca3af;text-align:center;padding:32px">Sin eventos para este horizonte</p>'}
</body>
</html>`;
  }

  async buildExecutivePptx(data: {
    orgName: string;
    cycleName: string;
    cycleStartDate?: string | null;
    cycleEndDate?: string | null;
    score: number;
    avgProgress: number;
    totalObjectives: number;
    completedObjectives: number;
    atRisk: { kr_title: string; objective_title: string; level: string; confidence: number }[];
    objectives: { code: string | null; title: string; level: string; status: string; progress: number }[];
    agreementStats: { total: number; pending: number; in_progress: number; fulfilled: number; overdue: number };
    topInitiatives: { title: string; status: string; progress: number; owner_name: string | null }[];
    agreements?: { title: string; status: string; priority: string; owner_name: string | null; is_overdue: boolean; due_date: string | null; days_remaining: number | null }[];
    aiNarrative?: string;
    achievements?: string[];
    misses?: string[];
    learnings?: string[];
    nextCycleRecs?: string[];
  }): Promise<Buffer> {
    const { agreements = [], aiNarrative, achievements = [], misses = [], learnings = [], nextCycleRecs = [] } = data;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.defineLayout({ name: 'WIDESCREEN', width: 13.33, height: 7.5 });

    const BLUE      = '2563EB';
    const DARK_BLUE = '1E40AF';
    const GRAY      = '6B7280';
    const WHITE     = 'FFFFFF';
    const RED       = 'DC2626';
    const GREEN     = '16A34A';
    const AMBER     = 'D97706';
    const CYAN      = '0891B2';
    const BG        = 'F9FAFB';

    const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const scoreColor = data.score >= 7 ? GREEN : data.score >= 5 ? AMBER : RED;
    const fulfillmentPct = data.agreementStats.total > 0
      ? Math.round((data.agreementStats.fulfilled / data.agreementStats.total) * 100) : 0;
    const levelLabel = (l: string) =>
      l === 'COMPANY' ? 'Empresa' : l === 'AREA' ? 'Área' : l === 'TEAM' ? 'Equipo' : 'Individual';
    const statusLabel = (s: string) =>
      s === 'COMPLETED' ? 'Completado' : s === 'AT_RISK' ? 'En riesgo' : s === 'OFF_TRACK' ? 'Desviado' : 'En curso';

    // ── Slide 1: Title ─────────────────────────────────────────────────────────
    const slide1 = pptx.addSlide();
    slide1.background = { color: DARK_BLUE };
    slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { type: 'solid', color: DARK_BLUE } });
    slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 5.5, w: 13.33, h: 2, fill: { type: 'solid', color: BLUE } });
    slide1.addText('REPORTE EJECUTIVO OKR', { x: 0.6, y: 0.8, w: 10, h: 0.5, fontSize: 14, color: 'BFDBFE', bold: false, charSpacing: 3 });
    if (data.orgName) {
      slide1.addText(data.orgName, { x: 0.6, y: 1.4, w: 10, h: 0.5, fontSize: 18, color: '93C5FD', bold: true });
    }
    slide1.addText(data.cycleName, { x: 0.6, y: 2.0, w: 10, h: 1.0, fontSize: 36, color: WHITE, bold: true });
    if (data.cycleStartDate && data.cycleEndDate) {
      const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      slide1.addText(`${fmt(data.cycleStartDate)}  —  ${fmt(data.cycleEndDate)}`, { x: 0.6, y: 3.1, w: 11, h: 0.4, fontSize: 14, color: '93C5FD' });
    }
    slide1.addText(`Generado el ${date}`, { x: 0.6, y: 3.6, w: 8, h: 0.35, fontSize: 13, color: '60A5FA' });
    // Score box bottom-right
    slide1.addShape(pptx.ShapeType.rect, { x: 10.8, y: 1.3, w: 2.0, h: 2.2, fill: { type: 'solid', color: '1E40AF' }, line: { color: '3B82F6', width: 1 } });
    slide1.addText('Score', { x: 10.8, y: 1.4, w: 2.0, h: 0.35, fontSize: 11, color: '93C5FD', align: 'center' });
    slide1.addText(Number(data.score).toFixed(1), { x: 10.8, y: 1.75, w: 2.0, h: 0.95, fontSize: 44, bold: true, color: WHITE, align: 'center' });
    slide1.addText('/ 10', { x: 10.8, y: 2.75, w: 2.0, h: 0.35, fontSize: 13, color: '93C5FD', align: 'center' });

    // ── Slide 2: Key metrics ───────────────────────────────────────────────────
    const slide2 = pptx.addSlide();
    slide2.background = { color: BG };
    slide2.addText('Resumen del ciclo', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 22, bold: true, color: '111827' });
    slide2.addText(data.cycleName, { x: 0.5, y: 0.85, w: 12, h: 0.35, fontSize: 13, color: GRAY });

    const metrics = [
      { label: 'Score',        value: `${Number(data.score).toFixed(1)}/10`, color: scoreColor, x: 0.5 },
      { label: 'Progreso',     value: `${Math.round(data.avgProgress)}%`,   color: BLUE,       x: 3.1 },
      { label: 'Objetivos',    value: String(data.totalObjectives),          color: '7C3AED',   x: 5.7 },
      { label: 'Completados',  value: String(data.completedObjectives),      color: GREEN,      x: 8.3 },
      { label: 'Acuerdos',     value: String(data.agreementStats.total),     color: CYAN,       x: 10.9 },
    ];
    for (const m of metrics) {
      slide2.addShape(pptx.ShapeType.rect, { x: m.x, y: 1.4, w: 2.3, h: 1.8, fill: { type: 'solid', color: WHITE }, line: { color: 'E5E7EB', width: 1 } });
      slide2.addText(m.value, { x: m.x + 0.1, y: 1.55, w: 2.1, h: 0.85, fontSize: 32, bold: true, color: m.color });
      slide2.addText(m.label, { x: m.x + 0.1, y: 2.5, w: 2.1, h: 0.35, fontSize: 10, color: GRAY });
    }

    // Progress bar
    slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.6, w: 12.33, h: 0.18, fill: { type: 'solid', color: 'E5E7EB' } });
    const barW = Math.max(0.1, (data.avgProgress / 100) * 12.33);
    slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.6, w: barW, h: 0.18, fill: { type: 'solid', color: BLUE } });
    slide2.addText(`Progreso promedio del ciclo: ${Math.round(data.avgProgress)}%`, { x: 0.5, y: 3.9, w: 12, h: 0.35, fontSize: 12, color: GRAY });

    // Agreements fulfillment bar
    if (data.agreementStats.total > 0) {
      const fulfBarW = Math.max(0.1, (fulfillmentPct / 100) * 12.33);
      slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.5, w: 12.33, h: 0.18, fill: { type: 'solid', color: 'E5E7EB' } });
      slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.5, w: fulfBarW, h: 0.18, fill: { type: 'solid', color: fulfillmentPct >= 70 ? GREEN : AMBER } });
      slide2.addText(`Cumplimiento de acuerdos: ${fulfillmentPct}%  ·  ${data.agreementStats.overdue} vencidos`, { x: 0.5, y: 4.8, w: 12, h: 0.35, fontSize: 12, color: GRAY });
    }

    // AI narrative box (bottom of slide 2)
    if (aiNarrative) {
      slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 5.4, w: 12.33, h: 1.7, fill: { type: 'solid', color: 'EFF6FF' }, line: { color: 'BFDBFE', width: 1 } });
      slide2.addText('🤖  Análisis IA', { x: 0.65, y: 5.5, w: 11.8, h: 0.3, fontSize: 10, bold: true, color: '1D4ED8' });
      slide2.addText(aiNarrative.slice(0, 350), { x: 0.65, y: 5.85, w: 11.8, h: 1.1, fontSize: 11, color: '1E3A8A', wrap: true });
    }

    // ── Slide 3: Objectives ────────────────────────────────────────────────────
    const slide3 = pptx.addSlide();
    slide3.background = { color: WHITE };
    slide3.addText('Objetivos del ciclo', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 22, bold: true, color: '111827' });

    const objRows = data.objectives.slice(0, 12);
    const rowH = 0.42;
    const tableData = [
      [
        { text: 'Nivel',      options: { bold: true, fontSize: 10, color: GRAY } },
        { text: 'Objetivo',   options: { bold: true, fontSize: 10, color: GRAY } },
        { text: 'Progreso',   options: { bold: true, fontSize: 10, color: GRAY } },
        { text: 'Estado',     options: { bold: true, fontSize: 10, color: GRAY } },
      ],
      ...objRows.map(o => [
        { text: levelLabel(o.level),          options: { fontSize: 9, color: GRAY } },
        { text: o.title,                      options: { fontSize: 9, color: '111827' } },
        { text: `${Math.round(o.progress)}%`, options: { fontSize: 9, bold: true, color: BLUE } },
        { text: statusLabel(o.status),        options: { fontSize: 9, color: o.status === 'AT_RISK' ? RED : o.status === 'COMPLETED' ? GREEN : '111827' } },
      ]),
    ];
    slide3.addTable(tableData as Parameters<typeof slide3.addTable>[0], {
      x: 0.5, y: 1.0, w: 12.33, rowH,
      border: { type: 'solid', color: 'E5E7EB', pt: 1 },
      fill: { color: WHITE },
      colW: [1.5, 6.5, 1.5, 2.0],
    });

    // ── Slide 4: Logros / Misses / Learnings (IA) ────────────────────────────
    if (achievements.length > 0 || misses.length > 0 || learnings.length > 0) {
      const slide4ai = pptx.addSlide();
      slide4ai.background = { color: 'FAFAFA' };
      slide4ai.addText('Análisis del ciclo', { x: 0.5, y: 0.25, w: 12, h: 0.5, fontSize: 22, bold: true, color: '111827' });
      slide4ai.addText(data.cycleName, { x: 0.5, y: 0.78, w: 12, h: 0.3, fontSize: 12, color: GRAY });

      const cols = [
        { items: achievements.slice(0, 4), title: '✅  Logros destacados', bg: 'F0FDF4', border: 'BBF7D0', titleColor: '15803D', textColor: '166534' },
        { items: misses.slice(0, 4),       title: '⚠️  No se cumplió',    bg: 'FFFBEB', border: 'FDE68A', titleColor: '92400E', textColor: '78350F' },
        { items: learnings.slice(0, 4),    title: '💡  Aprendizajes',     bg: 'EFF6FF', border: 'BFDBFE', titleColor: '1D4ED8', textColor: '1E3A8A' },
      ].filter(c => c.items.length > 0);

      const colW = 12.33 / cols.length;
      cols.forEach((col, ci) => {
        const x = 0.5 + ci * colW;
        slide4ai.addShape(pptx.ShapeType.rect, { x, y: 1.25, w: colW - 0.15, h: 5.9, fill: { type: 'solid', color: col.bg }, line: { color: col.border, width: 1 } });
        slide4ai.addText(col.title, { x: x + 0.15, y: 1.4, w: colW - 0.4, h: 0.4, fontSize: 11, bold: true, color: col.titleColor });
        col.items.forEach((item, ii) => {
          slide4ai.addShape(pptx.ShapeType.rect, { x: x + 0.15, y: 1.95 + ii * 1.15, w: 0.04, h: 0.6, fill: { type: 'solid', color: col.border } });
          slide4ai.addText(item.slice(0, 120), { x: x + 0.3, y: 1.95 + ii * 1.15, w: colW - 0.55, h: 1.0, fontSize: 10, color: col.textColor, wrap: true });
        });
      });
    }

    // ── Slide 5: Recomendaciones próximo ciclo ────────────────────────────────
    if (nextCycleRecs.length > 0) {
      const slide5rec = pptx.addSlide();
      slide5rec.background = { color: 'F5F3FF' };
      slide5rec.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { type: 'solid', color: '7C3AED' } });
      slide5rec.addText('Recomendaciones para el próximo ciclo', { x: 0.5, y: 0.28, w: 12, h: 0.55, fontSize: 22, bold: true, color: '4C1D95' });
      slide5rec.addText(data.cycleName, { x: 0.5, y: 0.85, w: 12, h: 0.3, fontSize: 12, color: '7C3AED' });

      nextCycleRecs.slice(0, 4).forEach((rec, i) => {
        const y = 1.4 + i * 1.45;
        slide5rec.addShape(pptx.ShapeType.rect, { x: 0.5, y, w: 12.33, h: 1.25, fill: { type: 'solid', color: 'EDE9FE' }, line: { color: 'DDD6FE', width: 1 } });
        slide5rec.addShape(pptx.ShapeType.ellipse, { x: 0.6, y: y + 0.25, w: 0.55, h: 0.55, fill: { type: 'solid', color: '7C3AED' } });
        slide5rec.addText(String(i + 1), { x: 0.6, y: y + 0.25, w: 0.55, h: 0.55, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle' });
        slide5rec.addText(rec.slice(0, 200), { x: 1.35, y: y + 0.18, w: 11.1, h: 1.0, fontSize: 12, color: '3B0764', wrap: true });
      });
    }

    // ── Slide 6: Initiatives ───────────────────────────────────────────────────
    if (data.topInitiatives.length > 0) {
      const slide4 = pptx.addSlide();
      slide4.background = { color: 'F0FDF4' };
      slide4.addText('Iniciativas estratégicas', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 22, bold: true, color: '15803D' });
      slide4.addText(`Top ${data.topInitiatives.length} iniciativas activas`, { x: 0.5, y: 0.85, w: 12, h: 0.3, fontSize: 13, color: GRAY });

      const initData = [
        [
          { text: 'Iniciativa',   options: { bold: true, fontSize: 10, color: '15803D' } },
          { text: 'Responsable',  options: { bold: true, fontSize: 10, color: '15803D' } },
          { text: 'Progreso',     options: { bold: true, fontSize: 10, color: '15803D' } },
          { text: 'Estado',       options: { bold: true, fontSize: 10, color: '15803D' } },
        ],
        ...data.topInitiatives.map(i => [
          { text: i.title,                      options: { fontSize: 9, color: '111827' } },
          { text: i.owner_name ?? '—',          options: { fontSize: 9, color: GRAY } },
          { text: `${i.progress}%`,             options: { fontSize: 9, bold: true, color: GREEN } },
          { text: i.status,                     options: { fontSize: 9, color: GRAY } },
        ]),
      ];
      slide4.addTable(initData as Parameters<typeof slide4.addTable>[0], {
        x: 0.5, y: 1.3, w: 12.33, rowH: 0.42,
        border: { type: 'solid', color: 'BBF7D0', pt: 1 },
        fill: { color: WHITE },
        colW: [5.5, 2.5, 1.5, 2.33],
      });
    }

    // ── Slide 7: Agreements ────────────────────────────────────────────────────
    if (data.agreementStats.total > 0) {
      const slide7 = pptx.addSlide();
      slide7.background = { color: 'EFF6FF' };
      slide7.addText('Compromisos del comité', { x: 0.5, y: 0.25, w: 12, h: 0.5, fontSize: 22, bold: true, color: '1D4ED8' });
      slide7.addText(`${data.agreementStats.total} acuerdos · cumplimiento ${fulfillmentPct}%`, { x: 0.5, y: 0.78, w: 12, h: 0.3, fontSize: 12, color: GRAY });

      // Compact KPI row
      const agrKpis = [
        { label: 'Vigentes',  value: String(data.agreementStats.pending + data.agreementStats.in_progress), color: BLUE },
        { label: 'Cumplidos', value: String(data.agreementStats.fulfilled),  color: GREEN },
        { label: 'Vencidos',  value: String(data.agreementStats.overdue),    color: RED },
        { label: 'Cumplimiento', value: `${fulfillmentPct}%`,                color: fulfillmentPct >= 70 ? GREEN : AMBER },
      ];
      agrKpis.forEach((k, ki) => {
        const kx = 0.5 + ki * 3.1;
        slide7.addShape(pptx.ShapeType.rect, { x: kx, y: 1.2, w: 2.9, h: 1.4, fill: { type: 'solid', color: WHITE }, line: { color: 'DBEAFE', width: 1 } });
        slide7.addText(k.value, { x: kx + 0.1, y: 1.3, w: 2.7, h: 0.75, fontSize: 34, bold: true, color: k.color, align: 'center' });
        slide7.addText(k.label, { x: kx + 0.1, y: 2.1, w: 2.7, h: 0.3, fontSize: 10, color: GRAY, align: 'center' });
      });

      if (agreements.length > 0) {
        // Individual agreements table
        const SCOLOR: Record<string, string> = { FULFILLED: GREEN, PENDING: BLUE, IN_PROGRESS: CYAN, CANCELLED: GRAY };
        const SLABEL: Record<string, string> = { FULFILLED: 'Cumplido', PENDING: 'Pendiente', IN_PROGRESS: 'En curso', CANCELLED: 'Cancelado' };
        const PLABEL: Record<string, string> = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
        const agrTableData = [
          [
            { text: 'Acuerdo',     options: { bold: true, fontSize: 9, color: '1D4ED8' } },
            { text: 'Responsable', options: { bold: true, fontSize: 9, color: '1D4ED8' } },
            { text: 'Prioridad',   options: { bold: true, fontSize: 9, color: '1D4ED8' } },
            { text: 'Estado',      options: { bold: true, fontSize: 9, color: '1D4ED8' } },
          ],
          ...agreements.slice(0, 8).map(a => {
            const sc = a.is_overdue ? RED : (SCOLOR[a.status] ?? GRAY);
            const sl = a.is_overdue ? 'Vencido' : (SLABEL[a.status] ?? a.status);
            return [
              { text: a.title.slice(0, 55),           options: { fontSize: 9, color: '111827' } },
              { text: a.owner_name ?? '—',             options: { fontSize: 9, color: GRAY } },
              { text: PLABEL[a.priority] ?? a.priority, options: { fontSize: 9, color: GRAY } },
              { text: sl,                              options: { fontSize: 9, bold: true, color: sc } },
            ];
          }),
        ];
        slide7.addTable(agrTableData as Parameters<typeof slide7.addTable>[0], {
          x: 0.5, y: 2.8, w: 12.33, rowH: 0.38,
          border: { type: 'solid', color: 'DBEAFE', pt: 1 },
          fill: { color: WHITE },
          colW: [6.5, 2.2, 1.5, 1.83],
        });
      } else {
        // Fallback: fulfillment bar only
        const fulfBarW7 = Math.max(0.1, (fulfillmentPct / 100) * 12.33);
        slide7.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.2, w: 12.33, h: 0.28, fill: { type: 'solid', color: 'DBEAFE' } });
        slide7.addShape(pptx.ShapeType.rect, { x: 0.5, y: 3.2, w: fulfBarW7, h: 0.28, fill: { type: 'solid', color: fulfillmentPct >= 70 ? GREEN : AMBER } });
        slide7.addText(`Tasa de cumplimiento: ${fulfillmentPct}%`, { x: 0.5, y: 3.6, w: 12, h: 0.4, fontSize: 14, bold: true, color: fulfillmentPct >= 70 ? GREEN : AMBER });
      }
    }

    // ── Slide 6: At-risk ───────────────────────────────────────────────────────
    if (data.atRisk.length > 0) {
      const slide6 = pptx.addSlide();
      slide6.background = { color: 'FFF5F5' };
      slide6.addText('KRs en riesgo', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 22, bold: true, color: RED });
      slide6.addText(`${data.atRisk.length} Key Results requieren atención`, { x: 0.5, y: 0.85, w: 12, h: 0.3, fontSize: 13, color: GRAY });

      const riskData = [
        [
          { text: 'Nivel',         options: { bold: true, fontSize: 10, color: RED } },
          { text: 'Key Result',    options: { bold: true, fontSize: 10, color: RED } },
          { text: 'Objetivo',      options: { bold: true, fontSize: 10, color: RED } },
          { text: 'Confianza',     options: { bold: true, fontSize: 10, color: RED } },
        ],
        ...data.atRisk.slice(0, 12).map(kr => [
          { text: levelLabel(kr.level),                            options: { fontSize: 9, color: GRAY } },
          { text: kr.kr_title,                                     options: { fontSize: 9, color: '111827' } },
          { text: kr.objective_title,                              options: { fontSize: 9, color: GRAY } },
          { text: `${Math.round(Number(kr.confidence) * 100)}%`,  options: { fontSize: 9, bold: true, color: RED } },
        ]),
      ];
      slide6.addTable(riskData as Parameters<typeof slide6.addTable>[0], {
        x: 0.5, y: 1.3, w: 12.33, rowH: 0.42,
        border: { type: 'solid', color: 'FECACA', pt: 1 },
        fill: { color: WHITE },
        colW: [1.5, 4.5, 5.0, 1.33],
      });
    }

    // ── Slide 7: Closing ───────────────────────────────────────────────────────
    const slideClose = pptx.addSlide();
    slideClose.background = { color: DARK_BLUE };
    slideClose.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { type: 'solid', color: DARK_BLUE } });
    slideClose.addText('OKR System', { x: 0.6, y: 2.3, w: 12, h: 0.7, fontSize: 32, bold: true, color: WHITE, align: 'center' });
    if (data.orgName) {
      slideClose.addText(data.orgName, { x: 0.6, y: 3.1, w: 12, h: 0.45, fontSize: 15, color: '93C5FD', align: 'center' });
    }
    slideClose.addText(data.cycleName, { x: 0.6, y: 3.65, w: 12, h: 0.45, fontSize: 14, color: '93C5FD', align: 'center' });
    slideClose.addText(date, { x: 0.6, y: 4.2, w: 12, h: 0.4, fontSize: 13, color: '60A5FA', align: 'center' });

    return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }) as ArrayBuffer);
  }
}
