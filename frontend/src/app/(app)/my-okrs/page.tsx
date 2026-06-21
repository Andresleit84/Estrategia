"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useMyWork, type MyKR, type NorthStarObjective } from "@/hooks/useMyWork";
import { cn, formatKRValue } from "@/lib/utils";
import {
  Target, TrendingUp, CheckSquare, AlertCircle, ChevronRight,
  Building2, Star, Clock, Calendar,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<string, string> = {
  COMPANY:    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  AREA:       "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  TEAM:       "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  INDIVIDUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const LEVEL_LABEL: Record<string, string> = {
  COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo", INDIVIDUAL: "Individual",
};

function progressColor(pct: number) {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function confidenceColor(pct: number) {
  if (pct >= 70) return "text-green-600 dark:text-green-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function checkinUrgency(days: number): "ok" | "warn" | "overdue" {
  if (days <= 7) return "ok";
  if (days <= 14) return "warn";
  return "overdue";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 min-w-0">
      <div className={cn("rounded-lg p-1.5", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function NorthStarCard({ obj }: { obj: NorthStarObjective }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-violet-50/50 dark:bg-violet-900/10 px-4 py-3">
      <Star className="h-4 w-4 shrink-0 text-violet-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {obj.code && (
            <span className="font-mono text-[10px] text-muted-foreground">{obj.code}</span>
          )}
          <span className="text-sm font-medium leading-snug truncate">{obj.title}</span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full", progressColor(obj.progress))} style={{ width: `${obj.progress}%` }} />
        </div>
        <span className="text-xs font-semibold w-8 text-right">{obj.progress}%</span>
      </div>
    </div>
  );
}

function KRCard({ kr }: { kr: MyKR }) {
  const urgency = checkinUrgency(kr.days_since_checkin);
  const hasCheckin = kr.last_checkin_at != null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">{kr.kr_title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", LEVEL_BADGE[kr.level])}>
              {LEVEL_LABEL[kr.level]}
            </span>
            {kr.team_name && <span>{kr.team_name}</span>}
            {kr.area_name && kr.team_name && <span>·</span>}
            {kr.area_name && <span>{kr.area_name}</span>}
          </div>
        </div>
        <div className={cn("text-xs font-bold shrink-0", confidenceColor(kr.confidence_pct))}>
          {kr.confidence_pct}% conf.
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatKRValue(kr.current_value, kr.metric_unit)} / {formatKRValue(kr.target_value, kr.metric_unit)}</span>
          <span className="font-semibold text-foreground">{kr.kr_progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", progressColor(kr.kr_progress))} style={{ width: `${kr.kr_progress}%` }} />
        </div>
      </div>

      {/* Check-in status + action */}
      <div className="flex items-center justify-between pt-1 border-t">
        <div className={cn("flex items-center gap-1 text-xs", {
          "text-green-600 dark:text-green-400": urgency === "ok",
          "text-amber-600 dark:text-amber-400": urgency === "warn",
          "text-red-600 dark:text-red-400": urgency === "overdue",
        })}>
          <Clock className="h-3 w-3" />
          {hasCheckin
            ? urgency === "ok"
              ? `Hace ${kr.days_since_checkin}d`
              : `Sin check-in hace ${kr.days_since_checkin}d`
            : "Sin check-ins aún"}
        </div>
        <Link href={`/checkins?krId=${kr.kr_id}`}>
          <Button size="sm" variant={urgency === "overdue" ? "default" : "ghost"} className="h-7 text-xs gap-1">
            <CheckSquare className="h-3 w-3" />
            Check-in
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface ObjectiveGroup {
  objective_id: string;
  objective_title: string;
  objective_code: string | null;
  level: string;
  objective_progress: number;
  objective_status: string;
  krs: MyKR[];
}

function ObjectiveSection({ group, daysRemaining }: { group: ObjectiveGroup; daysRemaining: number }) {
  const needsCheckin = group.krs.filter(k => checkinUrgency(k.days_since_checkin) !== "ok").length;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {group.objective_code && (
            <span className="font-mono text-xs text-muted-foreground shrink-0">{group.objective_code}</span>
          )}
          <h3 className="font-semibold text-base leading-snug truncate">{group.objective_title}</h3>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0", LEVEL_BADGE[group.level])}>
            {LEVEL_LABEL[group.level]}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {needsCheckin > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {needsCheckin} necesita check-in
            </span>
          )}
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", progressColor(group.objective_progress))} style={{ width: `${group.objective_progress}%` }} />
            </div>
            <span className="text-sm font-bold w-8 text-right">{group.objective_progress}%</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
        {group.krs.map(kr => <KRCard key={kr.kr_id} kr={kr} />)}
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MyOkrsPage() {
  const { data, isLoading } = useMyWork();

  const groups = useMemo<ObjectiveGroup[]>(() => {
    if (!data?.krs.length) return [];
    const map = new Map<string, ObjectiveGroup>();
    for (const kr of data.krs) {
      if (!map.has(kr.objective_id)) {
        map.set(kr.objective_id, {
          objective_id: kr.objective_id,
          objective_title: kr.objective_title,
          objective_code: kr.objective_code,
          level: kr.level,
          objective_progress: kr.objective_progress,
          objective_status: kr.objective_status,
          krs: [],
        });
      }
      map.get(kr.objective_id)!.krs.push(kr);
    }
    return Array.from(map.values());
  }, [data]);

  const stats = useMemo(() => {
    if (!data?.krs.length) return { total: 0, avgProgress: 0, needCheckin: 0 };
    const total = data.krs.length;
    const avgProgress = Math.round(data.krs.reduce((s, k) => s + k.kr_progress, 0) / total);
    const needCheckin = data.krs.filter(k => checkinUrgency(k.days_since_checkin) !== "ok").length;
    return { total, avgProgress, needCheckin };
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-32 rounded-xl" />
        {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  if (!data?.krs.length) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeader title="Mi Estrategia" description="Tus objetivos y resultados clave" />
        <EmptyState
          icon={Target}
          title="Sin KRs asignados"
          description="No tienes resultados clave asignados en el ciclo activo. Pide a tu manager que te asigne como responsable de algún KR."
        />
      </div>
    );
  }

  const daysRemaining = data.cycle?.days_remaining ?? 0;

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <PageHeader
        title="Mi Estrategia"
        description={data.cycle ? `${data.cycle.name} · ${daysRemaining}d restantes` : "Ciclo activo"}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatPill icon={Target} label="KRs activos" value={stats.total} color="bg-violet-500" />
        <StatPill icon={TrendingUp} label="Progreso promedio" value={`${stats.avgProgress}%`} color="bg-blue-500" />
        <StatPill
          icon={stats.needCheckin > 0 ? AlertCircle : CheckSquare}
          label="Necesitan check-in"
          value={stats.needCheckin > 0 ? stats.needCheckin : "Al día"}
          color={stats.needCheckin > 0 ? "bg-amber-500" : "bg-green-500"}
        />
      </div>

      {/* North Star */}
      {data.north_star.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Por qué importa — Objetivos de empresa
            </h2>
          </div>
          <div className="space-y-2">
            {data.north_star.map(obj => <NorthStarCard key={obj.id} obj={obj} />)}
          </div>
          {data.cycle && (
            <p className="text-xs text-muted-foreground pl-1 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Ciclo cierra en {daysRemaining} días · {new Date(data.cycle.end_date).toLocaleDateString("es", { day: "numeric", month: "short" })}
            </p>
          )}
        </section>
      )}

      {/* My KRs grouped by objective */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mis resultados clave
          </h2>
        </div>
        {groups.map(g => (
          <ObjectiveSection key={g.objective_id} group={g} daysRemaining={daysRemaining} />
        ))}
      </section>

      {/* Footer link */}
      <div className="flex justify-end">
        <Link href="/checkins">
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            Ver todos los check-ins
            <ChevronRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
