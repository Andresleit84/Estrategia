"use client";

import { useState, useEffect, useMemo } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  Handshake, Plus, MoreHorizontal, Pencil, X, AlertCircle,
  CheckCircle2, Clock, XCircle, Sparkles, Trash2, AlertTriangle,
  List, LayoutGrid, ChevronRight, ChevronLeft, Unlink, RotateCcw,
  User, Search, Download, Layers, SlidersHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useAgreements, useAgreementStats, useCreateAgreement, useUpdateAgreement,
  useDeleteAgreement, useConvertAgreementToEpic, useLinkAgreementItem,
  useUnlinkAgreementItem, useAgreementLinks,
  type Agreement, type AgreementStatus, type AgreementPriority, type EpicSuggestion,
} from "@/hooks/useAgreements";
import { useCreateBacklogItem, type BacklogItem } from "@/hooks/useBacklog";
import { useActiveCycle, useCycles } from "@/hooks/useCycles";
import { useInitiatives } from "@/hooks/useInitiatives";
import { useOrgMembers } from "@/hooks/useOrganization";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "list" | "kanban";

interface FilterState {
  search: string;
  priority: string;
  ownerId: string;
  cycleId: string;
}

const EMPTY_FILTERS: FilterState = { search: "", priority: "", ownerId: "", cycleId: "" };

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AgreementStatus, { label: string; color: string; colBg: string; icon: React.ElementType }> = {
  OPEN:        { label: "Abierto",         color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",          colBg: "bg-sky-50 dark:bg-sky-950/20",       icon: AlertCircle },
  PENDING:     { label: "Pendiente",       color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  colBg: "bg-amber-50 dark:bg-amber-950/20",   icon: Clock },
  IN_PROGRESS: { label: "En proceso",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",      colBg: "bg-blue-50 dark:bg-blue-950/20",     icon: Clock },
  TRACKING:    { label: "En seguimiento",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", colBg: "bg-violet-50 dark:bg-violet-950/20", icon: AlertTriangle },
  EVIDENCE:    { label: "Evidencia",       color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", colBg: "bg-orange-50 dark:bg-orange-950/20", icon: AlertTriangle },
  FULFILLED:   { label: "Cumplido",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  colBg: "bg-green-50 dark:bg-green-950/20",   icon: CheckCircle2 },
  CLOSED:      { label: "Cerrado",         color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",      colBg: "bg-teal-50 dark:bg-teal-950/20",     icon: CheckCircle2 },
  ESCALATED:   { label: "Escalado",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",          colBg: "bg-red-50 dark:bg-red-950/20",       icon: AlertTriangle },
  CANCELLED:   { label: "Cancelado",       color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",         colBg: "bg-gray-50 dark:bg-gray-900/20",     icon: XCircle },
};

const PRIORITY_CONFIG: Record<AgreementPriority, { label: string; border: string }> = {
  CRITICAL: { label: "Crítica", border: "border-l-red-500"    },
  HIGH:     { label: "Alta",    border: "border-l-orange-500" },
  MEDIUM:   { label: "Media",   border: "border-l-yellow-500" },
  LOW:      { label: "Baja",    border: "border-l-gray-300"   },
};

const KANBAN_COLUMNS: AgreementStatus[] = ["OPEN", "PENDING", "IN_PROGRESS", "TRACKING", "EVIDENCE", "FULFILLED", "CLOSED", "ESCALATED", "CANCELLED"];
const STATUS_FLOW:    AgreementStatus[] = ["OPEN", "PENDING", "IN_PROGRESS", "TRACKING", "EVIDENCE", "FULFILLED"];

function getNextStatus(s: AgreementStatus): AgreementStatus | null {
  const i = STATUS_FLOW.indexOf(s);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}
function getPrevStatus(s: AgreementStatus): AgreementStatus | null {
  if (s === "CANCELLED") return "PENDING";
  const i = STATUS_FLOW.indexOf(s);
  return i > 0 ? STATUS_FLOW[i - 1] : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function sanitizeDates<T extends Record<string, unknown>>(payload: T): T {
  const out = { ...payload };
  for (const k of ["agreement_date", "due_date"] as const) {
    if ((out as Record<string, unknown>)[k] === "") delete (out as Record<string, unknown>)[k];
  }
  return out;
}

function exportToCSV(agreements: Agreement[]) {
  const header = [
    "Código", "Título", "Estado", "Prioridad", "Responsable",
    "Origen", "Ciclo", "Fecha acuerdo", "Fecha límite", "Vencido",
    "Épicas vinculadas", "Notas de cierre",
  ];
  const rows = agreements.map(a => [
    a.code ?? "",
    a.title,
    STATUS_CONFIG[a.status].label,
    PRIORITY_CONFIG[a.priority].label,
    a.owner_name ?? "",
    a.source ?? "",
    a.cycle_name ?? "",
    a.agreement_date ?? "",
    a.due_date ?? "",
    a.is_overdue ? "Sí" : "No",
    String(a.linked_items_count),
    a.completion_notes ?? "",
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `acuerdos-${new Date().toISOString().slice(0, 10)}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(agreements: Agreement[]) {
  const dateStr = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const priorityColor: Record<AgreementPriority, string> = {
    CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#ca8a04", LOW: "#9ca3af",
  };
  const statusColor: Record<AgreementStatus, string> = {
    OPEN: "#0284c7", PENDING: "#d97706", IN_PROGRESS: "#2563eb", TRACKING: "#7c3aed",
    EVIDENCE: "#ea580c", FULFILLED: "#16a34a", CLOSED: "#0d9488", ESCALATED: "#dc2626", CANCELLED: "#6b7280",
  };

  const rows = agreements.map(a => `
    <tr>
      <td style="font-family:monospace;font-size:9px;white-space:nowrap">${a.code ?? ""}</td>
      <td>
        <strong>${a.title}</strong>
        ${a.completion_notes ? `<br><span style="color:#16a34a;font-size:9px">✓ ${a.completion_notes}</span>` : ""}
      </td>
      <td style="color:${statusColor[a.status]};font-weight:600;white-space:nowrap">${STATUS_CONFIG[a.status].label}${a.is_overdue ? " ⚠" : ""}</td>
      <td style="color:${priorityColor[a.priority]};font-weight:600;white-space:nowrap">${PRIORITY_CONFIG[a.priority].label}</td>
      <td style="white-space:nowrap">${a.owner_name ?? "—"}</td>
      <td>${a.source ?? "—"}</td>
      <td style="white-space:nowrap">${a.cycle_name ?? "—"}</td>
      <td style="white-space:nowrap">${a.due_date ? fmtDate(a.due_date) : "—"}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Acuerdos ${dateStr}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family:Arial,sans-serif; font-size:10px; color:#111; padding:28px }
  header { margin-bottom:20px; border-bottom:2px solid #111; padding-bottom:12px }
  h1 { font-size:18px; font-weight:700 }
  .meta { color:#666; font-size:10px; margin-top:4px }
  table { width:100%; border-collapse:collapse; font-size:9.5px }
  th { background:#f5f5f5; border:1px solid #ddd; padding:6px 8px; text-align:left;
       font-size:8.5px; text-transform:uppercase; letter-spacing:.04em; color:#555 }
  td { border:1px solid #e5e7eb; padding:6px 8px; vertical-align:top; line-height:1.4 }
  tr:nth-child(even) td { background:#fafafa }
  @page { margin:1.5cm; size:landscape }
  @media print { body { padding:0 } }
</style></head><body>
<header>
  <h1>Reporte de Acuerdos</h1>
  <p class="meta">Generado el ${dateStr} &nbsp;·&nbsp; ${agreements.length} acuerdo${agreements.length !== 1 ? "s" : ""}</p>
</header>
<table>
  <thead><tr>
    <th>Código</th><th>Título</th><th>Estado</th><th>Prioridad</th>
    <th>Responsable</th><th>Origen</th><th>Ciclo</th><th>Fecha límite</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja",
};

function FilterBar({ filters, onChange, agreements, onExportCSV, onExportPDF }: {
  filters: FilterState;
  onChange: (f: Partial<FilterState>) => void;
  agreements: Agreement[];
  onExportCSV: () => void;
  onExportPDF: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agreements) {
      if (a.owner_id && a.owner_name) map.set(a.owner_id, a.owner_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [agreements]);

  const cycles = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agreements) {
      if (a.cycle_id && a.cycle_name) map.set(a.cycle_id, a.cycle_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [agreements]);

  const activeFilterCount = [filters.priority, filters.ownerId, filters.cycleId].filter(Boolean).length;
  const hasAnyFilter = !!(filters.search || activeFilterCount);

  // Active filter chips (not search — that has its own inline clear)
  const chips: { key: keyof FilterState; label: string }[] = [
    ...(filters.priority ? [{ key: "priority" as const, label: `Prioridad: ${PRIORITY_LABELS[filters.priority]}` }] : []),
    ...(filters.ownerId  ? [{ key: "ownerId"  as const, label: `Responsable: ${owners.find(o => o.id === filters.ownerId)?.name ?? ""}` }] : []),
    ...(filters.cycleId  ? [{ key: "cycleId"  as const, label: `Ciclo: ${cycles.find(c => c.id === filters.cycleId)?.name ?? ""}` }] : []),
  ];

  return (
    <div className="space-y-2">
      {/* Main row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por título, origen o descripción..."
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            className="pl-8 pr-8"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={cn(
            "relative flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border transition-colors",
            panelOpen || activeFilterCount > 0
              ? "border-primary/50 bg-primary/5 text-primary"
              : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-border",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filtros</span>
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Exports */}
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={onExportCSV} title="Exportar CSV" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPDF} title="Exportar PDF" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Filter panel — appears below the search bar */}
      {panelOpen && (
        <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="space-y-1 min-w-[160px]">
            <p className="text-xs font-medium text-muted-foreground">Prioridad</p>
            <Select value={filters.priority} onChange={e => onChange({ priority: e.target.value })}>
              <SelectOption value="">Todas</SelectOption>
              <SelectOption value="CRITICAL">Crítica</SelectOption>
              <SelectOption value="HIGH">Alta</SelectOption>
              <SelectOption value="MEDIUM">Media</SelectOption>
              <SelectOption value="LOW">Baja</SelectOption>
            </Select>
          </div>

          {owners.length > 0 && (
            <div className="space-y-1 min-w-[180px]">
              <p className="text-xs font-medium text-muted-foreground">Responsable</p>
              <Select value={filters.ownerId} onChange={e => onChange({ ownerId: e.target.value })}>
                <SelectOption value="">Todos</SelectOption>
                {owners.map(o => <SelectOption key={o.id} value={o.id}>{o.name}</SelectOption>)}
              </Select>
            </div>
          )}

          {cycles.length > 0 && (
            <div className="space-y-1 min-w-[180px]">
              <p className="text-xs font-medium text-muted-foreground">Ciclo</p>
              <Select value={filters.cycleId} onChange={e => onChange({ cycleId: e.target.value })}>
                <SelectOption value="">Todos</SelectOption>
                {cycles.map(c => <SelectOption key={c.id} value={c.id}>{c.name}</SelectOption>)}
              </Select>
            </div>
          )}

          {activeFilterCount > 0 && (
            <div className="flex items-end">
              <Button
                variant="ghost" size="sm"
                onClick={() => onChange({ priority: "", ownerId: "", cycleId: "" })}
                className="text-muted-foreground gap-1 h-9"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Active filter chips (visible even when panel is closed) */}
      {chips.length > 0 && !panelOpen && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary"
            >
              {chip.label}
              <button
                onClick={() => onChange({ [chip.key]: "" })}
                className="hover:text-primary/70 ml-0.5"
                aria-label={`Quitar filtro ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {hasAnyFilter && (
            <button
              onClick={() => onChange(EMPTY_FILTERS)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Expiring Banner ──────────────────────────────────────────────────────────

function ExpiringBanner({ agreements }: { agreements: Agreement[] }) {
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today); cutoff.setDate(today.getDate() + 7);

  const expiring = agreements.filter(a => {
    if (!a.due_date || a.status === "FULFILLED" || a.status === "CANCELLED" || a.is_overdue) return false;
    const due = new Date(a.due_date + "T00:00:00");
    return due >= today && due <= cutoff;
  });

  if (expiring.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {expiring.length === 1
              ? "1 acuerdo vence en los próximos 7 días"
              : `${expiring.length} acuerdos vencen en los próximos 7 días`}
          </p>
          <div className="mt-2 space-y-1">
            {expiring.map(a => {
              const due = new Date(a.due_date! + "T00:00:00");
              const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={a.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  {a.code && <span className="font-mono shrink-0">{a.code}</span>}
                  <span className="truncate">{a.title}</span>
                  {a.owner_name && (
                    <span className="shrink-0 text-amber-600/70">— {a.owner_name}</span>
                  )}
                  <span className="ml-auto shrink-0 font-semibold">
                    {diff === 0 ? "hoy" : diff === 1 ? "mañana" : `en ${diff} días`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Fulfill Note Dialog ──────────────────────────────────────────────────────

const TRANSITION_CONFIG: Record<AgreementStatus, {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  placeholder: string;
  buttonLabel: string;
  destructive?: boolean;
}> = {
  OPEN:        { title: "Abrir acuerdo",            icon: AlertCircle,  iconColor: "text-sky-600",    placeholder: "¿Por qué se abre este acuerdo?",                        buttonLabel: "Abrir"             },
  PENDING:     { title: "Retroceder a Pendiente",   icon: ChevronLeft,  iconColor: "text-amber-600",  placeholder: "¿Por qué se revierte? ¿Qué quedó incompleto?",          buttonLabel: "Retroceder"        },
  IN_PROGRESS: { title: "Poner en proceso",          icon: ChevronRight, iconColor: "text-blue-600",   placeholder: "¿Qué acción se está tomando? ¿Quién lidera?",           buttonLabel: "Poner en proceso"  },
  TRACKING:    { title: "Pasar a seguimiento",       icon: AlertTriangle, iconColor: "text-violet-600", placeholder: "¿Qué se está monitoreando? ¿Cada cuánto?",             buttonLabel: "En seguimiento"    },
  EVIDENCE:    { title: "Solicitar evidencia",       icon: AlertTriangle, iconColor: "text-orange-600", placeholder: "¿Qué evidencia se requiere? ¿Plazo?",                  buttonLabel: "Solicitar evidencia" },
  FULFILLED:   { title: "Marcar como Cumplido",      icon: CheckCircle2, iconColor: "text-green-600",  placeholder: "¿Cómo se resolvió? Referencia a acta, entregable...",  buttonLabel: "Marcar cumplido"   },
  CLOSED:      { title: "Cerrar acuerdo",            icon: CheckCircle2, iconColor: "text-teal-600",   placeholder: "¿Por qué se cierra? ¿Qué se logró?",                   buttonLabel: "Cerrar"            },
  ESCALATED:   { title: "Escalar acuerdo",           icon: AlertTriangle, iconColor: "text-red-600",   placeholder: "¿A quién se escala? ¿Cuál es el bloqueo?",             buttonLabel: "Escalar",          destructive: true },
  CANCELLED:   { title: "Cancelar acuerdo",          icon: XCircle,      iconColor: "text-gray-500",   placeholder: "¿Por qué se cancela? ¿Qué condición no se cumplió?",   buttonLabel: "Cancelar acuerdo", destructive: true },
};

function TransitionNoteDialog({ agreement, targetStatus, onClose }: {
  agreement: Agreement;
  targetStatus: AgreementStatus;
  onClose: () => void;
}) {
  const update = useUpdateAgreement();
  const [note, setNote]   = useState("");
  const [error, setError] = useState<string | null>(null);
  const cfg  = TRANSITION_CONFIG[targetStatus];
  const Icon = cfg.icon;

  async function handleConfirm() {
    if (!note.trim()) return;
    setError(null);
    try {
      await update.mutateAsync({
        id: agreement.id,
        status: targetStatus,
        completion_notes: note.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "No se pudo actualizar el acuerdo"));
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", cfg.iconColor)} />
            {cfg.title}
          </DialogTitle>
          <DialogDescription>
            {agreement.code && <span className="font-mono text-xs mr-1">{agreement.code}:</span>}
            {agreement.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Nota de transición{" "}
              <span className="text-destructive text-xs font-normal">* obligatoria</span>
            </label>
            <Textarea
              placeholder={cfg.placeholder}
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={cfg.destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={update.isPending || !note.trim()}
          >
            {update.isPending ? "Guardando..." : cfg.buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({ agreement, onEdit, onDelete, onTransition, onConvert, onDesvincular, onReconvert, unlinking }: {
  agreement: Agreement;
  onEdit: () => void;
  onDelete: () => void;
  onTransition: (s: AgreementStatus) => void;
  onConvert: () => void;
  onDesvincular: () => void;
  onReconvert: () => void;
  unlinking?: boolean;
}) {
  const next    = getNextStatus(agreement.status);
  const prev    = getPrevStatus(agreement.status);
  const hasEpic = agreement.linked_items_count > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
        aria-label="Acciones del acuerdo"
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </DropdownMenuItem>

        {!hasEpic ? (
          <DropdownMenuItem onClick={onConvert}>
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Convertir en Épica
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={onReconvert} disabled={unlinking}>
              <RotateCcw className="h-3.5 w-3.5 text-primary" />
              {unlinking ? "Desvinculando..." : "Reconvertir épica"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDesvincular}
              disabled={unlinking}
              className="text-muted-foreground focus:text-muted-foreground"
            >
              <Unlink className="h-3.5 w-3.5" />
              {unlinking ? "Desvinculando..." : "Desvincular épica"}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        {next && (
          <DropdownMenuItem onClick={() => onTransition(next)}>
            <ChevronRight className="h-3.5 w-3.5 text-blue-600" />
            Avanzar → {STATUS_CONFIG[next].label}
          </DropdownMenuItem>
        )}
        {prev && (
          <DropdownMenuItem onClick={() => onTransition(prev)}>
            <ChevronLeft className="h-3.5 w-3.5 text-amber-600" />
            Retroceder → {STATUS_CONFIG[prev].label}
          </DropdownMenuItem>
        )}
        {agreement.status !== "CANCELLED" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onTransition("CANCELLED")}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancelar acuerdo
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <X className="h-3.5 w-3.5" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Inline Confirm ───────────────────────────────────────────────────────────

function ConfirmDelete({ onConfirm, onAbort }: { onConfirm: () => void; onAbort: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded px-3 py-2 mt-2">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>¿Eliminar este acuerdo?</span>
      <button onClick={onConfirm} className="ml-auto font-medium hover:underline">Eliminar</button>
      <button onClick={onAbort} className="font-medium text-muted-foreground hover:underline">Cancelar</button>
    </div>
  );
}

// ─── Agreement Card ───────────────────────────────────────────────────────────

function AgreementCard({ agreement, onEdit, onConvert, compact = false }: {
  agreement: Agreement;
  onEdit: (a: Agreement) => void;
  onConvert: (a: Agreement) => void;
  compact?: boolean;
}) {
  const update = useUpdateAgreement();
  const del    = useDeleteAgreement();
  const unlink = useUnlinkAgreementItem();
  const { data: allLinks = [] } = useAgreementLinks();
  const [confirmDelete,    setConfirmDelete]    = useState(false);
  const [pendingTransition, setPendingTransition] = useState<AgreementStatus | null>(null);

  const myLinks = allLinks.filter(l => l.agreement_id === agreement.id);
  const hasEpic = myLinks.length > 0 || agreement.linked_items_count > 0;

  async function handleDesvincular() {
    for (const link of myLinks) {
      await unlink.mutateAsync({ agreementId: agreement.id, backlogItemId: link.backlog_item_id });
    }
  }

  async function handleReconvert() {
    await handleDesvincular();
    onConvert(agreement);
  }

  const { icon: StatusIcon, color } = STATUS_CONFIG[agreement.status];
  const { label: statusLabel }      = STATUS_CONFIG[agreement.status];
  const { border }                  = PRIORITY_CONFIG[agreement.priority];

  return (
    <>
      <Card className={cn("p-4 border-l-4 transition-shadow hover:shadow-md group", border)}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", color)}>
                <StatusIcon className="h-3 w-3" aria-hidden="true" />
                {statusLabel}
              </span>
              {agreement.is_overdue && agreement.status !== "FULFILLED" && agreement.status !== "CANCELLED" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" /> Vencido
                </span>
              )}
              {agreement.linked_items_count > 0 && (
                <span className="text-xs text-muted-foreground">
                  {agreement.linked_items_count} épica{agreement.linked_items_count > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {agreement.code && (
                <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5">
                  {agreement.code}
                </span>
              )}
              {agreement.title}
            </h3>

            {!compact && agreement.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{agreement.description}</p>
            )}

            {/* Transition note — shown in list view for all statuses */}
            {!compact && agreement.completion_notes && (
              <p className={cn(
                "text-xs rounded px-2 py-1 mb-2 line-clamp-2",
                agreement.status === "FULFILLED"   && "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20",
                agreement.status === "CANCELLED"   && "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/40",
                agreement.status === "IN_PROGRESS" && "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20",
                agreement.status === "PENDING"     && "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20",
              )}>
                {agreement.status === "FULFILLED" ? "✓ " : agreement.status === "CANCELLED" ? "✕ " : "• "}
                {agreement.completion_notes}
              </p>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {agreement.owner_name && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
                  <User className="h-3 w-3 shrink-0" />
                  {agreement.owner_name}
                </span>
              )}
              {agreement.cycle_name && !compact && (
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3 w-3 shrink-0" />
                  {agreement.cycle_name}
                </span>
              )}
              {agreement.source && <span className="truncate max-w-[160px]">{agreement.source}</span>}
              {agreement.due_date && (
                <span className={cn(
                  agreement.is_overdue && agreement.status !== "FULFILLED" && "text-red-600 dark:text-red-400",
                )}>
                  Límite: {fmtDate(agreement.due_date)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!compact && (
              hasEpic ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  {agreement.linked_items_count} épica{agreement.linked_items_count !== 1 ? "s" : ""}
                </span>
              ) : (
                <Button
                  variant="ghost" size="sm"
                  className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onConvert(agreement)}
                  title="Convertir en épica con IA"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                  Épica
                </Button>
              )
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-opacity"
              aria-label="Eliminar acuerdo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <ActionMenu
              agreement={agreement}
              onEdit={() => onEdit(agreement)}
              onDelete={() => setConfirmDelete(true)}
              onTransition={s => setPendingTransition(s)}
              onConvert={() => onConvert(agreement)}
              onDesvincular={handleDesvincular}
              onReconvert={handleReconvert}
              unlinking={unlink.isPending}
            />
          </div>
        </div>

        {confirmDelete && (
          <ConfirmDelete
            onConfirm={() => del.mutate(agreement.id)}
            onAbort={() => setConfirmDelete(false)}
          />
        )}
      </Card>

      {pendingTransition && (
        <TransitionNoteDialog
          agreement={agreement}
          targetStatus={pendingTransition}
          onClose={() => setPendingTransition(null)}
        />
      )}
    </>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ agreements, onEdit, onConvert, onCreate }: {
  agreements: Agreement[];
  onEdit: (a: Agreement) => void;
  onConvert: (a: Agreement) => void;
  onCreate: () => void;
}) {
  const [tab,     setTab]     = useState<"active" | "fulfilled" | "cancelled" | "all">("active");
  const [groupBy, setGroupBy] = useState(false);

  const counts = {
    active:    agreements.filter(a => a.status !== "FULFILLED" && a.status !== "CANCELLED").length,
    fulfilled: agreements.filter(a => a.status === "FULFILLED").length,
    cancelled: agreements.filter(a => a.status === "CANCELLED").length,
    all:       agreements.length,
  };
  const labels = { active: "Activos", fulfilled: "Cumplidos", cancelled: "Cancelados", all: "Todos" };

  const displayed =
    tab === "active"    ? agreements.filter(a => a.status !== "FULFILLED" && a.status !== "CANCELLED") :
    tab === "fulfilled" ? agreements.filter(a => a.status === "FULFILLED") :
    tab === "cancelled" ? agreements.filter(a => a.status === "CANCELLED") :
    agreements;

  // Group by source (sorted: named sources alphabetically, "Sin origen" last)
  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, Agreement[]>();
    for (const a of displayed) {
      const key = a.source?.trim() || "Sin origen";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === "Sin origen" ? 1 : b === "Sin origen" ? -1 : a.localeCompare(b, "es"),
    );
  }, [displayed, groupBy]);

  return (
    <div className="space-y-4">
      {/* Tabs + group toggle */}
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-1">
          {(["active", "fulfilled", "cancelled", "all"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {labels[t]}
              <span className={cn(
                "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                tab === t ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setGroupBy(g => !g)}
          title="Agrupar por origen"
          className={cn(
            "mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors",
            groupBy
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          Agrupar por origen
        </button>
      </div>

      {displayed.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={Handshake}
            title="Sin acuerdos"
            description={
              tab === "active"
                ? "Registra compromisos de junta, clientes o reguladores para hacerles seguimiento."
                : "No hay acuerdos en esta categoría."
            }
            actionLabel={tab === "active" ? "Registrar acuerdo" : undefined}
            onAction={tab === "active" ? onCreate : undefined}
          />
        </Card>
      ) : grouped ? (
        <div className="space-y-6">
          {grouped.map(([source, items]) => (
            <div key={source}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-foreground">{source}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {items.length}
                </span>
                <div className="flex-1 border-t border-dashed border-border" />
              </div>
              <div className="space-y-3">
                {items.map(a => (
                  <AgreementCard key={a.id} agreement={a} onEdit={onEdit} onConvert={onConvert} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(a => (
            <AgreementCard key={a.id} agreement={a} onEdit={onEdit} onConvert={onConvert} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({ agreements, onEdit, onConvert, onCreate }: {
  agreements: Agreement[];
  onEdit: (a: Agreement) => void;
  onConvert: (a: Agreement) => void;
  onCreate: () => void;
}) {
  const [draggingId,       setDraggingId]       = useState<string | null>(null);
  const [dropTarget,       setDropTarget]       = useState<AgreementStatus | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{ agreement: Agreement; targetStatus: AgreementStatus } | null>(null);

  const byStatus = (s: AgreementStatus) => agreements.filter(a => a.status === s);

  function handleDrop(targetStatus: AgreementStatus) {
    if (!draggingId) return;
    const agreement = agreements.find(a => a.id === draggingId);
    if (agreement && agreement.status !== targetStatus) {
      setPendingTransition({ agreement, targetStatus });
    }
    setDraggingId(null);
    setDropTarget(null);
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map(status => {
          const { label, icon: Icon, color, colBg } = STATUS_CONFIG[status];
          const items = byStatus(status);
          const draggingAgreement = draggingId ? agreements.find(a => a.id === draggingId) : null;
          const isSource = draggingAgreement?.status === status;
          const isTarget = dropTarget === status && draggingId !== null && !isSource;

          return (
            <div
              key={status}
              className={cn(
                "rounded-xl border flex flex-col min-h-[200px] transition-all duration-150",
                colBg,
                isTarget && "ring-2 ring-primary ring-offset-2",
              )}
              onDragOver={e => { e.preventDefault(); setDropTarget(status); }}
              onDragLeave={e => {
                const related = e.relatedTarget as Node | null;
                if (!(e.currentTarget as HTMLElement).contains(related)) setDropTarget(null);
              }}
              onDrop={e => { e.preventDefault(); handleDrop(status); }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", color)}>
                  <Icon className="h-3 w-3" />
                  {label}
                </span>
                <span className="text-sm font-bold text-muted-foreground tabular-nums">{items.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto">
                {items.length === 0 ? (
                  <div className={cn(
                    "flex flex-col items-center justify-center flex-1 py-8 text-center rounded-lg border-2 border-dashed transition-colors",
                    isTarget ? "border-primary/50 bg-primary/5" : "border-transparent",
                  )}>
                    {isTarget ? (
                      <p className="text-xs font-medium text-primary">Soltar aquí</p>
                    ) : (
                      <>
                        <Handshake className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">Sin acuerdos</p>
                        {status === "PENDING" && (
                          <button
                            onClick={onCreate}
                            className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Agregar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {items.map(a => (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData("text/plain", a.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(a.id);
                        }}
                        onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
                        className={cn(
                          "cursor-grab active:cursor-grabbing transition-opacity",
                          draggingId === a.id && "opacity-40",
                        )}
                      >
                        <AgreementCard agreement={a} onEdit={onEdit} onConvert={onConvert} compact />
                      </div>
                    ))}
                    {isTarget && (
                      <div className="h-10 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center">
                        <p className="text-xs text-primary/70">Soltar aquí</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingTransition && (
        <TransitionNoteDialog
          agreement={pendingTransition.agreement}
          targetStatus={pendingTransition.targetStatus}
          onClose={() => setPendingTransition(null)}
        />
      )}
    </>
  );
}

// ─── Create / Edit Dialog ─────────────────────────────────────────────────────

const AGR_TEMPLATE = `Contexto:\nCompromiso específico:\nCriterio de cumplimiento:`;

interface FormValues {
  title: string;
  description: string;
  source: string;
  agreement_date: string;
  due_date: string;
  priority: AgreementPriority;
  status: AgreementStatus;
  owner_id: string;
  cycle_id: string;
  completion_notes: string;
}

const EMPTY_FORM: FormValues = {
  title: "", description: AGR_TEMPLATE, source: "",
  agreement_date: "", due_date: "", priority: "MEDIUM", status: "PENDING",
  owner_id: "", cycle_id: "", completion_notes: "",
};

function AgreementDialog({ open, onClose, initial }: {
  open: boolean;
  onClose: () => void;
  initial?: Agreement | null;
}) {
  const create = useCreateAgreement();
  const update = useUpdateAgreement();
  const { data: members = [] } = useOrgMembers();
  const { data: allCycles = [] } = useCycles();
  const [form, setForm]   = useState<FormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // Active cycles first, then closed
  const sortedCycles = useMemo(
    () => [...allCycles].sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
      return 0;
    }),
    [allCycles],
  );

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        title:            initial.title,
        description:      initial.description ?? AGR_TEMPLATE,
        source:           initial.source ?? "",
        agreement_date:   initial.agreement_date?.slice(0, 10) ?? "",
        due_date:         initial.due_date?.slice(0, 10) ?? "",
        priority:         initial.priority,
        status:           initial.status,
        owner_id:         initial.owner_id ?? "",
        cycle_id:         initial.cycle_id ?? "",
        completion_notes: initial.completion_notes ?? "",
      } : EMPTY_FORM);
      setError(null);
    }
  }, [open, initial]);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const descClean = form.description.trim();
      const descValue = (descClean === AGR_TEMPLATE.trim() || !descClean) ? undefined : descClean;
      const base = sanitizeDates({
        ...form,
        description:      descValue,
        owner_id:         form.owner_id         || undefined,
        cycle_id:         form.cycle_id         || undefined,
        completion_notes: form.completion_notes.trim() || undefined,
      });

      if (initial) {
        await update.mutateAsync({ id: initial.id, ...base });
      } else {
        // completion_notes only makes sense on updates
        const { status: _s, completion_notes: _cn, ...createPayload } = base;
        await create.mutateAsync(createPayload);
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "No se pudo guardar el acuerdo"));
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar acuerdo" : "Nuevo acuerdo"}</DialogTitle>
          <DialogDescription>
            Registra el compromiso, su origen y criterio de cumplimiento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Título *</label>
            <Input
              required
              autoFocus
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Ej. Implementar módulo de reportes para junta Q3"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descripción</label>
            <p className="text-xs text-muted-foreground -mt-1">
              Contexto, compromiso específico y criterio de cumplimiento
            </p>
            <Textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Origen</label>
              <Input
                value={form.source}
                onChange={e => set("source", e.target.value)}
                placeholder="Ej. Junta 2026-05-15, Cliente Acme"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ciclo estratégico</label>
              <Select value={form.cycle_id} onChange={e => set("cycle_id", e.target.value)}>
                <SelectOption value="">Sin ciclo asignado</SelectOption>
                {sortedCycles.map(c => (
                  <SelectOption key={c.id} value={c.id}>
                    {c.status === "ACTIVE" ? "● " : ""}{c.name}
                  </SelectOption>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Responsable</label>
            <Select value={form.owner_id} onChange={e => set("owner_id", e.target.value)}>
              <SelectOption value="">Sin responsable asignado</SelectOption>
              {members.filter(m => m.is_active).map(m => (
                <SelectOption key={m.user_id} value={m.user_id}>
                  {m.name} ({m.org_role.toLowerCase()})
                </SelectOption>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Prioridad</label>
              <Select value={form.priority} onChange={e => set("priority", e.target.value as AgreementPriority)}>
                <SelectOption value="CRITICAL">Crítica</SelectOption>
                <SelectOption value="HIGH">Alta</SelectOption>
                <SelectOption value="MEDIUM">Media</SelectOption>
                <SelectOption value="LOW">Baja</SelectOption>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Estado</label>
              <Select value={form.status} onChange={e => set("status", e.target.value as AgreementStatus)}>
                <SelectOption value="OPEN">Abierto</SelectOption>
                <SelectOption value="PENDING">Pendiente</SelectOption>
                <SelectOption value="IN_PROGRESS">En proceso</SelectOption>
                <SelectOption value="TRACKING">En seguimiento</SelectOption>
                <SelectOption value="EVIDENCE">Evidencia</SelectOption>
                <SelectOption value="FULFILLED">Cumplido</SelectOption>
                <SelectOption value="CLOSED">Cerrado</SelectOption>
                <SelectOption value="ESCALATED">Escalado</SelectOption>
                <SelectOption value="CANCELLED">Cancelado</SelectOption>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha del acuerdo</label>
              <Input
                type="date"
                value={form.agreement_date}
                onChange={e => set("agreement_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha límite</label>
              <Input
                type="date"
                value={form.due_date}
                onChange={e => set("due_date", e.target.value)}
              />
            </div>
          </div>

          {/* Completion notes — only relevant when status is FULFILLED */}
          {form.status === "FULFILLED" && (
            <div className="space-y-1.5 border-t pt-4">
              <label className="text-sm font-medium">
                Nota de cierre{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <p className="text-xs text-muted-foreground -mt-1">
                ¿Cómo se resolvió? Referencia a acta, entregable o evidencia
              </p>
              <Textarea
                value={form.completion_notes}
                onChange={e => set("completion_notes", e.target.value)}
                placeholder="Ej. Aprobado en sesión junta 2026-06-01, ver acta #47"
                rows={2}
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : initial ? "Guardar cambios" : "Registrar acuerdo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Convert to Epic Dialog ───────────────────────────────────────────────────

function ConvertEpicDialog({ agreement, onClose }: { agreement: Agreement; onClose: () => void }) {
  const convert    = useConvertAgreementToEpic();
  const createItem = useCreateBacklogItem();
  const linkItem   = useLinkAgreementItem();
  const { data: cycle } = useActiveCycle();
  const { data: initiatives } = useInitiatives(cycle?.id ? { cycle_id: cycle.id } : undefined);

  const [result,              setResult]              = useState<EpicSuggestion | null>(null);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const activeInitiatives = useMemo(
    () => (initiatives ?? []).filter(i => i.status !== "CANCELLED" && i.status !== "DONE"),
    [initiatives],
  );

  const selectedInitiative = useMemo(
    () => activeInitiatives.find(i => i.id === selectedInitiativeId) ?? null,
    [activeInitiatives, selectedInitiativeId],
  );

  const handleGenerate = async () => {
    setError(null);
    try {
      const data = await convert.mutateAsync(agreement.id);
      setResult(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Error al generar sugerencia"));
    }
  };

  const handleCreate = async () => {
    if (!result?.epic_title || !selectedInitiativeId) return;
    setCreating(true);
    try {
      const epic = await createItem.mutateAsync({
        type: "EPIC",
        title: result.epic_title,
        description: result.epic_description ?? undefined,
        cycle_id: cycle?.id,
        initiative_id: selectedInitiativeId,
        priority: agreement.priority === "CRITICAL" ? "CRITICAL"
          : agreement.priority === "HIGH" ? "HIGH" : "MEDIUM",
      }) as BacklogItem;
      await linkItem.mutateAsync({ agreementId: agreement.id, backlogItemId: epic.id });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "No se pudo crear la épica"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Convertir en Épica
          </DialogTitle>
          <DialogDescription>
            {agreement.code}: {agreement.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!result ? (
            <>
              <p className="text-sm text-muted-foreground">
                La IA analizará el acuerdo y sugerirá el título, descripción y alineación
                de la épica con tus objetivos activos.
              </p>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button className="w-full" onClick={handleGenerate} disabled={convert.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />
                {convert.isPending ? "Analizando acuerdo..." : "Generar sugerencia"}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Título de la épica</label>
                <p className="text-sm">{result.epic_title ?? "(sin sugerencia)"}</p>
              </div>
              {result.epic_description && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Descripción</label>
                  <p className="text-sm text-muted-foreground line-clamp-3">{result.epic_description}</p>
                </div>
              )}
              {result.suggested_objective_title && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Objetivo sugerido por IA</label>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{result.suggested_objective_title}</p>
                </div>
              )}
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <span className="font-medium">Justificación: </span>{result.rationale}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium">
                    Iniciativa del OKR <span className="text-destructive">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    La épica hereda la conexión a los KRs y objetivos de la iniciativa seleccionada.
                  </p>
                </div>

                {activeInitiatives.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      No hay iniciativas activas en este ciclo. Crea una iniciativa en{" "}
                      <span className="font-mono text-xs">/initiatives</span> para poder vincular esta épica al OKR.
                    </p>
                  </div>
                ) : (
                  <>
                    <Select
                      value={selectedInitiativeId}
                      onChange={e => setSelectedInitiativeId(e.target.value)}
                    >
                      <SelectOption value="">Selecciona una iniciativa...</SelectOption>
                      {activeInitiatives.map(i => (
                        <SelectOption key={i.id} value={i.id}>
                          {i.code ? `${i.code}: ` : ""}{i.title}
                        </SelectOption>
                      ))}
                    </Select>
                    {selectedInitiative?.key_results && selectedInitiative.key_results.length > 0 && (
                      <p className="text-xs text-muted-foreground pl-0.5">
                        KRs vinculados: {selectedInitiative.key_results.map(kr => kr.title).join(" · ")}
                      </p>
                    )}
                  </>
                )}
              </div>

              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

              <DialogFooter>
                <Button variant="outline" onClick={handleGenerate} disabled={convert.isPending}>
                  Regenerar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !result.epic_title || !selectedInitiativeId || activeInitiatives.length === 0}
                  title={!selectedInitiativeId ? "Selecciona una iniciativa para vincular la épica al OKR" : undefined}
                >
                  {creating ? "Creando..." : "Crear épica en backlog"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, highlight }: {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("p-4 flex-1 min-w-0", highlight && value > 0 && "border-red-200 dark:border-red-800")}>
      <p className={cn("text-2xl font-bold", highlight && value > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
        {value}
      </p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgreementsPage() {
  const [view,          setView]          = useState<ViewMode>("list");
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editAgreement, setEditAgreement] = useState<Agreement | null>(null);
  const [converting,    setConverting]    = useState<Agreement | null>(null);
  const [filters,       setFilters]       = useState<FilterState>(EMPTY_FILTERS);

  const { data: agreements, isPending } = useAgreements();
  const { data: stats } = useAgreementStats();

  const all = agreements ?? [];

  // Apply search + filter
  const filtered = useMemo(() => {
    let list = all;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.source?.toLowerCase().includes(q)) ||
        (a.description?.toLowerCase().includes(q)),
      );
    }
    if (filters.priority) list = list.filter(a => a.priority === filters.priority);
    if (filters.ownerId)  list = list.filter(a => a.owner_id === filters.ownerId);
    if (filters.cycleId)  list = list.filter(a => a.cycle_id === filters.cycleId);
    return list;
  }, [all, filters]);

  const overdue = all.filter(a => a.is_overdue && a.status !== "FULFILLED" && a.status !== "CANCELLED").length;

  function openCreate() { setEditAgreement(null); setDialogOpen(true); }
  function openEdit(a: Agreement) { setEditAgreement(a); setDialogOpen(true); }
  function mergeFilters(f: Partial<FilterState>) { setFilters(prev => ({ ...prev, ...f })); }

  if (isPending) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Acuerdos" description="Compromisos externos que generan trabajo interno" />
        <div className="flex gap-4 flex-wrap">
          {[1, 2, 3, 4].map(i => <div key={i} className="flex-1 h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Acuerdos"
        description="Compromisos externos que generan trabajo interno"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              {([
                { id: "list",   Icon: List,       label: "Lista"  },
                { id: "kanban", Icon: LayoutGrid, label: "Kanban" },
              ] as const).map(({ id, Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  title={label}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    view === id
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo acuerdo
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <StatCard label="Total"      value={stats?.total      ?? 0} />
        <StatCard label="Pendientes" value={stats?.pending     ?? 0} />
        <StatCard label="En proceso" value={stats?.in_progress ?? 0} />
        <StatCard label="Cumplidos"  value={stats?.fulfilled   ?? 0} />
        {overdue > 0 && (
          <StatCard label="Vencidos" value={overdue} sub="requieren atención" highlight />
        )}
      </div>

      {/* Expiring soon banner */}
      {all.length > 0 && <ExpiringBanner agreements={all} />}

      {/* Filter bar */}
      {all.length > 0 && (
        <FilterBar
          filters={filters}
          onChange={mergeFilters}
          agreements={all}
          onExportCSV={() => exportToCSV(filtered)}
          onExportPDF={() => exportToPDF(filtered)}
        />
      )}

      {/* Content */}
      {all.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={Handshake}
            title="Sin acuerdos"
            description="Registra compromisos de junta, clientes o reguladores para hacerles seguimiento."
            actionLabel="Registrar acuerdo"
            onAction={openCreate}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="Ningún acuerdo coincide con los filtros actuales."
            actionLabel="Limpiar filtros"
            onAction={() => setFilters(EMPTY_FILTERS)}
          />
        </Card>
      ) : view === "list" ? (
        <ListView agreements={filtered} onEdit={openEdit} onConvert={setConverting} onCreate={openCreate} />
      ) : (
        <KanbanView agreements={filtered} onEdit={openEdit} onConvert={setConverting} onCreate={openCreate} />
      )}

      <AgreementDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditAgreement(null); }}
        initial={editAgreement}
      />

      {converting && (
        <ConvertEpicDialog
          agreement={converting}
          onClose={() => setConverting(null)}
        />
      )}
    </div>
  );
}
