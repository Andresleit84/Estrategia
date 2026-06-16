"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConsultantClients,
  useAddConsultantClient,
  useRemoveConsultantClient,
  useToggleConsultantDigest,
  useToggleClientAlerts,
  useTriggerConsultantDigest,
} from "@/hooks/useConsultant";
import { useMyOrgs } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, TrendingUp, TrendingDown, AlertTriangle,
  Send, Loader2, Plus, Trash2, Bell, BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ConsultantClientHealth } from "@/hooks/useConsultant";

// ── Client row ─────────────────────────────────────────────────────────────────

function ClientRow({
  client,
  onRemove,
  onToggleDigest,
  onToggleAlerts,
}: {
  client: ConsultantClientHealth;
  onRemove: () => void;
  onToggleDigest: (v: boolean) => void;
  onToggleAlerts: (v: boolean) => void;
}) {
  const pct = client.active_objectives > 0
    ? Math.round((client.on_track / client.active_objectives) * 100)
    : 0;

  const score = client.cycle_score;
  const scoreColor = score === null ? "text-muted-foreground"
    : score >= 7 ? "text-green-600 dark:text-green-400"
    : score >= 4 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      {/* Org name + cycle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{client.org_name}</span>
          {client.cycle_name && (
            <span className="text-xs text-muted-foreground hidden sm:inline truncate">· {client.cycle_name}</span>
          )}
        </div>
      </div>

      {/* Score */}
      <span className={cn("text-sm font-bold tabular-nums w-12 text-center shrink-0", scoreColor)}>
        {score !== null ? `${score}/10` : "—"}
      </span>

      {/* Progress */}
      <div className="hidden sm:flex items-center gap-1.5 w-20 shrink-0">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full", pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
      </div>

      {/* Warnings */}
      {(client.at_risk > 0 || client.krs_at_risk > 0) && (
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {client.at_risk > 0 && (
            <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {client.at_risk} rezag.
            </Badge>
          )}
          {client.krs_at_risk > 0 && (
            <Badge className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {client.krs_at_risk} KRs
            </Badge>
          )}
        </div>
      )}

      {/* Toggles */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onToggleDigest(!client.digest_enabled)}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
            client.digest_enabled
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-muted text-muted-foreground border-border hover:border-primary/30"
          )}
          title="Incluir en mi digest semanal"
        >
          <Bell className="h-2.5 w-2.5" /> Digest
        </button>
        <button
          onClick={() => onToggleAlerts(!client.client_alerts_enabled)}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
            client.client_alerts_enabled
              ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-400/30"
              : "bg-muted text-muted-foreground border-border hover:border-green-400/30"
          )}
          title={client.client_alerts_enabled
            ? "El cliente puede configurar sus alertas — click para desactivar"
            : "El cliente no ve el panel de alertas — click para activar"}
        >
          {client.client_alerts_enabled
            ? <><Bell className="h-2.5 w-2.5" /> Alertas</>
            : <><BellOff className="h-2.5 w-2.5" /> Alertas</>}
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors shrink-0"
        title="Desvincular cliente"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main section ───────────────────────────────────────────────────────────────

