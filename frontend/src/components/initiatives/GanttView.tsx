"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { type Initiative } from "@/hooks/useInitiatives";

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const WEEK_WIDTH = 60; // px per week column

interface GanttViewProps {
  initiatives: Initiative[];
}

export function GanttView({ initiatives: inits }: GanttViewProps) {
  const { weeks, timelineStart, active } = useMemo(() => {
    const active = inits.filter((i) => i.start_date || i.due_date);
    if (active.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const weeks: Date[] = [];
      for (let i = 0; i < 12; i++) weeks.push(addDays(start, i * 7));
      return { weeks, timelineStart: start, active };
    }

    const dates = active.flatMap((i) => [
      i.start_date ? new Date(i.start_date) : null,
      i.due_date   ? new Date(i.due_date)   : null,
    ]).filter(Boolean) as Date[];

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Pad 1 week on each side
    const start = addDays(minDate, -7);
    const end   = addDays(maxDate,  14);
    const totalDays = diffDays(start, end);
    const totalWeeks = Math.ceil(totalDays / 7) + 1;

    const weeks: Date[] = [];
    for (let i = 0; i < totalWeeks; i++) weeks.push(addDays(start, i * 7));

    return { weeks, timelineStart: start, active };
  }, [inits]);

  const totalWidth = weeks.length * WEEK_WIDTH;
  const today = new Date();
  const todayLeft = Math.max(0, (diffDays(timelineStart, today) / 7) * WEEK_WIDTH);

  function barPosition(init: Initiative) {
    const start = init.start_date ? new Date(init.start_date) : init.due_date ? addDays(new Date(init.due_date), -7) : null;
    const end   = init.due_date   ? new Date(init.due_date)   : init.start_date ? addDays(new Date(init.start_date), 7) : null;
    if (!start || !end) return null;

    const left  = (diffDays(timelineStart, start) / 7) * WEEK_WIDTH;
    const width = Math.max(WEEK_WIDTH / 2, (diffDays(start, end) / 7) * WEEK_WIDTH);
    return { left: Math.max(0, left), width };
  }

  function barColor(init: Initiative) {
    if (init.status === "DONE")       return "bg-green-500";
    if (init.status === "CANCELLED")  return "bg-muted-foreground/30";
    if (init.is_overdue)              return "bg-red-500";
    if (init.progress >= 70)          return "bg-primary";
    if (init.progress >= 40)          return "bg-amber-500";
    return "bg-blue-500";
  }

  if (active.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Ninguna iniciativa tiene fechas definidas — añade fechas de inicio o límite para ver el Gantt.
      </div>
    );
  }

  const ROW_H = 44;

  return (
    <div className="overflow-auto border rounded-lg">
      <div className="flex">
        {/* Label column */}
        <div className="w-56 shrink-0 border-r">
          {/* Header */}
          <div className="h-10 border-b px-3 flex items-center text-xs font-medium text-muted-foreground">
            Iniciativa
          </div>
          {active.map((init) => (
            <div
              key={init.id}
              className="border-b px-3 flex items-center"
              style={{ height: ROW_H }}
            >
              <div className="min-w-0">
                <p className="text-sm truncate" title={init.title}>
                  {(init as any).code && <span className="text-[10px] font-mono font-semibold text-muted-foreground mr-1">{(init as any).code}</span>}
                  {init.title}
                </p>
                {init.team_name && (
                  <p className="text-[10px] text-muted-foreground truncate">{init.team_name}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-auto" style={{ minWidth: 0 }}>
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            {/* Week headers */}
            <div className="flex h-10 border-b sticky top-0 bg-background z-10">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="border-r text-[10px] text-muted-foreground flex items-end pb-1 px-1.5 shrink-0"
                  style={{ width: WEEK_WIDTH }}
                >
                  {w.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-primary/60 z-20 pointer-events-none"
                style={{ left: todayLeft }}
              />

              {/* Week grid */}
              <div className="absolute inset-0 flex pointer-events-none">
                {weeks.map((_, i) => (
                  <div key={i} className="border-r border-dashed border-muted" style={{ width: WEEK_WIDTH, flexShrink: 0 }} />
                ))}
              </div>

              {/* Bars */}
              {active.map((init) => {
                const pos = barPosition(init);
                return (
                  <div key={init.id} className="relative border-b" style={{ height: ROW_H }}>
                    {pos && (
                      <div
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 rounded-full h-6 flex items-center px-2 text-[10px] font-medium text-white truncate",
                          barColor(init)
                        )}
                        style={{ left: pos.left, width: pos.width }}
                        title={`${init.title} · ${Math.round(init.progress)}%`}
                      >
                        <span className="truncate">
                          {Math.round(init.progress)}%
                          {init.is_overdue && " ⚠"}
                        </span>
                      </div>
                    )}

                    {/* Milestone ticks */}
                    {init.milestones?.map((m) => {
                      if (!m.due_date) return null;
                      const left = (diffDays(timelineStart, new Date(m.due_date)) / 7) * WEEK_WIDTH;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "absolute top-1 h-2.5 w-2.5 rounded-full border-2 border-white z-10",
                            m.status === "COMPLETED" ? "bg-green-500" :
                            m.is_overdue ? "bg-red-500" : "bg-amber-400"
                          )}
                          style={{ left: left - 5 }}
                          title={`${m.title} · ${m.due_date}`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px] text-muted-foreground">
        {[
          { color: "bg-primary",    label: "En progreso" },
          { color: "bg-green-500",  label: "Completada" },
          { color: "bg-red-500",    label: "Vencida" },
          { color: "bg-amber-500",  label: "En riesgo" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-400" />
          Hito
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span className="h-4 w-px bg-primary/60" />
          Hoy
        </span>
      </div>
    </div>
  );
}
