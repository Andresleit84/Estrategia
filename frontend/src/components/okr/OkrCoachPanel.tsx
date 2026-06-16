"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Sparkles, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface CoachResult {
  score: number;
  quality: "excellent" | "good" | "fair" | "poor";
  issues: string[];
  suggestions: string[];
}

interface OkrCoachPanelProps {
  title: string;
  description?: string;
  type?: string;
  target?: number;
  unit?: string;
  className?: string;
}

const QUALITY_CONFIG = {
  excellent: { label: "Excelente", color: "text-green-600 dark:text-green-400", bar: "bg-green-500" },
  good:      { label: "Bueno",     color: "text-blue-600 dark:text-blue-400",   bar: "bg-blue-500" },
  fair:      { label: "Mejorable", color: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  poor:      { label: "Débil",     color: "text-red-600 dark:text-red-400",     bar: "bg-red-500" },
};

export function OkrCoachPanel({ title, description, type, target, unit, className }: OkrCoachPanelProps) {
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loading, setLoading] = useState(false);

  const evaluate = useCallback(async () => {
    if (!title || title.trim().length < 3) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<CoachResult>("/ai/okr-coach", {
        title: title.trim(),
        description: description || undefined,
        type: type || "INCREASE",
        target: target || undefined,
        unit: unit || undefined,
      });
      setResult(data);
    } catch {
      // Silent fail — coach is optional
    } finally {
      setLoading(false);
    }
  }, [title, description, type, target, unit]);

  useEffect(() => {
    const timer = setTimeout(evaluate, 800);
    return () => clearTimeout(timer);
  }, [evaluate]);

  if (!title || title.trim().length < 3) return null;

  const cfg = result ? QUALITY_CONFIG[result.quality] : null;

  return (
    <div className={cn(
      "rounded-lg border bg-muted/30 p-3 space-y-2",
      className
    )}>
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
        )}
        <span className="text-xs font-medium text-muted-foreground">OKR Coach</span>
        {result && cfg && (
          <span className={cn("text-xs font-semibold ml-auto", cfg.color)}>
            {result.score}/10 — {cfg.label}
          </span>
        )}
      </div>

      {result && (
        <>
          {/* Score bar */}
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", cfg?.bar)}
              style={{ width: `${result.score * 10}%` }}
            />
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <ul className="space-y-1">
              {result.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
                  {issue}
                </li>
              ))}
            </ul>
          )}

          {/* AI suggestions */}
          {result.suggestions.length > 0 && (
            <ul className="space-y-1">
              {result.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                  <CheckCircle2 className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          )}

          {result.issues.length === 0 && result.suggestions.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Este resultado clave está bien formulado.
            </p>
          )}
        </>
      )}
    </div>
  );
}
