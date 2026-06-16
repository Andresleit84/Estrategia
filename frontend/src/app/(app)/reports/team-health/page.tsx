"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useTeamHealth } from "@/hooks/useReports";
import { Users, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Team radar ────────────────────────────────────────────────────────────────

function TeamRadar({ team }: {
  team: {
    team_name: string;
    avg_progress: number;
    avg_confidence: number;
    cadence_score: number;
    at_risk_count: number;
    objective_count: number;
  };
}) {
  const t = useTranslations("pages.teamHealthPage");
  const coverage = Math.min(100, team.objective_count * 20);
  const data = [
    { axis: t("progress"),   value: Math.round(Number(team.avg_progress)) },
    { axis: t("confidence"), value: Math.round(Number(team.avg_confidence) * 100) },
    { axis: "Cadencia",      value: Math.round(Number(team.cadence_score)) },
    { axis: "Cobertura",     value: coverage },
  ];

  // Overall = average of all 4 radar dimensions (consistent with what's displayed)
  const overall = Math.round(
    (Number(team.avg_progress) + Number(team.avg_confidence) * 100 + Number(team.cadence_score) + coverage) / 4
  );
  const healthColor = overall >= 70 ? "text-green-500" : overall >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{team.team_name}</p>
          <p className="text-xs text-muted-foreground">{team.objective_count} objetivos</p>
        </div>
        <div className="text-right">
          <p className={cn("text-xl font-bold tabular-nums", healthColor)}>{overall}%</p>
          <p className="text-[10px] text-muted-foreground">{t("health")}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={data} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value" stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))" fillOpacity={0.2}
          />
          <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
        <div>
          <p className="text-sm font-semibold tabular-nums">{Math.round(Number(team.avg_progress))}%</p>
          <p className="text-[10px] text-muted-foreground">{t("progress")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold tabular-nums">{Math.round(Number(team.avg_confidence) * 100)}%</p>
          <p className="text-[10px] text-muted-foreground">{t("confidence")}</p>
        </div>
        <div>
          <p className={cn("text-sm font-semibold tabular-nums", team.at_risk_count > 0 ? "text-red-500" : "")}>
            {team.at_risk_count}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("atRisk")}</p>
        </div>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamHealthPage() {
  const t = useTranslations("pages.teamHealthPage");
  const tReports = useTranslations("pages.reports.teamHealth");
  const { data: rawTeams = [], isLoading } = useTeamHealth();

  // Sort: worst health first so attention goes to teams that need it
  const teams = [...rawTeams].sort((a, b) => {
    const scoreA = (Number(a.avg_progress) + Number(a.avg_confidence) * 100 + Number(a.cadence_score) + Math.min(100, a.objective_count * 20)) / 4;
    const scoreB = (Number(b.avg_progress) + Number(b.avg_confidence) * 100 + Number(b.cadence_score) + Math.min(100, b.objective_count * 20)) / 4;
    return scoreA - scoreB;
  });

  const atRiskTeams   = teams.filter(t => {
    const s = (Number(t.avg_progress) + Number(t.avg_confidence) * 100 + Number(t.cadence_score) + Math.min(100, t.objective_count * 20)) / 4;
    return s < 40;
  }).length;
  const healthyTeams  = teams.filter(t => {
    const s = (Number(t.avg_progress) + Number(t.avg_confidence) * 100 + Number(t.cadence_score) + Math.min(100, t.objective_count * 20)) / 4;
    return s >= 70;
  }).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={tReports("title")}
        description={tReports("description")}
      />

      {!isLoading && teams.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{healthyTeams}</p>
              <p className="text-xs text-muted-foreground">{t("healthyTeams")}</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{teams.length}</p>
              <p className="text-xs text-muted-foreground">{t("activeTeams")}</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", atRiskTeams > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-muted")}>
              <AlertTriangle className={cn("h-5 w-5", atRiskTeams > 0 ? "text-red-500" : "text-muted-foreground")} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold tabular-nums", atRiskTeams > 0 ? "text-red-500" : "")}>{atRiskTeams}</p>
              <p className="text-xs text-muted-foreground">{t("atRiskTeams")}</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={t("noData")}
            description="Los equipos aparecen aquí cuando tienen objetivos activos en el ciclo."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <TeamRadar key={team.team_id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
