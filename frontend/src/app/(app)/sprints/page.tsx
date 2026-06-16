"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { SprintForm } from "@/components/sprints/SprintForm";
import { SprintBoardView } from "@/components/sprints/SprintBoard";
import { GenerateSprintsDialog } from "@/components/sprints/GenerateSprintsDialog";
import { BacklogItemDialog } from "@/components/backlog/BacklogItemDialog";
import { BurnupChart } from "@/components/sprints/BurnupChart";
import { VelocityChart } from "@/components/sprints/VelocityChart";
import { SprintCloseWizard } from "@/components/sprints/SprintCloseWizard";
import { SprintTimeline } from "@/components/sprints/SprintTimeline";
import {
  useSprints, useSprintBoard, useBurnup, useSprintVelocity,
  useSprintTimeline, useActivateSprint, useDeleteSprint,
  type Sprint,
} from "@/hooks/useSprints";
import { useBacklogList, useUpdateBacklogItem } from "@/hooks/useBacklog";
import type { BacklogItem } from "@/hooks/useBacklog";
import { useInitiatives } from "@/hooks/useInitiatives";
import { useActiveCycle } from "@/hooks/useCycles";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Plus, Zap, BarChart2, Map, Play, Trash2, TrendingUp,
  Calendar, Clock, CheckCircle2, Loader, Pencil,
  ListTodo, FileText, ChevronRight, ChevronLeft, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "board" | "planning" | "timeline" | "charts";

const STATUS_LABEL: Record<string, { label: string; color: string; ring: string }> = {
  PLANNING:  { label: "Planificando", color: "text-muted-foreground",     ring: "ring-border" },
  ACTIVE:    { label: "Activo",       color: "text-primary",              ring: "ring-primary/50" },
  COMPLETED: { label: "Completado",   color: "text-green-500",            ring: "ring-green-300 dark:ring-green-800" },
  CANCELLED: { label: "Cancelado",    color: "text-muted-foreground/50",  ring: "ring-border" },
};

// ── Sprint card (sidebar) ─────────────────────────────────────────────────────

