"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCycles } from "@/hooks/useCycles";
import {
  useEngagementRoi,
  type EngagementAgreement,
  type EngagementObjective,
} from "@/hooks/useReports";
import {
  useEngagementAnalysis,
  useGenerateEngagementAnalysis,
} from "@/hooks/useAI";
import {
  Handshake, Target, Package2, CheckCircle2, Clock, AlertCircle,
  ChevronDown, TrendingUp, Zap, BarChart3, FileText, Presentation,
  Download, Loader2, Trophy, Star, ArrowRight, Layers,
  Sparkles, RefreshCw, TrendingDown, ShieldCheck, Lightbulb, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

const LEVEL_LABEL: Record<string, string> = {
  COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo", INDIVIDUAL: "Individual",
};

const STATUS_CONFIG = {
  FULFILLED:   { label: "Cumplido",    color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30",  icon: CheckCircle2 },
  IN_PROGRESS: { label: "En progreso", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30",  icon: Clock },
  PENDING:     { label: "Pendiente",   color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/60",  icon: Clock },
  CANCELLED:   { label: "Cancelado",   color: "text-red-500",                       bg: "bg-red-100 dark:bg-red-900/30",       icon: AlertCircle },
} as const;

function agreementStatusConfig(status: EngagementAgreement["status"]) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
}

function progressColor(pct: number) {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-400";
}

function progressTextColor(pct: number) {
  if (pct >= 70) return "text-green-600 dark:text-green-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500";
}

function renewalViability(rec: string): { color: string; icon: React.ElementType } {
  const lower = rec.toLowerCase();
  if (lower.includes("alta")) return { color: "text-green-600 dark:text-green-400", icon: ShieldCheck };
  if (lower.includes("media")) return { color: "text-amber-600 dark:text-amber-400", icon: AlertTriangle };
  return { color: "text-red-500", icon: TrendingDown };
}

async function downloadExport(cycleId: string, cycleName: string, format: "pdf" | "pptx") {
  const resp = await fetch(`/api/v1/reports/export-${format}/${cycleId}`, { credentials: "include" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  const slug = cycleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  a.download = `retorno-engagement-${slug}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Executive KPI tile ─────────────────────────────────────────────────────────

function KpiTile({
  icon: Icon, iconColor, label, value, sub, highlight,
}: {
  icon: React.ElementType; iconColor: string;
  label: string; value: string | number; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "relative flex flex-col gap-3 rounded-2xl border p-5 transition-shadow hover:shadow-md",
      highlight
        ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-sm"
        : "bg-card",
    )}>
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", `${iconColor}/15`)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div>
        <p className={cn("text-3xl font-extrabold tabular-nums tracking-tight", highlight ? "text-primary" : "text-foreground")}>
          {value}
        </p>
        <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Gauge ring ─────────────────────────────────────────────────────────────────

function GaugeRing({ value, label, size = 80 }: { value: number; label: string; size?: number }) {
  const r    = size * 0.38;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(Math.max(value / 100, 0), 1);
  const color = pct >= 0.7 ? "#10b981" : pct >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={size * 0.08} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={size * 0.08}
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={size * 0.22} fontWeight="bold" fill={color}>
          {value}%
        </text>
      </svg>
      <p className="text-xs text-muted-foreground text-center leading-tight max-w-[90px]">{label}</p>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {badge && <Badge variant="secondary" className="text-[10px] ml-auto">{badge}</Badge>}
    </div>
  );
}

// ── Agreements section ─────────────────────────────────────────────────────────

function AgreementsSection({ items }: { items: EngagementAgreement[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No hay acuerdos registrados en este ciclo.
      </div>
    );
  }
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b text-xs text-muted-foreground">
            <th className="text-left px-4 py-2.5 font-medium">Acuerdo</th>
            <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Origen</th>
            <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">Épicas</th>
            <th className="text-right px-4 py-2.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((a) => {
            const cfg  = agreementStatusConfig(a.status);
            const Icon = cfg.icon;
            return (
              <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium leading-tight">{a.title}</p>
                  {a.code && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{a.code}</p>}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell">
                  {a.source ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground text-right hidden sm:table-cell">
                  {a.epics_count > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Package2 className="h-3 w-3" /> {a.epics_count}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", cfg.bg, cfg.color)}>
                    <Icon className="h-3 w-3 shrink-0" />
                    {cfg.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Objectives section ────────────────────────────────────────────────────────

const CATEGORY_ICON = {
  completed: { icon: CheckCircle2, color: "text-green-500" },
  partial:   { icon: Clock,        color: "text-amber-500" },
  missed:    { icon: AlertCircle,  color: "text-red-400"   },
} as const;

function ObjectivesSection({ items }: { items: EngagementObjective[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No hay objetivos activos en este ciclo.
      </div>
    );
  }
  const sorted = [...items].sort((a, b) => {
    const order = { completed: 0, partial: 1, missed: 2 };
    return (order[a.category] - order[b.category]) || b.progress - a.progress;
  });
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b text-xs text-muted-foreground">
            <th className="text-left px-4 py-2.5 font-medium">Objetivo</th>
            <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Nivel</th>
            <th className="text-right px-4 py-2.5 font-medium">Progreso final</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((o) => {
            const pct           = Math.round(o.progress);
            const { icon: Icon, color } = CATEGORY_ICON[o.category];
            return (
              <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
                    <span className="font-medium leading-tight">{o.title}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                  {LEVEL_LABEL[o.level] ?? o.level}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                      <div className={cn("h-full rounded-full", progressColor(pct))} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums w-10 text-right", progressTextColor(pct))}>
                      {pct}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Work stat card ─────────────────────────────────────────────────────────────

function WorkStatCard({
  label, total, done, icon: Icon, color,
}: {
  label: string; total: number; done: number; icon: React.ElementType; color: string;
}) {
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", `${color}/15`)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold tabular-nums">{total}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {total > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{done} completados</span>
              <span>{rate}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", progressColor(rate))} style={{ width: `${rate}%` }} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Cycle selector ─────────────────────────────────────────────────────────────

function CycleSelector({
  cycles, selectedId, onSelect,
}: {
  cycles: Array<{ id: string; name: string; status: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tC = useTranslations("pages.consejo");
  const selected = cycles.find((c) => c.id === selectedId);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors min-w-48"
      >
        <span className="flex-1 text-left truncate">{selected?.name ?? "Seleccionar ciclo"}</span>
        {selected && (
          <Badge variant="outline" className={cn("text-[10px] shrink-0",
            selected.status === "ACTIVE" ? "border-green-500 text-green-600" : "border-gray-400 text-gray-500"
          )}>
            {selected.status === "ACTIVE" ? tC("statusActive") : tC("statusClosed")}
          </Badge>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-50 w-64 rounded-xl border bg-popover shadow-xl">
          {cycles.map((c) => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="text-left truncate">{c.name}</span>
              <Badge variant="outline" className={cn("text-[10px] shrink-0",
                c.status === "ACTIVE" ? "border-green-500 text-green-600" : "border-gray-400 text-gray-500"
              )}>
                {c.status === "ACTIVE" ? tC("statusActive") : tC("statusClosed")}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Executive narrative hero ───────────────────────────────────────────────────

function NarrativeHero({
  agreementRate, objectiveRate, epics, orgName, cycleName, hasAgreements,
}: {
  agreementRate: number; objectiveRate: number;
  epics: number; orgName: string; cycleName: string; hasAgreements: boolean;
}) {
  const mainRate  = hasAgreements ? agreementRate : objectiveRate;
  const mainLabel = hasAgreements ? "de los acuerdos del ciclo" : "de los objetivos del ciclo";
  const mainColor = mainRate >= 70
    ? "text-green-600 dark:text-green-400"
    : mainRate >= 40 ? "text-amber-600 dark:text-amber-400"
    : "text-red-500";

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Retorno del Engagement — {cycleName}
        </span>
        {orgName && <span className="ml-auto text-xs text-muted-foreground">{orgName}</span>}
      </div>
      <p className="text-xl font-semibold leading-snug text-foreground">
        Cumplimos el{" "}
        <span className={cn("font-extrabold text-4xl tabular-nums", mainColor)}>{mainRate}%</span>
        {" "}{mainLabel}
        {epics > 0 && (
          <> y generamos{" "}
            <span className="font-extrabold text-primary">{epics} épicas</span>{" "}
            de trabajo ejecutado
          </>
        )}.
      </p>
      <div className="flex flex-wrap gap-4 pt-1">
        {hasAgreements && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Handshake className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className={agreementRate >= 70 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                  {agreementRate}%
                </strong>{" "}acuerdos cumplidos
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 hidden sm:block self-center" />
          </>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className={objectiveRate >= 70 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
              {objectiveRate}%
            </strong>{" "}objetivos logrados
          </span>
        </div>
        {epics > 0 && (
          <>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 hidden sm:block self-center" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package2 className="h-3.5 w-3.5 shrink-0" />
              <span><strong className="text-primary">{epics}</strong> épicas generadas</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── AI Executive Analysis Panel ────────────────────────────────────────────────

interface AnalysisContent {
  headline: string;
  narrative: string;
  highlights: string[];
  risks: string[];
  renewal_recommendation: string;
  next_cycle_focus: string[];
  generated_at: string;
  generated_by: string;
}

function AiAnalysisPanel({
  cycleId,
  analysisRow,
  isLoadingAnalysis,
}: {
  cycleId: string;
  analysisRow: { content: AnalysisContent; created_at: string } | null | undefined;
  isLoadingAnalysis: boolean;
}) {
  const generate = useGenerateEngagementAnalysis();

  async function handleGenerate() {
    const toastId = "gen-engagement-analysis";
    toast.loading("Generando análisis ejecutivo…", { id: toastId, description: "La IA está procesando los datos del ciclo." });
    try {
      await generate.mutateAsync(cycleId);
      toast.success("Análisis ejecutivo generado", { id: toastId, description: "Listo para presentar al directorio." });
    } catch {
      toast.error("Error al generar el análisis", { id: toastId, description: "Verifica que el ciclo tenga objetivos y datos." });
    }
  }

  const analysis = analysisRow?.content ?? null;
  const genDate  = analysisRow?.created_at
    ? new Date(analysisRow.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const isGenerating = generate.isPending;

  if (isLoadingAnalysis) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">Análisis ejecutivo con IA</p>
          <p className="text-sm text-muted-foreground mt-1">
            Genera una narrativa ejecutiva completa: logros destacados, áreas de atención,
            recomendación de renovación y focos para el próximo ciclo.
            Ideal para presentar al directorio o a un cliente C-level.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1.5">
            Recomendado al cierre de cada ciclo o antes de una reunión de renovación. Una generación semanal es suficiente.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="shrink-0 gap-2"
        >
          {isGenerating
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
            : <><Sparkles className="h-4 w-4" /> Generar análisis</>
          }
        </Button>
      </div>
    );
  }

  const { color: renewalColor, icon: RenewalIcon } = renewalViability(analysis.renewal_recommendation);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Análisis ejecutivo — IA
          </span>
          {genDate && (
            <span className="text-xs text-muted-foreground/60 ml-1">· {genDate}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {isGenerating
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando…</>
            : <><RefreshCw className="h-3.5 w-3.5" /> Regenerar</>
          }
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Headline */}
        <p className="text-2xl font-bold leading-tight tracking-tight text-foreground">
          {analysis.headline}
        </p>

        {/* Narrative */}
        <p className="text-sm leading-relaxed text-muted-foreground">
          {analysis.narrative}
        </p>

        {/* Highlights + Risks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {analysis.highlights.length > 0 && (
            <div className="rounded-xl border bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                  Logros destacados
                </span>
              </div>
              <ul className="space-y-2">
                {analysis.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-900 dark:text-green-100">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    <span className="leading-snug">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.risks.length > 0 && (
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Áreas de atención
                </span>
              </div>
              <ul className="space-y-2">
                {analysis.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                    <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                    <span className="leading-snug">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Renewal recommendation */}
        {analysis.renewal_recommendation && (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
            <RenewalIcon className={cn("h-5 w-5 shrink-0 mt-0.5", renewalColor)} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Recomendación de renovación
              </p>
              <p className={cn("text-sm font-medium leading-snug", renewalColor)}>
                {analysis.renewal_recommendation}
              </p>
            </div>
          </div>
        )}

        {/* Next cycle focus */}
        {analysis.next_cycle_focus.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Focos para el próximo ciclo
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.next_cycle_focus.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  <span className="text-primary font-bold">{i + 1}.</span>
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-2.5 border-t bg-muted/10 text-[10px] text-muted-foreground/60">
        {analysis.generated_by}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EngagementPage() {
  const t = useTranslations("pages.engagement");
  const { data: cycles = [], isLoading: cyclesLoading } = useCycles();
  const [selectedCycleId, setSelectedCycleId]           = useState<string | null>(null);
  const [exporting, setExporting]                       = useState<"pdf" | "pptx" | null>(null);

  const activeCycle     = cycles.find((c) => c.status === "ACTIVE");
  const effectiveCycleId = selectedCycleId ?? activeCycle?.id ?? cycles[0]?.id ?? null;

  const { data: roi,         isLoading: roiLoading }      = useEngagementRoi(effectiveCycleId);
  const { data: analysisRow, isLoading: analysisLoading } = useEngagementAnalysis(effectiveCycleId);

  const sortedCycles = [...cycles].sort((a, b) => {
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (b.status === "ACTIVE" && a.status !== "ACTIVE") return  1;
    return new Date(b.start_date ?? 0).getTime() - new Date(a.start_date ?? 0).getTime();
  });

  const cycleName = roi?.cycle?.name ?? sortedCycles.find((c) => c.id === effectiveCycleId)?.name ?? "Ciclo";

  async function handleExport(format: "pdf" | "pptx") {
    if (!effectiveCycleId) return;
    setExporting(format);
    const label   = format === "pdf" ? "Reporte PDF" : "Presentación PPTX";
    const toastId = `export-engagement-${format}`;
    toast.loading(`Generando ${label}…`, { id: toastId, description: "Esto puede tomar unos segundos." });
    try {
      await downloadExport(effectiveCycleId, cycleName, format);
      toast.success(`${label} descargado`, { id: toastId, description: cycleName });
    } catch {
      toast.error(`Error al generar ${label}`, { id: toastId, description: "Verifica que el ciclo tenga datos." });
    } finally {
      setExporting(null);
    }
  }

  const isLoading = cyclesLoading || roiLoading;

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <PageHeader
        title={t("title")}
        description={t("desc")}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {!cyclesLoading && sortedCycles.length > 0 && (
              <CycleSelector
                cycles={sortedCycles}
                selectedId={effectiveCycleId}
                onSelect={(id) => setSelectedCycleId(id)}
              />
            )}
            {effectiveCycleId && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={!!exporting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  {exporting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  Exportar
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleExport("pdf")} disabled={!!exporting} className="gap-2 cursor-pointer">
                    <FileText className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-medium">Reporte PDF</p>
                      <p className="text-[11px] text-muted-foreground">Para imprimir o compartir</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pptx")} disabled={!!exporting} className="gap-2 cursor-pointer">
                    <Presentation className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="font-medium">Presentación PPTX</p>
                      <p className="text-[11px] text-muted-foreground">Para comité o directorio</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {isLoading ? (
        <PageSkeleton />
      ) : !roi ? (
        <Card className="p-8">
          <EmptyState
            icon={BarChart3}
            title="Sin datos de engagement"
            description="Selecciona un ciclo con objetivos y acuerdos para ver el retorno del engagement."
          />
        </Card>
      ) : (
        <div className="space-y-8">

          {/* Narrative hero */}
          <NarrativeHero
            agreementRate={roi.agreements.fulfillment_rate}
            objectiveRate={roi.objectives.completion_rate}
            epics={roi.work.epics}
            orgName={roi.org.name}
            cycleName={roi.cycle.name}
            hasAgreements={roi.agreements.total > 0}
          />

          {/* AI Executive Analysis */}
          {effectiveCycleId && (
            <AiAnalysisPanel
              cycleId={effectiveCycleId}
              analysisRow={analysisRow as { content: AnalysisContent; created_at: string } | null | undefined}
              isLoadingAnalysis={analysisLoading}
            />
          )}

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiTile
              icon={Handshake}
              iconColor="text-violet-600 dark:text-violet-400"
              label={t("agreementsFulfilled")}
              value={`${roi.agreements.fulfilled}/${roi.agreements.total}`}
              sub={`${roi.agreements.fulfillment_rate}% de cumplimiento`}
            />
            <KpiTile
              icon={Target}
              iconColor="text-blue-600 dark:text-blue-400"
              label={t("objectivesAchieved")}
              value={`${roi.objectives.completed}/${roi.objectives.total}`}
              sub={`${roi.objectives.completion_rate}% de éxito`}
            />
            <KpiTile
              icon={Package2}
              iconColor="text-emerald-600 dark:text-emerald-400"
              label={t("epicsGenerated")}
              value={roi.work.epics}
              sub={roi.work.done_epics > 0 ? `${roi.work.done_epics} completadas` : "backlog creado"}
            />
            <KpiTile
              icon={Zap}
              iconColor="text-amber-600 dark:text-amber-400"
              label={t("checkinsCompleted")}
              value={roi.check_ins_total}
              sub="actualizaciones de progreso"
              highlight
            />
          </div>

          {/* Progress gauges */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <GaugeRing value={roi.agreements.fulfillment_rate} label={t("agreementFulfillment")} size={90} />
              <div className="hidden sm:block w-px h-16 bg-border" />
              <GaugeRing value={roi.objectives.completion_rate} label={t("objectiveAchievement")} size={90} />
              <div className="hidden sm:block w-px h-16 bg-border" />
              <GaugeRing
                value={roi.work.total_points > 0 ? Math.round((roi.work.done_points / roi.work.total_points) * 100) : 0}
                label={t("storyPointsDelivered")}
                size={90}
              />
              <div className="hidden sm:block flex-1" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-extrabold tabular-nums text-primary">{roi.cycle.score.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{t("score")} / 10</p>
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className={cn("h-3.5 w-3.5",
                      roi.cycle.score / 2 >= s ? "text-amber-400 fill-amber-400" : "text-muted"
                    )} />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Agreements section */}
          <section className="space-y-3">
            <SectionHeader
              icon={Handshake}
              title={t("registeredAgreements")}
              badge={`${roi.agreements.total} total`}
            />
            <div className="flex flex-wrap gap-3 mb-3">
              {[
                { label: t("fulfilled"),   value: roi.agreements.fulfilled,   color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
                { label: t("inProgress"),  value: roi.agreements.in_progress, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
                { label: t("pending"),     value: roi.agreements.pending,     color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={cn("rounded-xl border px-4 py-2 text-center min-w-[90px]", bg)}>
                  <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <AgreementsSection items={roi.agreements.items} />
          </section>

          {/* Objectives section */}
          <section className="space-y-3">
            <SectionHeader
              icon={Target}
              title={t("cycleObjectives")}
              badge={`${roi.objectives.total} comprometidos`}
            />
            <div className="flex flex-wrap gap-3 mb-3">
              {[
                { label: t("achieved"),    value: roi.objectives.completed, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
                { label: t("partial"),     value: roi.objectives.partial,   color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
                { label: t("notAchieved"), value: roi.objectives.missed,    color: "text-red-500",                       bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={cn("rounded-xl border px-4 py-2 text-center min-w-[120px]", bg)}>
                  <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <ObjectivesSection items={roi.objectives.items} />
          </section>

          {/* Work generated */}
          <section className="space-y-3">
            <SectionHeader icon={Layers} title={t("workGenerated")} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <WorkStatCard label={t("epics")}       total={roi.work.epics}              done={roi.work.done_epics}      icon={Package2}   color="text-violet-600 dark:text-violet-400" />
              <WorkStatCard label={t("features")}    total={roi.work.features}           done={roi.work.done_features}   icon={Zap}        color="text-blue-600 dark:text-blue-400" />
              <WorkStatCard label={t("stories")}     total={roi.work.stories}            done={roi.work.done_stories}    icon={FileText}   color="text-cyan-600 dark:text-cyan-400" />
              <WorkStatCard label={t("initiatives")} total={roi.work.initiatives_total}  done={roi.work.initiatives_done} icon={TrendingUp} color="text-emerald-600 dark:text-emerald-400" />
            </div>
            {roi.work.total_points > 0 && (
              <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Story points entregados</span>
                    <span>{roi.work.done_points} / {roi.work.total_points} pts</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", progressColor(
                        Math.round((roi.work.done_points / roi.work.total_points) * 100)
                      ))}
                      style={{ width: `${Math.min(100, Math.round((roi.work.done_points / roi.work.total_points) * 100))}%` }}
                    />
                  </div>
                </div>
                <span className={cn("text-lg font-bold tabular-nums w-12 text-right shrink-0",
                  progressTextColor(Math.round((roi.work.done_points / roi.work.total_points) * 100))
                )}>
                  {Math.round((roi.work.done_points / roi.work.total_points) * 100)}%
                </span>
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
