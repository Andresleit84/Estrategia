// Pure TypeScript — no NestJS imports

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreColor(n: number): string {
  return n >= 4 ? '#15803D' : n >= 3 ? '#92400E' : n >= 2 ? '#991B1B' : '#7F1D1D';
}
function scoreBg(n: number): string {
  return n >= 4 ? '#DCFCE7' : n >= 3 ? '#FEF3C7' : n >= 2 ? '#FEE2E2' : '#FEF2F2';
}
function scoreLabel(n: number): string {
  return n >= 4.5 ? 'EXCELENTE' : n >= 3.5 ? 'BUENA' : n >= 2.5 ? 'MODERADA' : n >= 1.5 ? 'ALTA' : 'CRÍTICA';
}

const DIMENSION_LABELS: Record<string, string> = {
  STRATEGIC_EXECUTION: 'Ejecución Estratégica',
  GOVERNANCE_MATURITY: 'Madurez de Gobernanza',
  MARGIN_DEPENDENCY: 'Dependencia de Márgenes',
  DIGITAL_CAPABILITY: 'Capacidad Digital',
  LEADERSHIP_TALENT: 'Liderazgo y Talento',
  BUSINESS_MODEL: 'Modelo de Negocio',
  REGULATORY_PRESSURE: 'Presión Regulatoria',
  MEMBER_DIGITAL_DISCONNECT: 'Brecha Digital de Socios',
};

const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  STRATEGIC_EXECUTION: 'Capacidad para ejecutar la estrategia definida',
  GOVERNANCE_MATURITY: 'Solidez de los procesos de gobierno corporativo',
  MARGIN_DEPENDENCY: 'Dependencia de márgenes financieros tradicionales',
  DIGITAL_CAPABILITY: 'Nivel de transformación y capacidad digital',
  LEADERSHIP_TALENT: 'Calidad del liderazgo y gestión del talento',
  BUSINESS_MODEL: 'Sostenibilidad e innovación del modelo de negocio',
  REGULATORY_PRESSURE: 'Exposición y gestión de la presión regulatoria',
  MEMBER_DIGITAL_DISCONNECT: 'Brecha digital entre la cooperativa y sus socios',
};

export interface SectorPdfData {
  sessionName: string;
  periodLabel: string;
  createdAt: string;
  orgName: string;
  completedCount: number;
  calibratedScores: Record<string, number> | null;
  sessionDocCount: number;
  aiPlan: {
    generated_at?: string;
    fortalezas?: Array<{ threat_key: string; score: number; razon: string }>;
    debilidades?: Array<{ threat_key: string; score: number; razon: string }>;
    diagnostico_general?: string;
    insights_consenso?: string;
    resumen_insumos?: string;
    roadmap?: {
      acciones_30d?: string[];
      iniciativas_90d?: string[];
      transformaciones_180d?: string[];
    };
    por_amenaza?: Record<string, {
      prioridad?: string;
      diagnostico?: string;
      plan_accion?: string;
      kpis?: string[];
    }>;
  };
  threats: Array<{
    threat_key: string;
    avg_score: number;
    min_score: number;
    max_score: number;
    stddev: number | null;
    count: number;
    consensus_level: string;
    calibrated_score: number | null;
  }>;
}

