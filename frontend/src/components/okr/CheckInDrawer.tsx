"use client";

import { useState, useEffect } from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { KeyResult } from "./KRCard";
import {
  useCreateCheckIn, useCheckInHistory, useKrPrediction,
  useCheckinAssistant, useCheckinSummary, type CheckinAssistantResult,
} from "@/hooks/useCheckIns";
import { useKrInitiatives } from "@/hooks/useInitiatives";
import {
  Sparkles, TrendingUp, TrendingDown, Minus, CalendarCheck, Loader2, Rocket,
  MessageSquare, Copy, Check, ChevronRight, AlertTriangle, CheckCircle2, Zap,
} from "lucide-react";
import type { KrForecast } from "@/hooks/useCheckIns";
import { toast } from "sonner";

const MOODS = [
  { id: "GREAT",     emoji: "🚀", label: "Excelente" },
  { id: "GOOD",      emoji: "😊", label: "Bien"      },
  { id: "NEUTRAL",   emoji: "😐", label: "Neutral"   },
  { id: "CONCERNED", emoji: "😟", label: "Preocupado" },
  { id: "BLOCKED",   emoji: "🚫", label: "Bloqueado"  },
];

function ConfidenceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "var(--color-green-500)" :
    pct >= 40 ? "var(--color-amber-500)" : "var(--color-red-500)";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Alto riesgo</span>
        <span className="font-medium tabular-nums" style={{ color }}>{pct}%</span>
        <span>Bajo riesgo</span>
      </div>
      <input
        type="range" min={0} max={100} value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--color-muted) ${pct}%)` }}
      />
    </div>
  );
}

function ForecastPanel({ krId }: { krId: string }) {
  const { data: forecast, isLoading } = useKrPrediction(krId);

  if (isLoading) {
    return <div className="rounded-lg border bg-muted/30 p-3 animate-pulse h-20" />;
  }
  if (!forecast) return null;

  const { action_type } = forecast;

  if (action_type === "COMPLETED") {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        <p className="text-sm font-medium text-green-700 dark:text-green-400">Meta alcanzada — KR completado</p>
      </div>
    );
  }

  if (action_type === "INSUFFICIENT_DATA") {
    return (
      <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Predicción de cierre
        </p>
        <p className="text-sm text-muted-foreground">Registra al menos 2 check-ins para activar la predicción.</p>
      </div>
    );
  }

  const ACTION_CONFIG = {
    ON_TRACK: {
      Icon: TrendingUp,
      cls: "bg-green-500/10 text-green-700 dark:text-green-400",
      label: `En buen camino — proyección al cierre: ${forecast.projected_completion_pct}%`,
    },
    INCREASE_PACE: {
      Icon: TrendingDown,
      cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      label: `Necesitas acelerar — cerrarás en ${forecast.projected_completion_pct}%`,
    },
    URGENT_CHECKIN: {
      Icon: AlertTriangle,
      cls: "bg-red-500/10 text-red-700 dark:text-red-400",
      label: `${forecast.days_since_last_checkin} días sin check-in — registra hoy`,
    },
  } as const;

  const cfg = ACTION_CONFIG[action_type as keyof typeof ACTION_CONFIG];
  const { Icon: ActionIcon } = cfg ?? { Icon: Minus };
  const pacePct = Math.min(100, Math.round(forecast.pace_ratio * 100));
  // Don't show velocity when data is insufficient (pace_current would be 0, misleading)
  const showVelocity = forecast.pace_needed_per_day > 0
    && forecast.kr_type !== "ACHIEVE"
    && !forecast.insufficient_data;

  // Gap chip: show concrete units for INCREASE/DECREASE; projected % for ACHIEVE/MAINTAIN
  const midChip = forecast.gap_units > 0
    ? {
        value: `${forecast.gap_units} ${forecast.metric_unit}`,
        label: "brecha al cierre",
        color: forecast.gap_pct > 20 ? "text-red-500" : "text-amber-500",
      }
    : {
        value: `${forecast.projected_completion_pct}%`,
        label: "proyección cierre",
        color: forecast.projected_completion_pct >= 95
          ? "text-green-500"
          : forecast.projected_completion_pct >= 60
          ? "text-amber-500"
          : "text-red-500",
      };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      {/* Header */}
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Predicción de cierre
      </p>

      {/* Action banner */}
      {cfg && (
        <div className={cn("rounded-md px-3 py-2 flex items-center gap-2 text-sm font-medium", cfg.cls)}>
          <ActionIcon className="h-4 w-4 shrink-0" />
          <span>{cfg.label}</span>
        </div>
      )}

      {/* Velocity comparison */}
      {showVelocity && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ritmo actual</span>
            <span className="tabular-nums font-medium">
              {forecast.pace_current_per_day} {forecast.metric_unit}/día
              <span className="ml-1 opacity-60">({pacePct}% del necesario)</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                pacePct >= 95 ? "bg-green-500" : pacePct >= 60 ? "bg-amber-500" : "bg-red-500",
              )}
              style={{ width: `${pacePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ritmo necesario</span>
            <span className="tabular-nums">{forecast.pace_needed_per_day} {forecast.metric_unit}/día</span>
          </div>
        </div>
      )}

      {/* Stats chips */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-md bg-background border px-2 py-1.5 text-center">
          <p className="text-sm font-semibold tabular-nums">{forecast.days_remaining}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">días restantes</p>
        </div>
        <div className="rounded-md bg-background border px-2 py-1.5 text-center">
          <p className={cn("text-sm font-semibold tabular-nums", midChip.color)}>
            {midChip.value}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">{midChip.label}</p>
        </div>
        <div className="rounded-md bg-background border px-2 py-1.5 text-center">
          <p className="text-sm font-semibold tabular-nums">
            {forecast.recommended_checkins_per_week}×/sem
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {forecast.value_needed_per_checkin > 0
              ? `+${forecast.value_needed_per_checkin} ${forecast.metric_unit}`
              : "check-ins"}
          </p>
        </div>
      </div>

      {/* Scenarios */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Escenarios al cierre del ciclo</p>
        <div className="grid grid-cols-3 gap-1">
          {[
            {
              label: "Pesimista", value: forecast.scenario_pessimistic_pct,
              cls: forecast.scenario_pessimistic_pct >= 70 ? "text-amber-500" : "text-red-500",
            },
            {
              label: "Base", value: forecast.scenario_base_pct,
              cls: forecast.scenario_base_pct >= 95 ? "text-green-500" : forecast.scenario_base_pct >= 60 ? "text-amber-500" : "text-red-500",
            },
            {
              label: "Optimista", value: forecast.scenario_optimistic_pct,
              cls: forecast.scenario_optimistic_pct >= 80 ? "text-green-500" : "text-amber-500",
            },
          ].map((s) => (
            <div key={s.label} className="rounded border bg-background/50 py-1.5 text-center">
              <p className={cn("text-sm font-bold tabular-nums", s.cls)}>{s.value}%</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Projected date (when available) */}
      {forecast.projected_date && !forecast.insufficient_data && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          Meta proyectada:{" "}
          <strong className="text-foreground ml-0.5">
            {new Date(forecast.projected_date).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
          </strong>
          <span className="ml-1">({Math.round(forecast.probability * 100)}% prob.)</span>
        </p>
      )}
    </div>
  );
}

// ── Guide Questions ────────────────────────────────────────────────────────────

function GuideQuestions({
  questions,
  loading,
  onSelect,
}: { questions: string[]; loading: boolean; onSelect: (q: string) => void }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Cargando preguntas guía…
      </div>
    );
  }
  if (!questions.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-primary" />
        Preguntas guía — haz clic para añadir a las notas
      </p>
      <div className="space-y-1">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="w-full text-left rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground hover:bg-primary/5 transition-colors flex items-center gap-2 group"
          >
            <ChevronRight className="h-3 w-3 shrink-0 group-hover:text-primary transition-colors" />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Manager Summary Panel ─────────────────────────────────────────────────────

function ManagerSummaryPanel({ summary, onClose }: { summary: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <MessageSquare className="h-4 w-4" />
          Resumen para el manager
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
      <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground w-full" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

interface CheckInDrawerProps {
  kr: KeyResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInDrawer({ kr, open, onOpenChange }: CheckInDrawerProps) {
  const [value, setValue]           = useState("");
  const [confidence, setConf]       = useState(0.7);
  const [mood, setMood]             = useState<string | undefined>(undefined);
  const [notes, setNotes]           = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [questions, setQuestions]   = useState<string[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [managerSummary, setManagerSummary] = useState<string | null>(null);
  const [savedCheckInId, setSavedCheckInId] = useState<string | null>(null);

  const createCheckIn = useCreateCheckIn();
  const getAssistant  = useCheckinAssistant();
  const getSummary    = useCheckinSummary();
  const { data: history } = useCheckInHistory(kr?.id ?? null);
  const { data: krInitiatives = [] } = useKrInitiatives(open ? (kr?.id ?? null) : null);

  useEffect(() => {
    if (open && kr) {
      setValue(kr.current_value?.toString() ?? "");
      setConf(kr.confidence ?? 0.7);
      setNotes("");
      setMood(undefined);
      setQuestions([]);
      setQuestionsLoaded(false);
      setManagerSummary(null);
      setSavedCheckInId(null);
    }
  }, [open, kr]);

  // Auto-load questions when drawer opens
  useEffect(() => {
    if (!open || !kr || questionsLoaded) return;
    const timer = setTimeout(async () => {
      setQuestionsLoaded(true);
      try {
        const result = await getAssistant.mutateAsync({
          kr_id: kr.id,
          current_value: parseFloat(value) || kr.current_value || 0,
          confidence,
        });
        if (result.questions?.length) setQuestions(result.questions);
      } catch { /* silent */ }
    }, 600); // small delay to not block initial render
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kr?.id]);

  if (!kr) return null;

  function formatVal(v: number) {
    if (kr!.metric_unit === "%") return `${v}%`;
    if (kr!.metric_unit === "$") return `$${v.toLocaleString()}`;
    return `${v} ${kr!.metric_unit}`;
  }

  const numValue       = parseFloat(value) || 0;
  const prevValue      = history?.[0]?.current_value ?? kr.current_value;
  const delta          = numValue - prevValue;
  const progressPreview = (() => {
    if (kr.type === "INCREASE") {
      const range = kr.target_value - kr.start_value;
      if (range === 0) return 100;
      return Math.max(0, Math.min(100, ((numValue - kr.start_value) / range) * 100));
    }
    if (kr.type === "DECREASE") {
      const range = kr.start_value - kr.target_value;
      if (range === 0) return 100;
      return Math.max(0, Math.min(100, ((kr.start_value - numValue) / range) * 100));
    }
    if (kr.type === "ACHIEVE") return numValue >= kr.target_value ? 100 : 0;
    return kr.progress;
  })();

  function handleQuestionSelect(q: string) {
    setNotes(prev => prev ? `${prev}\n${q}\n` : `${q}\n`);
  }

  async function handleGenerateNote() {
    if (!kr) return;
    setAiLoading(true);
    try {
      const result = await getAssistant.mutateAsync({ kr_id: kr.id, current_value: numValue, confidence });
      if (result.suggestion) setNotes(result.suggestion);
      if (result.questions?.length) setQuestions(result.questions);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit() {
    if (!value.trim() || !kr) return;
    try {
      const result = await createCheckIn.mutateAsync({
        krId: kr.id,
        current_value: numValue,
        confidence,
        notes: notes.trim() || undefined,
        mood,
      }) as { id?: string } | undefined;

      toast.success("Check-in guardado exitosamente");

      // Generate manager summary in background
      const checkInId = (result as any)?.id;
      if (checkInId) {
        setSavedCheckInId(checkInId);
        try {
          const sumResult = await getSummary.mutateAsync(checkInId);
          if (sumResult.summary) {
            setManagerSummary(sumResult.summary);
          } else {
            onOpenChange(false);
          }
        } catch {
          onOpenChange(false);
        }
      } else {
        onOpenChange(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el check-in");
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="w-full sm:max-w-md overflow-y-auto">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-base">
            {kr.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1.5 align-middle">{kr.code}</span>}
            {kr.title}
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            {kr.type} · Meta: {formatVal(kr.target_value)} · Inicio: {formatVal(kr.start_value)}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Manager summary after save */}
          {managerSummary && (
            <ManagerSummaryPanel summary={managerSummary} onClose={() => onOpenChange(false)} />
          )}

          {!managerSummary && (
            <>
              {/* Target value */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Valor meta</label>
                <div className="h-10 w-full rounded-md border border-dashed bg-muted/40 px-3 flex items-center tabular-nums text-base font-semibold text-muted-foreground select-none">
                  {formatVal(kr.target_value)}
                </div>
              </div>

              {/* Current value */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Valor actual</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={kr.current_value?.toString()}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{kr.metric_unit}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Anterior: <strong>{formatVal(prevValue)}</strong></span>
                  {value && delta !== 0 && (
                    <span className={delta > 0 ? "text-green-600" : "text-red-500"}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(2)} {kr.metric_unit}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progreso estimado</span>
                    <span className="font-mono font-medium">{Math.round(progressPreview)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-300",
                        progressPreview >= 70 ? "bg-green-500" : progressPreview >= 40 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${Math.min(100, progressPreview)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Confidence */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nivel de confianza</label>
                <ConfidenceSlider value={confidence} onChange={setConf} />
              </div>

              {/* Mood */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">¿Cómo te sientes?</label>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMood(mood === m.id ? undefined : m.id)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-xs transition-colors",
                        mood === m.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted text-muted-foreground hover:border-foreground/30"
                      )}
                      title={m.label}
                    >
                      <span className="text-lg leading-none">{m.emoji}</span>
                      <span className="text-[10px]">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Guide questions */}
              <GuideQuestions
                questions={questions}
                loading={getAssistant.isPending && !questionsLoaded}
                onSelect={handleQuestionSelect}
              />

              {/* Notes + AI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Notas</label>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-primary"
                    onClick={handleGenerateNote}
                    disabled={aiLoading || !value}
                  >
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generar nota con IA
                  </Button>
                </div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="¿Qué avanzaste esta semana? ¿Qué bloqueó el progreso?"
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              {/* Initiatives */}
              {(krInitiatives as any[]).length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
                    Iniciativas vinculadas
                  </label>
                  <div className="space-y-1">
                    {(krInitiatives as any[]).map((i: any) => (
                      <div key={i.initiative_id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                        <div className={cn("h-2 w-2 rounded-full shrink-0",
                          i.initiative_status === "DONE"        ? "bg-green-500" :
                          i.is_overdue                          ? "bg-red-500"   :
                          i.initiative_status === "IN_PROGRESS" ? "bg-blue-500"  : "bg-muted-foreground/40"
                        )} />
                        <span className="flex-1 truncate">{i.initiative_title}</span>
                        <span className="tabular-nums text-muted-foreground">{Math.round(i.initiative_progress)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forecast panel — shows when at least 1 prior check-in exists */}
              {history && history.length >= 1 && <ForecastPanel krId={kr.id} />}
            </>
          )}
        </div>

        <DrawerFooter className="border-t">
          {managerSummary ? (
            <Button onClick={() => onOpenChange(false)} className="w-full">Cerrar</Button>
          ) : (
            <>
              <Button
                onClick={handleSubmit}
                disabled={!value || createCheckIn.isPending || getSummary.isPending}
                className="w-full"
              >
                {createCheckIn.isPending || getSummary.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {createCheckIn.isPending ? "Guardando..." : "Generando resumen..."}</>
                ) : "Guardar check-in"}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">Cancelar</Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
