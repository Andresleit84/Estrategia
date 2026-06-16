"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  Zap, Plus, ChevronDown, ChevronRight, Users, UserCircle, Building2,
  MoreHorizontal, Pencil, X, AlertCircle, Target, List, GitBranch,
  Network, Link2, CalendarDays, Clock, TrendingUp, Search, Maximize2, Minimize2, Sparkles,
} from "lucide-react";
import type { Cycle } from "@/hooks/useCycles";
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
import { useCycles } from "@/hooks/useCycles";
import {
  useObjectives, useCreateObjective, useUpdateObjective, useCancelObjective,
  useObjectiveAlignments, useAddAlignment, useRemoveAlignment,
  type Objective,
} from "@/hooks/useObjectives";
import { useKeyResults, useCreateKeyResult, useUpdateKeyResult } from "@/hooks/useKeyResults";
import { useTeams } from "@/hooks/useTeams";
import { useOrgMembers } from "@/hooks/useOrganization";
import { MemberPicker } from "@/components/shared/MemberPicker";
import { TeamPicker } from "@/components/shared/TeamPicker";
import { useConfirm } from "@/hooks/useConfirm";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER:  "Propietario",
  ADMIN:  "Administrador",
  MEMBER: "Miembro",
};

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

// ─── Quarter Banner ───────────────────────────────────────────────────────────

