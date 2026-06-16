"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, TrendingUp } from "lucide-react";
import { useCloseSprint, type SprintBoard } from "@/hooks/useSprints";
import { cn } from "@/lib/utils";

interface CheckInSuggestion {
  kr_id: string;
  kr_title: string;
  metric_unit?: string;
  current_value: number;
  target_value: number;
  progress: number;
}

interface SprintCloseWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sprint: SprintBoard;
}

export function SprintCloseWizard({ open, onOpenChange, sprint }: SprintCloseWizardProps) {
  const [step, setStep] = useState<"velocity" | "checkins" | "done">("velocity");
  const [velocity, setVelocity] = useState(sprint.planned_velocity);
  const [suggestions, setSuggestions] = useState<CheckInSuggestion[]>([]);

  const close = useCloseSprint();

  async function handleClose() {
    const result = await close.mutateAsync({ id: sprint.sprint_id, velocity });
    const suggested = (result?.suggested_checkins ?? []) as CheckInSuggestion[];
    setSuggestions(suggested);
    setStep(suggested.length > 0 ? "checkins" : "done");
  }

  function reset() {
    setStep("velocity");
    setSuggestions([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar sprint — {sprint.sprint_name}</DialogTitle>
        </DialogHeader>

        {step === "velocity" && (
          <div className="space-y-5 pt-1">
            <p className="text-sm text-muted-foreground">
              ¿Cuántos puntos de historia completó el equipo en este sprint?
            </p>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Planificados", value: sprint.planned_velocity, color: "text-muted-foreground" },
                { label: "Completadas", value: sprint.done_count, color: "text-green-500" },
                { label: "Pendientes", value: sprint.todo_count + sprint.in_progress_count, color: "text-amber-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border p-3">
                  <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Velocidad real (puntos entregados)</label>
              <input
                type="number" min={0} value={velocity}
                onChange={(e) => setVelocity(Number(e.target.value))}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleClose} disabled={close.isPending} className="flex-1">
                {close.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Cerrar sprint
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {step === "checkins" && (
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              El sprint impacta estos KRs. ¿Quieres registrar los check-ins ahora?
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {suggestions.map((kr) => (
                <div key={kr.kr_id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" title={kr.kr_title}>{kr.kr_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(kr.progress)}% · valor actual: {kr.current_value} {kr.metric_unit}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    Meta: {kr.target_value}
                  </Badge>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Ve a la página de Check-ins para registrar el progreso detallado de cada KR.
            </p>

            <div className="flex gap-2">
              <Button onClick={() => setStep("done")} className="flex-1">Entendido</Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <p className="font-medium">¡Sprint cerrado!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Velocidad registrada: <strong>{velocity} puntos</strong>
              </p>
            </div>
            <Button onClick={reset} className="w-full">Continuar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
