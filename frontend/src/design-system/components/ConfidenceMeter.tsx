import { cn } from "@/lib/utils";
import { getConfidenceLevel } from "@/design-system/tokens";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ConfidenceMeterProps {
  value: number;       // 0.0 – 1.0
  showValue?: boolean;
  className?: string;
}

const LABELS = ["Bajo", "Medio", "Alto"];

export function ConfidenceMeter({ value, showValue = true, className }: ConfidenceMeterProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = clamped * 100;
  const level = getConfidenceLevel(clamped);

  const barColor =
    level === "high" ? "bg-confidence-high" :
    level === "mid"  ? "bg-confidence-mid"  :
                       "bg-confidence-low";

  const textColor =
    level === "high" ? "text-confidence-high" :
    level === "mid"  ? "text-confidence-mid"  :
                       "text-confidence-low";

  const labelIndex = level === "high" ? 2 : level === "mid" ? 1 : 0;

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={cn("flex items-center gap-2", className)}
          aria-label={`Confianza: ${LABELS[labelIndex]} (${Math.round(pct)}%)`}
        >
          <div className="relative h-1.5 flex-1 min-w-16 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          {showValue && (
            <span className={cn("font-mono text-xs font-medium tabular-nums w-8 text-right", textColor)}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          Confianza <strong>{LABELS[labelIndex]}</strong> — {Math.round(pct)}%
        </p>
        <p className="text-xs text-muted-foreground">
          {level === "high" && "El KR va por buen camino"}
          {level === "mid"  && "Requiere atención"}
          {level === "low"  && "Alto riesgo de no cumplir"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
