"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOrgParameters, useUpdateOrgParameters, useTriggerNotification,
  NOTIFICATION_DEFAULTS,
  type NotifChannel, type NotifFrequency, type NotifType, type NotifSetting,
  type NotifLogEntry, type OrgNotifications, type OrgParameters,
} from "@/hooks/useOrgParameters";
import {
  AlertTriangle, BarChart3, Clock, Flag, Bell, SendHorizonal,
  CheckCircle, Loader2, Info, Zap, Mail, MessageCircle, Globe,
  Play, ChevronDown, ChevronUp, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES = [
  "America/Lima", "America/Bogota", "America/Santiago", "America/Buenos_Aires",
  "America/Mexico_City", "America/Caracas", "America/La_Paz", "America/Asuncion",
  "America/Guayaquil", "America/Montevideo", "America/Panama", "America/Costa_Rica",
  "America/New_York", "Europe/Madrid", "UTC",
];

const DAYS = [
  { label: "D", full: "Domingo",   value: 0 },
  { label: "L", full: "Lunes",     value: 1 },
  { label: "M", full: "Martes",    value: 2 },
  { label: "X", full: "Miércoles", value: 3 },
  { label: "J", full: "Jueves",    value: 4 },
  { label: "V", full: "Viernes",   value: 5 },
  { label: "S", full: "Sábado",    value: 6 },
];

const HOURS: { value: number; label: string }[] = Array.from({ length: 24 }, (_, i) => {
  const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
  const ampm = i < 12 ? "am" : "pm";
  return { value: i, label: `${h12}:00 ${ampm}` };
});

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const FREQUENCIES: { value: NotifFrequency; label: string }[] = [
  { value: "daily",     label: "Diario"     },
  { value: "weekly",    label: "Semanal"    },
  { value: "monthly",   label: "Mensual"    },
  { value: "quarterly", label: "Trimestral" },
  { value: "annual",    label: "Anual"      },
];

function scheduleLabel(s: NotifSetting): string {
  const hour = HOURS[s.hour]?.label ?? `${s.hour}h`;
  switch (s.frequency) {
    case "daily":     return `Diario · ${hour}`;
    case "weekly":    return `${DAY_NAMES[s.day_of_week ?? 1] ?? "?"} · ${hour}`;
    case "monthly":   return `Día ${s.day_of_month ?? 1} · ${hour}`;
    case "quarterly": return `Trimestral · día ${s.day_of_month ?? 1} · ${hour}`;
    case "annual":    return `${MONTH_NAMES[(s.month_of_year ?? 1) - 1]} ${s.day_of_month ?? 1} · ${hour}`;
    default:          return hour;
  }
}

function sentLabel(isoStr?: string | null): string {
  if (!isoStr) return "Nunca enviado";
  try {
    return `Último: ${formatDistanceToNow(new Date(isoStr), { addSuffix: true, locale: es })}`;
  } catch {
    return "Último: desconocido";
  }
}

function nextSendDate(setting: NotifSetting, tz: string): Date | null {
  if (!setting.enabled) return null;
  const candidate = new Date();
  candidate.setMinutes(0, 0, 0);
  candidate.setTime(candidate.getTime() + 3_600_000); // start from next hour

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", hour12: false,
    weekday: "long", day: "numeric", month: "numeric",
  });
  const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find(p => p.type === type)?.value ?? "";

  const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  for (let i = 0; i < 24 * 400; i++) {
    const parts = fmt.formatToParts(candidate);
    const hour  = parseInt(get(parts, "hour"), 10) % 24;
    const dow   = DOW.indexOf(get(parts, "weekday"));
    const dom   = parseInt(get(parts, "day"), 10);
    const mon   = parseInt(get(parts, "month"), 10);

    if (hour === setting.hour) {
      let matches = false;
      switch (setting.frequency) {
        case "daily":   matches = true; break;
        case "weekly":  matches = dow === (setting.day_of_week ?? 1); break;
        case "monthly": matches = dom === (setting.day_of_month ?? 1); break;
        case "quarterly": {
          const qsm = setting.quarter_start_month ?? 1;
          const qm  = [0,1,2,3].map(k => ((qsm - 1 + k * 3) % 12) + 1);
          matches = dom === (setting.day_of_month ?? 1) && qm.includes(mon);
          break;
        }
        case "annual":
          matches = dom === (setting.day_of_month ?? 1) && mon === (setting.month_of_year ?? 1);
          break;
      }
      if (matches) return new Date(candidate);
    }
    candidate.setTime(candidate.getTime() + 3_600_000);
  }
  return null;
}

