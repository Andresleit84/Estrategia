"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Pencil, X, Check, ChevronDown, ChevronRight,
  Flag, Compass, Building2, GitBranch, PenLine, Link2,
  UsersRound, CheckCircle2, Megaphone, LayoutGrid, MonitorPlay,
  CalendarRange, ArrowRight, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useCycles } from "@/hooks/useCycles";
import {
  usePlanningSessions, useCreatePlanningSession, useUpdatePlanningSession, useDeletePlanningSession,
  type PlanningSession,
} from "@/hooks/usePlanningSessions";
import {
  usePlanningItems, useUpsertPlanningItem, useMovePlanningItem, useDeletePlanningItem,
  usePlanningDependencies, useUpsertDependency, useDeleteDependency,
  usePlanningCapacity, useUpsertCapacity, useDeleteCapacity,
  type PlanningItem, type PlanningDependency, type PlanningCapacity,
} from "@/hooks/usePlanningItems";

// ─── Constants ────────────────────────────────────────────────────────────────

const RTN_STAGES = [
  { num: 1,  title: "Cierre del CT Anterior",         shortTitle: "Cierre",      icon: Flag,          description: "Retrospectiva del ciclo anterior. Métricas, lecciones aprendidas y accionables.", duration: "2–2.5h",   participants: "Comité Gerencial + Consejo", type: "kanban" },
  { num: 2,  title: "Foco Estratégico",                shortTitle: "Estrategia",  icon: Compass,       description: "Revisión de OKRs anuales y priorización trimestral con criterios de impacto/esfuerzo.", duration: "2 días",   participants: "Directiva · POs · Líderes", type: "kanban" },
  { num: 3,  title: "Reunión Ejecutiva",               shortTitle: "Ejecutiva",   icon: Building2,     description: "Alineación del Comité N-1. Cronograma y compromisos de alto nivel.", duration: "30–45min", participants: "VPs · Directores · Gerentes", type: "kanban" },
  { num: 4,  title: "Reunión Operativa",               shortTitle: "Operativa",   icon: GitBranch,     description: "Trazabilidad OKR → Épica → Historia. Configuración de herramienta.", duration: "2–2.5h",   participants: "POs · Líderes Técnicos", type: "kanban" },
  { num: 5,  title: "Redacción de Objetivos",          shortTitle: "Objetivos",   icon: PenLine,       description: "Objetivos trimestrales SMART. Plan de medición por KR.", duration: "2h/sesión", participants: "Dueños de Objetivos", type: "kanban" },
  { num: 6,  title: "Mapeo de Interdependencias",      shortTitle: "Dependencias",icon: Link2,         description: "Mapa de dependencias entre áreas. Acuerdos y plan de escalación.", duration: "3h",      participants: "Dueños · POs · Líderes", type: "dependencies" },
  { num: 7,  title: "Definición de Capacidad",         shortTitle: "Capacidad",   icon: UsersRound,    description: "Capacidad real disponible por objetivo. Plan de distribución temporal.", duration: "2h",      participants: "Líderes de Equipo · SMs", type: "capacity" },
  { num: 8,  title: "Validación Final",                shortTitle: "Validación",  icon: CheckCircle2,  description: "Cierre y aprobación integral del ciclo. Acta firmada por el Comité.", duration: "2h",      participants: "Directiva · Aprobadores", type: "kanban" },
  { num: 9,  title: "Socialización",                   shortTitle: "Comunica",    icon: Megaphone,     description: "Comunicación oficial del plan a toda la organización.", duration: "2h",      participants: "Toda la organización", type: "kanban" },
  { num: 10, title: "Big Room Planning",               shortTitle: "BRP",         icon: LayoutGrid,    description: "Sprint 1 100% listo. Sprint 2 en draft. 25–30 historias ready.", duration: "2h",      participants: "Todos los equipos", type: "kanban" },
  { num: 11, title: "Demo Day + Onboarding",           shortTitle: "Demo Day",    icon: MonitorPlay,   description: "Demostración de capacidades. Feedback documentado. Onboarding del equipo.", duration: "2h",      participants: "Toda la organización", type: "kanban" },
] as const;

