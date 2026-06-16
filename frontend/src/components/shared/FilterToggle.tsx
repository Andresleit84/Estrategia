"use client";

import { cn } from "@/lib/utils";

export function FilterToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; Icon?: React.ElementType }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
            value === v
              ? "border-primary bg-primary/8 text-foreground shadow-sm"
              : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40",
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          {label}
        </button>
      ))}
    </div>
  );
}
