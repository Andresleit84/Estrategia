"use client";

import { useEffect, useState } from "react";
import {
  Sparkles, RefreshCw, ChevronRight, AlertCircle, Zap,
  Flag, Clock, ListChecks, Compass, CalendarRange, Zap as ZapQ,
  Building2, Link2, ShieldAlert,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSuggestInitiatives, type InitiativeSuggestion } from "@/hooks/useAI";

const LOADING_MESSAGES = [
  "Analizando objetivos activos…",
  "Revisando KRs en riesgo…",
  "Buscando brechas de ejecución…",
  "Generando iniciativas alineadas…",
];

function LoadingState() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-14 gap-5">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{LOADING_MESSAGES[msgIdx]}</p>
        <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
      </div>
    </div>
  );
}

const HORIZON_CONFIG = {
  CUSTOM:     { label: "Estratégico 3-5 años", icon: Compass,       className: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
  ANNUAL:     { label: "Anual",                icon: CalendarRange, className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  QUARTERLY:  { label: "Trimestral",           icon: ZapQ,          className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
} as const;

const PRIORITY_STYLES: Record<InitiativeSuggestion['priority'], string> = {
  HIGH:   "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  MEDIUM: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  LOW:    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

const PRIORITY_LABELS: Record<InitiativeSuggestion['priority'], string> = {
  HIGH: "Alta prioridad",
  MEDIUM: "Media prioridad",
  LOW: "Baja prioridad",
};

function SuggestionCard({
  suggestion,
  index,
  onApply,
}: {
  suggestion: InitiativeSuggestion;
  index: number;
  onApply: (s: InitiativeSuggestion) => void;
}) {
  const ACCENTS = [
    { border: "border-violet-200 dark:border-violet-800", badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
    { border: "border-blue-200 dark:border-blue-800",     badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
    { border: "border-emerald-200 dark:border-emerald-800", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
  ];
  const accent = ACCENTS[index % ACCENTS.length];

  return (
    <div className={cn("rounded-xl border-2 bg-card p-4 space-y-3 transition-all hover:shadow-md", accent.border)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", accent.badge)}>
              Opción {index + 1}
            </span>
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
              PRIORITY_STYLES[suggestion.priority]
            )}>
              <Flag className="h-2.5 w-2.5" />
              {PRIORITY_LABELS[suggestion.priority]}
            </span>
            {suggestion.target_cycle_horizon && HORIZON_CONFIG[suggestion.target_cycle_horizon] && (() => {
              const h = HORIZON_CONFIG[suggestion.target_cycle_horizon!];
              const HIcon = h.icon;
              return (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                  h.className
                )}>
                  <HIcon className="h-2.5 w-2.5" />
                  {h.label}
                </span>
              );
            })()}
          </div>
          <h3 className="text-sm font-bold text-foreground leading-snug">{suggestion.title}</h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.description}</p>

      {/* Rationale */}
      {suggestion.rationale && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground/80 bg-muted/40 rounded-lg px-2.5 py-1.5">
          <Zap className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
          <span>{suggestion.rationale}</span>
        </div>
      )}

      {/* Aligned objectives */}
      {suggestion.aligned_objectives?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Objetivos que impulsa
          </p>
          <div className="flex flex-wrap gap-1">
            {suggestion.aligned_objectives.map((obj, i) => (
              <span
                key={i}
                className="inline-block text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full border truncate max-w-[200px]"
                title={obj}
              >
                {obj}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      {suggestion.milestones?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <ListChecks className="h-3 w-3" /> Hitos clave
          </p>
          <ol className="space-y-0.5">
            {suggestion.milestones.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="shrink-0 font-mono text-[10px] bg-muted rounded px-1 mt-0.5">{i + 1}</span>
                <span className="leading-snug">
                  {m.title}
                  <span className="ml-1 text-muted-foreground/50">(semana {m.week_offset})</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Areas */}
      {(suggestion.primary_area || (suggestion.involved_areas?.length ?? 0) > 0) && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Áreas
          </p>
          <div className="flex flex-wrap gap-1">
            {suggestion.primary_area && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-semibold">
                {suggestion.primary_area} <span className="opacity-60">(principal)</span>
              </span>
            )}
            {suggestion.involved_areas?.filter((a) => a !== suggestion.primary_area).map((a, i) => (
              <span key={i} className="inline-block text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full border">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggested dependencies */}
      {(suggestion.suggested_dependencies?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Bloqueadores a destrabar
          </p>
          <ul className="space-y-0.5">
            {suggestion.suggested_dependencies!.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                <span>{d.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Duration */}
      {suggestion.estimated_duration_weeks > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          Duración estimada: <span className="font-medium text-foreground">{suggestion.estimated_duration_weeks} semanas</span>
        </div>
      )}

      {/* Action */}
      <Button
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => onApply(suggestion)}
      >
        Crear esta iniciativa
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function AiSuggestInitiativesDialog({
  open,
  onClose,
  cycleId,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  onApply: (suggestion: InitiativeSuggestion) => void;
}) {
  const suggest = useSuggestInitiatives();

  const suggestions = (suggest.data?.suggestions ?? []) as InitiativeSuggestion[];
  const error = suggest.data?.error as string | undefined;

  useEffect(() => {
    if (open) {
      suggest.reset();
      suggest.mutate({ cycle_id: cycleId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cycleId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Sugerir iniciativas con IA</DialogTitle>
              <DialogDescription>
                Proyectos alineados a tus objetivos activos y KRs en riesgo
              </DialogDescription>
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
              <Button
                size="sm" variant="outline"
                onClick={() => suggest.mutate({ cycle_id: cycleId })}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reintentar
              </Button>
            </div>
          )}

          {!suggest.isPending && !error && !suggest.isError && suggestions.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Selecciona una propuesta para pre-rellenar el formulario. Podrás revisarla antes de crear.
              </p>
              <div className="grid gap-3">
                {suggestions.map((s, i) => (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    index={i}
                    onApply={onApply}
                  />
                ))}
              </div>
              <Button
                variant="ghost" size="sm"
                className="w-full h-8 text-xs gap-1.5 text-muted-foreground"
                onClick={() => suggest.mutate({ cycle_id: cycleId })}
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
