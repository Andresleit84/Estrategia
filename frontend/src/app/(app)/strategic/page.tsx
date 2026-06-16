"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  Target, Plus, ChevronDown, ChevronRight, Users, Building2,
  MoreHorizontal, Pencil, X, AlertCircle, List, GitBranch,
  Compass, CalendarRange, Zap, CheckCircle2, ArrowRight, Sparkles,
  Lightbulb, Network, Link2, Search, Maximize2, Minimize2, Clock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { StatusChip } from "@/components/okr/StatusChip";
import { KRCard, type KeyResult } from "@/components/okr/KRCard";
import { OkrCoachPanel } from "@/components/okr/OkrCoachPanel";
import { CheckInDrawer } from "@/components/okr/CheckInDrawer";
import { OkrTreeView } from "@/components/okr/OkrTreeView";
import { AiSuggestOkrDialog } from "@/components/okr/AiSuggestOkrDialog";
import { AlignmentCoveragePanel } from "@/components/okr/AlignmentCoveragePanel";
import { useCycles, type Cycle } from "@/hooks/useCycles";
import {
  useObjectives, useCreateObjective, useUpdateObjective, useCancelObjective,
  useObjectiveAlignments, useAddAlignment, useRemoveAlignment,
  type Objective,
} from "@/hooks/useObjectives";
import { useStrategicIntents, type StrategicIntent } from "@/hooks/useStrategicIntents";
import { useKeyResults, useCreateKeyResult, useUpdateKeyResult, useCancelKeyResult } from "@/hooks/useKeyResults";
import { useOrgMembers } from "@/hooks/useOrganization";
import { MemberPicker } from "@/components/shared/MemberPicker";
import { TeamPicker } from "@/components/shared/TeamPicker";
import { useTeams } from "@/hooks/useTeams";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useSectorVocabulary } from "@/hooks/useSectorVocabulary";

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({ onEdit, onCancel }: { onEdit: () => void; onCancel: () => void }) {
  const t = useTranslations("pages.strategic");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
        aria-label={t("actionsLabel")}
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-32 rounded-lg border bg-popover p-1 shadow-lg">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("edit")}
          </button>
          <button
            onClick={() => { setOpen(false); onCancel(); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" /> {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline Confirm ───────────────────────────────────────────────────────────

function ConfirmCancel({ label, onConfirm, onAbort }: { label: string; onConfirm: () => void; onAbort: () => void }) {
  const t = useTranslations("pages.strategic");
  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded px-3 py-2">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      <button onClick={onConfirm} className="ml-auto font-medium hover:underline">{t("confirmBtn")}</button>
      <button onClick={onAbort} className="font-medium text-muted-foreground hover:underline">{t("abortBtn")}</button>
    </div>
  );
}

// ─── Objective Card ───────────────────────────────────────────────────────────

function ObjectiveCard({
  objective,
  onAddKr,
  onEdit,
  onCheckIn,
  isExpanded: isExpandedProp,
}: {
  objective: Objective;
  onAddKr: (obj: Objective) => void;
  onEdit: (obj: Objective) => void;
  onCheckIn?: (kr: KeyResult) => void;
  isExpanded?: boolean;
}) {
  const t = useTranslations("pages.strategic");
  const [localExpanded, setLocalExpanded] = useState(true);
  // Sync local state when parent triggers a global expand/collapse
  React.useEffect(() => {
    if (isExpandedProp !== undefined) setLocalExpanded(isExpandedProp);
  }, [isExpandedProp]);
  const expanded = localExpanded;
  const toggleExpanded = () => setLocalExpanded((v) => !v);
  const confirm   = useConfirm();
  const [editKr, setEditKr] = useState<KeyResult | null>(null);
  const { data: krs } = useKeyResults(expanded ? objective.id : null);
  const cancelObj = useCancelObjective();

  const LevelIcon = objective.level === "COMPANY" ? Building2 : Users;

  const borderColor =
    objective.progress >= 70 ? "border-l-green-500" :
    objective.progress >= 40 ? "border-l-amber-500" : "border-l-red-500";

  return (
    <>
      <Card className={cn("overflow-hidden border-l-4", borderColor)}>
        <div
          className="flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={toggleExpanded}
          role="button"
          aria-expanded={expanded}
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && toggleExpanded()}
        >
          <ProgressRing progress={objective.progress} size={64} status={objective.status} className="shrink-0 mt-1" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <LevelIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              {objective.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{objective.code}</span>}
              <h3 className="text-sm font-semibold text-foreground truncate">{objective.title}</h3>
            </div>
            {objective.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{objective.description}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusChip status={objective.status} />
              {objective.owner_name && (
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                    {objective.owner_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-muted-foreground">{objective.owner_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>
                  {objective.level === "COMPANY" || objective.level === "AREA" ? "Mensual" : "Semanal"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {t("krCount", { n: objective.kr_count })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {objective.status === "ACTIVE" && (
              <div onClick={(e) => e.stopPropagation()}>
                <ActionMenu
                  onEdit={() => onEdit(objective)}
                  onCancel={async () => {
                    const ok = await confirm({
                      title: t("confirmCancelTitle", { title: objective.title }),
                      description: t("confirmCancelDesc"),
                      confirmLabel: t("confirmCancelLabel"),
                      variant: "destructive",
                    });
                    if (ok) cancelObj.mutate(objective.id);
                  }}
                />
              </div>
            )}
            <div className="text-muted-foreground ml-1">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="border-t bg-muted/20 px-4 pb-4">
            <div className="pt-3 space-y-2">
              {krs && krs.length > 0 ? (
                krs.map((kr) => (
                  <KRCard
                    key={kr.id}
                    kr={kr}
                    onCheckIn={objective.status === "ACTIVE" && onCheckIn ? (k) => onCheckIn(k) : undefined}
                    onEdit={objective.status === "ACTIVE" ? (k) => setEditKr(k) : undefined}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  {t("noKeyResults")}
                </p>
              )}
              {objective.status === "ACTIVE" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs gap-1 mt-1"
                  onClick={(e) => { e.stopPropagation(); onAddKr(objective); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("addKeyResult")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {editKr && (
        <EditKRDialog
          kr={editKr}
          open={!!editKr}
          onClose={() => setEditKr(null)}
        />
      )}
    </>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER:  "Propietario",
  ADMIN:  "Administrador",
  MEMBER: "Miembro",
};

function getChildLevel(parentLevel: string): string {
  const map: Record<string, string> = { COMPANY: "AREA", AREA: "TEAM", TEAM: "INDIVIDUAL" };
  return map[parentLevel] ?? "COMPANY";
}

function ProgressBar({ value, color = "bg-primary/50" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">{value}%</span>
    </div>
  );
}

function LevelToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; Icon: React.ElementType }[];
}) {
  return (
    <div className="flex gap-2">
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
            value === v
              ? "border-primary bg-primary/8 text-foreground shadow-sm"
              : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40",
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Create Objective Dialog ─────────────────────────────────────────────────

function CreateObjectiveDialog({
  cycleId,
  cycleType,
  open,
  onClose,
  presetParentId,
  defaultLevel,
  availableParents,
  availableAlignments,
  intents,
}: {
  cycleId: string;
  cycleType: string;
  open: boolean;
  onClose: () => void;
  presetParentId?: string | null;
  defaultLevel?: string;
  availableParents?: Objective[];
  availableAlignments?: Objective[];
  intents?: StrategicIntent[];
}) {
  const t = useTranslations("pages.strategic");
  const create   = useCreateObjective();
  const addAlign = useAddAlignment();

  const isStrategic = cycleType === "CUSTOM";
  const isAnnual    = cycleType === "ANNUAL";

  const LEVEL_OPTIONS = [
    { value: "COMPANY",    label: t("level.COMPANY"),    Icon: Building2 },
    { value: "AREA",       label: t("level.AREA"),       Icon: Users },
    { value: "TEAM",       label: t("level.TEAM"),       Icon: Users },
    { value: "INDIVIDUAL", label: t("level.INDIVIDUAL"), Icon: Users },
  ];

  const levelOpts = isAnnual
    ? LEVEL_OPTIONS.slice(0, 3)
    : LEVEL_OPTIONS.slice(0, 2);

  const OBJ_TEMPLATE = `Contexto:\nResultado esperado:\nDependencias:`;

  const [form, setForm] = useState({
    title: "",
    description: OBJ_TEMPLATE,
    level: defaultLevel ?? "COMPANY",
    strategic_intent_id: "",
    parent_objective_id: presetParentId ?? "",
  });
  const [extraAlignments, setExtraAlignments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        title: "",
        description: OBJ_TEMPLATE,
        level: defaultLevel ?? "COMPANY",
        strategic_intent_id: "",
        parent_objective_id: presetParentId ?? "",
      });
      setExtraAlignments([]);
      setError(null);
    }
  }, [open, defaultLevel, presetParentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const descClean = form.description.trim();
      const created: any = await create.mutateAsync({
        title: form.title,
        description: (descClean === OBJ_TEMPLATE.trim() || !descClean) ? undefined : descClean,
        level: form.level as "COMPANY" | "AREA" | "TEAM" | "INDIVIDUAL",
        cycle_id: cycleId,
        parent_objective_id: form.parent_objective_id || undefined,
        strategic_intent_id: form.strategic_intent_id || undefined,
      });
      if (extraAlignments.length > 0 && created?.id) {
        await Promise.all(
          extraAlignments.map(targetId =>
            addAlign.mutateAsync({ sourceId: created.id, targetId }),
          ),
        );
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("createObjError")));
    }
  }

  const parentOptions = availableParents ?? [];
  const alignOptions  = (availableAlignments ?? parentOptions)
    .filter(o => o.id !== form.parent_objective_id);

  const isPending = create.isPending || addAlign.isPending;

  const dialogTitle = isStrategic ? t("newStrategicOkr") : isAnnual ? t("newAnnualOkr") : t("newObjectiveTitle");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {isStrategic ? t("descStrategic") : isAnnual ? t("descAnnual") : t("descDefault")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-0.5">

            {/* ── Básico ── */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("objTitleLabel")}</label>
                <Input
                  required
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder={isStrategic ? t("objTitlePlaceholderStrategic") : t("objTitlePlaceholderAnnual")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("descLabel")}</label>
                <p className="text-xs text-muted-foreground -mt-1">{t("descHint")}</p>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* ── Nivel ── */}
            {!presetParentId && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("orgLevelLabel")}</label>
                <LevelToggle
                  value={form.level}
                  onChange={(v) => setForm(p => ({ ...p, level: v }))}
                  options={levelOpts}
                />
              </div>
            )}

            {/* ── Intención estratégica (solo OKRs estratégicos) ── */}
            {isStrategic && intents && intents.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-violet-500" />
                  {t("strategicIntentLabel")}
                </label>
                <Select
                  value={form.strategic_intent_id}
                  onChange={(e) => setForm(p => ({ ...p, strategic_intent_id: e.target.value }))}
                >
                  <SelectOption value="">{t("noIntentOption")}</SelectOption>
                  {intents.filter(i => i.status !== "CANCELLED").map(i => (
                    <SelectOption key={i.id} value={i.id}>{i.code ? `${i.code} — ${i.title}` : i.title}</SelectOption>
                  ))}
                </Select>
              </div>
            )}

            {/* ── Jerarquía: padre + contribuciones ── */}
            {parentOptions.length > 0 && !presetParentId && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="h-3.5 w-3.5 text-indigo-500" />
                  {t("hierarchyDepsLabel")}
                </div>

                {/* Padre principal */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("mainParent")} <span className="font-normal normal-case">{t("mainParentSub")}</span>
                  </p>
                  <div className="rounded-xl border divide-y bg-card">
                    <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                      <input
                        type="radio" name="create_parent" value=""
                        checked={!form.parent_objective_id}
                        onChange={() => setForm(p => ({ ...p, parent_objective_id: "" }))}
                        className="shrink-0"
                      />
                      <span className="text-sm text-muted-foreground">{t("noDirectParent")}</span>
                    </label>
                    {parentOptions.map(o => (
                      <label key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                        <input
                          type="radio" name="create_parent" value={o.id}
                          checked={form.parent_objective_id === o.id}
                          onChange={() => setForm(p => ({ ...p, parent_objective_id: o.id }))}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug">
                            {o.code && <span className="font-mono text-[10px] font-semibold text-muted-foreground mr-1">{o.code}</span>}
                            {o.title}
                          </p>
                          <ProgressBar value={Math.round(o.progress)} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Contribuciones secundarias */}
                {alignOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("alsoContributes")} <span className="font-normal normal-case">{t("alsoContributesSub")}</span>
                    </p>
                    <div className="rounded-xl border divide-y bg-card max-h-40 overflow-y-auto">
                      {alignOptions.map(o => {
                        const checked = extraAlignments.includes(o.id);
                        return (
                          <label key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setExtraAlignments(prev =>
                                checked ? prev.filter(id => id !== o.id) : [...prev, o.id],
                              )}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium leading-snug">{o.title}</p>
                              <ProgressBar value={Math.round(o.progress)} color="bg-indigo-400/60" />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {extraAlignments.length > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {t("contributionsSelected", { n: extraAlignments.length })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter className="pt-4 border-t mt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !form.title.trim()}>
              {isPending ? t("creating") : t("createObjBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Objective Dialog ────────────────────────────────────────────────────

function EditObjectiveDialog({
  objective,
  open,
  onClose,
  intents,
  availableParents,
  availableAlignments,
}: {
  objective: Objective;
  open: boolean;
  onClose: () => void;
  intents?: StrategicIntent[];
  availableParents?: Objective[];
  availableAlignments?: Objective[];
}) {
  const t = useTranslations("pages.strategic");
  const confirm     = useConfirm();
  const update      = useUpdateObjective();
  const addAlign    = useAddAlignment();
  const removeAlign = useRemoveAlignment();

  const { data: currentAlignments = [] } = useObjectiveAlignments(open ? objective.id : null);

  const [form, setForm] = useState({
    title: objective.title,
    description: objective.description ?? "",
    strategic_intent_id: objective.strategic_intent_id ?? "",
    parent_objective_id: objective.parent_objective_id ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        title: objective.title,
        description: objective.description ?? "",
        strategic_intent_id: objective.strategic_intent_id ?? "",
        parent_objective_id: objective.parent_objective_id ?? "",
      });
      setError(null);
    }
  }, [open, objective]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        id: objective.id,
        title: form.title,
        description: form.description || undefined,
        strategic_intent_id: form.strategic_intent_id || null,
        parent_objective_id: form.parent_objective_id || null,
      });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("updateObjError")));
    }
  }

  const parentOptions = availableParents ?? [];
  const alignOptions  = (availableAlignments ?? parentOptions)
    .filter(o => o.id !== form.parent_objective_id && o.id !== objective.id);

  const alignmentBusy = addAlign.isPending || removeAlign.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>{t("editObjTitle")}</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-xs bg-muted font-medium">
                {t(`level.${objective.level}`)}
              </span>
              <span>{Math.round(objective.progress)}% {t("progressLabel")}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-0.5">

            {/* ── Básico ── */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("titleLabel")}</label>
                <Input
                  required
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  {t("descLabel")} <span className="font-normal">{t("optional")}</span>
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            {/* ── Intención estratégica ── */}
            {intents && intents.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-violet-500" />
                  {t("strategicIntentLabel")}
                </label>
                <Select
                  value={form.strategic_intent_id}
                  onChange={(e) => setForm(p => ({ ...p, strategic_intent_id: e.target.value }))}
                >
                  <SelectOption value="">{t("noIntentOption")}</SelectOption>
                  {intents.filter(i => i.status !== "CANCELLED").map(i => (
                    <SelectOption key={i.id} value={i.id}>{i.code ? `${i.code} — ${i.title}` : i.title}</SelectOption>
                  ))}
                </Select>
              </div>
            )}

            {/* ── Jerarquía ── */}
            {(parentOptions.length > 0 || alignOptions.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Network className="h-3.5 w-3.5 text-indigo-500" />
                  {t("hierarchyDepsLabel")}
                </div>

                {/* Padre principal */}
                {parentOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("mainParent")} <span className="font-normal normal-case">{t("mainParentSub")}</span>
                    </p>
                    <div className="rounded-xl border divide-y bg-card max-h-44 overflow-y-auto">
                      <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                        <input
                          type="radio" name="edit_parent" value=""
                          checked={!form.parent_objective_id}
                          onChange={() => setForm(p => ({ ...p, parent_objective_id: "" }))}
                          className="shrink-0"
                        />
                        <span className="text-sm text-muted-foreground">{t("noDirectParent")}</span>
                      </label>
                      {parentOptions.map(o => (
                        <label key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                          <input
                            type="radio" name="edit_parent" value={o.id}
                            checked={form.parent_objective_id === o.id}
                            onChange={() => setForm(p => ({ ...p, parent_objective_id: o.id }))}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium leading-snug">{o.title}</p>
                            <ProgressBar value={Math.round(o.progress)} />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contribuciones adicionales — live toggle */}
                {alignOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("alsoContributes")} <span className="font-normal normal-case">{t("alsoContributesSub")}</span>
                    </p>
                    <div className="rounded-xl border divide-y bg-card max-h-44 overflow-y-auto">
                      {alignOptions.map(o => {
                        const aligned = currentAlignments.some(a => a.id === o.id);
                        return (
                          <label key={o.id} className={cn(
                            "flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors",
                            alignmentBusy && "opacity-60 pointer-events-none",
                          )}>
                            <input
                              type="checkbox"
                              checked={aligned}
                              disabled={alignmentBusy}
                              onChange={async () => {
                                if (aligned) {
                                  const ok = await confirm({
                                    title: t("removeAlignmentTitle"),
                                    description: t("removeAlignmentDesc", { title: o.title }),
                                    confirmLabel: t("removeAlignmentLabel"),
                                    variant: "warning",
                                  });
                                  if (!ok) return;
                                  removeAlign.mutate({ sourceId: objective.id, targetId: o.id });
                                } else {
                                  addAlign.mutate({ sourceId: objective.id, targetId: o.id });
                                }
                              }}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium leading-snug">{o.title}</p>
                              <ProgressBar value={Math.round(o.progress)} color="bg-indigo-400/60" />
                            </div>
                            {aligned && (
                              <span className="shrink-0 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                                <Link2 className="h-2.5 w-2.5" /> {t("linked")}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {alignmentBusy && (
                      <p className="text-xs text-muted-foreground">{t("updating")}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter className="pt-4 border-t mt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? t("saving") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create KR Dialog ────────────────────────────────────────────────────────

function CreateKRDialog({
  objective,
  open,
  onClose,
}: {
  objective: Objective | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("pages.strategic");
  const create = useCreateKeyResult();
  const { data: members } = useOrgMembers();
  const { data: teams } = useTeams();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "INCREASE",
    metric_unit: "%",
    start_value: "0",
    target_value: "",
    check_in_cadence: "BIWEEKLY",
    owner_id: "",
    team_id: "",
  });
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!objective) return;
    setError(null);
    try {
      await create.mutateAsync({
        objId: objective.id,
        title: form.title,
        description: form.description || undefined,
        type: form.type as "INCREASE" | "DECREASE" | "MAINTAIN" | "ACHIEVE",
        metric_unit: form.metric_unit,
        start_value: parseFloat(form.start_value) || 0,
        target_value: form.type === "ACHIEVE" ? 1 : (parseFloat(form.target_value) || 100),
        check_in_cadence: form.check_in_cadence,
        owner_id: form.owner_id || undefined,
        team_id: form.team_id || undefined,
      });
      onClose();
      setForm({ title: "", description: "", type: "INCREASE", metric_unit: "%", start_value: "0", target_value: "", check_in_cadence: "BIWEEKLY", owner_id: "", team_id: "" });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("createKrError")));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("newKrTitle")}</DialogTitle>
          {objective && (
            <DialogDescription className="line-clamp-2">
              {t("forLabel")} {objective.title}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1 pr-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("krTitleLabel")}</label>
            <Input
              required
              value={form.title}
              onChange={set("title")}
              placeholder={t("krTitlePlaceholder")}
              autoFocus
            />
          </div>

          <OkrCoachPanel
            title={form.title}
            description={form.description}
            type={form.type}
            target={parseFloat(form.target_value) || undefined}
            unit={form.metric_unit}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("krTypeLabel")}</label>
              <Select value={form.type} onChange={set("type")}>
                <SelectOption value="INCREASE">{t("typeIncrease")}</SelectOption>
                <SelectOption value="DECREASE">{t("typeDecrease")}</SelectOption>
                <SelectOption value="MAINTAIN">{t("typeMaintain")}</SelectOption>
                <SelectOption value="ACHIEVE">{t("typeAchieve")}</SelectOption>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("krUnitLabel")}</label>
              <Input value={form.metric_unit} onChange={set("metric_unit")} placeholder="%, $, pts..." />
            </div>
          </div>

          {form.type !== "ACHIEVE" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("startValueLabel")}</label>
                <Input type="number" value={form.start_value} onChange={set("start_value")} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("targetLabel")}</label>
                <Input type="number" required value={form.target_value} onChange={set("target_value")} placeholder="100" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Frecuencia de actualización</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["WEEKLY","BIWEEKLY","MONTHLY","QUARTERLY"] as const).map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setForm((p) => ({ ...p, check_in_cadence: c }))}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-xs text-center transition-colors",
                    form.check_in_cadence === c
                      ? "border-primary bg-primary/8 text-primary font-semibold"
                      : "border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  {c === "WEEKLY" ? "Semanal" : c === "BIWEEKLY" ? "Bisemanal" : c === "MONTHLY" ? "Mensual" : "Trimestral"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Define la cadencia esperada de check-ins para este resultado clave.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Responsable</label>
              <MemberPicker
                value={form.owner_id}
                onChange={uid => setForm(p => ({ ...p, owner_id: uid }))}
                members={members}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Área responsable</label>
              <TeamPicker
                value={form.team_id}
                onChange={tid => setForm(p => ({ ...p, team_id: tid }))}
                teams={teams}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("descLabel")} <span className="text-muted-foreground font-normal">{t("optional")}</span>
            </label>
            <Textarea
              value={form.description}
              onChange={set("description")}
              placeholder={t("krDescHint")}
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("creating") : t("createKrBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit KR Dialog ───────────────────────────────────────────────────────────

function EditKRDialog({ kr, open, onClose }: { kr: KeyResult; open: boolean; onClose: () => void }) {
  const t = useTranslations("pages.strategic");
  const update = useUpdateKeyResult();
  const { data: members } = useOrgMembers();
  const { data: teams } = useTeams();
  const [form, setForm] = useState({
    title:             kr.title,
    description:       kr.description ?? "",
    type:              kr.type,
    metric_unit:       kr.metric_unit,
    start_value:       String(Number(kr.start_value)),
    target_value:      String(Number(kr.target_value)),
    check_in_cadence:  kr.check_in_cadence ?? "BIWEEKLY",
    owner_id:          kr.owner_id ?? "",
    team_id:           kr.team_id ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        title:             kr.title,
        description:       kr.description ?? "",
        type:              kr.type,
        metric_unit:       kr.metric_unit,
        start_value:       String(Number(kr.start_value)),
        target_value:      String(Number(kr.target_value)),
        check_in_cadence:  kr.check_in_cadence ?? "BIWEEKLY",
        owner_id:          kr.owner_id ?? "",
        team_id:           kr.team_id ?? "",
      });
      setError(null);
    }
  }, [open, kr]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        id:               kr.id,
        objId:            kr.objective_id,
        title:            form.title,
        description:      form.description || undefined,
        type:             form.type,
        metric_unit:      form.metric_unit,
        start_value:      form.type === "ACHIEVE" ? 0 : (parseFloat(form.start_value) || 0),
        target_value:     form.type === "ACHIEVE" ? 1 : (parseFloat(form.target_value) || 0),
        check_in_cadence: form.check_in_cadence,
        owner_id: form.owner_id || undefined,
        team_id: form.team_id || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("updateKrError")));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t("editKrTitle")}</DialogTitle>
          <DialogDescription className="line-clamp-2">{kr.title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1 pr-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("titleLabel")}</label>
              <Input required autoFocus value={form.title} onChange={set("title")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("krTypeLabel")}</label>
                <Select value={form.type} onChange={set("type")}>
                  <SelectOption value="INCREASE">{t("typeIncrease")}</SelectOption>
                  <SelectOption value="DECREASE">{t("typeDecrease")}</SelectOption>
                  <SelectOption value="MAINTAIN">{t("typeMaintain")}</SelectOption>
                  <SelectOption value="ACHIEVE">{t("typeAchieve")}</SelectOption>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("krUnitLabel")}</label>
                <Input
                  value={form.metric_unit}
                  onChange={set("metric_unit")}
                  placeholder="%, $, pts..."
                  disabled={form.type === "ACHIEVE"}
                />
              </div>
            </div>

            {form.type !== "ACHIEVE" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("startValueLabel")}</label>
                  <Input type="number" value={form.start_value} onChange={set("start_value")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("targetValueLabel")}</label>
                  <Input type="number" value={form.target_value} onChange={set("target_value")} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Frecuencia de actualización</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["WEEKLY","BIWEEKLY","MONTHLY","QUARTERLY"] as const).map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm((p) => ({ ...p, check_in_cadence: c }))}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs text-center transition-colors",
                      form.check_in_cadence === c
                        ? "border-primary bg-primary/8 text-primary font-semibold"
                        : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {c === "WEEKLY" ? "Semanal" : c === "BIWEEKLY" ? "Bisemanal" : c === "MONTHLY" ? "Mensual" : "Trimestral"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Responsable</label>
                <MemberPicker
                  value={form.owner_id}
                  onChange={uid => setForm(p => ({ ...p, owner_id: uid }))}
                  members={members}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Área responsable</label>
                <TeamPicker
                  value={form.team_id}
                  onChange={tid => setForm(p => ({ ...p, team_id: tid }))}
                  teams={teams}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("descLabel")} <span className="text-muted-foreground font-normal">{t("optional")}</span>
              </label>
              <Textarea value={form.description} onChange={set("description")} rows={2} />
            </div>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? t("saving") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── OkrHierarchyGuide ───────────────────────────────────────────────────────

const OKR_LEVELS = [
  {
    id: "strategic" as const,
    icon: Compass,
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    cycleType: "CUSTOM",
    href: null,
  },
  {
    id: "annual" as const,
    icon: CalendarRange,
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    cycleType: "ANNUAL",
    href: null,
  },
  {
    id: "tactical" as const,
    icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    cycleType: "QUARTERLY",
    href: "/tactical",
  },
];

function OkrHierarchyGuide({
  cycles,
  strategicCount,
  annualCount,
  onCreate,
}: {
  cycles: Cycle[];
  strategicCount: number;
  annualCount: number;
  onCreate: (type: "strategic" | "annual") => void;
}) {
  const t = useTranslations("pages.strategic");
  const router = useRouter();
  const counts = { strategic: strategicCount, annual: annualCount, tactical: -1 };
  const activeCycleByType = {
    CUSTOM:    cycles.find(c => c.type === "CUSTOM"    && c.status === "ACTIVE"),
    ANNUAL:    cycles.find(c => c.type === "ANNUAL"    && c.status === "ACTIVE"),
    QUARTERLY: cycles.find(c => c.type === "QUARTERLY" && c.status === "ACTIVE"),
  };

  const allDone = strategicCount > 0 && annualCount > 0;
  if (allDone) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold">{t("hierarchyTitle")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("hierarchyDesc")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {OKR_LEVELS.map((lvl, idx) => {
          const hasCycle  = lvl.cycleType !== "QUARTERLY" && !!activeCycleByType[lvl.cycleType as keyof typeof activeCycleByType];
          const count     = counts[lvl.id];
          const done      = count > 0;
          const blocked   = !hasCycle && lvl.id !== "tactical";
          const Icon      = lvl.icon;

          return (
            <div key={lvl.id} className="flex sm:flex-col flex-row items-center gap-2 flex-1">
              <div className={cn(
                "flex-1 w-full rounded-xl border p-4 flex flex-col gap-3 transition-all",
                done || lvl.id === "tactical"
                  ? "bg-muted/20 border-border/40"
                  : blocked
                    ? "bg-muted/10 border-dashed border-border/40 opacity-60"
                    : "bg-card border-border hover:border-primary/40 hover:shadow-sm"
              )}>
                {/* Header: ícono + estado */}
                <div className="flex items-center justify-between gap-2">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", lvl.bg)}>
                    <Icon className={cn("h-5 w-5", lvl.accent)} />
                  </div>
                  {done ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-okr-on-track bg-okr-on-track-bg px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />{t("objectivesCount", { n: count })}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                      {t("step", { n: idx + 1 })}
                    </span>
                  )}
                </div>

                {/* Título + subtítulo */}
                <div>
                  <p className={cn(
                    "text-sm font-bold leading-tight",
                    done ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {t(`level.${lvl.id}.title`)}
                  </p>
                  <span className={cn(
                    "inline-block text-[11px] font-medium mt-0.5 px-1.5 py-0.5 rounded",
                    done ? "bg-muted/50 text-muted-foreground/60" : `${lvl.bg} ${lvl.accent}`
                  )}>
                    {t(`level.${lvl.id}.sub`)}
                  </span>
                </div>

                {/* Descripción — siempre visible */}
                <p className={cn(
                  "text-sm leading-relaxed flex-1",
                  done ? "text-muted-foreground/60" : "text-muted-foreground"
                )}>
                  {blocked ? t(lvl.id === "strategic" ? "blockedStrategic" : "blockedAnnual") : t(`level.${lvl.id}.desc`)}
                </p>

                {/* Acción */}
                {!done && !blocked && lvl.id !== "tactical" && (
                  <Button
                    size="sm" variant="outline"
                    className="h-8 text-xs w-full gap-1.5"
                    onClick={() => onCreate(lvl.id as "strategic" | "annual")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("createFirstObj")}
                  </Button>
                )}
                {lvl.id === "tactical" && (
                  <Button
                    size="sm" variant="outline"
                    className="h-8 text-xs w-full gap-1.5"
                    onClick={() => router.push("/tactical")}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {t("goTactical")}
                  </Button>
                )}
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

// ─── ObjectiveSection ─────────────────────────────────────────────────────────

function ObjectiveSection({
  cycle,
  onAddKr,
  onEdit,
  onCheckIn,
  onCreateObj,
  intents,
  strategicParents,
  strategicCycleId,
}: {
  cycle: Cycle;
  onAddKr: (obj: Objective) => void;
  onEdit: (obj: Objective) => void;
  onCheckIn: (kr: KeyResult) => void;
  onCreateObj: () => void;
  intents?: StrategicIntent[];
  strategicParents?: Objective[];
  strategicCycleId?: string;
}) {
  const t = useTranslations("pages.strategic");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLevel,  setFilterLevel]  = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [view, setView] = useState<"list" | "tree">("list");
  const [listExpanded, setListExpanded] = useState<boolean | undefined>(undefined);
  const [createObjParent, setCreateObjParent] = useState<{ id: string; level: string } | null>(null);
  const [createKrObj, setCreateKrObj] = useState<Objective | null>(null);
  const [editObj, setEditObj] = useState<Objective | null>(null);
  const [openCreateChild, setOpenCreateChild] = useState(false);
  const [aiDialogLevel, setAiDialogLevel] = useState<"COMPANY" | "AREA" | null>(null);

  const { data: objectives, isPending } = useObjectives(
    cycle.id,
    filterLevel || undefined,
    filterStatus ? { status: filterStatus } : undefined,
  );

  const visibleObjs = (objectives?.filter(o => filterStatus ? true : o.status !== "CANCELLED") ?? [])
    .filter(o => !filterSearch || o.title.toLowerCase().includes(filterSearch.toLowerCase()));
  const companyObjs = visibleObjs.filter(o => o.level === "COMPANY");
  const areaObjs    = visibleObjs.filter(o => o.level === "AREA");

  const isStrategic = cycle.type === "CUSTOM";
  const accentColor = isStrategic
    ? "text-violet-600 dark:text-violet-400"
    : "text-blue-600 dark:text-blue-400";
  const bgColor = isStrategic
    ? "bg-violet-100 dark:bg-violet-900/30"
    : "bg-blue-100 dark:bg-blue-900/30";
  const CycleIcon = isStrategic ? Compass : CalendarRange;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", bgColor)}>
            <CycleIcon className={cn("h-4 w-4", accentColor)} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">
              {isStrategic ? t("sectionStrategic") : t("sectionAnnual")}
            </h2>
            <p className="text-xs text-muted-foreground">{cycle.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors",
                view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
            >
              <List className="h-3 w-3" /> {t("viewList")}
            </button>
            <button
              onClick={() => setView("tree")}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors border-l border-border",
                view === "tree" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
            >
              <GitBranch className="h-3 w-3" /> {t("viewTree")}
            </button>
          </div>
          {view === "list" && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setListExpanded(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Maximize2 className="h-3 w-3" /> {t("expandAll")}
              </button>
              <button
                onClick={() => setListExpanded(false)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors border-l border-border"
              >
                <Minimize2 className="h-3 w-3" /> {t("collapseAll")}
              </button>
            </div>
          )}
          <Button
            size="sm" variant="outline"
            onClick={() => setAiDialogLevel("COMPANY")}
            className="h-8 text-xs gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("suggestAI")}
          </Button>
          <Button size="sm" onClick={onCreateObj} className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {t("newObjBtn")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="text-xs border rounded-lg pl-8 pr-3 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-48"
            aria-label={t("searchAriaLabel")}
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("clearSearch")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="text-xs border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t("ariaFilterLevel")}
        >
          <option value="">{t("filterAllLevels")}</option>
          <option value="COMPANY">{t("filterCompany")}</option>
          <option value="AREA">{t("filterArea")}</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t("ariaFilterStatus")}
        >
          <option value="">{t("filterStatusDefault")}</option>
          <option value="DRAFT">{t("filterDraft")}</option>
          <option value="ACTIVE">{t("filterActive")}</option>
          <option value="COMPLETED">{t("filterCompleted")}</option>
          <option value="CANCELLED">{t("filterCancelled")}</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {t("objectivesCount", { n: visibleObjs.length })}
        </span>
      </div>

      {/* Content */}
      {isPending ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : view === "tree" ? (
        <OkrTreeView
          cycleId={isStrategic ? cycle.id : (strategicCycleId ?? cycle.id)}
          search={filterSearch}
          onAddChild={node => { setCreateObjParent({ id: node.id, level: node.level }); setOpenCreateChild(true); }}
          onAddKr={node => setCreateKrObj(node as unknown as Objective)}
          onEdit={node => setEditObj(node as unknown as Objective)}
        />
      ) : visibleObjs.length === 0 ? (
        <Card className="overflow-hidden">
          {filterStatus || filterLevel || filterSearch ? (
            <EmptyState
              icon={Target}
              title={t("emptyFilterTitle")}
              description={t("emptyFilterDesc")}
              actionLabel={t("clearFilters")}
              onAction={() => { setFilterStatus(""); setFilterLevel(""); setFilterSearch(""); }}
            />
          ) : (
            <EmptyState
              icon={isStrategic ? Compass : CalendarRange}
              title={isStrategic ? t("emptyStrategicTitle") : t("emptyAnnualTitle")}
              description={isStrategic ? t("emptyStrategicDesc") : t("emptyAnnualDesc")}
              actionLabel={t("createFirstObj")}
              onAction={onCreateObj}
            />
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {companyObjs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" />
                {t("sectionCompanyLabel", { n: companyObjs.length })}
              </h3>
              {companyObjs.map(obj => (
                <ObjectiveCard key={obj.id} objective={obj}
                  onAddKr={setCreateKrObj}
                  onEdit={o => setEditObj(o)}
                  onCheckIn={kr => onCheckIn(kr)}
                  isExpanded={listExpanded}
                />
              ))}
            </div>
          )}
          {areaObjs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {t("sectionAreaLabel", { n: areaObjs.length })}
                </h3>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setAiDialogLevel("AREA")}
                  className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary px-2"
                >
                  <Sparkles className="h-3 w-3" /> IA
                </Button>
              </div>
              {areaObjs.map(obj => (
                <ObjectiveCard key={obj.id} objective={obj}
                  onAddKr={setCreateKrObj}
                  onEdit={o => setEditObj(o)}
                  onCheckIn={kr => onCheckIn(kr)}
                  isExpanded={listExpanded}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Child create dialog (from tree view) */}
      <CreateObjectiveDialog
        cycleId={cycle.id}
        cycleType={cycle.type}
        open={openCreateChild}
        onClose={() => { setOpenCreateChild(false); setCreateObjParent(null); }}
        presetParentId={createObjParent?.id}
        defaultLevel={createObjParent ? getChildLevel(createObjParent.level) : undefined}
        intents={cycle.type === "CUSTOM" ? intents : undefined}
        availableAlignments={cycle.type === "ANNUAL" ? strategicParents : undefined}
      />

      <CreateKRDialog
        objective={createKrObj}
        open={!!createKrObj}
        onClose={() => setCreateKrObj(null)}
      />

      {editObj && (
        <EditObjectiveDialog
          objective={editObj}
          open={!!editObj}
          onClose={() => setEditObj(null)}
          intents={cycle.type === "CUSTOM" ? intents : undefined}
          availableParents={cycle.type === "ANNUAL" ? strategicParents : undefined}
          availableAlignments={cycle.type === "ANNUAL" ? strategicParents : undefined}
        />
      )}

      <AiSuggestOkrDialog
        open={!!aiDialogLevel}
        onClose={() => setAiDialogLevel(null)}
        cycleId={cycle.id}
        cycleType={cycle.type}
        level={aiDialogLevel ?? "COMPANY"}
        onCreated={() => setAiDialogLevel(null)}
      />
    </section>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border bg-card p-4">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Page tabs ────────────────────────────────────────────────────────────────

type PageTab = "strategic" | "annual" | "coverage";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StrategicPage() {
  const t = useTranslations("pages.strategic");
  const vocab = useSectorVocabulary();
  const router = useRouter();
  const { data: cycles = [], isPending: cyclesLoading } = useCycles();

  const strategicCycle  = cycles.find(c => c.type === "CUSTOM"  && c.status === "ACTIVE");
  const annualCycle     = cycles.find(c => c.type === "ANNUAL"  && c.status === "ACTIVE");

  const { data: strategicObjs = [] } = useObjectives(strategicCycle?.id);
  const { data: annualObjs    = [] } = useObjectives(annualCycle?.id);
  const { data: intents       = [] } = useStrategicIntents();

  const [activeTab,   setActiveTab]   = useState<PageTab>("strategic");
  const [createFor,   setCreateFor]   = useState<"strategic" | "annual" | null>(null);
  const [createKrObj, setCreateKrObj] = useState<Objective | null>(null);
  const [checkInKr,   setCheckInKr]   = useState<KeyResult | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const activeCycleFor = createFor === "strategic" ? strategicCycle : annualCycle;

  const PAGE_TABS: { id: PageTab; label: string; icon: React.ElementType }[] = [
    { id: "strategic", label: t("tabStrategic"), icon: Compass },
    { id: "annual",    label: t("tabAnnual"),    icon: CalendarRange },
    { id: "coverage",  label: t("tabCoverage"),  icon: Network },
  ];

  if (cyclesLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={vocab.strategicPageTitle} description={t("descLoading")} />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!strategicCycle && !annualCycle) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={vocab.strategicPageTitle} description={t("descLoading")} />
        <Card className="overflow-hidden">
          <EmptyState
            icon={Target}
            title={t("noCyclesTitle")}
            description={t("noCyclesDesc")}
            actionLabel={t("goCycles")}
            onAction={() => router.push("/cycles")}
          />
        </Card>
      </div>
    );
  }

  const allObjs = [
    ...strategicObjs.filter(o => o.status !== "CANCELLED"),
    ...annualObjs.filter(o => o.status !== "CANCELLED"),
  ];
  const onTrack  = allObjs.filter(o => o.progress >= 70).length;
  const avgProg  = allObjs.length
    ? Math.round(allObjs.reduce((s, o) => s + o.progress, 0) / allObjs.length)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={vocab.strategicPageTitle}
        description={t("description")}
        actions={
          <Button
            onClick={() => setCreateFor(activeTab === "strategic" ? "strategic" : "annual")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> {t("newObjective")}
          </Button>
        }
      />

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <StatCard
          label={t("statStrategic")}
          value={strategicObjs.filter(o => o.status !== "CANCELLED").length}
          sub={strategicCycle?.name ?? t("noCycleActive")}
        />
        <StatCard
          label={t("statAnnual")}
          value={annualObjs.filter(o => o.status !== "CANCELLED").length}
          sub={annualCycle?.name ?? t("noCycleActive")}
        />
        <StatCard
          label={t("statOnTrack")}
          value={onTrack}
          sub={t("statOnTrackSub")}
        />
        <StatCard
          label={t("statAvgProgress")}
          value={`${avgProg}%`}
          sub={t("statAvgProgressSub")}
        />
      </div>

      {/* Page-level tabs */}
      <div className="flex gap-1 border-b border-border">
        {PAGE_TABS.map(tab => {
          const Icon = tab.icon;
          const disabled =
            (tab.id === "strategic" && !strategicCycle) ||
            (tab.id === "annual"    && !annualCycle) ||
            (tab.id === "coverage"  && !annualCycle && !strategicCycle);
          return (
            <button
              key={tab.id}
              disabled={disabled}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                disabled && "opacity-40 cursor-not-allowed pointer-events-none",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <>
        <OkrHierarchyGuide
          cycles={cycles}
          strategicCount={strategicObjs.filter(o => o.status !== "CANCELLED").length}
          annualCount={annualObjs.filter(o => o.status !== "CANCELLED").length}
          onCreate={type => { setCreateFor(type); setActiveTab(type); }}
        />

        <div className="space-y-8">
          {activeTab === "strategic" && strategicCycle && (
            <ObjectiveSection
              cycle={strategicCycle}
              onAddKr={setCreateKrObj}
              onEdit={() => {}}
              onCheckIn={kr => { setCheckInKr(kr); setCheckInOpen(true); }}
              onCreateObj={() => setCreateFor("strategic")}
              intents={intents}
              strategicParents={undefined}
            />
          )}

          {activeTab === "annual" && annualCycle && (
            <ObjectiveSection
              cycle={annualCycle}
              onAddKr={setCreateKrObj}
              onEdit={() => {}}
              onCheckIn={kr => { setCheckInKr(kr); setCheckInOpen(true); }}
              onCreateObj={() => setCreateFor("annual")}
              strategicParents={strategicObjs.filter(o => o.status !== "CANCELLED")}
              strategicCycleId={strategicCycle?.id}
              intents={undefined}
            />
          )}

          {activeTab === "coverage" && (annualCycle ?? strategicCycle) && (
            <AlignmentCoveragePanel
              cycleId={(annualCycle ?? strategicCycle)!.id}
            />
          )}
        </div>
      </>

      {activeCycleFor && (
        <CreateObjectiveDialog
          cycleId={activeCycleFor.id}
          cycleType={activeCycleFor.type}
          open={!!createFor}
          onClose={() => setCreateFor(null)}
          defaultLevel="COMPANY"
          intents={createFor === "strategic" ? intents : undefined}
          availableParents={createFor === "annual"
            ? strategicObjs.filter(o => o.status !== "CANCELLED")
            : undefined}
          availableAlignments={createFor === "annual"
            ? strategicObjs.filter(o => o.status !== "CANCELLED")
            : undefined}
        />
      )}

      <CreateKRDialog
        objective={createKrObj}
        open={!!createKrObj}
        onClose={() => setCreateKrObj(null)}
      />

      <CheckInDrawer
        kr={checkInKr}
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
      />
    </div>
  );
}
