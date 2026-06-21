"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  Compass, Plus, MoreHorizontal, Pencil, X, AlertCircle,
  TrendingUp, Zap, Heart, Lightbulb, Leaf, HelpCircle,
  CheckCircle2, Clock, Star, Target, Sparkles, ChevronRight,
  AlertTriangle, Loader, Info, Eye, EyeOff, ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  useStrategicIntents, useCreateStrategicIntent, useUpdateStrategicIntent, useDeleteStrategicIntent,
  useSuggestStrategicIntents,
  type StrategicIntent, type AISuggestion,
} from "@/hooks/useStrategicIntents";
import { useProblems } from "@/hooks/useProblems";
import { useOrganization, useUpdateOrganization } from "@/hooks/useOrganization";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NonNullable<StrategicIntent["category"]>, { label: string; color: string; border: string; icon: React.ElementType }> = {
  GROWTH:         { label: "Crecimiento",   color: "text-green-700 dark:text-green-400",  border: "border-l-green-500",  icon: TrendingUp },
  EFFICIENCY:     { label: "Eficiencia",    color: "text-blue-700 dark:text-blue-400",    border: "border-l-blue-500",   icon: Zap },
  CULTURE:        { label: "Cultura",       color: "text-pink-700 dark:text-pink-400",    border: "border-l-pink-500",   icon: Heart },
  INNOVATION:     { label: "Innovación",    color: "text-indigo-700 dark:text-indigo-400",border: "border-l-indigo-500", icon: Lightbulb },
  SUSTAINABILITY: { label: "Sostenibilidad",color: "text-teal-700 dark:text-teal-400",   border: "border-l-teal-500",   icon: Leaf },
  OTHER:          { label: "Otro",          color: "text-gray-600 dark:text-gray-400",    border: "border-l-gray-400",   icon: HelpCircle },
};