const COLS = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
type ColStatus = typeof COLS[number];

const COL_LABEL: Record<ColStatus, string> = {
  TODO:        "Pendiente",
  IN_PROGRESS: "En curso",
  DONE:        "Listo",
  BLOCKED:     "Bloqueado",
};
const COL_ACCENT: Record<ColStatus, string> = {
  TODO:        "border-zinc-300 dark:border-zinc-700",
  IN_PROGRESS: "border-blue-400",
  DONE:        "border-emerald-400",
  BLOCKED:     "border-red-400",
};
const COL_BADGE: Record<ColStatus, string> = {
  TODO:        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  DONE:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  BLOCKED:     "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  ARTIFACT: "Artefacto", ACTION: "Acción", DECISION: "Decisión", RISK: "Riesgo",
};
const ITEM_TYPE_COLOR: Record<string, string> = {
  ARTIFACT: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  ACTION:   "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  DECISION: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  RISK:     "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

const SESSION_TYPE_LABEL: Record<string, string> = {
  QUARTERLY: "Trimestral", ANNUAL: "Anual", PI: "PI Planning",
};
const SESSION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador", IN_PROGRESS: "En curso", COMPLETED: "Completado",
};
const SESSION_STATUS_COLOR: Record<string, string> = {
  DRAFT:       "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  COMPLETED:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
};

