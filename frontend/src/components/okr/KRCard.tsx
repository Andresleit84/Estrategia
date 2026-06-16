"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "./StatusChip";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Edit3, Clock, User, AlertTriangle } from "lucide-react";

export interface KeyResult {
  id: string;
  objective_id: string;
  code?: string | null;
  title: string;
  description?: string;
  type: "INCREASE" | "DECREASE" | "MAINTAIN" | "ACHIEVE";
  metric_unit: string;
  start_value: number;
  target_value: number;
  current_value: number;
  confidence: number;
  progress: number;
  status: string;
  trend: "up" | "flat" | "down";
  last_checkin_at?: string;
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  team_id?: string;
  team_name?: string;
  check_in_cadence?: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY";
  cadence_days?: number;
}

export const CADENCE_LABELS: Record<string, string> = {
  WEEKLY:    "Semanal",
  BIWEEKLY:  "Bisemanal",
  MONTHLY:   "Mensual",
  QUARTERLY: "Trimestral",
};

export const CADENCE_DAYS: Record<string, number> = {
  WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30, QUARTERLY: 90,
};

interface KRCardProps {
  kr: KeyResult;
  onCheckIn?: (kr: KeyResult) => void;
  onEdit?: (kr: KeyResult) => void;
  className?: string;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")   return <TrendingUp className="h-3 w-3 text-green-500" aria-hidden="true" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-500" aria-hidden="true" />;
  return <Minus className="h-3 w-3 text-muted-foreground" aria-hidden="true" />;
}

function formatValue(value: number, unit: string) {
  if (unit === "%") return `${value}%`;
  if (unit === "$") return `$${value.toLocaleString()}`;
  return `${value} ${unit}`;
}

function getCadenceStatus(lastCheckinAt: string | undefined, cadenceDays: number): "ok" | "due_soon" | "overdue" {
  if (!lastCheckinAt) return "overdue";
  const days = Math.floor((Date.now() - new Date(lastCheckinAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days >= cadenceDays) return "overdue";
  if (days >= cadenceDays * 0.75) return "due_soon";
  return "ok";
}

function formatLastCheckin(dateStr: string | undefined, cadenceDays: number) {
  if (!dateStr) return { label: "Sin check-in", status: "overdue" as const };
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  const label = days === 0 ? "Hoy" : days === 1 ? "Hace 1 día" : `Hace ${days} días`;
  const status = getCadenceStatus(dateStr, cadenceDays);
  return { label, status };
}

export function KRCard({ kr, onCheckIn, onEdit, className }: KRCardProps) {
  const [hovered, setHovered] = useState(false);

  const cadenceDays = kr.cadence_days ?? CADENCE_DAYS[kr.check_in_cadence ?? "BIWEEKLY"] ?? 14;
  const { label: checkinLabel, status: checkinStatus } = formatLastCheckin(kr.last_checkin_at, cadenceDays);
  const cadenceLabel = CADENCE_LABELS[kr.check_in_cadence ?? "BIWEEKLY"] ?? "Bisemanal";

  const ownerInitial = kr.owner_name?.charAt(0).toUpperCase() ?? "?";

  return (
    <Card
      className={cn(
        "p-4 transition-shadow hover:shadow-sm",
        kr.status === "CANCELLED" && "opacity-50",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TrendIcon trend={kr.trend} />
            {kr.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{kr.code}</span>}
            <span className="text-sm font-medium text-foreground truncate">{kr.title}</span>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>
                {formatValue(kr.current_value, kr.metric_unit)}
                <span className="mx-1 opacity-50">/</span>
                {formatValue(kr.target_value, kr.metric_unit)}
              </span>
              <span className="font-mono font-medium">{Math.round(kr.progress)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  kr.progress >= 70 ? "bg-green-500" :
                  kr.progress >= 40 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${Math.min(100, kr.progress)}%` }}
              />
            </div>
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-muted-foreground shrink-0">Confianza</span>
            <ConfidenceMeter confidence={kr.confidence} className="flex-1" />
          </div>

          {/* Metadata row: responsable · área · cadencia · último check-in */}
          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-dashed border-border/50">
            {kr.owner_name && (
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                  {ownerInitial}
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{kr.owner_name}</span>
              </div>
            )}
            {kr.team_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{kr.team_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{cadenceLabel}</span>
            </div>
            <div className={cn(
              "flex items-center gap-1 text-xs",
              checkinStatus === "overdue"  ? "text-red-600 dark:text-red-400 font-medium" :
              checkinStatus === "due_soon" ? "text-amber-600 dark:text-amber-400" :
                                            "text-muted-foreground"
            )}>
              {checkinStatus === "overdue" && <AlertTriangle className="h-3 w-3 shrink-0" />}
              <span>{checkinLabel}</span>
            </div>
          </div>
        </div>

        {/* Right side: status */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusChip status={kr.status} />
        </div>
      </div>

      {/* Actions on hover */}
      {hovered && (onCheckIn || onEdit) && kr.status !== "CANCELLED" && kr.status !== "COMPLETED" && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          {onCheckIn && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onCheckIn(kr)}>
              Check-in
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onEdit(kr)}>
              <Edit3 className="h-3 w-3" />
              Editar
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
