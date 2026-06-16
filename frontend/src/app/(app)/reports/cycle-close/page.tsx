"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCycles } from "@/hooks/useCycles";
import {
  useGenerateCycleCloseBriefing, useCycleCloseBriefing, type CycleCloseBriefing,
} from "@/hooks/useAI";
import { useCloseReport, useGenerateCloseReport, type CloseReport } from "@/hooks/useReports";
import {
  BookOpen, Bot, CheckCircle2, XCircle, Lightbulb, Rocket,
  Loader2, ChevronDown, Award, TrendingDown, Star, BarChart2,
  RefreshCw, FileText, Presentation, Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const r = 36, circ = 2 * Math.PI * r;
  const color = pct >= 0.7 ? "#10b981" : pct >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s ease" }}
        />
        <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="bold" fill={color}>{score.toFixed(1)}</text>
      </svg>
      <p className="text-xs text-muted-foreground">Score / 10</p>
    </div>
  );
}

// ── Stat pill ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border bg-card px-4 py-3 text-center min-w-0">
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Briefing view ──────────────────────────────────────────────────────────────

interface CloseSummary {
  completed: number;
  partial: number;
  missed: number;
  cancelled: number;
  completion_rate: number;
  avg_progress?: number;
}

function CloseBriefingView({
  briefing, generatedAt, cycleScore, summary, objectives,
}: {
  briefing: CycleCloseBriefing;
  generatedAt: string;
  cycleScore: number;
  summary: CloseSummary | null;
  objectives: Array<{ final_progress: number }>;
}) {
  const hasInsights = briefing.achievements.length > 0 || briefing.misses.length > 0 || briefing.learnings.length > 0;

  // Use close-report summary (same source as the objectives table) for the stat pills.
  // Fall back to AI briefing values only when no snapshot exists yet.
  const completed = summary?.completed ?? briefing.completed;
  const partial   = summary?.partial   ?? briefing.active_at_close;
  const missed    = summary?.missed    ?? briefing.cancelled;

  // avg_progress: mean of final_progress across all objectives.
  // Prefer stored avg_progress from new snapshots; fall back to computing it live from the
  // objectives list (works for existing snapshots that predate this field).
  const avgProgress = summary?.avg_progress != null
    ? Math.round(summary.avg_progress)
    : objectives.length > 0
      ? Math.round(objectives.reduce((s, o) => s + (o.final_progress ?? 0), 0) / objectives.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
        <div className="sm:col-span-1 flex justify-center">
          <ScoreRing score={cycleScore} />
        </div>
        <div className="sm:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatPill label="Completados" value={completed} color="text-green-600 dark:text-green-400" />
          <StatPill label="Avance prom." value={`${avgProgress}%`}
            color={avgProgress >= 70 ? "text-green-600 dark:text-green-400" : avgProgress >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}
          />
          <StatPill label="Parciales" value={partial} color="text-amber-600 dark:text-amber-400" />
          <StatPill label="No cumplidos" value={missed} color="text-red-600 dark:text-red-400" />
        </div>
      </div>

      {/* Narrative */}
      <Card className="p-5 border-l-4 border-l-primary bg-primary/[0.03]">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen ejecutivo</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {new Date(generatedAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">{briefing.narrative}</p>
      </Card>

      {/* Three columns: achievements / misses / learnings */}
      {hasInsights ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {briefing.achievements.length > 0 && (
            <Card className="p-5 border-green-200 dark:border-green-900/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logros destacados</h3>
              </div>
              <ul className="space-y-2.5">
                {briefing.achievements.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {briefing.misses.length > 0 && (
            <Card className="p-5 border-amber-200 dark:border-amber-900/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lo que no se cumplió</h3>
              </div>
              <ul className="space-y-2.5">
                {briefing.misses.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {briefing.learnings.length > 0 && (
            <Card className="p-5 border-blue-200 dark:border-blue-900/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aprendizajes clave</h3>
              </div>
              <ul className="space-y-2.5">
                {briefing.learnings.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Star className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <span>La IA no extrajo logros, misses o aprendizajes específicos en este análisis. Regenera el cierre para obtener un desglose más detallado.</span>
        </div>
      )}

      {/* Next cycle recommendations — the WOW section */}
      {briefing.next_cycle_recommendations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recomendaciones para el próximo ciclo
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {briefing.next_cycle_recommendations.map((rec, i) => (
              <div key={i} className="rounded-xl border bg-violet-50/50 dark:bg-violet-900/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-violet-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-xs font-medium text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                    Recomendación
                  </span>
                </div>
                <p className="text-sm leading-snug">{rec}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Objectives table ───────────────────────────────────────────────────────────

const LEVEL_LABEL: Record<string, string> = {
  COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo", INDIVIDUAL: "Individual",
};

interface CloseObjective {
  id: string;
  title: string;
  level: string;
  status: string;
  final_progress: number;
  kr_count: number;
  completed_krs: number;
}

function ObjectivesTable({ cycleId }: { cycleId: string }) {
  const { data: closeReport, isLoading } = useCloseReport(cycleId);
  const generate = useGenerateCloseReport();

  const objectives: CloseObjective[] = ((closeReport?.content?.objectives ?? []) as unknown) as CloseObjective[];

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

  if (!closeReport) {
    return (
      <div className="rounded-xl border bg-muted/20 p-5 flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Resultados por objetivo</p>
          <p className="text-xs text-muted-foreground">Genera el snapshot para ver el estado final de cada objetivo.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          disabled={generate.isPending}
          onClick={() => generate.mutate(cycleId)}
        >
          {generate.isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generando…</>
            : <><RefreshCw className="h-3.5 w-3.5" />Generar snapshot</>}
        </Button>
      </div>
    );
  }

  const summary = (closeReport.content?.summary as unknown) as { total_objectives: number; completed: number; partial: number; missed: number; cancelled?: number; total_checkins?: number } | undefined;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resultados por objetivo
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {summary && (
            <>
              <span><strong className="text-foreground">{summary.completed}</strong> completados</span>
              <span><strong className="text-amber-600">{summary.partial}</strong> parciales</span>
              <span><strong className="text-red-500">{summary.missed}</strong> no cumplidos</span>
              {(summary.total_checkins ?? 0) > 0 && (
                <span><strong className="text-foreground">{summary.total_checkins}</strong> check-ins</span>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1"
            disabled={generate.isPending}
            onClick={() => generate.mutate(cycleId)}
            title="Regenerar snapshot"
          >
            <RefreshCw className={cn("h-3 w-3", generate.isPending && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b text-xs text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium">Objetivo</th>
              <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Nivel</th>
              <th className="text-right px-3 py-2.5 font-medium hidden sm:table-cell">KRs</th>
              <th className="text-right px-4 py-2.5 font-medium">Progreso</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {objectives
              .sort((a, b) => b.final_progress - a.final_progress)
              .map((obj) => {
                const pct = Math.round(obj.final_progress);
                const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
                const textColor = pct >= 70 ? "text-green-600 dark:text-green-400" : pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500";
                return (
                  <tr key={obj.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium leading-tight">{obj.title}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {LEVEL_LABEL[obj.level] ?? obj.level}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground text-right hidden sm:table-cell">
                      {obj.completed_krs}/{obj.kr_count}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={cn("text-sm font-semibold tabular-nums w-10 text-right", textColor)}>
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
    </section>
  );
}

// ── Cycle selector ────────────────────────────────────────────────────────────

function CycleSelector({
  cycles,
  selectedId,
  onSelect,
}: {
  cycles: Array<{ id: string; name: string; status: string; score: number }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = cycles.find(c => c.id === selectedId);
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
            selected.status === "ACTIVE" ? "border-green-500 text-green-600" :
            selected.status === "CLOSED" ? "border-gray-400 text-gray-500" : ""
          )}>
            {selected.status === "ACTIVE" ? "Activo" : "Cerrado"}
          </Badge>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-50 w-64 rounded-xl border bg-popover shadow-xl">
          {cycles.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="text-left truncate">{c.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{(c.score / 10).toFixed(1)}/10</span>
                <Badge variant="outline" className={cn("text-[10px]",
                  c.status === "ACTIVE" ? "border-green-500 text-green-600" : "border-gray-400 text-gray-500"
                )}>
                  {c.status === "ACTIVE" ? "Activo" : "Cerrado"}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

async function downloadExport(cycleId: string, cycleName: string, format: "pdf" | "pptx") {
  const resp = await fetch(`/api/v1/reports/export-${format}/${cycleId}`, { credentials: "include" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = cycleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  a.download = `reporte-${slug}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function CycleClosePage() {
  const { data: cycles = [], isLoading: cyclesLoading } = useCycles();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "pptx" | null>(null);

  // Auto-select active cycle on first load
  const activeCycle = cycles.find(c => c.status === "ACTIVE");
  const effectiveCycleId = selectedCycleId ?? activeCycle?.id ?? cycles[0]?.id ?? null;

  const { data: briefingRecord, isLoading: briefingLoading } = useCycleCloseBriefing(effectiveCycleId);
  const { data: closeReport } = useCloseReport(effectiveCycleId);
  const generate = useGenerateCycleCloseBriefing();
  const [freshBriefing, setFreshBriefing] = useState<CycleCloseBriefing | null>(null);

  const currentCycle = cycles.find(c => c.id === effectiveCycleId);
  const cycleName = currentCycle?.name ?? "Ciclo";
  const cycleScore = (currentCycle?.score ?? 0) / 10;
  const briefingData = freshBriefing ?? (briefingRecord?.content ?? null);
  const briefingAt = freshBriefing?.generated_at ?? briefingRecord?.created_at ?? null;
  const closeSummary = (closeReport?.content?.summary as CloseReport["summary"] | undefined) ?? null;
  const closeObjectives = (closeReport?.content?.objectives as Array<{ final_progress: number }> | undefined) ?? [];

  async function handleGenerate() {
    if (!effectiveCycleId) return;
    try {
      const result = await generate.mutateAsync(effectiveCycleId);
      setFreshBriefing(result);
    } catch {
      toast.error("Error al generar el briefing", { description: "La IA tardó demasiado o hubo un error. Intenta de nuevo." });
    }
  }

  async function handleExport(format: "pdf" | "pptx") {
    if (!effectiveCycleId) return;
    setExporting(format);
    const label = format === "pdf" ? "Reporte PDF" : "Presentación PPTX";
    const toastId = `export-${format}`;
    toast.loading(`Generando ${label}…`, { id: toastId, description: "Esto puede tomar unos segundos." });
    try {
      await downloadExport(effectiveCycleId, cycleName, format);
      toast.success(`${label} descargado`, { id: toastId, description: cycleName });
    } catch {
      toast.error(`Error al generar ${label}`, { id: toastId, description: "Verifica que el ciclo tenga datos y vuelve a intentar." });
    } finally {
      setExporting(null);
    }
  }

  const sortedCycles = [...cycles].sort((a, b) => {
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
    return new Date(b.start_date ?? 0).getTime() - new Date(a.start_date ?? 0).getTime();
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Cierre de Ciclo"
        description="Retrospectiva, aprendizajes y recomendaciones para el próximo ciclo"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {!cyclesLoading && sortedCycles.length > 0 && (
              <CycleSelector
                cycles={sortedCycles}
                selectedId={effectiveCycleId}
                onSelect={(id) => { setSelectedCycleId(id); setFreshBriefing(null); }}
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
                  <DropdownMenuItem
                    onClick={() => handleExport("pdf")}
                    disabled={!!exporting}
                    className="gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-medium">Reporte PDF</p>
                      <p className="text-[11px] text-muted-foreground">Para imprimir o compartir</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleExport("pptx")}
                    disabled={!!exporting}
                    className="gap-2 cursor-pointer"
                  >
                    <Presentation className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="font-medium">Presentación PPTX</p>
                      <p className="text-[11px] text-muted-foreground">Para comité o directorio</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              onClick={handleGenerate}
              disabled={generate.isPending || !effectiveCycleId}
              className="gap-2"
              size="sm"
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              {generate.isPending ? "Generando…" : briefingData ? "Regenerar cierre" : "Generar cierre"}
            </Button>
          </div>
        }
      />

      {briefingLoading || cyclesLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-32 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        </div>
      ) : !briefingData ? (
        <Card className="p-8">
          <EmptyState
            icon={BookOpen}
            title="Sin briefing de cierre"
            description={`Genera el análisis de cierre del ciclo "${cycleName}". La IA analizará los logros, lo que no se cumplió y producirá aprendizajes + recomendaciones para el próximo ciclo.`}
            actionLabel="Generar cierre del ciclo"
            onAction={handleGenerate}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          <CloseBriefingView
            briefing={briefingData as CycleCloseBriefing}
            generatedAt={briefingAt!}
            cycleScore={cycleScore}
            summary={closeSummary}
            objectives={closeObjectives}
          />
          <ObjectivesTable cycleId={effectiveCycleId!} />
        </div>
      )}
    </div>
  );
}
