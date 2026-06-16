"use client";

import { useState } from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { StatusChip } from "@/components/okr/StatusChip";
import { MilestoneList } from "./MilestoneList";
import { cn } from "@/lib/utils";
import { type Initiative } from "@/hooks/useInitiatives";
import { useDeleteInitiative, useUpdateInitiative } from "@/hooks/useInitiatives";
import {
  Target, Calendar, AlertCircle, AlertTriangle, CheckCircle2, Edit2, Trash2,
  Building2, Link2, ShieldAlert, CheckCheck, Loader2,
} from "lucide-react";
import { useUpdateDependency } from "@/hooks/useInitiatives";
import type { InitiativeDependency } from "@/hooks/useInitiatives";

// ── Structured description renderer ──────────────────────────────────────────

const SECTION_KEYS = [
  "Problema que resuelve",
  "Alcance (qué incluye / qué no)",
  "Criterio de éxito",
  "Dependencias",
];

function StructuredDescription({ text }: { text: string }) {
  const lines = text.split("\n");
  const sections: { label: string; content: string[] }[] = [];
  let current: { label: string; content: string[] } | null = null;

  for (const line of lines) {
    const matchedKey = SECTION_KEYS.find((k) => line.startsWith(k + ":"));
    if (matchedKey) {
      if (current) sections.push(current);
      const rest = line.slice(matchedKey.length + 1).trim();
      current = { label: matchedKey, content: rest ? [rest] : [] };
    } else if (current) {
      if (line.trim()) current.content.push(line.trim());
    } else {
      // No section match yet — plain intro text
      if (line.trim()) {
        if (!sections.length) sections.push({ label: "", content: [line.trim()] });
        else sections[sections.length - 1].content.push(line.trim());
      }
    }
  }
  if (current) sections.push(current);

  // If no sections were parsed, render plain
  if (sections.length === 0 || (sections.length === 1 && !sections[0].label)) {
    return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <div key={i} className="space-y-0.5">
          {s.label && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
          )}
          <p className="text-sm text-foreground leading-relaxed">
            {s.content.join(" ") || <span className="text-muted-foreground italic">—</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  TODO: "Por hacer", IN_PROGRESS: "En progreso", DONE: "Completada", CANCELLED: "Cancelada",
};

const DEP_TYPE_LABELS: Record<string, string> = {
  INTERNAL: "Interna", EXTERNAL: "Externa", DECISION: "Decisión",
};
const DEP_STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  RESOLVED:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  BLOCKED:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};
const DEP_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente", IN_PROGRESS: "En progreso", RESOLVED: "Resuelto", BLOCKED: "Bloqueado",
};

function DependencyItem({ dep, initiativeId }: { dep: InitiativeDependency; initiativeId: string }) {
  const update = useUpdateDependency();
  return (
    <div className="rounded-lg border px-3 py-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", DEP_STATUS_COLORS[dep.status])}>
            {DEP_STATUS_LABELS[dep.status]}
          </span>
          <span className="text-[10px] text-muted-foreground">{DEP_TYPE_LABELS[dep.type]}</span>
        </div>
        {dep.status !== "RESOLVED" && (
          <button
            onClick={() => update.mutate({ initiativeId, depId: dep.id, status: "RESOLVED" })}
            disabled={update.isPending}
            className="text-[10px] text-green-600 hover:text-green-700 flex items-center gap-0.5 shrink-0"
          >
            {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
            Resolver
          </button>
        )}
      </div>
      <p className="text-xs text-foreground leading-relaxed">{dep.description}</p>
      {dep.depends_on_title && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Link2 className="h-2.5 w-2.5" />
          Iniciativa relacionada: <span className="font-medium">{dep.depends_on_title}</span>
        </p>
      )}
    </div>
  );
}

const HEALTH_COLOR: Record<string, string> = {
  ON_TRACK: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  AT_RISK:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  OVERDUE:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  BEHIND:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  COMPLETED:"bg-green-100 text-green-700",
  CANCELLED:"bg-muted text-muted-foreground",
};

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

interface InitiativeDrawerProps {
  initiative: Initiative | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (i: Initiative) => void;
}

