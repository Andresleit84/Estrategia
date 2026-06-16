"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePortfolio } from "@/hooks/useReports";
import type { PortfolioItem } from "@/hooks/useReports";
import { Rocket, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  BACKLOG:     "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DONE:        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED:   "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};
const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog", IN_PROGRESS: "En progreso", DONE: "Completada", CANCELLED: "Cancelada",
};

// ── Gantt bar ─────────────────────────────────────────────────────────────────

function GanttBar({ item, minDate, maxDate }: {
  item: PortfolioItem; minDate: Date; maxDate: Date;
}) {
  const range = maxDate.getTime() - minDate.getTime();
  if (range === 0 || !item.start_date || !item.due_date) return null;

  const start = Math.max(0, (new Date(item.start_date).getTime() - minDate.getTime()) / range);
  const end = Math.min(1, (new Date(item.due_date).getTime() - minDate.getTime()) / range);
  const width = Math.max(0.01, end - start);

  const barColor = item.status === "DONE" ? "bg-green-500"
    : item.is_overdue ? "bg-red-400"
    : item.status === "IN_PROGRESS" ? "bg-blue-500"
    : "bg-gray-300 dark:bg-gray-600";

  return (
    <div className="relative h-5 w-full rounded overflow-hidden bg-muted/50">
      <div
        className={cn("absolute h-full rounded transition-all", barColor)}
        style={{ left: `${start * 100}%`, width: `${width * 100}%` }}
        title={`${item.start_date} → ${item.due_date}`}
      />
      <div className="absolute inset-0 flex items-center px-1.5">
        <span className="text-[10px] font-medium text-foreground/70 truncate">{item.title}</span>
      </div>
    </div>
  );
}

// ── Initiative row ────────────────────────────────────────────────────────────

function InitiativeRow({ item, minDate, maxDate }: {
  item: PortfolioItem; minDate: Date; maxDate: Date;
}) {
  return (
    <div className="grid grid-cols-[1fr_2fr] gap-3 py-2 border-b last:border-0 items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", STATUS_STYLES[item.status])}>
            {STATUS_LABELS[item.status] ?? item.status}
          </span>
          {item.is_overdue && (
            <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
          )}
        </div>
        <p className="text-sm truncate">{item.title}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {item.owner_name && <p className="text-[10px] text-muted-foreground">{item.owner_name}</p>}
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {item.completed_milestones}/{item.milestone_count} hitos
          </p>
        </div>
      </div>
      <GanttBar item={item} minDate={minDate} maxDate={maxDate} />
    </div>
  );
}

// ── Gantt axis ────────────────────────────────────────────────────────────────

function GanttAxis({ minDate, maxDate }: { minDate: Date; maxDate: Date }) {
  const range = maxDate.getTime() - minDate.getTime();
  if (range === 0) return null;

  // Generate ~4 evenly spaced labels
  const labels: { label: string; pct: number }[] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const ts = minDate.getTime() + (range * i) / steps;
    const d  = new Date(ts);
    labels.push({
      label: d.toLocaleDateString("es", { day: "numeric", month: "short" }),
      pct:   (i / steps) * 100,
    });
  }

  return (
    <div className="grid grid-cols-[1fr_2fr] gap-3 py-1.5 border-b">
      <div />
      <div className="relative h-4">
        {labels.map((l, i) => (
          <span
            key={i}
            className="absolute text-[9px] text-muted-foreground/70 -translate-x-1/2"
            style={{ left: `${l.pct}%` }}
          >
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Team group ────────────────────────────────────────────────────────────────

function TeamGroup({ teamName, items, minDate, maxDate }: {
  teamName: string; items: PortfolioItem[]; minDate: Date; maxDate: Date;
}) {
  // Auto-collapse if team has many items to keep page manageable
  const [expanded, setExpanded] = useState(items.length <= 8);
  const doneCount = items.filter(i => i.status === "DONE").length;
  const overdueCount = items.filter(i => i.is_overdue).length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors border-b"
      >
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{teamName || "Sin equipo"}</span>
          <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          {overdueCount > 0 && (
            <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {overdueCount} vencidas
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{doneCount}/{items.length} completadas</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-1">
          <GanttAxis minDate={minDate} maxDate={maxDate} />
          {[...items]
            .sort((a, b) => {
              // Sort by due date ascending (nulls last)
              if (!a.due_date && !b.due_date) return 0;
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            })
            .map(item => (
              <InitiativeRow key={item.id} item={item} minDate={minDate} maxDate={maxDate} />
            ))
          }
        </div>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { data: items = [], isLoading } = usePortfolio();

  // Group by team
  const byTeam = items.reduce<Record<string, PortfolioItem[]>>((acc, item) => {
    const key = item.team_name || "Sin equipo";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Global date range for Gantt alignment
  const dates = items
    .flatMap(i => [i.start_date, i.due_date])
    .filter(Boolean)
    .map(d => new Date(d!).getTime());
  const minDate = dates.length ? new Date(Math.min(...dates)) : new Date();
  const maxDate = dates.length ? new Date(Math.max(...dates)) : new Date(Date.now() + 90 * 86400000);

  const overdueTotal = items.filter(i => i.is_overdue).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Portfolio de Iniciativas"
        description="Vista Gantt de todas las iniciativas del ciclo activo"
        actions={
          overdueTotal > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg px-3 py-1.5 text-sm font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overdueTotal} vencidas
            </div>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[0,1,2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Rocket}
            title="Sin iniciativas"
            description="Crea iniciativas en el ciclo activo para verlas aquí."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(byTeam).map(([teamName, teamItems]) => (
            <TeamGroup
              key={teamName}
              teamName={teamName}
              items={teamItems}
              minDate={minDate}
              maxDate={maxDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
