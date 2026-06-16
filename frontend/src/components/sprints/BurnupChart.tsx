"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { type BurnupPoint } from "@/hooks/useSprints";

interface BurnupChartProps {
  data: BurnupPoint[];
}

export function BurnupChart({ data }: BurnupChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Sin datos de sprints completados aún
      </div>
    );
  }

  const chartData = data.map((p) => ({
    name: p.sprint_name.length > 14 ? p.sprint_name.slice(0, 12) + "…" : p.sprint_name,
    ideal: p.ideal_progress,
    real: p.status === "COMPLETED" || p.status === "ACTIVE" ? p.actual_progress : null,
    velocity: p.actual_velocity,
    planned: p.planned_velocity,
    fullName: p.sprint_name,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 5, right: 24, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: any, name: any) => [
            `${Number(value).toFixed(1)}%`,
            name === "ideal" ? "Ideal" : "Real",
          ]}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend
          formatter={(v) => v === "ideal" ? "Progreso ideal" : "Progreso real"}
          iconSize={12}
          wrapperStyle={{ fontSize: 12 }}
        />
        <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
        <Line
          type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))"
          strokeDasharray="6 3" strokeWidth={1.5} dot={false} connectNulls />
        <Line
          type="monotone" dataKey="real" stroke="hsl(var(--primary))"
          strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }}
          connectNulls activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
