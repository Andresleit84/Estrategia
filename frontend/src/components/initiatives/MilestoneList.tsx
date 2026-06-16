"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Trash2, Plus, Loader2, AlertCircle } from "lucide-react";
import {
  useCreateMilestone, useCompleteMilestone, useDeleteMilestone,
  type Milestone,
} from "@/hooks/useInitiatives";

function formatDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function statusColor(m: Milestone) {
  if (m.status === "COMPLETED") return "text-green-600 line-through opacity-60";
  if (m.is_overdue)             return "text-red-500";
  return "";
}

interface MilestoneListProps {
  initiativeId: string;
  milestones: Milestone[];
  canEdit?: boolean;
}

export function MilestoneList({ initiativeId, milestones, canEdit = true }: MilestoneListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate]   = useState("");
  const [adding, setAdding]     = useState(false);

  const createM    = useCreateMilestone();
  const completeM  = useCompleteMilestone();
  const deleteM    = useDeleteMilestone();

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await createM.mutateAsync({
      initiativeId,
      title: newTitle.trim(),
      due_date: newDate || undefined,
    });
    setNewTitle("");
    setNewDate("");
    setAdding(false);
  }

  async function handleComplete(m: Milestone) {
    if (m.status === "COMPLETED") return;
    await completeM.mutateAsync({ initiativeId, milestoneId: m.id });
  }

  return (
    <div className="space-y-1">
      {milestones.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground py-2">Sin hitos definidos.</p>
      )}

      {milestones.map((m) => (
        <div key={m.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
          <button
            onClick={() => handleComplete(m)}
            disabled={m.status === "COMPLETED" || completeM.isPending}
            className={cn(
              "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
              m.status === "COMPLETED"
                ? "bg-green-500 border-green-500 text-white"
                : "border-muted-foreground/40 hover:border-primary"
            )}
            aria-label={m.status === "COMPLETED" ? "Completado" : "Marcar como completado"}
          >
            {m.status === "COMPLETED" && <Check className="h-3 w-3" />}
          </button>

          <div className="flex-1 min-w-0">
            <span className={cn("text-sm", statusColor(m))}>{m.title}</span>
            {m.due_date && (
              <span className={cn("ml-2 text-xs", m.is_overdue ? "text-red-500" : "text-muted-foreground")}>
                {m.is_overdue && <AlertCircle className="inline h-3 w-3 mr-0.5" />}
                {formatDate(m.due_date)}
              </span>
            )}
            {m.assignee_name && (
              <span className="ml-2 text-xs text-muted-foreground">· {m.assignee_name}</span>
            )}
          </div>

          {canEdit && m.status !== "COMPLETED" && (
            <button
              onClick={() => deleteM.mutateAsync({ initiativeId, milestoneId: m.id })}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              aria-label="Eliminar hito"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nombre del hito..."
            className="h-8 flex-1 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim() || createM.isPending} className="h-8">
            {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Añadir"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-8">Cancelar</Button>
        </div>
      ) : canEdit && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir hito
        </button>
      )}
    </div>
  );
}
