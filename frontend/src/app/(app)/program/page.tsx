"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  usePrograms, useCreateProgram, useUpdateProgram,
  useAddProgramCycle, useRemoveProgramCycle, useDeleteProgram,
  type TransformationProgram, type ProgramCycleEntry,
} from "@/hooks/useTransformationProgram";
import { useCycles } from "@/hooks/useCycles";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import {
  Plus, Map as MapIcon, ChevronLeft, ChevronRight, Trash2, LinkIcon, X,
  TrendingUp, CheckCircle2, Clock, PlayCircle,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { chip: string }> = {
  ACTIVE:    { chip: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  COMPLETED: { chip: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"  },
  PAUSED:    { chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

const STATUS_KEY: Record<string, string> = {
  ACTIVE:    "statusActive",
  COMPLETED: "statusCompleted",
  PAUSED:    "statusPaused",
};

const CYCLE_STATUS_CONFIG: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DRAFT:  "bg-muted text-muted-foreground",
};

const CYCLE_STATUS_KEY: Record<string, string> = {
  ACTIVE: "statusActive",
  CLOSED: "statusClosed",
  DRAFT:  "statusDraft",
};

const FOCUS_AREA_OPTIONS = [
  "Gobernanza", "Ejecución", "Digital", "Talento",
  "Modelo de Negocio", "Regulatorio", "Eficiencia",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(n: number | null | undefined) {
  return `${Number(n ?? 0).toFixed(0)}%`;
}

// ── Focus area chips ──────────────────────────────────────────────────────────

function FocusChips({ areas }: { areas: string[] | null }) {
  if (!areas?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {areas.map(a => (
        <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
          {a}
        </span>
      ))}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className={cn("h-1.5 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Create program dialog ─────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

function CreateProgramDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("pages.program");
  const create = useCreateProgram();
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_year: CURRENT_YEAR,
    end_year: CURRENT_YEAR + 2,
    vision_statement: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    await create.mutateAsync({
      title: form.title,
      description: form.description || undefined,
      start_year: form.start_year,
      end_year: form.end_year,
      vision_statement: form.vision_statement || undefined,
    });
    setForm({ title: "", description: "", start_year: CURRENT_YEAR, end_year: CURRENT_YEAR + 2, vision_statement: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newProgram")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="prog-title">Título *</Label>
            <Input
              id="prog-title" required
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Ej. Transformación Digital 2026–2029"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prog-desc">Descripción</Label>
            <Input
              id="prog-desc"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Descripción breve del programa"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prog-start">Año inicio *</Label>
              <Input
                id="prog-start" type="number" min={2020} max={2050} required
                value={form.start_year}
                onChange={e => set("start_year", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prog-end">Año fin *</Label>
              <Input
                id="prog-end" type="number" min={2020} max={2060} required
                value={form.end_year}
                onChange={e => set("end_year", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prog-vision">Visión estratégica</Label>
            <textarea
              id="prog-vision"
              className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.vision_statement}
              onChange={e => set("vision_statement", e.target.value)}
              placeholder="El norte estratégico del programa…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creando…" : t("newBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Add cycle dialog ──────────────────────────────────────────────────────────

function AddCycleDialog({
  programId, open, onOpenChange,
}: {
  programId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations("pages.program");
  const { data: cycles = [] } = useCycles();
  const addCycle = useAddProgramCycle();
  const [form, setForm] = useState({
    cycle_id: "",
    year_label: "",
    year_number: 1,
    focus_areas: [] as string[],
    expected_outcomes: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleArea = (a: string) =>
    setForm(f => ({
      ...f,
      focus_areas: f.focus_areas.includes(a)
        ? f.focus_areas.filter(x => x !== a)
        : [...f.focus_areas, a],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cycle_id || !form.year_label) return;
    await addCycle.mutateAsync({
      programId,
      cycle_id: form.cycle_id,
      year_label: form.year_label,
      year_number: form.year_number,
      focus_areas: form.focus_areas.length ? form.focus_areas : undefined,
      expected_outcomes: form.expected_outcomes || undefined,
    });
    setForm({ cycle_id: "", year_label: "", year_number: 1, focus_areas: [], expected_outcomes: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("linkCycle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ac-cycle">{t("cycleLabel")} *</Label>
            <Select
              id="ac-cycle" required
              value={form.cycle_id}
              onChange={e => set("cycle_id", e.target.value)}
            >
              <SelectOption value="">Seleccionar ciclo…</SelectOption>
              {cycles.map(c => (
                <SelectOption key={c.id} value={c.id}>
                  {c.name} ({t(CYCLE_STATUS_KEY[c.status] ?? "statusDraft")})
                </SelectOption>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-label">{t("yearLabel")} *</Label>
              <Input
                id="ac-label" required
                value={form.year_label}
                onChange={e => set("year_label", e.target.value)}
                placeholder="Ej. Año 1: Fundaciones"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-number">{t("yearNumber")} *</Label>
              <Input
                id="ac-number" type="number" min={1} max={20} required
                value={form.year_number}
                onChange={e => set("year_number", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("focusAreas")}</Label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREA_OPTIONS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArea(a)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    form.focus_areas.includes(a)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-border text-muted-foreground hover:border-indigo-400 hover:text-indigo-600"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ac-outcomes">{t("expectedOutcomes")}</Label>
            <textarea
              id="ac-outcomes"
              className="w-full min-h-[72px] rounded-lg border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.expected_outcomes}
              onChange={e => set("expected_outcomes", e.target.value)}
              placeholder="Qué se espera lograr al final de este año del programa…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={addCycle.isPending}>
              {addCycle.isPending ? "Vinculando…" : t("linkCycle")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Timeline node ─────────────────────────────────────────────────────────────

function TimelineNode({
  entry,
  programId,
  isActive,
  onLink,
}: {
  entry?: ProgramCycleEntry;
  programId: string;
  isActive: boolean;
  onLink: () => void;
}) {
  const t = useTranslations("pages.program");
  const removeCycle = useRemoveProgramCycle();
  const confirm = useConfirm();

  const handleRemove = async () => {
    if (!entry) return;
    const ok = await confirm({
      title: "¿Desvincular este ciclo?",
      description: "Se eliminará la asociación entre el ciclo y el programa. Los datos del ciclo no se borran.",
      confirmLabel: "Desvincular",
      variant: "destructive",
    });
    if (ok) removeCycle.mutate({ programId, cycleId: entry.cycle_id });
  };

  return (
    <div className={cn(
      "relative flex-1 min-w-[160px] max-w-[220px] rounded-xl border-2 p-4 transition-all",
      isActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-border bg-card",
      !entry && "border-dashed border-muted-foreground/30"
    )}>
      {/* Year badge */}
      {entry && (
        <div className="flex items-start justify-between gap-1 mb-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {entry.year_label}
          </span>
          <button
            onClick={handleRemove}
            className="shrink-0 p-0.5 text-muted-foreground hover:text-red-500 rounded transition-colors"
            aria-label={t("unlink")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {entry ? (
        <>
          <p className="text-sm font-semibold leading-snug">{entry.cycle_name}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
              CYCLE_STATUS_CONFIG[entry.cycle_status] ?? "bg-muted text-muted-foreground"
            )}>
              {t(CYCLE_STATUS_KEY[entry.cycle_status] ?? "statusDraft")}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar value={entry.avg_progress} />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{fmtPct(entry.avg_progress)}</p>
          </div>
          <FocusChips areas={entry.focus_areas} />
        </>
      ) : (
        <button
          onClick={onLink}
          className="w-full flex flex-col items-center gap-1.5 py-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <LinkIcon className="h-4 w-4" />
          <span className="text-xs">{t("linkCycle")}</span>
        </button>
      )}
    </div>
  );
}

// ── Program detail ────────────────────────────────────────────────────────────

function ProgramDetail({
  program,
  onBack,
}: {
  program: TransformationProgram;
  onBack: () => void;
}) {
  const t = useTranslations("pages.program");
  const [addOpen, setAddOpen] = useState(false);
  const deleteProgram = useDeleteProgram();
  const confirm = useConfirm();

  const years = program.end_year - program.start_year + 1;
  const yearsArr = Array.from({ length: years }, (_, i) => i + 1);

  const cyclesByYear = new Map<number, ProgramCycleEntry>();
  for (const c of program.cycles) cyclesByYear.set(c.year_number, c);

  const completedCycles = program.cycles.filter(c => c.cycle_status === "CLOSED").length;
  const activeCycle = program.cycles.find(c => c.cycle_status === "ACTIVE");

  const handleDelete = async () => {
    const ok = await confirm({
      title: "¿Eliminar este programa?",
      description: "Se eliminará el programa y todas sus vinculaciones con ciclos. Los ciclos y sus datos no se borran.",
      confirmLabel: "Eliminar programa",
      variant: "destructive",
    });
    if (ok) {
      await deleteProgram.mutateAsync(program.id);
      onBack();
    }
  };

  const sc = STATUS_CONFIG[program.status] ?? STATUS_CONFIG.ACTIVE;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onBack}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              aria-label="Volver a lista"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold">{program.title}</h2>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", sc.chip)}>
              {t(STATUS_KEY[program.status] ?? "statusActive")}
            </span>
            <span className="text-sm text-muted-foreground">
              {program.start_year} – {program.end_year}
            </span>
          </div>
          {program.vision_statement && (
            <p className="text-sm text-muted-foreground italic mt-1.5 pl-7">
              "{program.vision_statement}"
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <LinkIcon className="h-3.5 w-3.5" />
            {t("linkCycle")}
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 gap-1.5" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("totalCycles"),     value: program.cycles_count,  icon: MapIcon,         color: "text-foreground" },
          { label: t("completedCycles"), value: completedCycles,        icon: CheckCircle2, color: "text-blue-600 dark:text-blue-400" },
          { label: t("activeCycle"),     value: activeCycle ? "1" : "—", icon: PlayCircle, color: "text-green-600 dark:text-green-400" },
          { label: t("globalProgress"),  value: fmtPct(program.overall_progress), icon: TrendingUp, color: "text-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4 shrink-0", color)} aria-hidden="true" />
              <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
          {t("roadmapTitle")}
        </h3>
        <div className="relative">
          {/* Horizontal connector line */}
          <div className="absolute top-8 left-8 right-8 h-0.5 bg-border z-0" />
          <div className="relative z-10 flex items-start gap-3 overflow-x-auto pb-2">
            {yearsArr.map(yn => {
              const entry = cyclesByYear.get(yn);
              const isActive = entry?.cycle_status === "ACTIVE";
              return (
                <div key={yn} className="flex flex-col items-center gap-2 flex-shrink-0">
                  {/* Year number node */}
                  <div className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 bg-background",
                    isActive ? "border-blue-500 text-blue-500" : "border-muted-foreground/40 text-muted-foreground"
                  )}>
                    {yn}
                  </div>
                  <TimelineNode
                    entry={entry}
                    programId={program.id}
                    isActive={isActive}
                    onLink={() => setAddOpen(true)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AddCycleDialog programId={program.id} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

// ── Program card ──────────────────────────────────────────────────────────────

function ProgramCard({
  program,
  onClick,
}: {
  program: TransformationProgram;
  onClick: () => void;
}) {
  const t = useTranslations("pages.program");
  const sc = STATUS_CONFIG[program.status] ?? STATUS_CONFIG.ACTIVE;

  return (
    <Card
      className="p-5 cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold group-hover:text-primary transition-colors">{program.title}</h3>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", sc.chip)}>
              {t(STATUS_KEY[program.status] ?? "statusActive")}
            </span>
          </div>
          {program.vision_statement && (
            <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">
              {program.vision_statement}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-muted-foreground">{program.start_year}–{program.end_year}</p>
          <p className="text-xs text-muted-foreground">{program.end_year - program.start_year + 1} años</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{t("globalProgress")}</span>
          <span className="font-semibold tabular-nums">{fmtPct(program.overall_progress)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all",
              program.overall_progress >= 70 ? "bg-green-500" :
              program.overall_progress >= 40 ? "bg-amber-500" : "bg-red-400"
            )}
            style={{ width: `${Math.min(program.overall_progress, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{program.cycles_count} ciclo{program.cycles_count !== 1 ? "s" : ""} vinculado{program.cycles_count !== 1 ? "s" : ""}</span>
        {program.cycles.some(c => c.cycle_status === "ACTIVE") && (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Clock className="h-3 w-3" aria-hidden="true" />
            En ejecución
          </span>
        )}
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramPage() {
  const t = useTranslations("pages.program");
  const { data: programs = [], isLoading } = usePrograms();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<TransformationProgram | null>(null);

  // Sync selected with fresh data
  const selectedFresh = selected
    ? programs.find(p => p.id === selected.id) ?? selected
    : null;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("programTitle")}
        description={t("programSubtitle")}
        actions={
          !selectedFresh ? (
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("newProgram")}
            </Button>
          ) : undefined
        }
      />

      {selectedFresh ? (
        <ProgramDetail program={selectedFresh} onBack={() => setSelected(null)} />
      ) : (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0,1,2].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : programs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <MapIcon className="h-10 w-10 mx-auto mb-3 opacity-20" aria-hidden="true" />
              <p className="font-medium">Sin programas de transformación</p>
              <p className="text-sm mt-1">Crea el primer programa para estructurar una agenda multi-año.</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t("newBtn")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {programs.map(p => (
                <ProgramCard key={p.id} program={p} onClick={() => setSelected(p)} />
              ))}
            </div>
          )}
        </>
      )}

      <CreateProgramDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
