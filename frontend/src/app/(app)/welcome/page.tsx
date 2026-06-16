"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useWelcomeContext, useWeeklyTrend, useAreaCheckinStatus, useCommitmentRanking, type GovernanceEventType, type AreaCheckinStatus, type CommitmentRankingEntry } from "@/hooks/useReports";
import { useAgreementStats } from "@/hooks/useAgreements";
import { useCycles, type Cycle } from "@/hooks/useCycles";
import { usePrograms, useUpcomingDeliverables } from "@/hooks/useDelivery";
import { useAuthStore } from "@/store/auth.store";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Target, AlertTriangle, CheckCircle2, ArrowRight,
  Calendar, Clock, Users, Rocket,
  Star, RotateCcw, Filter, ChevronRight, BarChart3,
  Zap, Activity, ChevronDown, RefreshCw, Package2, Timer, TrendingDown, Handshake, GitBranch, UserCircle2,
} from "lucide-react";
import { ImpactChainWidget } from "@/components/welcome/ImpactChainWidget";
import { PersonalBriefingCard } from "@/components/welcome/PersonalBriefingCard";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

// ── Animated counter ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let raf: number;
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        setVal(Math.round(target * ease));
        if (t < 1) raf = requestAnimationFrame(tick);
        else setVal(target);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return val;
}

// ── Big animated ring ─────────────────────────────────────────────────────────

function BigProgressRing({ pct }: { pct: number }) {
  const t = useTranslations("pages.welcome");
  const R = 80;
  const C = 2 * Math.PI * R;
  const [offset, setOffset] = useState(C);
  const animated = useCountUp(pct, 1600, 350);

  useEffect(() => {
    const t = setTimeout(() => setOffset(C - (C * Math.min(pct, 100)) / 100), 350);
    return () => clearTimeout(t);
  }, [pct, C]);

  return (
    <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
      <svg width="200" height="200" viewBox="0 0 200 200"
        style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,1)"   />
          </linearGradient>
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="100" cy="100" r={R} fill="none"
          stroke="rgba(255,255,255,0.15)" strokeWidth="14" />
        <circle cx="100" cy="100" r={R} fill="none"
          stroke="url(#ringGrad)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          filter="url(#ringGlow)"
          style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <span className="text-[42px] font-black tabular-nums leading-none text-white drop-shadow-lg">
          {animated}<span className="text-2xl font-bold">%</span>
        </span>
        <span className="text-xs font-semibold mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
          {t("progressRing")}
        </span>
      </div>
    </div>
  );
}

// ── Stat chip (glassmorphism) ─────────────────────────────────────────────────

function StatChip({ value, label, accent, delay }: {
  value: number; label: string; accent: string; delay: number;
}) {
  const animated = useCountUp(value, 1200, delay);
  return (
    <div className="welcome-card flex flex-col items-center gap-1 px-5 py-3 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.13)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.18)",
        animationDelay: `${delay}ms`,
      }}>
      <span className="text-3xl font-black tabular-nums text-white leading-none drop-shadow">
        {animated}
      </span>
      <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
        {label}
      </span>
      <span className="h-0.5 w-6 rounded-full mt-0.5" style={{ background: accent }} />
    </div>
  );
}

// ── Owner chip — shared across all widgets ────────────────────────────────────

function OwnerChip({ name }: { name?: string | null }) {
  if (!name) return null;
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="flex items-center gap-1 shrink-0">
      <span className="h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
        {initials}
      </span>
      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{name.split(" ")[0]}</span>
    </span>
  );
}

// ── Trial countdown banner ────────────────────────────────────────────────────

