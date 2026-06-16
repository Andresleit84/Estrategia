"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  useConsultantClients,
  useAddConsultantClient,
  useRemoveConsultantClient,
  useToggleConsultantDigest,
  useToggleClientAlerts,
  useTriggerConsultantDigest,
} from "@/hooks/useConsultant";
import { useMyOrgs } from "@/hooks/useAdmin";
import {
  Building2, TrendingUp, TrendingDown, AlertTriangle,
  Send, Loader2, Plus, Trash2, Bell, BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ConsultantClientHealth } from "@/hooks/useConsultant";

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = score >= 7 ? "text-green-600 dark:text-green-400"
    : score >= 4 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  return <span className={cn("font-bold tabular-nums text-lg", color)}>{score}</span>;
}

// ── Client card ───────────────────────────────────────────────────────────────

function ClientCard({
  client,
  onRemove,
  onToggleDigest,
  onToggleAlerts,
}: {
  client: ConsultantClientHealth;
  onRemove: () => void;
  onToggleDigest: (enabled: boolean) => void;
  onToggleAlerts: (enabled: boolean) => void;
}) {
  const t = useTranslations("pages.consultant");
  const pct = client.active_objectives > 0
    ? Math.round((client.on_track / client.active_objectives) * 100)
    : 0;

  const borderColor = client.at_risk > 0 || client.krs_at_risk > 0
    ? "border-l-amber-400"
    : "border-l-green-400";

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-sm truncate">{client.org_name}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 truncate">
              {client.cycle_name ?? t("noCycle")}
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Score */}
              <div className="flex flex-col items-center">
                <ScoreBadge score={client.cycle_score} />
                <span className="text-[10px] text-muted-foreground">score/10</span>
              </div>

              {/* On track */}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1 text-sm font-bold text-green-600 dark:text-green-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {client.on_track}
                </div>
                <span className="text-[10px] text-muted-foreground">{t("onTrack")}</span>
              </div>

              {/* At risk */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex items-center gap-1 text-sm font-bold",
                  client.at_risk > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}>
                  <TrendingDown className="h-3.5 w-3.5" />
                  {client.at_risk}
                </div>
                <span className="text-[10px] text-muted-foreground">{t("lagging")}</span>
              </div>

              {/* KRs at risk */}
              {client.krs_at_risk > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    {client.krs_at_risk} {t("krsAtRisk")}
                  </span>
                </div>
              )}

              {/* Progress bar */}
              {client.active_objectives > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={onRemove}
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              title={t("removeClient")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {/* Toggle digest consolidado del consultor */}
              <button
                onClick={() => onToggleDigest(!client.digest_enabled)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors border",
                  client.digest_enabled
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border"
                )}
                title={client.digest_enabled ? "Mi digest activo — click para desactivar" : "Mi digest inactivo — click para activar"}
              >
                {client.digest_enabled
                  ? <><Bell className="h-2.5 w-2.5" /> {t("digest")}</>
                  : <><BellOff className="h-2.5 w-2.5" /> {t("digest")}</>}
              </button>

              {/* Toggle alertas del cliente (habilita el panel de notificaciones para el cliente) */}
              <button
                onClick={() => onToggleAlerts(!client.client_alerts_enabled)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors border",
                  client.client_alerts_enabled
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-400/30"
                    : "bg-muted text-muted-foreground border-border"
                )}
                title={client.client_alerts_enabled
                  ? "Notificaciones del cliente activas — el cliente puede configurar sus propias alertas"
                  : "Notificaciones del cliente desactivadas — el cliente no ve ese panel"}
              >
                {client.client_alerts_enabled
                  ? <><Bell className="h-2.5 w-2.5" /> {t("clientAlerts")}</>
                  : <><BellOff className="h-2.5 w-2.5" /> {t("clientAlerts")}</>}
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Summary stats ─────────────────────────────────────────────────────────────

