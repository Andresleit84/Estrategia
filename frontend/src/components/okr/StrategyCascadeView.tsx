"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle, Compass, CalendarRange, Zap, Target,
  TrendingUp, ChevronDown, ChevronRight, Building2, Users,
  Lightbulb, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { useProblems, type Problem } from "@/hooks/useProblems";
import { useStrategicIntents, type StrategicIntent } from "@/hooks/useStrategicIntents";
import { useObjectives, type Objective } from "@/hooks/useObjectives";
import { type Cycle } from "@/hooks/useCycles";

// ── Types ─────────────────────────────────────────────────────────────────────

type LayerId = "problems" | "intents" | "strategic" | "annual" | "quarterly";

// ── Layer config ─────────────────────────────────────────────────────────────

const LAYERS: { id: LayerId; label: string; sublabel: string; icon: React.ElementType; accent: string; border: string; bg: string; dot: string }[] = [
  {
    id: "problems",
    label: "Diagnóstico",
    sublabel: "Problemas identificados",
    icon: AlertTriangle,
    accent: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    dot: "bg-rose-500",
  },
  {
    id: "intents",
    label: "Estrategia",
    sublabel: "Intenciones estratégicas",
    icon: Lightbulb,
    accent: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    dot: "bg-violet-500",
  },
  {
    id: "strategic",
    label: "OKR Estratégico",
    sublabel: "3–5 años",
    icon: Compass,
    accent: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    dot: "bg-indigo-500",
  },
  {
    id: "annual",
    label: "OKR Anual",
    sublabel: "Año fiscal",
    icon: CalendarRange,
    accent: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    dot: "bg-blue-500",
  },
  {
    id: "quarterly",
    label: "OKR Trimestral",
    sublabel: "Equipos · 90 días",
    icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    dot: "bg-amber-500",
  },
];

// ── Severity badge ────────────────────────────────────────────────────────────

const SEV_MAP = [
  "", // 0
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
];

const STATUS_LABEL: Record<string, string> = {
  IDENTIFIED: "Identificado", BEING_ADDRESSED: "En proceso",
  RESOLVED: "Resuelto", DEPRIORITIZED: "Desprioritizado",
  DRAFT: "Borrador", ACTIVE: "Activo", ACHIEVED: "Logrado", CANCELLED: "Cancelado",
  COMPLETED: "Completado",
};

const CATEGORY_ICON: Record<string, string> = {
  GROWTH: "📈", EFFICIENCY: "⚙️", CULTURE: "🤝", INNOVATION: "💡",
  SUSTAINABILITY: "♻️", OTHER: "•",
};

// ── Card components ───────────────────────────────────────────────────────────

