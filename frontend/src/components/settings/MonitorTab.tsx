"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSystemStatus, useRunTests, type AgentStatus, type ServiceStatus } from "@/hooks/useSystemStatus";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Activity, Bot, CheckCircle2, XCircle, Clock,
  Cpu, MemoryStick, AlertTriangle, MessageCircle, Server, Globe,
  Database, Zap, TestTube, Shield, Radio, Users, Gauge,
  FlaskConical, Play, Loader2,
} from "lucide-react";
import type { TestCategory, LoadScenario, FailedTest } from "@/hooks/useSystemStatus";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number | null) {
  if (b == null) return "—";
  return `${Math.round(b / 1024 / 1024)} MB`;
}

function fmtUptime(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `hace ${s}s`;
  if (s < 3600)  return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}

// ── Status indicators ─────────────────────────────────────────────────────────

type StatusLevel = "online" | "offline" | "degraded" | "stopped" | "errored" | "unknown";

const STATUS_CONFIG: Record<StatusLevel, { label: string; dot: string; badge: string }> = {
  online:   { label: "Activo",      dot: "bg-green-500",  badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  degraded: { label: "Degradado",   dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  offline:  { label: "Caído",       dot: "bg-red-500 animate-pulse",    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  stopped:  { label: "Detenido",    dot: "bg-gray-400",   badge: "bg-muted text-muted-foreground" },
  errored:  { label: "Error",       dot: "bg-red-500 animate-pulse",    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  unknown:  { label: "Desconocido", dot: "bg-gray-300",   badge: "bg-muted text-muted-foreground" },
};

function StatusDot({ status }: { status: StatusLevel }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", cfg.dot)} />;
}

function StatusBadge({ status }: { status: StatusLevel }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return <Badge className={cn("text-xs font-medium", cfg.badge)}>{cfg.label}</Badge>;
}

// ── Service Card ──────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "okr-backend":  Server,
  "okr-frontend": Globe,
};

function ServiceCard({ svc }: { svc: ServiceStatus }) {
  const Icon = SERVICE_ICONS[svc.id] ?? Server;
  const status: StatusLevel = VALID_STATUS_LEVELS.has(svc.status as StatusLevel)
    ? (svc.status as StatusLevel)
    : "unknown";

  return (
    <Card className={cn(
      "p-4 space-y-3 border-l-4",
      status === "online"   && "border-l-green-500",
      status === "degraded" && "border-l-amber-500",
      status === "offline"  && "border-l-red-500",
      status === "unknown"  && "border-l-gray-300",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center",
            status === "online"   && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            status === "degraded" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            status === "offline"  && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            status === "unknown"  && "bg-muted text-muted-foreground",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{svc.name}</p>
            {svc.instances > 0 && (
              <p className="text-xs text-muted-foreground">{svc.instances} instancia{svc.instances > 1 ? "s" : ""}</p>
            )}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-xs text-muted-foreground">{svc.description}</p>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {svc.uptime != null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {fmtUptime(svc.uptime)}
          </span>
        )}
        {svc.memory != null && (
          <span className="flex items-center gap-1">
            <MemoryStick className="h-3 w-3" /> {fmtBytes(svc.memory)}
          </span>
        )}
        {svc.cpu != null && (
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" /> {svc.cpu}% CPU
          </span>
        )}
      </div>

      {svc.checks.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t">
          {svc.checks.map((c) => (
            <span key={c.key} className={cn(
              "flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5",
              c.status === "ok"
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            )}>
              {c.status === "ok"
                ? <CheckCircle2 className="h-3 w-3" />
                : <XCircle className="h-3 w-3" />}
              {c.key}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────

const AGENT_ICONS: Record<string, React.ElementType> = {
  "okr-monitor":    Radio,
  "okr-test-agent": TestTube,
  "okr-super-agent": Shield,
};

const VALID_STATUS_LEVELS = new Set<StatusLevel>(["online", "offline", "degraded", "stopped", "errored", "unknown"]);

function AgentCard({ agent }: { agent: AgentStatus }) {
  const Icon = AGENT_ICONS[agent.id] ?? Bot;
  const status: StatusLevel = VALID_STATUS_LEVELS.has(agent.status as StatusLevel)
    ? (agent.status as StatusLevel)
    : "unknown";

  const isDown = status === "offline" || status === "errored" || status === "unknown";

  return (
    <Card className={cn(
      "p-4 space-y-3",
      isDown && "border-amber-300 dark:border-amber-800",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center",
            status === "online"  && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            status === "stopped" && "bg-muted text-muted-foreground",
            isDown               && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{agent.name}</p>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {agent.uptime != null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {fmtUptime(agent.uptime)}
          </span>
        )}
        {agent.memory != null && (
          <span className="flex items-center gap-1">
            <MemoryStick className="h-3 w-3" /> {fmtBytes(agent.memory)}
          </span>
        )}
        {agent.cpu != null && (
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" /> {agent.cpu}% CPU
          </span>
        )}
        {agent.restarts > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <RefreshCw className="h-3 w-3" /> {agent.restarts} reinicios
          </span>
        )}
      </div>

      {agent.lastEvent && (
        <p className="text-[11px] text-muted-foreground border-t pt-2">
          Última actividad: {relativeTime(agent.lastEvent)}
        </p>
      )}

      {isDown && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            {agent.status === "stopped"
              ? "Agente detenido. Inicia con: pm2 start ecosystem.config.js"
              : "Agente no disponible. Revisa los logs con: pm2 logs " + agent.id}
          </p>
        </div>
      )}
    </Card>
  );
}

// ── Tests Panel helpers ───────────────────────────────────────────────────────

function CategoryRow({ icon: Icon, label, cat }: {
  icon: React.ElementType;
  label: string;
  cat: TestCategory;
}) {
  const [open, setOpen] = React.useState(false);
  const pct = cat.total > 0 ? Math.round((cat.passed / cat.total) * 100) : 0;
  const ok  = cat.failed === 0 && cat.total > 0;
  const hasFailedTests = (cat.failedTests?.length ?? 0) > 0;

  return (
    <div className="space-y-1.5">
      <button
        className="w-full flex items-center gap-3 text-left"
        onClick={() => hasFailedTests && setOpen((v) => !v)}
        disabled={!hasFailedTests}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs w-24 shrink-0 text-foreground">{label}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-0">
          <div
            className={cn("h-full rounded-full transition-all duration-500", ok ? "bg-green-500" : "bg-red-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground w-14 text-right shrink-0">
          {cat.passed}/{cat.total}
        </span>
        {ok
          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          : <XCircle      className="h-3.5 w-3.5 text-red-500  shrink-0 cursor-pointer" />}
      </button>
      {open && hasFailedTests && (
        <div className="ml-7 space-y-1.5">
          {cat.failedTests.map((t, i) => (
            <div key={i} className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-2.5 py-1.5 space-y-0.5">
              <p className="text-[11px] font-medium text-foreground leading-snug">{t.name}</p>
              {t.error && (
                <p className="text-[10px] font-mono text-red-700 dark:text-red-400 break-all leading-snug">{t.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const LOAD_LABELS: Record<string, string> = {
  health:     "Health check",
  objectives: "Objetivos",
  dashboard:  "Dashboard",
  checkins:   "Check-ins",
  agreements: "Acuerdos",
};

function LoadRow({ name, s }: { name: string; s: LoadScenario }) {
  const rpsLabel = s.topRps >= 1000
    ? `${(s.topRps / 1000).toFixed(1)}k/s`
    : `${s.topRps}/s`;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-foreground">{LOAD_LABELS[name] ?? name}</span>
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium shrink-0",
        s.ok
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      )}>
        <Users className="h-3 w-3" />
        {s.maxOkUsers > 0 ? `${s.maxOkUsers} usuarios` : "< 1 usuario"}
      </span>
      <span className="ml-auto text-muted-foreground tabular-nums">{rpsLabel}</span>
      <span className="text-muted-foreground tabular-nums w-16 text-right shrink-0">p99 {s.topP99}ms</span>
    </div>
  );
}

// ── Tests Panel ───────────────────────────────────────────────────────────────

function TestsPanel({ tests }: { tests: NonNullable<ReturnType<typeof useSystemStatus>["data"]>["tests"] }) {
  if (tests.running) {
    return (
      <Card className="p-4 flex items-center gap-3 border-l-4 border-l-blue-500">
        <Loader2 className="h-5 w-5 shrink-0 text-blue-500 animate-spin" />
        <div>
          <p className="text-sm font-medium">Ejecutando pruebas…</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            La suite completa tarda entre 2 y 5 minutos. Esta página se actualizará automáticamente al terminar.
          </p>
        </div>
      </Card>
    );
  }

  if (!tests.lastRun) {
    return (
      <Card className="p-4 flex items-start gap-3">
        <TestTube className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <div>
          <p className="text-sm font-medium">Sin datos de tests</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            El Test Agent aún no ha ejecutado una prueba. Se ejecutará automáticamente a las 02:00 AM.
          </p>
        </div>
      </Card>
    );
  }

  const allOk = tests.passed === true;

  return (
    <div className="space-y-3">

      {/* ── Estado global ──────────────────────────────────────────────────── */}
      <Card className={cn("p-4 border-l-4", allOk ? "border-l-green-500" : "border-l-red-500")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {allOk
              ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              : <XCircle      className="h-5 w-5 text-red-600   dark:text-red-400   shrink-0" />}
            <p className="text-sm font-semibold">
              {allOk ? "Todos los tests pasaron" : `${tests.numFailed} tests fallaron`}
            </p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{relativeTime(tests.lastRun)}</span>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground">{tests.numPassed}</span>
          <span>pasaron</span>
          {tests.numFailed > 0 && (
            <>
              <span className="tabular-nums font-medium text-red-600 dark:text-red-400">{tests.numFailed}</span>
              <span>fallaron</span>
            </>
          )}
          <span className="ml-auto">{tests.numTests} tests · {tests.duration}s</span>
        </div>

        {tests.failedTests && tests.failedTests.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <p className="text-xs font-medium text-destructive">Tests fallidos:</p>
            {tests.failedTests.map((t, i) => (
              <div key={i} className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 space-y-0.5">
                <p className="text-xs font-medium text-foreground leading-snug">
                  <span className="text-muted-foreground font-normal">{t.suite} › </span>{t.name}
                </p>
                {t.error && (
                  <p className="text-[11px] font-mono text-red-700 dark:text-red-400 break-all leading-snug">{t.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Desglose por tipo ──────────────────────────────────────────────── */}
      {tests.categories && (
        <Card className="p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Tipos de prueba
          </p>
          <div className="space-y-2.5">
            <CategoryRow icon={FlaskConical} label="Unitarios"    cat={tests.categories.unit} />
            <CategoryRow icon={Database}     label="Integridad DB" cat={tests.categories.integrity} />
            <CategoryRow icon={Globe}        label="HTTP Contract" cat={tests.categories.http} />
          </div>
        </Card>
      )}

      {/* ── Prueba de carga ────────────────────────────────────────────────── */}
      {tests.load?.ran && Object.keys(tests.load.scenarios).length > 0 && (() => {
        const scenarios   = Object.values(tests.load.scenarios);
        const minOkUsers  = Math.min(...scenarios.map((s) => s.maxOkUsers));
        const worstP99    = Math.max(...scenarios.map((s) => s.topP99));
        // Conservative capacity estimate using Little's Law:
        // real users = tested_connections × (think_time + p99) / p99
        // think_time = 5000ms (real user pauses between actions)
        const THINK_MS       = 5_000;
        const realUsersRaw   = Math.floor(minOkUsers * (THINK_MS + worstP99) / worstP99);
        // Floor to nearest 50 and cap at 1000 to stay credible
        const realUsers      = Math.min(Math.floor(realUsersRaw / 50) * 50, 1000);
        const allScenariosOk = scenarios.every((s) => s.ok);

        return (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Prueba de carga
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{relativeTime(tests.load.lastRun)}</span>
            </div>

            <div className="space-y-2">
              {Object.entries(tests.load.scenarios).map(([name, s]) => (
                <LoadRow key={name} name={name} s={s} />
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t">
              Conexiones simultáneas continuas sin errores (p99 &lt; 800ms)
            </p>

            {/* Capacidad real estimada */}
            <div className={cn(
              "mt-3 rounded-lg p-3 flex items-start gap-3",
              allScenariosOk
                ? "bg-green-50 dark:bg-green-950/30"
                : "bg-amber-50 dark:bg-amber-950/30",
            )}>
              <Users className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                allScenariosOk ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400",
              )} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Capacidad estimada en uso real
                </p>
                <p className={cn(
                  "text-lg font-bold tabular-nums mt-0.5",
                  allScenariosOk ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300",
                )}>
                  ~{realUsers.toLocaleString()}+ usuarios activos simultáneos
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                  El test mide peticiones continuas sin pausa. Un usuario real hace
                  ~1 petición cada 5 s, por lo que ocupa el servidor el {Math.round(worstP99 / (THINK_MS + worstP99) * 100)}% del tiempo.
                  Estimación conservadora basada en worst-case p99 ({worstP99} ms).
                </p>
              </div>
            </div>
          </Card>
        );
      })()}

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MonitorTab() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, dataUpdatedAt } = useSystemStatus();
  const runTests = useRunTests();

  function refresh() {
    qc.invalidateQueries({ queryKey: ["system", "status"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-8 text-center space-y-2">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">No se pudo obtener el estado del sistema</p>
        <p className="text-xs text-muted-foreground">Solo los administradores pueden ver esta sección.</p>
      </Card>
    );
  }

  const allServicesUp  = data.services.every((s)  => s.status === "online" || s.status === "degraded");
  const allAgentsUp    = data.agents.every((a) => a.status === "online" || a.status === "stopped");
  const anyDown        = !allServicesUp || data.agents.some((a) => a.status === "errored" || a.status === "unknown");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={anyDown ? "offline" : "online"} />
          <span className="text-sm font-medium">
            {anyDown ? "Algunos componentes necesitan atención" : "Sistema operativo — todo en orden"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Actualizado {relativeTime(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={refresh} disabled={isFetching} className="h-7 px-2">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Services */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Servicios</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.services.map((svc) => (
            <ServiceCard key={svc.id} svc={svc} />
          ))}
        </div>
      </section>

      {/* Agents */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Agentes de automatización</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {data.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      {/* Tests */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TestTube className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Suite de tests automatizados</h3>
            {data.tests.lastRun && !data.tests.running && (
              <span className="text-xs text-muted-foreground">
                · {data.tests.numTests} tests · {data.tests.numPassed} pasaron
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant={data.tests.running ? "outline" : "default"}
            disabled={data.tests.running || runTests.isPending}
            onClick={() => runTests.mutate()}
            className="h-7 px-3 text-xs gap-1.5 shrink-0"
          >
            {data.tests.running || runTests.isPending
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Play className="h-3 w-3" />}
            {data.tests.running ? "Ejecutando…" : "Ejecutar ahora"}
          </Button>
        </div>
        <TestsPanel tests={data.tests} />
      </section>

      {/* Telegram */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Notificaciones Telegram</h3>
        </div>
        <Card className={cn(
          "p-4 flex items-start gap-3 border-l-4",
          data.telegram.configured ? "border-l-green-500" : "border-l-amber-500",
        )}>
          {data.telegram.configured ? (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Bot de Telegram configurado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  El Super Agent enviará alertas automáticas cuando un servicio se caiga, cuando los tests fallen o cuando un agente necesite atención.
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Telegram no configurado</p>
                <p className="text-xs text-muted-foreground">
                  Para recibir notificaciones automáticas, agrega las siguientes variables a tu archivo <code className="font-mono text-[11px]">backend/.env</code>:
                </p>
                <div className="rounded-md bg-muted px-3 py-2 font-mono text-[11px] space-y-0.5">
                  <p>TELEGRAM_BOT_TOKEN=<span className="text-muted-foreground">tu_token_de_botfather</span></p>
                  <p>TELEGRAM_CHAT_ID=<span className="text-muted-foreground">tu_chat_id</span></p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Crea tu bot en Telegram con <code className="font-mono text-[11px]">@BotFather</code> → <code className="font-mono text-[11px]">/newbot</code>. Luego envía un mensaje al bot y visita <code className="font-mono text-[11px]">getUpdates</code> para obtener tu chat_id.
                </p>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Infrastructure summary */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Infraestructura</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Backend",  icon: Server,   check: data.services.find((s) => s.id === "okr-backend")?.checks.find((c) => c.key === "API") },
            { label: "Database", icon: Database, check: data.services.find((s) => s.id === "okr-backend")?.checks.find((c) => c.key === "Base de datos") },
            { label: "Redis",    icon: Zap,      check: data.services.find((s) => s.id === "okr-backend")?.checks.find((c) => c.key === "Redis") },
            { label: "Frontend", icon: Globe,    check: { key: "Frontend", status: data.services.find((s) => s.id === "okr-frontend")?.status === "online" ? "ok" : "error" } },
          ].map(({ label, icon: Icon, check }) => (
            <div key={label} className={cn(
              "rounded-lg border p-3 flex flex-col items-center gap-1.5 text-center",
              check?.status === "ok" ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"
            )}>
              <Icon className={cn("h-4 w-4", check?.status === "ok" ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400")} />
              <p className="text-xs font-medium">{label}</p>
              <span className={cn("text-[10px]", check?.status === "ok" ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400")}>
                {check?.status === "ok" ? "OK" : "ERROR"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
