"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useActiveCycle } from "@/hooks/useCycles";
import { useActivityFeed, type ActivityFeedItem } from "@/hooks/useReports";
import { useTeams } from "@/hooks/useTeams";
import { Activity, User } from "lucide-react";
import { cn } from "@/lib/utils";

const MOOD_EMOJI: Record<string, string> = {
  GREAT: "🚀", GOOD: "😊", NEUTRAL: "😐", BAD: "😟", TERRIBLE: "😰",
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.7 ? "text-green-600 dark:text-green-400"
  : c >= 0.4 ? "text-yellow-600 dark:text-yellow-400"
  : "text-red-600 dark:text-red-400";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "ahora mismo";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

function FeedCard({ item }: { item: ActivityFeedItem }) {
  return (
    <Card className="border-l-4 border-l-primary/30 hover:border-l-primary transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-medium truncate">{item.kr_title}</span>
              {item.mood && (
                <span title={item.mood} aria-label={`Ánimo: ${item.mood}`}>{MOOD_EMOJI[item.mood] ?? "😐"}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2 truncate">
              {item.objective_title}
              {item.team_name && <span className="ml-1 opacity-60">· {item.team_name}</span>}
            </p>
            {item.notes && (
              <p className="text-sm text-foreground/80 line-clamp-2 mb-2">{item.notes}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className={cn("font-medium", CONFIDENCE_COLOR(item.confidence))}>
                {Math.round(item.confidence * 100)}% confianza
              </span>
              <span>valor: {item.current_value}</span>
              {item.actor_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />{item.actor_name}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo(item.event_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ActivityFeedPage() {
  const { data: cycle } = useActiveCycle();
  const { data: teams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const { data: feed, isLoading } = useActivityFeed(cycle?.id, selectedTeam || undefined, 50);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Feed de Actividad"
        description="Check-ins recientes del equipo en tiempo real"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="text-sm border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filtrar por equipo"
        >
          <option value="">Todos los equipos</option>
          {teams?.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {feed && (
          <span className="text-sm text-muted-foreground">
            {feed.length} check-in{feed.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && !feed?.length && (
        <EmptyState
          icon={Activity}
          title="Sin actividad reciente"
          description="Cuando el equipo haga check-ins aparecerán aquí."
        />
      )}

      {!isLoading && feed && feed.length > 0 && (
        <div className="space-y-3">
          {feed.map((item) => <FeedCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
