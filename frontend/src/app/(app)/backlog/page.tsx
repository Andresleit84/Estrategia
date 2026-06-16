"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { useActiveCycle } from "@/hooks/useCycles";
import { useInitiatives } from "@/hooks/useInitiatives";
import {
  useBacklogTree, useBacklogList, useBacklogStats,
  useUpdateBacklogItem, useDeleteBacklogItem,
  type BacklogItem, type BacklogType, type BacklogPriority, type BacklogStatus,
} from "@/hooks/useBacklog";
import {
  Plus, BookOpen, Layers, FileText, ChevronRight, ChevronDown, ChevronLeft,
  List, LayoutGrid, Search, X, Pencil, Trash2, MoreHorizontal,
  Clock, CheckCircle2, XCircle, Zap, Target, Star, Sparkles, SlidersHorizontal,
} from "lucide-react";
import { AiSuggestBacklogDialog } from "@/components/backlog/AiSuggestBacklogDialog";
import { BacklogItemDialog, TypeBadge } from "@/components/backlog/BacklogItemDialog";
import { TYPE_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, STORY_POINTS } from "@/components/backlog/backlog-config";
import { cn } from "@/lib/utils";

// ── Config ────────────────────────────────────────────────────────────────────

const KANBAN_COLS: { id: BacklogStatus; label: string }[] = [
  { id: "OPEN",        label: "Abierta" },
  { id: "IN_PROGRESS", label: "En curso" },
  { id: "DONE",        label: "Completada" },
];

const BACKLOG_STATUS_FLOW: BacklogStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];
function getNextBacklogStatus(s: BacklogStatus): BacklogStatus | null {
  const i = BACKLOG_STATUS_FLOW.indexOf(s);
  return i >= 0 && i < BACKLOG_STATUS_FLOW.length - 1 ? BACKLOG_STATUS_FLOW[i + 1] : null;
}
function getPrevBacklogStatus(s: BacklogStatus): BacklogStatus | null {
  const i = BACKLOG_STATUS_FLOW.indexOf(s);
  return i > 0 ? BACKLOG_STATUS_FLOW[i - 1] : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const color = value === 100 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : "bg-amber-400";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">{value}%</span>
    </div>
  );
}

function PriorityDot({ priority }: { priority: BacklogPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span title={cfg.label} className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
  );
}

// ── Action menu ───────────────────────────────────────────────────────────────

