"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertCircle, Clock, CheckCircle2, Target, FileText,
  Layers, ChevronRight, User, AlertTriangle, BookOpen, Pencil,
} from "lucide-react";
import { type SprintBoard as SprintBoardType, type SprintInitiative } from "@/hooks/useSprints";
import type { BacklogItem } from "@/hooks/useBacklog";
import { useUpdateBacklogItem } from "@/hooks/useBacklog";

// ── Column config ─────────────────────────────────────────────────────────────

const INITIATIVE_COLS = [
  { id: "TODO",        label: "Por hacer",   icon: Clock,        color: "text-muted-foreground", bg: "bg-muted/30" },
  { id: "IN_PROGRESS", label: "En progreso", icon: ChevronRight, color: "text-blue-500",         bg: "bg-blue-50/50 dark:bg-blue-950/20" },
  { id: "DONE",        label: "Completadas", icon: CheckCircle2, color: "text-green-500",        bg: "bg-green-50/50 dark:bg-green-950/20" },
] as const;

const STORY_COLS = [
  { id: "OPEN",        label: "Por hacer",   icon: Clock,        color: "text-muted-foreground", bg: "bg-muted/30" },
  { id: "IN_PROGRESS", label: "En progreso", icon: ChevronRight, color: "text-blue-500",         bg: "bg-blue-50/50 dark:bg-blue-950/20" },
  { id: "DONE",        label: "Completadas", icon: CheckCircle2, color: "text-green-500",        bg: "bg-green-50/50 dark:bg-green-950/20" },
] as const;

const PRIORITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500",
  HIGH:     "border-l-orange-400",
  MEDIUM:   "border-l-amber-400",
  LOW:      "border-l-slate-300",
};

const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Crítica", color: "text-red-500"    },
  HIGH:     { label: "Alta",    color: "text-orange-400" },
  MEDIUM:   { label: "Media",   color: "text-amber-500"  },
  LOW:      { label: "Baja",    color: "text-slate-400"  },
};

function hasRealAC(ac: string | null | undefined): boolean {
  if (!ac || ac.trim().length < 20) return false;
  const lower = ac.toLowerCase();
  const templatePhrases = ["criterio de aceptación", "acceptance criteria", "dado que", "cuando", "entonces"];
  return templatePhrases.some(p => lower.includes(p)) || ac.trim().length >= 50;
}

// ── Status pills config ───────────────────────────────────────────────────────

const STATUS_PILLS = [
  { id: "OPEN",        label: "Por hacer",   cls: "hover:bg-muted/60",                                              activeCls: "bg-muted text-foreground font-semibold"           },
  { id: "IN_PROGRESS", label: "En progreso", cls: "hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30", activeCls: "bg-blue-100 text-blue-700 font-semibold dark:bg-blue-950/40 dark:text-blue-400" },
  { id: "DONE",        label: "Completada",  cls: "hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950/30", activeCls: "bg-green-100 text-green-700 font-semibold dark:bg-green-950/40 dark:text-green-400" },
] as const;

// ── Jira-like story card ──────────────────────────────────────────────────────

