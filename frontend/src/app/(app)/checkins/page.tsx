"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusChip } from "@/components/okr/StatusChip";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { CheckInDrawer } from "@/components/okr/CheckInDrawer";
import { CheckInHistory } from "@/components/okr/CheckInHistory";
import { useCycles, type Cycle } from "@/hooks/useCycles";
import { useAtRiskKrs, useCadenceDashboard, useCheckInHistory, type AtRiskKr } from "@/hooks/useCheckIns";
import { type KeyResult } from "@/components/okr/KRCard";
import {
  AlertTriangle, Activity, CheckSquare, Calendar, TrendingUp,
  Search, X, Building2, Users, UserCircle,
  CalendarDays, Clock, BarChart2, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab           = "risk" | "cadence";
type LevelFilter   = "ALL" | "COMPANY" | "AREA" | "TEAM" | "INDIVIDUAL";
type StatusFilter  = "ALL" | "AT_RISK" | "BEHIND";
type UrgencyFilter = "ALL" | "LATE" | "CRITICAL";
type CycleType     = "QUARTERLY" | "ANNUAL" | "CUSTOM";

const PERIOD_CONFIG: { type: CycleType; label: string }[] = [
  { type: "QUARTERLY", label: "Trimestral" },
  { type: "ANNUAL",    label: "1 Año"      },
  { type: "CUSTOM",    label: "3 Años"     },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function getQuarterLabel(startDate: string) {
  const month   = new Date(startDate).getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  const year    = new Date(startDate).getUTCFullYear();
  return `T${quarter} ${year}`;
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const color = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">{value}%</span>
    </div>
  );
}

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<string, { label: string; Icon: React.ElementType; badge: string }> = {
  COMPANY:    { label: "Empresa",    Icon: Building2,   badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  AREA:       { label: "Área",       Icon: Users,       badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  TEAM:       { label: "Equipo",     Icon: Users,       badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  INDIVIDUAL: { label: "Individual", Icon: UserCircle,  badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const LEVEL_ORDER = ["COMPANY", "AREA", "TEAM", "INDIVIDUAL"];

// ─── Cycle Banner ─────────────────────────────────────────────────────────────

function CycleBanner({ cycle }: { cycle: any }) {
  const start      = new Date(cycle.start_date).getTime();
  const end        = new Date(cycle.end_date).getTime();
  const now        = Date.now();
  const elapsed    = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  const daysLeft   = Math.max(0, cycle.days_remaining ?? 0);
  const isQuarter  = cycle.type === "QUARTERLY";
  const quarter    = isQuarter ? getQuarterLabel(cycle.start_date) : null;
  const urgency    = daysLeft <= 14 ? "text-red-600 dark:text-red-400"
                   : daysLeft <= 30 ? "text-amber-600 dark:text-amber-400"
                   :                  "text-muted-foreground";

  return (
    <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4">
      <div className="flex items-start gap-4 flex-wrap">
        {/* Icon + label */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <BarChart2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Ciclo activo
              </span>
              {quarter && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">
                  {quarter}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground truncate">{cycle.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {formatDate(cycle.start_date)} – {formatDate(cycle.end_date)}
            </p>
          </div>
        </div>

        {/* Elapsed time */}
        <div className="flex-1 min-w-[160px] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Tiempo transcurrido
            </span>
            <span className="font-medium">{elapsed}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-amber-200/60 dark:bg-amber-900/40 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 dark:bg-amber-500 transition-all" style={{ width: `${elapsed}%` }} />
          </div>
          <p className={cn("text-xs font-medium flex items-center gap-1", urgency)}>
            <Clock className="h-3 w-3 shrink-0" />
            {daysLeft === 0 ? "Ciclo finalizado" : `${daysLeft} día${daysLeft !== 1 ? "s" : ""} restantes`}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ProgressRing progress={Math.round(cycle.avg_progress ?? 0)} size={44} />
          <div>
            <p className="text-lg font-bold text-foreground leading-none">{Math.round(cycle.avg_progress ?? 0)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Progreso OKRs</p>
            <p className="text-[10px] text-muted-foreground">{cycle.objectives_count ?? 0} objetivo{(cycle.objectives_count ?? 0) !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter toggle ────────────────────────────────────────────────────────────


// ─── At-Risk KR card ──────────────────────────────────────────────────────────

function AtRiskCard({ kr, onCheckIn }: { kr: AtRiskKr; onCheckIn: (kr: AtRiskKr) => void }) {
  const t = useTranslations("pages.checkins");
  const cfg = LEVEL_CONFIG[kr.objective_level] ?? LEVEL_CONFIG.INDIVIDUAL;

  return (
    <Card className={cn("p-4 space-y-3 hover:shadow-md transition-shadow", kr.status === "AT_RISK" && "border-red-300/60 dark:border-red-800/60")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {kr.kr_code && (
              <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">
                {kr.kr_code}
              </span>
            )}
            <p className="text-sm font-semibold leading-snug">{kr.kr_title}</p>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {kr.obj_code && (
              <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">{kr.obj_code}</span>
            )}
            <p className="text-xs text-muted-foreground truncate">{kr.objective_title}</p>
          </div>
        </div>
        <StatusChip status={kr.status} />
      </div>

      {/* Progress bar */}
      <ProgressBar value={Math.round(kr.progress)} />

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {t("confidence")}: <strong className={cn("font-semibold", kr.confidence < 0.4 ? "text-red-500" : kr.confidence < 0.7 ? "text-amber-500" : "text-green-600")}>
            {Math.round(kr.confidence * 100)}%
          </strong>
        </span>
        <span className="text-border">·</span>
        <span>
          {t("noCheckin")}:{" "}
          <strong className={cn("font-semibold", kr.days_since_checkin > 14 ? "text-red-500" : kr.days_since_checkin > 7 ? "text-amber-500" : "")}>
            {kr.days_since_checkin === 999 ? t("never") : `${kr.days_since_checkin}d`}
          </strong>
        </span>
        {kr.owner_name && (
          <>
            <span className="text-border">·</span>
            <span className="truncate">{kr.owner_name}</span>
          </>
        )}
      </div>

      {/* Action */}
      <button
        onClick={() => onCheckIn(kr)}
        className="w-full rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 py-1.5 text-xs font-medium text-primary transition-colors"
      >
        {t("updateKr")}
      </button>
    </Card>
  );
}

// ─── Grouped section ──────────────────────────────────────────────────────────

function LevelSection({
  level,
  items,
  onCheckIn,
}: {
  level: string;
  items: AtRiskKr[];
  onCheckIn: (kr: AtRiskKr) => void;
}) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.INDIVIDUAL;
  const Icon = cfg.Icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <span className="text-sm font-semibold">{cfg.label}</span>
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((kr) => (
          <AtRiskCard key={kr.id} kr={kr} onCheckIn={onCheckIn} />
        ))}
      </div>
    </div>
  );
}

// ─── Cadence row ──────────────────────────────────────────────────────────────

const CADENCE_LABELS: Record<string, string> = {
  WEEKLY: "Semanal", BIWEEKLY: "Bisemanal", MONTHLY: "Mensual", QUARTERLY: "Trimestral",
};

function cadenceColor(days: number, cadenceDays = 14) {
  if (days === 999) return "bg-red-500";
  if (days >= cadenceDays)           return "bg-red-400";
  if (days >= cadenceDays * 0.6)     return "bg-amber-400";
  return "bg-green-400";
}

function CadenceRow({ kr, onCheckIn }: { kr: any; onCheckIn: (kr: any) => void }) {
  const cfg = LEVEL_CONFIG[kr.objective_level] ?? LEVEL_CONFIG.INDIVIDUAL;
  const Icon = cfg.Icon;
  const p = Math.round(kr.progress);

  return (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-muted/40 transition-colors">
      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", cadenceColor(kr.days_since_checkin, kr.cadence_days))} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          {kr.kr_code && (
            <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">
              {kr.kr_code}
            </span>
          )}
          <p className="text-sm font-medium truncate">{kr.kr_title}</p>
        </div>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <Icon className="h-3 w-3 shrink-0" />
          {kr.obj_code && <span className="font-mono text-[10px] shrink-0">{kr.obj_code}</span>}
          {kr.objective_title}
        </p>
        <ProgressBar value={p} />
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground ml-2">
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", cfg.badge)}>{cfg.label}</span>
        {kr.check_in_cadence && (
          <span className="text-[10px] text-muted-foreground/70 hidden sm:block">
            {CADENCE_LABELS[kr.check_in_cadence] ?? kr.check_in_cadence}
          </span>
        )}
        <span className={cn(
          "font-medium w-14 text-right",
          kr.days_since_checkin >= (kr.cadence_days ?? 14)
            ? "text-red-500"
            : kr.days_since_checkin >= (kr.cadence_days ?? 14) * 0.6
              ? "text-amber-500"
              : "text-green-600",
        )}>
          {kr.days_since_checkin === 999 ? "Nunca" : `${kr.days_since_checkin}d`}
        </span>
        <button onClick={() => onCheckIn(kr)} className="text-primary hover:underline text-xs whitespace-nowrap">
          Check-in
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheckInsPage() {
  const t = useTranslations("pages.checkins");
  const [activeTab, setActiveTab]         = useState<Tab>("risk");
  const [checkInKr, setCheckInKr]         = useState<KeyResult | null>(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [historyKrId, setHistoryKrId]     = useState<string | null>(null);
  const [selectedType, setSelectedType]   = useState<CycleType | null>(null);

  const [search, setSearch]               = useState("");
  const [levelFilter, setLevelFilter]     = useState<LevelFilter>("ALL");
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("ALL");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const { data: allCycles = [] }  = useCycles();

  const activeCycles = useMemo(() =>
    (allCycles as Cycle[]).filter(c => c.status === "ACTIVE"),
  [allCycles]);

  const availableTypes = useMemo(() =>
    PERIOD_CONFIG.filter(p => activeCycles.some(c => c.type === p.type)),
  [activeCycles]);

  const defaultType = useMemo<CycleType>(() => {
    if (activeCycles.some(c => c.type === "QUARTERLY")) return "QUARTERLY";
    if (activeCycles.some(c => c.type === "ANNUAL"))    return "ANNUAL";
    return "CUSTOM";
  }, [activeCycles]);

  const effectiveType = selectedType ?? defaultType;

  const cycle = useMemo(() =>
    activeCycles
      .filter(c => c.type === effectiveType)
      .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())[0] ?? null,
  [activeCycles, effectiveType]);

  const { data: atRiskKrs = [],   isLoading: riskLoading }      = useAtRiskKrs(cycle?.id);
  const { data: cadenceData = [], isLoading: cadenceLoading }   = useCadenceDashboard(cycle?.id ?? null);
  const { data: historyData }                                    = useCheckInHistory(historyKrId);

  const hasActiveFilters = !!(search || levelFilter !== "ALL" || statusFilter !== "ALL" || urgencyFilter !== "ALL");

  function clearFilters() {
    setSearch(""); setLevelFilter("ALL"); setStatusFilter("ALL"); setUrgencyFilter("ALL");
  }

  // ── Filtered data ────────────────────────────────────────────────────────────

  const filteredRisk = useMemo(() => {
    const q = search.toLowerCase();
    return (atRiskKrs as AtRiskKr[]).filter((kr) => {
      if (q && !kr.kr_title.toLowerCase().includes(q) && !kr.objective_title.toLowerCase().includes(q)) return false;
      if (levelFilter  !== "ALL" && kr.objective_level !== levelFilter) return false;
      if (statusFilter !== "ALL" && kr.status !== statusFilter) return false;
      return true;
    });
  }, [atRiskKrs, search, levelFilter, statusFilter]);

  const riskByLevel = useMemo(() =>
    LEVEL_ORDER.reduce<Record<string, AtRiskKr[]>>((acc, lvl) => {
      const items = filteredRisk
        .filter(k => k.objective_level === lvl)
        .sort((a, b) => {
          const ac = a.obj_code ?? ""; const bc = b.obj_code ?? "";
          if (ac !== bc) return ac.localeCompare(bc, "es", { numeric: true });
          const ak = a.kr_code ?? ""; const bk = b.kr_code ?? "";
          return ak.localeCompare(bk, "es", { numeric: true });
        });
      if (items.length) acc[lvl] = items;
      return acc;
    }, {}),
  [filteredRisk]);

  const filteredCadence = useMemo(() => {
    const q = search.toLowerCase();
    return (cadenceData as any[])
      .filter((kr) => {
        if (q && !kr.kr_title.toLowerCase().includes(q) && !kr.objective_title.toLowerCase().includes(q)) return false;
        if (levelFilter !== "ALL" && kr.objective_level !== levelFilter) return false;
        if (urgencyFilter === "LATE"     && !(kr.days_since_checkin > 7  && kr.days_since_checkin <= 14)) return false;
        if (urgencyFilter === "CRITICAL" && !(kr.days_since_checkin > 14 || kr.days_since_checkin === 999)) return false;
        return true;
      })
      .sort((a, b) => {
        const li = LEVEL_ORDER.indexOf(a.objective_level);
        const lj = LEVEL_ORDER.indexOf(b.objective_level);
        if (li !== lj) return li - lj;
        const ao = a.obj_code ?? ""; const bo = b.obj_code ?? "";
        if (ao !== bo) return ao.localeCompare(bo, "es", { numeric: true });
        const ak = a.kr_code ?? ""; const bk = b.kr_code ?? "";
        return ak.localeCompare(bk, "es", { numeric: true });
      });
  }, [cadenceData, search, levelFilter, urgencyFilter]);

  function openCheckIn(kr: any) {
    setCheckInKr({
      id: kr.id ?? kr.kr_id,
      objective_id: kr.objective_id ?? "",
      title: kr.kr_title,
      type: kr.kr_type ?? "INCREASE",
      metric_unit: kr.metric_unit,
      start_value: kr.start_value ?? 0,
      target_value: kr.target_value ?? 100,
      current_value: kr.current_value ?? 0,
      confidence: kr.confidence ?? 0.5,
      progress: kr.progress ?? 0,
      status: kr.status ?? "ON_TRACK",
      trend: "flat",
      last_checkin_at: kr.last_checkin_at,
    } as KeyResult);
    setDrawerOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={
          cycle
            ? `${availableTypes.find(p => p.type === effectiveType)?.label ?? ""} · ${cycle.name}`
            : activeCycles.length > 0 ? t("selectPeriod") : t("noCycle")
        }
        actions={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        }
      />

      {activeCycles.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t("noCycle")}
          description={t("noCycleDesc")}
          actionLabel={t("goToCycles")}
          onAction={() => window.location.href = "/cycles"}
        />
      ) : (
        <div className="space-y-5">
          {/* Period selector */}
          {availableTypes.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("periodLabel")}</span>
              <div className="flex gap-1.5">
                {availableTypes.map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      effectiveType === type
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cycle banner or no-cycle-for-type message */}
          {cycle ? <CycleBanner cycle={cycle} /> : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay un ciclo activo de tipo <strong>{availableTypes.find(p => p.type === effectiveType)?.label ?? effectiveType}</strong>.
            </div>
          )}

          {cycle && <>{/* Summary chips */}
          <div className="flex gap-3 flex-wrap">
            {[
              { label: t("atRiskLabel"),   value: atRiskKrs.filter(k => k.status === "AT_RISK").length,    color: "bg-red-500",    border: "border-red-200" },
              { label: t("retrasados"),    value: atRiskKrs.filter(k => k.status === "BEHIND").length,     color: "bg-amber-500",  border: "" },
              { label: t("noCheckin14d"),  value: atRiskKrs.filter(k => k.days_since_checkin > 14).length, color: "bg-orange-500", border: "" },
            ].map((s) => (
              <div key={s.label} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", s.border)}>
                <span className={cn("h-2 w-2 rounded-full", s.color)} />
                <span className="text-sm font-medium tabular-nums">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Search + filters */}
          {(() => {
            const activeNonSearch = [
              levelFilter !== "ALL",
              activeTab === "risk" ? statusFilter !== "ALL" : urgencyFilter !== "ALL",
            ].filter(Boolean).length;
            return (
              <div className="space-y-2">
                {/* Row 1: search + Filtros button */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("searchPlaceholder")}
                      className="pl-8 h-9 text-sm w-64"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setFilterPanelOpen(v => !v)}
                    className={cn(
                      "flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-colors",
                      activeNonSearch > 0
                        ? "border-primary/60 bg-primary/5 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtros
                    {activeNonSearch > 0 && (
                      <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                        {activeNonSearch}
                      </span>
                    )}
                  </button>
                </div>

                {/* Collapsible filter panel */}
                {filterPanelOpen && (
                  <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground w-12">{t("levelLabel")}</span>
                      <select
                        value={levelFilter}
                        onChange={e => setLevelFilter(e.target.value as LevelFilter)}
                        className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="ALL">{t("todos")}</option>
                        <option value="COMPANY">{t("company")}</option>
                        <option value="AREA">{t("area")}</option>
                        <option value="TEAM">{t("team")}</option>
                        <option value="INDIVIDUAL">{t("individual")}</option>
                      </select>
                    </div>
                    {activeTab === "risk" && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-12">{t("statusLabel")}</span>
                        <select
                          value={statusFilter}
                          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="ALL">{t("todos")}</option>
                          <option value="AT_RISK">{t("atRisk")}</option>
                          <option value="BEHIND">{t("behind")}</option>
                        </select>
                      </div>
                    )}
                    {activeTab === "cadence" && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-12">{t("urgencyLabel")}</span>
                        <select
                          value={urgencyFilter}
                          onChange={e => setUrgencyFilter(e.target.value as UrgencyFilter)}
                          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="ALL">{t("todos")}</option>
                          <option value="LATE">{t("urgentLate")}</option>
                          <option value="CRITICAL">{t("urgentCritical")}</option>
                        </select>
                      </div>
                    )}
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" /> Limpiar todo
                      </button>
                    )}
                  </div>
                )}

                {/* Active filter chips (when panel is closed) */}
                {!filterPanelOpen && activeNonSearch > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {levelFilter !== "ALL" && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                        Nivel: {LEVEL_CONFIG[levelFilter]?.label ?? levelFilter}
                        <button onClick={() => setLevelFilter("ALL")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {activeTab === "risk" && statusFilter !== "ALL" && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                        Estado: {({ AT_RISK: "En riesgo", BEHIND: "Retrasado" } as Record<string, string>)[statusFilter]}
                        <button onClick={() => setStatusFilter("ALL")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {activeTab === "cadence" && urgencyFilter !== "ALL" && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
                        Urgencia: {({ LATE: "Atrasado", CRITICAL: "Crítico" } as Record<string, string>)[urgencyFilter]}
                        <button onClick={() => setUrgencyFilter("ALL")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tabs */}
          <div className="flex border-b">
            {[
              { id: "risk" as Tab,    label: t("riskTab"),    icon: AlertTriangle, count: atRiskKrs.length },
              { id: "cadence" as Tab, label: t("cadenceTab"), icon: Activity,      count: undefined },
            ].map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {count !== undefined && count > 0 && (
                  <Badge className="h-4 px-1.5 text-[10px] bg-red-500 text-white">{count}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* ── Risk tab ── */}
          {activeTab === "risk" && (
            <div className="space-y-6">
              {riskLoading ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : filteredRisk.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title={hasActiveFilters ? t("noResults") : t("noPendingTitle")}
                  description={
                    hasActiveFilters
                      ? t("noResultsFilters")
                      : t("noPendingDesc")
                  }
                />
              ) : (
                LEVEL_ORDER.filter(lvl => riskByLevel[lvl]).map(lvl => (
                  <LevelSection
                    key={lvl}
                    level={lvl}
                    items={riskByLevel[lvl]}
                    onCheckIn={openCheckIn}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Cadence tab ── */}
          {activeTab === "cadence" && (
            <div className="rounded-xl border overflow-hidden">
              <div className="px-3 py-2.5 border-b bg-muted/40 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-400" /> Al día (&lt;7d)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Atrasado (7-14d)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> Crítico (&gt;14d)</span>
                {filteredCadence.length !== (cadenceData as any[]).length && (
                  <span className="ml-auto font-medium text-foreground tabular-nums">
                    {filteredCadence.length} de {(cadenceData as any[]).length}
                  </span>
                )}
              </div>
              {cadenceLoading ? (
                <div className="p-4 space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ) : filteredCadence.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {hasActiveFilters ? t("noResultsCadence") : t("noActiveKrs")}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredCadence.map((kr) => (
                    <CadenceRow key={kr.kr_id} kr={kr} onCheckIn={openCheckIn} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History panel */}
          {historyKrId && historyData && historyData.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">{t("historyTitle")}</h3>
                <button
                  onClick={() => setHistoryKrId(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("closePanelBtn")}
                </button>
              </div>
              <CheckInHistory
                checkIns={historyData}
                targetValue={historyData[0]?.target_value ?? 100}
                metricUnit={historyData[0]?.metric_unit ?? "%"}
              />
            </Card>
          )}
          </>}
        </div>
      )}

      <CheckInDrawer
        kr={checkInKr}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
