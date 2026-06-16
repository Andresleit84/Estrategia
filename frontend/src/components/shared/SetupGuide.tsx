"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, AlertTriangle, Calendar, Target, BarChart2, CheckCircle2,
  X, Sparkles, ArrowRight, ChevronUp, ChevronDown, Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetupStatus, type SetupStep } from "@/hooks/useSetupStatus";
import { Skeleton } from "@/components/ui/skeleton";

const ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  "alert-triangle": AlertTriangle,
  calendar: Calendar,
  compass: Compass,
  target: Target,
  "bar-chart-2": BarChart2,
  "check-circle": CheckCircle2,
};

const DISMISS_KEY = "setup-guide-dismissed";

function StepRow({ step, index, onNavigate }: { step: SetupStep; index: number; onNavigate: () => void }) {
  const Icon = ICON_MAP[step.icon] ?? CheckCircle2;
  return (
    <Link
      href={step.done ? "#" : step.url}
      onClick={e => { if (step.done) e.preventDefault(); else onNavigate(); }}
      className={cn(
        "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors group",
        step.done ? "opacity-40 cursor-default" : "hover:bg-muted/70 cursor-pointer"
      )}
    >
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
          step.done
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground/30 text-muted-foreground group-hover:border-primary/60 group-hover:text-primary"
        )}>
          {step.done
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <span className="text-[10px] font-bold leading-none">{index + 1}</span>
          }
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            step.done ? "text-muted-foreground/60" : "text-muted-foreground group-hover:text-primary"
          )} />
          <p className={cn(
            "text-sm font-semibold leading-tight",
            step.done ? "line-through text-muted-foreground" : "text-foreground"
          )}>
            {step.label}
          </p>
        </div>
        <p className={cn(
          "text-xs leading-relaxed mt-1.5 pl-5",
          step.done ? "text-muted-foreground/50" : "text-muted-foreground"
        )}>
          {step.description}
        </p>
      </div>
      {!step.done && (
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/25 group-hover:text-primary transition-colors mt-1" />
      )}
    </Link>
  );
}

export function SetupGuide() {
  const { data, isLoading } = useSetupStatus();
  const [open, setOpen] = useState(false);
  // mounted: evita flash SSR; dismissed: oculta permanentemente
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const val = localStorage.getItem(DISMISS_KEY);
    setDismissed(val === "1");
    setMounted(true);
  }, []);

  // No renderizar hasta que el cliente haya leído localStorage
  if (!mounted || dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setOpen(false);
  }

  const percentage = data?.percentage ?? 0;
  const completed = data?.completed ?? 0;
  const total = data?.total ?? 7;
  const nextStep = data?.steps.find(s => !s.done);

  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percentage / 100);

  // Si todos los pasos están completos, mostrar solo el botón completado brevemente
  const allDone = !isLoading && data && data.percentage === 100;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

      {/* Panel expandido */}
      {open && (
        <div className="w-96 rounded-2xl border bg-card shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b bg-muted/30">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Guía de inicio</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLoading ? "Cargando..." : `${completed} de ${total} completados`}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cerrar panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-4 pt-3 pb-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="px-4 py-4 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : allDone ? (
            <div className="px-4 py-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="text-sm font-semibold">¡Configuración completa!</p>
              <p className="text-xs text-muted-foreground">Tu organización está lista para operar con OKRs.</p>
            </div>
          ) : (
            <>
              {/* Siguiente paso */}
              {nextStep && (
                <Link
                  href={nextStep.url}
                  onClick={() => setOpen(false)}
                  className="mx-4 mt-2 mb-1 flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/15 px-3 py-3 hover:bg-primary/10 transition-colors group"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary mt-0.5">
                    {(() => { const Icon = ICON_MAP[nextStep.icon] ?? CheckCircle2; return <Icon className="h-3.5 w-3.5" />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Siguiente paso</p>
                    <p className="text-sm font-semibold text-primary leading-tight">{nextStep.label}</p>
                    <p className="text-xs text-primary/70 leading-relaxed mt-1">{nextStep.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                </Link>
              )}

              {/* Steps */}
              <div className="px-2 pb-2 pt-1 space-y-0.5 max-h-[55vh] overflow-y-auto">
                {data?.steps.map((step, i) => (
                  <StepRow key={step.id} step={step} index={i} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            </>
          )}

          <div className="px-4 pb-3 pt-1 border-t">
            <button
              onClick={dismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              No mostrar de nuevo
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante — siempre visible mientras no esté descartado */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2.5 rounded-full border shadow-lg px-4 py-2.5 transition-all duration-200",
          "bg-card hover:bg-muted/50 hover:shadow-xl active:scale-95",
          open && "ring-2 ring-primary/20"
        )}
        aria-label="Guía de configuración"
      >
        {/* Progress circle */}
        <div className="relative h-8 w-8 shrink-0">
          <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor"
              strokeWidth="2.5" className="text-muted" />
            <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="text-primary transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>

        <div className="text-left">
          <p className="text-xs font-semibold leading-tight">Guía de inicio</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {isLoading ? "..." : `${completed}/${total} pasos`}
          </p>
        </div>

        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        }
      </button>
    </div>
  );
}
