/** Shared status label/color maps — single source of truth for all components. */

export const INITIATIVE_STATUS_LABELS: Record<string, string> = {
  TODO:        "Por hacer",
  IN_PROGRESS: "En progreso",
  DONE:        "Completada",
  CANCELLED:   "Cancelada",
};

export const SPRINT_STATUS_LABELS: Record<string, string> = {
  PLANNING:  "Planificación",
  ACTIVE:    "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const OBJECTIVE_STATUS_LABELS: Record<string, string> = {
  DRAFT:     "Borrador",
  ACTIVE:    "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  AT_RISK:   "En riesgo",
};

export const KR_STATUS_LABELS: Record<string, string> = {
  ACTIVE:    "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  AT_RISK:   "En riesgo",
};

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  TODO:      "Pendiente",
  DONE:      "Completado",
  CANCELLED: "Cancelado",
};

export const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  KR_AT_RISK:    "bg-red-500",
  KR_COMPLETED:  "bg-green-500",
  OBJ_COMPLETED: "bg-blue-500",
  CHECKIN_DUE:   "bg-amber-500",
  STALE_KR:      "bg-orange-500",
};

/** Sprint board columns in order */
export const SPRINT_BOARD_COLUMNS = [
  { id: "TODO",        label: "Por hacer",    color: "border-l-gray-400" },
  { id: "IN_PROGRESS", label: "En progreso",  color: "border-l-blue-500" },
  { id: "DONE",        label: "Completada",   color: "border-l-green-500" },
  { id: "CANCELLED",   label: "Cancelada",    color: "border-l-red-400" },
] as const;

export const OBJECTIVE_LEVELS: Record<string, string> = {
  COMPANY:    "Empresa",
  AREA:       "Área",
  TEAM:       "Equipo",
  INDIVIDUAL: "Individual",
};

export const ORG_MODES = [
  { value: "AGILE",      label: "Ágil (Scrum/Kanban)" },
  { value: "TRADITIONAL", label: "Tradicional (Waterfall)" },
  { value: "HYBRID",     label: "Híbrido" },
] as const;
