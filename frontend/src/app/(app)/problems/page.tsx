"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  AlertTriangle, Plus, MoreHorizontal, Pencil, X, AlertCircle, Trash2,
  Users, Cpu, TrendingUp, Globe, Heart, DollarSign, Settings2, HelpCircle,
  CheckCircle2, Clock, MinusCircle, Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useProblems, useCreateProblem, useUpdateProblem, useDeleteProblem, type Problem } from "@/hooks/useProblems";
import { DiagnosticWizard } from "@/components/ai/DiagnosticWizard";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Problem["category"], { label: string; color: string; icon: React.ElementType }> = {
  PEOPLE:      { label: "Personas",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    icon: Users },
  PROCESS:     { label: "Proceso",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Settings2 },
  TECHNOLOGY:  { label: "Tecnología",  color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", icon: Cpu },
  MARKET:      { label: "Mercado",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Globe },
  CULTURE:     { label: "Cultura",     color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",    icon: Heart },
  FINANCIAL:   { label: "Financiero",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: DollarSign },
  OPERATIONAL: { label: "Operacional", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",   icon: TrendingUp },
  OTHER:       { label: "Otro",        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",       icon: HelpCircle },
};

const STATUS_CONFIG: Record<Problem["status"], { label: string; color: string; icon: React.ElementType }> = {
  IDENTIFIED:       { label: "Identificado",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: AlertCircle },
  BEING_ADDRESSED:  { label: "En proceso",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",     icon: Clock },
  RESOLVED:         { label: "Resuelto",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  DEPRIORITIZED:    { label: "Despriorizado",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",        icon: MinusCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DotRating({ value, max = 5, color = "text-foreground" }: { value: number; max?: number; color?: string }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn("text-xs", i < value ? color : "text-muted-foreground/30")}>●</span>
      ))}
    </span>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({ onEdit, onDelete, onAddress, onResolve, onDeprioritize }: {
  onEdit: () => void;
  onDelete: () => void;
  onAddress: () => void;
  onResolve: () => void;
  onDeprioritize: () => void;
}) {
  const t = useTranslations("pages.problems");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
        aria-label={t("actionsAriaLabel")}
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> {t("editAction")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddress}>
          <Clock className="h-3.5 w-3.5 text-blue-600" /> {t("markInProcess")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onResolve}>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {t("markResolved")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDeprioritize}>
          <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" /> {t("deprioritize")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <X className="h-3.5 w-3.5" /> {t("deleteAction")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Inline Confirm ───────────────────────────────────────────────────────────

function ConfirmDelete({ onConfirm, onAbort }: { onConfirm: () => void; onAbort: () => void }) {
  const t = useTranslations("pages.problems");
  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded px-3 py-2 mt-2">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{t("confirmDelete")}</span>
      <button onClick={onConfirm} className="ml-auto font-medium hover:underline">{t("confirm")}</button>
      <button onClick={onAbort} className="font-medium text-muted-foreground hover:underline">{t("abort")}</button>
    </div>
  );
}

// ─── Score Group Button ───────────────────────────────────────────────────────

function ScoreButtons({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const v = i + 1;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "h-8 w-8 rounded-md border text-sm font-medium transition-colors",
              value === v
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

// ─── Problem Card ─────────────────────────────────────────────────────────────

function ProblemCard({ problem, onEdit }: { problem: Problem; onEdit: (p: Problem) => void }) {
  const t = useTranslations("pages.problems");
  const update = useUpdateProblem();
  const del = useDeleteProblem();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cat = CATEGORY_CONFIG[problem.category];
  const status = STATUS_CONFIG[problem.status];
  const StatusIcon = status.icon;

  const priorityBand =
    problem.priority_score >= 16 ? "border-l-red-500" :
    problem.priority_score >= 9  ? "border-l-amber-500" : "border-l-green-500";

  return (
    <Card className={cn("p-4 border-l-4 transition-shadow hover:shadow-md group", priorityBand)}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", cat.color)}>
              <cat.icon className="h-3 w-3" aria-hidden="true" />
              {t(`category.${problem.category}`)}
            </span>
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", status.color)}>
              <StatusIcon className="h-3 w-3" aria-hidden="true" />
              {t(`status.${problem.status}`)}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {problem.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5">{problem.code}</span>}
            {problem.title}
          </h3>
          {problem.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{problem.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {t("severity")} <DotRating value={problem.severity} color="text-red-500" />
            </span>
            <span className="flex items-center gap-1.5">
              {t("frequency")} <DotRating value={problem.frequency} color="text-amber-500" />
            </span>
            <span className="ml-auto font-mono font-semibold text-foreground">
              Score: {problem.priority_score}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setConfirmDelete(true)}
            className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-opacity"
            aria-label={t("deleteAriaLabel")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <ActionMenu
            onEdit={() => onEdit(problem)}
            onDelete={() => setConfirmDelete(true)}
            onAddress={() => update.mutate({ id: problem.id, status: "BEING_ADDRESSED" })}
            onResolve={() => update.mutate({ id: problem.id, status: "RESOLVED" })}
            onDeprioritize={() => update.mutate({ id: problem.id, status: "DEPRIORITIZED" })}
          />
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDelete
          onConfirm={() => del.mutate(problem.id)}
          onAbort={() => setConfirmDelete(false)}
        />
      )}
    </Card>
  );
}

// ─── Matrix View ──────────────────────────────────────────────────────────────

function MatrixView({ problems, onCellClick, selectedCell }: {
  problems: Problem[];
  onCellClick: (sev: number, freq: number) => void;
  selectedCell: { sev: number; freq: number } | null;
}) {
  const t = useTranslations("pages.problems");
  function countAt(sev: number, freq: number) {
    return problems.filter((p) => p.severity === sev && p.frequency === freq).length;
  }

  function cellColor(sev: number, freq: number) {
    const score = sev * freq;
    if (score >= 16) return "bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 border-red-200 dark:border-red-800";
    if (score >= 9)  return "bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800";
    return "bg-green-50 hover:bg-green-100 dark:bg-green-900/10 dark:hover:bg-green-900/20 border-green-200 dark:border-green-900";
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[360px]">
        <div className="flex items-center mb-1 pl-10">
          {[1, 2, 3, 4, 5].map((f) => (
            <div key={f} className="w-14 text-center text-xs text-muted-foreground font-medium">{f}</div>
          ))}
        </div>
        <div className="flex items-center mb-1 pl-10">
          <div className="flex-1 text-center text-xs text-muted-foreground">{t("frequency")} →</div>
        </div>

        {[5, 4, 3, 2, 1].map((sev) => (
          <div key={sev} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-10 text-right pr-2 text-xs text-muted-foreground font-medium shrink-0">{sev}</div>
            {[1, 2, 3, 4, 5].map((freq) => {
              const count = countAt(sev, freq);
              const isSelected = selectedCell?.sev === sev && selectedCell?.freq === freq;
              return (
                <button
                  key={freq}
                  onClick={() => onCellClick(sev, freq)}
                  className={cn(
                    "w-14 h-10 rounded border text-sm font-semibold transition-colors",
                    cellColor(sev, freq),
                    isSelected && "ring-2 ring-primary ring-offset-1",
                    count === 0 && "text-muted-foreground/40"
                  )}
                  aria-label={t("matrixAriaLabel", { sev, freq, count })}
                >
                  {count > 0 ? count : "·"}
                </button>
              );
            })}
          </div>
        ))}

        <div className="flex items-center mt-1 pl-10">
          <div className="flex-1 text-xs text-muted-foreground text-center opacity-0">_</div>
        </div>

        <div className="mt-1 pl-10 text-xs text-muted-foreground text-right pr-1">
          ↑ {t("severity")}
        </div>

        <div className="flex gap-4 mt-4 pl-10 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-100 border border-green-200 dark:bg-green-900/20 inline-block" />{t("low")}</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-100 border border-amber-200 dark:bg-amber-900/20 inline-block" />{t("medium")}</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 border border-red-200 dark:bg-red-900/20 inline-block" />{t("critical")}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Dialog ─────────────────────────────────────────────────────

const PRB_TEMPLATE = `Manifestación:\nCausa raíz:\nImpacto:`;
const EMPTY_FORM = { title: "", description: PRB_TEMPLATE, category: "PROCESS" as Problem["category"], severity: 3, frequency: 3 };

function ProblemDialog({ open, onClose, initial }: {
  open: boolean;
  onClose: () => void;
  initial?: Problem | null;
}) {
  const t = useTranslations("pages.problems");
  const create = useCreateProblem();
  const update = useUpdateProblem();
  const [form, setForm] = useState(initial
    ? { title: initial.title, description: initial.description ?? PRB_TEMPLATE, category: initial.category, severity: initial.severity, frequency: initial.frequency }
    : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { title: initial.title, description: initial.description ?? PRB_TEMPLATE, category: initial.category, severity: initial.severity, frequency: initial.frequency }
        : EMPTY_FORM
      );
      setError(null);
    }
  }, [open, initial]);

  const priorityPreview = form.severity * form.frequency;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const descClean = form.description.trim();
      const descValue = (descClean === PRB_TEMPLATE.trim() || !descClean) ? undefined : descClean;
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...form, description: descValue });
      } else {
        await create.mutateAsync({ ...form, description: descValue });
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
          <DialogTitle>{initial ? t("editProblem") : t("newProblem")}</DialogTitle>
          <DialogDescription>
            {t("problemDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("titleLabel")}</label>
            <Input
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={t("titlePlaceholder")}
            />
            {form.title.length > 0 && form.title.length < 10 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {t("titleTooShort")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("categoryLabel")}</label>
            <Select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Problem["category"] }))}
            >
              {Object.entries(CATEGORY_CONFIG).map(([k]) => (
                <SelectOption key={k} value={k}>{t(`category.${k}`)}</SelectOption>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("severityLabel")}</label>
            <ScoreButtons value={form.severity} onChange={(v) => setForm((p) => ({ ...p, severity: v }))} />
            <p className="text-xs text-muted-foreground">{t("severityHint")}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("frequencyLabel")}</label>
            <ScoreButtons value={form.frequency} onChange={(v) => setForm((p) => ({ ...p, frequency: v }))} />
            <p className="text-xs text-muted-foreground">{t("frequencyHint")}</p>
          </div>

          <div className={cn(
            "flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium border",
            priorityPreview >= 16 ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-800 dark:text-red-400" :
            priorityPreview >= 9  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-400" :
            "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/10 dark:border-green-800 dark:text-green-400"
          )}>
            <span>{t("priorityScore")}</span>
            <span className="font-mono text-lg font-bold">{priorityPreview}<span className="text-sm font-normal opacity-60">/25</span></span>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("descriptionLabel")}</label>
            <p className="text-xs text-muted-foreground -mt-1">{t("descriptionHint")}</p>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancelBtn")}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : initial ? t("saveChanges") : t("newProblem")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="p-4 flex-1 min-w-0">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProblemsPage() {
  const t = useTranslations("pages.problems");
  const { data: problems, isPending } = useProblems();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProblem, setEditProblem] = useState<Problem | null>(null);
  const [view, setView] = useState<string>("list");
  const [selectedCell, setSelectedCell] = useState<{ sev: number; freq: number } | null>(null);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);

  const all = problems ?? [];
  const active = all.filter((p) => p.status !== "RESOLVED" && p.status !== "DEPRIORITIZED");
  const highPriority = all.filter((p) => p.priority_score >= 16).length;
  const beingAddressed = all.filter((p) => p.status === "BEING_ADDRESSED").length;
  const resolved = all.filter((p) => p.status === "RESOLVED").length;

  const displayed = selectedCell
    ? all.filter((p) => p.severity === selectedCell.sev && p.frequency === selectedCell.freq)
    : [...all].sort((a, b) => b.priority_score - a.priority_score);

  function handleCellClick(sev: number, freq: number) {
    setSelectedCell((prev) => (prev?.sev === sev && prev?.freq === freq ? null : { sev, freq }));
  }

  function openEdit(p: Problem) {
    setEditProblem(p);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditProblem(null);
    setDialogOpen(true);
  }

  if (isPending) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="flex-1 h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
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
            <Button variant="outline" onClick={() => setAiWizardOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("aiDiagnosis")}
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("registerProblem")}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <StatCard label={t("totalProblems")} value={all.length} />
        <StatCard label={t("highPriority")} value={highPriority} sub={t("highPriorityScore")} />
        <StatCard label={t("inProcess")} value={beingAddressed} />
        <StatCard label={t("resolved")} value={resolved} />
      </div>

      {/* Views */}
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="list">{t("listTab")}</TabsTrigger>
          <TabsTrigger value="matrix">{t("matrixTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4 space-y-4">
          {all.length === 0 ? (
            <Card className="overflow-hidden">
              <EmptyState
                icon={AlertTriangle}
                title={t("noProblemsTitle")}
                description={t("noProblemsDesc")}
                actionLabel={t("registerFirst")}
                onAction={openCreate}
              />
            </Card>
          ) : (
            <>
              <Card className="p-6">
                <MatrixView problems={all} onCellClick={handleCellClick} selectedCell={selectedCell} />
              </Card>
              {selectedCell && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("severity")} {selectedCell.sev} · {t("frequency")} {selectedCell.freq}
                      <span className="ml-2 text-muted-foreground font-normal">({t("matrixCount", { n: displayed.length })})</span>
                    </h3>
                    <button onClick={() => setSelectedCell(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      {t("seeAll")}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {displayed.map((p) => <ProblemCard key={p.id} problem={p} onEdit={openEdit} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          {all.length === 0 ? (
            <Card className="overflow-hidden">
              <EmptyState
                icon={AlertTriangle}
                title={t("noProblemsTitle")}
                description={t("noProblemsDesc")}
                actionLabel={t("registerFirst")}
                onAction={openCreate}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {displayed.map((p) => <ProblemCard key={p.id} problem={p} onEdit={openEdit} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ProblemDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditProblem(null); }}
        initial={editProblem}
      />

      <DiagnosticWizard
        open={aiWizardOpen}
        onClose={() => setAiWizardOpen(false)}
      />
    </div>
  );
}
