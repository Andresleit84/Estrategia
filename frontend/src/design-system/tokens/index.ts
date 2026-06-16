export type OKRStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "COMPLETED"
  | "CANCELLED"
  | "DRAFT";

export type OKRLevel = "COMPANY" | "AREA" | "TEAM" | "INDIVIDUAL";

export type KRType = "INCREASE" | "DECREASE" | "MAINTAIN" | "ACHIEVE";

export type ConfidenceLevel = "high" | "mid" | "low";

export function getConfidenceLevel(value: number): ConfidenceLevel {
  if (value >= 0.7) return "high";
  if (value >= 0.4) return "mid";
  return "low";
}

export const STATUS_CONFIG: Record<
  OKRStatus,
  { label: string; colorClass: string; bgClass: string; icon: string }
> = {
  ON_TRACK:  { label: "En curso",   colorClass: "text-okr-on-track",  bgClass: "bg-okr-on-track-bg",  icon: "✓" },
  AT_RISK:   { label: "En riesgo",  colorClass: "text-okr-at-risk",   bgClass: "bg-okr-at-risk-bg",   icon: "!" },
  BEHIND:    { label: "Atrasado",   colorClass: "text-okr-behind",    bgClass: "bg-okr-behind-bg",    icon: "↓" },
  COMPLETED: { label: "Completado", colorClass: "text-okr-completed", bgClass: "bg-okr-completed-bg", icon: "★" },
  CANCELLED: { label: "Cancelado",  colorClass: "text-okr-cancelled", bgClass: "bg-okr-cancelled-bg", icon: "×" },
  DRAFT:     { label: "Borrador",   colorClass: "text-okr-draft",     bgClass: "bg-okr-draft-bg",     icon: "○" },
};

export const LEVEL_CONFIG: Record<OKRLevel, { label: string; depth: number }> = {
  COMPANY:    { label: "Empresa",    depth: 0 },
  AREA:       { label: "Área",       depth: 1 },
  TEAM:       { label: "Equipo",     depth: 2 },
  INDIVIDUAL: { label: "Individual", depth: 3 },
};
