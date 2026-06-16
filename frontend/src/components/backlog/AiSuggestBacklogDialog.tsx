"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  Sparkles, RefreshCw, ChevronRight, AlertCircle, Zap,
  Layers, BookOpen, AlertTriangle, TrendingUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSuggestBacklog, type BacklogSuggestion } from "@/hooks/useAI";
import { useCreateBacklogItem } from "@/hooks/useBacklog";

const PRIORITY_COLORS: Record<string, { badge: string; dot: string }> = {
  CRITICAL: { badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",    dot: "bg-red-500" },
  HIGH:     { badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", dot: "bg-orange-400" },
  MEDIUM:   { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",  dot: "bg-amber-400" },
  LOW:      { badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",    dot: "bg-gray-300" },
};
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja",
};

const LOADING_MESSAGES = [
  "Analizando iniciativas activas…",
  "Revisando el backlog existente…",
  "Identificando capacidades clave…",
  "Redactando épicas con contexto…",
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
        <p className="text-sm font-medium text-foreground">{LOADING_MESSAGES[idx]}</p>
        <p className="text-xs text-muted-foreground">Puede tardar 15-30 segundos</p>
      </div>
    </div>
  );
}

const ACCENTS = [
  { border: "border-violet-200 dark:border-violet-800", badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
  { border: "border-blue-200 dark:border-blue-800",     badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  { border: "border-emerald-200 dark:border-emerald-800", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
];

function SuggestionCard({
  suggestion, index, onApply, applying,
}: {
  suggestion: BacklogSuggestion;
  index: number;
  onApply: (s: BacklogSuggestion) => void;
  applying: boolean;
}) {
  const accent = ACCENTS[index % ACCENTS.length];
  const pc = PRIORITY_COLORS[suggestion.priority] ?? PRIORITY_COLORS.MEDIUM;

  return (
    <div className={cn("rounded-xl border-2 bg-card p-4 space-y-3 transition-all hover:shadow-md", accent.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", accent.badge)}>
              Opción {index + 1}
            </span>
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded", pc.badge)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", pc.dot)} />
              {PRIORITY_LABELS[suggestion.priority]}
            </span>
          </div>
          <h3 className="text-sm font-bold text-foreground leading-snug flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            {suggestion.title}
          </h3>
        </div>
      </div>

      {suggestion.rationale && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground/80 bg-muted/40 rounded-lg px-2.5 py-1.5">
          <Zap className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
          <span>{suggestion.rationale}</span>
        </div>
      )}

      {suggestion.features?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Features incluidas ({suggestion.features.length})
          </p>
          <div className="space-y-1">
            {suggestion.features.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3 w-3 shrink-0 mt-0.5 text-blue-400" />
                <span className="leading-snug">{f.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestion.initiative_hint && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <TrendingUp className="h-3 w-3 shrink-0 text-green-500" />
          <span>Alineada a: <span className="font-medium">{suggestion.initiative_hint}</span></span>
        </div>
      )}

      <Button
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => onApply(suggestion)}
        disabled={applying}
      >
        {applying ? (
          <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Creando épica…</>
        ) : (
          <>Crear esta épica <ChevronRight className="h-3.5 w-3.5" /></>
        )}
      </Button>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function AiSuggestBacklogDialog({
  open,
  onClose,
  cycleId,
}: {
  open: boolean;
  onClose: () => void;
  cycleId?: string;
}) {
  const suggest   = useSuggestBacklog();
  const createItem = useCreateBacklogItem();
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [applyError,  setApplyError]  = useState<string | null>(null);

  const suggestions = (suggest.data?.suggestions ?? []) as BacklogSuggestion[];
  const error       = suggest.data?.error as string | undefined;

  function triggerSuggest() {
    suggest.reset();
    suggest.mutate({ cycle_id: cycleId });
  }

  useEffect(() => {
    if (open) {
      setApplyError(null);
      triggerSuggest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cycleId]);

  async function handleApply(suggestion: BacklogSuggestion, index: number) {
    setApplyingIdx(index);
    setApplyError(null);
    try {
      const epic = await createItem.mutateAsync({
        type:                "EPIC",
        title:               suggestion.title,
        description:         suggestion.description,
        acceptance_criteria: suggestion.acceptance_criteria || undefined,
        priority:            suggestion.priority,
        cycle_id:            cycleId,
      }) as { id: string };

      for (const feature of (suggestion.features ?? [])) {
        await createItem.mutateAsync({
          type:                "FEATURE",
          title:               feature.title,
          description:         feature.description,
          acceptance_criteria: feature.acceptance_criteria || undefined,
          priority:            suggestion.priority === "CRITICAL" ? "HIGH" : suggestion.priority,
          parent_id:           epic.id,
          cycle_id:            cycleId,
        });
      }

      onClose();
    } catch (err: unknown) {
      setApplyError(getApiErrorMessage(err, "Error al crear la épica."));
    } finally {
      setApplyingIdx(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Sugerir épicas con IA</DialogTitle>
              <DialogDescription>
                Épicas alineadas a tus iniciativas y objetivos activos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {applyError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {applyError}
          </p>
        )}

        <div className="mt-2">
          {suggest.isPending && <LoadingState />}

          {!suggest.isPending && (error || suggest.isError) && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive/60" />
              <div>
                <p className="text-sm font-medium">No se pudieron generar sugerencias</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error ?? (suggest.error as Error)?.message ?? "Error de conexión con la IA"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={triggerSuggest} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Reintentar
              </Button>
            </div>
          )}

          {!suggest.isPending && !error && !suggest.isError && suggest.isSuccess && suggestions.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">Sin sugerencias disponibles</p>
                <p className="text-xs text-muted-foreground mt-1">Agrega iniciativas u objetivos activos para obtener mejores sugerencias.</p>
              </div>
              <Button size="sm" variant="outline" onClick={triggerSuggest} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Reintentar
              </Button>
            </div>
          )}

          {!suggest.isPending && !error && !suggest.isError && suggestions.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Selecciona una propuesta para crearla junto con sus features. Puedes editarla después.
              </p>
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    index={i}
                    onApply={(sg) => handleApply(sg, i)}
                    applying={applyingIdx === i}
                  />
                ))}
              </div>
              <Button
                variant="ghost" size="sm"
                className="w-full h-8 text-xs gap-1.5 text-muted-foreground"
                onClick={triggerSuggest}
                disabled={suggest.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Generar otras sugerencias
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
