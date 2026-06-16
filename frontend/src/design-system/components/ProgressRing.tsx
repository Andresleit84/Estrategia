import { cn } from "@/lib/utils";
import type { OKRStatus } from "@/design-system/tokens";

interface ProgressRingProps {
  progress: number;        // 0–100
  status?: OKRStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const SIZE = { sm: 48, md: 64, lg: 80 };
const STROKE = { sm: 4, md: 5, lg: 6 };

const STATUS_STROKE: Record<string, string> = {
  ON_TRACK:  "stroke-okr-on-track",
  AT_RISK:   "stroke-okr-at-risk",
  BEHIND:    "stroke-okr-behind",
  COMPLETED: "stroke-okr-completed",
  CANCELLED: "stroke-okr-cancelled",
  DRAFT:     "stroke-okr-draft",
};

const STATUS_TEXT: Record<string, string> = {
  ON_TRACK:  "text-okr-on-track",
  AT_RISK:   "text-okr-at-risk",
  BEHIND:    "text-okr-behind",
  COMPLETED: "text-okr-completed",
  CANCELLED: "text-okr-cancelled",
  DRAFT:     "text-okr-draft",
};

export function ProgressRing({
  progress,
  status = "ON_TRACK",
  size = "md",
  showLabel = true,
  className,
}: ProgressRingProps) {
  const diameter = SIZE[size];
  const strokeWidth = STROKE[size];
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference * (1 - clamped / 100);
  const center = diameter / 2;
  const fontSize = size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Avance: ${clamped}%`}
    >
      <svg width={diameter} height={diameter} className="-rotate-90">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className={cn(STATUS_STROKE[status] ?? "stroke-primary", "transition-all duration-500")}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel && (
        <span
          className={cn(
            "absolute font-mono font-semibold",
            fontSize,
            STATUS_TEXT[status] ?? "text-foreground"
          )}
        >
          {clamped}%
        </span>
      )}
    </div>
  );
}
