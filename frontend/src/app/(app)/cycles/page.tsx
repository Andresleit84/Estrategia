"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  CalendarRange, Plus, Zap, Archive, Clock, AlertTriangle,
  CheckCircle2, Compass, ChevronRight, Loader2, BookOpen,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KRCardSkeleton } from "@/components/shared/SkeletonLoader";
import { cn } from "@/lib/utils";
import {
  useCycles, useCreateCycle, useActivateCycle, useCloseCycle,
  useCycleIncomplete, useRolloverCycle,
  type Cycle, type CreateCycleInput, type IncompleteObjective,
} from "@/hooks/useCycles";
import { useSectorVocabulary } from "@/hooks/useSectorVocabulary";

// ─── Cycle parameters (fuente única de verdad — no hay valores quemados) ────────

export const CYCLE_PARAMS = {
  strategic: {
    defaultMonths:  36,
    minMonths:      24,   // 2 años mínimo
    maxMonths:     120,   // 10 años máximo
    defaultNameFn: (y: number) => `Plan Estratégico ${y}–${y + 2}`,
    hint: "Duración recomendada: 3 años (mín. 2, máx. 10)",
    type: "CUSTOM" as const,
  },
  annual: {
    defaultMonths:  12,
    minMonths:      10,
    maxMonths:      14,
    defaultNameFn: (y: number) => `Plan Anual ${y}`,
    hint: "Duración recomendada: 12 meses (mín. 10, máx. 14)",
    type: "ANNUAL" as const,
  },
  quarterly: {
    defaultMonths:   3,
    minMonths:       2,
    maxMonths:       4,
    defaultNameFn: (_y: number) => "",
    hint: "Duración recomendada: 3 meses (mín. 2, máx. 4)",
    type: "QUARTERLY" as const,
  },
} as const;

// ─── Date helpers ──────────────────────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  r.setDate(r.getDate() - 1);
  return r;
}

function diffMonths(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end   + "T00:00:00");
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

function quartersForYear(year: number) {
  return [
    { q: "Q1", name: `Q1 ${year}`, start: `${year}-01-01`, end: `${year}-03-31` },
    { q: "Q2", name: `Q2 ${year}`, start: `${year}-04-01`, end: `${year}-06-30` },
    { q: "Q3", name: `Q3 ${year}`, start: `${year}-07-01`, end: `${year}-09-30` },
    { q: "Q4", name: `Q4 ${year}`, start: `${year}-10-01`, end: `${year}-12-31` },
  ];
}