function StoryCard({
  story, onStatusChange, onEdit,
}: {
  story: BacklogItem;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (story: BacklogItem) => void;
}) {
  const borderClass = PRIORITY_BORDER[story.priority] ?? PRIORITY_BORDER.MEDIUM;
  const pLabel = PRIORITY_LABEL[story.priority];
  const ready = hasRealAC(story.acceptance_criteria);

  return (
    <Card className={cn("p-3 border-l-4 space-y-2 cursor-default hover:shadow-sm transition-shadow group", borderClass)}>
      {/* Header: code + priority + AC badge + edit button */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {story.code && (
            <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{story.code}</span>
          )}
          {pLabel && (
            <span className={cn("text-[10px] font-medium shrink-0", pLabel.color)}>{pLabel.label}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ready ? (
            <span title="Criterios de aceptación completos" className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
            </span>
          ) : (
            <span title="Faltan criterios de aceptación" className="flex items-center gap-0.5 text-[10px] text-amber-500">
              <AlertTriangle className="h-3 w-3" />
            </span>
          )}
          <button
            onClick={() => onEdit(story)}
            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
            title="Editar historia"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Title */}
      <p className="text-xs font-medium leading-snug line-clamp-2">{story.title}</p>

      {/* Meta: parent, assignee, points */}
      <div className="flex items-center gap-2 flex-wrap">
        {story.parent_title && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Layers className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[100px]" title={story.parent_title}>{story.parent_title}</span>
          </div>
        )}
        {story.assignee_name && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[80px]">{story.assignee_name}</span>
          </div>
        )}
        {story.story_points != null && story.story_points > 0 && (
          <Badge variant="secondary" className="text-[10px] py-0 ml-auto">{story.story_points} pts</Badge>
        )}
      </div>

      {/* Status pills — click any to switch */}
      <div className="flex gap-1 pt-0.5">
        {STATUS_PILLS.map(pill => (
          <button
            key={pill.id}
            onClick={() => story.status !== pill.id && onStatusChange(story.id, pill.id)}
            className={cn(
              "flex-1 rounded text-[10px] py-0.5 px-1 transition-colors border border-transparent",
              story.status === pill.id ? pill.activeCls : cn("text-muted-foreground", pill.cls),
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Initiative card ───────────────────────────────────────────────────────────

function InitiativeCard({ initiative: init }: { initiative: SprintInitiative }) {
  return (
    <Card className={cn("p-3 space-y-2 cursor-default", init.is_overdue && "border-red-400/60")}>
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium leading-snug flex-1">
          {(init as any).code && (
            <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5">
              {(init as any).code}
            </span>
          )}
          {init.title}
        </p>
        {init.is_overdue && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all",
              init.status === "DONE" ? "bg-green-500" :
              init.progress >= 70 ? "bg-primary" :
              init.progress >= 40 ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${Math.round(init.progress)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(init.progress)}%</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {init.team_name && <Badge variant="outline" className="text-[10px] py-0">{init.team_name}</Badge>}
        {init.total_milestones > 0 && (
          <Badge variant="outline" className="text-[10px] py-0">
            {init.completed_milestones}/{init.total_milestones} hitos
          </Badge>
        )}
        {init.due_date && (
          <span className={cn("text-[10px]", init.is_overdue ? "text-red-500" : "text-muted-foreground")}>
            {new Date(init.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
    </Card>
  );
}

// ── Sprint board ──────────────────────────────────────────────────────────────

interface SprintBoardProps {
  board: SprintBoardType;
  stories: BacklogItem[];
  onEdit?: (story: BacklogItem) => void;
}

export function SprintBoardView({ board, stories, onEdit }: SprintBoardProps) {
  const updateItem = useUpdateBacklogItem();

  function handleStatusChange(id: string, status: string) {
    updateItem.mutate({ id, status });
  }

  function handleEdit(story: BacklogItem) {
    onEdit?.(story);
  }

  const initiativesByStatus = (status: string) =>
    board.initiatives.filter((i) => i.status === status);

  const storiesByStatus = (status: string) =>
    stories.filter((s) => s.status === status);

  const totalSP   = stories.reduce((acc, s) => acc + (s.story_points ?? 0), 0);
  const doneSP    = stories.filter(s => s.status === "DONE").reduce((acc, s) => acc + (s.story_points ?? 0), 0);
  const activeSP  = stories.filter(s => s.status === "IN_PROGRESS").reduce((acc, s) => acc + (s.story_points ?? 0), 0);
  const readyCount = stories.filter(s => hasRealAC(s.acceptance_criteria )).length;

  return (
    <div className="space-y-6">

      {/* Sprint goal */}
      {board.goal && (
        <div className="flex items-start gap-2 rounded-lg border bg-primary/5 px-4 py-3">
          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-primary mb-0.5">Sprint Goal</p>
            <p className="text-sm">{board.goal}</p>
          </div>
        </div>
      )}

      {/* Velocity + KR chips */}
      <div className="flex flex-wrap items-center gap-3">
        {board.planned_velocity > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Planificado</p>
              <p className="text-sm font-bold tabular-nums">{board.planned_velocity} pts</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Completado</p>
              <p className={cn("text-sm font-bold tabular-nums", doneSP >= board.planned_velocity ? "text-green-500" : "")}>
                {doneSP} pts
              </p>
            </div>
            {activeSP > 0 && (
              <>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">En progreso</p>
                  <p className="text-sm font-bold tabular-nums text-blue-500">{activeSP} pts</p>
                </div>
              </>
            )}
          </div>
        )}

        {stories.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Refinadas:</span>
            <span className={cn("font-semibold", readyCount === stories.length ? "text-green-500" : readyCount > 0 ? "text-amber-500" : "text-destructive")}>
              {readyCount}/{stories.length}
            </span>
          </div>
        )}

        {board.sprint_krs.map((kr) => (
          <div key={kr.kr_id} className="flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">
            <div className={cn("h-1.5 w-1.5 rounded-full",
              kr.progress >= 70 ? "bg-green-500" : kr.progress >= 40 ? "bg-amber-500" : "bg-blue-500",
            )} />
            <span className="truncate max-w-[180px]" title={kr.kr_title}>{kr.kr_title}</span>
            <span className="text-muted-foreground tabular-nums">{Math.round(kr.progress)}%</span>
          </div>
        ))}
      </div>

      {/* ── Stories board ────────────────────────────────────────── */}
      {stories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Historias del sprint</h3>
            <Badge variant="secondary" className="text-[10px]">{stories.length} historias · {totalSP} pts</Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {STORY_COLS.map(({ id, label, icon: Icon, color, bg }) => {
              const cards = storiesByStatus(id);
              return (
                <div key={id} className="space-y-2">
                  <div className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1.5", bg)}>
                    <Icon className={cn("h-3.5 w-3.5", color)} />
                    <span className="text-xs font-medium flex-1">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{cards.length}</span>
                  </div>
                  {cards.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
                      Sin historias
                    </div>
                  ) : (
                    cards.map((s) => (
                      <StoryCard key={s.id} story={s} onStatusChange={handleStatusChange} onEdit={handleEdit} />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stories.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Sin historias en este sprint</p>
          <p className="text-xs text-muted-foreground/60">Ve a "Planificar" para agregar historias del backlog</p>
        </div>
      )}

      {/* ── Initiatives board ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Iniciativas</h3>
          <Badge variant="secondary" className="text-[10px]">{board.initiatives.length}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {INITIATIVE_COLS.map(({ id, label, icon: Icon, color, bg }) => {
            const cards = initiativesByStatus(id);
            return (
              <div key={id} className="space-y-2">
                <div className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1.5", bg)}>
                  <Icon className={cn("h-3.5 w-3.5", color)} />
                  <span className="text-xs font-medium flex-1">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{cards.length}</span>
                </div>
                {cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
                    Sin iniciativas
                  </div>
                ) : (
                  cards.map((init) => <InitiativeCard key={init.id} initiative={init} />)
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
