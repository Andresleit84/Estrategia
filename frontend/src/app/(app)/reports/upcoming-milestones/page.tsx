"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useUpcomingMilestones, type UpcomingMilestone } from "@/hooks/useReports";
import { useUpcomingDeliverables, type UpcomingDeliverable } from "@/hooks/useDelivery";
import { Calendar, Clock, AlertTriangle, CheckSquare, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS_OPTIONS = [7, 14, 30, 60, 90] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function urgencyClass(days: number) {
  if (days <= 2) return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
  if (days <= 7) return "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20";
  return "border-l-blue-400";
}

function UrgencyBadge({ days }: { days: number }) {
  if (days <= 0) return <Badge variant="destructive" className="text-xs">Hoy</Badge>;
  if (days === 1) return <Badge variant="destructive" className="text-xs">Mañana</Badge>;
  if (days <= 7)  return <Badge className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">En {days}d</Badge>;
  return <Badge variant="secondary" className="text-xs">En {days}d</Badge>;
}

function MilestoneCard({ m }: { m: UpcomingMilestone }) {
  return (
    <Card className={cn("border-l-4 transition-colors", urgencyClass(m.days_until_due))}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium text-sm truncate">{m.milestone_title}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2 truncate">
              {m.initiative_title}
              {m.team_name && <span className="ml-1 opacity-70">· {m.team_name}</span>}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {m.due_date ? formatDate(m.due_date) : "—"}
              </span>
              {m.owner_name && <span>{m.owner_name}</span>}
            </div>
          </div>
          <div className="shrink-0">
            <UrgencyBadge days={m.days_until_due} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeliverableCard({ d }: { d: UpcomingDeliverable }) {
  return (
    <Link href={`/delivery/${d.program_id}`}>
      <Card className={cn("border-l-4 transition-colors hover:shadow-sm cursor-pointer", urgencyClass(d.days_until_due))}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium text-sm truncate">{d.title}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2 truncate">
                {d.program_name}
                {d.phase_name && <span className="ml-1 opacity-70">· {d.phase_name}</span>}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {d.due_date ? formatDate(d.due_date) : "—"}
                </span>
                {d.owner_name && <span>{d.owner_name}</span>}
              </div>
            </div>
            <div className="shrink-0">
              <UrgencyBadge days={d.days_until_due} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

type Section = "milestones" | "deliverables" | "all";

function GroupedItems<T extends { days_until_due: number }>({
  items,
  renderCard,
  label,
}: {
  items: T[];
  renderCard: (item: T, i: number) => React.ReactNode;
  label: string;
}) {
  if (!items.length) return null;
  const today    = items.filter((m) => m.days_until_due <= 0);
  const thisWeek = items.filter((m) => m.days_until_due > 0 && m.days_until_due <= 7);
  const later    = items.filter((m) => m.days_until_due > 7);
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label} ({items.length})</p>
      {today.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4" /> Vencen hoy ({today.length})
          </h3>
          <div className="space-y-2">{today.map((m, i) => renderCard(m, i))}</div>
        </section>
      )}
      {thisWeek.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4" /> Esta semana ({thisWeek.length})
          </h3>
          <div className="space-y-2">{thisWeek.map((m, i) => renderCard(m, i))}</div>
        </section>
      )}
      {later.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4" /> Más adelante ({later.length})
          </h3>
          <div className="space-y-2">{later.map((m, i) => renderCard(m, i))}</div>
        </section>
      )}
    </div>
  );
}

export default function UpcomingMilestonesPage() {
  const [days, setDays]       = useState(30);
  const [section, setSection] = useState<Section>("all");

  const { data: milestones,    isLoading: mLoading }  = useUpcomingMilestones(days);
  const { data: deliverables,  isLoading: dLoading }  = useUpcomingDeliverables(days);

  const isLoading    = mLoading || dLoading;
  const totalItems   = (milestones?.length ?? 0) + (deliverables?.length ?? 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Calendario de Hitos"
        description="Hitos de iniciativas y entregables de delivery con vencimiento próximo"
      />

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Próximos</span>
        {DAYS_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              "px-3 py-1 text-sm rounded-full border transition-colors",
              days === d
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-accent",
            )}
            aria-pressed={days === d}
          >
            {d}d
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 rounded-lg border overflow-hidden">
          {(["all", "milestones", "deliverables"] as Section[]).map((s) => {
            const count = s === "milestones" ? (milestones?.length ?? 0) : s === "deliverables" ? (deliverables?.length ?? 0) : totalItems;
            const icon  = s === "milestones" ? CheckSquare : s === "deliverables" ? Package : Calendar;
            const Icon  = icon;
            const label = s === "milestones" ? "Iniciativas" : s === "deliverables" ? "Delivery" : "Todo";
            return (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                  s !== "all" && "border-l",
                  section === s ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {count > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    section === s ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        {!isLoading && (
          <span className="text-sm text-muted-foreground">
            {totalItems} total
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Initiative milestones */}
      {!isLoading && (section === "milestones" || section === "all") && (
        milestones && milestones.length > 0 ? (
          <GroupedItems
            items={milestones}
            label="Hitos de iniciativas"
            renderCard={(m) => <MilestoneCard key={(m as UpcomingMilestone).milestone_id} m={m as UpcomingMilestone} />}
          />
        ) : section === "milestones" ? (
          <EmptyState
            icon={CheckSquare}
            title="Sin hitos próximos"
            description={`No hay hitos de iniciativas en los próximos ${days} días.`}
          />
        ) : null
      )}

      {/* Delivery deliverables */}
      {!isLoading && (section === "deliverables" || section === "all") && (
        deliverables && deliverables.length > 0 ? (
          <GroupedItems
            items={deliverables}
            label="Entregables de Delivery"
            renderCard={(d) => <DeliverableCard key={(d as UpcomingDeliverable).id} d={d as UpcomingDeliverable} />}
          />
        ) : section === "deliverables" ? (
          <EmptyState
            icon={Package}
            title="Sin entregables próximos"
            description={`No hay entregables de delivery en los próximos ${days} días.`}
          />
        ) : null
      )}

      {!isLoading && section === "all" && totalItems === 0 && (
        <EmptyState
          icon={Calendar}
          title="Sin vencimientos próximos"
          description={`No hay hitos ni entregables en los próximos ${days} días.`}
        />
      )}
    </div>
  );
}
