"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown, Target, Search, X,
  TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertCircle, AlertTriangle,
  ArrowDownRight, ArrowUpRight, BarChart2,
  User, Layers,
} from "lucide-react";
import { cn, formatKRValue } from "@/lib/utils";
import type { ObjectiveTreeNode, TreeKR } from "@/hooks/useObjectives";

// ── Layer config ───────────────────────────────────────────────────────────────

const LAYER_CFG = {
  strategic: {
    bg: "#3730A3", tag: "Estratégico",
    border: "rgba(55,48,163,.22)", lineColor: "#6366F1",
    chipBg: "#EDE9FE", chipText: "#3730A3",
  },
  annual: {
    bg: "#1D4ED8", tag: "Anual",
    border: "rgba(29,78,216,.22)", lineColor: "#3B82F6",
    chipBg: "#DBEAFE", chipText: "#1D4ED8",
  },
  quarterly: {
    bg: "#0F766E", tag: "Trimestral",
    border: "rgba(15,118,110,.22)", lineColor: "#14B8A6",
    chipBg: "#CCFBF1", chipText: "#0F766E",
  },
} as const;

type Layer = keyof typeof LAYER_CFG;

// ── KR type (measurement direction) ──────────────────────────────────────────

const KR_TYPE: Record<string, { label: string; bg: string; text: string }> = {
  INCREASE: { label: "Aumentar", bg: "#DCFCE7", text: "#166534" },
  DECREASE: { label: "Reducir",  bg: "#FEE2E2", text: "#991B1B" },
  MAINTAIN: { label: "Mantener", bg: "#FEF3C7", text: "#92400E" },
  ACHIEVE:  { label: "Lograr",   bg: "#EDE9FE", text: "#4338CA" },
};

// ── KR category ───────────────────────────────────────────────────────────────

const KR_CAT: Record<string, { label: string; bg: string; text: string }> = {
  RESULTADO: { label: "Resultado", bg: "#DFF4ED", text: "#075C47" },
  CAPACIDAD: { label: "Capacidad", bg: "#E3EFFE", text: "#042C53" },
  BALANCE:   { label: "Balance",   bg: "#FEF3CD", text: "#412402" },
};

// ── Coverage ──────────────────────────────────────────────────────────────────

type Coverage = "ok" | "partial" | "gap";

const COV_CFG: Record<Coverage, { label: string; dot: string; bg: string; text: string; Icon: typeof CheckCircle2 }> = {
  ok:      { label: "Cubierto", dot: "#059669", bg: "rgba(5,150,105,.12)",  text: "#065F46", Icon: CheckCircle2  },
  partial: { label: "Parcial",  dot: "#D97706", bg: "rgba(217,119,6,.12)",  text: "#92400E", Icon: AlertCircle   },
  gap:     { label: "Brecha",   dot: "#DC2626", bg: "rgba(220,38,38,.10)",  text: "#991B1B", Icon: AlertTriangle },
};

const LINE = "#64748B";

function computeObjCoverage(obj: ObjectiveTreeNode, childCount: number, isBottom = false): Coverage {
  if (obj.kr_count === 0) return "gap";
  if (isBottom) return "ok";
  if (childCount > 0) return "ok";
  return "partial";
}

function computeKRCoverage(kr: TreeKR, fallback: Coverage): Coverage {
  const rd = kr.refs_data;
  if (!rd) return fallback;
  const hasQ = (rd.links_down?.quarterly?.length ?? 0) > 0;
  const hasA = (rd.links_down?.annual?.length ?? 0) > 0;
  const hasUp = (rd.links_up?.length ?? 0) > 0;
  if (kr.gap_note && !hasQ && !hasUp) return "gap";
  if (hasQ || hasUp) return "ok";
  if (hasA) return "partial";
  return fallback;
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === "up")   return <TrendingUp   className="h-3 w-3 text-emerald-500 shrink-0" />;
  if (trend === "down") return <TrendingDown  className="h-3 w-3 text-rose-500   shrink-0" />;
  return <Minus className="h-3 w-3 text-muted-foreground/30 shrink-0" />;
}

function BarOnDark({ value }: { value: number }) {
  return (
    <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.18)" }}>
      <div className="h-full rounded-full transition-all duration-700"
           style={{ width: `${Math.min(100, value)}%`, background: "rgba(255,255,255,.8)" }} />
    </div>
  );
}

function BarNeutral({ value }: { value: number }) {
  const pct   = Math.min(100, value);
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#D97706" : "#DC2626";
  return (
    <div className="h-1 rounded-full overflow-hidden bg-muted">
      <div className="h-full rounded-full transition-all duration-700"
           style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function CovChip({ cov }: { cov: Coverage }) {
  const c = COV_CFG[cov];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: c.bg, color: c.text }}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

function ConfidenceDots({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  const color  = value >= 0.6 ? "#059669" : value >= 0.3 ? "#D97706" : "#DC2626";
  return (
    <span className="flex gap-0.5 shrink-0">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full"
              style={{ background: i < filled ? color : "rgba(0,0,0,.1)" }} />
      ))}
    </span>
  );
}

