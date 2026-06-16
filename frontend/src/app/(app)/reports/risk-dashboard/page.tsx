"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useRiskDashboard } from "@/hooks/useReports";
import { useRunRiskSentinel, type RiskSentinelReport, type EarlyWarning, type EarlyWarningAction } from "@/hooks/useAI";
import type { AtRiskKr } from "@/hooks/useCheckIns";
import {
  AlertTriangle, Bot, CheckCircle2, Clock, TrendingDown,
  Loader2, ChevronDown, ChevronUp, Flame, Zap, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ZAxis, ReferenceLine, Cell,
  BarChart, Bar, LabelList,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Level metadata ─────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<string, string> = {
  COMPANY:    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  AREA:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  TEAM:       "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  INDIVIDUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const LEVEL_SCATTER_COLOR: Record<string, string> = {
  COMPANY: "#8b5cf6", AREA: "#3b82f6", TEAM: "#6366f1", INDIVIDUAL: "#64748b",
};
const LEVEL_LABEL: Record<string, string> = {
  COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo", INDIVIDUAL: "Individual",
};

// ── Risk Matrix Scatter ────────────────────────────────────────────────────────

function RiskScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border bg-popover p-3 shadow-xl text-xs max-w-52 space-y-1.5">
      {d.krCode && <span className="text-[10px] font-mono text-muted-foreground">{d.krCode}</span>}
      <p className="font-semibold text-popover-foreground leading-snug">{d.title}</p>
      <p className="text-muted-foreground truncate">{d.objCode ? `${d.objCode} · ` : ""}{d.obj}</p>
      <div className="grid grid-cols-2 gap-x-3 pt-1 border-t">
        <div>
          <p className="text-muted-foreground">Progreso</p>
          <p className={cn("font-bold", d.x < 40 ? "text-red-500" : d.x < 70 ? "text-amber-500" : "text-green-600")}>
            {d.x}%
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Confianza</p>
          <p className={cn("font-bold", d.y < 40 ? "text-red-500" : d.y < 70 ? "text-amber-500" : "text-green-600")}>
            {d.y}%
          </p>
        </div>
        <div className="col-span-2 mt-1">
          <p className="text-muted-foreground">Sin check-in</p>
          <p className={cn("font-bold", d.days > 14 ? "text-red-500" : d.days > 7 ? "text-amber-500" : "text-green-600")}>
            {d.days === 999 ? "Nunca" : `${d.days} días`}
          </p>
        </div>
      </div>
    </div>
  );
}

