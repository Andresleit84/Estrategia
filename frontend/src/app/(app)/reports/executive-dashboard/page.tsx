"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  useExecutiveDashboard, useWeeklyTrend, useActivityFeed, useRiskDashboard,
  useCycleProjection, type CycleProjection,
} from "@/hooks/useReports";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Download,
  RefreshCw, Activity, Zap, Clock, CheckSquare, Building2,
  Users, User, Circle, Target, Minus,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
  BarChart, Bar, Cell, LabelList,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Level metadata ─────────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  COMPANY:    { label: "Empresa",    color: "#8b5cf6", Icon: Building2 },
  AREA:       { label: "Área",       color: "#3b82f6", Icon: Users },
  TEAM:       { label: "Equipo",     color: "#6366f1", Icon: Users },
  INDIVIDUAL: { label: "Individual", color: "#64748b", Icon: User },
};

const LEVEL_COLORS_SCATTER: Record<string, string> = {
  COMPANY: "#8b5cf6", AREA: "#3b82f6", TEAM: "#6366f1", INDIVIDUAL: "#64748b",
};

const MOOD_EMOJI: Record<string, string> = {
  GREAT: "🚀", GOOD: "😊", NEUTRAL: "😐", CONCERNED: "😟", BLOCKED: "🚫",
};

// ── "Last updated" ticker ──────────────────────────────────────────────────────

