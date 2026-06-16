"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { CheckIn } from "@/hooks/useCheckIns";
import { cn } from "@/lib/utils";

const MOOD_EMOJI: Record<string, string> = {
  GREAT: "🚀", GOOD: "😊", NEUTRAL: "😐", CONCERNED: "😟", BLOCKED: "🚫",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric", month: "short",
  });
}

interface CheckInHistoryProps {
  checkIns: CheckIn[];
  targetValue: number;
  metricUnit: string;
  className?: string;
}

export function CheckInHistory({
  checkIns,
  targetValue,
  metricUnit,
  className,
}: CheckInHistoryProps) {
  if (!checkIns.length) return null;

  const chartData = [...checkIns]
    .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
    .map((ci) => ({
      date: formatDate(ci.checked_at),
      value: ci.current_value,
      confidence: Math.round(ci.confidence * 100),
    }));

  const formatTick = (v: number) => {
    if (metricUnit === "%") return `${v}%`;
    if (metricUnit === "$") return `$${v}`;
    return v.toString();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatTick}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(v) => [formatTick(Number(v ?? 0)), "Valor"]}
          />
          <ReferenceLine
            y={targetValue}
            stroke="var(--color-primary)"
            strokeDasharray="4 4"
            label={{ value: "Meta", fontSize: 10, fill: "var(--color-primary)" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-primary)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* History table */}
      <div className="space-y-1.5">
        {checkIns.slice(0, 8).map((ci) => (
          <div
            key={ci.id}
            className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-muted/50 transition-colors"
          >
            <span className="text-base leading-none mt-0.5">
              {ci.mood ? MOOD_EMOJI[ci.mood] : "·"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium tabular-nums">
                  {ci.current_value} {metricUnit}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {ci.delta !== null && ci.delta !== undefined && (
                    <span className={ci.delta > 0 ? "text-green-600" : ci.delta < 0 ? "text-red-500" : ""}>
                      {ci.delta > 0 ? "+" : ""}{ci.delta?.toFixed(2)}
                    </span>
                  )}
                  <span>{formatDate(ci.checked_at)}</span>
                </div>
              </div>
              {ci.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ci.notes}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                por {ci.checked_by_name} · confianza {Math.round(ci.confidence * 100)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