export function InitiativeDrawer({ initiative: init, open, onOpenChange, onEdit }: InitiativeDrawerProps) {
  const deleteInit      = useDeleteInitiative();
  const updateInit      = useUpdateInitiative();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!init) return null;

  const health = init.is_overdue
    ? "OVERDUE"
    : init.status === "DONE"
    ? "COMPLETED"
    : init.status === "CANCELLED"
    ? "CANCELLED"
    : init.progress >= 70
    ? "ON_TRACK"
    : init.progress >= 40
    ? "AT_RISK"
    : "BEHIND";

  async function handleDelete() {
    await deleteInit.mutateAsync(init!.id);
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) setConfirmDelete(false); onOpenChange(v); }} direction="right">
      <DrawerContent className="w-full sm:max-w-lg overflow-y-auto">
        <DrawerHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="text-base leading-snug">
                {init.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5 align-middle">{init.code}</span>}
                {init.title}
              </DrawerTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", HEALTH_COLOR[health])}>
                  {health === "ON_TRACK" ? "En tiempo" : health === "AT_RISK" ? "En riesgo" : health === "OVERDUE" ? "Vencida" : health === "BEHIND" ? "Atrasada" : STATUS_LABELS[init.status]}
                </span>
                {init.team_name && (
                  <Badge variant="outline" className="text-[10px]">{init.team_name}</Badge>
                )}
                {init.is_overdue && (
                  <span className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {init.days_overdue} días de retraso
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(init)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        {confirmDelete && (
          <div className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Se eliminará la iniciativa y todos sus hitos. Esta acción no se puede deshacer.</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm" variant="destructive" className="h-7 text-xs"
                disabled={deleteInit.isPending}
                onClick={handleDelete}
              >
                {deleteInit.isPending ? "Eliminando…" : "Confirmar eliminación"}
              </Button>
              <Button
                size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 space-y-5">
          {/* Progress ring + stats */}
          <div className="flex items-center gap-4 p-3 rounded-xl border bg-muted/20">
            <ProgressRing progress={init.progress} size={64} className="shrink-0" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Progreso general</span>
                <StatusChip status={init.status} />
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    init.progress >= 70 ? "bg-green-500" : init.progress >= 40 ? "bg-amber-500" : "bg-blue-500"
                  )}
                  style={{ width: `${Math.min(100, init.progress)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {init.completed_milestones} / {init.total_milestones} hitos completados
              </p>
            </div>
          </div>

          {/* Description */}
          {init.description && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descripción</p>
              <StructuredDescription text={init.description} />
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Inicio</p>
              <p className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{formatDate(init.start_date)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Fecha límite</p>
              <p className={cn("flex items-center gap-1", init.is_overdue ? "text-red-500" : "")}>
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(init.due_date)}
              </p>
            </div>
            {init.owner_name && (
              <div className="space-y-0.5 col-span-2">
                <p className="text-xs text-muted-foreground">Responsable</p>
                <p className="text-sm">{init.owner_name}</p>
              </div>
            )}
          </div>

          {/* Areas */}
          {(init.primary_area_name || (init.involved_areas?.length ?? 0) > 0) && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Áreas involucradas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {init.primary_area_name && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-2 border-primary/40 bg-primary/10 text-primary">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: init.primary_area_color ?? "#6366f1" }} />
                    {init.primary_area_name}
                    <span className="text-[9px] font-bold uppercase opacity-70">principal</span>
                  </span>
                )}
                {init.involved_areas?.filter((a) => !a.is_primary).map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-muted text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {(init.dependencies?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3" />
                Bloqueadores / Dependencias
                {(init.open_dependencies_count ?? 0) > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-bold">
                    {init.open_dependencies_count} pendiente{init.open_dependencies_count !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
              <div className="space-y-2">
                {init.dependencies.map((dep) => (
                  <DependencyItem key={dep.id} dep={dep} initiativeId={init.id} />
                ))}
              </div>
            </div>
          )}

          {/* KRs */}
          {init.key_results?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">KRs vinculados</p>
              <div className="space-y-1.5">
                {init.key_results.map((kr) => (
                  <div key={kr.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {(kr as any).code && <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{(kr as any).code}</span>}
                    <span className="text-sm flex-1 truncate">{kr.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", kr.progress >= 70 ? "bg-green-500" : kr.progress >= 40 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${Math.min(100, kr.progress)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(kr.progress)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hitos</p>
              {init.status === "DONE" && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completada
                </span>
              )}
            </div>
            <MilestoneList
              initiativeId={init.id}
              milestones={init.milestones ?? []}
              canEdit={!["DONE", "CANCELLED"].includes(init.status)}
            />
          </div>

          {/* Status changer */}
          {!["DONE", "CANCELLED"].includes(init.status) && (
            <div className="flex gap-2 pt-2 border-t">
              {init.status !== "IN_PROGRESS" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateInit.mutateAsync({ id: init.id, status: "IN_PROGRESS" })}
                  disabled={updateInit.isPending}
                >
                  Iniciar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateInit.mutateAsync({ id: init.id, status: "DONE" })}
                disabled={updateInit.isPending}
              >
                Completar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => updateInit.mutateAsync({ id: init.id, status: "CANCELLED" })}
                disabled={updateInit.isPending}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
