"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCycleHealth, useWeeklyTrend, useGenerateCloseReport } from "@/hooks/useReports";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, FileDown, AlertCircle, Download } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
  PieChart, Pie, Cell, Sector,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Animated Donut with ActiveShape ──────────────────────────────────────────

const STATUS_COLORS = ["#10b981", "#3b82f6", "#94a3b8", "#f87171"];
const STATUS_LABELS = ["Completados", "Activos", "Borrador", "Cancelados"];

function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill={fill}
        style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle"
        style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}>
        {Math.round(percent * 100)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 11} outerRadius={outerRadius + 15}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

function StatusDonut({ total, draft, active, completed, cancelled }: {
  total: number; draft: number; active: number; completed: number; cancelled: number;
}) {
  const [activeIndex, setActive] = useState(0);
  if (total === 0) return null;

  const raw = [completed, active, draft, cancelled];
  const data = STATUS_LABELS
    .map((name, i) => ({ name, value: raw[i], color: STATUS_COLORS[i] }))
    .filter(d => d.value > 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          {/* @ts-ignore – activeIndex/activeShape valid in runtime, types lag in v3 */}
          <Pie activeIndex={activeIndex} activeShape={(props: any) => <ActiveShape {...props} />}
            data={data} cx="50%" cy="50%"
            innerRadius={65} outerRadius={88}
            dataKey="value" strokeWidth={0}
            onMouseEnter={(_, i) => setActive(i)}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
        {data.map((d, i) => (
          <button key={i} onClick={() => setActive(i)}
            className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-bold tabular-nums">{d.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── KR Donut ──────────────────────────────────────────────────────────────────

function KrDonut({ total, completed, atRisk }: { total: number; completed: number; atRisk: number }) {
  const [active, setActive] = useState(0);
  if (total === 0) return null;
  const other = Math.max(0, total - completed - atRisk);
  const data = [
    { name: "Completados", value: completed, color: "#10b981" },
    { name: "En riesgo",   value: atRisk,    color: "#ef4444" },
    { name: "En curso",    value: other,     color: "#3b82f6" },
  ].filter(d => d.value > 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          {/* @ts-ignore */}
          <Pie activeIndex={active} activeShape={(props: any) => <ActiveShape {...props} />}
            data={data} cx="50%" cy="50%"
            innerRadius={55} outerRadius={76}
            dataKey="value" strokeWidth={0}
            onMouseEnter={(_, i) => setActive(i)}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {data.map((d, i) => (
          <button key={i} onClick={() => setActive(i)}
            className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-bold tabular-nums">{d.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Trend area chart ──────────────────────────────────────────────────────────

function TrendAreaChart({ data }: { data: Array<{ week_number: number; avg_progress: number; checkin_count: number }> }) {
  const pts = data.map(d => ({
    week: `S${d.week_number}`,
    progress: Math.round(Number(d.avg_progress)),
    checkins: Number(d.checkin_count),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={pts} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="healthProgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="healthCIGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left"  domain={[0, 100]} tick={{ fontSize: 10 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v, name) => [name === "progress" ? `${v}%` : `${v} check-ins`, name === "progress" ? "Progreso" : "Check-ins"]}
          contentStyle={{ borderRadius: 8, fontSize: 12, background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", color: "hsl(var(--popover-foreground))" }}
        />
        <ReferenceLine yAxisId="left" y={70} stroke="#10b981" strokeDasharray="5 4" strokeWidth={1.5}
          label={{ value: "Meta 70%", position: "right", fontSize: 9, fill: "#10b981" }} />
        <Area yAxisId="left" type="monotone" dataKey="progress" stroke="#10b981"
          fill="url(#healthProgGrad)" strokeWidth={2.5}
          dot={{ r: 3.5, fill: "#10b981", stroke: "#fff", strokeWidth: 1.5 }}
          activeDot={{ r: 5.5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
        />
        <Area yAxisId="right" type="monotone" dataKey="checkins" stroke="#3b82f6"
          fill="url(#healthCIGrad)" strokeWidth={1.5} strokeDasharray="5 3"
          dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Score gauge (SVG half circle) ─────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const pct = Math.min(Math.max(Number(score) / 10, 0), 1);
  const color = pct >= 0.7 ? "#10b981" : pct >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 78 }}>
        <svg width="140" height="78" viewBox="0 0 140 78">
          <path d="M 10 68 A 60 60 0 0 1 130 68"
            fill="none" stroke="hsl(var(--muted))" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 68 A 60 60 0 0 1 130 68"
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${Math.PI * 60 * pct} ${Math.PI * 60}`}
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>
            {Number(score).toFixed(1)}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Score del ciclo / 10</p>
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────────

function StatRow({ label, value, sub, highlight }: {
  label: string; value: string | number; sub?: string; highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
      </div>
      <p className={cn("text-sm font-semibold tabular-nums", highlight && "text-primary")}>{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CycleHealthPage() {
  const { data: health, isLoading } = useCycleHealth();
  const { data: trend = [], isLoading: trendLoading } = useWeeklyTrend();
  const closeReport = useGenerateCloseReport();
  const pdfUrl  = health?.cycle_id ? `/api/v1/reports/export-pdf/${health.cycle_id}` : null;

  const daysLeft = health?.end_date
    ? Math.max(0, Math.ceil((new Date(health.end_date).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Salud del Ciclo"
        description={health?.cycle_name ? `Ciclo: ${health.cycle_name}` : "Ciclo activo"}
        actions={
          health && (
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <a href={pdfUrl} download
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 h-8 text-sm font-medium hover:bg-muted transition-colors">
                  <Download className="h-3.5 w-3.5" /> PDF
                </a>
              )}
              <Button size="sm" variant="outline" className="gap-2"
                onClick={() => closeReport.mutate(health.cycle_id)}
                disabled={closeReport.isPending || closeReport.isSuccess}>
                {closeReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                {closeReport.isSuccess ? "Snapshot generado" : closeReport.isPending ? "Generando…" : "Snapshot de cierre"}
              </Button>
            </div>
          )
        }
      />

      {closeReport.isError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error al generar el reporte de cierre. Intenta de nuevo.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !health ? (
        <Card>
          <EmptyState icon={TrendingUp} title="Sin ciclo activo" description="Activa un ciclo para ver su estado de salud." />
        </Card>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 text-center space-y-1">
              <p className={cn("text-3xl font-bold tabular-nums",
                Number(health.avg_progress) >= 70 ? "text-green-500" :
                Number(health.avg_progress) >= 40 ? "text-amber-500" : "text-red-500")}>
                {Math.round(Number(health.avg_progress))}%
              </p>
              <p className="text-xs text-muted-foreground">Progreso promedio</p>
            </Card>
            <Card className="p-5 flex flex-col items-center justify-center">
              <ScoreArc score={Number(health.cycle_score)} />
            </Card>
            <Card className="p-5 text-center space-y-1">
              <p className={cn("text-3xl font-bold tabular-nums",
                Number(health.avg_confidence) >= 0.7 ? "text-green-500" :
                Number(health.avg_confidence) >= 0.4 ? "text-amber-500" : "text-red-500")}>
                {Math.round(Number(health.avg_confidence) * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">Confianza promedio</p>
            </Card>
            <Card className="p-5 text-center space-y-1">
              <p className={cn("text-3xl font-bold tabular-nums",
                daysLeft !== null && daysLeft < 14 ? "text-red-500" :
                daysLeft !== null && daysLeft < 30 ? "text-amber-500" : "")}>
                {daysLeft !== null ? `${daysLeft}d` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Días restantes</p>
            </Card>
          </div>

          {/* ── Donuts + Trend ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Objectives donut */}
            <Card className="p-6">
              <h2 className="text-sm font-semibold mb-4">Objetivos por estado</h2>
              <StatusDonut
                total={health.total_objectives}
                draft={health.draft_count}
                active={health.active_count}
                completed={health.completed_count}
                cancelled={health.cancelled_count}
              />
            </Card>

            {/* KRs donut */}
            <Card className="p-6">
              <h2 className="text-sm font-semibold mb-4">Key Results</h2>
              <KrDonut
                total={health.total_krs}
                completed={health.completed_krs}
                atRisk={health.at_risk_krs}
              />
              {health.projected_close_date && (
                <div className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Proyección de cierre</p>
                  <p className="text-sm font-semibold">
                    {new Date(health.projected_close_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              )}
            </Card>

            {/* Stats */}
            <Card className="p-6">
              <h2 className="text-sm font-semibold mb-2">Resumen detallado</h2>
              <StatRow label="Total objetivos"  value={health.total_objectives} />
              <StatRow label="Completados"       value={health.completed_count} />
              <StatRow label="En curso (activos)" value={health.active_count}  />
              <StatRow label="Total KRs"         value={health.total_krs}      />
              <StatRow label="KRs completados"   value={health.completed_krs}  />
              <StatRow label="KRs en riesgo"     value={health.at_risk_krs}
                sub="confidence < 40% o sin check-in 14d" highlight />
            </Card>
          </div>

          {/* ── Trend chart ── */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Tendencia semanal</h2>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-8 rounded bg-green-500" /> Progreso
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-8 rounded bg-blue-500 opacity-60" style={{ backgroundImage: "repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 5px, transparent 5px, transparent 8px)" }} />
                  Check-ins
                </div>
              </div>
            </div>
            {trendLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : trend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de tendencia aún.</p>
            ) : (
              <TrendAreaChart data={trend} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