function RiskMatrix({ krs }: { krs: AtRiskKr[] }) {
  const data = krs.map(k => ({
    x: Math.round(Number(k.progress)),
    y: Math.round(Number(k.confidence) * 100),
    days: k.days_since_checkin,
    z: Math.max(40, Math.min(300, k.days_since_checkin === 999 ? 300 : k.days_since_checkin * 8 + 50)),
    title: k.kr_title,
    obj: k.objective_title,
    level: k.objective_level,
    krCode: k.kr_code,
    objCode: k.obj_code,
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
        {Object.entries(LEVEL_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: LEVEL_SCATTER_COLOR[k] }} />
            {v}
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <span className="h-3 w-3 rounded-full bg-muted-foreground/40" />
          <span className="h-4 w-4 rounded-full bg-muted-foreground/40" />
          <span>Tamaño = días sin check-in</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 16, right: 20, left: -10, bottom: 24 }}>
          {/* Danger zone background */}
          <defs>
            <linearGradient id="dangerGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" dataKey="x" domain={[0, 100]} name="Progreso"
            label={{ value: "Progreso (%)", position: "insideBottom", offset: -14, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} name="Confianza"
            label={{ value: "Confianza (%)", angle: -90, position: "insideLeft", offset: 16, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tick={{ fontSize: 10 }} />
          <ZAxis type="number" dataKey="z" range={[40, 320]} />
          <ReferenceLine x={40} stroke="#ef4444" strokeDasharray="6 4" strokeWidth={1.5}
            label={{ value: "40%", position: "top", fontSize: 9, fill: "#ef4444" }} />
          <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="6 4" strokeWidth={1.5}
            label={{ value: "40%", position: "right", fontSize: 9, fill: "#ef4444" }} />
          <Tooltip content={<RiskScatterTooltip />} cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--muted-foreground))" }} />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={LEVEL_SCATTER_COLOR[d.level] ?? "#64748b"} fillOpacity={0.78} stroke="white" strokeWidth={1} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs text-muted-foreground justify-end">
        <div className="flex items-center gap-1.5">
          <div className="h-3 border border-red-400 w-10 flex items-center">
            <div className="w-full border-t-2 border-dashed border-red-400" />
          </div>
          Zona de riesgo crítico (confianza y progreso &lt; 40%)
        </div>
      </div>
    </div>
  );
}

// ── Confidence bar chart ───────────────────────────────────────────────────────

function ConfidenceBar({ krs }: { krs: AtRiskKr[] }) {
  const byLevel = ["COMPANY", "AREA", "TEAM", "INDIVIDUAL"].map(l => {
    const items = krs.filter(k => k.objective_level === l);
    if (!items.length) return null;
    const avgConf = Math.round(items.reduce((s, k) => s + Number(k.confidence), 0) / items.length * 100);
    const avgProg = Math.round(items.reduce((s, k) => s + Number(k.progress), 0) / items.length);
    return { level: LEVEL_LABEL[l], conf: avgConf, prog: avgProg, fill: LEVEL_SCATTER_COLOR[l], count: items.length };
  }).filter(Boolean) as { level: string; conf: number; prog: number; fill: string; count: number }[];

  if (!byLevel.length) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={byLevel} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="level" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v, name) => [`${v}%`, name === "conf" ? "Confianza avg." : "Progreso avg."]}
          contentStyle={{ borderRadius: 8, fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", color: "hsl(var(--popover-foreground))" }}
        />
        <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
        <Bar dataKey="conf" radius={[4, 4, 0, 0]} name="conf">
          {byLevel.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
          <LabelList dataKey="conf" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        </Bar>
        <Bar dataKey="prog" radius={[4, 4, 0, 0]} name="prog" fillOpacity={0.4}>
          {byLevel.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, variant }: {
  label: string; value: number; icon: React.ElementType; variant?: "danger" | "warn" | "neutral";
}) {
  const colors = {
    danger:  "text-red-500 bg-red-50 dark:bg-red-900/20",
    warn:    "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
    neutral: "text-muted-foreground bg-muted",
  };
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", colors[variant ?? "neutral"])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

// ── At-Risk KR card ───────────────────────────────────────────────────────────

function AtRiskCard({ kr }: { kr: AtRiskKr }) {
  const conf = Math.round(Number(kr.confidence) * 100);
  const prog = Math.round(Number(kr.progress));
  return (
    <Card className="p-4 space-y-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", LEVEL_BADGE[kr.objective_level] ?? LEVEL_BADGE.INDIVIDUAL)}>
              {LEVEL_LABEL[kr.objective_level] ?? kr.objective_level}
            </span>
            {kr.days_since_checkin > 14 && (
              <span className="text-[10px] text-red-500 font-medium flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {kr.days_since_checkin === 999 ? "Nunca" : `${kr.days_since_checkin}d`}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            {kr.kr_code && (
              <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{kr.kr_code}</span>
            )}
            <p className="text-sm font-medium truncate">{kr.kr_title}</p>
          </div>
          <div className="flex items-baseline gap-1.5">
            {kr.obj_code && (
              <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">{kr.obj_code}</span>
            )}
            <p className="text-xs text-muted-foreground truncate">{kr.objective_title}</p>
          </div>
        </div>
      </div>
      {/* Mini dual bar */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-14">Progreso</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", prog < 40 ? "bg-red-500" : prog < 70 ? "bg-amber-500" : "bg-green-500")}
              style={{ width: `${prog}%` }} />
          </div>
          <span className="w-6 text-right font-semibold">{prog}%</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-14">Confianza</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", conf < 40 ? "bg-red-500" : conf < 70 ? "bg-amber-500" : "bg-green-500")}
              style={{ width: `${conf}%` }} />
          </div>
          <span className="w-6 text-right font-semibold">{conf}%</span>
        </div>
      </div>
      {kr.owner_name && (
        <p className="text-xs text-muted-foreground">Responsable: {kr.owner_name}</p>
      )}
    </Card>
  );
}

// ── Early Warnings Section ─────────────────────────────────────────────────────

const URGENCY_STYLE: Record<string, string> = {
  critical: "border-red-300 bg-red-50/60 dark:border-red-700/60 dark:bg-red-950/30",
  high:     "border-amber-300 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-950/30",
  medium:   "border-yellow-200 bg-yellow-50/40 dark:border-yellow-700/40 dark:bg-yellow-950/20",
};
const URGENCY_ICON_STYLE: Record<string, string> = {
  critical: "text-red-500",
  high:     "text-amber-500",
  medium:   "text-yellow-500",
};
const URGENCY_LABEL: Record<string, string> = {
  critical: "Crítico", high: "Alta", medium: "Media",
};

