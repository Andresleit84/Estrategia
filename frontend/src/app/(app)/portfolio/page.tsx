"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePortfolioMetrics, type PortfolioClient } from "@/hooks/usePortfolio";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Briefcase, AlertTriangle } from "lucide-react";

const PLAN_STYLES: Record<string, string> = {
  FREE:       "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  PRO:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ENTERPRISE: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const MODE_STYLES: Record<string, string> = {
  AGILE:       "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  TRADITIONAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  HYBRID:      "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

function checkinColor(daysAgo: number | null): string {
  if (daysAgo === null) return "text-muted-foreground";
  if (daysAgo <= 3) return "text-green-600 dark:text-green-400";
  if (daysAgo <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function checkinLabel(daysAgo: number | null): string {
  if (daysAgo === null) return "Sin check-ins";
  if (daysAgo === 0) return "Hoy";
  if (daysAgo === 1) return "Ayer";
  return `Hace ${daysAgo}d`;
}

function ClientCard({ client }: { client: PortfolioClient }) {
  const router = useRouter();
  const qc = useQueryClient();

  async function handleSwitch() {
    await api.post<unknown>("/auth/switch-org", { org_id: client.org_id });
    await qc.invalidateQueries();
    router.refresh();
    router.push("/welcome");
  }

  const cycleTotal = client.active_cycle_days_remaining !== null
    ? client.active_cycle_days_remaining + 30
    : null;
  const cycleProgress = cycleTotal && cycleTotal > 0
    ? Math.max(0, Math.min(100, ((cycleTotal - (client.active_cycle_days_remaining ?? 0)) / cycleTotal) * 100))
    : null;

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight">{client.org_name}</h3>
          <div className="flex gap-1 shrink-0">
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", PLAN_STYLES[client.org_plan] ?? PLAN_STYLES.FREE)}>
              {client.org_plan}
            </span>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", MODE_STYLES[client.org_mode] ?? MODE_STYLES.AGILE)}>
              {client.org_mode}
            </span>
          </div>
        </div>

        {/* Active cycle */}
        {client.active_cycle_name ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate">{client.active_cycle_name}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {client.active_cycle_days_remaining}d
              </span>
            </div>
            {cycleProgress !== null && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${cycleProgress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sin ciclo activo</span>
        )}
      </div>

      {/* Metrics */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center border-b">
        <div>
          <p className="text-lg font-bold tabular-nums">{client.objectives_count}</p>
          <p className="text-[10px] text-muted-foreground">Objetivos</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums">{client.krs_count}</p>
          <p className="text-[10px] text-muted-foreground">KRs</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums">{Number(client.avg_progress).toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">Progreso</p>
        </div>
      </div>

      {/* Risk + last checkin */}
      <div className="px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className={cn("h-3.5 w-3.5", client.at_risk_count > 0 ? "text-red-500" : "text-muted-foreground")} />
          <span className={cn("text-xs font-medium", client.at_risk_count > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            {client.at_risk_count} en riesgo
          </span>
        </div>
        <span className={cn("text-xs font-medium", checkinColor(client.last_checkin_days_ago))}>
          {checkinLabel(client.last_checkin_days_ago)}
        </span>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 mt-auto">
        <button
          onClick={handleSwitch}
          className="w-full text-sm text-primary font-medium hover:underline text-left"
        >
          Ir a la institución →
        </button>
      </div>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

export default function PortfolioPage() {
  const { data: clients = [], isLoading } = usePortfolioMetrics();

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Portafolio de Clientes"
        description="Visión consolidada de todas las instituciones bajo consultoría"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="Sin clientes en el portafolio"
            description="Para usar el portafolio, debes pertenecer a múltiples organizaciones"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <ClientCard key={client.org_id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
