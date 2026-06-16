import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  confidence: number;  // 0.0 - 1.0
  showLabel?: boolean;
  className?: string;
}

function getConfidenceColor(c: number) {
  if (c >= 0.7) return "bg-green-500 dark:bg-green-400";
  if (c >= 0.4) return "bg-amber-500 dark:bg-amber-400";
  return "bg-red-500 dark:bg-red-400";
}

function getConfidenceLabel(c: number) {
  if (c >= 0.7) return "Alta";
  if (c >= 0.4) return "Media";
  return "Baja";
}

export function ConfidenceMeter({ confidence, showLabel = true, className }: ConfidenceMeterProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const pct = Math.round(clamped * 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confianza: ${pct}%`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", getConfidenceColor(clamped))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground w-8 text-right shrink-0 font-mono">
          {pct}%
        </span>
      )}
    </div>
  );
}