function nextSendLabel(setting: NotifSetting, tz: string): string {
  if (!setting.enabled) return "";
  const next = nextSendDate(setting, tz);
  if (!next) return "";
  const now = new Date();
  const diffDays = Math.floor((next.getTime() - now.getTime()) / 86_400_000);
  const timeStr = next.toLocaleTimeString("es", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Próximo: hoy · ${timeStr}`;
  if (diffDays === 1) return `Próximo: mañana · ${timeStr}`;
  const dateStr = next.toLocaleDateString("es", { timeZone: tz, weekday: "long", day: "numeric", month: "short" });
  return `Próximo: ${dateStr} · ${timeStr}`;
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

// ── Channel pill ──────────────────────────────────────────────────────────────

function ChannelPill({
  channel, active, onClick,
}: { channel: NotifChannel; active: boolean; onClick: () => void }) {
  const isEmail    = channel === "email";
  const Icon       = isEmail ? Mail : MessageCircle;
  const label      = isEmail ? "Email" : "Telegram";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        active
          ? isEmail
            ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
          : "border-border bg-background text-muted-foreground hover:border-primary/50"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {active && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-current" />}
    </button>
  );
}

// ── Day picker ────────────────────────────────────────────────────────────────

function DayPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1">
      {DAYS.map((d) => (
        <button
          key={d.value}
          type="button"
          title={d.full}
          onClick={() => onChange(d.value)}
          className={cn(
            "h-7 w-7 rounded-full text-[11px] font-semibold transition-all",
            value === d.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

// ── Notification card ─────────────────────────────────────────────────────────

interface NotifCardConfig {
  type: NotifType;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  sentKey: keyof Pick<OrgParameters,
    "notif_sent_risk_sentinel"|"notif_sent_executive_briefer"|
    "notif_sent_checkin_reminder"|"notif_sent_cycle_closure"|
    "notif_sent_agreement_status">;
  logKey: string;           // key in params.raw for NotifLogEntry[]
  staleDaysLabel?: string;
}

const CARDS: NotifCardConfig[] = [
  {
    type: "risk_sentinel",
    title: "Risk Sentinel",
    description: "Detecta KRs en riesgo, sin check-in o con bajo progreso. Análisis predictivo de cierre.",
    icon: AlertTriangle,
    iconBg: "bg-red-500",
    sentKey: "notif_sent_risk_sentinel",
    logKey:  "notif_log_risk_sentinel",
  },
  {
    type: "executive_briefer",
    title: "Briefing Semanal",
    description: "Resumen ejecutivo del ciclo: progreso, logros, alertas y próximos pasos.",
    icon: BarChart3,
    iconBg: "bg-primary",
    sentKey: "notif_sent_executive_briefer",
    logKey:  "notif_log_executive_briefer",
  },
  {
    type: "checkin_reminder",
    title: "Recordatorio Check-in",
    description: "Alerta cuando hay KRs sin actualización por más días del umbral configurado.",
    icon: Clock,
    iconBg: "bg-amber-500",
    sentKey: "notif_sent_checkin_reminder",
    logKey:  "notif_log_checkin_reminder",
  },
  {
    type: "cycle_closure",
    title: "Cierre de Ciclo",
    description: "Notifica cuando un ciclo cierra, con score final y objetivos completados.",
    icon: Flag,
    iconBg: "bg-emerald-600",
    sentKey: "notif_sent_cycle_closure",
    logKey:  "notif_log_cycle_closure",
  },
  {
    type: "agreement_status",
    title: "Estado de Acuerdos",
    description: "Alerta de acuerdos vencidos, próximos a vencer y pendientes de atención. Incluye días restantes por acuerdo.",
    icon: Bell,
    iconBg: "bg-violet-600",
    sentKey: "notif_sent_agreement_status",
    logKey:  "notif_log_agreement_status",
    staleDaysLabel: "Alertar acuerdos que vencen en los próximos",
  },
];

function NotifCard({
  config, setting, sentAt, onSettingChange, params,
}: {
  config: NotifCardConfig;
  setting: NotifSetting;
  sentAt?: string | null;
  onSettingChange: (s: NotifSetting) => void;
  params: OrgParameters;
}) {
  const trigger = useTriggerNotification();
  const [expanded, setExpanded] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const tz      = params.notifications?.timezone ?? "America/Lima";
  const nextLbl = nextSendLabel(setting, tz);
  const logEntries = (params.raw?.[config.logKey] as NotifLogEntry[] | undefined) ?? [];

  const Icon = config.icon;

  async function handleTrigger() {
    try {
      const result = await trigger.mutateAsync(config.type);
      const channels = result.sent_channels.join(", ") || "ninguno";
      setTriggerResult(`Enviado vía: ${channels}`);
      toast.success(`${config.title} enviado`, { description: `Canales: ${channels}` });
      setTimeout(() => setTriggerResult(null), 5000);
    } catch {
      toast.error("Error al enviar", { description: "Verifica la configuración de canales" });
    }
  }

  function toggleChannel(ch: NotifChannel) {
    const channels = setting.channels.includes(ch)
      ? setting.channels.filter(c => c !== ch)
      : [...setting.channels, ch];
    onSettingChange({ ...setting, channels: channels as NotifChannel[] });
  }

  return (
    <Card className={cn(
      "overflow-hidden border-l-4 transition-all",
      setting.enabled ? "border-l-primary/60" : "border-l-border opacity-75"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", config.iconBg)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{config.title}</span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              setting.enabled
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}>
              {setting.enabled ? "Activo" : "Inactivo"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{config.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {scheduleLabel(setting)}
          </span>
          <Toggle checked={setting.enabled} onChange={v => onSettingChange({ ...setting, enabled: v })} />
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/20">
          {/* Channels */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Canales</p>
            <div className="flex gap-2 flex-wrap">
              <ChannelPill channel="email"    active={setting.channels.includes("email")}    onClick={() => toggleChannel("email")} />
              <ChannelPill channel="telegram" active={setting.channels.includes("telegram")} onClick={() => toggleChannel("telegram")} />
            </div>
            {setting.channels.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">⚠ Sin canales — la notificación no se enviará</p>
            )}
          </div>

          {/* Schedule */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Programación</p>
            <div className="space-y-3">

              {/* Frequency selector */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Frecuencia</p>
                <div className="flex flex-wrap gap-1.5">
                  {FREQUENCIES.map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => onSettingChange({ ...setting, frequency: f.value })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                        setting.frequency === f.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day of week — weekly only */}
              {setting.frequency === "weekly" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Día de la semana</p>
                  <DayPicker
                    value={setting.day_of_week ?? 1}
                    onChange={d => onSettingChange({ ...setting, day_of_week: d })}
                  />
                </div>
              )}

              {/* Quarter start month — quarterly only */}
              {setting.frequency === "quarterly" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Inicio del año fiscal (primer trimestre)</p>
                  <select
                    value={setting.quarter_start_month ?? 1}
                    onChange={e => onSettingChange({ ...setting, quarter_start_month: parseInt(e.target.value) })}
                    className="flex h-8 rounded-md border border-input bg-background px-3 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Trimestres: {[0,1,2,3].map(k => MONTH_NAMES[((( setting.quarter_start_month ?? 1) - 1 + k * 3) % 12)]).join(" · ")}
                  </p>
                </div>
              )}

              {/* Day of month — monthly / quarterly / annual */}
              {(setting.frequency === "monthly" || setting.frequency === "quarterly" || setting.frequency === "annual") && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {setting.frequency === "quarterly" ? "Día del mes (inicio de cada trimestre)" : "Día del mes"}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1} max={28}
                      value={setting.day_of_month ?? 1}
                      onChange={e => onSettingChange({ ...setting, day_of_month: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })}
                      className="w-20 h-8 rounded-md border border-input bg-background px-3 text-xs text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">de cada mes</span>
                  </div>
                </div>
              )}

              {/* Month of year — annual only */}
              {setting.frequency === "annual" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Mes del año</p>
                  <select
                    value={setting.month_of_year ?? 1}
                    onChange={e => onSettingChange({ ...setting, month_of_year: parseInt(e.target.value) })}
                    className="flex h-8 rounded-md border border-input bg-background px-3 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Hour */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Hora de envío</p>
                <select
                  value={setting.hour}
                  onChange={e => onSettingChange({ ...setting, hour: parseInt(e.target.value) })}
                  className="flex h-8 rounded-md border border-input bg-background px-3 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {HOURS.map(h => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>

              {/* stale_days — checkin_reminder o agreement_status */}
              {(config.type === "checkin_reminder" || config.type === "agreement_status") && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {config.staleDaysLabel ?? "Días sin check-in para alertar"}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1} max={90}
                      value={setting.stale_days ?? 7}
                      onChange={e => onSettingChange({ ...setting, stale_days: parseInt(e.target.value) || 7 })}
                      className="w-20 h-8 rounded-md border border-input bg-background px-3 text-xs text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">días</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer: last sent + next send + trigger */}
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{sentLabel(sentAt)}</p>
                {nextLbl && (
                  <p className="text-xs text-primary/80 font-medium">{nextLbl}</p>
                )}
                {triggerResult && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> {triggerResult}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {logEntries.length > 0 && (
                  <button
                    type="button"
                    title="Historial de envíos"
                    onClick={() => setShowLog(v => !v)}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                      showLog
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <History className="h-3 w-3" />
                    {logEntries.length}
                  </button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTrigger}
                  disabled={trigger.isPending || setting.channels.length === 0}
                  className="gap-1.5 text-xs"
                >
                  {trigger.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Play className="h-3 w-3 fill-current" />}
                  Enviar ahora
                </Button>
              </div>
            </div>

            {/* Send history log */}
            {showLog && logEntries.length > 0 && (
              <div className="rounded-md border bg-muted/30 divide-y text-[11px]">
                {logEntries.map((entry, i) => {
                  const d = new Date(entry.sent_at);
                  const label = isNaN(d.getTime()) ? entry.sent_at : formatDistanceToNow(d, { addSuffix: true, locale: es });
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {(entry.channels ?? []).join(", ") || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationsPanel() {
  const { data: params, isLoading } = useOrgParameters();
  const update = useUpdateOrgParameters();

  const [notif, setNotif] = useState<OrgNotifications>(NOTIFICATION_DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (params && !initialized) {
      setNotif(params.notifications ?? NOTIFICATION_DEFAULTS);
      setInitialized(true);
    }
  }, [params, initialized]);

  function patchSetting(type: keyof Omit<OrgNotifications, "timezone" | "telegram_chat_id" | "email_recipients">, s: NotifSetting) {
    setNotif(prev => ({ ...prev, [type]: s }));
    setSaved(false);
  }

  async function handleSave() {
    await update.mutateAsync({ notifications: notif });
    setSaved(true);
    toast.success("Configuración de notificaciones guardada");
    setTimeout(() => setSaved(false), 3000);
  }

  const isDirty = params
    ? JSON.stringify(notif) !== JSON.stringify(params.notifications ?? NOTIFICATION_DEFAULTS)
    : false;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p>Cada cliente puede recibir notificaciones en su propio horario, Telegram y correos específicos.</p>
          <p>El botón <strong>Enviar ahora</strong> envía inmediatamente, sin esperar el horario programado.</p>
        </div>
      </div>

      {/* Global: timezone + per-org channels config */}
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4 border-b bg-muted/20">
          <div className="h-8 w-8 rounded-lg bg-slate-500 flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Destinos y zona horaria</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configuración global para este cliente. El Chat ID y los correos aplican a todas las notificaciones.
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Zona horaria</p>
              <p className="text-xs text-muted-foreground">Los horarios de las notificaciones se calculan en esta zona.</p>
              <select
                value={notif.timezone}
                onChange={e => { setNotif(p => ({ ...p, timezone: e.target.value })); setSaved(false); }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Telegram chat ID per org */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-sky-500" />
                Telegram Chat ID del cliente
              </p>
              <p className="text-xs text-muted-foreground">
                Deja vacío para usar el chat global del sistema.
              </p>
              <Input
                value={notif.telegram_chat_id}
                onChange={e => { setNotif(p => ({ ...p, telegram_chat_id: e.target.value })); setSaved(false); }}
                placeholder="Ej: -1001234567890"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Extra email recipients */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-blue-500" />
              Destinatarios adicionales (email)
            </p>
            <p className="text-xs text-muted-foreground">
              Correos adicionales que recibirán notificaciones, además del propietario de la cuenta. Separados por coma.
            </p>
            <Input
              value={notif.email_recipients}
              onChange={e => { setNotif(p => ({ ...p, email_recipients: e.target.value })); setSaved(false); }}
              placeholder="gerente@cliente.com, cfo@cliente.com"
              className="font-mono text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Notification cards */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
          Notificaciones automáticas — clic para configurar
        </p>
      </div>

      {CARDS.map(cfg => (
        <NotifCard
          key={cfg.type}
          config={cfg}
          setting={notif[cfg.type] as NotifSetting}
          sentAt={params?.[cfg.sentKey]}
          onSettingChange={s => patchSetting(cfg.type, s)}
          params={params!}
        />
      ))}

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={handleSave}
          disabled={update.isPending || !isDirty}
          className="gap-2"
        >
          {update.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
            : <><Zap className="h-4 w-4" /> Guardar configuración</>}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" /> Guardado
          </span>
        )}
        {update.isError && (
          <span className="text-sm text-destructive">Error al guardar</span>
        )}
      </div>
    </div>
  );
}
