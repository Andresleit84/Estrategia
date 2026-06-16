"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectOption } from "@/components/ui/select";
import {
  useGovernanceCalendar,
  useCreateGovernanceActivity,
  useDeleteGovernanceActivity,
  type GovernanceHorizon,
  type GovernanceEvent,
  type GovernanceStatus,
  type CreateGovernanceActivityInput,
} from "@/hooks/useReports";
import { useCycles } from "@/hooks/useCycles";
import { useConfirm } from "@/hooks/useConfirm";
import {
  CheckCircle2, Clock, AlertTriangle, Circle,
  Users, Target, FileText, RotateCcw, Rocket,
  Star, Calendar, ChevronLeft, ChevronRight, Filter,
  List, LayoutGrid, CalendarDays, Plus, Download, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

type ViewMode = "list" | "kanban" | "calendar";

const STATUS_CONFIG: Record<GovernanceStatus, {
  icon: React.ElementType;
  chip: string; border: string; colHeader: string;
}> = {
  COMPLETED:   { icon: CheckCircle2,  chip: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",  border: "border-l-green-500",  colHeader: "border-t-green-500"  },
  IN_PROGRESS: { icon: Clock,         chip: "bg-blue-100  text-blue-700  dark:bg-blue-900/40  dark:text-blue-400",   border: "border-l-blue-500",   colHeader: "border-t-blue-500"   },
  UPCOMING:    { icon: Circle,        chip: "bg-muted     text-muted-foreground",                                    border: "border-l-muted",      colHeader: "border-t-border"     },
  OVERDUE:     { icon: AlertTriangle, chip: "bg-red-100   text-red-700   dark:bg-red-900/40   dark:text-red-400",    border: "border-l-red-500",    colHeader: "border-t-red-500"    },
};

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  KICKOFF:          { icon: Rocket,       color: "text-indigo-500"  },
  CHECK_IN_HEALTH:  { icon: Target,       color: "text-emerald-500" },
  MID_REVIEW:       { icon: Filter,       color: "text-amber-500"   },
  CYCLE_REVIEW:     { icon: CheckCircle2, color: "text-blue-500"    },
  RETROSPECTIVE:    { icon: RotateCcw,    color: "text-purple-500"  },
  STRATEGIC_REVIEW: { icon: Star,         color: "text-amber-600"   },
  ANNUAL_PLANNING:  { icon: Calendar,     color: "text-teal-500"    },
  CUSTOM:           { icon: FileText,     color: "text-muted-foreground" },
};

const EVENT_TYPE_KEY: Record<string, string> = {
  KICKOFF:          "typeKickoff",
  CHECK_IN_HEALTH:  "typeCheckin",
  MID_REVIEW:       "typeMidReview",
  CYCLE_REVIEW:     "typeCycleClose",
  RETROSPECTIVE:    "typeRetro",
  STRATEGIC_REVIEW: "typeStrategic",
  ANNUAL_PLANNING:  "typeAnnualPlanning",
  CUSTOM:           "typeCustom",
};

const STATUS_KEY: Record<GovernanceStatus, string> = {
  COMPLETED:   "completed",
  IN_PROGRESS: "inProgress",
  UPCOMING:    "upcoming",
  OVERDUE:     "overdue",
};

const HORIZON_KEY: Record<GovernanceHorizon, string> = {
  QUARTERLY: "quarterly",
  ANNUAL:    "annual",
  "3YEAR":   "threeYears",
};

const KANBAN_ORDER: GovernanceStatus[] = ["OVERDUE", "IN_PROGRESS", "UPCOMING", "COMPLETED"];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const EVENT_TYPE_VALUES = [
  "CUSTOM", "KICKOFF", "CHECK_IN_HEALTH", "MID_REVIEW",
  "CYCLE_REVIEW", "RETROSPECTIVE", "STRATEGIC_REVIEW", "ANNUAL_PLANNING",
];

const STATUS_OPTIONS: GovernanceStatus[] = ["UPCOMING", "IN_PROGRESS", "COMPLETED", "OVERDUE"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}
function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "short" });
}
function formatMonth(d: string) {
  return new Date(d).toLocaleDateString("es", { month: "long", year: "numeric" });
}
function groupByMonth(events: GovernanceEvent[]) {
  const map = new Map<string, GovernanceEvent[]>();
  for (const ev of events) {
    const key = ev.scheduled_date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function prevMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() - 1, 1); }
function nextMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }

// ── Event Card (list view) ─────────────────────────────────────────────────────

function EventCard({ event, onDelete }: { event: GovernanceEvent; onDelete?: (id: string) => void }) {
  const t = useTranslations("pages.governancePage");
  const [expanded, setExpanded] = useState(false);
  const sc   = STATUS_CONFIG[event.status];
  const ec   = EVENT_CONFIG[event.event_type] ?? { icon: FileText, color: "text-muted-foreground" };
  const Icon = ec.icon;
  const StatusIcon = sc.icon;
  const statusLabel = t(STATUS_KEY[event.status]);
  const eventLabel  = t(EVENT_TYPE_KEY[event.event_type] ?? "typeCustom");

  return (
    <Card
      className={cn("border-l-4 transition-shadow hover:shadow-sm cursor-pointer", sc.border)}
      onClick={() => setExpanded(v => !v)}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(v => !v)}
      aria-expanded={expanded}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("shrink-0 mt-0.5", ec.color)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold leading-snug">{event.title}</p>
                  {event.is_custom && (
                    <Badge variant="outline" className="text-[10px] py-0 border-dashed">Custom</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{eventLabel} · {event.cycle_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", sc.chip)}>
                  <StatusIcon className="h-3 w-3" aria-hidden="true" />
                  {statusLabel}
                </span>
                {event.is_custom && onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(event.event_id.replace("CUSTOM_", "")); }}
                    className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors"
                    aria-label="Eliminar actividad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {event.event_type === "CHECK_IN_HEALTH" && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Salud de check-ins</span>
                  <span className="font-mono font-semibold">{event.completion_pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all",
                    event.completion_pct >= 70 ? "bg-green-500" :
                    event.completion_pct >= 35 ? "bg-amber-500" : "bg-red-500"
                  )} style={{ width: `${event.completion_pct}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{event.responsible}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{formatDate(event.scheduled_date)} — {formatDate(event.due_date)}</span>
              </div>
              <Badge variant="outline" className="text-[10px] py-0">{event.frequency}</Badge>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
            <div className="flex items-start gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs font-medium">{event.deliverable}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Kanban card (compact) ─────────────────────────────────────────────────────

function KanbanCard({ event, onDelete }: { event: GovernanceEvent; onDelete?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const ec = EVENT_CONFIG[event.event_type] ?? { icon: FileText, color: "text-muted-foreground" };
  const Icon = ec.icon;

  return (
    <Card
      className="p-3 cursor-pointer hover:shadow-sm transition-shadow"
      onClick={() => setExpanded(v => !v)}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(v => !v)}
    >
      <div className="flex items-start gap-2">
        <div className={cn("shrink-0 mt-0.5", ec.color)}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-semibold leading-snug flex-1 min-w-0">{event.title}</p>
            {event.is_custom && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(event.event_id.replace("CUSTOM_", "")); }}
                className="shrink-0 p-0.5 text-muted-foreground hover:text-red-500 rounded transition-colors"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{event.cycle_name}</p>
          <div className="flex items-center gap-1 mt-1.5">
            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground">{formatDateShort(event.scheduled_date)}</span>
            <span className="text-[10px] text-muted-foreground">– {formatDateShort(event.due_date)}</span>
          </div>
          {event.event_type === "CHECK_IN_HEALTH" && (
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full",
                event.completion_pct >= 70 ? "bg-green-500" :
                event.completion_pct >= 35 ? "bg-amber-500" : "bg-red-500"
              )} style={{ width: `${event.completion_pct}%` }} />
            </div>
          )}
          {expanded && (
            <div className="mt-2 pt-2 border-t space-y-1.5">
              <p className="text-[10px] text-muted-foreground leading-relaxed">{event.description}</p>
              <div className="flex items-start gap-1">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[10px] font-medium">{event.deliverable}</p>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                <p className="text-[10px] text-muted-foreground">{event.responsible}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanView({ events, onDelete }: { events: GovernanceEvent[]; onDelete: (id: string) => void }) {
  const t = useTranslations("pages.governancePage");
  const byStatus = useMemo(() => {
    const m = new Map<GovernanceStatus, GovernanceEvent[]>();
    for (const s of KANBAN_ORDER) m.set(s, []);
    for (const ev of events) m.get(ev.status)?.push(ev);
    return m;
  }, [events]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_ORDER.map(status => {
        const sc  = STATUS_CONFIG[status];
        const col = byStatus.get(status) ?? [];
        return (
          <div key={status} className="flex flex-col min-w-0">
            <div className={cn("border-t-2 rounded-t-lg pt-2.5 px-3 pb-2.5 bg-muted/30", sc.colHeader)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <sc.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(STATUS_KEY[status])}
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
                  {col.length}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2 overflow-y-auto max-h-[65vh] pr-0.5">
              {col.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Sin eventos</div>
              ) : (
                col.map(ev => <KanbanCard key={ev.event_id} event={ev} onDelete={onDelete} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function CalendarView({ events, calDate, setCalDate, onDelete }: {
  events: GovernanceEvent[];
  calDate: Date;
  setCalDate: (d: Date) => void;
  onDelete: (id: string) => void;
}) {
  const year  = calDate.getFullYear();
  const month = calDate.getMonth();

  const cells = useMemo(() => {
    const days  = getDaysInMonth(year, month);
    const first = getFirstWeekday(year, month);
    const arr: (number | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const m = new Map<number, GovernanceEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.scheduled_date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!m.has(day)) m.set(day, []);
        m.get(day)!.push(ev);
      }
    }
    return m;
  }, [events, year, month]);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setCalDate(prevMonth(calDate)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-base font-semibold capitalize">
          {calDate.toLocaleDateString("es", { month: "long", year: "numeric" })}
        </h3>
        <button
          onClick={() => { setCalDate(nextMonth(calDate)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 border-l border-t rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          const dayEvs   = day ? (eventsByDay.get(day) ?? []) : [];
          const visible  = dayEvs.slice(0, 2);
          const extra    = dayEvs.length - visible.length;
          const selected = day === selectedDay;

          return (
            <div
              key={i}
              className={cn(
                "border-r border-b min-h-[90px] p-1.5 transition-colors",
                !day ? "bg-muted/20" : "bg-background",
                day && dayEvs.length > 0 && "cursor-pointer hover:bg-muted/30",
                selected && "bg-muted/40"
              )}
              onClick={() => day && setSelectedDay(selected ? null : day)}
              role={day && dayEvs.length > 0 ? "button" : undefined}
              tabIndex={day && dayEvs.length > 0 ? 0 : undefined}
              onKeyDown={(e) => e.key === "Enter" && day && setSelectedDay(selected ? null : day)}
            >
              {day && (
                <>
                  <div className={cn(
                    "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                    isToday(day)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map(ev => {
                      const sc = STATUS_CONFIG[ev.status];
                      const ec = EVENT_CONFIG[ev.event_type];
                      return (
                        <div
                          key={ev.event_id}
                          title={ev.title}
                          className={cn(
                            "flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.5 rounded truncate",
                            sc.chip
                          )}
                        >
                          {ec && <ec.icon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />}
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}
                    {extra > 0 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{extra} más</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay !== null && selectedEvents.length > 0 && (
        <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
          <h4 className="text-sm font-semibold">
            {new Date(year, month, selectedDay).toLocaleDateString("es", {
              weekday: "long", day: "numeric", month: "long"
            })}
          </h4>
          <div className="space-y-2">
            {selectedEvents.map(ev => <EventCard key={ev.event_id} event={ev} onDelete={onDelete} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({ events, onDelete }: { events: GovernanceEvent[]; onDelete: (id: string) => void }) {
  const grouped = useMemo(() => groupByMonth(events), [events]);

  if (events.length === 0) return null;

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([month, monthEvents]) => (
        <div key={month}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {formatMonth(month + "-01")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            {monthEvents.map(ev => <EventCard key={ev.event_id} event={ev} onDelete={onDelete} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Nueva actividad dialog ─────────────────────────────────────────────────────

const EMPTY_FORM: CreateGovernanceActivityInput = {
  title: "", event_type: "CUSTOM", responsible: "", deliverable: "",
  description: "", frequency: "Única vez", scheduled_date: "", due_date: "",
  status: "UPCOMING", cycle_id: "",
};

function NewActivityDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations("pages.governancePage");
  const [form, setForm] = useState<CreateGovernanceActivityInput>(EMPTY_FORM);
  const { data: cycles = [] } = useCycles();
  const create = useCreateGovernanceActivity();

  const set = (k: keyof CreateGovernanceActivityInput, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.scheduled_date) return;
    const payload: CreateGovernanceActivityInput = {
      ...form,
      cycle_id: form.cycle_id || undefined,
      due_date: form.due_date || undefined,
      responsible: form.responsible || undefined,
      deliverable: form.deliverable || undefined,
      description: form.description || undefined,
      frequency: form.frequency || undefined,
    };
    await create.mutateAsync(payload);
    setForm(EMPTY_FORM);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newActivityTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ga-title">Título *</Label>
            <Input
              id="ga-title" required
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Ej. Reunión de alineación estratégica"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ga-type">Tipo</Label>
              <Select
                id="ga-type"
                value={form.event_type}
                onChange={e => set("event_type", e.target.value)}
              >
                {EVENT_TYPE_VALUES.map(v => (
                  <SelectOption key={v} value={v}>{t(EVENT_TYPE_KEY[v] ?? "typeCustom")}</SelectOption>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ga-status">Estado</Label>
              <Select
                id="ga-status"
                value={form.status}
                onChange={e => set("status", e.target.value as GovernanceStatus)}
              >
                {STATUS_OPTIONS.map(s => (
                  <SelectOption key={s} value={s}>{t(STATUS_KEY[s])}</SelectOption>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ga-scheduled">Fecha programada *</Label>
              <Input
                id="ga-scheduled" type="date" required
                value={form.scheduled_date}
                onChange={e => set("scheduled_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ga-due">Fecha límite</Label>
              <Input
                id="ga-due" type="date"
                value={form.due_date}
                onChange={e => set("due_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ga-responsible">Responsable</Label>
            <Input
              id="ga-responsible"
              value={form.responsible}
              onChange={e => set("responsible", e.target.value)}
              placeholder="Ej. Líder OKR"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ga-deliverable">Entregable</Label>
            <Input
              id="ga-deliverable"
              value={form.deliverable}
              onChange={e => set("deliverable", e.target.value)}
              placeholder="Ej. Informe de revisión"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ga-description">Descripción</Label>
            <Input
              id="ga-description"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Descripción opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ga-frequency">Frecuencia</Label>
              <Input
                id="ga-frequency"
                value={form.frequency}
                onChange={e => set("frequency", e.target.value)}
                placeholder="Ej. Única vez"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ga-cycle">Ciclo asociado</Label>
              <Select
                id="ga-cycle"
                value={form.cycle_id ?? ""}
                onChange={e => set("cycle_id", e.target.value)}
              >
                <SelectOption value="">Sin ciclo</SelectOption>
                {cycles.map(c => (
                  <SelectOption key={c.id} value={c.id}>{c.name}</SelectOption>
                ))}
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Guardando…" : "Crear actividad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

const STATUS_FILTER_VALUES: Array<GovernanceStatus | "ALL"> = [
  "ALL", "OVERDUE", "IN_PROGRESS", "UPCOMING", "COMPLETED",
];

const VIEW_OPTIONS: Array<{ value: ViewMode; icon: React.ElementType; label: string }> = [
  { value: "list",     icon: List,         label: "Lista"      },
  { value: "kanban",   icon: LayoutGrid,   label: "Tablero"    },
  { value: "calendar", icon: CalendarDays, label: "Calendario" },
];

function downloadPdf(horizon: GovernanceHorizon) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
  const url  = `${base}/reports/governance/pdf?horizon=${horizon}`;
  const a    = document.createElement("a");
  a.href = url;
  a.download = `gobierno-okr-${horizon.toLowerCase()}.pdf`;
  a.click();
}

export default function GovernancePage() {
  const t  = useTranslations("pages.governancePage");
  const tR = useTranslations("pages.reports.governance");
  const [horizon,       setHorizon]       = useState<GovernanceHorizon>("ANNUAL");
  const [filter,        setFilter]        = useState<GovernanceStatus | "ALL">("ALL");
  const [view,          setView]          = useState<ViewMode>("list");
  const [calDate,       setCalDate]       = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dialogOpen,    setDialogOpen]    = useState(false);

  const confirm        = useConfirm();
  const { data: events = [], isLoading } = useGovernanceCalendar(horizon);
  const deleteActivity = useDeleteGovernanceActivity();

  const filtered = filter === "ALL" ? events : events.filter(e => e.status === filter);

  const counts = useMemo(() => ({
    overdue:    events.filter(e => e.status === "OVERDUE").length,
    inProgress: events.filter(e => e.status === "IN_PROGRESS").length,
    upcoming:   events.filter(e => e.status === "UPCOMING").length,
    completed:  events.filter(e => e.status === "COMPLETED").length,
  }), [events]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "¿Eliminar esta actividad?",
      description: "Se eliminará el evento de la agenda de gobierno. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar actividad",
      variant: "destructive",
    });
    if (ok) deleteActivity.mutate(id);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={tR("title")}
        description={tR("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => downloadPdf(horizon)}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t("newActivity")}
            </Button>
            <Link
              href="/reports"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Reportes
            </Link>
          </div>
        }
      />

      <NewActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("overdue"),    value: counts.overdue,    color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/20"     },
          { label: t("inProgress"), value: counts.inProgress, color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/20"   },
          { label: t("upcoming"),   value: counts.upcoming,   color: "text-foreground",  bg: "bg-muted/50"                     },
          { label: t("completed"),  value: counts.completed,  color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/20" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl p-3 text-center", s.bg)}>
            <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls row: horizon + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          {(Object.keys(HORIZON_KEY) as GovernanceHorizon[]).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md font-medium transition-all",
                horizon === h
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(HORIZON_KEY[h])}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          {VIEW_OPTIONS.map(v => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              title={v.label}
              aria-label={v.label}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-all",
                view === v.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <v.icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      {view !== "calendar" && (
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTER_VALUES.map(val => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={cn(
                "px-3 py-1 text-xs rounded-full font-medium border transition-all",
                filter === val
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
            >
              {val === "ALL" ? "Todos" : t(STATUS_KEY[val as GovernanceStatus])}
              {val !== "ALL" && (
                <span className="ml-1 opacity-60">
                  {val === "OVERDUE"     ? counts.overdue :
                   val === "IN_PROGRESS" ? counts.inProgress :
                   val === "UPCOMING"    ? counts.upcoming : counts.completed}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-32" />
              {[0, 1].map(j => <Skeleton key={j} className="h-24 w-full" />)}
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin actividades de gobierno</p>
          <p className="text-sm mt-1">
            Configura ciclos en la sección de Ciclos o crea una actividad personalizada.
          </p>
          <div className="flex items-center gap-3 justify-center mt-4">
            <Link href="/cycles" className="text-sm text-primary hover:underline">
              Ir a Ciclos →
            </Link>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t("newActivity")}
            </Button>
          </div>
        </div>
      ) : view === "list" ? (
        filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Sin eventos para este filtro.
          </div>
        ) : (
          <ListView events={filtered} onDelete={handleDelete} />
        )
      ) : view === "kanban" ? (
        <KanbanView events={filtered} onDelete={handleDelete} />
      ) : (
        <CalendarView events={events} calDate={calDate} setCalDate={setCalDate} onDelete={handleDelete} />
      )}
    </div>
  );
}
