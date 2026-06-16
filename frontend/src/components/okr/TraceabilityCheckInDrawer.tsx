"use client";

import { useState } from "react";
import {
  X, ClipboardCheck, TrendingUp, TrendingDown, Minus, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyResults } from "@/hooks/useKeyResults";
import { useCreateCheckIn } from "@/hooks/useCheckIns";
import { ProgressRing } from "@/components/okr/ProgressRing";
import type { KeyResult } from "@/components/okr/KRCard";

// ── Constants ──────────────────────────────────────────────────────────────────

const LAYER_LABEL: Record<string, string> = {
  strategic: "OKR Estratégico",
  annual:    "OKR Anual",
  quarterly: "OKR Trimestral",
};

const CONFIDENCE_OPTIONS = [
  { v: 0.3, label: "Bajo",   color: "bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300"    },
  { v: 0.5, label: "Riesgo", color: "bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300"  },
  { v: 0.7, label: "Bien",   color: "bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300"   },
  { v: 0.9, label: "Alto",   color: "bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300"  },
  { v: 1.0, label: "Meta",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
] as const;

const TYPE_ICON: Record<string, React.ElementType> = {
  INCREASE: TrendingUp,
  DECREASE: TrendingDown,
  MAINTAIN: Minus,
  ACHIEVE:  CheckCircle2,
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface KrState { value: string; confidence: number; notes: string }

interface Props {
  objectiveId:    string;
  objectiveTitle: string;
  layer:          string;
  onClose:        () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TraceabilityCheckInDrawer({
  objectiveId, objectiveTitle, layer, onClose,
}: Props) {
  const { data: krs = [], isLoading } = useKeyResults(objectiveId);
  const createCheckIn = useCreateCheckIn();

  const [state, setState] = useState<Record<string, KrState>>({});
  const [done,  setDone]  = useState<Set<string>>(new Set());

  function getState(kr: KeyResult): KrState {
    return state[kr.id] ?? {
      value:      String(kr.current_value),
      confidence: kr.confidence,
      notes:      "",
    };
  }

  function update(krId: string, field: keyof KrState, val: string | number) {
    const kr = krs.find(k => k.id === krId)!;
    setState(prev => ({ ...prev, [krId]: { ...getState(kr), [field]: val } }));
  }

  async function submit(kr: KeyResult) {
    const s   = getState(kr);
    const num = parseFloat(s.value);
    if (isNaN(num)) return;
    await createCheckIn.mutateAsync({
      krId:          kr.id,
      current_value: num,
      confidence:    s.confidence,
      notes:         s.notes || undefined,
    });
    setDone(prev => new Set([...prev, kr.id]));
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-[95vw] bg-background border-l shadow-xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">
                Check-in · {LAYER_LABEL[layer] ?? layer}
              </span>
            </div>
            <p className="text-sm font-semibold leading-snug line-clamp-2">{objectiveTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors mt-0.5 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* KR list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

          {isLoading && (
            <div className="space-y-3">
              {[1, 2].map(n => (
                <div key={n} className="rounded-xl border p-4 animate-pulse space-y-2">
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-8 bg-muted rounded" />
                  <div className="h-6 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && krs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Sin Key Results para este objetivo</p>
            </div>
          )}

          {krs.map(kr => {
            const s      = getState(kr);
            const Icon   = TYPE_ICON[kr.type] ?? TrendingUp;
            const isDone = done.has(kr.id);
            const isValid = !isNaN(parseFloat(s.value));

            return (
              <div
                key={kr.id}
                className={cn(
                  "rounded-xl border p-4 transition-all",
                  isDone && "border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-950/20",
                )}
              >
                {/* KR header */}
                <div className="flex items-start gap-2 mb-3">
                  <ProgressRing
                    progress={kr.progress} size={28}
                    status={kr.status} className="shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {kr.type}
                      </span>
                    </div>
                    <p className="text-xs font-semibold leading-snug">{kr.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Actual: <strong>{kr.current_value}</strong> {kr.metric_unit}
                      {" · "}Meta: {kr.target_value} {kr.metric_unit}
                    </p>
                  </div>
                  {isDone && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  )}
                </div>

                {isDone ? (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium text-center py-1">
                    ✓ Check-in registrado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Value */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                        Nuevo valor ({kr.metric_unit})
                      </label>
                      <input
                        type="number"
                        value={s.value}
                        onChange={e => update(kr.id, "value", e.target.value)}
                        step="any"
                        className="w-full h-8 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    {/* Confidence */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                        Confianza
                      </label>
                      <div className="flex gap-1">
                        {CONFIDENCE_OPTIONS.map(opt => (
                          <button
                            key={opt.v}
                            onClick={() => update(kr.id, "confidence", opt.v)}
                            className={cn(
                              "flex-1 py-1 rounded-lg text-[10px] font-semibold border transition-all",
                              Math.abs(s.confidence - opt.v) < 0.05
                                ? cn(opt.color, "border-transparent ring-1 ring-primary/40")
                                : "bg-background border-border hover:bg-muted",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                        Notas{" "}
                        <span className="normal-case font-normal">(opcional)</span>
                      </label>
                      <textarea
                        value={s.notes}
                        onChange={e => update(kr.id, "notes", e.target.value)}
                        rows={2}
                        placeholder="¿Qué pasó este período?"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    {/* Submit */}
                    <button
                      disabled={!isValid || createCheckIn.isPending}
                      onClick={() => submit(kr)}
                      className="w-full h-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {createCheckIn.isPending ? "Guardando…" : "Registrar check-in"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
