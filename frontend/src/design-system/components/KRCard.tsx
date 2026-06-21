"use client";

import { cn } from "@/lib/utils";
import { StatusChip } from "./StatusChip";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OKRStatus, KRType } from "@/design-system/tokens";

export interface KRCardData {
  id: string;
  title: string;
  type: KRType;
  metricUnit: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  progress: number;        // 0–100
  confidence: number;      // 0.0–1.0
  status: OKRStatus;
  ownerName: string;
  ownerAvatar?: string;
  lastCheckInDaysAgo?: number;
}

interface KRCardProps {
  data: KRCardData;
  onCheckIn?: (id: string) => void;
  onEdit?: (id: string) => void;
  onViewHistory?: (id: string) => void;
  className?: string;
}

const TYPE_LABEL: Record<KRType, string> = {
  INCREASE:  "Aumentar",
  DECREASE:  "Reducir",
  MAINTAIN:  "Mantener",
  ACHIEVE:   "Lograr",
};

function formatValue(value: number, unit: string) {
  if (unit === "%") return `${value}%`;
  if (unit === "$") return `$${value.toLocaleString()}`;
  if (unit === "#" || unit === "") return `${value.toLocaleString()}`;
  return `${value.toLocaleString()} ${unit}`;
}

export function KRCard({ data, onCheckIn, onEdit, onViewHistory, className }: KRCardProps) {
  const {
    id, title, type, metricUnit, startValue, currentValue, targetValue,
    progress, confidence, status, ownerName, lastCheckInDaysAgo,
  } = data;

  const lastCheckInText =
    lastCheckInDaysAgo === undefined ? "Sin check-in" :
    lastCheckInDaysAgo === 0        ? "Hoy" :
    lastCheckInDaysAgo === 1        ? "Hace 1 día" :
                                      `Hace ${lastCheckInDaysAgo} días`;

  const checkInWarning = lastCheckInDaysAgo !== undefined && lastCheckInDaysAgo > 7;

  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card p-4 shadow-sm",
        "transition-shadow hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs shrink-0">
              {TYPE_LABEL[type]}
            </Badge>
            <StatusChip status={status} size="sm" />
          </div>
          <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {title}
          </h3>
        </div>

        {/* Check-in button — siempre visible */}
        <Button
          size="sm"
          onClick={() => onCheckIn?.(id)}
          className="shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
          aria-label={`Hacer check-in de: ${title}`}
        >
          Check-in
        </Button>
      </div>

      {/* Barra de progreso */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatValue(currentValue, metricUnit)}</span>
          <span className="font-mono font-semibold text-foreground">{progress}%</span>
          <span>{formatValue(targetValue, metricUnit)}</span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              status === "ON_TRACK"  && "bg-okr-on-track",
              status === "AT_RISK"   && "bg-okr-at-risk",
              status === "BEHIND"    && "bg-okr-behind",
              status === "COMPLETED" && "bg-okr-completed",
              status === "CANCELLED" && "bg-okr-cancelled",
              status === "DRAFT"     && "bg-muted-foreground",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Inicio: {formatValue(startValue, metricUnit)}
        </div>
      </div>

      {/* Confianza */}
      <div className="mt-3">
        <p className="text-xs text-muted-foreground mb-1">Confianza</p>
        <ConfidenceMeter value={confidence} />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium" aria-hidden="true">
            {ownerName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-24">{ownerName}</span>
        </div>
        <span
          className={cn(
            "text-xs",
            checkInWarning ? "text-okr-at-risk font-medium" : "text-muted-foreground"
          )}
          aria-label={`Último check-in: ${lastCheckInText}`}
        >
          {lastCheckInText}
        </span>
      </div>

      {/* Acciones secundarias — visibles al hover */}
      <div className="absolute inset-x-4 bottom-4 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onViewHistory?.(id)}>
          Historial
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEdit?.(id)}>
          Editar
        </Button>
      </div>
    </article>
  );
}