export function buildSectorDiagnosisPdf(data: SectorPdfData): string {
  const {
    sessionName, periodLabel, createdAt, orgName,
    completedCount, sessionDocCount, aiPlan, threats,
  } = data;

  const dateLabel = (() => {
    try {
      return new Date(createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return createdAt;
    }
  })();

  const sectionHeader = (title: string) =>
    `<div style="border-left:3px solid #006EB6;padding-left:10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#006EB6;margin-bottom:16px;font-weight:700">${esc(title)}</div>`;

  const infoRow = (label: string, value: string) =>
    `<div style="margin-bottom:10px"><div style="font-size:9px;text-transform:uppercase;color:#6B7280;font-weight:700;letter-spacing:0.5px;margin-bottom:2px">${esc(label)}</div><div style="font-size:10px;color:#374151">${value}</div></div>`;

  // ── Page 1: Portada ──────────────────────────────────────────────────────────
  const portada = `
<div style="background:#0C2340;min-height:100vh;display:flex;flex-direction:column;padding:40mm 20mm;">
  <div style="width:60px;height:4px;background:#006EB6;margin-bottom:24px"></div>
  <div style="font-size:9px;letter-spacing:3px;color:#7EB8D4;text-transform:uppercase">Diagnóstico Sectorial Estratégico</div>
  <div style="font-size:32px;font-weight:700;color:#fff;margin-top:12px;max-width:80%;line-height:1.2">${esc(sessionName)}</div>
  <div style="font-size:14px;color:#A0AEC0;margin-top:8px">${esc(periodLabel || 'Período no especificado')}</div>
  <div style="flex-grow:1"></div>
  <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#A0AEC0;margin-bottom:4px">Entidad Evaluada</div>
      <div style="font-size:14px;font-weight:700;color:#fff">${esc(orgName)}</div>
    </div>
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#A0AEC0;margin-bottom:4px">Evaluadores</div>
      <div style="font-size:14px;font-weight:700;color:#fff">${esc(String(completedCount))} expertos</div>
    </div>
    <div>
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#A0AEC0;margin-bottom:4px">Insumos Analizados</div>
      <div style="font-size:14px;font-weight:700;color:#fff">${sessionDocCount > 0 ? `${esc(String(sessionDocCount))} documentos` : 'Sin insumos documentales'}</div>
    </div>
  </div>
  <div style="font-size:8px;color:#718096;margin-top:16px">Preparado el ${esc(dateLabel)} — Confidencial</div>
</div>`;

  // ── Page 2: Contexto ─────────────────────────────────────────────────────────
  const cardStyle = 'border:1px solid #E5E7EB;border-radius:6px;padding:16px;';
  const dimKeys = Object.keys(DIMENSION_LABELS);
  const dimGrid = dimKeys.map((k) =>
    `<div style="padding:8px;background:#F9FAFB;border-radius:4px;border:1px solid #E5E7EB">
      <div style="font-size:9px;font-weight:700;color:#374151;margin-bottom:2px">${esc(DIMENSION_LABELS[k])}</div>
      <div style="font-size:8.5px;color:#6B7280">${esc(DIMENSION_DESCRIPTIONS[k])}</div>
    </div>`
  ).join('');

  const contexto = `
<div class="page-break" style="padding:10mm 0">
  ${sectionHeader('Contexto del Ejercicio y la Entidad')}
  <div style="display:grid;grid-template-columns:60% 40%;gap:24px;margin-bottom:20px">
    <div style="${cardStyle}">
      <div style="font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Sobre el Ejercicio</div>
      ${infoRow('Metodología', 'Evaluación colaborativa multi-experto con calibración de scores y validación por IA')}
      ${infoRow('Herramienta', 'Diagnóstico Sectorial de Amenazas Estratégicas')}
      ${infoRow('Escala', '1–5 por dimensión (1=amenaza crítica, 5=fortaleza diferencial)')}
      ${infoRow('Participantes', `${esc(String(completedCount))} evaluadores completaron el diagnóstico`)}
      ${infoRow('Insumos', sessionDocCount > 0 ? `${sessionDocCount} documentos de soporte analizados` : 'Sin insumos documentales adicionales')}
      ${infoRow('Fecha Análisis', dateLabel)}
    </div>
    <div style="${cardStyle}">
      <div style="font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Sobre la Entidad</div>
      ${infoRow('Entidad', esc(orgName))}
      ${infoRow('Período Evaluado', esc(periodLabel || 'No especificado'))}
      ${infoRow('Tipo de Ejercicio', 'Diagnóstico de amenazas sectoriales estratégicas')}
      ${infoRow('Alcance', '8 dimensiones de análisis sectorial')}
    </div>
  </div>
  <div style="${cardStyle}">
    <div style="font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Dimensiones del Diagnóstico</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${dimGrid}
    </div>
  </div>
</div>`;

  // ── Page 3: Resumen Ejecutivo ─────────────────────────────────────────────────
  const diagnosticoHtml = (aiPlan.diagnostico_general ?? '')
    .split('\n')
    .map(esc)
    .join('<br/>');

  const fortalezasHtml = (aiPlan.fortalezas ?? []).map((f) => {
    const sc = Number(f.score);
    return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
      <div style="min-width:32px;height:32px;border-radius:50%;background:${scoreBg(sc)};color:${scoreColor(sc)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex-shrink:0">${esc(String(sc))}</div>
      <div>
        <div style="font-size:9px;font-weight:700;color:#374151">${esc(DIMENSION_LABELS[f.threat_key] ?? f.threat_key)}</div>
        <div style="font-size:8.5px;color:#6B7280;margin-top:2px">${esc(f.razon)}</div>
      </div>
    </div>`;
  }).join('');

  const debilidadesHtml = (aiPlan.debilidades ?? []).map((d) => {
    const sc = Number(d.score);
    return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
      <div style="min-width:32px;height:32px;border-radius:50%;background:${scoreBg(sc)};color:${scoreColor(sc)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex-shrink:0">${esc(String(sc))}</div>
      <div>
        <div style="font-size:9px;font-weight:700;color:#374151">${esc(DIMENSION_LABELS[d.threat_key] ?? d.threat_key)}</div>
        <div style="font-size:8.5px;color:#6B7280;margin-top:2px">${esc(d.razon)}</div>
      </div>
    </div>`;
  }).join('');

  const resumenEjecutivo = `
<div class="page-break" style="padding:10mm 0">
  ${sectionHeader('Resumen Ejecutivo')}
  ${aiPlan.diagnostico_general ? `<div style="background:#F0F7FF;border-left:4px solid #006EB6;padding:16px;border-radius:4px;font-size:10px;line-height:1.7;color:#374151;margin-bottom:20px">${diagnosticoHtml}</div>` : ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div style="border-top:3px solid #15803D;background:#fff;border:1px solid #E5E7EB;border-top:3px solid #15803D;padding:14px;border-radius:4px">
      <div style="font-size:9px;text-transform:uppercase;font-weight:700;color:#15803D;letter-spacing:0.5px;margin-bottom:12px">Fortalezas Identificadas</div>
      ${fortalezasHtml || '<div style="font-size:9px;color:#9CA3AF">Sin fortalezas registradas</div>'}
    </div>
    <div style="border:1px solid #E5E7EB;border-top:3px solid #DC2626;padding:14px;border-radius:4px">
      <div style="font-size:9px;text-transform:uppercase;font-weight:700;color:#DC2626;letter-spacing:0.5px;margin-bottom:12px">Áreas de Mejora Prioritaria</div>
      ${debilidadesHtml || '<div style="font-size:9px;color:#9CA3AF">Sin áreas de mejora registradas</div>'}
    </div>
  </div>
</div>`;

  // ── Page 4: Mapa de Diagnóstico ───────────────────────────────────────────────
  const sortedThreats = [...(threats ?? [])].sort((a, b) => {
    const sa = a.calibrated_score ?? a.avg_score;
    const sb = b.calibrated_score ?? b.avg_score;
    return sa - sb;
  });

  const threatRows = sortedThreats.map((t, i) => {
    const eff = t.calibrated_score ?? t.avg_score;
    const avg = Number(t.avg_score);
    const cal = t.calibrated_score != null ? Number(t.calibrated_score) : null;
    const stddev = t.stddev != null ? Number(t.stddev).toFixed(2) : null;
    const consensusColor = t.consensus_level === 'Alto' ? '#15803D' : t.consensus_level === 'Medio' ? '#92400E' : '#991B1B';
    const bgRow = i % 2 === 0 ? '#fff' : '#F9FAFB';

    return `<tr style="background:${bgRow}">
      <td style="padding:8px 10px;font-size:9.5px;color:#374151;border-bottom:1px solid #E5E7EB">
        <div style="font-weight:600">${esc(DIMENSION_LABELS[t.threat_key] ?? t.threat_key)}</div>
        <div style="font-size:8px;color:#9CA3AF;margin-top:1px">${esc(t.threat_key)}</div>
      </td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5E7EB">
        <div style="width:36px;height:36px;border-radius:50%;background:${scoreBg(avg)};color:${scoreColor(avg)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;margin:0 auto">${avg.toFixed(1)}</div>
        <div style="height:5px;background:#E5E7EB;border-radius:3px;margin-top:4px;overflow:hidden">
          <div style="height:100%;width:${Math.round((avg / 5) * 100)}%;background:${scoreColor(avg)};border-radius:3px"></div>
        </div>
      </td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5E7EB">
        ${cal != null
          ? `<div style="width:36px;height:36px;border-radius:50%;background:${scoreBg(cal)};color:${scoreColor(cal)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;margin:0 auto">${cal.toFixed(1)}</div>`
          : `<span style="color:#9CA3AF;font-size:10px">—</span>`}
      </td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5E7EB">
        <span style="color:${consensusColor};font-size:9.5px;font-weight:600">● ${esc(t.consensus_level)}</span>
        ${stddev != null ? `<div style="font-size:8px;color:#9CA3AF">σ ${stddev}</div>` : ''}
      </td>
      <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #E5E7EB">
        <span style="display:inline-block;padding:3px 8px;border-radius:12px;background:${scoreBg(eff)};color:${scoreColor(eff)};font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${scoreLabel(eff)}</span>
      </td>
    </tr>`;
  }).join('');

  const mapaDiagnostico = `
<div class="page-break" style="padding:10mm 0">
  ${sectionHeader('Mapa de Diagnóstico por Dimensión')}
  <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden">
    <thead>
      <tr style="background:#0C2340">
        <th style="padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:#fff;font-weight:600">Dimensión</th>
        <th style="padding:8px 10px;text-align:center;font-size:9px;text-transform:uppercase;color:#fff;font-weight:600;width:100px">Score Promedio</th>
        <th style="padding:8px 10px;text-align:center;font-size:9px;text-transform:uppercase;color:#fff;font-weight:600;width:100px">Score Calibrado</th>
        <th style="padding:8px 10px;text-align:center;font-size:9px;text-transform:uppercase;color:#fff;font-weight:600;width:100px">Consenso</th>
        <th style="padding:8px 10px;text-align:center;font-size:9px;text-transform:uppercase;color:#fff;font-weight:600;width:100px">Nivel de Riesgo</th>
      </tr>
    </thead>
    <tbody>
      ${threatRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#9CA3AF;font-size:10px">Sin datos de diagnóstico</td></tr>'}
    </tbody>
  </table>
  ${aiPlan.insights_consenso ? `
  <div style="background:#FFFBEB;border-left:3px solid #D97706;padding:12px;border-radius:4px;margin-top:16px">
    <div style="font-size:9px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Análisis de Consenso</div>
    <div style="font-size:9.5px;color:#374151;line-height:1.6">${esc(aiPlan.insights_consenso)}</div>
  </div>` : ''}
</div>`;

  // ── Page 5: Hoja de Ruta ──────────────────────────────────────────────────────
  const roadmap = aiPlan.roadmap ?? {};
  const roadmapCols = [
    { color: '#DC2626', title: '30 Días', subtitle: 'Diagnóstico y Quick Wins', items: roadmap.acciones_30d ?? [] },
    { color: '#D97706', title: '90 Días', subtitle: 'Iniciativas Clave', items: roadmap.iniciativas_90d ?? [] },
    { color: '#15803D', title: '180 Días', subtitle: 'Transformaciones Estructurales', items: roadmap.transformaciones_180d ?? [] },
  ];

  const roadmapColsHtml = roadmapCols.map((col) => {
    const items = col.items.length > 0
      ? col.items.map((item) =>
          `<li style="display:flex;gap:6px;font-size:9px;color:#374151;margin-bottom:6px;line-height:1.4">
            <span style="color:${col.color};font-weight:700;flex-shrink:0">▶</span>
            <span>${esc(item)}</span>
          </li>`
        ).join('')
      : `<li style="font-size:9px;color:#9CA3AF;list-style:none">Sin acciones definidas</li>`;

    return `<div style="border:1px solid #E5E7EB;border-radius:6px;overflow:hidden">
      <div style="height:4px;background:${col.color}"></div>
      <div style="padding:14px">
        <div style="font-size:11px;font-weight:700;color:${col.color};margin-bottom:2px">${esc(col.title)}</div>
        <div style="font-size:8.5px;text-transform:uppercase;color:#6B7280;letter-spacing:0.5px;margin-bottom:12px">${esc(col.subtitle)}</div>
        <ul style="padding:0;margin:0;list-style:none">${items}</ul>
      </div>
    </div>`;
  }).join('');

  const hojaDeRuta = `
<div class="page-break" style="padding:10mm 0">
  ${sectionHeader('Hoja de Ruta Estratégica')}
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
    ${roadmapColsHtml}
  </div>
</div>`;

  // ── Page 6: Plan por Dimensión ────────────────────────────────────────────────
  const porAmenaza = aiPlan.por_amenaza ?? {};
  const priorityOrder: Record<string, number> = { 'CRÍTICA': 0, 'ALTA': 1 };
  const qualifyingDims = Object.entries(porAmenaza)
    .filter(([, v]) => v.prioridad === 'CRÍTICA' || v.prioridad === 'ALTA')
    .sort(([, a], [, b]) => (priorityOrder[a.prioridad ?? ''] ?? 99) - (priorityOrder[b.prioridad ?? ''] ?? 99));

  const planDims = qualifyingDims.map(([key, val], idx) => {
    const effScore = (() => {
      const t = threats.find((x) => x.threat_key === key);
      return t ? (t.calibrated_score ?? t.avg_score) : 0;
    })();
    const priorityColor = val.prioridad === 'CRÍTICA' ? '#DC2626' : '#D97706';
    const priorityBg = val.prioridad === 'CRÍTICA' ? '#FEE2E2' : '#FEF3C7';
    const kpisHtml = (val.kpis ?? []).length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${(val.kpis ?? []).map((kpi) => `<span style="background:#EFF6FF;color:#1D4ED8;border-radius:12px;padding:3px 8px;font-size:8px">${esc(kpi)}</span>`).join('')}</div>`
      : '';

    return `<div style="margin-bottom:14px${idx < qualifyingDims.length - 1 ? ';padding-bottom:14px;border-bottom:1px solid #E5E7EB' : ''}">
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;padding:10px 14px;border-radius:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11px;font-weight:700;color:#374151">${esc(DIMENSION_LABELS[key] ?? key)}</div>
          <div style="font-size:8px;color:#9CA3AF;margin-top:1px">${esc(key)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:30px;height:30px;border-radius:50%;background:${scoreBg(effScore)};color:${scoreColor(effScore)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px">${Number(effScore).toFixed(1)}</div>
          <span style="background:${priorityBg};color:${priorityColor};padding:3px 8px;border-radius:4px;font-size:8px;font-weight:700;text-transform:uppercase">${esc(val.prioridad ?? '')}</span>
        </div>
      </div>
      ${val.diagnostico ? `<div style="font-size:9.5px;color:#4B5563;font-style:italic;border-left:2px solid #9CA3AF;padding-left:8px;margin:6px 0;line-height:1.5">${esc(val.diagnostico)}</div>` : ''}
      ${val.plan_accion ? `<div style="font-size:9.5px;color:#374151;margin:6px 0;line-height:1.5">${esc(val.plan_accion)}</div>` : ''}
      ${kpisHtml}
    </div>`;
  }).join('');

  const planPorDimension = `
<div class="page-break" style="padding:10mm 0">
  ${sectionHeader('Plan de Acción por Dimensión Prioritaria')}
  ${planDims || '<div style="font-size:10px;color:#9CA3AF">No hay dimensiones con prioridad CRÍTICA o ALTA.</div>'}
</div>`;

  // ── Final Page: Insumos (optional) ────────────────────────────────────────────
  const insumos = aiPlan.resumen_insumos
    ? `<div class="page-break" style="padding:10mm 0">
        ${sectionHeader('Análisis de Insumos de Soporte')}
        <div style="background:#F0FDF4;border-left:4px solid #15803D;padding:16px;border-radius:4px;font-size:10px;color:#374151;line-height:1.7">${esc(aiPlan.resumen_insumos)}</div>
      </div>`
    : '';

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footer = `
<div style="position:fixed;bottom:0;left:0;right:0;border-top:1px solid #E5E7EB;padding:6px 20mm;display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#9CA3AF;background:#fff">
  <span>Confidencial — uso interno</span>
  <span>${esc(dateLabel)} — Diagnóstico Sectorial</span>
</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 18mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #374151; line-height: 1.5; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
${portada}
${contexto}
${resumenEjecutivo}
${mapaDiagnostico}
${hojaDeRuta}
${planPorDimension}
${insumos}
${footer}
</body>
</html>`;
}
