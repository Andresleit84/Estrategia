import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKRValue(value: number | null | undefined, unit: string | null | undefined): string {
  const v = value ?? 0;
  const u = unit ?? "";
  if (u === "%") return `${v}%`;
  if (u === "$") return `$${v.toLocaleString()}`;
  if (u === "#" || u === "") return `${v}`;
  return `${v} ${u}`;
}