function TrialCountdownBanner() {
  const t    = useTranslations("pages.welcome");
  const locale = useLocale();
  const user = useAuthStore(s => s.user);
  if (user?.org_plan !== "FREE" || !user?.org_trial_expires_at) return null;

  const diffMs = new Date(user.org_trial_expires_at).getTime() - Date.now();
  if (diffMs <= 0) return null;

  const daysLeft  = Math.floor(diffMs / 86_400_000);
  const hoursLeft = Math.ceil((diffMs % 86_400_000) / 3_600_000);
  const urgent    = daysLeft <= 3;
  const warning   = daysLeft <= 7;

  const expiryFormatted = new Date(user.org_trial_expires_at).toLocaleDateString(locale, {
    day: "numeric", month: "long", year: "numeric",
  });

  const styles = urgent
    ? {
        wrap:   "bg-gradient-to-r from-red-50 to-rose-50 border-red-200 dark:from-red-950/40 dark:to-rose-950/30 dark:border-red-800/60",
        num:    "text-red-600 dark:text-red-400",
        unit:   "text-red-500/70 dark:text-red-500/60",
        title:  "text-red-800 dark:text-red-200",
        sub:    "text-red-600/70 dark:text-red-400/70",
        dot:    "bg-red-500",
        bar:    "bg-red-500",
        track:  "bg-red-100 dark:bg-red-900/40",
        cta:    "bg-red-600 hover:bg-red-700 text-white",
      }
    : warning
    ? {
        wrap:   "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/40 dark:to-orange-950/30 dark:border-amber-800/60",
        num:    "text-amber-600 dark:text-amber-400",
        unit:   "text-amber-500/70 dark:text-amber-500/60",
        title:  "text-amber-900 dark:text-amber-200",
        sub:    "text-amber-700/70 dark:text-amber-400/70",
        dot:    "bg-amber-500",
        bar:    "bg-amber-500",
        track:  "bg-amber-100 dark:bg-amber-900/40",
        cta:    "bg-amber-600 hover:bg-amber-700 text-white",
      }
    : {
        wrap:   "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950/40 dark:to-indigo-950/30 dark:border-blue-800/60",
        num:    "text-blue-600 dark:text-blue-400",
        unit:   "text-blue-500/70 dark:text-blue-500/60",
        title:  "text-blue-900 dark:text-blue-200",
        sub:    "text-blue-700/70 dark:text-blue-400/70",
        dot:    "bg-blue-500",
        bar:    "bg-blue-500",
        track:  "bg-blue-100 dark:bg-blue-900/40",
        cta:    "bg-blue-600 hover:bg-blue-700 text-white",
      };

  const headline = urgent
    ? (daysLeft === 0
        ? t("trialUrgentHeadlineHours", { n: hoursLeft })
        : t("trialUrgentHeadlineDays",  { n: daysLeft }))
    : warning
    ? t("trialWarningHeadline",  { n: daysLeft })
    : t("trialNormalHeadline",   { n: daysLeft });

  const sub = urgent ? t("trialUrgentSub") : t("trialSub");

  const displayNum  = daysLeft > 0 ? daysLeft : hoursLeft;
  const displayUnit = daysLeft > 0
    ? t("trialDayUnit",  { n: daysLeft })
    : t("trialHourUnit", { n: hoursLeft });

  return (
    <div className={cn("rounded-2xl border p-5 flex items-center gap-6", styles.wrap)}>
      <div className="shrink-0 flex flex-col items-center justify-center w-20 text-center">
        <span className={cn("text-5xl font-black tabular-nums leading-none tracking-tight", styles.num, urgent && "animate-pulse")}>
          {displayNum}
        </span>
        <span className={cn("text-[11px] font-bold uppercase tracking-widest mt-1", styles.unit)}>
          {displayUnit}
        </span>
      </div>
      <div className={cn("w-px self-stretch rounded-full opacity-30", styles.dot)} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", styles.dot, urgent && "animate-pulse")} />
          <p className={cn("text-sm font-bold leading-none", styles.title)}>{headline}</p>
        </div>
        <p className={cn("text-xs leading-snug", styles.sub)}>{sub}</p>
        <div className="flex items-center gap-2 pt-0.5">
          <Timer className={cn("h-3 w-3 shrink-0", styles.num)} />
          <span className={cn("text-[11px] font-medium", styles.sub)}>{t("trialExpiresOn", { date: expiryFormatted })}</span>
        </div>
      </div>
      <div className="shrink-0">
        <a href="/settings?tab=plataformaOrgs"
          className={cn("inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors", styles.cta)}>
          {t("trialViewPlan")}
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function greetingKey(): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  const h = new Date().getHours();
  if (h < 12) return "greetingMorning";
  if (h < 18) return "greetingAfternoon";
  return "greetingEvening";
}
function firstName(n?: string) { return n ? n.split(" ")[0] : ""; }
function formatDateShort(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

// ── Health config ─────────────────────────────────────────────────────────────

function getHealth(pct: number, atRisk: number, total: number) {
  if (total === 0) return {
    gradient: "from-slate-700 to-indigo-900",
    orb1: "rgba(129,140,248,0.18)", orb2: "rgba(99,102,241,0.12)",
    labelKey: "noCycle" as const,
  };
  if (pct >= 70 && atRisk === 0) return {
    gradient: "from-emerald-700 to-teal-900",
    orb1: "rgba(52,211,153,0.2)", orb2: "rgba(20,184,166,0.14)",
    labelKey: "statusExcellent" as const,
  };
  if (pct >= 50 && atRisk <= total * 0.25) return {
    gradient: "from-blue-700 to-indigo-900",
    orb1: "rgba(96,165,250,0.2)", orb2: "rgba(99,102,241,0.14)",
    labelKey: "statusGood" as const,
  };
  if (atRisk > total * 0.3) return {
    gradient: "from-amber-700 to-slate-900",
    orb1: "rgba(251,191,36,0.2)", orb2: "rgba(245,158,11,0.12)",
    labelKey: "statusAttention" as const,
  };
  return {
    gradient: "from-rose-800 to-slate-900",
    orb1: "rgba(244,63,94,0.18)", orb2: "rgba(190,18,60,0.12)",
    labelKey: "statusAction" as const,
  };
}

// ── Trend chart ───────────────────────────────────────────────────────────────

function TrendArea({ data }: { data: Array<{ week_number: number; avg_progress: number }> }) {
  const t   = useTranslations("pages.welcome");
  const pts = data.map(d => ({ week: `S${d.week_number}`, prog: Math.round(Number(d.avg_progress)) }));
  return (
    <ResponsiveContainer width="100%" height={110}>
      <AreaChart data={pts} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="wauTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v) => [`${v}%`, t("trendProgress")]}
          contentStyle={{
            borderRadius: 8, fontSize: 12,
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--popover-foreground))",
          }}
        />
        <Area type="monotone" dataKey="prog" stroke="#6366f1" fill="url(#wauTrend)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#6366f1", stroke: "#fff", strokeWidth: 1.5 }}
          activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Area check-in status panel ────────────────────────────────────────────────

