"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { StatusChip } from "@/components/okr/StatusChip";
import { InitiativeForm } from "@/components/initiatives/InitiativeForm";
import { InitiativeDrawer } from "@/components/initiatives/InitiativeDrawer";
import { GanttView } from "@/components/initiatives/GanttView";
import { AiSuggestInitiativesDialog } from "@/components/initiatives/AiSuggestInitiativesDialog";
import { useInitiatives, useUpdateInitiative, type Initiative } from "@/hooks/useInitiatives";
import { useActiveCycle } from "@/hooks/useCycles";
import type { InitiativeSuggestion } from "@/hooks/useAI";
import {
  Plus, Rocket, AlertCircle, BarChart2, List,
  CheckCircle2, Clock, Loader2, Search, CalendarDays,
  Sparkles, TableProperties, MoreHorizontal, Pencil, Eye,
  Milestone, Users, ChevronRight, ChevronLeft, XCircle,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ViewMode = "kanban" | "list" | "gantt";

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: "TODO",        label: "Por hacer",   icon: Clock,       color: "text-slate-500"  },
  { id: "IN_PROGRESS", label: "En progreso", icon: Loader2,     color: "text-blue-500"   },
  { id: "DONE",        label: "Completadas", icon: CheckCircle2, color: "text-green-500" },
] as const;

type InitiativeStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
const INIT_STATUS_FLOW: InitiativeStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const INIT_STATUS_LABELS: Record<InitiativeStatus, string> = {
  TODO: "Por hacer", IN_PROGRESS: "En progreso", DONE: "Completada", CANCELLED: "Cancelada",
};
function getNextInitStatus(s: InitiativeStatus): InitiativeStatus | null {
  const i = INIT_STATUS_FLOW.indexOf(s);
  return i >= 0 && i < INIT_STATUS_FLOW.length - 1 ? INIT_STATUS_FLOW[i + 1] : null;
}
function getPrevInitStatus(s: InitiativeStatus): InitiativeStatus | null {
  if (s === "CANCELLED") return "TODO";
  const i = INIT_STATUS_FLOW.indexOf(s);
  return i > 0 ? INIT_STATUS_FLOW[i - 1] : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function borderByProgress(progress: number, isOverdue: boolean) {
  if (isOverdue) return "border-l-red-500";
  if (progress >= 70) return "border-l-green-500";
  if (progress >= 40) return "border-l-amber-500";
  return "border-l-blue-500";
}

function fmtDate(d: string, short = false) {
  return new Date(d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    ...(short ? {} : { year: "numeric" }),
  });
}

// ── Cycle Banner ─────────────────────────────────────────────────────────────

