"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useExecutiveDashboard,
  useRiskDashboard,
  useCycleHealth,
  useUpcomingMilestones,
} from "@/hooks/useReports";
import {
  AlertTriangle, FileText, ArrowRight, BarChart3, Users, Rocket,
  TrendingUp, Calendar, Activity, ShieldCheck, LayoutDashboard,
  Handshake, Presentation, FlagTriangleRight, ShieldAlert, Sparkles,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 70) return "text-green-600 dark:text-green-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-500";
}

function scoreStars(score: number) {
  const s = Math.round((score / 10) * 5);
  return Array.from({ length: 5 }, (_, i) => i < s);
}

// ── Report card ────────────────────────────────────────────────────────────────

function ReportCard({
  href,
  icon: Icon,
  iconColor,
  title,
  description,
  badge,
  aiEnabled,
  metric,
  metricLabel,
  metricColor,
  sub,
  isLoading,
}: {
  href: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  badge?: string;
  aiEnabled?: boolean;
  metric?: string | number;
  metricLabel?: string;
  metricColor?: string;
  sub?: string;
  isLoading?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border bg-card p-5",
        "hover:shadow-md hover:border-primary/20 transition-all duration-200",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", `${iconColor}/15`)}>
          <Icon className={cn("h-4.5 w-4.5", iconColor)} style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-foreground leading-tight">{title}</span>
            {aiEnabled && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary/80 bg-primary/10 px-1.5 py-px rounded-full shrink-0">
                <Sparkles className="h-2.5 w-2.5" />IA
              </span>
            )}
            {badge && !aiEnabled && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-px rounded-full shrink-0">{badge}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{description}</p>
        </div>
      </div>

      {/* Metric */}
      {isLoading ? (
        <Skeleton className="h-8 w-24 rounded-lg" />
      ) : metric !== undefined ? (
        <div className="flex items-end gap-2">
          <p className={cn("text-2xl font-extrabold tabular-nums tracking-tight leading-none", metricColor ?? "text-foreground")}>
            {metric}
          </p>
          {metricLabel && <p className="text-xs text-muted-foreground mb-0.5 leading-tight">{metricLabel}</p>}
        </div>
      ) : sub ? (
        <p className="text-xs text-muted-foreground">{sub}</p>
      ) : null}

      {/* Arrow */}
      <div className="mt-auto flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
        Ver reporte
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────

function Section({
  icon: Icon, iconColor, label, children,
}: {
  icon: React.ElementType; iconColor: string; label: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("h-1 w-5 rounded-full shrink-0", iconColor.replace("text-", "bg-"))} />
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {children}
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const t          = useTranslations("pages.reports");
  const dashQ      = useExecutiveDashboard();
  const riskQ      = useRiskDashboard();
  const healthQ    = useCycleHealth();
  const milesQ     = useUpcomingMilestones(30);

  const dash       = dashQ.data;
  const risk       = riskQ.data;
  const health     = healthQ.data;
  const miles      = milesQ.data;

  const score      = Number(dash?.cycle_score ?? health?.cycle_score ?? 0);
  const avgPct     = Math.round(Number(dash?.avg_progress ?? 0));
  const completedObjs = Number(dash?.completed_objectives ?? health?.completed_count ?? 0);
  const totalObjs     = Number(dash?.total_objectives ?? 0);
  const atRisk        = Number(risk?.summary?.total_at_risk ?? dash?.at_risk_krs ?? 0);

  return (
    <div className="p-6 space-y-8 max-w-7xl">

      {/* Executive score banner */}
      <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-muted/20 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Centro de Reportes
            </p>
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {dash?.cycle_name ?? "Ciclo Activo"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análisis y reportería ejecutiva del ciclo en curso
            </p>
          </div>

          {/* Score */}
          <div className="flex items-center gap-6 shrink-0">
            {dashQ.isLoading ? (
              <Skeleton className="h-16 w-32 rounded-xl" />
            ) : (
              <>
                <div className="text-center">
                  <p className={cn("text-4xl font-extrabold tabular-nums leading-none", progressColor(score * 10))}>
                    {score.toFixed(1)}
                  </p>
                  <div className="flex gap-0.5 mt-1 justify-center">
                    {scoreStars(score).map((filled, i) => (
                      <Star key={i} className={cn("h-3 w-3", filled ? "text-amber-400 fill-amber-400" : "text-muted")} />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Score / 10</p>
                </div>

                <div className="h-12 w-px bg-border hidden sm:block" />

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Objetivos</span>
                    <span className={cn("font-semibold tabular-nums", progressColor(totalObjs > 0 ? (completedObjs / totalObjs) * 100 : 0))}>
                      {completedObjs}/{totalObjs}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Progreso</span>
                    <span className={cn("font-semibold tabular-nums", progressColor(avgPct))}>{avgPct}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">KRs en riesgo</span>
                    <span className={cn("font-semibold tabular-nums", atRisk > 0 ? "text-red-500" : "text-green-600 dark:text-green-400")}>{atRisk}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RENDIMIENTO */}
      <Section icon={TrendingUp} iconColor="text-blue-600 dark:text-blue-400" label="Rendimiento">
        <ReportCard
          href="/reports/executive-dashboard"
          icon={LayoutDashboard}
          iconColor="text-blue-600 dark:text-blue-400"
          title="Dashboard Ejecutivo"
          description="KPIs del ciclo, tendencia semanal y proyección de cierre"
          metric={avgPct ? `${avgPct}%` : undefined}
          metricLabel="progreso promedio"
          metricColor={progressColor(avgPct)}
          isLoading={dashQ.isLoading}
        />
        <ReportCard
          href="/reports/executive-briefing"
          icon={FileText}
          iconColor="text-violet-600 dark:text-violet-400"
          title="Briefing Ejecutivo"
          description="Narrativa del ciclo, highlights, riesgos y próximos pasos generados por IA"
          aiEnabled
          sub={health ? `Score ${(Number(health.cycle_score) / 10).toFixed(1)}/10 · ${health.completed_count} completados` : undefined}
          isLoading={healthQ.isLoading}
        />
        <ReportCard
          href="/reports/engagement"
          icon={Handshake}
          iconColor="text-emerald-600 dark:text-emerald-400"
          title="Retorno del Engagement"
          description="Acuerdos cumplidos vs comprometidos, OKRs logrados y trabajo generado"
          aiEnabled
          metric={completedObjs && totalObjs ? `${Math.round((completedObjs / totalObjs) * 100)}%` : undefined}
          metricLabel="objetivos logrados"
          metricColor={progressColor(totalObjs > 0 ? Math.round((completedObjs / totalObjs) * 100) : 0)}
          isLoading={dashQ.isLoading}
        />
        <ReportCard
          href="/reports/cycle-close"
          icon={FlagTriangleRight}
          iconColor="text-amber-600 dark:text-amber-400"
          title="Cierre de Ciclo"
          description="Retrospectiva, aprendizajes y recomendaciones para el próximo ciclo"
          aiEnabled
          sub="Genera el análisis de cierre al finalizar el ciclo"
        />
      </Section>

      {/* RIESGO & SALUD */}
      <Section icon={ShieldAlert} iconColor="text-red-500" label="Riesgo & Salud">
        <ReportCard
          href="/reports/risk-dashboard"
          icon={AlertTriangle}
          iconColor="text-red-500"
          title="Riesgo & Alertas"
          description="Matriz de riesgo, alertas tempranas IA y KRs sin check-in"
          aiEnabled
          metric={atRisk || undefined}
          metricLabel="KRs en riesgo"
          metricColor={atRisk > 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}
          isLoading={riskQ.isLoading}
        />
        <ReportCard
          href="/reports/cycle-health"
          icon={Activity}
          iconColor="text-cyan-600 dark:text-cyan-400"
          title="Salud del Ciclo"
          description="Score, estado de objetivos/KRs, confianza promedio y tendencia"
          metric={health ? `${Math.round(Number(health.cycle_score) / 10 * 10) / 10}/10` : undefined}
          metricLabel="score del ciclo"
          metricColor={health ? progressColor(Number(health.cycle_score) * 10) : undefined}
          isLoading={healthQ.isLoading}
        />
        <ReportCard
          href="/reports/team-health"
          icon={Users}
          iconColor="text-indigo-600 dark:text-indigo-400"
          title="Salud de Equipos"
          description="Radar por equipo: progreso, confianza, cadencia y cobertura"
          sub="Comparativo de salud entre todos los equipos"
        />
      </Section>

      {/* PLANIFICACIÓN */}
      <Section icon={Calendar} iconColor="text-teal-600 dark:text-teal-400" label="Planificación">
        <ReportCard
          href="/reports/portfolio"
          icon={Rocket}
          iconColor="text-orange-600 dark:text-orange-400"
          title="Portfolio de Iniciativas"
          description="Vista Gantt de iniciativas agrupadas por equipo con estado y hitos"
          sub="Línea de tiempo de todas las iniciativas activas"
        />
        <ReportCard
          href="/reports/upcoming-milestones"
          icon={Calendar}
          iconColor="text-teal-600 dark:text-teal-400"
          title="Hitos Próximos"
          description="Próximos vencimientos de hitos e iniciativas ordenados por urgencia"
          metric={miles ? miles.filter(m => m.days_until_due <= 7).length || undefined : undefined}
          metricLabel="hitos esta semana"
          metricColor="text-amber-600 dark:text-amber-400"
          isLoading={milesQ.isLoading}
        />
      </Section>

      {/* GOBERNANZA */}
      <Section icon={ShieldCheck} iconColor="text-slate-500" label="Gobernanza">
        <ReportCard
          href="/reports/governance"
          icon={ShieldCheck}
          iconColor="text-slate-500"
          title="Calendario de Gobernanza"
          description="Kickoffs, revisiones de salud, cierres y retrospectivas del ciclo"
          sub="Gestión del ciclo de vida OKR"
        />
        <ReportCard
          href="/reports/consejo"
          icon={Presentation}
          iconColor="text-violet-600 dark:text-violet-400"
          title="Paquete Consejo"
          description="Reportes curados para presentar en junta directiva: dashboard, briefing, engagement y riesgos"
          aiEnabled
          sub="Paquete ejecutivo para sesión de directorio"
        />
        <ReportCard
          href="/reports/guide"
          icon={BarChart3}
          iconColor="text-muted-foreground"
          title="Guía del Sistema"
          description="Modelo de cascada estratégica: de diagnóstico a historia de usuario"
          sub="Referencia metodológica del sistema OKR"
        />
      </Section>

    </div>
  );
}