function AreaCheckinPanel({ areas }: { areas: AreaCheckinStatus[] }) {
  const t = useTranslations("pages.welcome");
  if (areas.length === 0) return null;

  function areaStatus(days: number | null): "ok" | "warning" | "late" {
    if (days === null || days > 14) return "late";
    if (days > 7) return "warning";
    return "ok";
  }

  const sorted = [...areas].sort((a, b) => {
    const da = a.days_since ?? 999;
    const db = b.days_since ?? 999;
    return db - da;
  });

  const maxDays = Math.max(...sorted.map(a => a.days_since ?? 30), 1);
  const updated = areas.filter(a => a.days_since !== null && a.days_since <= 7).length;
  const delayed = areas.filter(a => a.days_since === null || a.days_since > 7).length;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <TrendingDown className="h-3 w-3" />
          {t("areaUpdateStatus")}
        </p>
        <span className="text-[10px] text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{updated}</span> {t("upToDate")}
          {" · "}
          <span className={cn("font-semibold", delayed > 0 ? "text-rose-500" : "text-muted-foreground")}>{delayed}</span> {t("delayed")}
        </span>
      </div>
      <div className="space-y-2">
        {sorted.map(area => {
          const st  = areaStatus(area.days_since);
          const pct = area.days_since !== null
            ? Math.min(100, Math.round((area.days_since / Math.max(maxDays, 30)) * 100))
            : 100;
          const barColor =
            st === "ok"        ? "bg-emerald-500"
            : st === "warning" ? "bg-amber-400"
            : "bg-rose-500";
          const label =
            area.days_since === null ? t("noCheckin")
            : area.days_since === 0  ? t("today")
            : area.days_since === 1  ? t("oneDayAgo")
            : t("nDaysAgo", { n: area.days_since });

          return (
            <div key={area.id} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: area.color }} />
                  <span className="text-xs text-foreground/80 truncate">{area.name}</span>
                </div>
                <span className={cn(
                  "text-[10px] font-semibold tabular-nums shrink-0",
                  st === "ok"        ? "text-emerald-600 dark:text-emerald-400"
                  : st === "warning" ? "text-amber-500 dark:text-amber-400"
                  : "text-rose-500 dark:text-rose-400",
                )}>
                  {label}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ranking del Compromiso ────────────────────────────────────────────────────

function RankingCompromisoPanel({ entries }: { entries: CommitmentRankingEntry[] }) {
  const t = useTranslations("pages.welcome");
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  function semaphore(overdue: number): { color: string; label: string; bg: string; textCl: string } {
    if (overdue === 0)   return { color: "bg-emerald-500", label: t("upToDate"),    bg: "bg-emerald-50 dark:bg-emerald-950/30", textCl: "text-emerald-600 dark:text-emerald-400" };
    if (overdue <= 3)    return { color: "bg-amber-400",   label: `+${overdue}d`,  bg: "bg-amber-50 dark:bg-amber-950/30",    textCl: "text-amber-500 dark:text-amber-400" };
    if (overdue < 999)   return { color: "bg-rose-500",    label: `+${overdue}d`,  bg: "bg-rose-50 dark:bg-rose-950/30",      textCl: "text-rose-500 dark:text-rose-400" };
    return                      { color: "bg-rose-500",    label: t("noCheckin"),   bg: "bg-rose-50 dark:bg-rose-950/30",      textCl: "text-rose-500 dark:text-rose-400" };
  }

  const SHOW_PREVIEW = 3;
  const displayed = expanded ? entries : entries.slice(0, SHOW_PREVIEW);

  return (
    <div className="mt-4 pt-4 border-t">
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between mb-3 group">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          {t("commitmentRanking")}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {entries.filter(e => e.max_overdue_days === 0).length} {t("upToDate")}
            {" · "}
            {entries.filter(e => e.max_overdue_days > 0).length} {t("delayed")}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")} />
        </div>
      </button>

      <div className="space-y-1">
        {displayed.map((entry, idx) => {
          const sem = semaphore(entry.max_overdue_days);
          const initial = entry.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={entry.user_id}
              className={cn("flex items-center gap-3 px-3 py-2 rounded-lg",
                idx === 0 && entry.max_overdue_days === 0 ? "ring-1 ring-emerald-200 dark:ring-emerald-800/50" : "")}>
              <span className="text-[10px] font-bold text-muted-foreground/50 w-3 shrink-0 tabular-nums">{idx + 1}</span>
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", sem.bg)}>
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{entry.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {entry.area_name && <span className="text-foreground/60">{entry.area_name}{" · "}</span>}
                  {entry.kr_count} KR{entry.kr_count !== 1 ? "s" : ""}
                  {" · "}
                  {entry.checkins_30d} check-in{entry.checkins_30d !== 1 ? "s" : ""} (30d)
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn("h-2.5 w-2.5 rounded-full", sem.color)} />
                <span className={cn("text-[10px] font-medium", sem.textCl)}>{sem.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {!expanded && entries.length > SHOW_PREVIEW && (
        <button type="button" onClick={() => setExpanded(true)}
          className="w-full mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
          {t("viewNMore", { n: entries.length - SHOW_PREVIEW })}
          <ChevronDown className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Governance icons ──────────────────────────────────────────────────────────

const EVENT_ICONS: Record<GovernanceEventType, React.ElementType> = {
  KICKOFF: Rocket, CHECK_IN_HEALTH: Target, MID_REVIEW: Filter,
  CYCLE_REVIEW: CheckCircle2, RETROSPECTIVE: RotateCcw,
  STRATEGIC_REVIEW: Star, ANNUAL_PLANNING: Calendar, CUSTOM: Calendar,
};

const CYCLE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981", DRAFT: "#6366f1", CLOSED: "#9ca3af",
};

// ── Cycle selector ────────────────────────────────────────────────────────────

function CycleSelector({
  cycles, selectedId, onSelect,
}: {
  cycles: Cycle[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const t = useTranslations("pages.welcome");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = cycles.find(c => c.id === selectedId);
  const label    = selected ? selected.name : t("selectorActiveLabel");

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={cn("flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all",
          "bg-background hover:bg-muted text-foreground",
          open && "border-primary")}>
        <span className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: selected ? (CYCLE_STATUS_COLORS[selected.status] ?? "#9ca3af") : "#6366f1" }} />
        <span className="truncate max-w-[160px]">{label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[260px] rounded-xl border bg-popover shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("selectorTitle")}
            </p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            <button onClick={() => { onSelect(null); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left", !selectedId && "bg-accent")}>
              <span className="h-2 w-2 rounded-full shrink-0 bg-primary" />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", !selectedId && "font-semibold")}>{t("selectorActiveAuto")}</p>
                <p className="text-[11px] text-muted-foreground">{t("selectorAutoDesc")}</p>
              </div>
              {!selectedId && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>

            {cycles.some(c => c.status === "ACTIVE") && <div className="my-1 mx-3 border-t" />}

            {cycles.filter(c => c.status === "ACTIVE").map(c => (
              <button key={c.id} onClick={() => { onSelect(c.id); setOpen(false); }}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted transition-colors text-left", selectedId === c.id && "bg-accent")}>
                <span className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: CYCLE_STATUS_COLORS[c.status] ?? "#9ca3af" }} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm truncate", selectedId === c.id && "font-semibold")}>{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.type === "QUARTERLY" ? t("cycleTypeQuarterly") : c.type === "ANNUAL" ? t("cycleTypeAnnual") : t("cycleTypeCustom")}
                    {" · "}{c.status === "ACTIVE" ? t("statusActive") : c.status === "CLOSED" ? t("statusClosed") : t("statusDraft")}
                  </p>
                </div>
                {selectedId === c.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const t = useTranslations("pages.welcome");
  const locale = useLocale();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const authUser = useAuthStore(s => s.user);

  useEffect(() => {
    if (authUser?.role === "SECTOR_DIAGNOSTICS") {
      router.replace("/sector-assessment");
      return;
    }
    if (authUser && authUser.first_day_completed_at === null && authUser.role !== 'OWNER') {
      router.replace("/first-day");
    }
  }, [authUser, router]);

  const { data: ctx, isLoading, isFetching, refetch } = useWelcomeContext(selectedCycleId);
  const { data: cycles = [] } = useCycles();
  const [mounted, setMounted] = useState(false);

  const handleRefresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["cycles"] });
    qc.invalidateQueries({ queryKey: ["reports", "weekly-trend"] });
  };

  const { data: trend = [] }      = useWeeklyTrend(ctx?.active_cycle?.id);
  const { data: areaStatus = [] } = useAreaCheckinStatus();
  const { data: ranking = [] }    = useCommitmentRanking();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined")
      localStorage.setItem("welcome_last_shown", new Date().toDateString());
  }, []);

  const isExecutive = authUser ? ["OWNER", "ADMIN", "MANAGER"].includes(authUser.role) : false;
  const { data: agreementStats } = useAgreementStats({ enabled: isExecutive });

  const { data: programs = [] }  = usePrograms();
  const { data: upcoming = [] }  = useUpcomingDeliverables(14);

  const activePrograms = programs.filter(p => p.status === "ACTIVE");
  const avgDeliveryPct = activePrograms.length
    ? Math.round(activePrograms.reduce((s, p) => s + (p.completion_pct ?? 0), 0) / activePrograms.length)
    : 0;
  const overdueDelivs = upcoming.filter(d => d.is_overdue);
  const soonDelivs    = upcoming.filter(d => !d.is_overdue && d.days_until_due <= 7);

  const cycle    = ctx?.active_cycle ?? null;
  const userName = firstName(ctx?.user?.name);
  const stats    = ctx?.org_stats;
  const pending  = ctx?.pending_checkins ?? [];
  const atRisk   = ctx?.at_risk_krs ?? [];
  const myObjs   = ctx?.my_objectives ?? [];
  const govEvents = ctx?.upcoming_governance ?? [];
  const hasUrgent = pending.length > 0 || atRisk.length > 0;

  const avgPct   = Math.round(ctx?.active_cycle?.avg_progress ?? 0);
  const health   = getHealth(avgPct, stats?.at_risk ?? 0, stats?.total_objectives ?? 0);
  const cyclePct = Number(cycle?.cycle_pct ?? 0);

  const STATUS_COLORS: Record<string, string> = {
    ON_TRACK: "#10b981", AT_RISK: "#f59e0b", BEHIND: "#ef4444", COMPLETED: "#3b82f6",
  };
  const STATUS_LABELS: Record<string, string> = {
    ON_TRACK: t("objStatusOnTrack"), AT_RISK: t("objStatusAtRisk"),
    BEHIND: t("objStatusBehind"), COMPLETED: t("objStatusCompleted"),
  };

  const quickLinks = [
    { href: "/strategic",                   icon: Target,    label: t("quickStrategic"),    sub: t("quickStrategicDesc"),    color: "#6366f1" },
    { href: "/tactical",                    icon: Users,     label: t("quickTactical"),     sub: t("quickTacticalDesc"),     color: "#8b5cf6" },
    { href: "/checkins",                    icon: Clock,     label: t("quickCheckins"),     sub: t("quickCheckinsDesc"),     color: "#f59e0b" },
    { href: "/reports/governance",          icon: Calendar,  label: t("quickGovernance"),   sub: t("quickGovernanceDesc"),   color: "#10b981" },
    { href: "/reports/executive-dashboard", icon: BarChart3, label: t("quickExecDash"),     sub: t("quickExecDashDesc"),     color: "#3b82f6" },
    { href: "/delivery",                    icon: Package2,  label: t("quickDeliverables"), sub: t("quickDeliverablesDesc"), color: "#8b5cf6" },
  ];

  return (
    <>
      <style>{`
        @keyframes wau-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wau-scale {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes wau-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wau-pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.25); }
          60%       { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
        }
        @keyframes wau-float {
          0%, 100% { transform: translateY(0)   scale(1); }
          50%       { transform: translateY(-8px) scale(1.02); }
        }
        .welcome-hero  { animation: wau-scale 0.7s cubic-bezier(0.34,1.4,0.64,1) both; }
        .welcome-card  { animation: wau-up 0.55s ease both; }
        .welcome-fade  { animation: wau-fade 0.6s ease both; }
        .welcome-float { animation: wau-float 5s ease-in-out infinite; }
        .pulse-urgent  { animation: wau-pulse-ring 2.2s ease-in-out infinite; }
      `}</style>

      <div className="p-6 space-y-5">

        {/* ── Cabecera ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">{t("title")}</h2>
            <p className="text-xs text-muted-foreground capitalize">
              {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <CycleSelector cycles={cycles} selectedId={selectedCycleId} onSelect={setSelectedCycleId} />
          <button onClick={handleRefresh} disabled={isFetching}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground border rounded-lg hover:bg-muted transition-all">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {t("refresh")}
          </button>
        </div>

        {/* ── Trial banner ── */}
        <TrialCountdownBanner />

        {/* ══════════════════════════════════════════════════════════════════════
            ZONA 1 — HERO (estado del ciclo)
        ══════════════════════════════════════════════════════════════════════ */}
        {isLoading ? (
          <Skeleton className="h-64 rounded-3xl" />
        ) : (
          <div className={cn(
            "relative overflow-hidden rounded-3xl p-8",
            `bg-gradient-to-br ${health.gradient}`,
            mounted ? "welcome-hero" : "opacity-0",
          )}>
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="welcome-float absolute -top-20 -right-20 h-80 w-80 rounded-full"
                style={{ background: `radial-gradient(circle, ${health.orb1} 0%, transparent 70%)` }} />
              <div className="absolute bottom-[-60px] left-[-40px] h-64 w-64 rounded-full"
                style={{ background: `radial-gradient(circle, ${health.orb2} 0%, transparent 70%)` }} />
              <div className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }} />
            </div>

            <div className="relative flex flex-col md:flex-row items-center gap-8">
              {/* Left: greeting + cycle bars */}
              <div className="flex-1 min-w-0 text-white">
                <h1 className="text-4xl font-black tracking-tight leading-tight mb-1">
                  {t(greetingKey())}{userName ? `, ${userName}` : ""}
                </h1>
                <p className="text-base font-semibold mb-5" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {t(health.labelKey)}
                </p>

                {cycle ? (
                  <div className="space-y-2 max-w-xs">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{cycle.name}</p>
                      {cycle.status !== "ACTIVE" && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.8)" }}>
                          {cycle.status === "CLOSED" ? t("statusClosed") : t("statusDraft")}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {t("heroOkrCompliance")}
                        </span>
                        <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                          {avgPct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.min(avgPct, 100)}%`, background: "rgba(255,255,255,0.85)", transition: "width 1.8s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                    </div>

                    {(() => {
                      const conf = cycle.avg_confidence;
                      if (conf === null || conf === undefined) return null;
                      const confPct   = Math.round(conf * 100);
                      const confColor = conf >= 0.7 ? "rgba(52,211,153,0.9)" : conf >= 0.4 ? "rgba(251,191,36,0.9)" : "rgba(248,113,113,0.9)";
                      const confLabel = conf >= 0.7 ? t("confHigh") : conf >= 0.4 ? t("confMid") : t("confLow");
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>
                              {t("heroCycleConf")}
                            </span>
                            <span className="text-[11px] font-bold flex items-center gap-1.5">
                              <span style={{ color: confColor }}>{confLabel}</span>
                              <span style={{ color: "rgba(255,255,255,0.7)" }}>{confPct}%</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${confPct}%`, background: confColor, transition: "width 1.8s cubic-bezier(0.4,0,0.2,1)" }} />
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-1 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {t("heroDaysOf", { elapsed: cycle.days_elapsed, total: cycle.total_days })}
                        </span>
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {t("heroDaysRemaining", { n: cycle.days_remaining })}
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.min(cyclePct, 100)}%`, background: "rgba(255,255,255,0.4)", transition: "width 1.8s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {t("heroCyclePct", { pct: Math.round(cyclePct) })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Link href="/cycles"
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
                    {t("createFirstCycle")} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {/* Center: ring */}
              <div className="welcome-fade shrink-0" style={{ animationDelay: "200ms" }}>
                <BigProgressRing pct={avgPct} />
              </div>

              {/* Right: stat chips */}
              <div className="flex flex-col gap-2.5">
                <StatChip value={stats?.on_track  ?? 0} label={t("onTrack")}    accent="#10b981" delay={400} />
                <StatChip value={stats?.at_risk   ?? 0} label={t("atRisk")}     accent="#f59e0b" delay={550} />
                <StatChip value={stats?.completed ?? 0} label={t("completed")}  accent="#60a5fa" delay={700} />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ZONA 2 — ACCESO RÁPIDO (inmediato post-hero)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="welcome-card" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold">{t("quickAccess")}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {quickLinks.map(({ href, icon: Icon, label, sub, color }) => (
              <Link key={href} href={href}
                className="group flex flex-col gap-3 p-4 rounded-xl border bg-background
                  hover:bg-muted/40 hover:border-foreground/15 hover:shadow-md
                  transition-all duration-200">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${color}18` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            ZONA 3 — IMPACTO ESTRATÉGICO
        ══════════════════════════════════════════════════════════════════════ */}
        <Card className="overflow-hidden welcome-card" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-primary" /> {t("myStrategicImpact")}
            </p>
            <Link href="/traceability" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              {t("viewTraceability")} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ImpactChainWidget />
        </Card>

        {/* ══════════════════════════════════════════════════════════════════════
            ZONA 4 — ACCIÓN (briefing personal + alertas)
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Briefing personal — protagonista */}
          <div className="lg:col-span-7 welcome-card" style={{ animationDelay: "80ms" }}>
            <PersonalBriefingCard />
          </div>

          {/* Acuerdos + alertas + mis OKRs */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Acuerdos — solo ejecutivos, siempre primeros */}
            {isExecutive && agreementStats && agreementStats.total > 0 && (
              <Card className="overflow-hidden welcome-card" style={{ animationDelay: "100ms" }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-l-[3px] border-l-primary bg-muted/30">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Handshake className="h-3 w-3 text-primary" /> {t("agreements")}
                  </p>
                  <Link href="/agreements" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                    {t("agreementsViewAll")} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-4 divide-x border-b">
                  {[
                    { label: t("agreementsTotal"),      value: agreementStats.total,       color: "text-foreground" },
                    { label: t("agreementsPending"),    value: agreementStats.pending,     color: "text-amber-600 dark:text-amber-400" },
                    { label: t("agreementsInProgress"), value: agreementStats.in_progress, color: "text-blue-600 dark:text-blue-400" },
                    { label: t("agreementsFulfilled"),  value: agreementStats.fulfilled,   color: "text-emerald-600 dark:text-emerald-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 px-2 text-center">
                      <span className={cn("text-lg font-bold tabular-nums", color)}>{value}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</span>
                    </div>
                  ))}
                </div>
                {agreementStats.overdue > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {t("agreementsOverdue", { count: agreementStats.overdue })}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {isLoading ? (
              <>
                <Skeleton className="h-36 rounded-xl" />
                <Skeleton className="h-36 rounded-xl" />
              </>
            ) : hasUrgent ? (
              <>
                {/* Check-ins pendientes */}
                {pending.length > 0 && (
                  <Card className="overflow-hidden welcome-card" style={{ animationDelay: "120ms" }}>
                    <div className="px-4 py-2.5 border-b border-l-[3px] border-l-amber-400 bg-muted/30 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-amber-500" /> {t("pendingCheckins")}
                      </p>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                        {pending.length}
                      </span>
                    </div>
                    <div className="divide-y">
                      {pending.slice(0, 3).map(p => (
                        <div key={p.kr_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                          <div className="pulse-urgent h-7 w-7 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {p.kr_code && <span className="text-[10px] font-mono text-muted-foreground mr-1">{p.kr_code}</span>}
                              {p.kr_title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">{p.objective_title}</p>
                          </div>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            {p.days_since >= 999 ? t("noCheckin") : `+${p.days_since}d`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 bg-muted/20 border-t">
                      <Link href="/checkins" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                        {t("viewAllCheckins")} <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </Card>
                )}

                {/* KRs en riesgo */}
                {atRisk.length > 0 && (
                  <Card className="overflow-hidden welcome-card" style={{ animationDelay: "160ms" }}>
                    <div className="px-4 py-2.5 border-b border-l-[3px] border-l-rose-400 bg-muted/30 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-rose-500" /> {t("atRiskKrs")}
                      </p>
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full">
                        {atRisk.length}
                      </span>
                    </div>
                    <div className="divide-y">
                      {atRisk.slice(0, 3).map(kr => (
                        <div key={kr.kr_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                          <div className="h-7 w-7 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {kr.kr_code && <span className="text-[10px] font-mono text-muted-foreground mr-1">{kr.kr_code}</span>}
                              {kr.kr_title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">{kr.objective_title}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn("text-xs font-bold tabular-nums",
                              kr.confidence >= 0.7 ? "text-emerald-600 dark:text-emerald-400"
                              : kr.confidence >= 0.4 ? "text-amber-500" : "text-rose-500")}>
                              {Math.round(kr.confidence * 100)}%
                            </p>
                            <div className="w-12 h-1 rounded-full bg-muted overflow-hidden mt-1">
                              <div className="h-full rounded-full bg-rose-400/70"
                                style={{ width: `${Math.min(100, kr.progress)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 bg-muted/20 border-t">
                      <Link href="/reports/risk-dashboard" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                        Risk Dashboard <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </Card>
                )}
              </>
            ) : cycle ? (
              <Card className="p-5 flex items-center gap-4 welcome-card" style={{ animationDelay: "120ms" }}>
                <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("heroAllGood")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("heroNoUrgent")}</p>
                </div>
              </Card>
            ) : null}

            {/* Mis objetivos — compacto */}
            {myObjs.length > 0 && (
              <Card className="overflow-hidden welcome-card" style={{ animationDelay: "200ms" }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-primary" /> {t("myActiveOkrs")}
                  </p>
                  <Link href="/strategic" className="text-xs text-primary hover:underline flex items-center gap-1">
                    {t("viewAllOkrs")} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="divide-y">
                  {myObjs.slice(0, 4).map(obj => {
                    const color = STATUS_COLORS[obj.status] ?? "#6b7280";
                    return (
                      <div key={obj.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                        <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {obj.code && <span className="text-[10px] font-mono text-muted-foreground mr-1">{obj.code}</span>}
                            {obj.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {obj.level === "COMPANY" ? t("levelCompany") : obj.level === "AREA" ? t("levelArea") : obj.level === "TEAM" ? t("levelTeam") : t("levelIndividual")}
                            {" · "}{obj.kr_count} KR{obj.kr_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <OwnerChip name={obj.owner_name} />
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                            style={{ borderColor: `${color}60`, color, background: `${color}12` }}>
                            {STATUS_LABELS[obj.status] ?? obj.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            ZONA 5 — TENDENCIA + ÁREAS + RANKING
        ══════════════════════════════════════════════════════════════════════ */}
        {(trend.length > 0 || areaStatus.length > 0) && (
          <Card className="p-5 welcome-card" style={{ animationDelay: "320ms" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-primary" /> {t("weeklyTrend")}
              </p>
              <Link href="/reports/executive-dashboard" className="text-xs text-primary hover:underline flex items-center gap-1">
                {t("execDashboard")} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {trend.length > 0 && <TrendArea data={trend} />}
            <AreaCheckinPanel areas={areaStatus} />
            <RankingCompromisoPanel entries={ranking} />
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ZONA 4 — CONTEXTO (gobernanza + acuerdos | entregables)
        ══════════════════════════════════════════════════════════════════════ */}
        {(govEvents.length > 0 || programs.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Gobernanza + Acuerdos */}
            <div className="space-y-4">
              {govEvents.length > 0 && (
                <Card className="overflow-hidden welcome-card" style={{ animationDelay: "300ms" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-primary" /> {t("agenda")}
                    </p>
                    <Link href="/reports/governance" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                      {t("viewCalendar")} <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="divide-y">
                    {govEvents.map((ev, i) => {
                      const GovIcon = EVENT_ICONS[ev.event_type] ?? Calendar;
                      const isOverdue = ev.status === "OVERDUE";
                      const isActive  = ev.status === "IN_PROGRESS";
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                            isOverdue ? "bg-red-50 dark:bg-red-900/30"
                            : isActive  ? "bg-blue-50 dark:bg-blue-900/30"
                            : "bg-muted")}>
                            <GovIcon className={cn("h-4 w-4",
                              isOverdue ? "text-red-500" : isActive ? "text-blue-500" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{ev.responsible}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn("text-xs font-semibold", isOverdue ? "text-red-500" : "text-muted-foreground")}>
                              {formatDateShort(ev.scheduled_date, locale)}
                            </p>
                            {isOverdue && <p className="text-[10px] text-red-500 font-medium">{t("overdue")}</p>}
                            {isActive  && <p className="text-[10px] text-blue-500 font-medium">{t("inProgress")}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

            </div>

            {/* Entregables */}
            {programs.length > 0 && (
              <Card className="overflow-hidden welcome-card" style={{ animationDelay: "320ms" }}>
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Package2 className="h-3.5 w-3.5 text-primary" /> {t("deliverables")}
                  </p>
                  <Link href="/delivery" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                    {t("viewAllPrograms")} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-3 divide-x border-b">
                  {[
                    { label: t("statsActivePrograms"), value: activePrograms.length,  color: "text-blue-600 dark:text-blue-400" },
                    { label: t("statsAvgProgress"),   value: `${avgDeliveryPct}%`,   color: "text-foreground" },
                    { label: t("overdue"),             value: overdueDelivs.length,   color: overdueDelivs.length > 0 ? "text-red-500" : "text-muted-foreground" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 px-2 text-center">
                      <span className={cn("text-lg font-bold tabular-nums", color)}>{value}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="divide-y">
                  {(soonDelivs.length > 0 ? soonDelivs : overdueDelivs).slice(0, 4).map(d => (
                    <Link key={d.id} href={`/delivery/${d.program_id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                        d.is_overdue ? "bg-red-500" : d.days_until_due <= 2 ? "bg-amber-500" : "bg-blue-500")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{d.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{d.program_name}</p>
                      </div>
                      <span className={cn("text-[11px] font-semibold shrink-0",
                        d.is_overdue ? "text-red-500" : d.days_until_due <= 2 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                        {d.is_overdue ? t("overdue") : d.days_until_due === 0 ? t("today") : `${d.days_until_due}d`}
                      </span>
                    </Link>
                  ))}
                  {soonDelivs.length === 0 && overdueDelivs.length === 0 && (
                    <div className="px-4 py-4 text-center">
                      <p className="text-xs text-muted-foreground">{t("noUpcomingDeliverables")}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}


      </div>
    </>
  );
}