function CycleBanner({ cycle }: { cycle: any }) {
  const t = useTranslations("pages.initiatives");
  const start   = new Date(cycle.start_date).getTime();
  const end     = new Date(cycle.end_date).getTime();
  const now     = Date.now();
  const elapsed = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  const daysLeft = Math.max(0, cycle.days_remaining ?? 0);
  const urgency =
    daysLeft <= 14 ? "text-red-600 dark:text-red-400"
    : daysLeft <= 30 ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <BarChart2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("activeCycle")}</p>
            <p className="text-sm font-semibold text-foreground truncate">{cycle.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <CalendarDays className="h-3.5 w-3.5" />
          {fmtDate(cycle.start_date)} — {fmtDate(cycle.end_date)}
        </div>
        <span className={cn("text-xs font-semibold shrink-0", urgency)}>
          {daysLeft === 0 ? t("lastDay") : t("daysRemaining", { n: daysLeft })}
        </span>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{t("cycleProgress")}</span>
          <span className="tabular-nums">{elapsed}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              elapsed >= 80 ? "bg-red-500" : elapsed >= 60 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${elapsed}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Initiative card (Kanban) ──────────────────────────────────────────────────

function InitiativeCard({
  initiative: init,
  onClick,
  onEdit,
  onStatusChange,
}: {
  initiative: Initiative;
  onClick: () => void;
  onEdit: () => void;
  onStatusChange?: (s: InitiativeStatus) => void;
}) {
  const t = useTranslations("pages.initiatives");
  const [hovered, setHovered] = useState(false);
  const overdueMs = init.milestones?.filter((m) => m.is_overdue && m.status !== "COMPLETED").length ?? 0;

  return (
    <Card
      className={cn(
        "overflow-hidden border-l-4 cursor-pointer transition-shadow hover:shadow-md",
        borderByProgress(init.progress, init.is_overdue)
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="flex items-start gap-3 p-3.5">
        {/* Ring */}
        <ProgressRing
          progress={init.progress}
          size={52}
          className="shrink-0 mt-0.5"
        />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              {init.code && (
                <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5">
                  {init.code}
                </span>
              )}
              <p className="text-sm font-semibold leading-snug">{init.title}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {init.is_overdue && <AlertCircle className="h-4 w-4 text-red-500" />}
              {onStatusChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded hover:bg-muted flex items-center justify-center transition-opacity outline-none"
                    onClick={e => e.stopPropagation()}
                    aria-label="Acciones"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48" onClick={e => e.stopPropagation()}>
                    <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </DropdownMenuItem>
                    {(() => {
                      const next = getNextInitStatus(init.status as InitiativeStatus);
                      const prev = getPrevInitStatus(init.status as InitiativeStatus);
                      return (
                        <>
                          <DropdownMenuSeparator />
                          {next && (
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onStatusChange(next); }}>
                              <ChevronRight className="h-3.5 w-3.5 text-blue-600" />
                              Avanzar → {INIT_STATUS_LABELS[next]}
                            </DropdownMenuItem>
                          )}
                          {prev && (
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onStatusChange(prev); }}>
                              <ChevronLeft className="h-3.5 w-3.5 text-amber-600" />
                              Retroceder → {INIT_STATUS_LABELS[prev]}
                            </DropdownMenuItem>
                          )}
                          {init.status !== "CANCELLED" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={e => { e.stopPropagation(); onStatusChange("CANCELLED"); }}
                                className="text-muted-foreground focus:text-muted-foreground"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Cancelar iniciativa
                              </DropdownMenuItem>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {init.primary_area_name && (
              <span
                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: (init.primary_area_color ?? "#6366f1") + "20", color: init.primary_area_color ?? "#6366f1" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: init.primary_area_color ?? "#6366f1" }} />
                {init.primary_area_name}
              </span>
            )}
            {init.team_name && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Users className="h-2.5 w-2.5" />
                {init.team_name}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Milestone className="h-2.5 w-2.5" />
              {t("milestones", { done: init.completed_milestones, total: init.total_milestones })}
            </span>
            {init.key_results?.length > 0 && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 px-1.5 text-primary">
                {init.key_results.length} KR{init.key_results.length > 1 ? "s" : ""}
              </Badge>
            )}
            {overdueMs > 0 && (
              <Badge className="text-[10px] py-0 h-4 px-1.5 bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400">
                {t("overdueMilestone", { n: overdueMs })}
              </Badge>
            )}
          </div>

          {init.due_date && (
            <p className={cn("text-xs", init.is_overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
              {init.is_overdue ? t("overdueDate") : t("dueDate")}
              {fmtDate(init.due_date, true)}
            </p>
          )}

          {/* Responsable + días sin actualizar */}
          <div className="flex items-center gap-3 pt-1 border-t border-dashed border-border/50 flex-wrap">
            {init.owner_name && (
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                  {init.owner_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{init.owner_name}</span>
              </div>
            )}
            {init.updated_at && (() => {
              const days = Math.floor((Date.now() - new Date(init.updated_at).getTime()) / (1000 * 60 * 60 * 24));
              const isStale = days > 14;
              return (
                <div className={cn("flex items-center gap-1 text-[10px]", isStale ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground")}>
                  <Clock className="h-2.5 w-2.5 shrink-0" />
                  <span>{days === 0 ? "Actualizado hoy" : days === 1 ? "Hace 1 día" : `Hace ${days} días`}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      {hovered && init.status !== "DONE" && init.status !== "CANCELLED" && (
        <div
          className="flex items-center gap-2 px-3.5 pb-3 pt-0 border-t mt-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm" variant="ghost"
            className="h-7 text-xs gap-1 flex-1"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            <Eye className="h-3 w-3" /> {t("viewDetail")}
          </Button>
          <Button
            size="sm" variant="ghost"
            className="h-7 text-xs gap-1 flex-1"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="h-3 w-3" /> {t("editAction")}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  status, label, icon: Icon, color, items,
  onCardClick, onEditClick, onAddClick, onStatusChange,
  draggingId, onDragStart, onDragEnd,
  isDropTarget, onDragOver, onDragLeave, onDrop,
}: {
  status: string; label: string; icon: React.ElementType; color: string;
  items: Initiative[];
  onCardClick: (i: Initiative) => void;
  onEditClick: (i: Initiative) => void;
  onAddClick: () => void;
  onStatusChange: (id: string, s: InitiativeStatus) => void;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  isDropTarget: boolean;
  onDragOver: () => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const tCol = useTranslations("pages.initiatives");
  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/20 p-3 flex flex-col gap-2.5 min-h-[200px] transition-all duration-150",
        isDropTarget && "ring-2 ring-primary ring-offset-2",
      )}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-sm font-medium">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums bg-muted rounded-full px-1.5 py-0.5">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className={cn(
          "flex-1 rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors",
          isDropTarget ? "border-primary/50 bg-primary/5 text-primary font-medium" : "border-muted-foreground/20 text-muted-foreground",
        )}>
          {isDropTarget ? "Soltar aquí" : tCol("noInitiatives")}
        </div>
      ) : (
        <>
          {items.map((init) => (
            <div
              key={init.id}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData("text/plain", init.id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart(init.id);
              }}
              onDragEnd={onDragEnd}
              className={cn("cursor-grab active:cursor-grabbing transition-opacity", draggingId === init.id && "opacity-40")}
            >
              <InitiativeCard
                initiative={init}
                onClick={() => onCardClick(init)}
                onEdit={() => onEditClick(init)}
                onStatusChange={s => onStatusChange(init.id, s)}
              />
            </div>
          ))}
          {isDropTarget && (
            <div className="h-10 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center">
              <p className="text-xs text-primary/70">Soltar aquí</p>
            </div>
          )}
        </>
      )}

      <button
        onClick={onAddClick}
        className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> {tCol("addItem")}
      </button>
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({
  items,
  onCardClick,
  onEditClick,
}: {
  items: Initiative[];
  onCardClick: (i: Initiative) => void;
  onEditClick: (i: Initiative) => void;
}) {
  const tList = useTranslations("pages.initiatives");
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="grid grid-cols-[44px_1fr_130px_90px_120px_110px] gap-3 px-4 py-2.5 bg-muted/40 border-b text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span />
        <span>{tList("listColInitiative")}</span>
        <span>{tList("listColStatus")}</span>
        <span className="text-right">{tList("listColProgress")}</span>
        <span>{tList("listColTeam")}</span>
        <span>{tList("listColDue")}</span>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">{tList("listNoResults")}</div>
      ) : (
        <div className="divide-y">
          {items.map((init) => (
            <div
              key={init.id}
              className={cn(
                "grid grid-cols-[44px_1fr_130px_90px_120px_110px] gap-3 px-4 py-3 items-center",
                "hover:bg-muted/30 cursor-pointer transition-colors group",
                "border-l-4",
                borderByProgress(init.progress, init.is_overdue)
              )}
              onClick={() => onCardClick(init)}
            >
              {/* Ring */}
              <ProgressRing progress={init.progress} size={36} className="shrink-0" />

              {/* Title */}
              <div className="min-w-0 flex items-center gap-2">
                {init.is_overdue && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                <div className="min-w-0">
                  {init.code && (
                    <span className="text-[10px] font-mono text-muted-foreground mr-1">{init.code}</span>
                  )}
                  <span className="text-sm font-medium">{init.title}</span>
                </div>
              </div>

              {/* Status */}
              <StatusChip status={init.status} />

              {/* Progress text */}
              <span className="text-xs tabular-nums text-muted-foreground text-right font-mono">
                {Math.round(init.progress)}%
              </span>

              {/* Team */}
              <span className="text-xs text-muted-foreground truncate">{init.team_name ?? "—"}</span>

              {/* Due date */}
              <div className="flex items-center justify-between gap-1">
                <span className={cn("text-xs", init.is_overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                  {init.due_date ? fmtDate(init.due_date, true) : tList("noDueDate")}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                  onClick={(e) => { e.stopPropagation(); onEditClick(init); }}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <div key={col.id} className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-l-4 border-l-muted p-3.5 flex items-start gap-3">
              <div className="h-13 w-13 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 rounded bg-muted animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InitiativesPage() {
  const t = useTranslations("pages.initiatives");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [view, setView]             = useState<ViewMode>("kanban");
  const [formOpen, setFormOpen]     = useState(false);
  const [editing, setEditing]       = useState<Initiative | null>(null);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [dropTarget,  setDropTarget]  = useState<string | null>(null);
  const [prefill, setPrefill]       = useState<{ title?: string; description?: string; start_date?: string; due_date?: string; primary_area?: string; involved_areas?: string[]; suggested_dependencies?: { description: string; type: string }[] } | undefined>(undefined);
  const [drawerInit, setDrawerInit] = useState<Initiative | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [aiOpen, setAiOpen]         = useState(false);

  const { data: cycle } = useActiveCycle();
  const updateInitiative = useUpdateInitiative();
  const { data: initiatives = [], isLoading } = useInitiatives(
    cycle?.id ? { cycle_id: cycle.id } : undefined
  );

  const allInits = initiatives as Initiative[];

  // Auto-open initiative when navigating from impact chain widget
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || allInits.length === 0) return;
    const init = allInits.find((i) => i.id === openId);
    if (init) {
      setDrawerInit(init);
      setDrawerOpen(true);
      router.replace("/initiatives", { scroll: false });
    }
  }, [searchParams, allInits]);

  const filteredInits = useMemo(() => {
    if (!search.trim()) return allInits;
    const q = search.toLowerCase();
    return allInits.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      i.team_name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  }, [allInits, search]);

  function openCard(init: Initiative) {
    setDrawerInit(init);
    setDrawerOpen(true);
  }

  function openEdit(init: Initiative) {
    setEditing(init);
    setPrefill(undefined);
    setFormOpen(true);
    setDrawerOpen(false);
  }

  function openNew() {
    setEditing(null);
    setPrefill(undefined);
    setFormOpen(true);
  }

  function handleAiApply(suggestion: InitiativeSuggestion) {
    const today = new Date();
    const startStr = today.toISOString().slice(0, 10);
    const dueMs = today.getTime() + (suggestion.estimated_duration_weeks || 8) * 7 * 24 * 60 * 60 * 1000;
    const cycleEnd = cycle?.end_date ? new Date(cycle.end_date).getTime() : Infinity;
    const dueStr = new Date(Math.min(dueMs, cycleEnd)).toISOString().slice(0, 10);

    setEditing(null);
    setPrefill({
      title: suggestion.title,
      description: suggestion.description,
      start_date: startStr,
      due_date: dueStr,
      primary_area: suggestion.primary_area ?? undefined,
      involved_areas: suggestion.involved_areas ?? [],
      suggested_dependencies: suggestion.suggested_dependencies ?? [],
    });
    setAiOpen(false);
    setFormOpen(true);
  }

  const inProgress = allInits.filter((i) => i.status === "IN_PROGRESS").length;
  const overdue    = allInits.filter((i) => i.is_overdue && i.status !== "DONE").length;
  const done       = allInits.filter((i) => i.status === "DONE").length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors",
                  view === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                )}
              >
                <List className="h-3 w-3" /> {t("viewKanban")}
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors border-l border-border",
                  view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                )}
              >
                <TableProperties className="h-3 w-3" /> {t("viewList")}
              </button>
              <button
                onClick={() => setView("gantt")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors border-l border-border",
                  view === "gantt" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                )}
              >
                <BarChart2 className="h-3 w-3" /> {t("viewGantt")}
              </button>
            </div>

            <Button
              size="sm" variant="outline"
              onClick={() => setAiOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("suggestAI")}
            </Button>

            <Button size="sm" onClick={openNew} className="h-8 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t("newInitiative")}
            </Button>
          </div>
        }
      />

      {!cycle ? (
        <EmptyState
          icon={Rocket}
          title={t("noCycle")}
          description={t("noCycleDesc")}
          actionLabel={t("goCycles")}
          onAction={() => (window.location.href = "/cycles")}
        />
      ) : (
        <div className="space-y-5">
          <CycleBanner cycle={cycle} />

          {/* Stats + search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium tabular-nums">{allInits.length}</span>
              <span className="text-xs text-muted-foreground">{t("statTotal")}</span>
            </div>
            {inProgress > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">{inProgress}</span>
                <span className="text-xs text-muted-foreground">{t("statInProgress")}</span>
              </div>
            )}
            {overdue > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-sm font-medium tabular-nums text-red-500">{overdue}</span>
                <span className="text-xs text-muted-foreground">{t("statOverdue")}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm font-medium tabular-nums">{done}</span>
              <span className="text-xs text-muted-foreground">{t("statDone")}</span>
            </div>

            {allInits.length > 0 && (
              <div className="relative ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="pl-8 h-9 text-sm w-52"
                />
              </div>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <KanbanSkeleton />
          ) : allInits.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <Rocket className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">{t("emptyTitle")}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {t("emptyDesc")}
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={() => setAiOpen(true)} className="gap-1.5">
                  <Sparkles className="h-4 w-4" /> {t("suggestAI")}
                </Button>
                <Button variant="outline" onClick={openNew}>{t("createManually")}</Button>
              </div>
            </div>
          ) : filteredInits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {t("noResults")} <span className="font-medium">"{search}"</span>
              </p>
              <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">
                {t("clearSearch")}
              </button>
            </div>
          ) : view === "kanban" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map(({ id, icon, color }) => {
                const colLabel = id === "TODO" ? t("columnTodo") : id === "IN_PROGRESS" ? t("columnInProgress") : t("columnDone");
                const draggingInit = draggingId ? filteredInits.find(i => i.id === draggingId) ?? allInits.find(i => i.id === draggingId) : null;
                const isSource = draggingInit?.status === id;
                const isDropTarget = dropTarget === id && draggingId !== null && !isSource;
                return (
                  <KanbanColumn
                    key={id}
                    status={id}
                    label={colLabel}
                    icon={icon}
                    color={color}
                    items={filteredInits.filter((i) => i.status === id)}
                    onCardClick={openCard}
                    onEditClick={openEdit}
                    onAddClick={openNew}
                    onStatusChange={(initId, s) => updateInitiative.mutate({ id: initId, status: s })}
                    draggingId={draggingId}
                    onDragStart={setDraggingId}
                    onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                    isDropTarget={isDropTarget}
                    onDragOver={() => setDropTarget(id)}
                    onDragLeave={e => {
                      const related = e.relatedTarget as Node | null;
                      if (!(e.currentTarget as HTMLElement).contains(related)) setDropTarget(null);
                    }}
                    onDrop={() => {
                      if (draggingId && draggingInit && draggingInit.status !== id) {
                        updateInitiative.mutate({ id: draggingId, status: id });
                      }
                      setDraggingId(null); setDropTarget(null);
                    }}
                  />
                );
              })}
            </div>
          ) : view === "list" ? (
            <ListView items={filteredInits} onCardClick={openCard} onEditClick={openEdit} />
          ) : (
            <GanttView initiatives={filteredInits.filter((i) => i.status !== "CANCELLED")} />
          )}
        </div>
      )}

      <InitiativeForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) { setEditing(null); setPrefill(undefined); } }}
        editing={editing}
        prefillValues={prefill}
        defaultCycleId={cycle?.id}
      />

      <InitiativeDrawer
        initiative={drawerInit}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={openEdit}
      />

      {cycle?.id && (
        <AiSuggestInitiativesDialog
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          cycleId={cycle.id}
          onApply={handleAiApply}
        />
      )}
    </div>
  );
}
