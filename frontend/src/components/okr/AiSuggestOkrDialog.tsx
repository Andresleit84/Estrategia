"use client";

import React, { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import { Sparkles, RefreshCw, ChevronRight, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle, Zap, Users, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSuggestOkrs, type OkrSuggestion } from "@/hooks/useAI";
import { useCreateObjective, type Objective } from "@/hooks/useObjectives";
import { useCreateKeyResult } from "@/hooks/useKeyResults";

const KR_TYPE_ICONS = {
  INCREASE: TrendingUp,
  DECREASE: TrendingDown,
  MAINTAIN: Minus,
  ACHIEVE:  CheckCircle2,
};

const KR_TYPE_LABELS = {
  INCREASE: "Aumentar",
  DECREASE: "Reducir",
  MAINTAIN: "Mantener",
  ACHIEVE:  "Lograr",
};

const LOADING_MESSAGES = [
  "Analizando el contexto de tu organización…",
  "Revisando objetivos existentes…",
  "Aplicando metodología OKR…",
  "Generando propuestas ambiciosas…",
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
        <p className="text-xs text-muted-foreground">Puede tardar 15-30 segundos</p>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  index,
  onApply,
  applying,
}: {
  suggestion: OkrSuggestion;
  index: number;
  onApply: (s: OkrSuggestion) => void;
  applying: boolean;
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
        <div className="space-y-1 flex-1 min-w-0">
          <span className={cn("inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", accent.badge)}>
            Opción {index + 1}
          </span>
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

      {/* KR chips */}
      {suggestion.key_results?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Key Results sugeridos
          </p>
          <div className="space-y-1">
            {suggestion.key_results.map((kr, i) => {
              const Icon = KR_TYPE_ICONS[kr.type] ?? TrendingUp;
              return (
                <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />
                  <span className="leading-snug">
                    {kr.title}
                    {kr.type !== "ACHIEVE" && (
                      <span className="ml-1 text-muted-foreground/60">
                        ({KR_TYPE_LABELS[kr.type]} {kr.start_value} → {kr.target_value} {kr.metric_unit})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action */}
      <Button
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => onApply(suggestion)}
        disabled={applying}
      >
        {applying ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Creando…
          </>
        ) : (
          <>
            Crear este objetivo
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
      </Button>
    </div>
  );
}

type OkrLevel = "COMPANY" | "AREA" | "TEAM" | "INDIVIDUAL";

const LEVEL_OPTIONS: { value: OkrLevel; label: string; Icon: React.ElementType }[] = [
  { value: "TEAM",       label: "Equipo",     Icon: Users },
  { value: "INDIVIDUAL", label: "Individual", Icon: UserCircle },
];

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function AiSuggestOkrDialog({
  open,
  onClose,
  cycleId,
  cycleType,
  level: levelProp,
  tacticalMode,
  parentObjectives,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  cycleType: string;
  level: OkrLevel;
  tacticalMode?: boolean;
  parentObjectives?: Objective[];
  onCreated?: () => void;
}) {
  const suggest      = useSuggestOkrs();
  const createObj    = useCreateObjective();
  const createKr     = useCreateKeyResult();
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const [applyError,  setApplyError]  = useState<string | null>(null);
  const [level, setLevel] = useState<OkrLevel>(levelProp);
  const [parentId, setParentId] = useState<string>("");

  const suggestions  = (suggest.data?.suggestions ?? []) as OkrSuggestion[];
  const error        = suggest.data?.error as string | undefined;

  function triggerSuggest(l: OkrLevel) {
    suggest.reset();
    suggest.mutate({ cycle_id: cycleId, level: l, cycle_type: cycleType });
  }

  // Auto-trigger on open
  useEffect(() => {
    if (open) {
      setLevel(levelProp);
      setParentId("");
      setApplyError(null);
      triggerSuggest(levelProp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cycleId, levelProp, cycleType]);

  function handleLevelChange(l: OkrLevel) {
    setLevel(l);
    setParentId("");
    setApplyError(null);
    triggerSuggest(l);
  }

  async function handleApply(suggestion: OkrSuggestion, index: number) {
    if (tacticalMode && !parentId) {
      setApplyError("Debes seleccionar un objetivo padre antes de crear.");
      return;
    }
    setApplyingIdx(index);
    setApplyError(null);
    try {
      const obj = await createObj.mutateAsync({
        title:               suggestion.title,
        description:         suggestion.description,
        level,
        cycle_id:            cycleId,
        parent_objective_id: parentId || undefined,
      }) as { id: string };

      for (const kr of (suggestion.key_results ?? [])) {
        await createKr.mutateAsync({
          objId:        obj.id,
          title:        kr.title,
          type:         kr.type,
          metric_unit:  kr.metric_unit,
          start_value:  kr.start_value ?? 0,
          target_value: kr.type === "ACHIEVE" ? 1 : (kr.target_value ?? 100),
        });
      }

      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setApplyError(getApiErrorMessage(err, "Error al crear el objetivo. Intenta de nuevo."));
    } finally {
      setApplyingIdx(null);
    }
  }

  const levelLabel = level === "COMPANY" ? "empresa" : level === "AREA" ? "área" : level === "TEAM" ? "equipo" : "individual";
  const typeLabel  = cycleType === "CUSTOM" ? "estratégico" : cycleType === "ANNUAL" ? "anual" : "trimestral";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Sugerir OKRs con IA</DialogTitle>
              <DialogDescription>
                OKRs de {levelLabel} para el ciclo {typeLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {tacticalMode && (
          <div className="flex gap-2 -mt-1">
            {LEVEL_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleLevelChange(value)}
                disabled={suggest.isPending}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                  level === value
                    ? "border-primary bg-primary/8 text-foreground shadow-sm"
                    : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        )}

        {tacticalMode && parentObjectives && parentObjectives.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Objetivo padre <span className="text-destructive">*</span>
            </label>
            <select
              value={parentId}
              onChange={(e) => { setParentId(e.target.value); setApplyError(null); }}
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                !parentId && applyError ? "border-destructive" : "border-border",
              )}
            >
              <option value="">— Selecciona un objetivo padre —</option>
              {parentObjectives.map(o => (
                <option key={o.id} value={o.id}>
                  {o.level === "COMPANY" ? "🏢" : "🏷"} {o.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {applyError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {applyError}
          </p>
        )}

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
                onClick={() => triggerSuggest(level)}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reintentar
              </Button>
            </div>
          )}

          {!suggest.isPending && !error && !suggest.isError && suggest.isSuccess && suggestions.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">Sin sugerencias disponibles</p>
                <p className="text-xs text-muted-foreground mt-1">No hay suficiente contexto aún. Intenta de nuevo.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => triggerSuggest(level)} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Reintentar
              </Button>
            </div>
          )}

          {!suggest.isPending && !error && !suggest.isError && suggestions.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Selecciona una propuesta para crearla junto con sus Key Results. Puedes editarlo después.
              </p>
              <div className="grid gap-3 sm:grid-cols-1">
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
                onClick={() => triggerSuggest(level)}
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
