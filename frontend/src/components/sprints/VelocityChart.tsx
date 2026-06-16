"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { type Sprint } from "@/hooks/useSprints";

interface VelocityChartProps {
  data: Sprint[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Sin sprints completados aún
      </div>
    );
  }

  const chartData = data
    .filter((s) => s.status === "COMPLETED")
    .map((s) => ({
      name: s.sprint_name.length > 14 ? s.sprint_name.slice(0, 12) + "…" : s.sprint_name,
      planificada: s.planned_velocity,
      real: s.actual_velocity,
      fullName: s.sprint_name,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Sin sprints completados aún
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: any, name: any) => [value, name === "planificada" ? "Planificada" : "Real"]}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend
          formatter={(v) => v === "planificada" ? "Velocidad planificada" : "Velocidad real"}
          iconSize={12}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="planificada" fill="hsl(var(--muted-foreground))" opacity={0.6} radius={[3, 3, 0, 0]} />
        <Bar dataKey="real" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