const DEP_STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierta", RESOLVED: "Resuelta", ESCALATED: "Escalada", DEFERRED: "Diferida",
};
const DEP_STATUS_COLOR: Record<string, string> = {
  OPEN:     "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  ESCALATED:"bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  DEFERRED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageDot(stageNum: number, current: number, selected: boolean) {
  if (selected)  return "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900";
  if (stageNum < current) return "bg-emerald-500 text-white";
  if (stageNum === current) return "bg-blue-500 text-white ring-2 ring-blue-200 dark:ring-blue-800";
  return "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400";
}

function sessionProgress(s: PlanningSession) {
  return s.total_items > 0 ? Math.round((s.done_items / s.total_items) * 100) : 0;
}

// ─── New Session Dialog ───────────────────────────────────────────────────────

function NewSessionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: cycles } = useCycles();
  const create = useCreatePlanningSession();
  const [name, setName]       = useState("");
  const [cycleId, setCycleId] = useState<string>("");
  const [type, setType]       = useState("QUARTERLY");
  const [desc, setDesc]       = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), cycle_id: cycleId || undefined, type, description: desc || undefined },
      { onSuccess: () => { onClose(); setName(""); setCycleId(""); setDesc(""); } },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva sesión RTN</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Nombre</label>
            <Input
              placeholder="ej. RTN Q3 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Ciclo</label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger><SelectValue placeholder="Sin ciclo" /></SelectTrigger>
              <SelectContent>
                {cycles?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Tipo</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                <SelectItem value="ANNUAL">Anual</SelectItem>
                <SelectItem value="PI">PI Planning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Descripción (opcional)</label>
            <Textarea
              rows={2}
              placeholder="Contexto o notas adicionales..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Session Card (left panel) ────────────────────────────────────────────────

function SessionCard({
  session, selected, onClick, onDelete,
}: {
  session: PlanningSession;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const pct = sessionProgress(session);
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative w-full text-left p-3 rounded-xl border cursor-pointer transition-all",
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700",
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="pr-6">
        <p className="font-medium text-sm leading-tight">{session.name}</p>
        {session.cycle_name && (
          <p className="text-xs text-zinc-500 mt-0.5">{session.cycle_name}</p>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", SESSION_STATUS_COLOR[session.status])}>
          {SESSION_STATUS_LABEL[session.status]}
        </span>
        <span className="text-[10px] text-zinc-500">
          {SESSION_TYPE_LABEL[session.type]}
        </span>
      </div>

      {session.total_items > 0 && (
        <div className="mt-2.5">
          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
            <span>{pct}% completo</span>
            <span>etapa {session.current_stage}/11</span>
          </div>
        </div>
      )}

      {session.blocked_items > 0 && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-500">
          <AlertTriangle className="h-3 w-3" />
          <span>{session.blocked_items} bloqueado{session.blocked_items > 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Item Card ─────────────────────────────────────────────────────────

function ItemCard({
  item, onEdit, onDelete, onDragStart,
}: {
  item: PlanningItem;
  onEdit: (item: PlanningItem) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(item.id)}
      className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onEdit(item)}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {item.description && (
        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{item.description}</p>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", ITEM_TYPE_COLOR[item.item_type])}>
          {ITEM_TYPE_LABEL[item.item_type]}
        </span>
        {item.assignee && (
          <span className="text-[10px] text-zinc-500 truncate max-w-[100px]">{item.assignee}</span>
        )}
        {item.due_date && (
          <span className="text-[10px] text-zinc-500">
            {new Date(item.due_date).toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Upsert Item Dialog ───────────────────────────────────────────────────────

function ItemDialog({
  open, onClose, sessionId, stageNum, item,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  stageNum: number;
  item: PlanningItem | null;
}) {
  const upsert = useUpsertPlanningItem(sessionId, stageNum);
  const [title, setTitle]       = useState(item?.title ?? "");
  const [desc, setDesc]         = useState(item?.description ?? "");
  const [assignee, setAssignee] = useState(item?.assignee ?? "");
  const [dueDate, setDueDate]   = useState(item?.due_date?.slice(0, 10) ?? "");
  const [status, setStatus]     = useState<string>(item?.status ?? "TODO");
  const [type, setType]         = useState<string>(item?.item_type ?? "ARTIFACT");

  function reset() { setTitle(""); setDesc(""); setAssignee(""); setDueDate(""); setStatus("TODO"); setType("ARTIFACT"); }

  function handleSubmit() {
    if (!title.trim()) return;
    upsert.mutate(
      {
        id: item?.id,
        session_id: sessionId,
        stage: stageNum,
        title: title.trim(),
        description: desc || undefined,
        assignee: assignee || undefined,
        due_date: dueDate || undefined,
        status: status as PlanningItem["status"],
        item_type: type as PlanningItem["item_type"],
      },
      {
        onSuccess: () => { onClose(); reset(); },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Editar artefacto" : "Nuevo artefacto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input placeholder="Título *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={2} placeholder="Descripción" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEM_TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLS.map((c) => (
                    <SelectItem key={c} value={c}>{COL_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Responsable</label>
              <Input className="h-8 text-xs" placeholder="Nombre" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Fecha límite</label>
              <Input type="date" className="h-8 text-xs" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {item ? "Guardar" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ sessionId, stageNum }: { sessionId: string; stageNum: number }) {
  const { data: items = [], isLoading } = usePlanningItems(sessionId, stageNum);
  const move   = useMovePlanningItem(sessionId, stageNum);
  const del    = useDeletePlanningItem(sessionId, stageNum);
  const [dragId, setDragId]         = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState<string | null>(null);
  const [editItem, setEditItem]     = useState<PlanningItem | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [newCol, setNewCol]         = useState<ColStatus>("TODO");

  function handleDrop(e: React.DragEvent, status: ColStatus) {
    e.preventDefault();
    if (dragId && status !== items.find((i) => i.id === dragId)?.status) {
      move.mutate({ id: dragId, status });
    }
    setDragId(null);
    setDragOver(null);
  }

  function openNew(col: ColStatus) { setNewCol(col); setShowNew(true); }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {COLS.map((col) => {
          const colItems = items.filter((i) => i.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, col)}
              className={cn(
                "flex flex-col rounded-xl border-2 bg-zinc-50 dark:bg-zinc-900/50 min-h-[200px] transition-colors",
                dragOver === col ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" : COL_ACCENT[col],
              )}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", COL_BADGE[col])}>
                    {COL_LABEL[col]}
                  </span>
                  {colItems.length > 0 && (
                    <span className="text-xs text-zinc-500">{colItems.length}</span>
                  )}
                </div>
                <button
                  onClick={() => openNew(col)}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 px-2.5 pb-2.5 space-y-2">
                {colItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onEdit={(i) => setEditItem(i)}
                    onDelete={(id) => del.mutate(id)}
                    onDragStart={(id) => setDragId(id)}
                  />
                ))}
                {colItems.length === 0 && (
                  <button
                    onClick={() => openNew(col)}
                    className="w-full py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-colors"
                  >
                    + Agregar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ItemDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        sessionId={sessionId}
        stageNum={stageNum}
        item={null}
      />
      {editItem && (
        <ItemDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          sessionId={sessionId}
          stageNum={stageNum}
          item={editItem}
        />
      )}
    </>
  );
}

// ─── Dependencies Panel ───────────────────────────────────────────────────────

function DependenciesPanel({ session }: { session: PlanningSession }) {
  const { data: deps = [] } = usePlanningDependencies(session.id);
  const upsert = useUpsertDependency(session.id);
  const del    = useDeleteDependency(session.id);
  const [editing, setEditing]     = useState<PlanningDependency | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [fromArea, setFromArea]   = useState("");
  const [toArea, setToArea]       = useState("");
  const [desc, setDesc]           = useState("");
  const [status, setStatus]       = useState("OPEN");
  const [owner, setOwner]         = useState("");

  function openEdit(d: PlanningDependency) {
    setEditing(d); setFromArea(d.from_area); setToArea(d.to_area);
    setDesc(d.description ?? ""); setStatus(d.status); setOwner(d.owner ?? "");
    setShowForm(true);
  }

  function reset() {
    setEditing(null); setFromArea(""); setToArea("");
    setDesc(""); setStatus("OPEN"); setOwner("");
    setShowForm(false);
  }

  function handleSave() {
    if (!fromArea.trim() || !toArea.trim()) return;
    upsert.mutate(
      { id: editing?.id, session_id: session.id, from_area: fromArea, to_area: toArea,
        description: desc || undefined, status, owner: owner || undefined },
      { onSuccess: reset },
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">Mapa de interdependencias</h4>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nueva dependencia
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Área origen</label>
              <Input className="h-8 text-sm" placeholder="ej. TI" value={fromArea} onChange={(e) => setFromArea(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Área destino</label>
              <Input className="h-8 text-sm" placeholder="ej. Negocios" value={toArea} onChange={(e) => setToArea(e.target.value)} />
            </div>
          </div>
          <Input className="text-sm" placeholder="Descripción de la dependencia" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DEP_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-8 text-xs" placeholder="Responsable" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={!fromArea || !toArea || upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span className="ml-1">{editing ? "Guardar" : "Agregar"}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={reset}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      {deps.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 text-sm border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
          Sin dependencias registradas
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/70">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Origen</th>
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-zinc-500">→</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Destino</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Descripción</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Responsable</th>
                <th className="px-4 py-2.5 text-right text-xs" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {deps.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-sm">{d.from_area}</td>
                  <td className="px-2 py-2.5 text-center text-zinc-400"><ArrowRight className="h-4 w-4 mx-auto" /></td>
                  <td className="px-4 py-2.5 font-medium text-sm">{d.to_area}</td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 text-sm max-w-[200px] truncate">{d.description ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", DEP_STATUS_COLOR[d.status])}>
                      {DEP_STATUS_LABEL[d.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{d.owner ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => del.mutate(d.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Capacity Panel ───────────────────────────────────────────────────────────

function CapacityPanel({ session }: { session: PlanningSession }) {
  const { data: rows = [] } = usePlanningCapacity(session.id);
  const upsert = useUpsertCapacity(session.id);
  const del    = useDeleteCapacity(session.id);
  const [editing, setEditing]     = useState<PlanningCapacity | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [area, setArea]           = useState("");
  const [objTitle, setObjTitle]   = useState("");
  const [total, setTotal]         = useState("");
  const [alloc, setAlloc]         = useState("");
  const [notes, setNotes]         = useState("");

  const totalPeople    = rows.reduce((s, r) => s + r.total_people, 0);
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const avgAlloc = totalPeople > 0 ? Math.round((totalAllocated / totalPeople) * 100) : 0;

  function openEdit(r: PlanningCapacity) {
    setEditing(r); setArea(r.area); setObjTitle(r.objective_title ?? "");
    setTotal(String(r.total_people)); setAlloc(String(r.allocated)); setNotes(r.notes ?? "");
    setShowForm(true);
  }

  function reset() {
    setEditing(null); setArea(""); setObjTitle(""); setTotal(""); setAlloc(""); setNotes("");
    setShowForm(false);
  }

  function handleSave() {
    if (!area.trim()) return;
    upsert.mutate(
      { id: editing?.id, session_id: session.id, area, objective_title: objTitle || undefined,
        total_people: Number(total) || 0, allocated: Number(alloc) || 0, notes: notes || undefined },
      { onSuccess: reset },
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <h4 className="font-semibold text-sm">Tabla de capacidad</h4>
          {rows.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-zinc-500">{totalAllocated}/{totalPeople} personas</span>
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", avgAlloc >= 90 ? "bg-red-500" : avgAlloc >= 75 ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${avgAlloc}%` }}
                  />
                </div>
                <span className={cn("text-xs font-medium", avgAlloc >= 90 ? "text-red-600" : avgAlloc >= 75 ? "text-amber-600" : "text-emerald-600")}>
                  {avgAlloc}% asignado
                </span>
              </div>
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar área
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input className="text-sm" placeholder="Área *" value={area} onChange={(e) => setArea(e.target.value)} />
            <Input className="text-sm" placeholder="Objetivo" value={objTitle} onChange={(e) => setObjTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Personas disponibles</label>
              <Input type="number" className="h-8 text-sm" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Asignadas</label>
              <Input type="number" className="h-8 text-sm" min={0} value={alloc} onChange={(e) => setAlloc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Notas</label>
              <Input className="h-8 text-sm" placeholder="..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={!area || upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span className="ml-1">{editing ? "Guardar" : "Agregar"}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={reset}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 text-sm border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
          Sin datos de capacidad registrados
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/70">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Área</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Objetivo</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">Asignadas</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide w-48">Carga</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Notas</th>
                <th className="px-4 py-2.5 text-right text-xs" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((r) => {
                const pct = r.total_people > 0 ? Math.round((r.allocated / r.total_people) * 100) : 0;
                return (
                  <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{r.area}</td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 max-w-[160px] truncate">{r.objective_title ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center font-mono">{r.total_people}</td>
                    <td className="px-4 py-2.5 text-center font-mono">{r.allocated}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-medium w-8 text-right", pct >= 100 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-emerald-600")}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs">{r.notes ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => del.mutate(r.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Stage Panel ──────────────────────────────────────────────────────────────

function StagePanel({ session, stageNum }: { session: PlanningSession; stageNum: number }) {
  const stage = RTN_STAGES[stageNum - 1];
  const Icon  = stage.icon;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stage info bar */}
      <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-6">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm flex-shrink-0">
            <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-base">{stage.num}. {stage.title}</h3>
            <p className="text-sm text-zinc-500 mt-0.5">{stage.description}</p>
          </div>
        </div>
        <div className="flex gap-6 flex-shrink-0 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">Duración</p>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{stage.duration}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">Participantes</p>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{stage.participants}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {stage.type === "dependencies" && (
          <>
            <DependenciesPanel session={session} />
            <div>
              <p className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-200">Artefactos de la etapa</p>
              <KanbanBoard sessionId={session.id} stageNum={stageNum} />
            </div>
          </>
        )}
        {stage.type === "capacity" && (
          <>
            <CapacityPanel session={session} />
            <div>
              <p className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-200">Artefactos de la etapa</p>
              <KanbanBoard sessionId={session.id} stageNum={stageNum} />
            </div>
          </>
        )}
        {stage.type === "kanban" && <KanbanBoard sessionId={session.id} stageNum={stageNum} />}
      </div>
    </div>
  );
}

// ─── Session Detail ───────────────────────────────────────────────────────────

function SessionDetail({
  session,
  onStageAdvance,
}: {
  session: PlanningSession;
  onStageAdvance: (stage: number) => void;
}) {
  const [selectedStage, setSelectedStage] = useState(session.current_stage);
  const updateSession = useUpdatePlanningSession();
  const pct = sessionProgress(session);

  function advanceStage() {
    const next = Math.min(session.current_stage + 1, 11);
    updateSession.mutate({ id: session.id, current_stage: next }, {
      onSuccess: () => onStageAdvance(next),
    });
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
      {/* Session header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-lg leading-tight">{session.name}</h2>
              {session.cycle_name && (
                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                  {session.cycle_name}
                </span>
              )}
              <span className="text-xs bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                {SESSION_TYPE_LABEL[session.type]}
              </span>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", SESSION_STATUS_COLOR[session.status])}>
                {SESSION_STATUS_LABEL[session.status]}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-2 flex-1 max-w-[300px]">
                <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-zinc-500 flex-shrink-0">{pct}% completo</span>
              </div>
              {session.blocked_items > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {session.blocked_items} bloqueado{session.blocked_items > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {session.current_stage < 11 && session.status !== "COMPLETED" && (
            <Button size="sm" variant="outline" onClick={advanceStage} disabled={updateSession.isPending}>
              {updateSession.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ChevronRight className="h-3.5 w-3.5 mr-1.5" />}
              Avanzar etapa
            </Button>
          )}
        </div>
      </div>

      {/* Stage navigator */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <div className="flex gap-1.5 px-6 py-3 min-w-max">
            {RTN_STAGES.map((s) => {
              const Icon = s.icon;
              const isDone    = s.num < session.current_stage;
              const isCurrent = s.num === session.current_stage;
              const isSelected = s.num === selectedStage;
              return (
                <button
                  key={s.num}
                  onClick={() => setSelectedStage(s.num)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm"
                      : isDone
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-950/60"
                        : isCurrent
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-950/60 ring-1 ring-blue-300 dark:ring-blue-700"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700",
                  )}
                >
                  {isDone && !isSelected
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <Icon className="h-3 w-3" />
                  }
                  <span>{s.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stage content */}
      <div className="flex-1 min-h-0">
        <StagePanel session={session} stageNum={selectedStage} />
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl mb-4">
        <CalendarRange className="h-10 w-10 text-blue-500" />
      </div>
      <h3 className="font-semibold text-lg mb-1">Planificación RTN</h3>
      <p className="text-zinc-500 text-sm max-w-sm mb-6">
        Gestiona el proceso de Revisión Trimestral del Negocio con sus 11 etapas,
        desde el cierre del ciclo anterior hasta el Demo Day.
      </p>
      <Button onClick={onNew}>
        <Plus className="h-4 w-4 mr-2" /> Nueva sesión RTN
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { data: sessions = [], isLoading } = usePlanningSessions();
  const del = useDeletePlanningSession();
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [showNew, setShowNew]             = useState(false);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  function handleAdvanceStage(stage: number) {
    // Stage advanced on server; sessions will revalidate. Update selection stays same.
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando sesiones...
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white dark:bg-zinc-950">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm">Planificación RTN</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{sessions.length} sesión{sessions.length !== 1 ? "es" : ""}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.length === 0 && (
            <p className="text-center text-xs text-zinc-400 py-8">
              Sin sesiones. Crea la primera.
            </p>
          )}
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              selected={s.id === selectedId}
              onClick={() => setSelectedId(s.id)}
              onDelete={() => {
                del.mutate(s.id);
                if (selectedId === s.id) setSelectedId(null);
              }}
            />
          ))}
        </div>
      </div>

      {/* Right panel */}
      {selected ? (
        <SessionDetail
          key={selected.id}
          session={selected}
          onStageAdvance={handleAdvanceStage}
        />
      ) : (
        <EmptyState onNew={() => setShowNew(true)} />
      )}

      <NewSessionDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
