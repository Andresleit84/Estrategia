"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import { useConsejoPackage } from "@/hooks/useConsejoPackage";
import { useCycles } from "@/hooks/useCycles";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, Printer, AlertTriangle, CheckCircle2,
  Clock, TrendingDown, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

function fmtPct(n: number | null | undefined) {
  return `${Number(n ?? 0).toFixed(0)}%`;
}

const STATUS_LABEL: Record<string, string> = {
  ON_TRACK:  "En curso",
  AT_RISK:   "En riesgo",
  BEHIND:    "Rezagado",
  COMPLETED: "Completado",
  DRAFT:     "Borrador",
  ACTIVE:    "Activo",
  CANCELLED: "Cancelado",
};

const CYCLE_STATUS_KEY: Record<string, string> = {
  ACTIVE:  "statusActive",
  CLOSED:  "statusClosed",
  DRAFT:   "statusDraft",
};

const STATUS_CHIP: Record<string, string> = {
  ON_TRACK:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  AT_RISK:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  BEHIND:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DRAFT:     "bg-muted text-muted-foreground",
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color =
    pct >= 70 ? "bg-green-500" :
    pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={cn("h-2 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── StatusChip ────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", STATUS_CHIP[status] ?? "bg-muted text-muted-foreground")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Collapsible area section ──────────────────────────────────────────────────

function AreaSection({ area_name, objectives }: { area_name: string; objectives: Array<{ id: string; code: string | null; title: string; progress: number; status: string }> }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{area_name}</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{objectives.length}</Badge>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="divide-y">
          {objectives.map(obj => (
            <div key={obj.id} className="px-4 py-3 grid grid-cols-[1fr_100px_80px] gap-3 items-center text-sm">
              <div className="min-w-0">
                {obj.code && <span className="text-xs font-mono text-muted-foreground mr-2">{obj.code}</span>}
                <span className="font-medium">{obj.title}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ProgressBar value={obj.progress} className="flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{fmtPct(obj.progress)}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <StatusChip status={obj.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Governance row ────────────────────────────────────────────────────────────

const GOV_STATUS_CHIP: Record<string, string> = {
  UPCOMING:    "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  OVERDUE:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ── Print styles ──────────────────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  aside, nav, [data-print-hide] { display: none !important; }
  body { background: white !important; color: black !important; }
  .dark body { background: white !important; color: black !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-break-before { page-break-before: always; }
}
`;

// ── Skeleton loader ───────────────────────────────────────────────────────────

function ConsejoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsejoPage() {
  const t = useTranslations("pages.consejo");
  const { data: cycles = [], isLoading: cyclesLoading } = useCycles();
  const [cycleId, setCycleId] = useState<string>("");

  const { data, isLoading } = useConsejoPackage(cycleId || undefined);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="p-6 space-y-6">
        <PageHeader
          title={t("title")}
          description={t("desc")}
          actions={
            <div className="flex items-center gap-2" data-print-hide>
              {data && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" />
                  {t("printPdf")}
                </Button>
              )}
              <Link
                href="/reports"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Reportes
              </Link>
            </div>
          }
        />

        {/* Cycle selector */}
        <div className="flex items-center gap-3" data-print-hide>
          <Select
            id="consejo-cycle"
            value={cycleId}
            onChange={e => setCycleId(e.target.value)}
            className="max-w-xs"
          >
            <SelectOption value="">{t("selectCycle")}</SelectOption>
            {cycles.map(c => (
              <SelectOption key={c.id} value={c.id}>
                {c.name} — {t(CYCLE_STATUS_KEY[c.status] ?? "statusDraft")}
              </SelectOption>
            ))}
          </Select>
        </div>

        {/* Empty state */}
        {!cycleId && (
          <div className="text-center py-20 text-muted-foreground">
            <Printer className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Selecciona un ciclo para generar el Paquete Consejo</p>
            <p className="text-sm mt-1">El reporte se genera al momento de la consulta.</p>
          </div>
        )}

        {/* Loading */}
        {cycleId && isLoading && <ConsejoSkeleton />}

        {/* Data */}
        {cycleId && !isLoading && data && (
          <div className="space-y-8">

            {/* Cycle header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{data.cycle?.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {data.cycle?.start_date && fmtDate(data.cycle.start_date)} — {data.cycle?.end_date && fmtDate(data.cycle.end_date)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{data.cycle?.days_elapsed ?? 0}</span> días transcurridos
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{data.cycle?.days_remaining ?? 0}</span> días restantes
                </span>
                <StatusChip status={data.cycle?.status ?? ""} />
              </div>
            </div>

            {/* 1. Resumen Ejecutivo */}
            <section>
              <h3 className="text-base font-bold text-foreground mb-4 uppercase tracking-wide text-xs text-muted-foreground">
                {t("execSummary")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: t("totalObjectives"), value: data.executive_summary?.total_objectives ?? 0,  color: "text-foreground" },
                  { label: t("onTrack"),          value: data.executive_summary?.on_track ?? 0,           color: "text-green-600 dark:text-green-400" },
                  { label: t("atRisk"),           value: data.executive_summary?.at_risk ?? 0,            color: "text-amber-600 dark:text-amber-400" },
                  { label: t("behind"),           value: data.executive_summary?.behind ?? 0,             color: "text-red-600 dark:text-red-400" },
                  { label: t("completed"),        value: data.executive_summary?.completed ?? 0,          color: "text-blue-600 dark:text-blue-400" },
                  { label: t("avgConfidence"),    value: `${data.executive_summary?.confidence_avg ?? 0}%`, color: "text-foreground" },
                ].map(m => (
                  <Card key={m.label} className="p-4 text-center">
                    <p className={cn("text-2xl font-bold tabular-nums", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                  </Card>
                ))}
              </div>

              {/* Progress bar overall */}
              <Card className="mt-4 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{t("cycleProgress")}</span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {fmtPct(data.executive_summary?.overall_progress)}
                  </span>
                </div>
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      (data.executive_summary?.overall_progress ?? 0) >= 70 ? "bg-green-500" :
                      (data.executive_summary?.overall_progress ?? 0) >= 40 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(data.executive_summary?.overall_progress ?? 0, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Basado en {data.executive_summary?.total_objectives ?? 0} objetivos activos
                </p>
              </Card>
            </section>

            {/* 2. Objetivos Estratégicos */}
            <section className="print-break-before">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                {t("institutionObjectives")}
              </h3>
              {!data.strategic_objectives?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sin objetivos estratégicos registrados.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">{t("colObjective")}</th>
                        <th className="text-left px-4 py-3 font-semibold w-36">{t("colProgress")}</th>
                        <th className="text-left px-4 py-3 font-semibold w-28">{t("colStatus")}</th>
                        <th className="text-left px-4 py-3 font-semibold w-36">{t("colOwner")}</th>
                        <th className="text-center px-4 py-3 font-semibold w-24">{t("onTrackKrs")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.strategic_objectives.map(obj => (
                        <tr key={obj.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            {obj.code && <span className="text-xs font-mono text-muted-foreground mr-2">{obj.code}</span>}
                            <span className="font-medium">{obj.title}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={obj.progress} className="w-20" />
                              <span className="text-xs tabular-nums text-muted-foreground">{fmtPct(obj.progress)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusChip status={obj.status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {obj.owner_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center text-xs tabular-nums">
                            {obj.kr_on_track} / {obj.kr_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 3. Objetivos por Área */}
            {!!data.area_objectives?.length && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                  {t("objectivesByArea")}
                </h3>
                <div className="space-y-3">
                  {data.area_objectives.map(area => (
                    <AreaSection key={area.area_name} {...area} />
                  ))}
                </div>
              </section>
            )}

            {/* 4. Principales Riesgos */}
            <section className="print-break-before">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                {t("topRisks")}
              </h3>
              {!data.top_risks?.length ? (
                <Card className="p-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">{t("noRisks")}</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {data.top_risks.map((risk, i) => {
                    const isCritical = risk.confidence < 40 || risk.days_since_checkin > 14;
                    return (
                      <Card
                        key={i}
                        className={cn(
                          "p-4 border-l-4",
                          isCritical ? "border-l-red-500" : "border-l-amber-500"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {risk.kr_code && (
                                <span className="text-xs font-mono text-muted-foreground">{risk.kr_code}</span>
                              )}
                              <span className="text-sm font-semibold">{risk.kr_title}</span>
                              {isCritical && (
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" aria-hidden="true" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {risk.objective_title}
                              <span className="ml-2 opacity-60">{risk.objective_level}</span>
                            </p>
                            {risk.owner_name && (
                              <p className="text-xs text-muted-foreground mt-1">Responsable: {risk.owner_name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs shrink-0">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <ProgressBar value={risk.progress} className="w-20" />
                                <span className="tabular-nums text-muted-foreground">{fmtPct(risk.progress)}</span>
                              </div>
                              <p className="text-muted-foreground mt-1">Confianza: {risk.confidence}%</p>
                            </div>
                            {risk.days_since_checkin >= 0 && (
                              <div className={cn("flex items-center gap-1", risk.days_since_checkin > 14 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                <span>{risk.days_since_checkin === -1 ? "Sin check-in" : `${risk.days_since_checkin}d sin check-in`}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 5. Resumen de Iniciativas */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                Resumen de Iniciativas
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total",       value: data.initiatives_summary?.total ?? 0,    color: "text-foreground" },
                  { label: "En Curso",    value: data.initiatives_summary?.on_track ?? 0, color: "text-green-600 dark:text-green-400" },
                  { label: "En Riesgo",   value: data.initiatives_summary?.at_risk ?? 0,  color: "text-amber-600 dark:text-amber-400" },
                  { label: "Vencidas",    value: data.initiatives_summary?.overdue ?? 0,  color: "text-red-600 dark:text-red-400" },
                ].map(m => (
                  <Card key={m.label} className="p-4 text-center">
                    <p className={cn("text-2xl font-bold tabular-nums", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                  </Card>
                ))}
              </div>
            </section>

            {/* 6. Agenda de Gobierno */}
            {!!data.governance_commitments?.length && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                  Agenda de Gobierno
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">Actividad</th>
                        <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                        <th className="text-left px-4 py-3 font-semibold">Fecha límite</th>
                        <th className="text-left px-4 py-3 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.governance_commitments.map((g, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{g.title}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{g.event_type}</td>
                          <td className="px-4 py-3 text-xs">{g.due_date ? fmtDate(g.due_date) : "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", GOV_STATUS_CHIP[g.status] ?? "bg-muted text-muted-foreground")}>
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </>
  );
}
