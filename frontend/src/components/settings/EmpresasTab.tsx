"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminOrgs } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, TrendingUp, Plus, CheckCircle2, Trash2, AlertTriangle, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const MODE_LABELS: Record<string, string> = {
  AGILE: "Ágil", TRADITIONAL: "Tradicional", HYBRID: "Híbrido",
};

const PLAN_COLORS: Record<string, string> = {
  FREE:       "bg-muted text-muted-foreground",
  PRO:        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ENTERPRISE: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
};

function trialInfo(expiresAt?: string | null): { active: boolean; daysLeft: number; hoursLeft: number; label: string } {
  if (!expiresAt) return { active: false, daysLeft: 0, hoursLeft: 0, label: "" };
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return { active: false, daysLeft: 0, hoursLeft: 0, label: "Trial vencido" };
  const daysLeft  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const label = daysLeft === 0
    ? `${hoursLeft}h restantes`
    : daysLeft === 1
    ? `1 día y ${hoursLeft}h`
    : `${daysLeft} días`;
  return { active: true, daysLeft, hoursLeft, label };
}

const ORG_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500",
];

function orgColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ORG_COLORS[h % ORG_COLORS.length];
}

export function EmpresasTab() {
  const { user } = useAuth();
  const { data: orgs, isLoading, refetch } = useAdminOrgs();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleDelete(orgId: string) {
    setDeleting(orgId);
    setErrors({});
    try {
      await api.delete(`/admin/organizations/${orgId}`);
      setConfirmDelete(null);
      refetch();
    } catch (err: unknown) {
      setErrors((e) => ({ ...e, [orgId]: getApiErrorMessage(err, "Error al eliminar") }));
    } finally {
      setDeleting(null);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {orgs?.length ?? 0} {orgs?.length === 1 ? "organización registrada" : "organizaciones registradas"}
          </p>
        </div>
        <Link href="/auth/register" target="_blank">
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nueva empresa
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {orgs?.map((org) => {
          const isCurrent = org.id === user?.organization_id;
          const err       = errors[org.id];
          const trial     = trialInfo(org.trial_expires_at);
          const urgent    = trial.active && trial.daysLeft <= 3;
          const warning   = trial.active && trial.daysLeft <= 7;

          return (
            <Card
              key={org.id}
              className={cn(
                "p-5 space-y-4 transition-all",
                isCurrent && "border-primary/40 bg-primary/5 dark:bg-primary/10",
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0",
                    orgColor(org.name),
                  )}>
                    {org.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{org.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                  </div>
                </div>
                {isCurrent && (
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Activa
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {trial.active ? (
                  <Badge className={cn(
                    "text-xs gap-1",
                    urgent  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
                    warning ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                              "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                  )}>
                    <Timer className="h-3 w-3" />
                    Trial · {trial.label}
                  </Badge>
                ) : (
                  <Badge className={cn("text-xs", PLAN_COLORS[org.plan] ?? PLAN_COLORS.FREE)}>
                    {org.plan}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {MODE_LABELS[org.mode] ?? org.mode}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: Users, value: org.member_count, label: "Miembros" },
                  { icon: TrendingUp, value: org.active_cycles, label: "Ciclos" },
                  { icon: Target, value: org.objective_count, label: "OKRs" },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="rounded-lg bg-muted/50 p-2">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-semibold tabular-nums">{value}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="pt-1 border-t space-y-2">
                {confirmDelete === org.id ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <div className="flex items-start gap-2 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Se eliminará la empresa y se cerrarán todas sus sesiones. Esta acción no se puede deshacer.</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        disabled={deleting === org.id}
                        onClick={() => handleDelete(org.id)}
                      >
                        {deleting === org.id ? "Eliminando..." : "Confirmar eliminación"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                    {err && <p className="text-[10px] text-destructive">{err}</p>}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Creada {new Date(org.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {!isCurrent && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDelete(org.id)}
                          title="Eliminar empresa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {err && <p className="text-[10px] text-destructive mt-1">{err}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
