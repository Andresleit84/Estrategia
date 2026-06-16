"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSuggestDelivery, type SuggestedPhase } from "@/hooks/useAI";
import { useCreatePhase, useCreateDeliverable } from "@/hooks/useDelivery";
import { useQueryClient } from "@tanstack/react-query";

// ── Loading ────────────────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  "Analizando el programa…",
  "Definiendo fases óptimas…",
  "Generando entregables por fase…",
  "Revisando criterios de aceptación…",
];

function LoadingState() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % LOADING_MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-5">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">{LOADING_MESSAGES[idx]}</p>
        <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
      </div>
    </div>
  );
}

// ── Phase card ─────────────────────────────────────────────────────────────────

const ACCENTS = [
  "border-violet-200 dark:border-violet-800",
  "border-blue-200 dark:border-blue-800",
  "border-emerald-200 dark:border-emerald-800",
  "border-amber-200 dark:border-amber-800",
  "border-rose-200 dark:border-rose-800",
  "border-indigo-200 dark:border-indigo-800",
];

function PhaseCard({ phase, index }: { phase: SuggestedPhase; index: number }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className={cn("rounded-xl border-2 bg-card overflow-hidden", ACCENTS[index % ACCENTS.length])}>
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {index + 1}
          </span>
          <span className="text-sm font-semibold truncate">{phase.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
          <span className="text-[10px]">{phase.deliverables.length} entregables</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {phase.description && (
            <p className="text-xs text-muted-foreground">{phase.description}</p>
          )}
          {phase.gate_criteria && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">Criterio de cierre</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">{phase.gate_criteria}</p>
            </div>
          )}
          <div className="space-y-1.5">
            {phase.deliverables.map((d, i) => (
              <div key={i} className="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  {d.title}
                </p>
                {d.acceptance_criteria && (
                  <p className="text-[10px] text-muted-foreground pl-4.5 leading-snug">{d.acceptance_criteria}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main dialog ────────────────────────────────────────────────────────────────

export function AiSuggestDeliveryDialog({
  open,
  onClose,
  programId,
  programName,
}: {
  open: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
}) {
  const suggest    = useSuggestDelivery();
  const createPhase = useCreatePhase();
  const createDeliv = useCreateDeliverable();
  const qc = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [done,     setDone]     = useState(false);

  const phases = (suggest.data?.phases ?? []) as SuggestedPhase[];
  const error  = suggest.data?.error as string | undefined;

  useEffect(() => {
    if (open) {
      suggest.reset();
      setDone(false);
      suggest.mutate({ program_id: programId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, programId]);

  async function handleCreateAll() {
    setCreating(true);
    try {
      for (const phase of phases) {
        const created = await createPhase.mutateAsync({
          programId,
          name: phase.name,
          description: phase.description || undefined,
          gate_criteria: phase.gate_criteria || undefined,
        });
        for (const d of phase.deliverables) {
          await createDeliv.mutateAsync({
            phaseId: created.id,
            programId,
            title: d.title,
            description: d.description || undefined,
            acceptance_criteria: d.acceptance_criteria || undefined,
          });
        }
      }
      await qc.invalidateQueries({ queryKey: ["delivery", "program", programId] });
      setDone(true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Sugerir fases con IA</DialogTitle>
              <DialogDescription>{programName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2">
          {suggest.isPending && <LoadingState />}

          {!suggest.isPending && (error || suggest.isError) && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle className="h-10 w-10 text-destructive/60" />
              <div>
                <p className="text-sm font-medium">No se pudieron generar sugerencias</p>
                <p className="text-xs text-muted-foreground mt-1">{error ?? "Error de conexión con la IA"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => suggest.mutate({ program_id: programId })} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Reintentar
              </Button>
            </div>
          )}

          {done && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div>
                <p className="text-sm font-semibold">¡Fases creadas exitosamente!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {phases.length} fases y {phases.reduce((s, p) => s + p.deliverables.length, 0)} entregables agregados al programa.
                </p>
              </div>
              <Button size="sm" onClick={onClose}>Cerrar</Button>
            </div>
          )}

          {!suggest.isPending && !error && !suggest.isError && phases.length > 0 && !done && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                La IA propone <strong>{phases.length} fases</strong> con <strong>{phases.reduce((s, p) => s + p.deliverables.length, 0)} entregables</strong> en total. Revísalas y crea todo con un clic.
              </p>

              <div className="space-y-3">
                {phases.map((phase, i) => (
                  <PhaseCard key={i} phase={phase} index={i} />
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  className="flex-1 gap-1.5"
                  onClick={handleCreateAll}
                  disabled={creating}
                >
                  {creating
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creando…</>
                    : <><Sparkles className="h-3.5 w-3.5" /> Crear todas las fases y entregables</>
                  }
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => suggest.mutate({ program_id: programId })}
                  disabled={suggest.isPending || creating}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