function useSince(ts: Date | null) {
  const [label, setLabel] = useState("Actualizando...");
  useEffect(() => {
    if (!ts) return;
    const update = () => {
      const sec = Math.floor((Date.now() - ts.getTime()) / 1000);
      if (sec < 60) setLabel("Hace menos de 1 min");
      else if (sec < 3600) setLabel(`Hace ${Math.floor(sec / 60)} min`);
      else setLabel(`Hace ${Math.floor(sec / 3600)} h`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [ts]);
  return label;
}

// ── Score Gauge ────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(Math.max(Number(score) / 10, 0), 1);
  const color = pct >= 0.7 ? "#10b981" : pct >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 140, height: 80 }}>
        <svg width="140" height="80" viewBox="0 0 140 80">
          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeLinecap="round" />
          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${Math.PI * 60 * pct} ${Math.PI * 60}`}
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
          />
          {(() => {
            const angle = Math.PI * (1 - pct);
            const nx = 70 + 44 * Math.cos(Math.PI - angle);
            const ny = 70 - 44 * Math.sin(Math.PI - angle);
            return (
              <>
                <line x1="70" y1="70" x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="70" cy="70" r="4" fill={color} />
              </>
            );
          })()}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{Number(score).toFixed(1)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Score del ciclo / 10</p>
      <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
        <span style={{ color: "#ef4444" }}>0–4 Crítico</span>
        <span style={{ color: "#f59e0b" }}>4–7 Medio</span>
        <span style={{ color: "#10b981" }}>7–10 Excelente</span>
      </div>
    </div>
  );
}

// ── Alert Banner ───────────────────────────────────────────────────────────────

function AlertBanner({ atRiskCount, criticalCount }: { atRiskCount: number; criticalCount: number }) {
  if (atRiskCount === 0) return null;
  const isCritical = criticalCount > 0;
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-4 py-3",
      isCritical
        ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
        : "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
    )}>
      <AlertTriangle className={cn("h-4 w-4 shrink-0", isCritical ? "text-red-500" : "text-amber-500")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", isCritical ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
          {atRiskCount} KR{atRiskCount > 1 ? "s" : ""} en riesgo
          {isCritical && ` — ${criticalCount} nivel empresa/área requieren atención inmediata`}
        </p>
      </div>
      <Link href="/reports/risk-dashboard">
        <Button size="sm" variant={isCritical ? "destructive" : "outline"} className="h-7 text-xs shrink-0">
          Ver detalles
        </Button>
      </Link>
    </div>
  );
}

// ── Activity Feed ──────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<string, string> = {
  COMPANY:    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  AREA:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  TEAM:       "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  INDIVIDUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const LEVEL_LABEL: Record<string, string> = {
  COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo", INDIVIDUAL: "Individual",
};

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "justo ahora";
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  return `hace ${Math.floor(sec / 86400)} d`;
}

function confidenceColor(conf: number) {
  const pct = conf <= 1 ? conf * 100 : conf;
  if (pct >= 70) return "text-green-600 dark:text-green-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function ActivityFeedPanel({ cycleId }: { cycleId?: string }) {
  const { data: feed = [], isFetching } = useActivityFeed(cycleId, undefined, 12);

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
            <Circle className="absolute inset-0 h-2.5 w-2.5 fill-green-500 text-green-500 animate-ping opacity-60" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Actividad en tiempo real
          </h2>
        </div>
        {isFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {feed.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {feed.map((item) => {
            const confPct = item.confidence <= 1 ? Math.round(item.confidence * 100) : Math.round(item.confidence);
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors">
                <CheckSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium truncate">{item.actor_name ?? "Alguien"}</span>
                    {item.mood && <span className="text-base leading-none">{MOOD_EMOJI[item.mood] ?? ""}</span>}
                    <span className={cn("rounded-full px-1.5 py-0 text-[10px] font-medium", LEVEL_BADGE[item.objective_level])}>
                      {LEVEL_LABEL[item.objective_level]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.kr_title}</p>
                  {item.notes && (
                    <p className="text-xs text-foreground/70 line-clamp-1 italic">&ldquo;{item.notes}&rdquo;</p>
                  )}
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <p className={cn("text-xs font-bold", confidenceColor(item.confidence))}>{confPct}%</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(item.event_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Level bar chart ────────────────────────────────────────────────────────────

function LevelBarChart({ heatmap }: { heatmap: Record<string, { progress: number; count: number }> }) {
  const data = ["COMPANY", "AREA", "TEAM", "INDIVIDUAL"]
    .filter(l => heatmap[l])
    .map(l => ({
      level: LEVEL_META[l].label,
      progress: Math.round(Number(heatmap[l].progress)),
      count: heatmap[l].count,
      fill: LEVEL_META[l].color,
    }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }} barSize={40}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="level" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}%`, "Progreso"]}
          contentStyle={{ borderRadius: 8, fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", color: "hsl(var(--popover-foreground))" }} />
        <ReferenceLine y={70} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} />
        <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
          <LabelList dataKey="count" position="top" formatter={(v: any) => `${v} obj`} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Risk scatter ───────────────────────────────────────────────────────────────

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover p-2.5 shadow-lg text-xs max-w-48">
      {d.krCode && <span className="text-[10px] font-mono text-muted-foreground">{d.krCode}</span>}
      <p className="font-semibold text-popover-foreground mb-1 leading-snug">{d.title}</p>
      <p className="text-muted-foreground">{d.objCode ? `${d.objCode} · ` : ""}{d.obj}</p>
      <div className="flex gap-3 mt-1.5">
        <span>Progreso: <strong>{d.x}%</strong></span>
        <span>Confianza: <strong>{d.y}%</strong></span>
      </div>
    </div>
  );
}

