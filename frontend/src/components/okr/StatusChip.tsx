import { cn } from "@/lib/utils";

type AppStatus =
  | "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  | "ON_TRACK" | "AT_RISK" | "BEHIND"
  | "TODO" | "IN_PROGRESS" | "DONE"
  | "PENDING" | "RESOLVED";

const STATUS_CONFIG: Record<AppStatus, { label: string; className: string }> = {
  DRAFT:       { label: "Borrador",    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  ACTIVE:      { label: "Activo",      className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  COMPLETED:   { label: "Completado",  className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CANCELLED:   { label: "Cancelado",   className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500" },
  ON_TRACK:    { label: "En curso",    className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  AT_RISK:     { label: "En riesgo",   className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  BEHIND:      { label: "Retrasado",   className: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  TODO:        { label: "Por hacer",   className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  IN_PROGRESS: { label: "En progreso", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  DONE:        { label: "Completada",  className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PENDING:     { label: "Pendiente",   className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  RESOLVED:    { label: "Resuelto",    className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

interface StatusChipProps {
  status: string;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const cfg = STATUS_CONFIG[status as AppStatus] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        cfg.className,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