function SprintCard({
  sprint, selected, onSelect, onEdit,
}: {
  sprint: Sprint; selected: boolean; onSelect: () => void; onEdit: () => void;
}) {
  const s = STATUS_LABEL[sprint.status] ?? STATUS_LABEL.PLANNING;
  const now = Date.now();
  const daysLeft = Math.max(0, Math.round((new Date(sprint.end_date).getTime() - now) / 86_400_000));
  const isActive = sprint.status === "ACTIVE";
  const isDone   = sprint.status === "COMPLETED";

  return (
    <Card
      onClick={onSelect}
      className={cn(
        "p-3.5 cursor-pointer hover:shadow-md transition-all group",
        selected && `ring-2 ${s.ring}`,
        isActive && "border-primary/30",
        isDone   && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" title={sprint.sprint_name}>
            {sprint.sprint_code && (
              <span className="font-mono text-muted-foreground mr-1">{sprint.sprint_code}</span>
            )}
            {sprint.sprint_name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{sprint.team_name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("text-[10px] font-semibold", s.color)}>{s.label}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
            title="Editar sprint"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(sprint.start_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          {" – "}
          {new Date(sprint.end_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
        </span>
        {isActive && (
          <span className="flex items-center gap-1 text-primary font-medium ml-auto">
            <Clock className="h-3 w-3" />{daysLeft}d
          </span>
        )}
      </div>

      {sprint.planned_velocity > 0 && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Vel:</span>
          <span className="font-semibold">{sprint.planned_velocity}</span>
          {sprint.actual_velocity > 0 && (
            <span className="ml-auto text-green-500 font-semibold">→ {sprint.actual_velocity} real</span>
          )}
        </div>
      )}

      {(sprint.initiative_count ?? 0) > 0 || (sprint.kr_count ?? 0) > 0 ? (
        <div className="flex gap-2 mt-1.5">
          {(sprint.initiative_count ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[9px] py-0 h-4">{sprint.initiative_count} init.</Badge>
          )}
          {(sprint.kr_count ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[9px] py-0 h-4">{sprint.kr_count} KRs</Badge>
          )}
        </div>
      ) : null}
    </Card>
  );
}

// ── Sprint planning ───────────────────────────────────────────────────────────

function SprintPlanningView({
  sprintId, orgStories, onAssign, onUnassign,
}: {
  sprintId: string;
  orgStories: BacklogItem[];
  onAssign: (storyId: string) => void;
  onUnassign: (storyId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const inSprint  = useMemo(() => orgStories.filter(s => s.sprint_id === sprintId), [orgStories, sprintId]);
  const available = useMemo(() => orgStories.filter(s => !s.sprint_id && s.status !== "DONE" && s.status !== "CANCELLED"), [orgStories]);

  const filteredAvailable = useMemo(() =>
    available.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase())),
    [available, search],
  );

  const totalSP = inSprint.reduce((acc, s) => acc + (s.story_points ?? 0), 0);

  const PRIORITY_DOT: Record<string, string> = {
    CRITICAL: "bg-red-500", HIGH: "bg-orange-400", MEDIUM: "bg-amber-400", LOW: "bg-gray-300",
  };

  function StoryRow({ story, action, actionIcon: ActionIcon, actionLabel }: {
    story: BacklogItem;
    action: () => void;
    actionIcon: typeof ChevronRight;
    actionLabel: string;
  }) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 hover:shadow-sm transition-shadow">
        <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_DOT[story.priority] ?? PRIORITY_DOT.MEDIUM)} />
        <div className="flex-1 min-w-0">
          {story.code && <span className="text-[10px] font-mono text-muted-foreground mr-1">{story.code}</span>}
          <span className="text-xs font-medium">{story.title}</span>
          {story.parent_title && (
            <span className="text-[10px] text-muted-foreground ml-2">← {story.parent_title}</span>
          )}
        </div>
        {story.story_points != null && story.story_points > 0 && (
          <Badge variant="secondary" className="text-[10px] py-0 shrink-0">{story.story_points}p</Badge>
        )}
        <button
          onClick={action}
          className="shrink-0 p-1 rounded-md hover:bg-primary hover:text-primary-foreground transition-colors"
          title={actionLabel}
        >
          <ActionIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Available backlog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Backlog disponible</h3>
            <Badge variant="outline" className="text-[10px]">{filteredAvailable.length}</Badge>
          </div>
        </div>
        <input
          type="text"
          placeholder="Buscar historia…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {filteredAvailable.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {search ? "Sin resultados" : "No hay historias sin sprint asignado"}
            </p>
          ) : (
            filteredAvailable.map(s => (
              <StoryRow
                key={s.id} story={s}
                action={() => onAssign(s.id)}
                actionIcon={ChevronRight}
                actionLabel="Agregar al sprint"
              />
            ))
          )}
        </div>
      </div>

      {/* In this sprint */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">En este sprint</h3>
            <Badge className="text-[10px]">{inSprint.length} hist. · {totalSP} pts</Badge>
          </div>
        </div>
        <div className="space-y-1.5 max-h-[464px] overflow-y-auto pr-1">
          {inSprint.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Arrastra historias desde el backlog</p>
            </div>
          ) : (
            inSprint.map(s => (
              <StoryRow
                key={s.id} story={s}
                action={() => onUnassign(s.id)}
                actionIcon={ChevronLeft}
                actionLabel="Quitar del sprint"
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SprintsPage() {
  const t = useTranslations("pages.sprints");
  const { data: cycle } = useActiveCycle();

  const [viewMode, setViewMode]           = useState<ViewMode>("board");
  const [formOpen, setFormOpen]           = useState(false);
  const [generateOpen, setGenerateOpen]   = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [editingStory, setEditingStory]   = useState<BacklogItem | null>(null);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [closeWizardOpen, setCloseWizard] = useState(false);

  const { data: allSprints = [], isLoading } = useSprints({ cycle_id: cycle?.id });
  const activeSprint = allSprints.find((s) => s.status === "ACTIVE");
  const effectiveId  = selectedId ?? activeSprint?.sprint_id ?? null;

  const { data: board }         = useSprintBoard(effectiveId);
  const { data: timeline = [] } = useSprintTimeline(cycle?.id ?? null);
  const { data: burnup = [] }   = useBurnup(cycle?.id ?? null, board?.team_id ?? null);
  const { data: velocity = [] } = useSprintVelocity(board?.team_id ?? null);

  // Stories for sprint board (assigned to this sprint)
  const { data: sprintStories = [] } = useBacklogList(
    effectiveId ? { type: "STORY", sprint_id: effectiveId } : undefined,
  );

  // All org stories for planning / edit parent picker
  const { data: allStories = [] } = useBacklogList(
    viewMode === "planning" || editingStory ? { type: "STORY" } : undefined,
  );
  const { data: allFlatItems = [] } = useBacklogList(editingStory ? {} : undefined);
  const { data: initiatives = [] }  = useInitiatives(cycle?.id ? { cycle_id: cycle.id } : undefined);

  const confirm        = useConfirm();
  const updateBacklog  = useUpdateBacklogItem();
  const activateSprint = useActivateSprint();
  const deleteSprint   = useDeleteSprint();

  function handleSelect(id: string) {
    setSelectedId(id === selectedId ? null : id);
  }

  const selectedSprint = allSprints.find((s) => s.sprint_id === effectiveId);
  const canActivate    = selectedSprint?.status === "PLANNING";
  const canClose       = selectedSprint?.status === "ACTIVE";

  function handleAssignStory(storyId: string) {
    if (!effectiveId) return;
    updateBacklog.mutate({ id: storyId, sprint_id: effectiveId });
  }

  function handleUnassignStory(storyId: string) {
    updateBacklog.mutate({ id: storyId, sprint_id: null });
  }

  function openEdit(sprint: Sprint) {
    setEditingSprint(sprint);
    setFormOpen(true);
  }

  function openNew() {
    setEditingSprint(null);
    setFormOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={cycle ? `Ciclo: ${cycle.name}` : t("noCycle")}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setGenerateOpen(true)} size="sm" className="gap-1.5" disabled={!cycle}>
              <RefreshCw className="h-4 w-4" />
              {t("generateSprints")}
            </Button>
            <Button onClick={openNew} size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Manual
            </Button>
          </div>
        }
      />

      {!cycle ? (
        <EmptyState
          icon={Zap}
          title={t("noCycle")}
          description={t("noCycleDesc")}
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : allSprints.length === 0 ? (
        <EmptyState
          icon={Zap}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          actionLabel={t("generateSprints")}
          onAction={() => setGenerateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

          {/* Sidebar sprint list */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Sprints del ciclo ({allSprints.length})
            </p>
            {allSprints.map((s) => (
              <SprintCard
                key={s.sprint_id}
                sprint={s}
                selected={s.sprint_id === effectiveId}
                onSelect={() => handleSelect(s.sprint_id)}
                onEdit={() => openEdit(s)}
              />
            ))}
          </div>

          {/* Main area */}
          <div className="space-y-4 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: "board",    labelKey: "viewBoard",    icon: BarChart2  },
                { id: "planning", labelKey: "viewPlanning", icon: ListTodo   },
                { id: "timeline", labelKey: "viewTimeline", icon: Map        },
                { id: "charts",   labelKey: "viewCharts",   icon: TrendingUp },
              ].map(({ id, labelKey, icon: Icon }) => (
                <Button
                  key={id}
                  variant={viewMode === id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode(id as ViewMode)}
                  className="gap-1.5"
                >
                  <Icon className="h-4 w-4" />
                  {t(labelKey as Parameters<typeof t>[0])}
                </Button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                {canActivate && (
                  <Button
                    size="sm" variant="outline" className="gap-1.5 text-primary border-primary/50"
                    onClick={() => activateSprint.mutate(selectedSprint!.sprint_id)}
                    disabled={activateSprint.isPending}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {t("activate")}
                  </Button>
                )}
                {canClose && board && (
                  <Button
                    size="sm" variant="outline" className="gap-1.5 text-green-600 border-green-600/50"
                    onClick={() => setCloseWizard(true)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Cerrar sprint
                  </Button>
                )}
                {selectedSprint?.status === "PLANNING" && (
                  <Button
                    size="sm" variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `¿Eliminar "${selectedSprint.sprint_name}"?`,
                        description: "Se eliminará el sprint y se desasignarán todas sus historias. Esta acción no se puede deshacer.",
                        confirmLabel: "Eliminar sprint",
                        variant: "destructive",
                      });
                      if (!ok) return;
                      deleteSprint.mutate(selectedSprint.sprint_id);
                      setSelectedId(null);
                    }}
                    disabled={deleteSprint.isPending}
                    title="Eliminar sprint"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Views */}
            {viewMode === "board" && (
              <>
                {board ? (
                  <SprintBoardView board={board} stories={sprintStories} onEdit={setEditingStory} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">{t("selectSprint")}</p>
                  </div>
                )}
              </>
            )}

            {viewMode === "planning" && (
              <>
                {effectiveId ? (
                  <SprintPlanningView
                    sprintId={effectiveId}
                    orgStories={allStories}
                    onAssign={handleAssignStory}
                    onUnassign={handleUnassignStory}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <ListTodo className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">{t("selectSprint")}</p>
                  </div>
                )}
              </>
            )}

            {viewMode === "timeline" && (
              <SprintTimeline sprints={timeline} />
            )}

            {viewMode === "charts" && board && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-sm font-semibold mb-4">{t("burnup")}</p>
                  <BurnupChart data={burnup} />
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-semibold mb-4">{t("velocity")}</p>
                  <VelocityChart data={velocity as Sprint[]} />
                </Card>
              </div>
            )}

            {viewMode === "charts" && !board && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("selectSprint")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <SprintForm
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingSprint(null); }}
        editing={editingSprint}
      />

      {closeWizardOpen && board && (
        <SprintCloseWizard
          open={closeWizardOpen}
          onOpenChange={setCloseWizard}
          sprint={board}
        />
      )}

      {generateOpen && cycle && (
        <GenerateSprintsDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          cycle={cycle}
        />
      )}

      {editingStory && (
        <BacklogItemDialog
          open={!!editingStory}
          onClose={() => setEditingStory(null)}
          editing={editingStory}
          initiatives={initiatives as any[]}
          allItems={allFlatItems}
          cycleId={cycle?.id}
        />
      )}
    </div>
  );
}
