import { BookOpen, FileText, Layers, Clock, CheckCircle2, XCircle, Circle } from "lucide-react";
import type { BacklogType, BacklogPriority, BacklogStatus } from "@/hooks/useBacklog";

export const TYPE_CONFIG: Record<BacklogType, { label: string; Icon: any; color: string; bg: string }> = {
  EPIC:    { label: "Épica",    Icon: Layers,   color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30" },
  FEATURE: { label: "Feature",  Icon: BookOpen, color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30" },
  STORY:   { label: "Historia", Icon: FileText, color: "text-green-600 dark:text-green-400",   bg: "bg-green-100 dark:bg-green-900/30" },
};

export const PRIORITY_CONFIG: Record<BacklogPriority, { label: string; color: string; dot: string }> = {
  CRITICAL: { label: "Crítica", color: "text-red-600",    dot: "bg-red-500" },
  HIGH:     { label: "Alta",    color: "text-orange-500", dot: "bg-orange-400" },
  MEDIUM:   { label: "Media",   color: "text-amber-500",  dot: "bg-amber-400" },
  LOW:      { label: "Baja",    color: "text-gray-400",   dot: "bg-gray-300" },
};

export const STATUS_CONFIG: Record<BacklogStatus, { label: string; Icon: any; color: string }> = {
  OPEN:        { label: "Abierta",    Icon: Circle,       color: "text-muted-foreground" },
  IN_PROGRESS: { label: "En curso",   Icon: Clock,        color: "text-blue-500" },
  DONE:        { label: "Completada", Icon: CheckCircle2, color: "text-green-500" },
  CANCELLED:   { label: "Cancelada",  Icon: XCircle,      color: "text-muted-foreground" },
};

export const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

export const BACKLOG_TEMPLATES: Record<BacklogType, string> = {
  EPIC:    `Como:\nNecesito:\nPara:`,
  FEATURE: `Capacidad que entrega:\nComportamiento esperado:\nDependencias técnicas:`,
  STORY:   `Como:\nQuiero:\nPara:`,
};

export const BACKLOG_AC_TEMPLATES: Record<BacklogType, string> = {
  EPIC:    `- [ ] Capacidad entregada y disponible en producción\n- [ ] Validado y aceptado por el sponsor o área responsable\n- [ ] Métricas de éxito definidas y medibles`,
  FEATURE: `- [ ] El sistema permite [comportamiento esperado]\n- [ ] Los casos de borde están cubiertos\n- [ ] Sin regresiones en funcionalidades existentes`,
  STORY:   `- [ ] Dado [contexto] / Cuando [acción] / Entonces [resultado]\n- [ ] \n- [ ] `,
};

export const BACKLOG_AC_HINTS: Record<BacklogType, string> = {
  EPIC:    "Condiciones de alto nivel para declarar la épica completada",
  FEATURE: "Comportamientos funcionales verificables por el equipo de QA",
  STORY:   "Formato: Dado / Cuando / Entonces — una condición por línea",
};

export function getBacklogTemplate(type: BacklogType) { return BACKLOG_TEMPLATES[type]; }
export function getAcTemplate(type: BacklogType)      { return BACKLOG_AC_TEMPLATES[type]; }
export function isBlankTemplate(val: string, type: BacklogType)   { return !val.trim() || val.trim() === BACKLOG_TEMPLATES[type].trim(); }
export function isBlankAcTemplate(val: string, type: BacklogType) { return !val.trim() || val.trim() === BACKLOG_AC_TEMPLATES[type].trim(); }
