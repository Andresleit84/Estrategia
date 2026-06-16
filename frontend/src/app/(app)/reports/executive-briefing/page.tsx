"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useExecutiveBriefingDashboard } from "@/hooks/useReports";
import { useRunExecutiveBriefing, type ExecutiveBriefingReport } from "@/hooks/useAI";
import {
  FileText, Bot, TrendingUp, TrendingDown, AlertCircle,
  ChevronRight, Loader2, CheckCircle2, Star, RefreshCw, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Cycle score dial ──────────────────────────────────────────────────────────

function ScoreDial({ score }: { score: number }) {
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const color =
    pct >= 0.7 ? "text-green-500" :
    pct >= 0.4 ? "text-amber-500" :
    "text-red-500";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("text-4xl font-bold tabular-nums", color)}>
        {score.toFixed(1)}
      </div>
      <p className="text-xs text-muted-foreground">Score del ciclo / 10</p>
      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden mt-1">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 0.7 ? "bg-green-500" : pct >= 0.4 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Objective row ─────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<string, string> = {
  COMPANY:    "bg-brand/10 text-brand",
  AREA:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  TEAM:       "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  INDIVIDUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const LEVEL_LABEL: Record<string, string> = {
  COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo", INDIVIDUAL: "Individual",
};

function ObjectiveRow({ code, title, level, status, progress }: { code?: string; title: string; level: string; status: string; progress: number }) {
  const roundedProgress = Math.round(progress);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0", LEVEL_BADGE[level] ?? LEVEL_BADGE.INDIVIDUAL)}>
        {level}
      </span>
      {code && (
        <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">
          {code}
        </span>
      )}
      <p className="text-sm flex-1 truncate">{title}</p>
      <span className="text-[10px] text-muted-foreground hidden sm:block">{LEVEL_LABEL[level] ?? level}</span>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              roundedProgress >= 70 ? "bg-green-500" : roundedProgress >= 40 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${roundedProgress}%` }}
          />
        </div>
        <span className="text-xs tabular-nums font-medium w-8 text-right">{roundedProgress}%</span>
      </div>
    </div>
  );
}

// ── AI Briefing card ──────────────────────────────────────────────────────────

function BriefingReport({ report }: { report: ExecutiveBriefingReport | Record<string, unknown> }) {
  const r = report as ExecutiveBriefingReport;

  return (
    <div className="space-y-5">
      {r.narrative && (
        <p className="text-sm text-foreground/90 leading-relaxed bg-muted/40 rounded-lg p-4 border-l-2 border-brand">
          {r.narrative}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {r.highlights?.length > 0 && (
          <Card className="p-4 border-green-200 dark:border-green-900">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-green-500" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destacados</p>
            </div>
            <ul className="space-y-2">
              {r.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {r.risks?.length > 0 && (
          <Card className="p-4 border-red-200 dark:border-red-900">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Riesgos</p>
            </div>
            <ul className="space-y-2">
              {r.risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {r.next_steps?.length > 0 && (
          <Card className="p-4 border-blue-200 dark:border-blue-900">
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Próximos pasos</p>
            </div>
            <ul className="space-y-2">
              {r.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 h-4 w-4 rounded-full border border-blue-400 text-blue-500 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExecutiveBriefingPage() {
  const { data, isLoading, refetch } = useExecutiveBriefingDashboard();
  const generate = useRunExecutiveBriefing();
  const [freshReport, setFreshReport] = useState<ExecutiveBriefingReport | null>(null);

  async function handleGenerate() {
    const id = "gen-briefing";
    toast.loading("Generando briefing ejecutivo…", { id, description: "La IA está analizando el ciclo." });
    try {
      const res = await generate.mutateAsync({});
      setFreshReport(res);
      refetch();
      toast.success("Briefing generado", { id, description: "Listo para revisar." });
    } catch {
      toast.error("Error al generar el briefing", { id, description: "Verifica que el ciclo tenga datos." });
    }
  }

  const cycle = data?.cycle as Record<string, unknown> | null | undefined;
  const cycleName = (cycle?.["name"] as string) ?? "Ciclo activo";

  const briefingContent = freshReport
    ? (freshReport as unknown as Record<string, unknown>)
    : data?.last_briefing?.content ?? null;
  const briefingAt = freshReport
    ? freshReport.generated_at
    : data?.last_briefing?.created_at;

  // Thresholds consistent with rest of system: ≥70% = on track, <40% = behind
  const onTrack  = (data?.objectives ?? []).filter(o => o.status !== "COMPLETED" && o.status !== "CANCELLED" && o.progress >= 70).length;
  const behind   = (data?.objectives ?? []).filter(o => o.status !== "COMPLETED" && o.status !== "CANCELLED" && o.progress < 40).length;
  const completed = (data?.objectives ?? []).filter(o => o.status === "COMPLETED").length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Briefing Ejecutivo"
        description={`Ciclo: ${cycleName}`}
        actions={
          <Button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="gap-2"
            size="sm"
            variant={briefingContent ? "outline" : "default"}
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : briefingContent ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generate.isPending ? "Generando…" : briefingContent ? "Regenerar" : "Generar briefing"}
          </Button>
        }
      />

      {/* Cycle overview */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-5 flex flex-col items-center gap-2">
            <ScoreDial score={data.cycle_score ?? 0} />
          </Card>
          <Card className="p-5 flex flex-col items-center justify-center gap-1 text-center">
            <TrendingUp className="h-6 w-6 text-green-500 mb-1" />
            <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{onTrack}</p>
            <p className="text-xs text-muted-foreground">En camino</p>
          </Card>
          <Card className="p-5 flex flex-col items-center justify-center gap-1 text-center">
            <TrendingDown className="h-6 w-6 text-amber-500 mb-1" />
            <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{behind}</p>
            <p className="text-xs text-muted-foreground">Rezagados</p>
          </Card>
          <Card className="p-5 flex flex-col items-center justify-center gap-1 text-center">
            <CheckCircle2 className="h-6 w-6 text-blue-500 mb-1" />
            <p className="text-2xl font-bold tabular-nums">{completed}</p>
            <p className="text-xs text-muted-foreground">Completados</p>
          </Card>
        </div>
      ) : null}

      {/* AI Briefing */}
      {briefingContent ? (
        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Executive Briefer — IA
              </span>
              {briefingAt && (
                <span className="text-xs text-muted-foreground/60 ml-1">
                  · {new Date(briefingAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerar
            </button>
          </div>
          <div className="p-6">
            <BriefingReport report={briefingContent} />
          </div>
        </div>
      ) : !isLoading && (
        <Card className="p-6">
          <EmptyState
            icon={FileText}
            title="Sin briefing generado"
            description="Haz clic en 'Generar briefing' para obtener un análisis ejecutivo del ciclo actual."
            actionLabel="Generar ahora"
            onAction={handleGenerate}
          />
        </Card>
      )}

      {/* Objectives table */}
      {data?.objectives && data.objectives.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Objetivos del ciclo
          </h2>
          <Card className="px-4 overflow-hidden">
            {data.objectives.map((obj, i) => (
              <ObjectiveRow key={i} {...obj} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
