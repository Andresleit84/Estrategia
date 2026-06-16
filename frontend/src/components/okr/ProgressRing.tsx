"use client";

import { cn } from "@/lib/utils";

interface ProgressRingProps {
  progress: number;  // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  status?: string;
}

function getStatusColor(progress: number, status?: string): string {
  if (status === "COMPLETED") return "stroke-blue-500 dark:stroke-blue-400";
  if (status === "CANCELLED") return "stroke-slate-400";
  if (progress >= 70)  return "stroke-green-500 dark:stroke-green-400";
  if (progress >= 40)  return "stroke-amber-500 dark:stroke-amber-400";
  return "stroke-red-500 dark:stroke-red-400";
}

function getTextColor(progress: number, status?: string): string {
  if (status === "COMPLETED") return "fill-blue-500 dark:fill-blue-400";
  if (status === "CANCELLED") return "fill-slate-400";
  if (progress >= 70)  return "fill-green-600 dark:fill-green-400";
  if (progress >= 40)  return "fill-amber-600 dark:fill-amber-400";
  return "fill-red-600 dark:fill-red-400";
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  className,
  status,
}: ProgressRingProps) {
  const clamped   = Math.max(0, Math.min(100, progress));
  const radius    = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset    = circumference - (clamped / 100) * circumference;
  const center    = size / 2;

  const showLabel = size >= 32;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn(className)}
      role="img"
      aria-label={`Progreso: ${clamped}%`}
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        className="stroke-muted fill-none"
        strokeWidth={strokeWidth}
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        className={cn("fill-none transition-all duration-500", getStatusColor(clamped, status))}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Label */}
      {showLabel && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn("font-bold font-mono", getTextColor(clamped, status))}
          fontSize={size / 4.5}
        >
          {Math.round(clamped)}%
        </text>
      )}
    </svg>
  );
}