function RiskScatter({ krs }: { krs: Array<{ kr_id?: string; kr_code?: string; kr_title: string; obj_code?: string; objective_title: string; confidence: number; progress: number; level: string }> }) {
  const data = krs.map(k => ({
    x: Math.round(Number(k.progress)),
    y: Math.round(Number(k.confidence) * 100),
    title: k.kr_title,
    obj: k.objective_title,
    level: k.level,
    fill: LEVEL_COLORS_SCATTER[k.level] ?? "#64748b",
    krCode: k.kr_code,
    objCode: k.obj_code,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 16, right: 16, left: -16, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" dataKey="x" domain={[0, 100]} name="Progreso"
          label={{ value: "Progreso (%)", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tick={{ fontSize: 10 }} />
        <YAxis type="number" dataKey="y" domain={[0, 100]} name="Confianza"
          label={{ value: "Confianza (%)", angle: -90, position: "insideLeft", offset: 14, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tick={{ fontSize: 10 }} />
        <ZAxis range={[55, 55]} />
        <ReferenceLine x={40} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5}
          label={{ value: "Riesgo", position: "top", fontSize: 9, fill: "#f59e0b" }} />
        <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5} />
        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "4 4" }} />
        <Scatter data={data} shape="circle">
          {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.8} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ── Trend area ─────────────────────────────────────────────────────────────────

function TrendArea({ data }: { data: Array<{ week_number: number; week_start?: string; avg_progress: number }> }) {
  const pts = data.map(d => ({ week: `S${d.week_number}`, progress: Math.round(Number(d.avg_progress)) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={pts} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="execTrendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v}%`, "Progreso"]}
          contentStyle={{ borderRadius: 8, fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", color: "hsl(var(--popover-foreground))" }} />
        <ReferenceLine y={70} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} />
        <Area type="monotone" dataKey="progress" stroke="hsl(var(--primary))"
          fill="url(#execTrendGrad)" strokeWidth={2.5}
          dot={{ r: 3.5, fill: "hsl(var(--primary))", stroke: "#fff", strokeWidth: 1.5 }}
          activeDot={{ r: 5.5, fill: "hsl(var(--primary))", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Cycle Projection ──────────────────────────────────────────────────────────

const FORECAST_META = {
  on_track: { label: "En ruta",   color: "#10b981", bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400" },
  at_risk:  { label: "En riesgo", color: "#f59e0b", bg: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-400" },
  critical: { label: "Crítico",   color: "#ef4444", bg: "bg-red-100 dark:bg-red-900/30",      text: "text-red-700 dark:text-red-400" },
};

function ProgressDualBar({ timePct, progressPct, gap }: { timePct: number; progressPct: number; gap: number }) {
  const barColor = gap >= 5 ? "#10b981" : gap >= -10 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Tiempo transcurrido</span>
          <span className="font-semibold tabular-nums">{timePct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-indigo-400 transition-all duration-700" style={{ width: `${timePct}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progreso OKRs</span>
          <span className="font-semibold tabular-nums" style={{ color: barColor }}>{progressPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: barColor }} />
        </div>
      </div>
    </div>
  );
}

function GapPill({ gap }: { gap: number }) {
  if (gap > 3) return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <TrendingUp className="h-3 w-3" />+{gap}pts adelante
    </span>
  );
  if (gap < -3) return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <AlertTriangle className="h-3 w-3" />{gap}pts rezagado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
      <Minus className="h-3 w-3" />En línea
    </span>
  );
}

function ForecastDot({ status }: { status: "on_track" | "at_risk" | "critical" }) {
  const m = FORECAST_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", m.bg, m.text)}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function CycleProjectionSection({ data }: { data: CycleProjection }) {
  const { cycle, actual_progress, expected_progress, gap, weekly_velocity, projected_final_progress, objectives } = data;
  if (!cycle) return null;

  const projColor = projected_final_progress >= 70 ? "#10b981" : projected_final_progress >= 50 ? "#f59e0b" : "#ef4444";
  const velocityPositive = weekly_velocity > 0;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:to-purple-950/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Proyección de Cierre</h2>
              <p className="text-xs text-muted-foreground">
                {cycle.name} · {cycle.days_elapsed}d transcurridos · {cycle.days_remaining}d restantes
              </p>
            </div>
          </div>
          <GapPill gap={gap} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Timeline dual bar */}
        <ProgressDualBar
          timePct={cycle.cycle_position_pct}
          progressPct={actual_progress}
          gap={gap}
        />

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Progreso actual</p>
            <p className="text-2xl font-bold tabular-nums">{actual_progress}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">vs {expected_progress}% esperado</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Desface</p>
            <p className={cn("text-2xl font-bold tabular-nums", gap >= 0 ? "text-green-600 dark:text-green-400" : gap >= -10 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
              {gap > 0 ? "+" : ""}{gap}pts
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">respecto al esperado</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Velocidad semanal</p>
            <p className={cn("text-2xl font-bold tabular-nums", velocityPositive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")}>
              {weekly_velocity > 0 ? "+" : ""}{weekly_velocity}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">pts/semana (últimas 6)</p>
          </div>
          <div className="rounded-xl border p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Proyección cierre</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: projColor }}>
              {projected_final_progress}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">si mantiene velocidad actual</p>
          </div>
        </div>

        {/* Projected close progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium">Proyección al cierre del ciclo</span>
            <span className="font-semibold tabular-nums" style={{ color: projColor }}>{projected_final_progress}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden relative">
            {/* Current progress */}
            <div className="h-full rounded-full opacity-40" style={{ width: `${actual_progress}%`, background: projColor }} />
            {/* Projected extension */}
            <div
              className="absolute top-0 h-full rounded-r-full opacity-70"
              style={{
                left: `${actual_progress}%`,
                width: `${Math.max(0, projected_final_progress - actual_progress)}%`,
                background: projColor,
                backgroundImage: "repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(255,255,255,0.3) 4px,rgba(255,255,255,0.3) 7px)",
              }}
            />
            {/* 70% reference line */}
            <div className="absolute top-0 h-full w-px bg-green-600/60" style={{ left: "70%" }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Ahora: {actual_progress}%</span>
            <span className="text-green-600 dark:text-green-400">Meta: 70%</span>
            <span>Proyectado: {projected_final_progress}%</span>
          </div>
        </div>

        {/* Per-objective stoplight table */}
        {objectives.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Pronóstico por objetivo
            </h3>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Objetivo</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Nivel</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Progreso</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Desface</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Pronóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {objectives.map((obj, i) => (
                    <tr key={obj.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", i % 2 === 0 ? "" : "bg-muted/10")}>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2 min-w-0">
                          {obj.code && (
                            <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">{obj.code}</span>
                          )}
                          <span className="font-medium leading-snug line-clamp-2">{obj.title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", LEVEL_BADGE[obj.level] ?? "bg-gray-100 text-gray-600")}>
                          {LEVEL_LABEL[obj.level] ?? obj.level}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold tabular-nums">{obj.progress}%</span>
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${obj.progress}%`,
                                background: FORECAST_META[obj.forecastStatus].color,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <span className={cn(
                          "font-semibold tabular-nums",
                          obj.obj_gap >= 0 ? "text-green-600 dark:text-green-400" : obj.obj_gap >= -10 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {obj.obj_gap > 0 ? "+" : ""}{obj.obj_gap}pts
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ForecastDot status={obj.forecastStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const qc = useQueryClient();
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: dash, isLoading: dashLoading, dataUpdatedAt } = useExecutiveDashboard();
  const { data: trend = [], isLoading: trendLoading } = useWeeklyTrend();
  const { data: riskDash } = useRiskDashboard(dash?.cycle_id);
  const { data: projection } = useCycleProjection();

  // Update ticker when data is freshly fetched
  useEffect(() => {
    if (dataUpdatedAt) setRefreshedAt(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const sinceLabel = useSince(refreshedAt);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["reports", "executive-dashboard"] });
    await qc.invalidateQueries({ queryKey: ["reports", "activity-feed"] });
    setIsRefreshing(false);
    setRefreshedAt(new Date());
  }, [qc]);

  const heatmap  = dash?.heatmap ?? {};
  const pdfUrl   = dash?.cycle_id ? `/api/v1/reports/export-pdf/${dash.cycle_id}` : null;
  const pptxUrl  = dash?.cycle_id ? `/api/v1/reports/export-pptx/${dash.cycle_id}` : null;

  // Critical KRs = COMPANY or AREA level
  const criticalAtRisk = riskDash?.at_risk?.filter(
    k => k.objective_level === "COMPANY" || k.objective_level === "AREA"
  ).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard Ejecutivo"
        description={dash?.cycle_name ? `Ciclo: ${dash.cycle_name}` : "Ciclo activo"}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live indicator + last updated */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              {sinceLabel}
            </div>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              Actualizar
            </Button>
            {pdfUrl && (
              <a href={pdfUrl} download className="inline-flex items-center gap-1.5 rounded-md border px-3 h-8 text-sm font-medium hover:bg-muted transition-colors">
                <Download className="h-3.5 w-3.5" /> PDF
              </a>
            )}
            {pptxUrl && (
              <a href={pptxUrl} download className="inline-flex items-center gap-1.5 rounded-md border px-3 h-8 text-sm font-medium hover:bg-muted transition-colors">
                <Download className="h-3.5 w-3.5" /> PPTX
              </a>
            )}
          </div>
        }
      />

      {dashLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !dash ? (
        <Card>
          <EmptyState icon={BarChart3} title="Sin datos" description="No hay ciclo activo con datos suficientes." />
        </Card>
      ) : (
        <>
          {/* ── Alert banner ── */}
          <AlertBanner atRiskCount={dash.at_risk_krs} criticalCount={criticalAtRisk} />

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-5 flex flex-col items-center justify-center">
              <ScoreGauge score={Number(dash.cycle_score)} />
            </Card>
            <Card className="p-5 flex flex-col items-center justify-center gap-2 text-center">
              <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold tabular-nums">{Math.round(Number(dash.avg_progress))}%</p>
              <p className="text-xs text-muted-foreground">Progreso promedio</p>
            </Card>
            <Card className="p-5 flex flex-col items-center justify-center gap-2 text-center">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold tabular-nums">{dash.completed_objectives}</p>
              <p className="text-xs text-muted-foreground">Objetivos completados</p>
            </Card>
            <Card className="p-5 flex flex-col items-center justify-center gap-2 text-center">
              <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <p className={cn("text-3xl font-bold tabular-nums", dash.at_risk_krs > 0 && "text-red-500")}>
                {dash.at_risk_krs}
              </p>
              <p className="text-xs text-muted-foreground">KRs en riesgo</p>
            </Card>
          </div>

          {/* ── Activity feed + Level chart ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActivityFeedPanel cycleId={dash.cycle_id} />

            <Card className="p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Progreso por nivel organizacional
              </h2>
              <LevelBarChart heatmap={heatmap} />
              <div className="flex flex-wrap gap-4 mt-3 justify-center">
                {["COMPANY", "AREA", "TEAM", "INDIVIDUAL"].filter(l => heatmap[l]).map(l => (
                  <div key={l} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_META[l].color }} />
                    <span className="text-muted-foreground">{LEVEL_META[l].label}</span>
                    <span className="font-semibold tabular-nums">{Math.round(Number(heatmap[l].progress))}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── Trend + Scatter ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Tendencia — últimas 8 semanas
              </h2>
              {trendLoading ? (
                <Skeleton className="h-[200px] w-full rounded-lg" />
              ) : trend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos de tendencia aún.</p>
              ) : (
                <TrendArea data={trend} />
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Matriz de riesgo — KRs críticos
              </h2>
              <p className="text-xs text-muted-foreground mb-3">Zona inferior-izquierda = mayor riesgo</p>
              {!dash.top_at_risk_krs?.length ? (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Sin KRs en riesgo crítico.</p>
                </div>
              ) : (
                <RiskScatter krs={dash.top_at_risk_krs} />
              )}
              <div className="flex flex-wrap gap-4 mt-2 justify-center">
                {["COMPANY", "AREA", "TEAM", "INDIVIDUAL"].map(l => (
                  <div key={l} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_COLORS_SCATTER[l] }} />
                    <span className="text-muted-foreground">{LEVEL_META[l].label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── Cycle Projection ── */}
          {projection?.cycle && (
            <CycleProjectionSection data={projection} />
          )}

          {/* ── Footer link ── */}
          <div className="flex justify-end gap-3">
            <Link href="/reports/risk-dashboard">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                Risk Dashboard
              </Button>
            </Link>
            <Link href="/reports/executive-briefing">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground">
                <Zap className="h-3 w-3" />
                Executive Briefing
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