function EarlyWarningCard({ warning, action }: { warning: EarlyWarning; action?: EarlyWarningAction }) {
  const urgency = action?.urgency ?? (warning.projected_progress < 40 ? "critical" : warning.projected_progress < 55 ? "high" : "medium");
  const delta = warning.projected_progress - warning.current_progress;

  return (
    <Card className={cn("p-4 space-y-3 border", URGENCY_STYLE[urgency])}>
      <div className="flex items-start gap-2">
        <Flame className={cn("h-4 w-4 mt-0.5 shrink-0", URGENCY_ICON_STYLE[urgency])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", LEVEL_BADGE[warning.level] ?? LEVEL_BADGE.INDIVIDUAL)}>
              {LEVEL_LABEL[warning.level] ?? warning.level}
            </span>
            <span className={cn("text-[10px] font-semibold uppercase tracking-wide", URGENCY_ICON_STYLE[urgency])}>
              {URGENCY_LABEL[urgency]}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-2">{warning.objective_title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {warning.days_remaining} días restantes · {warning.pace_per_day}%/día
          </p>
        </div>
      </div>

      {/* Dual progress bar: current vs projected */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-16 shrink-0">Hoy</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${warning.current_progress}%` }} />
          </div>
          <span className="w-7 text-right font-semibold text-blue-600 dark:text-blue-400">{warning.current_progress}%</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-16 shrink-0">Proyectado</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden relative">
            <div
              className={cn("h-full rounded-full", warning.projected_progress < 40 ? "bg-red-400" : warning.projected_progress < 60 ? "bg-amber-400" : "bg-yellow-400")}
              style={{ width: `${warning.projected_progress}%` }}
            />
            {/* Target line at 70% */}
            <div className="absolute top-0 bottom-0 w-px bg-green-500/60" style={{ left: "70%" }} />
          </div>
          <span className={cn("w-7 text-right font-semibold", warning.projected_progress < 50 ? "text-red-500" : "text-amber-500")}>
            {warning.projected_progress}%
          </span>
        </div>
        {delta !== 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
            <TrendingUp className="h-3 w-3" />
            <span>+{delta}pp al cierre · meta recomendada: ≥70%</span>
          </div>
        )}
      </div>

      {action && (
        <div className="pt-2 border-t border-current/10">
          <div className="flex items-start gap-1.5">
            <Zap className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/80 leading-relaxed">{action.action}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function EarlyWarningsSection({
  warnings, warningsAnalysis, warningActions,
}: {
  warnings: EarlyWarning[];
  warningsAnalysis: string;
  warningActions: EarlyWarningAction[];
}) {
  if (!warnings.length) return null;

  const getAction = (title: string) =>
    warningActions.find((a) => a.objective.toLowerCase().includes(title.toLowerCase().slice(0, 20)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Alertas tempranas — {warnings.length} objetivo{warnings.length !== 1 ? "s" : ""} en riesgo de fallar
        </h2>
      </div>
      {warningsAnalysis && (
        <Card className="p-4 border-amber-200 bg-amber-50/30 dark:border-amber-700/40 dark:bg-amber-950/20">
          <p className="text-sm text-foreground/90 leading-relaxed">{warningsAnalysis}</p>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {warnings.map((w) => (
          <EarlyWarningCard key={w.objective_id} warning={w} action={getAction(w.objective_title)} />
        ))}
      </div>
    </div>
  );
}

// ── Sentinel Analysis ─────────────────────────────────────────────────────────

function SentinelReport({ report, generatedAt }: { report: RiskSentinelReport | Record<string, unknown>; generatedAt?: string }) {
  const [expanded, setExpanded] = useState(false);
  const r = report as RiskSentinelReport;
  return (
    <Card className="p-5 space-y-4 border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <span className="font-semibold text-sm">Análisis del Risk Sentinel</span>
        </div>
        {generatedAt && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(generatedAt).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      {r.analysis && <p className="text-sm text-foreground/90 leading-relaxed">{r.analysis}</p>}
      {r.priorities?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prioridades</p>
          <ul className="space-y-1">
            {r.priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />{p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.recommendations?.length > 0 && (
        <>
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Ocultar" : "Ver"} recomendaciones
          </button>
          {expanded && (
            <ul className="space-y-1">
              {r.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />{rec}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RiskDashboardPage() {
  const { data, isLoading, refetch } = useRiskDashboard();
  const sentinel = useRunRiskSentinel();
  const [sentinelResult, setSentinelResult] = useState<RiskSentinelReport | null>(null);

  async function runSentinel() {
    const res = await sentinel.mutateAsync({});
    setSentinelResult(res);
    refetch();
  }

  const lastSentinelContent = sentinelResult
    ? (sentinelResult as unknown as Record<string, unknown>)
    : data?.last_sentinel_run?.content ?? null;
  const lastSentinelAt = sentinelResult ? sentinelResult.generated_at : data?.last_sentinel_run?.created_at;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Risk Dashboard"
        description={data?.cycle ? `Ciclo: ${data.cycle.name}` : "Ciclo activo"}
        actions={
          <Button onClick={runSentinel} disabled={sentinel.isPending} className="gap-2" size="sm">
            {sentinel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {sentinel.isPending ? "Analizando…" : "Ejecutar Risk Sentinel"}
          </Button>
        }
      />

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="KRs en riesgo" value={data.summary.total_at_risk} icon={AlertTriangle}
            variant={data.summary.total_at_risk > 0 ? "danger" : "neutral"} />
          <StatCard label="Nivel empresa" value={data.summary.company_level} icon={TrendingDown}
            variant={data.summary.company_level > 0 ? "danger" : "neutral"} />
          <StatCard label="Sin check-in +14 días" value={data.summary.stale_14d} icon={Clock}
            variant={data.summary.stale_14d > 3 ? "warn" : "neutral"} />
        </div>
      ) : null}

      {/* ── Early Warnings ── */}
      {lastSentinelContent && (() => {
        const r = lastSentinelContent as unknown as RiskSentinelReport;
        const warnings = r.early_warnings ?? [];
        if (!warnings.length) return null;
        return (
          <EarlyWarningsSection
            warnings={warnings}
            warningsAnalysis={r.early_warnings_analysis ?? ""}
            warningActions={r.early_warning_actions ?? []}
          />
        );
      })()}

      {/* ── Risk Matrix ── */}
      {data?.at_risk && data.at_risk.length > 0 && (
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Matriz de riesgo — Confianza vs Progreso
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada burbuja es un KR. Zona roja = requiere acción inmediata. Tamaño = días sin check-in.
            </p>
          </div>
          <RiskMatrix krs={data.at_risk} />
        </Card>
      )}

      {/* ── Confidence by level ── */}
      {data?.at_risk && data.at_risk.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Confianza y progreso promedio por nivel
          </h2>
          <ConfidenceBar krs={data.at_risk} />
          <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded bg-slate-500/85" /> Confianza</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded bg-slate-500/40" /> Progreso</div>
          </div>
        </Card>
      )}

      {/* Sentinel report */}
      {lastSentinelContent && (
        <SentinelReport report={lastSentinelContent} generatedAt={lastSentinelAt} />
      )}

      {/* At-Risk KR grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          KRs en riesgo — detalle
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : !data?.at_risk.length ? (
          <EmptyState icon={CheckCircle2} title="Sin KRs en riesgo" description="Todos los KRs están en camino. ¡Sigue así!" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.at_risk.map(kr => <AtRiskCard key={kr.id} kr={kr} />)}
          </div>
        )}
      </div>

      {/* Cadence issues */}
      {data?.cadence && data.cadence.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Cadencia — check-ins vencidos
            </h2>
            {data.cadence.length > 10 && (
              <span className="text-xs text-muted-foreground">{data.cadence.length} en total — mostrando los 10 más críticos</span>
            )}
          </div>
          <Card className="divide-y overflow-hidden">
            {data.cadence.slice(0, 10).map(entry => (
              <div key={entry.kr_id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.kr_title}</p>
                  <p className="text-xs text-muted-foreground truncate">{entry.objective_title}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.owner_name && (
                    <span className="text-xs text-muted-foreground hidden sm:block">{entry.owner_name}</span>
                  )}
                  <Badge variant="secondary" className={cn("text-[10px] tabular-nums",
                    entry.days_since_checkin > 14 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                    entry.days_since_checkin > 7  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "")}>
                    <Clock className="h-2.5 w-2.5 mr-1" />
                    {entry.days_since_checkin === 999 ? "Nunca" : `${entry.days_since_checkin}d`}
                  </Badge>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
