"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { type Sprint } from "@/hooks/useSprints";

const STATUS_COLOR: Record<string, string> = {
  PLANNING:  "bg-muted-foreground/40",
  ACTIVE:    "bg-primary",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-muted-foreground/20",
};

const WEEK_W = 56;

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date)  { return Math.round((b.getTime() - a.getTime()) / 86_400_000); }

interface SprintTimelineProps {
  sprints: Sprint[];
}

export function SprintTimeline({ sprints }: SprintTimelineProps) {
  const { weeks, timelineStart } = useMemo(() => {
    if (sprints.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const weeks: Date[] = [];
      for (let i = 0; i < 8; i++) weeks.push(addDays(start, i * 7));
      return { weeks, timelineStart: start };
    }

    const dates = sprints.flatMap((s) => [new Date(s.start_date), new Date(s.end_date)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = addDays(min, -7);
    const end   = addDays(max, 14);
    const totalWeeks = Math.ceil(diffDays(start, end) / 7) + 1;
    const weeks: Date[] = [];
    for (let i = 0; i < totalWeeks; i++) weeks.push(addDays(start, i * 7));
    return { weeks, timelineStart: start };
  }, [sprints]);

  const today = new Date();
  const todayLeft = Math.max(0, (diffDays(timelineStart, today) / 7) * WEEK_W);
  const totalWidth = weeks.length * WEEK_W;
  const ROW_H = 40;

  if (sprints.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Sin sprints en este ciclo
      </div>
    );
  }

  // Group by team for display
  const byTeam = sprints.reduce<Record<string, Sprint[]>>((acc, s) => {
    const key = s.team_name ?? s.team_id;
    acc[key] = [...(acc[key] ?? []), s];
    return acc;
  }, {});

  return (
    <div className="overflow-auto border rounded-lg">
      <div className="flex">
        {/* Label column */}
        <div className="w-44 shrink-0 border-r">
          <div className="h-9 border-b px-3 flex items-center text-xs font-medium text-muted-foreground">Equipo</div>
          {Object.keys(byTeam).map((team) =>
            byTeam[team].map((s, i) => (
              <div key={s.sprint_id} className="border-b px-3 flex items-center" style={{ height: ROW_H }}>
                {i === 0 ? <p className="text-xs truncate font-medium">{team}</p> : <p className="text-xs truncate text-muted-foreground pl-2">{s.sprint_name}</p>}
              </div>
            ))
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-auto" style={{ minWidth: 0 }}>
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Week headers */}
            <div className="flex h-9 border-b sticky top-0 bg-background z-10">
              {weeks.map((w, i) => (
                <div key={i} className="border-r text-[10px] text-muted-foreground flex items-end pb-1 px-1 shrink-0" style={{ width: WEEK_W }}>
                  {w.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Today line */}
              <div className="absolute top-0 bottom-0 w-px bg-primary/60 z-20 pointer-events-none" style={{ left: todayLeft }} />

              {/* Week grid */}
              <div className="absolute inset-0 flex pointer-events-none">
                {weeks.map((_, i) => <div key={i} className="border-r border-dashed border-muted shrink-0" style={{ width: WEEK_W }} />)}
              </div>

              {/* Sprint bars */}
              {Object.keys(byTeam).flatMap((team) =>
                byTeam[team].map((s) => {
                  const left  = (diffDays(timelineStart, new Date(s.start_date)) / 7) * WEEK_W;
                  const width = Math.max(WEEK_W / 2, (diffDays(new Date(s.start_date), new Date(s.end_date)) / 7) * WEEK_W);
                  return (
                    <div key={s.sprint_id} className="relative border-b" style={{ height: ROW_H }}>
                      <div
                        className={cn("absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center px-2 text-[10px] font-medium text-white truncate", STATUS_COLOR[s.status])}
                        style={{ left: Math.max(0, left), width }}
                        title={`${s.sprint_name} · ${s.status}`}
                      >
                        <span className="truncate">{s.sprint_name}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px] text-muted-foreground">
        {[
          { color: "bg-primary",             label: "Activo" },
          { color: "bg-green-500",           label: "Completado" },
          { color: "bg-muted-foreground/40", label: "Planificando" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            {label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <span className="h-4 w-px bg-primary/60" />
          Hoy
        </span>
      </div>
    </div>
  );
}