function TypeBadge({ kr }: { kr: TreeKR }) {
  if (kr.kr_category) {
    const c = KR_CAT[kr.kr_category];
    return c ? (
      <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: c.bg, color: c.text }}>{c.label}</span>
    ) : null;
  }
  const c = KR_TYPE[kr.type] ?? { label: kr.type, bg: "#F1F5F9", text: "#475569" };
  return (
    <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded shrink-0"
          style={{ background: c.bg, color: c.text }}>{c.label}</span>
  );
}

// ── Connector lines ───────────────────────────────────────────────────────────

function TConnector({ colCount }: { colCount: number }) {
  if (colCount === 0) return null;
  const centers = Array.from({ length: colCount }, (_, i) => ((2 * i + 1) / (2 * colCount)) * 100);
  const lPct = centers[0];
  const rPct = centers[centers.length - 1];
  return (
    <div className="relative shrink-0" style={{ height: 52 }}>
      {/* stem from parent */}
      <div className="absolute" style={{ left: "50%", top: 0, height: "52%", width: 3, transform: "translateX(-1.5px)", background: LINE, borderRadius: 2 }} />
      {/* horizontal bar */}
      {colCount > 1 && (
        <div className="absolute" style={{ top: "52%", left: `${lPct}%`, right: `${100 - rPct}%`, height: 3, marginTop: -1.5, background: LINE, borderRadius: 2 }} />
      )}
      {/* joint dot at center */}
      <div className="absolute" style={{ left: "50%", top: "52%", width: 8, height: 8, borderRadius: "50%", background: LINE, transform: "translate(-4px,-4px)" }} />
      {/* drops to each column */}
      {centers.map((cx, i) => (
        <div key={i} className="absolute" style={{ left: `${cx}%`, top: "52%", bottom: 0, width: 3, transform: "translateX(-1.5px)", background: LINE, borderRadius: 2 }} />
      ))}
    </div>
  );
}

function VerticalLine({ height = 24 }: { height?: number }) {
  return (
    <div className="flex justify-center shrink-0" style={{ height }}>
      <div className="w-0.5 h-full" style={{ background: LINE, opacity: .6 }} />
    </div>
  );
}

// ── Cascade chips inside KR rows ──────────────────────────────────────────────

function DownChips({ refs }: { refs: NonNullable<TreeKR["refs_data"]> }) {
  const ann = refs.links_down?.annual ?? [];
  const qt  = refs.links_down?.quarterly ?? [];
  const up  = refs.links_up ?? [];
  if (!ann.length && !qt.length && !up.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5 pl-[3.25rem]">
      {ann.map((lbl, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ background: LAYER_CFG.annual.chipBg, color: LAYER_CFG.annual.chipText }}>
          <ArrowDownRight className="h-2 w-2 opacity-70" />{lbl}
        </span>
      ))}
      {qt.map((lbl, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ background: LAYER_CFG.quarterly.chipBg, color: LAYER_CFG.quarterly.chipText }}>
          <ArrowDownRight className="h-2 w-2 opacity-70" />{lbl}
        </span>
      ))}
      {up.map((lbl, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "#F0EEFD", color: "#4E43AA" }}>
          <ArrowUpRight className="h-2 w-2 opacity-70" />↑ {lbl}
        </span>
      ))}
    </div>
  );
}

// ── KR Row ────────────────────────────────────────────────────────────────────

function KRRow({ kr, objCov, onSelect }: { kr: TreeKR; objCov: Coverage; onSelect: () => void }) {
  const krCov    = computeKRCoverage(kr, objCov);
  const mainText = kr.description ?? kr.title;
  const kpiText  = kr.kpi_description ?? (kr.description ? kr.title : null);

  return (
    <button onClick={onSelect}
            className="w-full text-left px-3.5 py-2.5 border-t border-border/40 hover:bg-muted/40 transition-colors group">
      {/* Row 1: code + badge + text + trend */}
      <div className="flex items-start gap-2 mb-1">
        {kr.code && (
          <span className="text-[8px] font-mono text-muted-foreground/40 shrink-0 mt-0.5 w-10 truncate">{kr.code}</span>
        )}
        <TypeBadge kr={kr} />
        <span className="text-[11px] text-foreground/80 leading-snug flex-1 group-hover:text-foreground transition-colors">
          {mainText}
        </span>
        <TrendIcon trend={kr.trend} />
      </div>
      {/* Row 2: KPI italic */}
      {kpiText && (
        <div className="pl-[3.25rem] mb-1">
          <span className="text-[9.5px] text-muted-foreground/60 italic leading-snug">{kpiText}</span>
        </div>
      )}
      {/* Row 3: progress + coverage */}
      <div className="flex items-center gap-2 pl-[3.25rem]">
        <div className="flex-1"><BarNeutral value={kr.progress} /></div>
        <span className="text-[9px] font-mono font-semibold tabular-nums text-muted-foreground shrink-0 w-8 text-right">{kr.progress}%</span>
        <ConfidenceDots value={kr.confidence} />
        <CovChip cov={krCov} />
      </div>
      {/* Cascade chips */}
      {kr.refs_data && <DownChips refs={kr.refs_data} />}
      {/* Gap alert */}
      {kr.gap_note && (
        <div className="pl-[3.25rem] mt-1.5">
          <div className="flex items-start gap-1.5 rounded px-2 py-1"
               style={{ background: "rgba(220,38,38,.07)", borderLeft: "2px solid #DC2626" }}>
            <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-rose-500 mt-0.5" />
            <span className="text-[9px] text-rose-700 dark:text-rose-400 leading-relaxed">{kr.gap_note}</span>
          </div>
        </div>
      )}
    </button>
  );
}