const STATUS_CONFIG: Record<StrategicIntent["status"], { label: string; chip: string }> = {
  DRAFT:     { label: "Borrador",  chip: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  ACTIVE:    { label: "Activo",    chip: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  ACHIEVED:  { label: "Logrado",   chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  CANCELLED: { label: "Cancelado", chip: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const CURRENT_YEAR = new Date().getFullYear();

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as NonNullable<StrategicIntent["category"]>[];

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({ intent, onEdit, onDelete, onToggleStatus }: {
  intent: StrategicIntent;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const t = useTranslations("pages.strategy");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center"
        aria-label="Acciones"
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 min-w-44 rounded-lg border bg-popover p-1 shadow-lg">
          <button onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-accent">
            <Pencil className="h-3.5 w-3.5" /> {t("editAction")}
          </button>
          <button onClick={() => { setOpen(false); onToggleStatus(); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-accent">
            {intent.status === "ACTIVE" ? (
              <><Clock className="h-3.5 w-3.5" /> {t("backToDraft")}</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {t("activateAction")}</>
            )}
          </button>
          <div className="my-1 h-px bg-border" />
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">
            <X className="h-3.5 w-3.5" /> {t("deleteAction")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Intent Card ──────────────────────────────────────────────────────────────

function IntentCard({ intent, onEdit }: { intent: StrategicIntent; onEdit: (i: StrategicIntent) => void }) {
  const t = useTranslations("pages.strategy");
  const update = useUpdateStrategicIntent();
  const del = useDeleteStrategicIntent();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cat = intent.category ? CATEGORY_CONFIG[intent.category] : CATEGORY_CONFIG.OTHER;
  const status = STATUS_CONFIG[intent.status];
  const CatIcon = cat.icon;

  return (
    <Card className={cn(
      "relative p-5 border-l-4 transition-shadow hover:shadow-md",
      cat.border,
      intent.status === "CANCELLED" && "opacity-60"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", cat.color)}>
              <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {cat.label}
            </span>
            <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full", status.chip)}>
              {intent.status === "ACTIVE" && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />}
              {intent.status === "ACHIEVED" && <Star className="h-3 w-3 mr-1 text-amber-500" aria-hidden="true" />}
              {status.label}
            </span>
          </div>

          {/* Title */}
          <h3 className={cn(
            "text-base font-semibold text-foreground mb-1 group/title",
            intent.status === "CANCELLED" && "line-through text-muted-foreground"
          )}>
            {intent.code && (
              <span className="text-[10px] font-mono text-muted-foreground/50 mr-1.5 align-middle opacity-0 group-hover/title:opacity-100 transition-opacity">
                {intent.code}
              </span>
            )}
            {intent.title}
          </h3>

          {/* Description */}
          {intent.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-3 whitespace-pre-line">{intent.description}</p>
          )}

          {/* Footer chips */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            {intent.target_year && (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Target className="h-3 w-3" aria-hidden="true" />
                → {intent.target_year}
              </span>
            )}
            {intent.problem_count > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {intent.problem_count} problema{intent.problem_count !== 1 ? "s" : ""} vinculado{intent.problem_count !== 1 ? "s" : ""}
              </span>
            )}
            {intent.aligned_objectives_count > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {intent.aligned_objectives_count} OKR{intent.aligned_objectives_count !== 1 ? "s" : ""} alineado{intent.aligned_objectives_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <ActionMenu
          intent={intent}
          onEdit={() => onEdit(intent)}
          onDelete={() => setConfirmDelete(true)}
          onToggleStatus={() =>
            update.mutate({ id: intent.id, status: intent.status === "ACTIVE" ? "DRAFT" : "ACTIVE" })
          }
        />
      </div>

      {confirmDelete && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded px-3 py-2 mt-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{t("deleteConfirm")}</span>
          <button onClick={() => del.mutate(intent.id)} className="ml-auto font-medium hover:underline">{t("confirmBtn")}</button>
          <button onClick={() => setConfirmDelete(false)} className="font-medium text-muted-foreground hover:underline">{t("abortBtn")}</button>
        </div>
      )}
    </Card>
  );
}

// ─── Create / Edit Dialog ─────────────────────────────────────────────────────

const DESCRIPTION_TEMPLATE = `Situación:
Dirección:
Impacto: `;

const EMPTY_FORM = {
  title: "",
  description: DESCRIPTION_TEMPLATE,
  category: "GROWTH" as NonNullable<StrategicIntent["category"]>,
  horizon_years: 3,
  target_year: CURRENT_YEAR + 3,
};

function IntentDialog({ open, onClose, initial, defaultCategory }: {
  open: boolean;
  onClose: () => void;
  initial?: StrategicIntent | null;
  defaultCategory?: NonNullable<StrategicIntent["category"]>;
}) {
  const t = useTranslations("pages.strategy");
  const create = useCreateStrategicIntent();
  const update = useUpdateStrategicIntent();

  const emptyForm = () => ({ ...EMPTY_FORM, category: defaultCategory ?? "GROWTH" as NonNullable<StrategicIntent["category"]> });

  const [form, setForm] = useState(initial
    ? {
        title: initial.title,
        description: initial.description ?? DESCRIPTION_TEMPLATE,
        category: (initial.category ?? "OTHER") as NonNullable<StrategicIntent["category"]>,
        horizon_years: initial.horizon_years,
        target_year: initial.target_year ?? CURRENT_YEAR + initial.horizon_years,
      }
    : emptyForm()
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial
        ? {
            title: initial.title,
            description: initial.description ?? DESCRIPTION_TEMPLATE,
            category: (initial.category ?? "OTHER") as NonNullable<StrategicIntent["category"]>,
            horizon_years: initial.horizon_years,
            target_year: initial.target_year ?? CURRENT_YEAR + initial.horizon_years,
          }
        : emptyForm()
      );
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, defaultCategory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const descClean = form.description.trim();
      const descValue = (descClean === DESCRIPTION_TEMPLATE.trim() || !descClean) ? undefined : descClean;
      const payload = {
        title: form.title,
        description: descValue,
        category: form.category,
        horizon_years: form.horizon_years,
        target_year: form.target_year,
      };
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("saveError")));
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? t("editIntent") : t("createIntent")}</DialogTitle>
          <DialogDescription>
            {t("formDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("fieldTitle")}</label>
            <Input
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={t("fieldTitlePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("fieldCategory")}</label>
            <Select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as NonNullable<StrategicIntent["category"]> }))}
            >
              {ALL_CATEGORIES.map((k) => (
                <SelectOption key={k} value={k}>{CATEGORY_CONFIG[k].label}</SelectOption>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("fieldHorizon")}</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.horizon_years}
                onChange={(e) => {
                  const h = parseInt(e.target.value) || 3;
                  setForm((p) => ({ ...p, horizon_years: h, target_year: CURRENT_YEAR + h }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("fieldYear")}</label>
              <Input
                type="number"
                min={CURRENT_YEAR}
                max={CURRENT_YEAR + 20}
                value={form.target_year}
                onChange={(e) => setForm((p) => ({ ...p, target_year: parseInt(e.target.value) || CURRENT_YEAR + 3 }))}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
            En {form.horizon_years} año{form.horizon_years !== 1 ? "s" : ""} — para {form.target_year}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("fieldDescription")}</label>
            <p className="text-xs text-muted-foreground -mt-1">
              Usa las tres secciones: <strong>{t("fieldSituation")}</strong> (brecha actual), <strong>{t("fieldDirection")}</strong> (hacia dónde vamos) e <strong>{t("fieldImpact")}</strong> (qué cambia al lograrlo).
            </p>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={5}
              className="font-mono text-sm"
            />
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancelBtn")}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : initial ? t("saveChanges") : t("createBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Descriptions por categoría ───────────────────────────────────────────────

const CATEGORY_DESCRIPTIONS: Record<NonNullable<StrategicIntent["category"]>, string> = {
  GROWTH:         "Aumentar ingresos, clientes, mercados o escala. Son las apuestas de expansión que definen el tamaño futuro de la organización.",
  EFFICIENCY:     "Reducir costos, tiempos o desperdicios sin sacrificar calidad. Hacen sostenible el crecimiento a largo plazo.",
  CULTURE:        "Cambios en valores, comportamientos o forma de trabajar. Sin una cultura alineada, ninguna estrategia se sostiene.",
  INNOVATION:     "Crear nuevos productos, servicios o modelos de negocio. Son las apuestas que diferencian a la organización del resto.",
  SUSTAINABILITY: "Impacto ambiental, social o gobernanza. Cada vez más determinante para la reputación y la licencia para operar.",
  OTHER:          "Intenciones que no encajan en las categorías anteriores pero son relevantes para la dirección de la organización.",
};

// ─── VisionCard ──────────────────────────────────────────────────────────────

function VisionCard() {
  const t = useTranslations("pages.strategy");
  const { data: org } = useOrganization();
  const update = useUpdateOrganization();

  const saved = (org?.vision as string | undefined) ?? undefined;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saved2, setSaved2] = useState(false);

  useEffect(() => {
    if (!editing) setValue(saved ?? "");
  }, [saved, editing]);

  async function handleSave() {
    await update.mutateAsync({ vision: value.trim() });
    setEditing(false);
    setSaved2(true);
    setTimeout(() => setSaved2(false), 2000);
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t("visionLabel")}</span>
          {saved2 && <span className="text-xs text-okr-on-track">{t("visionSaved")}</span>}
        </div>
        {!editing && (
          <button
            onClick={() => { setValue(saved ?? ""); setEditing(true); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            {saved ? t("visionEdit") : <Plus className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("visionPlaceholder")}
            rows={3}
            className="text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground">{t("visionHint")}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={update.isPending} className="h-7 text-xs">
              {t("visionSave")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 text-xs">
              {t("cancelBtn")}
            </Button>
          </div>
        </div>
      ) : saved ? (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{saved}</p>
      ) : (
        <button
          onClick={() => { setValue(""); setEditing(true); }}
          className="w-full rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/30 hover:border-primary/30 transition-colors text-left flex items-center gap-2"
        >
          <Plus className="h-4 w-4 opacity-40" />
          {t("visionPlaceholder")}
        </button>
      )}
    </div>
  );
}

// ─── StrategyFlowBanner ───────────────────────────────────────────────────────

function StrategyFlowBanner({ problemCount, intentCount }: { problemCount: number; intentCount: number }) {
  if (intentCount >= 3) return null;

  const steps = [
    {
      label: "Diagnóstico",
      icon: AlertTriangle,
      done: problemCount > 0,
      detail: problemCount > 0 ? `${problemCount} problema${problemCount !== 1 ? "s" : ""} registrado${problemCount !== 1 ? "s" : ""}` : "Sin problemas aún",
      accent: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      label: "Estrategia",
      icon: Compass,
      done: intentCount > 0,
      detail: "Estás aquí",
      accent: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-900/30",
      current: true,
    },
    {
      label: "OKRs",
      icon: Target,
      done: false,
      detail: "Siguiente paso",
      accent: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
  ];

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold">¿Para qué sirven las intenciones estratégicas?</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Son las grandes apuestas de tu organización para los próximos años. Se derivan del diagnóstico
          y se convierten en la brújula que orienta todos los OKRs. Sin ellas, los objetivos operativos
          pierden dirección.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex sm:flex-col flex-row items-center gap-2 flex-1">
              <div className={cn(
                "flex-1 w-full rounded-xl border p-3 flex flex-col gap-2",
                step.current
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : step.done
                    ? "bg-muted/20 border-border/40"
                    : "bg-muted/10 border-dashed border-border/40"
              )}>
                <div className="flex items-center justify-between">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", step.bg)}>
                    <Icon className={cn("h-4 w-4", step.accent)} />
                  </div>
                  {step.done && !step.current && (
                    <CheckCircle2 className="h-4 w-4 text-okr-on-track" />
                  )}
                  {step.current && (
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Aquí</span>
                  )}
                </div>
                <div>
                  <p className={cn("text-sm font-bold", step.current ? "text-primary" : step.done ? "text-muted-foreground" : "text-foreground")}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                </div>
              </div>
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

// ─── CategorySection ──────────────────────────────────────────────────────────

const CAT_BG: Record<NonNullable<StrategicIntent["category"]>, string> = {
  GROWTH:         "bg-green-100 dark:bg-green-900/30",
  EFFICIENCY:     "bg-blue-100 dark:bg-blue-900/30",
  CULTURE:        "bg-pink-100 dark:bg-pink-900/30",
  INNOVATION:     "bg-indigo-100 dark:bg-indigo-900/30",
  SUSTAINABILITY: "bg-teal-100 dark:bg-teal-900/30",
  OTHER:          "bg-gray-100 dark:bg-gray-800",
};

function CategorySection({
  category,
  intents,
  onEdit,
  onCreate,
}: {
  category: NonNullable<StrategicIntent["category"]>;
  intents: StrategicIntent[];
  onEdit: (i: StrategicIntent) => void;
  onCreate: () => void;
}) {
  const t = useTranslations("pages.strategy");
  const cfg     = CATEGORY_CONFIG[category];
  const desc    = CATEGORY_DESCRIPTIONS[category];
  const CatIcon = cfg.icon;

  const active   = intents.filter(i => i.status === "ACTIVE");
  const inactive = intents.filter(i => i.status !== "ACTIVE").sort((a, b) => {
    const order: Record<StrategicIntent["status"], number> = { ACTIVE: 0, DRAFT: 1, ACHIEVED: 2, CANCELLED: 3 };
    return order[a.status] - order[b.status];
  });

  const INACTIVE_THRESHOLD = 3;
  const [showAllInactive, setShowAllInactive] = useState(false);
  const visibleInactive = showAllInactive ? inactive : inactive.slice(0, INACTIVE_THRESHOLD);
  const hiddenCount = inactive.length - visibleInactive.length;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5", CAT_BG[category])}>
            <CatIcon className={cn("h-5 w-5", cfg.color)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold">{cfg.label}</h2>
              {active.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-okr-on-track bg-okr-on-track-bg px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> {active.length} activ{active.length !== 1 ? "as" : "a"}
                </span>
              )}
              <div className="relative group/tip">
                <Info className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help" />
                <div className="absolute left-0 top-6 z-50 w-72 rounded-lg border bg-popover p-3 text-xs text-muted-foreground shadow-lg hidden group-hover/tip:block leading-relaxed">
                  {desc}
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onCreate} className="h-8 text-xs gap-1.5 shrink-0 mt-0.5">
          <Plus className="h-3.5 w-3.5" /> Crear
        </Button>
      </div>

      {/* Sin intenciones */}
      {intents.length === 0 && (
        <div
          onClick={onCreate}
          className="rounded-xl border border-dashed border-border/60 px-5 py-4 text-sm text-muted-foreground hover:bg-muted/30 hover:border-primary/30 transition-colors cursor-pointer flex items-center gap-2"
        >
          <Plus className="h-4 w-4 opacity-40" />
          {t("addIntentOf", { category: cfg.label.toLowerCase() })}
        </div>
      )}

      {/* Activas */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map(intent => (
            <IntentCard key={intent.id} intent={intent} onEdit={onEdit} />
          ))}
        </div>
      )}

      {/* Separador + inactivas */}
      {inactive.length > 0 && (
        <div className="space-y-2.5">
          {active.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                {inactive.length} inactiv{inactive.length !== 1 ? "as" : "a"}
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
          )}
          <div className="space-y-2 opacity-50">
            {visibleInactive.map(intent => (
              <IntentCard key={intent.id} intent={intent} onEdit={onEdit} />
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAllInactive(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pl-1"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Ver {hiddenCount} más
            </button>
          )}
          {showAllInactive && inactive.length > INACTIVE_THRESHOLD && (
            <button
              onClick={() => setShowAllInactive(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pl-1"
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
              Ocultar
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ─── AI Suggestions Dialog ────────────────────────────────────────────────────

const VALID_CATEGORIES = ["GROWTH", "EFFICIENCY", "CULTURE", "INNOVATION", "SUSTAINABILITY", "OTHER"] as const;
function toCategory(c: string): NonNullable<StrategicIntent["category"]> {
  return (VALID_CATEGORIES as readonly string[]).includes(c)
    ? (c as NonNullable<StrategicIntent["category"]>)
    : "OTHER";
}

function SuggestionCard({
  suggestion,
  index,
  accepted,
  onAccept,
}: {
  suggestion: AISuggestion;
  index: number;
  accepted: boolean;
  onAccept: () => void;
}) {
  const cat = CATEGORY_CONFIG[toCategory(suggestion.category)] ?? CATEGORY_CONFIG.OTHER;
  const CatIcon = cat.icon;

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      accepted
        ? "opacity-50 bg-muted/30 border-border/40"
        : "bg-card hover:shadow-sm border-border"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold mt-0.5",
          accepted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {accepted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", cat.color)}>
              <CatIcon className="h-3 w-3" />
              {cat.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {suggestion.horizon_years} años · {suggestion.target_year}
            </span>
          </div>

          <p className={cn(
            "text-sm font-semibold mb-1",
            accepted && "line-through text-muted-foreground"
          )}>
            {suggestion.title}
          </p>

          {suggestion.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-2 whitespace-pre-line">
              {suggestion.description}
            </p>
          )}

          {suggestion.rationale && !accepted && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 px-2.5 py-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                {suggestion.rationale}
              </p>
            </div>
          )}
        </div>

        {!accepted && (
          <Button size="sm" onClick={onAccept} className="shrink-0 h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Crear
          </Button>
        )}
      </div>
    </div>
  );
}

function AISuggestionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const tStrategy = useTranslations("pages.strategy");
  const suggest = useSuggestStrategicIntents();
  const create  = useCreateStrategicIntent();
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open && !suggest.data && !suggest.isPending) {
      suggest.mutate(undefined);
    }
    if (!open) {
      suggest.reset();
      setAccepted(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const suggestions = suggest.data?.suggestions ?? [];
  const pending = suggestions.filter((_, i) => !accepted.has(i));

  async function handleAccept(s: AISuggestion, idx: number) {
    await create.mutateAsync({
      title: s.title,
      description: s.description || undefined,
      category: toCategory(s.category),
      horizon_years: s.horizon_years,
      target_year: s.target_year,
    });
    setAccepted(prev => new Set(prev).add(idx));
  }

  async function handleAcceptAll() {
    for (let i = 0; i < suggestions.length; i++) {
      if (!accepted.has(i)) {
        await handleAccept(suggestions[i], i);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            {tStrategy("aiSuggestionsTitle")}
          </DialogTitle>
          <DialogDescription>
            {tStrategy("aiSuggestionsDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 py-2">
          {suggest.isPending && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Loader className="h-4 w-4 animate-spin" />
                {tStrategy("aiAnalyzing")}
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
              ))}
            </>
          )}

          {suggest.isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {tStrategy("aiError")}
            </div>
          )}

          {suggest.data?.error && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              {suggest.data.error}
            </div>
          )}

          {suggestions.length > 0 && suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              suggestion={s}
              index={i}
              accepted={accepted.has(i)}
              onAccept={() => handleAccept(s, i)}
            />
          ))}

          {suggest.isSuccess && suggestions.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {tStrategy("aiEmpty")}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <DialogFooter className="flex-col gap-2 sm:flex-row pt-3 border-t">
            <span className="text-xs text-muted-foreground self-center mr-auto">
              {accepted.size} de {suggestions.length} creada{accepted.size !== 1 ? "s" : ""}
            </span>
            {pending.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcceptAll}
                disabled={create.isPending}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {tStrategy("aiCreateRemaining", { n: pending.length })}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {accepted.size > 0 ? tStrategy("aiClose") : tStrategy("cancelBtn")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const zero = value === 0;
  return (
    <Card className={cn("p-4 flex-1 min-w-0", zero && "opacity-50")}>
      <p className={cn("text-2xl font-bold", zero ? "text-muted-foreground" : "text-foreground")}>{value}</p>
      <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
      {sub && !zero && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const t = useTranslations("pages.strategy");
  const { data: intents, isPending } = useStrategicIntents();
  const { data: problems }           = useProblems();
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const [editIntent,     setEditIntent]     = useState<StrategicIntent | null>(null);
  const [defaultCat,     setDefaultCat]     = useState<NonNullable<StrategicIntent["category"]>>("GROWTH");
  const [aiOpen,         setAiOpen]         = useState(false);
  const [showEmpty,      setShowEmpty]       = useState(false);

  const all          = intents ?? [];
  const problemCount = problems?.length ?? 0;

  function openEdit(i: StrategicIntent) {
    setEditIntent(i);
    setDialogOpen(true);
  }

  function openCreate(cat?: NonNullable<StrategicIntent["category"]>) {
    setEditIntent(null);
    if (cat) setDefaultCat(cat);
    setDialogOpen(true);
  }

  const PRIMARY_CATEGORIES: NonNullable<StrategicIntent["category"]>[] = ["GROWTH", "EFFICIENCY", "CULTURE", "INNOVATION", "SUSTAINABILITY", "OTHER"];
  const categoriesWithItems  = PRIMARY_CATEGORIES.filter(k => all.some(i => i.category === k));
  const emptyCategories      = PRIMARY_CATEGORIES.filter(k => !all.some(i => i.category === k));

  // Categorías con activas primero, luego las que solo tienen inactivas
  const sortedCategories = [...categoriesWithItems].sort((a, b) => {
    const aHasActive = all.some(i => i.category === a && i.status === "ACTIVE") ? 0 : 1;
    const bHasActive = all.some(i => i.category === b && i.status === "ACTIVE") ? 0 : 1;
    return aHasActive - bHasActive;
  });

  const visibleCategories    = showEmpty
    ? [...sortedCategories, ...emptyCategories]
    : sortedCategories.length > 0 ? sortedCategories : PRIMARY_CATEGORIES.slice(0, 3);

  if (isPending) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAiOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {t("suggestAI")}
            </Button>
            <Button onClick={() => openCreate()} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("newIntent")}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <StatCard label={t("totalIntents")} value={all.length} />
        <StatCard
          label={t("activeLabel")}
          value={all.filter(i => i.status === "ACTIVE").length}
          sub={t("activeSub")}
        />
        <StatCard
          label={t("draftsLabel")}
          value={all.filter(i => i.status === "DRAFT").length}
          sub={t("draftsSub")}
        />
        <StatCard
          label={t("achievedLabel")}
          value={all.filter(i => i.status === "ACHIEVED").length}
          sub={t("achievedSub")}
        />
      </div>

      {/* Visión organizacional */}
      <VisionCard />

      <StrategyFlowBanner problemCount={problemCount} intentCount={all.length} />

      {/* Panel IA — solo primera vez: hay problemas pero aún no hay intenciones */}
      {problemCount > 0 && all.length === 0 && (
        <Card className="p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">La IA puede sugerir intenciones estratégicas</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                Tienes {problemCount} problema{problemCount !== 1 ? "s" : ""} registrado{problemCount !== 1 ? "s" : ""} en el diagnóstico.
                El asistente puede analizar esos dolores y proponer las intenciones más relevantes.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Secciones por categoría */}
      <div className="space-y-8">
        {visibleCategories.map(cat => (
          <CategorySection
            key={cat}
            category={cat}
            intents={all.filter(i => i.category === cat)}
            onEdit={openEdit}
            onCreate={() => openCreate(cat)}
          />
        ))}

        {/* Toggle categorías vacías */}
        {emptyCategories.length > 0 && (
          <button
            onClick={() => setShowEmpty(v => !v)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full pt-2"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showEmpty && "rotate-180")} />
            {showEmpty
              ? t("hideEmptyCategories")
              : `Ver ${emptyCategories.length} categoría${emptyCategories.length !== 1 ? "s" : ""} sin intenciones`}
          </button>
        )}
      </div>

      <IntentDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditIntent(null); }}
        initial={editIntent}
        defaultCategory={defaultCat}
      />

      <AISuggestionsDialog open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
