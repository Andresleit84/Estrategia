"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Zap, CalendarRange } from "lucide-react";
import { useGenerateSprints } from "@/hooks/useSprints";
import { useTeams } from "@/hooks/useTeams";
import type { Cycle } from "@/hooks/useCycles";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cycle: Cycle;
}

const LENGTHS = [
  { weeks: 1, label: "1 semana" },
  { weeks: 2, label: "2 semanas" },
  { weeks: 3, label: "3 semanas" },
  { weeks: 4, label: "4 semanas" },
];

export function GenerateSprintsDialog({ open, onOpenChange, cycle }: Props) {
  const { data: teams = [] } = useTeams();
  const generate = useGenerateSprints();

  const [teamId, setTeamId]       = useState("");
  const [weeks, setWeeks]         = useState(2);
  const [velocity, setVelocity]   = useState(0);

  const estimatedCount = useMemo(() => {
    if (!cycle.start_date || !cycle.end_date) return 0;
    const start = new Date(cycle.start_date).getTime();
    const end   = new Date(cycle.end_date).getTime();
    const days  = Math.max(0, (end - start) / 86_400_000);
    return Math.min(52, Math.ceil(days / (weeks * 7)));
  }, [cycle.start_date, cycle.end_date, weeks]);

  async function handleSubmit() {
    if (!teamId) return;
    await generate.mutateAsync({
      cycle_id: cycle.id,
      team_id: teamId,
      sprint_length_weeks: weeks,
      planned_velocity: velocity || undefined,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Generar sprints automáticamente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Cycle info */}
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">{cycle.name}</span>
            <span className="ml-auto">
              {new Date(cycle.start_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
              {" → "}
              {new Date(cycle.end_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          {/* Team */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Equipo</label>
            <select
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Seleccionar equipo…</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Sprint length */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Duración de cada sprint</label>
            <div className="grid grid-cols-4 gap-2">
              {LENGTHS.map(({ weeks: w, label }) => (
                <button
                  key={w}
                  onClick={() => setWeeks(w)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    weeks === w
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Velocity */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Velocidad planificada (pts) — opcional</label>
            <input
              type="number"
              min={0}
              value={velocity || ""}
              onChange={e => setVelocity(Number(e.target.value))}
              placeholder="0"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Preview */}
          {estimatedCount > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-primary tabular-nums">{estimatedCount}</p>
              <p className="text-xs text-muted-foreground">
                sprints de {weeks} {weeks === 1 ? "semana" : "semanas"} cubrirán el ciclo
              </p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Los sprints en estado <strong>Planificando</strong> existentes para este equipo y ciclo serán eliminados y reemplazados. Los sprints <strong>Activos</strong> o <strong>Completados</strong> no se tocan.</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!teamId || generate.isPending}
            className="gap-1.5"
          >
            {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Generar {estimatedCount > 0 ? `${estimatedCount} sprints` : "sprints"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