function SummaryStats({ clients }: { clients: ConsultantClientHealth[] }) {
  const t = useTranslations("pages.consultant");
  const active = clients.filter(c => c.cycle_id);
  const totalAtRisk = clients.reduce((s, c) => s + c.at_risk, 0);
  const totalKrsAtRisk = clients.reduce((s, c) => s + c.krs_at_risk, 0);
  const avgScore = active.length > 0
    ? (active.reduce((s, c) => s + (c.cycle_score ?? 0), 0) / active.length).toFixed(1)
    : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="p-4 flex flex-col items-center justify-center gap-1 text-center">
        <Building2 className="h-5 w-5 text-muted-foreground mb-1" />
        <p className="text-2xl font-bold tabular-nums">{clients.length}</p>
        <p className="text-xs text-muted-foreground">{t("clients")}</p>
      </Card>
      <Card className="p-4 flex flex-col items-center justify-center gap-1 text-center">
        <p className={cn(
          "text-2xl font-bold tabular-nums",
          avgScore !== null
            ? Number(avgScore) >= 7 ? "text-green-600 dark:text-green-400"
              : Number(avgScore) >= 4 ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400"
            : ""
        )}>
          {avgScore ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground">{t("avgScore")}</p>
      </Card>
      <Card className="p-4 flex flex-col items-center justify-center gap-1 text-center">
        <TrendingDown className={cn("h-5 w-5 mb-1", totalAtRisk > 0 ? "text-amber-500" : "text-green-500")} />
        <p className={cn("text-2xl font-bold tabular-nums", totalAtRisk > 0 ? "text-amber-600 dark:text-amber-400" : "")}>
          {totalAtRisk}
        </p>
        <p className="text-xs text-muted-foreground">{t("laggingObjs")}</p>
      </Card>
      <Card className="p-4 flex flex-col items-center justify-center gap-1 text-center">
        <AlertTriangle className={cn("h-5 w-5 mb-1", totalKrsAtRisk > 0 ? "text-red-500" : "text-green-500")} />
        <p className={cn("text-2xl font-bold tabular-nums", totalKrsAtRisk > 0 ? "text-red-600 dark:text-red-400" : "")}>
          {totalKrsAtRisk}
        </p>
        <p className="text-xs text-muted-foreground">{t("krsAtRisk")}</p>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsultantDigestPage() {
  const t = useTranslations("pages.consultant");
  const { data: clients = [], isLoading } = useConsultantClients();
  const { data: myOrgs = [] } = useMyOrgs();
  const addClient = useAddConsultantClient();
  const removeClient = useRemoveConsultantClient();
  const toggleDigest = useToggleConsultantDigest();
  const toggleAlerts = useToggleClientAlerts();
  const triggerDigest = useTriggerConsultantDigest();

  const [showAddPanel, setShowAddPanel] = useState(false);

  // Orgs I have access to that aren't already linked
  const linkedIds = new Set(clients.map(c => c.org_id));
  const availableOrgs = myOrgs.filter(o => !linkedIds.has(o.id));

  async function handleAdd(orgId: string) {
    try {
      await addClient.mutateAsync(orgId);
      toast.success(t("clientLinked"));
      if (availableOrgs.length <= 1) setShowAddPanel(false);
    } catch {
      toast.error(t("linkError"));
    }
  }

  async function handleRemove(orgId: string, name: string) {
    try {
      await removeClient.mutateAsync(orgId);
      toast.success(`${name} desvinculado`);
    } catch {
      toast.error("Error al desvincular");
    }
  }

  async function handleToggle(orgId: string, enabled: boolean) {
    try {
      await toggleDigest.mutateAsync({ orgId, enabled });
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function handleToggleAlerts(orgId: string, enabled: boolean, orgName: string) {
    try {
      await toggleAlerts.mutateAsync({ orgId, enabled });
      toast.success(
        enabled
          ? `Notificaciones habilitadas para ${orgName}`
          : `Notificaciones desactivadas para ${orgName}`,
        { description: enabled
          ? "El cliente ya puede configurar sus propias alertas en Ajustes → Notificaciones"
          : "El cliente ya no verá el panel de notificaciones" }
      );
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function handleTrigger() {
    const id = "digest-trigger";
    toast.loading("Enviando digest…", { id });
    try {
      const res = await triggerDigest.mutateAsync();
      if (res.ok) {
        toast.success("Digest enviado", {
          id,
          description: `Canales: ${res.sent_channels.join(", ") || "ninguno"}`,
        });
      } else {
        toast.warning("Sin clientes con digest activo", { id });
      }
    } catch {
      toast.error("Error al enviar el digest", { id });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Digest de Consultor"
        description="Vista consolidada de todas tus empresas cliente y sus métricas de salud"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddPanel(v => !v)}
              className="gap-2"
              disabled={availableOrgs.length === 0}
            >
              <Plus className="h-4 w-4" />
              Agregar cliente
            </Button>
            <Button
              size="sm"
              onClick={handleTrigger}
              disabled={triggerDigest.isPending || clients.filter(c => c.digest_enabled).length === 0}
              className="gap-2"
            >
              {triggerDigest.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              Enviar digest ahora
            </Button>
          </div>
        }
      />

      {/* Add panel */}
      {showAddPanel && availableOrgs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Empresas disponibles para vincular:</p>
            <div className="flex flex-wrap gap-2">
              {availableOrgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleAdd(org.id)}
                  disabled={addClient.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {org.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      )}

      {/* Stats */}
      {!isLoading && clients.length > 0 && <SummaryStats clients={clients} />}

      {/* Clients */}
      {!isLoading && clients.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t("clientCompanies")} ({clients.length})
            </h2>
            <span className="text-xs text-muted-foreground">
              {clients.filter(c => c.digest_enabled).length} {t("withDigest")}
            </span>
          </div>
          {clients.map(client => (
            <ClientCard
              key={client.org_id}
              client={client}
              onRemove={() => handleRemove(client.org_id, client.org_name)}
              onToggleDigest={(enabled) => handleToggle(client.org_id, enabled)}
              onToggleAlerts={(enabled) => handleToggleAlerts(client.org_id, enabled, client.org_name)}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && clients.length === 0 && (
        <Card>
          <EmptyState
            icon={Building2}
            title={t("noClientCompanies")}
            description="Agrega las empresas que gestionas como consultor para ver su salud consolidada y recibir el digest semanal."
            actionLabel="Agregar primera empresa"
            onAction={() => setShowAddPanel(true)}
          />
        </Card>
      )}

      {/* Info footer */}
      <Card className="p-4 bg-muted/30">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Digest automático:</strong> se envía cada lunes a las 7am (Lima) por email y Telegram, con el resumen consolidado de todas las empresas con digest activo.{" "}
          <strong>Alertas por cliente:</strong> cada empresa tiene su propia configuración de notificaciones en Ajustes → Notificaciones — estas se envían al dueño de cada organización de forma independiente.
        </p>
      </Card>
    </div>
  );
}