export function ConsultantNotificationsSection() {
  const { data: clients = [], isLoading } = useConsultantClients();
  const { data: myOrgs = [] } = useMyOrgs();
  const { user } = useAuth();
  const addClient        = useAddConsultantClient();
  const removeClient     = useRemoveConsultantClient();
  const toggleDigest     = useToggleConsultantDigest();
  const toggleAlerts     = useToggleClientAlerts();
  const triggerDigest    = useTriggerConsultantDigest();
  const [showAdd, setShowAdd] = useState(false);

  const linkedIds      = new Set(clients.map(c => c.org_id));
  // Exclude own current org and already-linked orgs
  const availableOrgs  = myOrgs.filter(o => o.id !== user?.organization_id && !linkedIds.has(o.id));
  const digestActive   = clients.filter(c => c.digest_enabled).length;
  const alertsActive   = clients.filter(c => c.client_alerts_enabled).length;

  const totalAtRisk    = clients.reduce((s, c) => s + c.at_risk, 0);
  const totalKrs       = clients.reduce((s, c) => s + c.krs_at_risk, 0);

  async function handleAdd(orgId: string) {
    try {
      await addClient.mutateAsync(orgId);
      toast.success("Cliente vinculado");
      setShowAdd(false);
    } catch { toast.error("No se pudo vincular"); }
  }
  async function handleRemove(orgId: string, name: string) {
    try {
      await removeClient.mutateAsync(orgId);
      toast.success(`${name} desvinculado`);
    } catch { toast.error("Error al desvincular"); }
  }
  async function handleToggleDigest(orgId: string, enabled: boolean, name: string) {
    try {
      await toggleDigest.mutateAsync({ orgId, enabled });
      toast.success(enabled ? `${name} incluida en el digest` : `${name} quitada del digest`);
    }
    catch { toast.error("No se pudo actualizar"); }
  }
  async function handleToggleAlerts(orgId: string, enabled: boolean, name: string) {
    try {
      await toggleAlerts.mutateAsync({ orgId, enabled });
      toast.success(
        enabled ? `Alertas habilitadas para ${name}` : `Alertas desactivadas para ${name}`,
        { description: enabled
          ? "El cliente ya puede configurar sus alertas en sus Ajustes"
          : undefined }
      );
    } catch { toast.error("No se pudo actualizar"); }
  }
  async function handleTrigger() {
    const id = "digest-trigger";
    toast.loading("Enviando digest…", { id });
    try {
      const res = await triggerDigest.mutateAsync();
      if (res.ok) {
        toast.success("Digest enviado", { id, description: `Canales: ${res.sent_channels.join(", ")}` });
      } else {
        toast.warning("Sin clientes con digest activo", { id });
      }
    } catch { toast.error("Error al enviar", { id }); }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-500" />
            Modo consultor — empresas cliente
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestiona tus clientes y controla dos tipos de notificaciones independientes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {availableOrgs.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setShowAdd(v => !v)}>
              <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={handleTrigger}
            disabled={triggerDigest.isPending || digestActive === 0}
          >
            {triggerDigest.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Send className="h-3.5 w-3.5" />}
            Enviar digest
          </Button>
        </div>
      </div>

      {/* Explanation chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs bg-primary/5 border border-primary/20 rounded-full px-3 py-1">
          <Bell className="h-3 w-3 text-primary" />
          <span><strong>Digest</strong> — incluye esta empresa en tu resumen semanal de consultor</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs bg-green-500/5 border border-green-400/20 rounded-full px-3 py-1">
          <Bell className="h-3 w-3 text-green-600" />
          <span><strong>Alertas</strong> — habilita que el cliente configure sus propias alertas</span>
        </div>
      </div>

      {/* Stats */}
      {clients.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{clients.length}</strong> clientes</span>
          <span><strong className="text-primary">{digestActive}</strong> con digest</span>
          <span><strong className="text-green-600 dark:text-green-400">{alertsActive}</strong> con alertas activas</span>
          {totalAtRisk > 0 && (
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-amber-500" />
              <strong className="text-amber-600 dark:text-amber-400">{totalAtRisk}</strong> rezagados
            </span>
          )}
          {totalKrs > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <strong className="text-red-600 dark:text-red-400">{totalKrs}</strong> KRs en riesgo
            </span>
          )}
        </div>
      )}

      {/* Add panel */}
      {showAdd && availableOrgs.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Selecciona empresa para vincular:</p>
            <div className="flex flex-wrap gap-2">
              {availableOrgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleAdd(org.id)}
                  disabled={addClient.isPending}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> {org.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client list */}
      {isLoading ? (
        <div className="space-y-2">
          {[0,1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : clients.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          Sin empresas cliente vinculadas.{" "}
          {availableOrgs.length > 0
            ? <button className="text-primary hover:underline" onClick={() => setShowAdd(true)}>Agregar la primera</button>
            : "Asegúrate de tener una cuenta en cada empresa cliente."}
        </p>
      ) : (
        <Card>
          <CardContent className="px-4 py-0">
            {/* Table header */}
            <div className="flex items-center gap-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              <div className="flex-1">Empresa</div>
              <div className="w-12 text-center shrink-0">Score</div>
              <div className="w-20 hidden sm:block shrink-0">Progreso</div>
              <div className="hidden md:block w-24 shrink-0">Alertas</div>
              <div className="w-28 text-center shrink-0">Notificaciones</div>
              <div className="w-6 shrink-0" />
            </div>
            {clients.map(client => (
              <ClientRow
                key={client.org_id}
                client={client}
                onRemove={() => handleRemove(client.org_id, client.org_name)}
                onToggleDigest={(v) => handleToggleDigest(client.org_id, v, client.org_name)}
                onToggleAlerts={(v) => handleToggleAlerts(client.org_id, v, client.org_name)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
