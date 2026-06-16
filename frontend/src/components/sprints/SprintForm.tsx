"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useCreateSprint, useUpdateSprint, type Sprint } from "@/hooks/useSprints";
import { useActiveCycle } from "@/hooks/useCycles";
import { useTeams } from "@/hooks/useTeams";

interface SprintFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Sprint | null;
  defaultTeamId?: string;
}

const SPR_TEMPLATE = `Meta:\nCapacidad del equipo:\nRiesgo identificado:`;

export function SprintForm({ open, onOpenChange, editing, defaultTeamId }: SprintFormProps) {
  const { data: cycle } = useActiveCycle();
  const { data: teams = [] } = useTeams();

  const [name, setName]               = useState("");
  const [goal, setGoal]               = useState(SPR_TEMPLATE);
  const [teamId, setTeamId]           = useState(defaultTeamId ?? "");
  const [startDate, setStart]         = useState("");
  const [endDate, setEnd]             = useState("");
  const [velocity, setVelocity]       = useState(0);

  useEffect(() => {
    if (open) {
      setName(editing?.sprint_name ?? "");
      setGoal(editing?.goal ?? SPR_TEMPLATE);
      setTeamId(editing?.team_id ?? defaultTeamId ?? "");
      setStart(editing?.start_date?.slice(0, 10) ?? "");
      setEnd(editing?.end_date?.slice(0, 10) ?? "");
      setVelocity(editing?.planned_velocity ?? 0);
    }
  }, [open, editing?.sprint_id]);

  const create = useCreateSprint();
  const update = useUpdateSprint();
  const loading = create.isPending || update.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;

    if (editing) {
      const goalClean = (goal.trim() === SPR_TEMPLATE.trim() || !goal.trim()) ? undefined : goal.trim();
      await update.mutateAsync({ id: editing.sprint_id, name: name.trim(), goal: goalClean, start_date: startDate, end_date: endDate, planned_velocity: velocity });
    } else {
      if (!cycle?.id || !teamId) return;
      const goalClean = (goal.trim() === SPR_TEMPLATE.trim() || !goal.trim()) ? undefined : goal.trim();
      await create.mutateAsync({ cycle_id: cycle.id, team_id: teamId, name: name.trim(), goal: goalClean, start_date: startDate, end_date: endDate, planned_velocity: velocity });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar sprint" : "Nuevo sprint"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {!editing && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Equipo *</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
                className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar equipo…</option>
                {(teams as any[]).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sprint 1 — Fundamentos"
              className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required minLength={2} maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Sprint Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Meta del sprint · Capacidad disponible del equipo · Riesgo o impedimento conocido</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Inicio *</label>
              <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required
                className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fin *</label>
              <input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required
                className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Velocidad planificada (puntos)</label>
            <input type="number" value={velocity} min={0} onChange={(e) => setVelocity(Number(e.target.value))}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !name.trim() || !startDate || !endDate} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Guardar cambios" : "Crear sprint"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
