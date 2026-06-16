"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AiSuggestDeliveryDialog } from "@/components/delivery/AiSuggestDeliveryDialog";
import {
  useProgram, useUpdateProgram, useDeleteProgram,
  useCreatePhase, useUpdatePhase, useDeletePhase,
  useCreateDeliverable, useUpdateDeliverable, useDeleteDeliverable,
  type DeliveryPhase, type Deliverable,
  type ProgramStatus, type PhaseStatus, type DeliverableStatus,
} from "@/hooks/useDelivery";
import { useOrgUsers } from "@/hooks/useAreas";
import {
  ChevronLeft, ChevronRight, Plus, MoreHorizontal, Pencil, Trash2,
  CheckCircle2, Circle, Loader2, Ban, AlertTriangle,
  ChevronDown, ChevronUp, CalendarDays, User, FileText,
  Flag, StickyNote, Link2, Package2, Sparkles, Eye,
  LayoutList, Kanban,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Status meta ───────────────────────────────────────────────────────────────

const DELIVERABLE_STATUS: Record<DeliverableStatus, { label: string; icon: React.ElementType; color: string }> = {
  NOT_STARTED: { label: "No iniciado", icon: Circle,        color: "text-slate-400"  },
  IN_PROGRESS: { label: "En progreso", icon: Loader2,       color: "text-blue-500"   },
  IN_REVIEW:   { label: "En revisión", icon: Eye,           color: "text-amber-500"  },
  APPROVED:    { label: "Aprobado",    icon: CheckCircle2,  color: "text-green-500"  },
  BLOCKED:     { label: "Bloqueado",   icon: AlertTriangle, color: "text-red-500"    },
  CANCELLED:   { label: "Cancelado",   icon: Ban,           color: "text-slate-400"  },
};

const PHASE_STATUS: Record<PhaseStatus, { label: string; color: string }> = {
  PENDING:     { label: "Pendiente",   color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  IN_PROGRESS: { label: "En progreso", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  COMPLETED:   { label: "Completado",  color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  ON_HOLD:     { label: "En pausa",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
};

const PROGRAM_STATUS: Record<ProgramStatus, { label: string; color: string }> = {
  DRAFT:     { label: "Borrador",   color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  ACTIVE:    { label: "Activo",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  COMPLETED: { label: "Completado", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  ARCHIVED:  { label: "Archivado",  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function progressColor(pct: number) {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 40) return "bg-blue-500";
  return "bg-amber-500";
}

// ── Deliverable Form Dialog ───────────────────────────────────────────────────

interface DeliverableFormProps {
  open: boolean;
  onClose: () => void;
  programId: string;
  phaseId: string;
  initial?: Deliverable | null;
}

function DeliverableFormDialog({ open, onClose, programId, phaseId, initial }: DeliverableFormProps) {
  const create = useCreateDeliverable();
  const update = useUpdateDeliverable();
  const { data: users = [] } = useOrgUsers();

  const [title,               setTitle]               = useState("");
  const [description,         setDescription]         = useState("");
  const [acceptance_criteria, setAcceptanceCriteria]  = useState("");
  const [due_date,            setDueDate]             = useState("");
  const [status,              setStatus]              = useState<DeliverableStatus>("NOT_STARTED");
  const [document_url,        setDocumentUrl]         = useState("");
  const [notes,               setNotes]               = useState("");
  const [owner_id,            setOwnerId]             = useState("");

  const isEdit = !!initial;
  const busy   = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setAcceptanceCriteria(initial?.acceptance_criteria ?? "");
      setDueDate(initial?.due_date?.slice(0, 10) ?? "");
      setStatus(initial?.status ?? "NOT_STARTED");
      setDocumentUrl(initial?.document_url ?? "");
      setNotes(initial?.notes ?? "");
      setOwnerId(initial?.owner_id ?? "");
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      acceptance_criteria: acceptance_criteria.trim() || undefined,
      due_date: due_date || undefined,
      document_url: document_url.trim() || undefined,
      notes: notes.trim() || undefined,
      owner_id: owner_id || undefined,
      programId,
    };
    if (isEdit) {
      await update.mutateAsync({ delivId: initial!.id, ...payload, status });
    } else {
      await create.mutateAsync({ phaseId, ...payload });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        {/* Header con fondo sutil */}
        <div className="px-6 pt-5 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-base font-semibold mb-3">
            {isEdit ? "Editar entregable" : "Nuevo entregable"}
          </DialogTitle>
          <Input
            id="d-title"
            form="deliverable-form"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del entregable"
            required
            className="text-sm font-medium bg-background"
          />
        </div>

        <form id="deliverable-form" onSubmit={handleSubmit} className="overflow-y-auto max-h-[60vh]">
          {/* Sección: Meta */}
          <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Responsable</p>
              <Select id="d-owner" value={owner_id} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Fecha objetivo</p>
              <Input id="d-due" type="date" value={due_date} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Estado</p>
              <Select id="d-status" value={status} onChange={(e) => setStatus(e.target.value as DeliverableStatus)}>
                <option value="NOT_STARTED">No iniciado</option>
                <option value="IN_PROGRESS">En progreso</option>
                <option value="IN_REVIEW">En revisión</option>
                <option value="APPROVED">Aprobado</option>
                <option value="BLOCKED">Bloqueado</option>
                <option value="CANCELLED">Cancelado</option>
              </Select>
            </div>
          </div>

          {/* Sección: Contenido */}
          <div className="px-6 py-4 space-y-3 border-b">
            <div className="space-y-1.5">
              <Label htmlFor="d-desc" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descripción</Label>
              <Textarea
                id="d-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿Qué incluye este entregable?"
                rows={3}
                className="resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-criteria" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Criterio de aceptación</Label>
              <Textarea
                id="d-criteria"
                value={acceptance_criteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                placeholder="¿Cuándo se considera listo?"
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          {/* Sección: Referencias y notas */}
          <div className="px-6 py-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="d-doc" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Enlace al documento
              </Label>
              <Input
                id="d-doc"
                type="url"
                value={document_url}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-notes" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> Notas
              </Label>
              <Textarea
                id="d-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones adicionales..."
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>
        </form>

        <div className="px-6 py-3 border-t bg-muted/30 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button form="deliverable-form" type="submit" size="sm" disabled={busy || !title.trim()}>
            {busy ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear entregable"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Phase Form Dialog ─────────────────────────────────────────────────────────

interface PhaseFormProps {
  open: boolean;
  onClose: () => void;
  programId: string;
  initial?: DeliveryPhase | null;
}

function PhaseFormDialog({ open, onClose, programId, initial }: PhaseFormProps) {
  const create = useCreatePhase();
  const update = useUpdatePhase();
  const { data: users = [] } = useOrgUsers();

  const [name,              setName]          = useState("");
  const [description,       setDescription]   = useState("");
  const [gate_criteria,     setGateCriteria]  = useState("");
  const [target_start_date, setStartDate]     = useState("");
  const [target_end_date,   setEndDate]       = useState("");
  const [status,            setStatus]        = useState<PhaseStatus>("PENDING");
  const [owner_id,          setOwnerId]       = useState("");

  const isEdit = !!initial;
  const busy   = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setGateCriteria(initial?.gate_criteria ?? "");
      setStartDate(initial?.target_start_date?.slice(0, 10) ?? "");
      setEndDate(initial?.target_end_date?.slice(0, 10) ?? "");
      setStatus(initial?.status ?? "PENDING");
      setOwnerId(initial?.owner_id ?? "");
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      gate_criteria: gate_criteria.trim() || undefined,
      target_start_date: target_start_date || undefined,
      target_end_date: target_end_date || undefined,
      owner_id: owner_id || undefined,
      programId,
    };
    if (isEdit) {
      await update.mutateAsync({ phaseId: initial!.id, ...payload, status });
    } else {
      await create.mutateAsync({ ...payload });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar fase" : "Nueva fase"}</DialogTitle>
        </DialogHeader>

        <form id="phase-form" onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="ph-name">Nombre *</Label>
            <Input
              id="ph-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Fase 1 — Definición Estratégica"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ph-owner">
                <User className="inline h-3 w-3 mr-1" />
                Responsable
              </Label>
              <Select id="ph-owner" value={owner_id} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </div>
            {isEdit ? (
              <div className="space-y-1.5">
                <Label htmlFor="ph-status">Estado</Label>
                <Select id="ph-status" value={status} onChange={(e) => setStatus(e.target.value as PhaseStatus)}>
                  <option value="PENDING">Pendiente</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="COMPLETED">Completado</option>
                  <option value="ON_HOLD">En pausa</option>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="ph-start">Fecha inicio</Label>
                <Input id="ph-start" type="date" value={target_start_date} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            )}
          </div>

          {isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ph-start">Fecha inicio</Label>
                <Input id="ph-start" type="date" value={target_start_date} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph-end">Fecha fin</Label>
                <Input id="ph-end" type="date" value={target_end_date} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="ph-end">Fecha fin</Label>
              <Input id="ph-end" type="date" value={target_end_date} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ph-desc">Descripción</Label>
            <Textarea
              id="ph-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="¿Qué cubre esta fase?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ph-gate">
              <Flag className="inline h-3 w-3 mr-1" />
              Criterio de cierre
            </Label>
            <Textarea
              id="ph-gate"
              value={gate_criteria}
              onChange={(e) => setGateCriteria(e.target.value)}
              rows={2}
              placeholder="¿Qué debe estar listo para pasar a la siguiente fase?"
            />
          </div>
        </form>

        <DialogFooter className="-mb-4 -mx-4 px-4 py-3 border-t bg-muted/40 rounded-b-xl">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button form="phase-form" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear fase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Deliverable Row ───────────────────────────────────────────────────────────

interface DeliverableRowProps {
  deliv: Deliverable;
  programId: string;
  onEdit: (d: Deliverable) => void;
  onDelete: (d: Deliverable) => void;
  onStatusChange: (d: Deliverable, s: DeliverableStatus) => void;
}

function DeliverableRow({ deliv, programId, onEdit, onDelete, onStatusChange }: DeliverableRowProps) {
  const meta = DELIVERABLE_STATUS[deliv.status];
  const Icon = meta.icon;
  const isOverdue = deliv.due_date
    ? new Date(deliv.due_date) < new Date() && deliv.status !== "APPROVED" && deliv.status !== "CANCELLED"
    : false;

  return (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
      {/* status icon — click to cycle */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn("mt-0.5 shrink-0 transition-transform hover:scale-110 outline-none", meta.color)}
          title={meta.label}
        >
          <Icon className={cn("h-4 w-4", deliv.status === "IN_PROGRESS" && "animate-spin")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.entries(DELIVERABLE_STATUS) as [DeliverableStatus, typeof meta][]).map(([s, m]) => {
            const SI = m.icon;
            return (
              <DropdownMenuItem key={s} onClick={() => onStatusChange(deliv, s)}>
                <SI className={cn("h-3.5 w-3.5 mr-2", m.color)} />
                {m.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium text-foreground leading-snug",
          deliv.status === "APPROVED" && "line-through text-muted-foreground",
          deliv.status === "CANCELLED" && "line-through text-muted-foreground/50",
        )}>
          {deliv.title}
        </p>
        {deliv.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{deliv.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {deliv.due_date && (
            <span className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
              <CalendarDays className="h-3 w-3" />
              {isOverdue && "Vencido · "}{fmtDate(deliv.due_date)}
            </span>
          )}
          {deliv.owner_name && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {deliv.owner_name}
            </span>
          )}
          {deliv.document_url && (
            <a
              href={deliv.document_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <FileText className="h-3 w-3" />
              Ver documento
            </a>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(deliv)}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(deliv)} variant="destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Phase Accordion ───────────────────────────────────────────────────────────

interface PhaseAccordionProps {
  phase: DeliveryPhase;
  programId: string;
  index: number;
  onEditPhase: (p: DeliveryPhase) => void;
  onDeletePhase: (p: DeliveryPhase) => void;
  onAddDeliverable: (phaseId: string) => void;
  onEditDeliverable: (d: Deliverable, phaseId: string) => void;
  onDeleteDeliverable: (d: Deliverable, phaseId: string) => void;
}

function PhaseAccordion({
  phase, programId, index,
  onEditPhase, onDeletePhase,
  onAddDeliverable, onEditDeliverable, onDeleteDeliverable,
}: PhaseAccordionProps) {
  const [open, setOpen] = useState(true);
  const updateDeliv = useUpdateDeliverable();
  const phaseMeta   = PHASE_STATUS[phase.status];
  const pct         = Math.round(phase.completion_pct ?? 0);

  function handleStatusChange(d: Deliverable, s: DeliverableStatus) {
    updateDeliv.mutate({ delivId: d.id, programId, status: s });
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Phase header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {/* number */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{phase.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", phaseMeta.color)}>
              {phaseMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {(phase.target_start_date || phase.target_end_date) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {fmtDate(phase.target_start_date)} — {fmtDate(phase.target_end_date) ?? "Sin fecha"}
              </span>
            )}
            {phase.owner_name && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {phase.owner_name}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {phase.completed_count}/{phase.deliverable_count} entregables
            </span>
          </div>
        </div>

        {/* mini progress bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 w-28">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", progressColor(pct))}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold w-8 text-right text-muted-foreground">{pct}%</span>
        </div>

        {/* actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors"
            title="Agregar entregable"
            onClick={() => onAddDeliverable(phase.id)}
          >
            <Plus className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditPhase(phase)}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar fase
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeletePhase(phase)} variant="destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar fase
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Gate criteria banner */}
      {open && phase.gate_criteria && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 px-3 py-2">
          <Flag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-px shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Criterio de cierre:</span> {phase.gate_criteria}
          </p>
        </div>
      )}

      {/* Deliverables */}
      {open && (
        <div className="border-t divide-y divide-border/50">
          {phase.deliverables.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-muted-foreground">Sin entregables en esta fase.</p>
              <Button variant="outline" size="sm" onClick={() => onAddDeliverable(phase.id)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar entregable
              </Button>
            </div>
          ) : (
            <>
              {phase.deliverables.map((d) => (
                <DeliverableRow
                  key={d.id}
                  deliv={d}
                  programId={programId}
                  onEdit={(deliv) => onEditDeliverable(deliv, phase.id)}
                  onDelete={(deliv) => onDeleteDeliverable(deliv, phase.id)}
                  onStatusChange={handleStatusChange}
                />
              ))}
              <div className="px-3 py-2">
                <button
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                  onClick={() => onAddDeliverable(phase.id)}
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar entregable
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

interface KanbanCardProps {
  deliv: Deliverable;
  programId: string;
  onEdit: (d: Deliverable) => void;
  onDelete: (d: Deliverable) => void;
  onStatusChange: (d: Deliverable, s: DeliverableStatus) => void;
}

function KanbanCard({ deliv, onEdit, onDelete, onStatusChange }: KanbanCardProps) {
  const isOverdue = deliv.due_date
    ? new Date(deliv.due_date) < new Date() && deliv.status !== "APPROVED" && deliv.status !== "CANCELLED"
    : false;

  return (
    <div className="group rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className={cn(
          "text-xs font-medium text-foreground leading-snug flex-1",
          deliv.status === "APPROVED" && "line-through text-muted-foreground",
          deliv.status === "CANCELLED" && "line-through text-muted-foreground/50",
        )}>
          {deliv.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted transition outline-none">
            <MoreHorizontal className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => onEdit(deliv)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </DropdownMenuItem>
            {(() => {
              const next = getNextDeliverableStatus(deliv.status);
              const prev = getPrevDeliverableStatus(deliv.status);
              return (
                <>
                  <DropdownMenuSeparator />
                  {next && (
                    <DropdownMenuItem onClick={() => onStatusChange(deliv, next)}>
                      <ChevronRight className="h-3.5 w-3.5 text-blue-600" />
                      Avanzar → {DELIVERABLE_STATUS[next].label}
                    </DropdownMenuItem>
                  )}
                  {prev && (
                    <DropdownMenuItem onClick={() => onStatusChange(deliv, prev)}>
                      <ChevronLeft className="h-3.5 w-3.5 text-amber-600" />
                      Retroceder → {DELIVERABLE_STATUS[prev].label}
                    </DropdownMenuItem>
                  )}
                  {deliv.status !== "BLOCKED" && (
                    <DropdownMenuItem onClick={() => onStatusChange(deliv, "BLOCKED")} className="text-muted-foreground focus:text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Marcar bloqueado
                    </DropdownMenuItem>
                  )}
                  {deliv.status !== "CANCELLED" && (
                    <DropdownMenuItem onClick={() => onStatusChange(deliv, "CANCELLED")} className="text-muted-foreground focus:text-muted-foreground">
                      <Ban className="h-3.5 w-3.5" /> Cancelar
                    </DropdownMenuItem>
                  )}
                </>
              );
            })()}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(deliv)} variant="destructive">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {deliv.due_date && (
          <span className={cn("flex items-center gap-1 text-[10px]", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
            <CalendarDays className="h-3 w-3" />
            {fmtDate(deliv.due_date)}
          </span>
        )}
        {deliv.owner_name && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="h-3 w-3" />
            {deliv.owner_name}
          </span>
        )}
        {deliv.document_url && (
          <a
            href={deliv.document_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <FileText className="h-3 w-3" />
            Doc
          </a>
        )}
      </div>
    </div>
  );
}

// ── Kanban View ───────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: DeliverableStatus[] = [
  "NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "APPROVED", "BLOCKED", "CANCELLED",
];

const DELIVERABLE_STATUS_FLOW: DeliverableStatus[] = ["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "APPROVED"];
function getNextDeliverableStatus(s: DeliverableStatus): DeliverableStatus | null {
  const i = DELIVERABLE_STATUS_FLOW.indexOf(s);
  return i >= 0 && i < DELIVERABLE_STATUS_FLOW.length - 1 ? DELIVERABLE_STATUS_FLOW[i + 1] : null;
}
function getPrevDeliverableStatus(s: DeliverableStatus): DeliverableStatus | null {
  if (s === "BLOCKED" || s === "CANCELLED") return "IN_PROGRESS";
  const i = DELIVERABLE_STATUS_FLOW.indexOf(s);
  return i > 0 ? DELIVERABLE_STATUS_FLOW[i - 1] : null;
}

interface KanbanViewProps {
  phases: DeliveryPhase[];
  programId: string;
  onEditPhase: (p: DeliveryPhase) => void;
  onDeletePhase: (p: DeliveryPhase) => void;
  onAddDeliverable: (phaseId: string) => void;
  onEditDeliverable: (d: Deliverable, phaseId: string) => void;
  onDeleteDeliverable: (d: Deliverable, phaseId: string) => void;
}

function KanbanView({
  phases, programId,
  onEditPhase, onDeletePhase,
  onAddDeliverable, onEditDeliverable, onDeleteDeliverable,
}: KanbanViewProps) {
  const updateDeliv = useUpdateDeliverable();
  const [draggingDeliv, setDraggingDeliv] = useState<Deliverable | null>(null);
  const [dropTarget, setDropTarget] = useState<{ phaseId: string; status: DeliverableStatus } | null>(null);

  function handleStatusChange(d: Deliverable, s: DeliverableStatus) {
    updateDeliv.mutate({ delivId: d.id, programId, status: s });
  }

  if (phases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center">
        <p className="text-sm text-muted-foreground">Sin fases. Cambia a vista lista para crear la primera fase.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {phases.map((phase, i) => {
        const phaseMeta = PHASE_STATUS[phase.status];
        const pct = Math.round(phase.completion_pct ?? 0);
        return (
          <div key={phase.id} className="space-y-3">
            {/* Phase header */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </div>
              <span className="text-sm font-semibold text-foreground">{phase.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", phaseMeta.color)}>
                {phaseMeta.label}
              </span>
              <div className="hidden sm:flex items-center gap-1.5 ml-1">
                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full", progressColor(pct))} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{pct}%</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors"
                  title="Agregar entregable"
                  onClick={() => onAddDeliverable(phase.id)}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditPhase(phase)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Editar fase
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDeletePhase(phase)} variant="destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar fase
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Gate criteria banner */}
            {phase.gate_criteria && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 px-3 py-2">
                <Flag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-px shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Criterio de cierre:</span> {phase.gate_criteria}
                </p>
              </div>
            )}

            {/* Kanban columns */}
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
              {KANBAN_COLUMNS.map((colStatus) => {
                const colMeta = DELIVERABLE_STATUS[colStatus];
                const ColIcon = colMeta.icon;
                const cards = phase.deliverables.filter((d) => d.status === colStatus);
                const isTarget = dropTarget?.phaseId === phase.id && dropTarget?.status === colStatus
                  && draggingDeliv !== null && draggingDeliv.status !== colStatus;
                return (
                  <div key={colStatus} className="flex-none w-52 space-y-2">
                    <div className="flex items-center gap-1.5 px-0.5">
                      <ColIcon className={cn("h-3.5 w-3.5 shrink-0", colMeta.color)} />
                      <span className="text-xs font-medium text-muted-foreground truncate">{colMeta.label}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                        {cards.length}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "space-y-2 rounded-xl bg-muted/30 p-2 min-h-[80px] transition-all duration-150",
                        isTarget && "ring-2 ring-primary ring-offset-1",
                      )}
                      onDragOver={e => { e.preventDefault(); setDropTarget({ phaseId: phase.id, status: colStatus }); }}
                      onDragLeave={e => {
                        const related = e.relatedTarget as Node | null;
                        if (!(e.currentTarget as HTMLElement).contains(related)) setDropTarget(null);
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        if (draggingDeliv && draggingDeliv.status !== colStatus) {
                          updateDeliv.mutate({ delivId: draggingDeliv.id, programId, status: colStatus });
                        }
                        setDraggingDeliv(null); setDropTarget(null);
                      }}
                    >
                      {cards.map((d) => (
                        <div
                          key={d.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData("text/plain", d.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingDeliv(d);
                          }}
                          onDragEnd={() => { setDraggingDeliv(null); setDropTarget(null); }}
                          className={cn("cursor-grab active:cursor-grabbing transition-opacity", draggingDeliv?.id === d.id && "opacity-40")}
                        >
                          <KanbanCard
                            deliv={d}
                            programId={programId}
                            onEdit={(deliv) => onEditDeliverable(deliv, phase.id)}
                            onDelete={(deliv) => onDeleteDeliverable(deliv, phase.id)}
                            onStatusChange={handleStatusChange}
                          />
                        </div>
                      ))}
                      {isTarget && (
                        <div className="h-8 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center">
                          <p className="text-[10px] text-primary/70">Soltar aquí</p>
                        </div>
                      )}
                      <button
                        className="w-full text-xs text-muted-foreground/60 flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-muted-foreground/20 hover:border-primary/50 hover:text-primary transition-colors"
                        onClick={() => onAddDeliverable(phase.id)}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteDialog({
  title, description, open, onClose, onConfirm, busy,
}: {
  title: string; description: string; open: boolean;
  onClose: () => void; onConfirm: () => void; busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mb-4 -mx-4 px-4 py-3 border-t bg-muted/40 rounded-b-xl">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline edit program form ──────────────────────────────────────────────────

function EditProgramInline({ program, onClose }: { program: any; onClose: () => void }) {
  const update = useUpdateProgram();
  const [name,        setName]        = useState(program.name);
  const [description, setDescription] = useState(program.description ?? "");
  const [status,      setStatus]      = useState<ProgramStatus>(program.status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ id: program.id, name: name.trim(), description: description.trim() || undefined, status });
    onClose();
  }

  return (
    <>
      <form id="edit-prog-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ep-status">Estado</Label>
          <Select
            id="ep-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProgramStatus)}
          >
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activo</option>
            <option value="COMPLETED">Completado</option>
            <option value="ARCHIVED">Archivado</option>
          </Select>
        </div>
      </form>
      <DialogFooter className="-mb-4 -mx-4 px-4 py-3 border-t bg-muted/40 rounded-b-xl">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button form="edit-prog-form" type="submit" disabled={update.isPending}>
          {update.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const { data, isLoading } = useProgram(id);
  const updateProgram  = useUpdateProgram();
  const deleteProgram  = useDeleteProgram();
  const deletePhase    = useDeletePhase();
  const deleteDeliv    = useDeleteDeliverable();

  const [viewMode,          setViewMode]          = useState<"list" | "kanban">("list");
  const [editProgramOpen,   setEditProgramOpen]   = useState(false);
  const [deleteProgramOpen, setDeleteProgramOpen] = useState(false);
  const [aiOpen,            setAiOpen]            = useState(false);
  const [phaseFormTarget,   setPhaseFormTarget]   = useState<DeliveryPhase | null | "new">(null);
  const [deletePhaseTarget, setDeletePhaseTarget] = useState<DeliveryPhase | null>(null);
  const [delivFormState,    setDelivFormState]    = useState<{ open: boolean; phaseId: string; initial: Deliverable | null }>({ open: false, phaseId: "", initial: null });
  const [deleteDelivTarget, setDeleteDelivTarget] = useState<{ d: Deliverable; phaseId: string } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Package2 className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Programa no encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/delivery")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
      </div>
    );
  }

  const { program, phases } = data;
  const progMeta  = PROGRAM_STATUS[program.status];
  const totalPct  = Math.round(program.completion_pct ?? 0);

  async function handleDeleteProgram() {
    await deleteProgram.mutateAsync(program.id);
    router.push("/delivery");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/delivery" className="hover:text-foreground transition-colors">Gestión de Entregables</Link>
        <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
        <span className="text-foreground font-medium truncate">{program.name}</span>
      </div>

      {/* Program header */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Package2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{program.name}</h1>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", progMeta.color)}>
                  {progMeta.label}
                </span>
              </div>
              {program.description && (
                <p className="mt-1 text-sm text-muted-foreground">{program.description}</p>
              )}
              {program.cycle_name && (
                <p className="mt-1 text-xs text-muted-foreground">Ciclo: {program.cycle_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setAiOpen(true)} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Sugerir con IA
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditProgramOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDeleteProgramOpen(true)} variant="destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar programa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Fases",        value: program.phase_count },
            { label: "Entregables",  value: program.deliverable_count },
            { label: "Completados",  value: program.completed_count },
            { label: "Progreso",     value: `${totalPct}%` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progreso total</span>
            <span className="font-semibold text-foreground">{totalPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", progressColor(totalPct))}
              style={{ width: `${Math.min(totalPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Fases</h2>
          <div className="flex items-center gap-2 ml-auto">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "kanban"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </button>
            </div>
            <Button size="sm" onClick={() => setPhaseFormTarget("new")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva fase
            </Button>
          </div>
        </div>

        {viewMode === "list" ? (
          phases.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center">
              <p className="text-sm text-muted-foreground mb-3">Sin fases. Crea la primera fase del programa.</p>
              <Button onClick={() => setPhaseFormTarget("new")}>
                <Plus className="h-4 w-4 mr-2" /> Crear primera fase
              </Button>
            </div>
          ) : (
            phases.map((phase, i) => (
              <PhaseAccordion
                key={phase.id}
                phase={phase}
                programId={program.id}
                index={i + 1}
                onEditPhase={(p) => setPhaseFormTarget(p)}
                onDeletePhase={(p) => setDeletePhaseTarget(p)}
                onAddDeliverable={(phaseId) => setDelivFormState({ open: true, phaseId, initial: null })}
                onEditDeliverable={(d, phaseId) => setDelivFormState({ open: true, phaseId, initial: d })}
                onDeleteDeliverable={(d, phaseId) => setDeleteDelivTarget({ d, phaseId })}
              />
            ))
          )
        ) : (
          <KanbanView
            phases={phases}
            programId={program.id}
            onEditPhase={(p) => setPhaseFormTarget(p)}
            onDeletePhase={(p) => setDeletePhaseTarget(p)}
            onAddDeliverable={(phaseId) => setDelivFormState({ open: true, phaseId, initial: null })}
            onEditDeliverable={(d, phaseId) => setDelivFormState({ open: true, phaseId, initial: d })}
            onDeleteDeliverable={(d, phaseId) => setDeleteDelivTarget({ d, phaseId })}
          />
        )}
      </div>

      {/* Dialogs */}

      {editProgramOpen && (
        <Dialog open onOpenChange={(v) => { if (!v) setEditProgramOpen(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar programa</DialogTitle>
              <DialogDescription>Modifica los datos del programa.</DialogDescription>
            </DialogHeader>
            <EditProgramInline program={program} onClose={() => setEditProgramOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      <DeleteDialog
        open={deleteProgramOpen}
        onClose={() => setDeleteProgramOpen(false)}
        onConfirm={handleDeleteProgram}
        busy={deleteProgram.isPending}
        title="Eliminar programa"
        description={`¿Eliminar "${program.name}"? Se eliminarán todas sus fases y entregables. Esta acción no se puede deshacer.`}
      />

      <PhaseFormDialog
        open={!!phaseFormTarget}
        onClose={() => setPhaseFormTarget(null)}
        programId={program.id}
        initial={phaseFormTarget !== "new" ? phaseFormTarget : null}
      />

      <DeleteDialog
        open={!!deletePhaseTarget}
        onClose={() => setDeletePhaseTarget(null)}
        onConfirm={async () => {
          if (!deletePhaseTarget) return;
          await deletePhase.mutateAsync({ phaseId: deletePhaseTarget.id, programId: program.id });
          setDeletePhaseTarget(null);
        }}
        busy={deletePhase.isPending}
        title="Eliminar fase"
        description={`¿Eliminar la fase "${deletePhaseTarget?.name}"? Se eliminarán todos sus entregables.`}
      />

      <DeliverableFormDialog
        open={delivFormState.open}
        onClose={() => setDelivFormState({ open: false, phaseId: "", initial: null })}
        programId={program.id}
        phaseId={delivFormState.phaseId}
        initial={delivFormState.initial}
      />

      <DeleteDialog
        open={!!deleteDelivTarget}
        onClose={() => setDeleteDelivTarget(null)}
        onConfirm={async () => {
          if (!deleteDelivTarget) return;
          await deleteDeliv.mutateAsync({ delivId: deleteDelivTarget.d.id, programId: program.id });
          setDeleteDelivTarget(null);
        }}
        busy={deleteDeliv.isPending}
        title="Eliminar entregable"
        description={`¿Eliminar "${deleteDelivTarget?.d.title}"?`}
      />

      {/* Floating AI chat */}
      <AiSuggestDeliveryDialog open={aiOpen} onClose={() => setAiOpen(false)} programId={program.id} programName={program.name} />
    </div>
  );
}