function defaultsFor(level: "strategic" | "annual", cycles: Cycle[]): CreateCycleInput {
  const now    = new Date();
  const year   = now.getFullYear();
  const params = CYCLE_PARAMS[level];
  if (level === "strategic") {
    return {
      name: params.defaultNameFn(year),
      type: params.type,
      start_date: toISO(now),
      end_date: toISO(addMonths(now, params.defaultMonths)),
      description: "",
    };
  }
  const strategic = cycles.find(c => c.type === "CUSTOM");
  const start     = strategic ? strategic.start_date.slice(0, 10) : `${year}-01-01`;
  return {
    name: CYCLE_PARAMS.annual.defaultNameFn(year),
    type: CYCLE_PARAMS.annual.type,
    start_date: start,
    end_date: toISO(addMonths(new Date(start + "T00:00:00"), CYCLE_PARAMS.annual.defaultMonths)),
    description: "",
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  ACTIVE:  { label: "Activo",   icon: Zap,           cls: "bg-okr-on-track-bg text-okr-on-track" },
  DRAFT:   { label: "Borrador", icon: Clock,         cls: "bg-muted text-muted-foreground" },
  CLOSED:  { label: "Cerrado",  icon: Archive,       cls: "bg-muted text-muted-foreground" },
  OVERDUE: { label: "Vencido",  icon: AlertTriangle, cls: "bg-okr-behind-bg text-okr-behind" },
} as const;

const TYPE_LABEL: Record<string, string> = {
  CUSTOM: "Estratégico", ANNUAL: "Anual", QUARTERLY: "Trimestral",
};

const LEVELS = [
  {
    id: "strategic" as const,
    title: "Estratégico",
    subtitle: "3 años",
    description: "El marco de referencia de toda la organización. Define la dirección de largo plazo a la que deben apuntar todos los demás ciclos.",
    icon: Compass,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
  },
  {
    id: "annual" as const,
    title: "Anual",
    subtitle: "1 año",
    description: "Convierte el plan estratégico en metas concretas para el año. Los OKRs anuales deben poder medirse al cerrar el ciclo.",
    icon: CalendarRange,
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "quarterly" as const,
    title: "Trimestral",
    subtitle: "Q1 – Q4",
    description: "Ciclos de 90 días donde los equipos ejecutan la estrategia. Son la cadencia operativa principal de los OKRs tácticos.",
    icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
  },
];

// ─── CycleStatusBadge ──────────────────────────────────────────────────────────

function CycleStatusBadge({ status }: { status: Cycle["display_status"] }) {
  const t = useTranslations("pages.cycles");
  const cfg  = STATUS_CFG[status] ?? STATUS_CFG.DRAFT;
  const Icon = cfg.icon;
  const STATUS_LABELS: Record<string, string> = {
    ACTIVE:  t("statusActive"),
    DRAFT:   t("statusDraft"),
    CLOSED:  t("statusClosed"),
    OVERDUE: t("statusOverdue"),
  };
  return (
    <Badge className={`${cfg.cls} gap-1 text-xs`}>
      <Icon className="h-3 w-3" />
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ─── CycleCard ─────────────────────────────────────────────────────────────────

function CycleCard({ cycle, onActivate, onClose }: {
  cycle: Cycle;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const t = useTranslations("pages.cycles");
  const TYPE_LABELS: Record<string, string> = {
    CUSTOM:    t("typeCustom"),
    ANNUAL:    t("typeAnnual"),
    QUARTERLY: t("typeQuarterly"),
  };
  const fmt = (s: string) => new Date(s).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <Card className={cn("transition-shadow hover:shadow-md", cycle.status === "ACTIVE" && "ring-2 ring-okr-on-track")}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{cycle.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {TYPE_LABELS[cycle.type] ?? cycle.type} · {fmt(cycle.start_date)} – {fmt(cycle.end_date)}
          </p>
        </div>
        <CycleStatusBadge status={cycle.display_status} />
      </CardHeader>
      <CardContent className="space-y-3">
        {cycle.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{cycle.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{cycle.objectives_count}</strong> {t("objectivesLabel")}
          </span>
          {cycle.status === "ACTIVE" && (
            <span className="text-muted-foreground">
              <strong className="text-foreground">{cycle.days_remaining}</strong> {t("daysRemainingLabel")}
            </span>
          )}
        </div>
        <div className="flex gap-2 pt-1 flex-wrap">
          {cycle.status === "DRAFT" && (
            <Button size="sm" onClick={() => onActivate(cycle.id)} className="h-7 text-xs">{t("activate")}</Button>
          )}
          {cycle.status === "ACTIVE" && (
            <Button size="sm" variant="destructive" onClick={() => onClose(cycle.id)} className="h-7 text-xs">
              {t("closeCycle")}
            </Button>
          )}
          {cycle.status === "CLOSED" && (
            <a
              href={`/reports/cycle-close?cycle=${cycle.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              Ver retrospectiva
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── HierarchyGuide ────────────────────────────────────────────────────────────

function HierarchyGuide({ cycles, onCreate }: {
  cycles: Cycle[];
  onCreate: (level: "strategic" | "annual" | "quarterly") => void;
}) {
  const t = useTranslations("pages.cycles");
  const nonClosed = (type: string) => cycles.filter(c => c.type === type && c.status !== "CLOSED");
  const counts = {
    strategic: nonClosed("CUSTOM").length,
    annual:    nonClosed("ANNUAL").length,
    quarterly: nonClosed("QUARTERLY").length,
  };

  if (counts.strategic > 0 && counts.annual > 0 && counts.quarterly > 0) return null;

  const LEVEL_KEYS: Record<string, { title: string; subtitle: string; description: string }> = {
    strategic: { title: t("levelStrategic"), subtitle: t("levelStrategicSub"), description: t("levelStrategicDesc") },
    annual:    { title: t("levelAnnual"),    subtitle: t("levelAnnualSub"),    description: t("levelAnnualDesc") },
    quarterly: { title: t("levelQuarterly"), subtitle: t("levelQuarterlySub"), description: t("levelQuarterlyDesc") },
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold">{t("hierarchyTitle")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("hierarchyDesc")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {LEVELS.map((lvl, idx) => {
          const count    = counts[lvl.id];
          const done     = count > 0;
          const Icon     = lvl.icon;
          const lvlKeys  = LEVEL_KEYS[lvl.id];
          return (
            <div key={lvl.id} className="flex sm:flex-col flex-row items-center gap-2 flex-1">
              <div className={cn(
                "flex-1 w-full rounded-xl border p-4 flex flex-col gap-3 transition-all",
                done
                  ? "bg-muted/20 border-border/40"
                  : "bg-card border-border hover:border-primary/40 hover:shadow-sm"
              )}>
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", lvl.bg)}>
                    <Icon className={cn("h-5 w-5", lvl.accent)} />
                  </div>
                  {done ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-okr-on-track bg-okr-on-track-bg px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("cycleCount", { n: count })}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                      {t("step", { n: idx + 1 })}
                    </span>
                  )}
                </div>

                {/* Título + subtítulo */}
                <div>
                  <p className={cn("text-sm font-bold leading-tight", done ? "text-muted-foreground" : "text-foreground")}>
                    {lvlKeys.title}
                  </p>
                  <span className={cn(
                    "inline-block text-[11px] font-medium mt-0.5 px-1.5 py-0.5 rounded",
                    done ? "bg-muted/50 text-muted-foreground/60" : `${lvl.bg} ${lvl.accent}`
                  )}>
                    {lvlKeys.subtitle}
                  </span>
                </div>

                {/* Descripción — siempre visible */}
                <p className={cn(
                  "text-sm leading-relaxed flex-1",
                  done ? "text-muted-foreground/60" : "text-muted-foreground"
                )}>
                  {lvlKeys.description}
                </p>

                {/* Action */}
                {!done && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs w-full gap-1.5"
                    onClick={() => onCreate(lvl.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("create", { level: lvlKeys.title.toLowerCase() })}
                  </Button>
                )}
              </div>

              {/* Connector */}
              {idx < 2 && (
                <ChevronRight className="hidden sm:block h-4 w-4 text-muted-foreground/30 shrink-0 sm:-mx-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SmartCreateDialog (Estratégico & Anual) ───────────────────────────────────

function SmartCreateDialog({ level, cycles, onClose }: {
  level: "strategic" | "annual" | null;
  cycles: Cycle[];
  onClose: () => void;
}) {
  const tCycles = useTranslations("pages.cycles");
  const create = useCreateCycle();
  const [form, setForm] = useState<CreateCycleInput>({ name: "", type: "CUSTOM", start_date: "", end_date: "" });

  useEffect(() => {
    if (level) setForm(defaultsFor(level, cycles));
  }, [level]);

  const lvl    = LEVELS.find(l => l.id === level);
  const params = level ? CYCLE_PARAMS[level] : null;

  // Recalcula end_date cuando cambia start_date
  function handleStartChange(start: string) {
    if (!params || !start) { setForm(f => ({ ...f, start_date: start })); return; }
    const end = toISO(addMonths(new Date(start + "T00:00:00"), params.defaultMonths));
    setForm(f => ({ ...f, start_date: start, end_date: end }));
  }

  // Rango válido de fecha fin calculado dinámicamente desde CYCLE_PARAMS
  const endMin = useMemo(() => {
    if (!params || !form.start_date) return "";
    const d = new Date(form.start_date + "T00:00:00");
    d.setMonth(d.getMonth() + params.minMonths);
    return toISO(d);
  }, [form.start_date, params]);

  const endMax = useMemo(() => {
    if (!params || !form.start_date) return "";
    return toISO(addMonths(new Date(form.start_date + "T00:00:00"), params.maxMonths));
  }, [form.start_date, params]);

  // Duración actual en meses para mostrar al usuario
  const currentMonths = form.start_date && form.end_date
    ? diffMonths(form.start_date, form.end_date)
    : null;

  const durationError = useMemo(() => {
    if (!params || currentMonths === null) return null;
    if (currentMonths < params.minMonths)
      return tCycles("durationMinError", { min: params.minMonths, current: currentMonths });
    if (currentMonths > params.maxMonths)
      return tCycles("durationMaxError", { max: params.maxMonths, current: currentMonths });
    return null;
  }, [currentMonths, params, tCycles]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (durationError) return;
    create.mutate(form, { onSuccess: onClose });
  }

  return (
    <Dialog open={!!level} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {lvl && params && (
            <div className="flex items-center gap-2.5 mb-1">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", lvl.bg)}>
                <lvl.icon className={cn("h-4 w-4", lvl.accent)} />
              </div>
              <div>
                <DialogTitle className="leading-tight">{tCycles("cycleCTA", { title: { strategic: tCycles("levelStrategic"), annual: tCycles("levelAnnual"), quarterly: tCycles("levelQuarterly") }[level ?? "strategic"] ?? "" })}</DialogTitle>
                <p className="text-xs text-muted-foreground">{params.hint}</p>
              </div>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="scd-name">{tCycles("cycleName")}</Label>
            <Input
              id="scd-name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scd-start">{tCycles("startDate")}</Label>
              <Input
                id="scd-start"
                type="date"
                value={form.start_date}
                onChange={e => handleStartChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scd-end">{tCycles("endDate")}</Label>
              <Input
                id="scd-end"
                type="date"
                value={form.end_date}
                min={endMin}
                max={endMax}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className={durationError ? "border-destructive focus-visible:ring-destructive" : ""}
                required
              />
            </div>
          </div>

          {/* Indicador de duración en tiempo real */}
          <div className={cn(
            "flex items-center justify-between rounded-lg px-3 py-2 text-xs -mt-1",
            durationError
              ? "bg-destructive/8 text-destructive"
              : "bg-muted/50 text-muted-foreground"
          )}>
            <span className="flex items-center gap-1.5">
              {durationError
                ? <><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{durationError}</>
                : currentMonths !== null
                  ? `Duración: ${currentMonths} meses`
                  : params?.hint
              }
            </span>
            {!durationError && params && (
              <span className="opacity-60">{params.hint}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scd-desc">
              Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="scd-desc"
              rows={2}
              value={form.description ?? ""}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCycles("cancelBtn")}</Button>
            <Button type="submit" disabled={create.isPending || !!durationError}>
              {create.isPending
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{tCycles("creating")}</>
                : tCycles("createBtn")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── QuarterlyCreateDialog ─────────────────────────────────────────────────────

function QuarterlyCreateDialog({ open, cycles, onClose }: {
  open: boolean;
  cycles: Cycle[];
  onClose: () => void;
}) {
  const create = useCreateCycle();
  const defaultYear = useMemo(() => {
    const annual = cycles.find(c => c.type === "ANNUAL");
    return annual
      ? new Date(annual.start_date + "T00:00:00").getFullYear()
      : new Date().getFullYear();
  }, [cycles]);

  const [year,     setYear]     = useState(defaultYear);
  const [selected, setSelected] = useState(new Set(["Q1", "Q2", "Q3", "Q4"]));
  const [loading,  setLoading]  = useState(false);

  const quarters = quartersForYear(year);
  const existing = new Set(cycles.filter(c => c.type === "QUARTERLY").map(c => c.name.split(" ")[0]));

  function toggle(q: string) {
    setSelected(s => { const n = new Set(s); n.has(q) ? n.delete(q) : n.add(q); return n; });
  }

  // Valida que cada trimestre cumpla los parámetros configurados
  const { minMonths, maxMonths } = CYCLE_PARAMS.quarterly;
  const quarterErrors = quarters.reduce<Record<string, string>>((acc, q) => {
    if (!selected.has(q.q) || existing.has(q.q)) return acc;
    const months = diffMonths(q.start, q.end);
    if (months < minMonths) acc[q.q] = `Mín. ${minMonths} meses`;
    if (months > maxMonths) acc[q.q] = `Máx. ${maxMonths} meses`;
    return acc;
  }, {});
  const hasErrors = Object.keys(quarterErrors).length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hasErrors) return;
    setLoading(true);
    try {
      for (const q of quarters) {
        if (!selected.has(q.q) || existing.has(q.q)) continue;
        await create.mutateAsync({ name: q.name, type: CYCLE_PARAMS.quarterly.type, start_date: q.start, end_date: q.end });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const toCreate = quarters.filter(q => selected.has(q.q) && !existing.has(q.q)).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="leading-tight">Ciclos Trimestrales</DialogTitle>
              <p className="text-xs text-muted-foreground">Selecciona los trimestres que quieres crear</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <Label htmlFor="qcd-year" className="shrink-0">Año fiscal</Label>
            <Input
              id="qcd-year"
              type="number"
              min={2020}
              max={2040}
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-28"
            />
          </div>

          <div className="space-y-2">
            {quarters.map(q => {
              const done    = existing.has(q.q);
              const checked = selected.has(q.q) && !done;
              const error   = quarterErrors[q.q];
              const fmtDate = (s: string) =>
                new Date(s + "T00:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
              return (
                <div key={q.q} className="space-y-1">
                <label
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer select-none transition-colors",
                    done
                      ? "opacity-50 cursor-not-allowed bg-muted/30 border-border/40"
                      : error
                        ? "border-destructive/60 bg-destructive/5"
                        : checked
                          ? "border-primary/60 bg-primary/5"
                          : "hover:bg-muted/40 border-border"
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-primary h-4 w-4 shrink-0"
                    checked={checked}
                    disabled={done}
                    onChange={() => !done && toggle(q.q)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{q.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(q.start)} – {fmtDate(q.end)} · 3 meses
                    </p>
                  </div>
                  {done && (
                    <span className="flex items-center gap-1 text-xs text-okr-on-track shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Creado
                    </span>
                  )}
                </label>
                {error && (
                  <p className="flex items-center gap-1 text-xs text-destructive pl-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />{error}
                  </p>
                )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || toCreate === 0 || hasErrors}>
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creando…</>
                : `Crear ${toCreate} trimestre${toCreate !== 1 ? "s" : ""}`
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CloseCycleDialog ──────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-okr-on-track" : value >= 40 ? "bg-okr-at-risk" : "bg-okr-behind";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function CloseCycleDialog({ cycleId, cycles, onClose }: {
  cycleId: string | null;
  cycles: Cycle[];
  onClose: () => void;
}) {
  const cycle     = cycles.find(c => c.id === cycleId) ?? null;
  const closeMut  = useCloseCycle();
  const rollover  = useRolloverCycle();
  const router    = useRouter();
  const { data: incomplete = [], isLoading } = useCycleIncomplete(cycleId);

  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [toCycleId,   setToCycleId]   = useState("");
  const [step,        setStep]        = useState<"review" | "closed">("review");

  // Reset state when dialog opens for a different cycle
  useEffect(() => {
    if (!cycleId) return;
    setSelected(new Set());
    setToCycleId("");
    setStep("review");
  }, [cycleId]);

  // Pre-select all incomplete objectives when data loads
  useEffect(() => {
    if (incomplete.length > 0) setSelected(new Set(incomplete.map(o => o.id)));
  }, [incomplete]);

  // Same-type cycles that can receive rolled-over items (not closed, not current)
  const targetCycles = cycle
    ? cycles.filter(c => c.type === cycle.type && c.id !== cycle.id && c.status !== "CLOSED")
    : [];

  function toggleObj(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleClose(withRollover: boolean) {
    if (!cycleId) return;
    try {
      if (withRollover && selected.size > 0 && toCycleId) {
        await rollover.mutateAsync({ fromId: cycleId, toCycleId, objectiveIds: [...selected] });
      }
      await closeMut.mutateAsync(cycleId);
      setStep("closed");
    } catch { /* error shown by mutation */ }
  }

  const isPending   = closeMut.isPending || rollover.isPending;
  const hasSelected = selected.size > 0 && !!toCycleId;
  const levelLabel: Record<string, string> = {
    COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo", INDIVIDUAL: "Individual",
  };

  return (
    <Dialog open={!!cycleId} onOpenChange={step === "closed" ? onClose : onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "closed"
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : <Archive className="h-4 w-4 text-muted-foreground" />}
            {step === "closed" ? "Ciclo cerrado" : "Cerrar ciclo"}
          </DialogTitle>
          {cycle && (
            <p className="text-sm text-muted-foreground">{cycle.name}</p>
          )}
        </DialogHeader>

        {/* ── Success step ──────────────────────────────────────────────── */}
        {step === "closed" ? (
          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">Ciclo cerrado correctamente</p>
                <p className="text-sm text-muted-foreground">
                  La IA está generando la retrospectiva en segundo plano.
                  En unos segundos estará lista con los aprendizajes y recomendaciones del ciclo.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-violet-800 dark:text-violet-200">Ver retrospectiva</p>
                <p className="text-xs text-violet-600 dark:text-violet-400">Logros, aprendizajes y recomendaciones para el próximo ciclo</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button
                onClick={() => {
                  onClose();
                  router.push(`/reports/cycle-close?cycle=${cycleId}`);
                }}
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Ver retrospectiva
              </Button>
            </DialogFooter>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : incomplete.length === 0 ? (
          /* Sin incompletos — confirmación simple */
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-lg bg-okr-on-track-bg p-3">
              <CheckCircle2 className="h-5 w-5 text-okr-on-track shrink-0 mt-0.5" />
              <p className="text-sm text-okr-on-track font-medium">
                Todos los objetivos están completados. El ciclo puede cerrarse limpiamente.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Esta acción es <strong>irreversible</strong>. Se generará un snapshot del estado final.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button variant="destructive" disabled={isPending} onClick={() => handleClose(false)}>
                {isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Cerrando…</> : "Cerrar ciclo"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Con incompletos — flujo de revisión */
          <div className="flex flex-col gap-4 min-h-0">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>{incomplete.length} objetivo{incomplete.length > 1 ? "s" : ""} sin completar.</strong>{" "}
                Si siguen siendo relevantes para el próximo ciclo, selecciónalos. Comenzarán desde 0 con sus metas originales.
              </p>
            </div>

            {/* Lista scrollable de incompletos */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 max-h-64">
              {incomplete.map((obj: IncompleteObjective) => (
                <label
                  key={obj.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors select-none ${
                    selected.has(obj.id)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-primary h-4 w-4 shrink-0 mt-0.5"
                    checked={selected.has(obj.id)}
                    onChange={() => toggleObj(obj.id)}
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-tight truncate">{obj.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{Math.round(obj.progress)}%</span>
                    </div>
                    <ProgressBar value={Math.round(obj.progress)} />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                        {levelLabel[obj.level] ?? obj.level}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {obj.key_results.length} KR{obj.key_results.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Selector de ciclo destino */}
            {selected.size > 0 && targetCycles.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Incluir en el ciclo</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={toCycleId}
                  onChange={e => setToCycleId(e.target.value)}
                >
                  <option value="">— Selecciona un ciclo destino —</option>
                  {targetCycles.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status === "DRAFT" ? "Borrador" : "Activo"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selected.size > 0 && targetCycles.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No hay ciclos del mismo tipo disponibles como destino. Crea uno primero o cierra sin migrar.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Cerrar el ciclo es <strong>irreversible</strong>. Los objetivos migrados empezarán desde 0.
            </p>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={onClose} className="sm:mr-auto">Cancelar</Button>
              <Button variant="ghost" disabled={isPending} onClick={() => handleClose(false)}>
                Solo cerrar
              </Button>
              <Button
                variant="destructive"
                disabled={isPending || !hasSelected}
                onClick={() => handleClose(true)}
              >
                {isPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Procesando…</>
                  : `Cerrar y re-crear ${selected.size} objetivo${selected.size !== 1 ? "s" : ""}`
                }
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── CycleTypeSection ─────────────────────────────────────────────────────────

const TYPE_SECTION_CFG = {
  CUSTOM: {
    title: "Estratégico",
    subtitle: "Largo plazo · 3 años",
    icon: Compass,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    emptyTitle: "Sin ciclo estratégico",
    emptyDesc: "El ciclo estratégico define el horizonte de 3 años para toda la organización.",
  },
  ANNUAL: {
    title: "Anual",
    subtitle: "Año fiscal · 1 año",
    icon: CalendarRange,
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    emptyTitle: "Sin ciclo anual",
    emptyDesc: "El ciclo anual traduce el plan estratégico en metas concretas para el año.",
  },
  QUARTERLY: {
    title: "Trimestral",
    subtitle: "Q1 – Q4",
    icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    emptyTitle: "Sin ciclos trimestrales",
    emptyDesc: "Los ciclos trimestrales son la cadencia operativa donde los equipos ejecutan la estrategia.",
  },
} as const;

function CycleTypeSection({
  type,
  cycles,
  onActivate,
  onClose,
  onCreate,
}: {
  type: keyof typeof TYPE_SECTION_CFG;
  cycles: Cycle[];
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
}) {
  const cfg        = TYPE_SECTION_CFG[type];
  const Icon       = cfg.icon;
  const typeCycles = cycles.filter(c => c.type === type);

  // Orden: ACTIVE primero, luego DRAFT, luego CLOSED
  const sorted = [...typeCycles].sort((a, b) => {
    const order = { ACTIVE: 0, DRAFT: 1, CLOSED: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const activeCount = typeCycles.filter(c => c.status === "ACTIVE").length;

  return (
    <section className="space-y-4">
      {/* Header de sección */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", cfg.bg)}>
            <Icon className={cn("h-4 w-4", cfg.accent)} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{cfg.title}</h2>
            <p className="text-xs text-muted-foreground">{cfg.subtitle}</p>
          </div>
          {activeCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-okr-on-track bg-okr-on-track-bg px-2 py-0.5 rounded-full">
              <Zap className="h-3 w-3" /> Activo
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onCreate} className="h-8 text-xs gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Crear
        </Button>
      </div>

      {/* Ciclos o empty state */}
      {sorted.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={Icon}
            title={cfg.emptyTitle}
            description={cfg.emptyDesc}
            actionLabel="Crear ciclo"
            onAction={onCreate}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map(c => (
            <CycleCard key={c.id} cycle={c} onActivate={onActivate} onClose={onClose} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Shared content (usable in settings tab + standalone page) ────────────────

export function CyclesContent({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("pages.cycles");
  const vocab = useSectorVocabulary();
  const { data: cycles = [], isLoading } = useCycles();
  const activate = useActivateCycle();

  const [createLevel,     setCreateLevel]     = useState<"strategic" | "annual" | null>(null);
  const [createQuarterly, setCreateQuarterly] = useState(false);
  const [confirmClose,    setConfirmClose]    = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {!compact && <PageHeader title={`${vocab.cycle}s`} description={t("loadingCycles")} />}
        <div className="space-y-3">{[1, 2, 3].map(i => <KRCardSkeleton key={i} />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {compact ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          <Button size="sm" onClick={() => setCreateLevel("strategic")}>
            <Plus className="h-4 w-4 mr-1" /> {t("newCycle")}
          </Button>
        </div>
      ) : (
        <PageHeader
          title={`${vocab.cycle}s`}
          description={t("description")}
          actions={
            <Button size="sm" onClick={() => setCreateLevel("strategic")}>
              <Plus className="h-4 w-4 mr-1" /> {t("newCycle")}
            </Button>
          }
        />
      )}

      <HierarchyGuide
        cycles={cycles}
        onCreate={lvl => lvl === "quarterly" ? setCreateQuarterly(true) : setCreateLevel(lvl)}
      />

      <div className="space-y-8">
        <CycleTypeSection
          type="CUSTOM"
          cycles={cycles}
          onActivate={id => activate.mutate(id)}
          onClose={id => setConfirmClose(id)}
          onCreate={() => setCreateLevel("strategic")}
        />
        <CycleTypeSection
          type="ANNUAL"
          cycles={cycles}
          onActivate={id => activate.mutate(id)}
          onClose={id => setConfirmClose(id)}
          onCreate={() => setCreateLevel("annual")}
        />
        <CycleTypeSection
          type="QUARTERLY"
          cycles={cycles}
          onActivate={id => activate.mutate(id)}
          onClose={id => setConfirmClose(id)}
          onCreate={() => setCreateQuarterly(true)}
        />
      </div>

      <SmartCreateDialog level={createLevel} cycles={cycles} onClose={() => setCreateLevel(null)} />
      <QuarterlyCreateDialog open={createQuarterly} cycles={cycles} onClose={() => setCreateQuarterly(false)} />
      <CloseCycleDialog cycleId={confirmClose} cycles={cycles} onClose={() => setConfirmClose(null)} />
    </div>
  );
}

// ─── Standalone page (keeps /cycles route working) ────────────────────────────

export default function CyclesPage() {
  return (
    <div className="p-6">
      <CyclesContent />
    </div>
  );
}
