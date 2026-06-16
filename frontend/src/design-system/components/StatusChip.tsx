import { cn } from "@/lib/utils";
import { STATUS_CONFIG, type OKRStatus } from "@/design-system/tokens";

interface StatusChipProps {
  status: OKRStatus;
  size?: "sm" | "md";
  className?: string;
}

export function StatusChip({ status, size = "md", className }: StatusChipProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        config.colorClass,
        config.bgClass,
        className
      )}
      aria-label={`Estado: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
}