function ProblemCard({
  p, active, dimmed, onClick,
}: { p: Problem; active: boolean; dimmed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border-2 p-3 transition-all duration-150",
        "bg-card hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
        active ? "border-rose-400 shadow-md ring-1 ring-rose-200 dark:ring-rose-800" : "border-border/50",
        dimmed && "opacity-30 pointer-events-none",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold leading-snug line-clamp-2 flex-1">{p.title}</p>
        <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full", SEV_MAP[p.severity] ?? SEV_MAP[3])}>
          S{p.severity}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{STATUS_LABEL[p.status] ?? p.status}</span>
        {p.intent_count > 0 && (
          <span className="flex items-center gap-0.5 text-violet-600 dark:text-violet-400 font-medium">
            {p.intent_count} intent{p.intent_count !== 1 ? "s" : ""}
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    </button>
  );
}

function IntentCard({
  i, active, dimmed, onClick,
}: { i: StrategicIntent; active: boolean; dimmed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border-2 p-3 transition-all duration-150",
        "bg-card hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
        active ? "border-violet-400 shadow-md ring-1 ring-violet-200 dark:ring-violet-800" : "border-border/50",
        dimmed && "opacity-30 pointer-events-none",
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base shrink-0 leading-tight">{CATEGORY_ICON[i.category ?? "OTHER"] ?? "•"}</span>
        <p className="text-xs font-semibold leading-snug line-clamp-2">{i.title}</p>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{i.target_year ? `Horizonte ${i.target_year}` : `${i.horizon_years} años`}</span>
        {i.aligned_objectives_count > 0 && (
          <span className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-medium">
            {i.aligned_objectives_count} OKR{i.aligned_objectives_count !== 1 ? "s" : ""}
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    </button>
  );
}

function OkrCard({
  obj, active, dimmed, accentClass, onClick, hasChildren,
}: {
  obj: Objective; active: boolean; dimmed: boolean;
  accentClass: string; onClick: () => void; hasChildren: boolean;
}) {
  const LevelIcon = obj.level === "COMPANY" ? Building2 : Users;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border-2 p-3 transition-all duration-150",
        "bg-card hover:shadow-md focus:outline-none",
        active ? `border-current shadow-md ${accentClass}` : "border-border/50",
        dimmed && "opacity-30 pointer-events-none",
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <ProgressRing progress={obj.progress} size={28} status={obj.status} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {obj.code && (
            <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{obj.code}</span>
          )}
          <p className="text-xs font-semibold leading-snug line-clamp-2">{obj.title}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className={cn("flex items-center gap-0.5", accentClass)}>
          <LevelIcon className="h-2.5 w-2.5" />
          {obj.level === "COMPANY" ? "Empresa" : obj.level === "AREA" ? "Área" : obj.level === "TEAM" ? "Equipo" : "Individual"}
        </span>
        {hasChildren && (
          <span className="flex items-center gap-0.5 font-medium text-muted-foreground">
            hijos <ArrowRight className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      {obj.owner_name && (
        <p className="text-[10px] text-muted-foreground mt-1 truncate">{obj.owner_name}</p>
      )}
    </button>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({
  layer, count, children, empty,
}: {
  layer: typeof LAYERS[number];
  count: number;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const Icon = layer.icon;
  return (
    <div className="flex flex-col w-[220px] shrink-0">
      {/* Column header */}
      <div className={cn("rounded-xl border p-3 mb-3", layer.border, layer.bg)}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20 shrink-0">
            <Icon className={cn("h-4 w-4", layer.accent)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-bold truncate", layer.accent)}>{layer.label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{layer.sublabel}</p>
          </div>
          <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-black/20", layer.accent)}>
            {count}
          </span>
        </div>
      </div>
      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {count === 0 ? empty : children}
      </div>
    </div>
  );
}

// ── Connector ─────────────────────────────────────────────────────────────────

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center w-8 shrink-0 mt-[52px]">
      <div className={cn(
        "w-full h-px transition-colors",
        active ? "bg-primary" : "bg-border/50"
      )} />
      <ArrowRight className={cn("h-3 w-3 -mt-1.5 transition-colors", active ? "text-primary" : "text-border/50")} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function ColumnEmpty({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-3 text-center rounded-xl border border-dashed border-border/40">
      <Target className="h-6 w-6 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sublabel}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  cycles: Cycle[];
}

export function StrategyCascadeView({ cycles }: Props) {
  const strategicCycle = cycles.find(c => c.type === "CUSTOM"    && c.status === "ACTIVE");
  const annualCycle    = cycles.find(c => c.type === "ANNUAL"    && c.status === "ACTIVE");
  const quarterlyCycle = cycles.find(c => c.type === "QUARTERLY" && c.status === "ACTIVE");

  const { data: problems  = [] } = useProblems();
  const { data: intents   = [] } = useStrategicIntents();
  const { data: stratObjs = [] } = useObjectives(strategicCycle?.id);
  const { data: annualObjs= [] } = useObjectives(annualCycle?.id);
  const { data: quarterlyObjs = [] } = useObjectives(quarterlyCycle?.id);

  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<LayerId | null>(null);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  // Build parent→children maps for OKR connections
  const annualByParent    = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const o of annualObjs) {
      if (o.parent_objective_id) {
        const arr = m.get(o.parent_objective_id) ?? [];
        arr.push(o.id);
        m.set(o.parent_objective_id, arr);
      }
    }
    return m;
  }, [annualObjs]);

  const quarterlyByParent = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const o of quarterlyObjs) {
      if (o.parent_objective_id) {
        const arr = m.get(o.parent_objective_id) ?? [];
        arr.push(o.id);
        m.set(o.parent_objective_id, arr);
      }
    }
    return m;
  }, [quarterlyObjs]);

  // Determine which IDs are connected to the active selection
  const connectedIds = useMemo<Set<string>>(() => {
    if (!activeId || !activeLayer) return new Set();
    const s = new Set<string>();

    if (activeLayer === "strategic") {
      // strategic → annual children
      (annualByParent.get(activeId) ?? []).forEach(id => s.add(id));
    }
    if (activeLayer === "annual") {
      // annual → quarterly children
      (quarterlyByParent.get(activeId) ?? []).forEach(id => s.add(id));
      // annual → strategic parent
      const o = annualObjs.find(x => x.id === activeId);
      if (o?.parent_objective_id) s.add(o.parent_objective_id);
    }
    if (activeLayer === "quarterly") {
      // quarterly → annual parent
      const o = quarterlyObjs.find(x => x.id === activeId);
      if (o?.parent_objective_id) s.add(o.parent_objective_id);
    }
    return s;
  }, [activeId, activeLayer, annualByParent, quarterlyByParent, annualObjs, quarterlyObjs]);

  function handleClick(id: string, layer: LayerId) {
    if (activeId === id) { setActiveId(null); setActiveLayer(null); }
    else { setActiveId(id); setActiveLayer(layer); }
  }

  function isDimmed(id: string, layer: LayerId): boolean {
    if (!activeId) return false;
    if (id === activeId) return false;
    if (connectedIds.has(id)) return false;
    if (activeLayer === layer) return false; // same column → never dim
    return true;
  }

  // Legend for layers with no active cycle
  const missingCycles: string[] = [];
  if (!strategicCycle) missingCycles.push("estratégico (3-5 años)");
  if (!annualCycle) missingCycles.push("anual");
  if (!quarterlyCycle) missingCycles.push("trimestral");

  return (
    <div className="flex flex-col gap-4">
      {/* Legend bar */}
      <div className="flex items-center gap-4 flex-wrap">
        {LAYERS.map(l => (
          <span key={l.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full shrink-0", l.dot)} />
            {l.label}
          </span>
        ))}
        {activeId && (
          <button
            onClick={() => { setActiveId(null); setActiveLayer(null); }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Limpiar selección
          </button>
        )}
      </div>

      {missingCycles.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Sin ciclo activo para: {missingCycles.join(", ")}. Activa los ciclos para ver todos los niveles.
        </div>
      )}

      {/* Cascade grid */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-2 min-w-max">

          {/* ── Problemas ── */}
          <Column
            layer={LAYERS[0]}
            count={problems.filter(p => p.status !== "RESOLVED").length}
            empty={<ColumnEmpty label="Sin problemas registrados" sublabel="Ve a Diagnóstico para identificar problemas" />}
          >
            {problems.filter(p => p.status !== "RESOLVED").map(p => (
              <ProblemCard
                key={p.id} p={p}
                active={activeId === p.id}
                dimmed={isDimmed(p.id, "problems")}
                onClick={() => handleClick(p.id, "problems")}
              />
            ))}
          </Column>

          <Connector active={!!activeId && activeLayer === "problems"} />

          {/* ── Intenciones ── */}
          <Column
            layer={LAYERS[1]}
            count={intents.filter(i => i.status === "ACTIVE").length}
            empty={<ColumnEmpty label="Sin intenciones activas" sublabel="Ve a Estrategia para definirlas" />}
          >
            {intents.filter(i => i.status === "ACTIVE").map(i => (
              <IntentCard
                key={i.id} i={i}
                active={activeId === i.id}
                dimmed={isDimmed(i.id, "intents")}
                onClick={() => handleClick(i.id, "intents")}
              />
            ))}
          </Column>

          <Connector active={!!activeId && activeLayer === "intents"} />

          {/* ── OKR Estratégico ── */}
          <Column
            layer={LAYERS[2]}
            count={stratObjs.filter(o => o.status !== "CANCELLED").length}
            empty={
              <ColumnEmpty
                label={strategicCycle ? "Sin OKRs estratégicos" : "Sin ciclo estratégico activo"}
                sublabel={strategicCycle ? "Crea el primer objetivo estratégico" : "Activa un ciclo de tipo Estratégico"}
              />
            }
          >
            {stratObjs.filter(o => o.status !== "CANCELLED").map(o => (
              <OkrCard
                key={o.id} obj={o}
                active={activeId === o.id}
                dimmed={isDimmed(o.id, "strategic")}
                accentClass={LAYERS[2].accent}
                onClick={() => handleClick(o.id, "strategic")}
                hasChildren={(annualByParent.get(o.id)?.length ?? 0) > 0}
              />
            ))}
          </Column>

          <Connector active={!!activeId && (activeLayer === "strategic" || (activeLayer === "annual" && !!annualObjs.find(o => o.id === activeId)?.parent_objective_id))} />

          {/* ── OKR Anual ── */}
          <Column
            layer={LAYERS[3]}
            count={annualObjs.filter(o => o.status !== "CANCELLED").length}
            empty={
              <ColumnEmpty
                label={annualCycle ? "Sin OKRs anuales" : "Sin ciclo anual activo"}
                sublabel={annualCycle ? "Crea el primer objetivo anual" : "Activa un ciclo de tipo Anual"}
              />
            }
          >
            {annualObjs.filter(o => o.status !== "CANCELLED").map(o => {
              const isConnectedToActive = connectedIds.has(o.id);
              return (
                <OkrCard
                  key={o.id} obj={o}
                  active={activeId === o.id || isConnectedToActive}
                  dimmed={isDimmed(o.id, "annual")}
                  accentClass={LAYERS[3].accent}
                  onClick={() => handleClick(o.id, "annual")}
                  hasChildren={(quarterlyByParent.get(o.id)?.length ?? 0) > 0}
                />
              );
            })}
          </Column>

          <Connector active={!!activeId && (activeLayer === "annual" || (activeLayer === "quarterly" && !!quarterlyObjs.find(o => o.id === activeId)?.parent_objective_id))} />

          {/* ── OKR Trimestral ── */}
          <Column
            layer={LAYERS[4]}
            count={quarterlyObjs.filter(o => o.status !== "CANCELLED").length}
            empty={
              <ColumnEmpty
                label={quarterlyCycle ? "Sin OKRs trimestrales" : "Sin ciclo trimestral activo"}
                sublabel={quarterlyCycle ? "Los equipos aún no crearon OKRs" : "Activa un ciclo de tipo Trimestral"}
              />
            }
          >
            {quarterlyObjs.filter(o => o.status !== "CANCELLED").map(o => {
              const isConnectedToActive = connectedIds.has(o.id);
              return (
                <OkrCard
                  key={o.id} obj={o}
                  active={activeId === o.id || isConnectedToActive}
                  dimmed={isDimmed(o.id, "quarterly")}
                  accentClass={LAYERS[4].accent}
                  onClick={() => handleClick(o.id, "quarterly")}
                  hasChildren={false}
                />
              );
            })}
          </Column>

        </div>
      </div>

      {/* Connection hint */}
      {!activeId && (
        <p className="text-[11px] text-muted-foreground/60 text-center">
          Haz clic en cualquier elemento para ver sus conexiones en la cascada
        </p>
      )}
      {activeId && activeLayer && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" />
          {connectedIds.size > 0
            ? `${connectedIds.size} elemento${connectedIds.size !== 1 ? "s" : ""} conectado${connectedIds.size !== 1 ? "s" : ""} resaltado${connectedIds.size !== 1 ? "s" : ""}`
            : "Este elemento no tiene conexiones directas registradas en los niveles adyacentes"
          }
        </div>
      )}
    </div>
  );
}