function getQuarterLabel(startDate: string): string {
  const month = new Date(startDate).getUTCMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1;
  const year = new Date(startDate).getUTCFullYear();
  return `T${quarter} ${year}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function QuarterBanner({ cycle }: { cycle: Cycle }) {
  const t          = useTranslations("pages.tactical");
  const start      = new Date(cycle.start_date).getTime();
  const end        = new Date(cycle.end_date).getTime();
  const now        = Date.now();
  const timeElapsed = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  const quarter     = getQuarterLabel(cycle.start_date);
  const daysLeft    = Math.max(0, cycle.days_remaining);
  const urgency     = daysLeft <= 14 ? "text-red-600 dark:text-red-400" :
                      daysLeft <= 30 ? "text-amber-600 dark:text-amber-400" :
                                       "text-muted-foreground";
  const progress    = Math.round(cycle.avg_progress ?? 0);

  return (
    <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4">
      <div className="flex items-start gap-4 flex-wrap">

        {/* Icono + etiqueta */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                {t("quarterlyActiveBanner")}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">
                {quarter}
              </span>
            </div>
            <p className="text-sm font-bold text-foreground truncate">{cycle.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {formatDate(cycle.start_date)} – {formatDate(cycle.end_date)}
            </p>
          </div>
        </div>

        {/* Tiempo transcurrido */}
        <div className="flex-1 min-w-[160px] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {t("timeElapsed")}
            </span>
            <span className="font-medium">{timeElapsed}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-amber-200/60 dark:bg-amber-900/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 dark:bg-amber-500 transition-all"
              style={{ width: `${timeElapsed}%` }}
            />
          </div>
          <p className={cn("text-xs font-medium flex items-center gap-1", urgency)}>
            <Clock className="h-3 w-3 shrink-0" />
            {daysLeft === 0 ? t("cycleFinished") : t("daysRemaining", { n: daysLeft })}
          </p>
        </div>

        {/* Progreso OKRs */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ProgressRing progress={progress} size={44} />
          <div>
            <p className="text-lg font-bold text-foreground leading-none">{progress}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t("okrsProgress")}</p>
            <p className="text-[10px] text-muted-foreground">{t("objectivesCount", { n: cycle.objectives_count })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({ onEdit, onCancel }: { onEdit: () => void; onCancel: () => void }) {
  const t = useTranslations("pages.tactical");
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
          <button onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-accent">
            <Pencil className="h-3.5 w-3.5" /> {t("edit")}
          </button>
          <button onClick={() => { setOpen(false); onCancel(); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10">
            <X className="h-3.5 w-3.5" /> {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline Confirm ───────────────────────────────────────────────────────────

function ConfirmCancel({ onConfirm, onAbort }: { onConfirm: () => void; onAbort: () => void }) {
  const t = useTranslations("pages.tactical");
  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded px-3 py-2">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{t("confirmCancelMsg")}</span>
      <button onClick={onConfirm} className="ml-auto font-medium hover:underline">{t("confirmBtn")}</button>
      <button onClick={onAbort} className="font-medium text-muted-foreground hover:underline">{t("abortBtn")}</button>
    </div>
  );
}

// ─── Tactical Objective Card ──────────────────────────────────────────────────

function TacticalCard({
  objective,
  onAddKr,
  onEdit,
  onCheckIn,
  isExpanded,
}: {
  objective: Objective;
  onAddKr: (obj: Objective) => void;
  onEdit: (obj: Objective) => void;
  onCheckIn?: (kr: KeyResult) => void;
  isExpanded?: boolean;
}) {
  const t          = useTranslations("pages.tactical");
  const [localExpanded, setLocalExpanded] = useState(true);
  React.useEffect(() => {
    if (isExpanded !== undefined) setLocalExpanded(isExpanded);
  }, [isExpanded]);
  const expanded = localExpanded;
  const toggleExpanded = () => setLocalExpanded((v) => !v);
  const confirm   = useConfirm();
  const [editKr, setEditKr] = useState<KeyResult | null>(null);
  const { data: krs } = useKeyResults(expanded ? objective.id : null);
  const cancelObj = useCancelObjective();

  const LevelIcon = objective.level === "TEAM" ? Users : UserCircle;
  const levelLabel = objective.level === "TEAM" ? t("levelTeam") : t("levelIndividual");

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
          <ProgressRing progress={objective.progress} size={56} status={objective.status} className="shrink-0 mt-1" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded",
                objective.level === "TEAM"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
              )}>
                <LevelIcon className="h-3 w-3" aria-hidden="true" />
                {levelLabel}
              </span>
              {objective.team_name && (
                <span className="text-xs text-muted-foreground truncate">{objective.team_name}</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground truncate mb-1">
              {objective.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5">{objective.code}</span>}
              {objective.title}
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <StatusChip status={objective.status} />
              {objective.owner_name && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {objective.owner_name.charAt(0).toUpperCase()}
                  </span>
                  {objective.owner_name}
                </span>
              )}
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
                <p className="text-xs text-muted-foreground py-2 text-center">{t("noKeyResults")}</p>
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

// ─── Edit KR Dialog (completo) ────────────────────────────────────────────────

function EditKRDialog({ kr, open, onClose }: { kr: KeyResult; open: boolean; onClose: () => void }) {
  const t      = useTranslations("pages.tactical");
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
        owner_id:         form.owner_id || undefined,
        team_id:          form.team_id || undefined,
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
        <form id="edit-kr-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
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
                <Input value={form.metric_unit} onChange={set("metric_unit")} placeholder="%, $, pts..." disabled={form.type === "ACHIEVE"} />
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
                  <button key={c} type="button"
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
              <label className="text-sm font-medium">{t("descLabel")} <span className="text-muted-foreground font-normal">{t("optional")}</span></label>
              <Textarea value={form.description} onChange={set("description")} rows={2} />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={update.isPending}>{update.isPending ? t("saving") : t("saveChanges")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Objective Dialog ────────────────────────────────────────────────────

function EditTacticalDialog({
  objective,
  open,
  onClose,
  availableParents,
}: {
  objective: Objective;
  open: boolean;
  onClose: () => void;
  availableParents: Objective[];
}) {
  const t           = useTranslations("pages.tactical");
  const confirm     = useConfirm();
  const update      = useUpdateObjective();
  const addAlign    = useAddAlignment();
  const removeAlign = useRemoveAlignment();

  const { data: currentAlignments = [] } = useObjectiveAlignments(open ? objective.id : null);

  const [form, setForm] = useState({
    title:               objective.title,
    description:         objective.description ?? "",
    parent_objective_id: objective.parent_objective_id ?? "",
  });
  const [error, setError]             = useState<string | null>(null);
  const [parentSearch, setParentSearch] = useState("");
  const [alignSearch, setAlignSearch]   = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        title:               objective.title,
        description:         objective.description ?? "",
        parent_objective_id: objective.parent_objective_id ?? "",
      });
      setError(null);
      setParentSearch("");
      setAlignSearch("");
    }
  }, [open, objective]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        id:                  objective.id,
        title:               form.title,
        description:         form.description || undefined,
        parent_objective_id: form.parent_objective_id || null,
      });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("updateObjError")));
    }
  }

  const pq            = parentSearch.toLowerCase();
  const aq            = alignSearch.toLowerCase();
  const filteredParents = availableParents.filter(o => !pq || o.title.toLowerCase().includes(pq));
  const alignOptions  = availableParents.filter(o => o.id !== form.parent_objective_id && o.id !== objective.id && (!aq || o.title.toLowerCase().includes(aq)));
  const alignmentBusy = addAlign.isPending || removeAlign.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>{t("editObjTitle")}</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-xs bg-muted font-medium">
                {objective.level === "TEAM" ? t("levelTeam") : t("levelIndividual")}
              </span>
              <span>{Math.round(objective.progress)}% {t("progressLabel")}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-0.5">

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("titleLabel")}</label>
                <Input
                  required autoFocus
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

            {availableParents.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Network className="h-3.5 w-3.5 text-indigo-500" />
                  {t("hierarchyDepsLabel")}
                </div>

                {/* Padre principal */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("mainParent")} <span className="font-normal normal-case">{t("mainParentSub")}</span>
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={parentSearch}
                      onChange={(e) => setParentSearch(e.target.value)}
                      placeholder={t("searchParentPlaceholder")}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <div className="rounded-xl border divide-y bg-card max-h-44 overflow-y-auto">
                    <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                      <input
                        type="radio" name="edit_parent_tactical" value=""
                        checked={!form.parent_objective_id}
                        onChange={() => setForm(p => ({ ...p, parent_objective_id: "" }))}
                        className="shrink-0"
                      />
                      <span className="text-sm text-muted-foreground">{t("noDirectParent")}</span>
                    </label>
                    {filteredParents.map(o => (
                      <label key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                        <input
                          type="radio" name="edit_parent_tactical" value={o.id}
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

                {/* Contribuciones secundarias — live */}
                {availableParents.filter(o => o.id !== form.parent_objective_id && o.id !== objective.id).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("alsoContributes")} <span className="font-normal normal-case">{t("alsoContributesSub")}</span>
                    </p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={alignSearch}
                        onChange={(e) => setAlignSearch(e.target.value)}
                        placeholder={t("searchObjectivePlaceholder")}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    <div className="rounded-xl border divide-y bg-card max-h-36 overflow-y-auto">
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
                                    description: t("removeAlignmentDescSimple", { title: o.title }),
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
                    {alignmentBusy && <p className="text-xs text-muted-foreground">{t("updating")}</p>}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter className="pt-4 border-t mt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>{t("cancel")}</Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? t("saving") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Tactical OKR Dialog ───────────────────────────────────────────────

const OBJ_TEMPLATE = `Contexto:\nResultado esperado:\nDependencias:`;
const KR_TEMPLATE  = `Línea base:\nMétodo de medición:\nRiesgo principal:`;

function CreateTacticalDialog({
  cycleId,
  cycleName,
  cycleStartDate,
  open,
  onClose,
  parentObjectives,
}: {
  cycleId: string;
  cycleName: string;
  cycleStartDate: string;
  open: boolean;
  onClose: () => void;
  parentObjectives: Objective[];
}) {
  const t        = useTranslations("pages.tactical");
  const { data: teams } = useTeams();
  const create   = useCreateObjective();
  const addAlign = useAddAlignment();

  const TACTICAL_LEVEL_OPTIONS = [
    { value: "TEAM",       label: t("levelTeam"),       Icon: Users },
    { value: "INDIVIDUAL", label: t("levelIndividual"), Icon: UserCircle },
  ];

  const [form, setForm] = useState({
    title:               "",
    description:         OBJ_TEMPLATE,
    level:               "TEAM" as "TEAM" | "INDIVIDUAL",
    parent_objective_id: "",
    team_id:             "",
  });
  const [extraAlignments, setExtraAlignments] = useState<string[]>([]);
  const [parentSearch, setParentSearch]       = useState("");
  const [alignSearch, setAlignSearch]         = useState("");
  const [error, setError]                     = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ title: "", description: OBJ_TEMPLATE, level: "TEAM", parent_objective_id: "", team_id: "" });
      setExtraAlignments([]);
      setParentSearch("");
      setAlignSearch("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created: any = await create.mutateAsync({
        title:               form.title,
        description:         (form.description.trim() === OBJ_TEMPLATE.trim() || !form.description.trim()) ? undefined : form.description,
        level:               form.level,
        cycle_id:            cycleId,
        parent_objective_id: form.parent_objective_id || undefined,
        team_id:             form.team_id || undefined,
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

  const pq           = parentSearch.toLowerCase();
  const aq           = alignSearch.toLowerCase();
  const companyObjs  = parentObjectives.filter(o => o.level === "COMPANY" && (!pq || o.title.toLowerCase().includes(pq)));
  const areaObjs     = parentObjectives.filter(o => o.level === "AREA"    && (!pq || o.title.toLowerCase().includes(pq)));
  const alignOptions = parentObjectives.filter(o => o.id !== form.parent_objective_id && (!aq || o.title.toLowerCase().includes(aq)));

  const isPending = create.isPending || addAlign.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>{t("newTacticalOkr")}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              <Zap className="h-2.5 w-2.5" />
              {getQuarterLabel(cycleStartDate)} · {cycleName}
            </span>
            <span className="text-xs">{t("teamAndIndividual")}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-0.5">

            {/* Básico */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("objTitleLabel")}</label>
                <Input
                  required autoFocus
                  value={form.title}
                  onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder={t("objTitlePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  {t("descLabel")} <span className="font-normal">{t("optional")}</span>
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  className="font-mono text-sm"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">{t("descHint")}</p>
              </div>
            </div>

            {/* Nivel */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("levelLabel")}</label>
              <LevelToggle
                value={form.level}
                onChange={(v) => setForm(p => ({ ...p, level: v as "TEAM" | "INDIVIDUAL" }))}
                options={TACTICAL_LEVEL_OPTIONS}
              />
            </div>

            {/* Equipo */}
            {teams && teams.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("teamLabel")} <span className="text-muted-foreground font-normal">{t("optional")}</span>
                </label>
                <Select value={form.team_id} onChange={(e) => setForm(p => ({ ...p, team_id: e.target.value }))}>
                  <SelectOption value="">{t("noTeam")}</SelectOption>
                  {teams.map(t => <SelectOption key={t.id} value={t.id}>{t.name}</SelectOption>)}
                </Select>
              </div>
            )}

            {/* Jerarquía */}
            {parentObjectives.length > 0 && (
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
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={parentSearch}
                      onChange={(e) => setParentSearch(e.target.value)}
                      placeholder={t("searchParentPlaceholder")}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <div className="rounded-xl border divide-y bg-card max-h-44 overflow-y-auto">
                    <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                      <input
                        type="radio" name="create_parent_tactical" value=""
                        checked={!form.parent_objective_id}
                        onChange={() => setForm(p => ({ ...p, parent_objective_id: "" }))}
                        className="shrink-0"
                      />
                      <span className="text-sm text-muted-foreground">{t("noDirectParent")}</span>
                    </label>
                    {companyObjs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60">
                          {t("filterCompany")}
                        </div>
                        {companyObjs.map(o => (
                          <label key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                            <input
                              type="radio" name="create_parent_tactical" value={o.id}
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
                      </>
                    )}
                    {areaObjs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60">
                          {t("filterArea")}
                        </div>
                        {areaObjs.map(o => (
                          <label key={o.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                            <input
                              type="radio" name="create_parent_tactical" value={o.id}
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
                      </>
                    )}
                  </div>
                </div>

                {/* Contribuciones secundarias */}
                {parentObjectives.filter(o => o.id !== form.parent_objective_id).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("alsoContributes")} <span className="font-normal normal-case">{t("alsoContributesSub")}</span>
                    </p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={alignSearch}
                        onChange={(e) => setAlignSearch(e.target.value)}
                        placeholder={t("searchObjectivePlaceholder")}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    <div className="rounded-xl border divide-y bg-card max-h-36 overflow-y-auto">
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
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>{t("cancel")}</Button>
            <Button type="submit" disabled={isPending || !form.title.trim()}>
              {isPending ? t("creating") : t("createTacticalBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create KR Dialog ────────────────────────────────────────────────────────

function CreateKRDialog({ objective, open, onClose }: { objective: Objective | null; open: boolean; onClose: () => void }) {
  const t      = useTranslations("pages.tactical");
  const create = useCreateKeyResult();
  const { data: members } = useOrgMembers();
  const { data: teams } = useTeams();
  const [form, setForm] = useState({
    title: "", description: KR_TEMPLATE, type: "INCREASE", metric_unit: "%",
    start_value: "0", target_value: "", check_in_cadence: "BIWEEKLY", owner_id: "", team_id: "",
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
        objId:            objective.id,
        title:            form.title,
        description:      (form.description.trim() === KR_TEMPLATE.trim() || !form.description.trim()) ? undefined : form.description,
        type:             form.type as "INCREASE" | "DECREASE" | "MAINTAIN" | "ACHIEVE",
        metric_unit:      form.metric_unit,
        start_value:      parseFloat(form.start_value) || 0,
        target_value:     form.type === "ACHIEVE" ? 1 : (parseFloat(form.target_value) || 100),
        check_in_cadence: form.check_in_cadence,
        owner_id:         form.owner_id || undefined,
        team_id:          form.team_id || undefined,
      });
      onClose();
      setForm({ title: "", description: KR_TEMPLATE, type: "INCREASE", metric_unit: "%", start_value: "0", target_value: "", check_in_cadence: "BIWEEKLY", owner_id: "", team_id: "" });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("createKrError")));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("newKrTitle")}</DialogTitle>
          {objective && <DialogDescription className="line-clamp-2">{t("forLabel")} {objective.title}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1 pr-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("krTitleLabel")}</label>
              <Input required autoFocus value={form.title} onChange={set("title")} placeholder={t("krTitlePlaceholder")} />
            </div>
            <OkrCoachPanel title={form.title} description={form.description} type={form.type} target={parseFloat(form.target_value) || undefined} unit={form.metric_unit} />
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
                  <button key={c} type="button"
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
              <label className="text-sm font-medium">{t("descLabel")} <span className="text-muted-foreground font-normal">{t("optional")}</span></label>
              <Textarea value={form.description} onChange={set("description")} className="font-mono text-sm" rows={3} />
              <p className="text-xs text-muted-foreground">{t("krDescHint")}</p>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? t("creating") : t("createKrBtn")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TacticalPage() {
  const t      = useTranslations("pages.tactical");
  const router = useRouter();
  const { data: cycles = [], isPending: cyclesLoading } = useCycles();

  // Ciclo trimestral activo (para los OKRs tácticos)
  const quarterlyActive = cycles.find(c => c.type === "QUARTERLY" && c.status === "ACTIVE");
  // Ciclos anuales/estratégicos para obtener los padres disponibles
  const annualActive    = cycles.find(c => c.type === "ANNUAL"    && c.status === "ACTIVE");
  const strategicActive = cycles.find(c => c.type === "CUSTOM"    && c.status === "ACTIVE");

  const { data: teamObjs,       isPending: teamLoading } = useObjectives(quarterlyActive?.id, "TEAM");
  const { data: individualObjs, isPending: indLoading  } = useObjectives(quarterlyActive?.id, "INDIVIDUAL");

  // Padres: COMPANY+AREA del ciclo anual (y estratégico si no hay anual)
  const parentCycleId = annualActive?.id ?? strategicActive?.id;
  const { data: companyParents } = useObjectives(parentCycleId, "COMPANY");
  const { data: areaParents    } = useObjectives(parentCycleId, "AREA");

  const [view,         setView]         = useState<"list" | "tree">("list");
  const [listExpanded, setListExpanded] = useState<boolean | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState("");
  const [createOpen,   setCreateOpen]   = useState(false);
  const [aiOpen,       setAiOpen]       = useState(false);
  const [createKrObj,  setCreateKrObj]  = useState<Objective | null>(null);
  const [editObj,      setEditObj]      = useState<Objective | null>(null);
  const [checkInKr,    setCheckInKr]    = useState<KeyResult | null>(null);
  const [checkInOpen,  setCheckInOpen]  = useState(false);

  const parentObjectives = [
    ...(companyParents?.filter(o => o.status === "ACTIVE") ?? []),
    ...(areaParents?.filter(o => o.status === "ACTIVE")    ?? []),
  ];

  const sq = filterSearch.toLowerCase();
  const activeTeamObjs = (teamObjs?.filter(o => o.status !== "CANCELLED") ?? [])
    .filter(o => !sq || o.title.toLowerCase().includes(sq));
  const activeIndObjs  = (individualObjs?.filter(o => o.status !== "CANCELLED") ?? [])
    .filter(o => !sq || o.title.toLowerCase().includes(sq));

  const isLoading = cyclesLoading || (!!quarterlyActive?.id && (teamLoading || indLoading));

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t("title")} description={t("descLoading")} />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!quarterlyActive) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t("title")} description={t("descLoading")} />
        <Card className="overflow-hidden">
          <EmptyState
            icon={Zap}
            title={t("noCycleTitle")}
            description={t("noCycleDesc")}
            actionLabel={t("goCycles")}
            onAction={() => router.push("/cycles")}
          />
        </Card>
      </div>
    );
  }

  const totalTactical = activeTeamObjs.length + activeIndObjs.length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            {/* Búsqueda por nombre */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="text-xs border rounded-lg pl-8 pr-3 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-44"
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
            {/* Toggle lista/árbol */}
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
            <Button variant="outline" onClick={() => setAiOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("suggestAI")}
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("newTacticalBtn")}
            </Button>
          </div>
        }
      />

      {/* Banner trimestral */}
      <QuarterBanner cycle={quarterlyActive} />

      {view === "tree" ? (
        <OkrTreeView
          cycleId={parentCycleId ?? quarterlyActive.id}
          search={filterSearch}
          onAddChild={() => setCreateOpen(true)}
          onAddKr={node => setCreateKrObj(node as unknown as Objective)}
          onEdit={node => setEditObj(node as unknown as Objective)}
        />
      ) : totalTactical === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={Zap}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            actionLabel={t("createFirstBtn")}
            onAction={() => setCreateOpen(true)}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {activeTeamObjs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2 flex-wrap">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {t("teamSection", { n: activeTeamObjs.length })}
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 normal-case tracking-normal flex items-center gap-0.5">
                  <Zap className="h-2.5 w-2.5" />{getQuarterLabel(quarterlyActive.start_date)}
                </span>
              </h2>
              <div className="space-y-3">
                {activeTeamObjs.map(obj => (
                  <TacticalCard key={obj.id} objective={obj} onAddKr={setCreateKrObj} onEdit={o => setEditObj(o)} onCheckIn={kr => { setCheckInKr(kr); setCheckInOpen(true); }} isExpanded={listExpanded} />
                ))}
              </div>
            </section>
          )}

          {activeIndObjs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2 flex-wrap">
                <UserCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {t("mySection", { n: activeIndObjs.length })}
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 normal-case tracking-normal flex items-center gap-0.5">
                  <Zap className="h-2.5 w-2.5" />{getQuarterLabel(quarterlyActive.start_date)}
                </span>
              </h2>
              <div className="space-y-3">
                {activeIndObjs.map(obj => (
                  <TacticalCard key={obj.id} objective={obj} onAddKr={setCreateKrObj} onEdit={o => setEditObj(o)} onCheckIn={kr => { setCheckInKr(kr); setCheckInOpen(true); }} isExpanded={listExpanded} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <CreateTacticalDialog
        cycleId={quarterlyActive.id}
        cycleName={quarterlyActive.name}
        cycleStartDate={quarterlyActive.start_date}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        parentObjectives={parentObjectives}
      />

      <CreateKRDialog
        objective={createKrObj}
        open={!!createKrObj}
        onClose={() => setCreateKrObj(null)}
      />

      {editObj && (
        <EditTacticalDialog
          objective={editObj}
          open={!!editObj}
          onClose={() => setEditObj(null)}
          availableParents={parentObjectives}
        />
      )}

      <AiSuggestOkrDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        cycleId={quarterlyActive.id}
        cycleType={quarterlyActive.type}
        level="TEAM"
        tacticalMode
        parentObjectives={parentObjectives}
      />

      <CheckInDrawer
        kr={checkInKr}
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
      />
    </div>
  );
}