// ── OKR Box ───────────────────────────────────────────────────────────────────

interface OKRBoxProps {
  obj: ObjectiveTreeNode;
  layer: Layer;
  coverage: Coverage;
  isOpen: boolean;
  highlight: boolean;
  onToggle: () => void;
  onKRSelect: (kr: TreeKR) => void;
}

function OKRBox({ obj, layer, coverage, isOpen, highlight, onToggle, onKRSelect }: OKRBoxProps) {
  const cfg = LAYER_CFG[layer];
  return (
    <div className={cn("rounded-xl overflow-hidden shadow-sm", highlight && "ring-2 ring-primary shadow-md")}
         style={{ border: `1.5px solid ${cfg.border}` }}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3 hover:opacity-90 transition-opacity"
              style={{ background: cfg.bg }}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                    style={{ background: "rgba(255,255,255,.18)", color: "rgba(255,255,255,.92)" }}>
                {cfg.tag}
              </span>
              {obj.code && <span className="text-[8px] font-mono text-white/50">{obj.code}</span>}
              {obj.team_name && <span className="text-[8px] text-white/40 truncate">{obj.team_name}</span>}
            </div>
            <p className="text-[12px] font-semibold text-white leading-snug pr-4">{obj.title}</p>
          </div>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 mt-0.5 text-white/50 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
        <div className="mt-2.5 mb-1.5"><BarOnDark value={obj.progress} /></div>
        <div className="flex items-center justify-between gap-2">
          <CovChip cov={coverage} />
          <div className="flex items-center gap-2">
            {obj.kr_count > 0 && (
              <span className="text-[8px] font-mono text-white/50">{obj.kr_count} KR{obj.kr_count !== 1 ? "s" : ""}</span>
            )}
            <span className="text-[10px] font-mono font-semibold text-white/70 tabular-nums">{obj.progress}%</span>
          </div>
        </div>
      </button>
      {isOpen && (
        <div className="bg-card">
          {obj.key_results.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-muted-foreground italic">Sin resultados clave definidos</p>
          ) : (
            obj.key_results.map(kr => (
              <KRRow key={kr.id} kr={kr} objCov={coverage} onSelect={() => onKRSelect(kr)} />
            ))
          )}
          {obj.owner_name && (
            <div className="px-4 py-2 border-t border-border/40 flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] text-muted-foreground">{obj.owner_name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Coverage strip ────────────────────────────────────────────────────────────

function CoverageStrip({ total, ok, partial, gap }: { total: number; ok: number; partial: number; gap: number }) {
  const okPct   = total ? Math.round(ok      / total * 100) : 0;
  const partPct = total ? Math.round(partial / total * 100) : 0;
  const gapPct  = total ? Math.round(gap     / total * 100) : 0;
  const stats = [
    { val: total,   lbl: "OKRs en el plan",       sub: "todos los niveles",       color: "#64748B" },
    { val: ok,      lbl: "Cascada completa",       sub: "KRs y capa siguiente",    color: "#059669" },
    { val: partial, lbl: "Parcial",                sub: "KRs sin capa siguiente",  color: "#D97706" },
    { val: gap,     lbl: "Sin KRs definidos",      sub: "no se pueden medir",      color: "#DC2626" },
  ];
  return (
    <div className="bg-card border-b border-border/60 px-4 py-3 flex items-center gap-5 flex-wrap gap-y-2 shrink-0">
      {stats.map(({ val, lbl, sub, color }, i) => (
        <div key={lbl} className="flex items-center gap-5">
          <div>
            <p className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color }}>{val}</p>
            <p className="text-[9px] font-medium text-foreground/70 mt-0.5">{lbl}</p>
            <p className="text-[8px] text-muted-foreground/50">{sub}</p>
          </div>
          {i < stats.length - 1 && <div className="w-px h-9 bg-border/50 shrink-0" />}
        </div>
      ))}
      <div className="flex-1 min-w-[140px] ml-auto">
        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
          <div style={{ width: `${okPct}%`,   background: "#059669", transition: "width .7s" }} />
          <div style={{ width: `${partPct}%`, background: "#D97706", transition: "width .7s" }} />
          <div style={{ width: `${gapPct}%`,  background: "#DC2626", transition: "width .7s" }} />
        </div>
        <div className="flex gap-3 mt-1 flex-wrap">
          {ok      > 0 && <span className="text-[8px] text-muted-foreground">{okPct}% cubierto</span>}
          {partial > 0 && <span className="text-[8px] text-muted-foreground">{partPct}% parcial</span>}
          {gap     > 0 && <span className="text-[8px] text-muted-foreground">{gapPct}% sin KRs</span>}
        </div>
      </div>
    </div>
  );
}

// ── Gap card ──────────────────────────────────────────────────────────────────

interface GapItem {
  kr: TreeKR;
  parent: ObjectiveTreeNode;
  cov: Coverage;
  layer: Layer;
}

function GapCard({ item }: { item: GapItem }) {
  const { kr, parent, cov, layer } = item;
  const cfg = LAYER_CFG[layer];
  const isGap = cov === "gap";
  const mainText = kr.description ?? kr.title;
  const rd = kr.refs_data;

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm">
      {/* Header */}
      <div className="px-3.5 py-2.5" style={{ background: isGap ? "#991B1B" : "#92400E" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[8px] font-mono uppercase tracking-wider text-white/60">
            {isGap ? "Brecha crítica" : "Parcial"} · {parent.code ?? cfg.tag} · {kr.code}
          </span>
        </div>
        <p className="text-[12px] font-semibold text-white leading-snug">{mainText}</p>
      </div>
      {/* Body */}
      <div className="px-3.5 py-3 bg-card space-y-2.5">
        {kr.kpi_description && (
          <p className="text-[10px] text-muted-foreground italic leading-snug">{kr.kpi_description}</p>
        )}
        {kr.gap_note && (
          <p className="text-[11px] text-foreground/80 leading-relaxed">{kr.gap_note}</p>
        )}
        {!kr.gap_note && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isGap ? "Este KR no tiene cascada a capas inferiores." : "Cobertura parcial — falta despliegue completo."}
          </p>
        )}
        {kr.recommendation && (
          <div className="rounded-r-md border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/10 px-2.5 py-2">
            <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>➜ </strong>{kr.recommendation}
            </p>
          </div>
        )}
        {/* Reference chips */}
        {rd && (
          <div className="flex flex-wrap gap-1 pt-1">
            {rd.foda?.map((f, i) => (
              <span key={i} className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded text-white" style={{ background: "#1860A8" }}>{f.code}</span>
            ))}
            {rd.sugef?.map((s, i) => (
              <span key={i} className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded text-white" style={{ background: "#B83030" }}>SUGEF {s.code}</span>
            ))}
            {rd.deps?.map((d, i) => (
              <span key={i} className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded text-white" style={{ background: "#4E43AA" }}>{d.pilar}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gaps panel ────────────────────────────────────────────────────────────────

function GapsPanel({ items }: { items: GapItem[] }) {
  const critical = items.filter(g => g.cov === "gap");
  const partial  = items.filter(g => g.cov === "partial");

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Todo cubierto</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Todos los OKRs tienen KRs definidos y cascada hacia la capa siguiente.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 p-4">
      {/* Summary */}
      <div className="flex items-center gap-3 mb-4 flex-wrap gap-y-2">
        {critical.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold"
               style={{ background: "#991B1B" }}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {critical.length} brecha{critical.length !== 1 ? "s" : ""} crítica{critical.length !== 1 ? "s" : ""}
          </div>
        )}
        {partial.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold"
               style={{ background: "#92400E" }}>
            <AlertCircle className="h-3.5 w-3.5" />
            {partial.length} parcial{partial.length !== 1 ? "es" : ""}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground ml-auto">
          KRs sin cascada completa hacia la capa siguiente
        </p>
      </div>
      {/* Grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {[...critical, ...partial].map(item => (
          <GapCard key={item.kr.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Selected KR state ─────────────────────────────────────────────────────────

interface SelectedKR {
  kr: TreeKR;
  parent: ObjectiveTreeNode;
  parentLayer: Layer;
}

// ── KR Detail panel ───────────────────────────────────────────────────────────

function KRDetailPanel({ kr, parent, parentLayer, onClose }: SelectedKR & { onClose: () => void }) {
  const pct         = Math.min(100, kr.progress);
  const covColor    = pct >= 70 ? "#059669" : pct >= 40 ? "#D97706" : "#DC2626";
  const layerCfg    = LAYER_CFG[parentLayer];
  const rd          = kr.refs_data;
  const mainText    = kr.description ?? kr.title;
  const kpiText     = kr.kpi_description ?? (kr.description ? kr.title : null);
  const catInfo     = kr.kr_category ? KR_CAT[kr.kr_category] : null;
  const typeInfo    = KR_TYPE[kr.type] ?? { label: kr.type, bg: "#F1F5F9", text: "#475569" };
  const hasLinks    = rd && ((rd.links_down?.annual?.length ?? 0) + (rd.links_down?.quarterly?.length ?? 0) + (rd.links_up?.length ?? 0)) > 0;
  const hasFoda     = (rd?.foda?.length ?? 0) > 0;
  const hasSugef    = (rd?.sugef?.length ?? 0) > 0;
  const hasDeps     = (rd?.deps?.length ?? 0) > 0;

  return (
    <div className="absolute right-0 top-0 bottom-0 z-30 w-80 flex flex-col bg-background border-l border-border shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0 border-l-4" style={{ borderLeftColor: catInfo?.bg ?? layerCfg.lineColor }}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {kr.code && <span className="text-[8px] font-mono text-muted-foreground/50">{kr.code}</span>}
              {catInfo
                ? <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded" style={{ background: catInfo.bg, color: catInfo.text }}>{catInfo.label}</span>
                : <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded" style={{ background: typeInfo.bg, color: typeInfo.text }}>{typeInfo.label}</span>
              }
            </div>
            <p className="text-[13px] font-semibold text-foreground leading-snug">{mainText}</p>
            {kpiText && <p className="text-[10px] text-muted-foreground italic mt-1 leading-snug">{kpiText}</p>}
          </div>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Progress */}
        <div className="px-4 pt-4 pb-3 border-b border-border/30">
          <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Progreso</p>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-bold font-mono tabular-nums" style={{ color: covColor }}>{kr.progress}%</span>
            <div className="flex-1 mb-2"><BarNeutral value={kr.progress} /></div>
          </div>
          <div className="flex items-center gap-2 text-[9.5px] text-muted-foreground flex-wrap gap-y-1">
            <span>Confianza</span>
            <ConfidenceDots value={kr.confidence} />
            <span className="font-mono">{Math.round(kr.confidence * 100)}%</span>
            <span className="text-border mx-1">·</span>
            <TrendIcon trend={kr.trend} />
            <span>{kr.trend === "up" ? "Subiendo" : kr.trend === "down" ? "Bajando" : "Sin cambio"}</span>
          </div>
        </div>

        {/* Metric */}
        {kr.current_value != null && (
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Métrica</p>
            <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
              {[["Inicial", kr.current_value === 0 ? "—" : formatKRValue(kr.current_value, kr.metric_unit)],
                ["Actual",  formatKRValue(kr.current_value, kr.metric_unit)],
                ["Meta",    formatKRValue(kr.target_value, kr.metric_unit)]
              ].map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{lbl}</span>
                  <span className="font-mono font-semibold tabular-nums">{val}</span>
                </div>
              ))}
              <div className="pt-1"><BarNeutral value={kr.progress} /></div>
            </div>
          </div>
        )}

        {/* Cascade */}
        {hasLinks && (
          <div className="px-4 py-3 border-b border-border/30 space-y-2.5">
            <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">Cascada</p>
            {(rd!.links_down?.annual?.length ?? 0) > 0 && (
              <div>
                <p className="text-[8px] font-semibold mb-1.5" style={{ color: LAYER_CFG.annual.lineColor }}>→ Anual</p>
                <div className="space-y-1">
                  {rd!.links_down!.annual!.map((lbl, i) => (
                    <div key={i} className="rounded-md px-2.5 py-1.5 text-[10px] font-mono border-l-2"
                         style={{ background: LAYER_CFG.annual.chipBg, color: LAYER_CFG.annual.chipText, borderColor: LAYER_CFG.annual.lineColor }}>
                      {lbl}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(rd!.links_down?.quarterly?.length ?? 0) > 0 && (
              <div>
                <p className="text-[8px] font-semibold mb-1.5" style={{ color: LAYER_CFG.quarterly.lineColor }}>→ Trimestral</p>
                <div className="space-y-1">
                  {rd!.links_down!.quarterly!.map((lbl, i) => (
                    <div key={i} className="rounded-md px-2.5 py-1.5 text-[10px] font-mono border-l-2"
                         style={{ background: LAYER_CFG.quarterly.chipBg, color: LAYER_CFG.quarterly.chipText, borderColor: LAYER_CFG.quarterly.lineColor }}>
                      {lbl}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(rd!.links_up?.length ?? 0) > 0 && (
              <div>
                <p className="text-[8px] font-semibold mb-1.5 text-muted-foreground">↑ Conecta hacia arriba</p>
                <div className="space-y-1">
                  {rd!.links_up!.map((lbl, i) => (
                    <div key={i} className="rounded-md px-2.5 py-1.5 text-[10px] font-mono border-l-2"
                         style={{ background: "#F0EEFD", color: "#4E43AA", borderColor: "#4E43AA" }}>
                      ↑ {lbl}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!hasLinks && parentLayer !== "quarterly" && (
          <div className="px-4 py-3 border-b border-border/30">
            <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 p-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-rose-600 dark:text-rose-400 leading-relaxed">Sin cascada registrada hacia capas inferiores.</p>
              </div>
            </div>
          </div>
        )}

        {/* Gap + Recommendation */}
        {(kr.gap_note || kr.recommendation) && (
          <div className="px-4 py-3 border-b border-border/30 space-y-2.5">
            {kr.gap_note && (
              <>
                <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">Análisis de brecha</p>
                <div className="rounded-r-md border-l-2 border-rose-500 bg-rose-50 dark:bg-rose-900/10 px-3 py-2">
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">{kr.gap_note}</p>
                </div>
              </>
            )}
            {kr.recommendation && (
              <>
                <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">Recomendación</p>
                <div className="rounded-r-md border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/10 px-3 py-2">
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed"><strong>➜ </strong>{kr.recommendation}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* References: FODA / SUGEF / Deps */}
        {(hasFoda || hasSugef || hasDeps) && (
          <div className="px-4 py-3 border-b border-border/30 space-y-3">
            {hasFoda && (
              <div>
                <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">FODA — PEI</p>
                <div className="space-y-1.5">
                  {rd!.foda!.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md px-2 py-1.5 bg-blue-50 dark:bg-blue-900/10">
                      <span className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 text-white" style={{ background: "#1860A8" }}>{f.code}</span>
                      <span className="text-[10px] text-foreground/80 leading-snug">{f.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!hasFoda && (
              <p className="text-[10px] text-muted-foreground/60 italic">Sin referencia FODA</p>
            )}
            {hasSugef && (
              <div>
                <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">SUGEF</p>
                <div className="space-y-1.5">
                  {rd!.sugef!.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md px-2 py-1.5" style={{ background: "#FEF0F0" }}>
                      <span className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 text-white" style={{ background: "#B83030" }}>SUGEF {s.code}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-foreground/80 leading-snug">{s.desc}</p>
                        {s.status && (
                          <span className={cn("text-[8px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block",
                            s.status === "atiende" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                            {s.status === "atiende" ? "Atiende" : "Evidencia inicial"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground/50 italic mt-2 leading-relaxed border-l-2 border-rose-300 pl-2">
                  El cierre formal lo determina SUGEF en visita de seguimiento — estos KRs generan evidencia.
                </p>
              </div>
            )}
            {hasDeps && (
              <div>
                <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dependencias</p>
                <div className="space-y-1.5">
                  {rd!.deps!.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md px-2 py-1.5" style={{ background: "#F0EEFD" }}>
                      <span className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 text-white" style={{ background: "#4E43AA" }}>{d.pilar}</span>
                      <span className="text-[10px] text-foreground/80 leading-snug">{d.rel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Parent OKR */}
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Objetivo padre</p>
          <div className="rounded-lg overflow-hidden border border-border/50">
            <div className="px-3 py-1.5" style={{ background: layerCfg.bg }}>
              <p className="text-[8px] font-mono text-white/70 uppercase">{layerCfg.tag}</p>
            </div>
            <div className="px-3 py-2 bg-muted/30">
              {parent.code && <p className="text-[8px] font-mono text-muted-foreground/50 mb-0.5">{parent.code}</p>}
              <p className="text-[11px] text-foreground/80 leading-snug">{parent.title}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="px-4 py-3">
          <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Estado</p>
          <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full",
            kr.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : kr.status === "AT_RISK"   ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
          : "bg-muted text-muted-foreground")}>
            {kr.status === "COMPLETED" ? "Completado" : kr.status === "AT_RISK" ? "En riesgo" : kr.status === "ACTIVE" ? "Activo" : kr.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Orphan section label ──────────────────────────────────────────────────────

function OrphanLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-3">
      <div className="flex-1 h-px" style={{ background: LINE, opacity: .3 }} />
      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider px-2 shrink-0">{label}</span>
      <div className="flex-1 h-px" style={{ background: LINE, opacity: .3 }} />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  stratObjs:          ObjectiveTreeNode[];
  annualObjs:         ObjectiveTreeNode[];
  quarterlyObjs:      ObjectiveTreeNode[];
  initiatives?:       unknown[];
  objectiveLinks?:    unknown[];
  externalSelection?: { id: string; layer: string } | null;
}

// ── Main component ────────────────────────────────────────────────────────────

export function TraceabilityDeployTree({ stratObjs, annualObjs, quarterlyObjs }: Props) {
  const [openIds,        setOpenIds]        = useState<Set<string>>(new Set());
  const [searchText,     setSearchText]     = useState("");
  const [coverageFilter, setCoverageFilter] = useState<Coverage | null>(null);
  const [selectedKR,     setSelectedKR]     = useState<SelectedKR | null>(null);
  const [activeTab,      setActiveTab]      = useState<"tree" | "gaps">("tree");

  function toggle(id: string) {
    setOpenIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function expandAll() {
    setOpenIds(new Set([...stratObjs, ...annualObjs, ...quarterlyObjs].map(o => o.id)));
  }
  function collapseAll() { setOpenIds(new Set()); }

  // ── Maps ──────────────────────────────────────────────────────────────────

  const annualByParent = useMemo(() => {
    const m = new Map<string, ObjectiveTreeNode[]>();
    for (const o of annualObjs) {
      if (!o.parent_objective_id) continue;
      const a = m.get(o.parent_objective_id) ?? []; a.push(o); m.set(o.parent_objective_id, a);
    }
    return m;
  }, [annualObjs]);

  const quarterlyByParent = useMemo(() => {
    const m = new Map<string, ObjectiveTreeNode[]>();
    for (const o of quarterlyObjs) {
      if (!o.parent_objective_id) continue;
      const a = m.get(o.parent_objective_id) ?? []; a.push(o); m.set(o.parent_objective_id, a);
    }
    return m;
  }, [quarterlyObjs]);

  // ── Coverage ──────────────────────────────────────────────────────────────

  const coverageMap = useMemo(() => {
    const m = new Map<string, Coverage>();
    for (const o of quarterlyObjs) m.set(o.id, computeObjCoverage(o, 0, true));
    for (const o of annualObjs)    m.set(o.id, computeObjCoverage(o, quarterlyByParent.get(o.id)?.length ?? 0));
    for (const o of stratObjs)     m.set(o.id, computeObjCoverage(o, annualByParent.get(o.id)?.length ?? 0));
    return m;
  }, [stratObjs, annualObjs, quarterlyObjs, annualByParent, quarterlyByParent]);

  const coverageStats = useMemo(() => {
    let ok = 0, partial = 0, gap = 0;
    for (const c of coverageMap.values()) { if (c === "ok") ok++; else if (c === "partial") partial++; else gap++; }
    return { total: coverageMap.size, ok, partial, gap };
  }, [coverageMap]);

  // ── Gap items ─────────────────────────────────────────────────────────────

  const gapItems = useMemo<GapItem[]>(() => {
    const items: GapItem[] = [];
    const addKRs = (objs: ObjectiveTreeNode[], layer: Layer) => {
      for (const obj of objs) {
        const objCov = coverageMap.get(obj.id) ?? "partial";
        for (const kr of obj.key_results) {
          const krCov = computeKRCoverage(kr, objCov);
          if (krCov !== "ok") items.push({ kr, parent: obj, cov: krCov, layer });
        }
      }
    };
    addKRs(stratObjs, "strategic");
    addKRs(annualObjs, "annual");
    addKRs(quarterlyObjs, "quarterly");
    return items;
  }, [stratObjs, annualObjs, quarterlyObjs, coverageMap]);

  // ── Filter ────────────────────────────────────────────────────────────────

  const q = searchText.toLowerCase();

  function matchesSearch(obj: ObjectiveTreeNode): boolean {
    if (!q) return true;
    return obj.title.toLowerCase().includes(q) ||
      (obj.code ?? "").toLowerCase().includes(q) ||
      obj.key_results.some(kr => (kr.description ?? kr.title).toLowerCase().includes(q));
  }

  function matchesCov(id: string): boolean {
    return !coverageFilter || coverageMap.get(id) === coverageFilter;
  }

  const fStrat     = stratObjs.filter(o => matchesSearch(o) && matchesCov(o.id));
  const fAnnual    = annualObjs.filter(o => matchesSearch(o) && matchesCov(o.id));
  const fQuarterly = quarterlyObjs.filter(o => matchesSearch(o) && matchesCov(o.id));

  // Orphan detection
  const pairedAnnualIds = new Set(fAnnual.filter(o => o.parent_objective_id && fStrat.some(s => s.id === o.parent_objective_id)).map(o => o.id));
  const unpairedAnnual  = fAnnual.filter(o => !pairedAnnualIds.has(o.id));
  const pairedQIds      = new Set(fQuarterly.filter(o => o.parent_objective_id && fAnnual.some(a => a.id === o.parent_objective_id)).map(o => o.id));
  const unpairedQt      = fQuarterly.filter(o => !pairedQIds.has(o.id));

  const isEmpty    = stratObjs.length === 0 && annualObjs.length === 0 && quarterlyObjs.length === 0;
  const noResults  = !isEmpty && fStrat.length === 0 && unpairedAnnual.length === 0 && unpairedQt.length === 0;

  // ── Render annual column ──────────────────────────────────────────────────

  function renderAnnualColumn(annual: ObjectiveTreeNode) {
    const qtList   = (quarterlyByParent.get(annual.id) ?? []).filter(qt => fQuarterly.some(fq => fq.id === qt.id));
    const cov      = coverageMap.get(annual.id) ?? "partial";
    const isOpen   = openIds.has(annual.id);
    return (
      <div key={annual.id} className="flex flex-col min-w-0">
        <OKRBox obj={annual} layer="annual" coverage={cov} isOpen={isOpen}
                highlight={!!(q && matchesSearch(annual))}
                onToggle={() => toggle(annual.id)}
                onKRSelect={kr => setSelectedKR({ kr, parent: annual, parentLayer: "annual" })} />
        {isOpen && qtList.map(qt => (
          <div key={qt.id}>
            <VerticalLine height={20} />
            <OKRBox obj={qt} layer="quarterly" coverage={coverageMap.get(qt.id) ?? "partial"}
                    isOpen={openIds.has(qt.id)}
                    highlight={!!(q && matchesSearch(qt))}
                    onToggle={() => toggle(qt.id)}
                    onKRSelect={kr => setSelectedKR({ kr, parent: qt, parentLayer: "quarterly" })} />
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <Target className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm font-medium text-muted-foreground">Sin ciclos activos</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Activa ciclos estratégico, anual y trimestral para ver el árbol de despliegue.
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="relative h-full overflow-hidden flex flex-col">

      {/* Coverage strip */}
      <CoverageStrip {...coverageStats} />

      {/* Toolbar */}
      <div className="bg-card border-b border-border/60 px-4 py-2 flex items-center gap-3 flex-wrap gap-y-2 shrink-0">
        {/* Search */}
        <div className="relative min-w-[160px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
          <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                 placeholder="Buscar OKRs o KRs…"
                 className="w-full h-8 pl-8 pr-8 text-xs bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50" />
          {searchText && (
            <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Coverage filter pills */}
        <div className="flex gap-1 flex-wrap shrink-0">
          {([null, "ok", "partial", "gap"] as const).map(f => (
            <button key={f ?? "all"} onClick={() => setCoverageFilter(f)}
                    className={cn("text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all",
                      coverageFilter === f
                        ? f === null ? "bg-foreground text-background border-foreground" : "text-white border-transparent"
                        : "bg-card border-border/60 text-muted-foreground hover:border-primary/30")}
                    style={coverageFilter === f && f !== null ? { background: COV_CFG[f].dot } : {}}>
              {f === null ? "Todos" : COV_CFG[f].label}
            </button>
          ))}
        </div>

        {/* Expand / Collapse */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={expandAll} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">Expandir</button>
          <span className="text-muted-foreground/30 text-[10px]">·</span>
          <button onClick={collapseAll} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">Colapsar</button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-auto bg-muted/50 rounded-lg p-0.5 shrink-0">
          <button onClick={() => setActiveTab("tree")}
                  className={cn("flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium rounded-md transition-all",
                    activeTab === "tree" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Layers className="h-3 w-3" />Árbol
          </button>
          <button onClick={() => setActiveTab("gaps")}
                  className={cn("flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium rounded-md transition-all",
                    activeTab === "gaps" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <BarChart2 className="h-3 w-3" />
            Brechas
            {gapItems.length > 0 && (
              <span className={cn("text-[9px] font-bold px-1 rounded-full text-white min-w-[16px] text-center",
                gapItems.some(g => g.cov === "gap") ? "bg-rose-500" : "bg-amber-500")}>
                {gapItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className={cn("flex-1 overflow-hidden flex", selectedKR && activeTab === "tree" && "")}>

        {/* ── Tree panel ── */}
        {activeTab === "tree" && (
          <div className={cn("flex-1 overflow-y-auto", selectedKR && "mr-80")} style={{ minWidth: 0 }}>
            <div className="py-4 px-4 max-w-5xl mx-auto">

              {noResults && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Sin resultados</p>
                  <button onClick={() => { setSearchText(""); setCoverageFilter(null); }} className="text-xs text-primary hover:underline">Limpiar filtros</button>
                </div>
              )}

              {/* Strategic OKRs */}
              <div className="space-y-8">
                {fStrat.map(strat => {
                  const annuals  = (annualByParent.get(strat.id) ?? []).filter(a => fAnnual.some(fa => fa.id === a.id));
                  const cov      = coverageMap.get(strat.id) ?? "partial";
                  const stratOpen = openIds.has(strat.id);
                  return (
                    <div key={strat.id}>
                      <OKRBox obj={strat} layer="strategic" coverage={cov}
                              isOpen={stratOpen}
                              highlight={!!(q && matchesSearch(strat))}
                              onToggle={() => toggle(strat.id)}
                              onKRSelect={kr => setSelectedKR({ kr, parent: strat, parentLayer: "strategic" })} />
                      {stratOpen && annuals.length > 0 && (
                        <>
                          <TConnector colCount={annuals.length} />
                          <div className="grid gap-4 items-start"
                               style={{ gridTemplateColumns: `repeat(${Math.min(annuals.length, 3)}, 1fr)` }}>
                            {annuals.map(renderAnnualColumn)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Orphan annual */}
              {unpairedAnnual.length > 0 && (
                <>
                  <OrphanLabel label={stratObjs.length > 0 ? "Anuales sin alineación estratégica" : "OKRs Anuales"} />
                  <div className="grid gap-4 items-start" style={{ gridTemplateColumns: `repeat(${Math.min(unpairedAnnual.length, 3)}, 1fr)` }}>
                    {unpairedAnnual.map(renderAnnualColumn)}
                  </div>
                </>
              )}

              {/* Orphan quarterly */}
              {unpairedQt.length > 0 && (
                <>
                  <OrphanLabel label={annualObjs.length > 0 ? "Trimestrales sin OKR anual padre" : "OKRs Trimestrales"} />
                  <div className="grid gap-4 items-start" style={{ gridTemplateColumns: `repeat(${Math.min(unpairedQt.length, 3)}, 1fr)` }}>
                    {unpairedQt.map(o => (
                      <OKRBox key={o.id} obj={o} layer="quarterly" coverage={coverageMap.get(o.id) ?? "partial"}
                              isOpen={openIds.has(o.id)} highlight={!!(q && matchesSearch(o))}
                              onToggle={() => toggle(o.id)}
                              onKRSelect={kr => setSelectedKR({ kr, parent: o, parentLayer: "quarterly" })} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Gaps panel ── */}
        {activeTab === "gaps" && (
          <div className="flex-1 overflow-hidden flex flex-col" style={{ minWidth: 0 }}>
            <GapsPanel items={gapItems} />
          </div>
        )}

        {/* ── KR Detail panel ── */}
        {selectedKR && activeTab === "tree" && (
          <KRDetailPanel {...selectedKR} onClose={() => setSelectedKR(null)} />
        )}
      </div>
    </div>
  );
}