function ItemMenu({ onEdit, onDelete, status, onStatusChange }: {
  onEdit: () => void;
  onDelete: () => void;
  status?: BacklogStatus;
  onStatusChange?: (s: BacklogStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const next = status ? getNextBacklogStatus(status) : null;
  const prev = status ? getPrevBacklogStatus(status) : null;
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 min-w-40 rounded-lg border bg-popover p-1 shadow-lg">
          <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs hover:bg-accent">
            <Pencil className="h-3 w-3" /> Editar
          </button>
          {onStatusChange && next && (
            <button onClick={() => { setOpen(false); onStatusChange(next); }} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs hover:bg-accent">
              <ChevronRight className="h-3 w-3 text-blue-600" /> Avanzar → {STATUS_CONFIG[next].label}
            </button>
          )}
          {onStatusChange && prev && (
            <button onClick={() => { setOpen(false); onStatusChange(prev); }} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs hover:bg-accent">
              <ChevronLeft className="h-3 w-3 text-amber-600" /> Retroceder → {STATUS_CONFIG[prev].label}
            </button>
          )}
          <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3 w-3" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Backlog item card ─────────────────────────────────────────────────────────

function BacklogCard({ item, onEdit, onDelete, onAddChild, compact = false }: {
  item: BacklogItem;
  onEdit: (item: BacklogItem) => void;
  onDelete: (item: BacklogItem) => void;
  onAddChild?: (parent: BacklogItem) => void;
  compact?: boolean;
}) {
  const updateItem = useUpdateBacklogItem();
  const statusCfg = STATUS_CONFIG[item.status];
  const StatusIcon = statusCfg.Icon;

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const cycle: Record<BacklogStatus, BacklogStatus> = {
      OPEN: "IN_PROGRESS", IN_PROGRESS: "DONE", DONE: "OPEN", CANCELLED: "OPEN",
    };
    updateItem.mutate({ id: item.id, status: cycle[item.status] });
  }

  return (
    <Card className={cn(
      "group p-3.5 hover:shadow-md transition-all",
      item.status === "DONE" && "opacity-70",
      compact && "p-3",
    )}>
      <div className="flex items-start gap-2">
        <button onClick={cycleStatus} className="mt-0.5 shrink-0" title={`Estado: ${statusCfg.label}`}>
          <StatusIcon className={cn("h-4 w-4 transition-colors", statusCfg.color)} />
        </button>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2 justify-between">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <TypeBadge type={item.type} />
              <PriorityDot priority={item.priority} />
              {item.story_points && (
                <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {item.story_points}pt
                </span>
              )}
            </div>
            <ItemMenu
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              status={item.status}
              onStatusChange={s => updateItem.mutate({ id: item.id, status: s })}
            />
          </div>

          <p className={cn("text-sm font-medium leading-snug", item.status === "DONE" && "line-through text-muted-foreground")}>
            {item.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5">{item.code}</span>}
            {item.title}
          </p>

          {item.children_count > 0 && (
            <ProgressBar value={item.progress} />
          )}

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
            {item.initiative_title && (
              <span className="flex items-center gap-0.5">
                <Target className="h-2.5 w-2.5" />{item.initiative_title}
              </span>
            )}
            {item.assignee_name && (
              <span className="flex items-center gap-0.5">
                <span className="h-3 w-3 rounded-full bg-muted-foreground/30 inline-flex items-center justify-center text-[8px]">
                  {item.assignee_name[0]}
                </span>
                {item.assignee_name}
              </span>
            )}
            {item.children_count > 0 && (
              <span>{item.completed_children}/{item.children_count} ítems</span>
            )}
          </div>

          {onAddChild && item.type !== "STORY" && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(item); }}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Plus className="h-2.5 w-2.5" />
              Agregar {item.type === "EPIC" ? "feature" : "historia"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Tree row ─────────────────────────────────────────────────────────────────

function TreeRow({ item, depth = 0, onEdit, onDelete, onAddChild }: {
  item: BacklogItem;
  depth?: number;
  onEdit: (i: BacklogItem) => void;
  onDelete: (i: BacklogItem) => void;
  onAddChild: (parent: BacklogItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (item.children?.length ?? 0) > 0;
  const updateItem = useUpdateBacklogItem();
  const statusCfg = STATUS_CONFIG[item.status];
  const StatusIcon = statusCfg.Icon;
  const typeCfg = TYPE_CONFIG[item.type];
  const TypeIcon = typeCfg.Icon;

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const cycle: Record<BacklogStatus, BacklogStatus> = { OPEN: "IN_PROGRESS", IN_PROGRESS: "DONE", DONE: "OPEN", CANCELLED: "OPEN" };
    updateItem.mutate({ id: item.id, status: cycle[item.status] });
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors",
          item.status === "DONE" && "opacity-60",
        )}
        style={{ paddingLeft: `${(depth * 20) + 8}px` }}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn("h-4 w-4 shrink-0 flex items-center justify-center", !hasChildren && "invisible")}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {/* Status toggle */}
        <button onClick={cycleStatus} className="shrink-0" title={statusCfg.label}>
          <StatusIcon className={cn("h-4 w-4", statusCfg.color)} />
        </button>

        {/* Type icon */}
        <TypeIcon className={cn("h-3.5 w-3.5 shrink-0", typeCfg.color)} />

        {/* Title */}
        <p className={cn("flex-1 text-sm min-w-0 truncate", item.status === "DONE" && "line-through text-muted-foreground")}>
          {item.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5">{item.code}</span>}
          {item.title}
        </p>

        {/* Columns — fixed widths match header */}
        <div className="flex items-center shrink-0">
          <div className="w-12 flex justify-center">
            {item.story_points ? (
              <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.story_points}pt</span>
            ) : <span />}
          </div>
          <div className="w-14 flex justify-center">
            <PriorityDot priority={item.priority} />
          </div>
          <div className="w-14 flex justify-center">
            {item.children_count > 0 ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">{item.completed_children}/{item.children_count}</span>
            ) : <span />}
          </div>
          <div className="w-28 flex items-center gap-1.5">
            {item.assignee_name ? (
              <>
                <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-[9px] font-semibold flex items-center justify-center shrink-0">
                  {item.assignee_name[0].toUpperCase()}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">{item.assignee_name}</span>
              </>
            ) : <span />}
          </div>
          <div className="w-14 flex items-center justify-end gap-1">
            {item.type !== "STORY" && (
              <button
                onClick={() => onAddChild(item)}
                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Agregar ${item.type === "EPIC" ? "feature" : "historia"}`}
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
            <ItemMenu
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              status={item.status}
              onStatusChange={s => updateItem.mutate({ id: item.id, status: s })}
            />
          </div>
        </div>
      </div>

      {expanded && hasChildren && item.children?.map((child) => (
        <TreeRow key={child.id} item={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border bg-card p-4">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const t = useTranslations("pages.backlog");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [view, setView]         = useState<"tree" | "kanban">("tree");
  const [aiOpen, setAiOpen]     = useState(false);
  const [dialogOpen, setDialog] = useState(false);
  const [editing, setEditing]   = useState<BacklogItem | null>(null);
  const [defaultType, setDefaultType]     = useState<BacklogType | undefined>();
  const [defaultParent, setDefaultParent] = useState<BacklogItem | null>(null);
  const [search, setSearch]     = useState("");
  const [typeFilter, setTypeFilter]         = useState<BacklogType | "ALL">("ALL");
  const [statusFilter, setStatusFilter]     = useState<BacklogStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<BacklogPriority | "ALL">("ALL");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [dropTarget,  setDropTarget]  = useState<BacklogStatus | null>(null);

  const [confirmDeleteItem, setConfirmDeleteItem] = useState<BacklogItem | null>(null);

  const { data: cycle }         = useActiveCycle();
  const { data: treeData = [],  isLoading: treeLoading  } = useBacklogTree({ cycle_id: cycle?.id });
  const { data: flatItems = [],  isLoading: flatLoading  } = useBacklogList({ cycle_id: cycle?.id });
  const { data: stats }         = useBacklogStats({ cycle_id: cycle?.id });
  const { data: initiatives = [] } = useInitiatives(cycle?.id ? { cycle_id: cycle.id } : undefined);
  const deleteItem      = useDeleteBacklogItem();
  const updateBacklogItem = useUpdateBacklogItem();

  const isLoading = treeLoading || flatLoading;
  const hasFilters = !!(search || typeFilter !== "ALL" || statusFilter !== "ALL" || priorityFilter !== "ALL");

  // Auto-open item when navigating from impact chain widget
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || flatItems.length === 0) return;
    const item = flatItems.find((i) => i.id === openId);
    if (item) {
      setEditing(item);
      setDefaultType(undefined);
      setDefaultParent(null);
      setDialog(true);
      router.replace("/backlog", { scroll: false });
    }
  }, [searchParams, flatItems]);

  function openCreate(type?: BacklogType, parent?: BacklogItem) {
    setEditing(null);
    setDefaultType(type);
    setDefaultParent(parent ?? null);
    setDialog(true);
  }

  function openEdit(item: BacklogItem) {
    setEditing(item);
    setDefaultType(undefined);
    setDefaultParent(null);
    setDialog(true);
  }

  function handleDelete(item: BacklogItem) {
    setConfirmDeleteItem(item);
  }

  function executeDelete() {
    if (!confirmDeleteItem) return;
    deleteItem.mutate(confirmDeleteItem.id, { onSuccess: () => setConfirmDeleteItem(null) });
  }

  // Flat filtered list for kanban
  const filteredFlat = useMemo(() => {
    const q = search.toLowerCase();
    return flatItems.filter(i => {
      if (q && !i.title.toLowerCase().includes(q)) return false;
      if (typeFilter   !== "ALL" && i.type     !== typeFilter)   return false;
      if (statusFilter !== "ALL" && i.status   !== statusFilter) return false;
      if (priorityFilter !== "ALL" && i.priority !== priorityFilter) return false;
      return true;
    });
  }, [flatItems, search, typeFilter, statusFilter, priorityFilter]);

  // Filtered tree (simple title match on top level)
  const filteredTree = useMemo(() => {
    if (!hasFilters) return treeData;
    const q = search.toLowerCase();
    return treeData.filter(epic =>
      (!q || epic.title.toLowerCase().includes(q)) &&
      (typeFilter === "ALL" || epic.type === typeFilter)
    );
  }, [treeData, search, typeFilter, hasFilters]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={cycle ? `Ciclo: ${cycle.name}` : t("noCycle")}
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              {([
                { id: "tree",   label: t("viewTree"),   Icon: List },
                { id: "kanban", label: t("viewKanban"), Icon: LayoutGrid },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                    id !== "tree" && "border-l",
                    view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setAiOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("suggestAI")}
            </Button>
            <Button size="sm" onClick={() => openCreate()}>
              <Plus className="h-4 w-4 mr-1" />{t("newItem")}
            </Button>
          </div>
        }
      />

      {/* Stat cards */}
      {stats && (
        <div className="flex gap-3 flex-wrap">
          <StatCard
            label="Épicas"
            value={stats.epics}
            sub={cycle?.name ?? "Sin ciclo activo"}
          />
          <StatCard
            label="En curso"
            value={stats.in_progress}
            sub="Ítems activos"
          />
          <StatCard
            label="Completadas"
            value={stats.done}
            sub={`${Math.round((stats.done / Math.max(stats.total, 1)) * 100)}% del total`}
          />
          <StatCard
            label="Story points"
            value={stats.total_points > 0 ? `${stats.done_points}/${stats.total_points}` : "—"}
            sub="Completados / Total"
          />
        </div>
      )}

      {/* Search + filters */}
      {!isLoading && flatItems.length > 0 && (
        <div className="space-y-2">
          {/* Row 1: search + Filtros button + stats chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar ítems…"
                className="pl-8 h-9 text-sm w-56"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setFilterPanelOpen(v => !v)}
              className={cn(
                "flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-colors",
                (typeFilter !== "ALL" || statusFilter !== "ALL" || priorityFilter !== "ALL")
                  ? "border-primary/60 bg-primary/5 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {[typeFilter, statusFilter, priorityFilter].filter(v => v !== "ALL").length > 0 && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {[typeFilter, statusFilter, priorityFilter].filter(v => v !== "ALL").length}
                </span>
              )}
            </button>

            {stats && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  <span className="text-xs font-medium tabular-nums">{stats.epics}</span>
                  <span className="text-xs text-muted-foreground">épicas</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium tabular-nums">{stats.features}</span>
                  <span className="text-xs text-muted-foreground">features</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-xs font-medium tabular-nums">{stats.done}</span>
                  <span className="text-xs text-muted-foreground">completadas</span>
                </div>
                {Number(stats.total_points) > 0 && (
                  <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                    <Star className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-medium tabular-nums">{stats.done_points}/{stats.total_points}</span>
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collapsible filter panel */}
          {filterPanelOpen && (
            <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-12">Tipo</span>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as BacklogType | "ALL")}
                  className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ALL">Todos</option>
                  <option value="EPIC">Épicas</option>
                  <option value="FEATURE">Features</option>
                  <option value="STORY">Historias</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-12">Estado</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as BacklogStatus | "ALL")}
                  className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ALL">Todos</option>
                  <option value="OPEN">Abierta</option>
                  <option value="IN_PROGRESS">En curso</option>
                  <option value="DONE">Completada</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground w-12">Prioridad</span>
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value as BacklogPriority | "ALL")}
                  className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="ALL">Todas</option>
                  <option value="CRITICAL">Crítica</option>
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LOW">Baja</option>
                </select>
              </div>
              {hasFilters && (
                <button
                  onClick={() => { setSearch(""); setTypeFilter("ALL"); setStatusFilter("ALL"); setPriorityFilter("ALL"); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Limpiar todo
                </button>
              )}
            </div>
          )}

          {/* Active filter chips (when panel is closed) */}
          {!filterPanelOpen && (typeFilter !== "ALL" || statusFilter !== "ALL" || priorityFilter !== "ALL") && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {typeFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                  Tipo: {({ EPIC: "Épicas", FEATURE: "Features", STORY: "Historias" } as Record<string, string>)[typeFilter]}
                  <button onClick={() => setTypeFilter("ALL")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              )}
              {statusFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                  Estado: {({ OPEN: "Abierta", IN_PROGRESS: "En curso", DONE: "Completada" } as Record<string, string>)[statusFilter]}
                  <button onClick={() => setStatusFilter("ALL")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              )}
              {priorityFilter !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                  Prioridad: {({ CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" } as Record<string, string>)[priorityFilter]}
                  <button onClick={() => setPriorityFilter("ALL")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : flatItems.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          actionLabel={t("emptyAction")}
          onAction={() => openCreate("EPIC")}
        />
      ) : view === "tree" ? (
        /* ── TREE VIEW ── */
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-4 py-2.5 border-b bg-muted/40 text-xs text-muted-foreground font-medium">
            <span className="flex-1">Ítem</span>
            <span className="w-12 text-center">Pts</span>
            <span className="w-14 text-center">Prioridad</span>
            <span className="w-14 text-center">Avance</span>
            <span className="w-28 text-left">Responsable</span>
            <span className="w-14" />
          </div>
          <div className="divide-y">
            {filteredTree.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin épicas que coincidan con los filtros.</p>
            ) : (
              filteredTree.map(epic => (
                <TreeRow key={epic.id} item={epic} onEdit={openEdit} onDelete={handleDelete} onAddChild={(p) => openCreate(p.type === "EPIC" ? "FEATURE" : "STORY", p)} />
              ))
            )}
          </div>
          <div className="px-4 py-2.5 border-t bg-muted/20">
            <button onClick={() => openCreate("EPIC")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Plus className="h-3.5 w-3.5" /> Agregar épica
            </button>
          </div>
        </div>
      ) : (
        /* ── KANBAN VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_COLS.map(col => {
            const colItems = filteredFlat.filter(i => i.status === col.id);
            const StatusIcon = STATUS_CONFIG[col.id].Icon;
            const colLabel = col.id === "OPEN" ? t("colOpen") : col.id === "IN_PROGRESS" ? t("colInProgress") : t("colDone");
            const draggingItem = draggingId ? flatItems.find(i => i.id === draggingId) : null;
            const isSource = draggingItem?.status === col.id;
            const isTarget = dropTarget === col.id && draggingId !== null && !isSource;
            return (
              <div
                key={col.id}
                className={cn(
                  "rounded-xl border bg-muted/20 p-3 flex flex-col min-h-[200px] transition-all duration-150",
                  isTarget && "ring-2 ring-primary ring-offset-2",
                )}
                onDragOver={e => { e.preventDefault(); setDropTarget(col.id); }}
                onDragLeave={e => {
                  const related = e.relatedTarget as Node | null;
                  if (!(e.currentTarget as HTMLElement).contains(related)) setDropTarget(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  if (draggingId) {
                    const item = flatItems.find(i => i.id === draggingId);
                    if (item && item.status !== col.id) updateBacklogItem.mutate({ id: draggingId, status: col.id });
                  }
                  setDraggingId(null); setDropTarget(null);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <StatusIcon className={cn("h-4 w-4", STATUS_CONFIG[col.id].color)} />
                  <span className="text-sm font-medium">{colLabel}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums bg-muted rounded-full px-1.5">{colItems.length}</span>
                </div>
                {colItems.length === 0 ? (
                  <div className={cn(
                    "flex-1 rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors",
                    isTarget ? "border-primary/50 bg-primary/5 text-primary font-medium" : "border-muted-foreground/20 text-muted-foreground",
                  )}>
                    {isTarget ? "Soltar aquí" : "Sin ítems"}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 flex-1">
                    {colItems.map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData("text/plain", item.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(item.id);
                        }}
                        onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                        className={cn("cursor-grab active:cursor-grabbing transition-opacity", draggingId === item.id && "opacity-40")}
                      >
                        <BacklogCard item={item} onEdit={openEdit} onDelete={handleDelete}
                          onAddChild={item.type !== "STORY" ? (p) => openCreate(p.type === "EPIC" ? "FEATURE" : "STORY", p) : undefined}
                        />
                      </div>
                    ))}
                    {isTarget && (
                      <div className="h-10 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center">
                        <p className="text-xs text-primary/70">Soltar aquí</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AiSuggestBacklogDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        cycleId={cycle?.id}
      />

      <BacklogItemDialog
        open={dialogOpen}
        onClose={() => { setDialog(false); setEditing(null); setDefaultType(undefined); setDefaultParent(null); }}
        editing={editing}
        defaultType={defaultType}
        defaultParent={defaultParent}
        initiatives={initiatives as any[]}
        allItems={flatItems}
        cycleId={cycle?.id}
      />

      {/* Confirmación de eliminación */}
      <Dialog open={!!confirmDeleteItem} onOpenChange={(v) => { if (!v) setConfirmDeleteItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("confirmDelete")}</DialogTitle>
            <DialogDescription>
              Se eliminará <span className="font-medium">"{confirmDeleteItem?.title}"</span>
              {(confirmDeleteItem?.children_count ?? 0) > 0 && " y todos sus elementos hijos"}.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteItem(null)} disabled={deleteItem.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={executeDelete} disabled={deleteItem.isPending}>
              {deleteItem.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
