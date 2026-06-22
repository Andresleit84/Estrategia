"use client";

import { useState, useRef, useLayoutEffect, useMemo, useEffect, useCallback } from "react";
import {
  AlertTriangle, Lightbulb, Compass, CalendarRange,
  Building2, Users, Target, Network, Zap, Rocket, Layers, Code2, FileText,
  Pencil, ClipboardCheck, ZoomIn, ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { TraceabilityCheckInDrawer } from "@/components/okr/TraceabilityCheckInDrawer";
import { useProblemIntents } from "@/hooks/useProblems";
import {
  useIntentProblems,
  useIntentObjectives,
} from "@/hooks/useStrategicIntents";
import { useObjectiveAlignments } from "@/hooks/useObjectives";
import type { Objective } from "@/hooks/useObjectives";
import type { Initiative, ObjectiveInitiativeLink } from "@/hooks/useInitiatives";
import type { Cycle } from "@/hooks/useCycles";

// ── Types ─────────────────────────────────────────────────────────────────────

type LayerId = "problems" | "intents" | "strategic" | "annual" | "quarterly" | "initiatives" | "epics" | "features" | "stories";

interface Point { x: number; y: number }

const LAYER_ORDER: LayerId[] = ["problems", "intents", "strategic", "annual", "quarterly", "initiatives", "epics", "features", "stories"];

// ── Config ────────────────────────────────────────────────────────────────────

const LAYER_CFG: Record<LayerId, {
  label: string; sublabel: string; Icon: React.ElementType;
  accent: string; border: string; bg: string; dot: string;
  activeBorder: string; lineColor: string;
}> = {
  problems: {
    label: "Diagnóstico",
    sublabel: "Problemas identificados",
    Icon: AlertTriangle,
    accent: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    dot: "bg-rose-500",
    activeBorder: "border-rose-400",
    lineColor: "#fb7185",
  },
  intents: {
    label: "Estrategia",
    sublabel: "Intenciones estratégicas",
    Icon: Lightbulb,
    accent: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    dot: "bg-violet-500",
    activeBorder: "border-violet-400",
    lineColor: "#a78bfa",
  },
  strategic: {
    label: "OKR Estratégico",
    sublabel: "Largo plazo",
    Icon: Compass,
    accent: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    dot: "bg-indigo-500",
    activeBorder: "border-indigo-400",
    lineColor: "#818cf8",
  },
  annual: {
    label: "OKR Anual",
    sublabel: "Año fiscal",
    Icon: CalendarRange,
    accent: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    dot: "bg-blue-500",
    activeBorder: "border-blue-400",
    lineColor: "#60a5fa",
  },
  quarterly: {
    label: "OKR Trimestral",
    sublabel: "Equipos · 90 días",
    Icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    dot: "bg-amber-500",
    activeBorder: "border-amber-400",
    lineColor: "#fbbf24",
  },
  initiatives: {
    label: "Iniciativa",
    sublabel: "En ejecución",
    Icon: Rocket,
    accent: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    dot: "bg-emerald-500",
    activeBorder: "border-emerald-400",
    lineColor: "#34d399",
  },
  epics: {
    label: "Épica",
    sublabel: "Backlog estratégico",
    Icon: Layers,
    accent: "text-teal-600 dark:text-teal-400",
    border: "border-teal-200 dark:border-teal-800",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    dot: "bg-teal-500",
    activeBorder: "border-teal-400",
    lineColor: "#2dd4bf",
  },
  features: {
    label: "Feature",
    sublabel: "Funcionalidades",
    Icon: Code2,
    accent: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-200 dark:border-cyan-800",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    dot: "bg-cyan-500",
    activeBorder: "border-cyan-400",
    lineColor: "#22d3ee",
  },
  stories: {
    label: "Historia",
    sublabel: "Historias de usuario",
    Icon: FileText,
    accent: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    dot: "bg-purple-500",
    activeBorder: "border-purple-400",
    lineColor: "#a855f7",
  },
};

const SEV_COLORS = [
  "",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
];

const CAT_ICON: Record<string, string> = {
  GROWTH: "📈", EFFICIENCY: "⚙️", CULTURE: "🤝",
  INNOVATION: "💡", SUSTAINABILITY: "♻️", OTHER: "•",
};

const STATUS_L: Record<string, string> = {
  IDENTIFIED: "Identificado", BEING_ADDRESSED: "En proceso",
  RESOLVED: "Resuelto", DEPRIORITIZED: "Desprioritizado",
  DRAFT: "Borrador", ACTIVE: "Activo", ACHIEVED: "Logrado", CANCELLED: "Cancelado",
  TODO: "Pendiente", IN_PROGRESS: "En curso", DONE: "Completada",
  OPEN: "Abierta",
};

// ── Hover actions ─────────────────────────────────────────────────────────────

const OKR_LAYERS = new Set<LayerId>(["strategic", "annual", "quarterly"]);

const EDIT_ROUTE: Record<LayerId, string> = {
  problems:    "/problems",
  intents:     "/strategy",
  strategic:   "/strategic",
  annual:      "/cycles",
  quarterly:   "/tactical",
  initiatives: "/initiatives",
  epics:       "/backlog",
  features:    "/backlog",
  stories:     "/backlog",
};

function CardActions({
  layer, id, title, onCheckIn,
}: {
  layer: LayerId; id: string; title: string;
  onCheckIn: (id: string, title: string, layer: LayerId) => void;
}) {
  const router = useRouter();
  const btnCls = "p-1 rounded-md bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shadow-sm";
  return (
    <div className="absolute bottom-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
      {OKR_LAYERS.has(layer) && (
        <button title="Registrar check-in" onClick={() => onCheckIn(id, title, layer)} className={btnCls}>
          <ClipboardCheck className="h-3 w-3" />
        </button>
      )}
      <button title="Editar" onClick={() => router.push(EDIT_ROUTE[layer])} className={btnCls}>
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Bezier path ───────────────────────────────────────────────────────────────

function bezierPath(from: Point, to: Point): string {
  const dx = Math.abs(to.x - from.x) * 0.45;
  return `M ${from.x},${from.y} C ${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`;
}

// ── Column component ──────────────────────────────────────────────────────────

function Column({
  layer, count, colW, children,
}: {
  layer: LayerId;
  count: number;
  colW: number;
  children: React.ReactNode;
}) {
  const cfg = LAYER_CFG[layer];
  const Icon = cfg.Icon;
  return (
    <div className="flex flex-col shrink-0" style={{ width: colW }}>
      <div className={cn("rounded-xl border p-3 mb-3", cfg.border, cfg.bg)}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20 shrink-0">
            <Icon className={cn("h-4 w-4", cfg.accent)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-bold truncate", cfg.accent)}>{cfg.label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{cfg.sublabel}</p>
          </div>
          <span className={cn(
            "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-black/20",
            cfg.accent,
          )}>
            {count}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center rounded-xl border border-dashed border-border/40">
            <Target className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Sin elementos</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ── Divider arrow ─────────────────────────────────────────────────────────────

function ColDivider({ active }: { active: boolean }) {
  return (
    <div className={cn(
      "flex items-start justify-center w-5 shrink-0 mt-[56px] transition-opacity",
      active ? "opacity-100" : "opacity-20",
    )}>
      <div className="h-px w-full bg-border" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  cycles: Cycle[];
  problems?: any[];
  intents?: any[];
  stratObjs?: Objective[];
  annualObjs?: Objective[];
  quarterlyObjs?: Objective[];
  initiatives?: Initiative[];
  epics?: any[];
  features?: any[];
  stories?: any[];
  objectiveLinks?: ObjectiveInitiativeLink[];
  externalSelection?: { id: string; layer: string } | null;
  showAllRelations?: boolean;
}

export function TraceabilityView({
  cycles,
  problems = [],
  intents = [],
  stratObjs = [],
  annualObjs = [],
  quarterlyObjs = [],
  initiatives = [],
  epics = [],
  features = [],
  stories = [],
  objectiveLinks = [],
  externalSelection,
  showAllRelations = false,
}: Props) {

  const [selected, setSelected] = useState<{ id: string; layer: string } | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<{ id: string; title: string; layer: LayerId } | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const colW = Math.round(240 * zoom);
  const colGap = Math.round(20 * zoom);

  const zoomIn  = useCallback(() => setZoom(z => Math.min(1.4, parseFloat((z + 0.1).toFixed(2)))), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.55, parseFloat((z - 0.1).toFixed(2)))), []);
  const zoomReset = useCallback(() => setZoom(1.0), []);

  function openCheckIn(id: string, title: string, layer: LayerId) {
    setCheckInTarget({ id, title, layer });
  }

  // true when selection comes from the external filter panel (not from clicking inside)
  const isFilterMode = !!externalSelection;

  // Sync external selection from filter panel
  useEffect(() => {
    setSelected(externalSelection ?? null);
  }, [externalSelection]);

  // Lazy connection data — only fetched when the matching layer is selected
  const { data: intentProblems }   = useIntentProblems(
    selected?.layer === "intents" ? selected.id : null,
  );
  const { data: intentObjectives } = useIntentObjectives(
    selected?.layer === "intents" ? selected.id : null,
  );
  const { data: problemIntents }   = useProblemIntents(
    selected?.layer === "problems" ? selected.id : null,
  );
  const { data: annualAlignments } = useObjectiveAlignments(
    selected?.layer === "annual" ? selected.id : null,
  );

  // ID → layer lookup (for SVG line drawing)
  const idToLayer = useMemo<Map<string, LayerId>>(() => {
    const m = new Map<string, LayerId>();
    problems.forEach(p => m.set(p.id, "problems"));
    intents.forEach(i => m.set(i.id, "intents"));
    stratObjs.forEach(o => m.set(o.id, "strategic"));
    annualObjs.forEach(o => m.set(o.id, "annual"));
    quarterlyObjs.forEach(o => m.set(o.id, "quarterly"));
    initiatives.forEach(i => m.set(i.id, "initiatives"));
    epics.forEach(e => m.set(e.id, "epics"));
    features.forEach(f => m.set(f.id, "features"));
    stories.forEach(s => m.set(s.id, "stories"));
    return m;
  }, [problems, intents, stratObjs, annualObjs, quarterlyObjs, initiatives, epics, features, stories]);

  // All static edges computable from local data (no extra API calls)
  const allEdges = useMemo(() => {
    type Edge = { fromLayer: LayerId; fromId: string; toLayer: LayerId; toId: string };
    const edges: Edge[] = [];
    for (const o of stratObjs)    if (o.strategic_intent_id) edges.push({ fromLayer: "intents",     fromId: o.strategic_intent_id, toLayer: "strategic",   toId: o.id });
    for (const o of annualObjs)   if (o.parent_objective_id) edges.push({ fromLayer: "strategic",   fromId: o.parent_objective_id, toLayer: "annual",      toId: o.id });
    for (const o of quarterlyObjs)if (o.parent_objective_id) edges.push({ fromLayer: "annual",      fromId: o.parent_objective_id, toLayer: "quarterly",   toId: o.id });
    for (const l of objectiveLinks) {
      const layer = idToLayer.get(l.objective_id);
      if (layer) edges.push({ fromLayer: layer, fromId: l.objective_id, toLayer: "initiatives", toId: l.initiative_id });
    }
    for (const e of epics)     if (e.initiative_id) edges.push({ fromLayer: "initiatives", fromId: e.initiative_id, toLayer: "epics",     toId: e.id });
    for (const f of features)  if (f.parent_id)     edges.push({ fromLayer: "epics",       fromId: f.parent_id,    toLayer: "features",  toId: f.id });
    for (const s of stories)   if (s.parent_id)     edges.push({ fromLayer: "features",    fromId: s.parent_id,    toLayer: "stories",   toId: s.id });
    return edges;
  }, [stratObjs, annualObjs, quarterlyObjs, objectiveLinks, epics, features, stories, idToLayer]);

  // Direct connections (one hop) — used for SVG lines and non-filter highlighting
  const connectedIds = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    if (!selected) return s;

    if (selected.layer === "intents") {
      (intentProblems as any[] | undefined)?.forEach(p => s.add(p.id));
      (intentObjectives as any[] | undefined)?.forEach(o => s.add(o.id));
    }
    if (selected.layer === "problems") {
      (problemIntents as any[] | undefined)?.forEach(i => s.add(i.id));
    }
    if (selected.layer === "strategic") {
      const o = stratObjs.find(x => x.id === selected.id);
      if (o?.strategic_intent_id) s.add(o.strategic_intent_id);
      annualObjs
        .filter(a => a.parent_objective_id === selected.id)
        .forEach(a => s.add(a.id));
      // Initiatives linked directly to this strategic OKR via KRs
      objectiveLinks
        .filter(l => l.objective_id === selected.id)
        .forEach(l => s.add(l.initiative_id));
    }
    if (selected.layer === "annual") {
      const o = annualObjs.find(x => x.id === selected.id);
      if (o?.parent_objective_id) s.add(o.parent_objective_id);
      (annualAlignments as any[] | undefined)?.forEach(a => s.add(a.id));
      quarterlyObjs
        .filter(q => q.parent_objective_id === selected.id)
        .forEach(q => s.add(q.id));
      // Initiatives linked directly to this annual OKR via KRs
      objectiveLinks
        .filter(l => l.objective_id === selected.id)
        .forEach(l => s.add(l.initiative_id));
    }
    if (selected.layer === "quarterly") {
      const o = quarterlyObjs.find(x => x.id === selected.id);
      if (o?.parent_objective_id) s.add(o.parent_objective_id);
      objectiveLinks
        .filter(l => l.objective_id === selected.id)
        .forEach(l => s.add(l.initiative_id));
    }
    if (selected.layer === "initiatives") {
      objectiveLinks
        .filter(l => l.initiative_id === selected.id)
        .forEach(l => s.add(l.objective_id));
      epics
        .filter(e => e.initiative_id === selected.id)
        .forEach(e => s.add(e.id));
    }
    if (selected.layer === "epics") {
      const epic = epics.find(e => e.id === selected.id);
      if (epic?.initiative_id) s.add(epic.initiative_id);
      features.filter(f => f.parent_id === selected.id).forEach(f => s.add(f.id));
    }
    if (selected.layer === "features") {
      const feat = features.find(f => f.id === selected.id);
      if (feat?.parent_id) s.add(feat.parent_id);
      stories.filter(st => st.parent_id === selected.id).forEach(st => s.add(st.id));
    }
    if (selected.layer === "stories") {
      const story = stories.find(st => st.id === selected.id);
      if (story?.parent_id) s.add(story.parent_id);
    }
    return s;
  }, [selected, intentProblems, intentObjectives, problemIntents, annualAlignments,
      annualObjs, quarterlyObjs, objectiveLinks, epics, features, stories]);

  // Full transitive hierarchy — used in filter mode to show complete chain
  const transitiveConnectedIds = useMemo<Set<string>>(() => {
    if (!selected || !isFilterMode) return new Set<string>();
    const s = new Set<string>();

    // Descend through the full hierarchy from a set of IDs
    function descend(layer: LayerId, ids: string[]) {
      if (ids.length === 0) return;
      switch (layer) {
        case "intents": {
          const next = stratObjs.filter(o => o.strategic_intent_id && ids.includes(o.strategic_intent_id)).map(o => { s.add(o.id); return o.id; });
          descend("strategic", next);
          break;
        }
        case "strategic": {
          // Initiatives linked directly to strategic OKRs
          const stratInits = objectiveLinks.filter(l => ids.includes(l.objective_id)).map(l => { s.add(l.initiative_id); return l.initiative_id; });
          descend("initiatives", stratInits);
          const next = annualObjs.filter(o => o.parent_objective_id && ids.includes(o.parent_objective_id)).map(o => { s.add(o.id); return o.id; });
          descend("annual", next);
          break;
        }
        case "annual": {
          // Initiatives linked directly to annual OKRs
          const annualInits = objectiveLinks.filter(l => ids.includes(l.objective_id)).map(l => { s.add(l.initiative_id); return l.initiative_id; });
          descend("initiatives", annualInits);
          const next = quarterlyObjs.filter(o => o.parent_objective_id && ids.includes(o.parent_objective_id)).map(o => { s.add(o.id); return o.id; });
          descend("quarterly", next);
          break;
        }
        case "quarterly": {
          const next = objectiveLinks.filter(l => ids.includes(l.objective_id)).map(l => { s.add(l.initiative_id); return l.initiative_id; });
          descend("initiatives", next);
          break;
        }
        case "initiatives": {
          const next = epics.filter(e => e.initiative_id && ids.includes(e.initiative_id)).map(e => { s.add(e.id); return e.id; });
          descend("epics", next);
          break;
        }
        case "epics": {
          const next = features.filter(f => f.parent_id && ids.includes(f.parent_id)).map(f => { s.add(f.id); return f.id; });
          descend("features", next);
          break;
        }
        case "features": {
          stories.filter(st => st.parent_id && ids.includes(st.parent_id)).forEach(st => s.add(st.id));
          break;
        }
      }
    }

    // Ascend toward roots from selected item
    if (selected.layer === "strategic") {
      const o = stratObjs.find(x => x.id === selected.id);
      if (o?.strategic_intent_id) s.add(o.strategic_intent_id);
    }
    if (selected.layer === "annual") {
      const o = annualObjs.find(x => x.id === selected.id);
      if (o?.parent_objective_id) {
        s.add(o.parent_objective_id);
        const strat = stratObjs.find(x => x.id === o.parent_objective_id);
        if (strat?.strategic_intent_id) s.add(strat.strategic_intent_id);
      }
    }
    if (selected.layer === "quarterly") {
      const o = quarterlyObjs.find(x => x.id === selected.id);
      if (o?.parent_objective_id) {
        s.add(o.parent_objective_id);
        const annual = annualObjs.find(x => x.id === o.parent_objective_id);
        if (annual?.parent_objective_id) {
          s.add(annual.parent_objective_id);
          const strat = stratObjs.find(x => x.id === annual.parent_objective_id);
          if (strat?.strategic_intent_id) s.add(strat.strategic_intent_id);
        }
      }
    }
    // Helper: add full ancestor chain for any objective ID (works at any level)
    function addObjAncestors(objId: string) {
      s.add(objId);
      const q = quarterlyObjs.find(x => x.id === objId);
      if (q) {
        if (q.parent_objective_id) {
          s.add(q.parent_objective_id);
          const a = annualObjs.find(x => x.id === q.parent_objective_id);
          if (a?.parent_objective_id) {
            s.add(a.parent_objective_id);
            const st = stratObjs.find(x => x.id === a.parent_objective_id);
            if (st?.strategic_intent_id) s.add(st.strategic_intent_id);
          }
        }
        return;
      }
      const a = annualObjs.find(x => x.id === objId);
      if (a) {
        if (a.parent_objective_id) {
          s.add(a.parent_objective_id);
          const st = stratObjs.find(x => x.id === a.parent_objective_id);
          if (st?.strategic_intent_id) s.add(st.strategic_intent_id);
        }
        return;
      }
      const st = stratObjs.find(x => x.id === objId);
      if (st?.strategic_intent_id) s.add(st.strategic_intent_id);
    }

    if (selected.layer === "initiatives") {
      objectiveLinks.filter(l => l.initiative_id === selected.id).forEach(l => addObjAncestors(l.objective_id));
    }
    if (selected.layer === "epics") {
      const e = epics.find(x => x.id === selected.id);
      if (e?.initiative_id) {
        s.add(e.initiative_id);
        objectiveLinks.filter(l => l.initiative_id === e.initiative_id).forEach(l => addObjAncestors(l.objective_id));
      }
    }
    if (selected.layer === "features") {
      const f = features.find(x => x.id === selected.id);
      if (f?.parent_id) {
        s.add(f.parent_id);
        const e = epics.find(x => x.id === f.parent_id);
        if (e?.initiative_id) {
          s.add(e.initiative_id);
          objectiveLinks.filter(l => l.initiative_id === e.initiative_id).forEach(l => addObjAncestors(l.objective_id));
        }
      }
    }
    if (selected.layer === "stories") {
      const st = stories.find(x => x.id === selected.id);
      if (st?.parent_id) {
        s.add(st.parent_id);
        const f = features.find(x => x.id === st.parent_id);
        if (f?.parent_id) {
          s.add(f.parent_id);
          const e = epics.find(x => x.id === f.parent_id);
          if (e?.initiative_id) {
            s.add(e.initiative_id);
            objectiveLinks.filter(l => l.initiative_id === e.initiative_id).forEach(l => addObjAncestors(l.objective_id));
          }
        }
      }
    }
    if (selected.layer === "intents") {
      (intentProblems as any[] | undefined)?.forEach(p => s.add(p.id));
    }
    if (selected.layer === "problems") {
      (problemIntents as any[] | undefined)?.forEach(i => {
        s.add(i.id);
        descend("intents", [i.id]);
      });
    }

    descend(selected.layer as LayerId, [selected.id]);
    return s;
  }, [selected, isFilterMode, stratObjs, annualObjs, quarterlyObjs,
      objectiveLinks, epics, features, stories, intentProblems, problemIntents]);

  // Filter state — must be computed before useLayoutEffect
  const filterLoadingConnections =
    isFilterMode && (
      (selected?.layer === "intents"  && !intentProblems) ||
      (selected?.layer === "problems" && !problemIntents)
    );
  const isFiltering = isFilterMode && !filterLoadingConnections;
  function inFilterView(id: string) {
    return id === selected?.id || transitiveConnectedIds.has(id);
  }

  // DOM refs for SVG overlay
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);

  // Draw SVG lines after every render
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("width",  String(container.scrollWidth));
    svg.setAttribute("height", String(container.scrollHeight));

    const cRect = container.getBoundingClientRect();

    function getPoint(layer: LayerId, id: string, side: "left" | "right"): Point | null {
      const el = container!.querySelector<HTMLElement>(`[data-traceid="${layer}-${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: side === "left"
          ? r.left - cRect.left + container!.scrollLeft
          : r.right - cRect.left + container!.scrollLeft,
        y: r.top - cRect.top + container!.scrollTop + r.height / 2,
      };
    }

    function drawEdge(fromLayer: LayerId, fromId: string, toLayer: LayerId, toId: string, color: string, opacity: number, width: number) {
      const fromIdx = LAYER_ORDER.indexOf(fromLayer);
      const toIdx   = LAYER_ORDER.indexOf(toLayer);
      const goRight = fromIdx < toIdx;
      const from = getPoint(fromLayer, fromId, goRight ? "right" : "left");
      const to   = getPoint(toLayer,   toId,   goRight ? "left"  : "right");
      if (!from || !to) return;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d",              bezierPath(from, to));
      path.setAttribute("stroke",         color);
      path.setAttribute("stroke-width",   String(width));
      path.setAttribute("fill",           "none");
      path.setAttribute("opacity",        String(opacity));
      path.setAttribute("stroke-linecap", "round");
      svg!.appendChild(path);
    }

    if (showAllRelations) {
      for (const edge of allEdges) {
        // In filter mode only draw edges where both endpoints are visible
        if (isFiltering && !inFilterView(edge.fromId) && !inFilterView(edge.toId)) continue;

        const isHighlighted = selected && (
          (edge.fromId === selected.id && edge.fromLayer === selected.layer) ||
          (edge.toId   === selected.id && edge.toLayer   === selected.layer) ||
          connectedIds.has(edge.fromId) || connectedIds.has(edge.toId)
        );

        const color   = LAYER_CFG[edge.fromLayer]?.lineColor ?? "#888";
        const opacity = selected ? (isHighlighted ? 0.8 : 0.08) : 0.22;
        const width   = selected && isHighlighted ? 2 : 1;
        drawEdge(edge.fromLayer, edge.fromId, edge.toLayer, edge.toId, color, opacity, width);
      }
      return;
    }

    // Normal mode: draw only selected item's connections
    if (!selected || connectedIds.size === 0) return;
    const cfg = LAYER_CFG[selected.layer as LayerId];
    const lineColor = cfg?.lineColor ?? "#888";
    for (const connId of connectedIds) {
      const connLayer = idToLayer.get(connId);
      if (!connLayer) continue;
      drawEdge(selected.layer as LayerId, selected.id, connLayer, connId, lineColor, 0.75, 2);
    }
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function isActive(id: string, layer: LayerId) {
    return (selected?.id === id && selected?.layer === layer) || connectedIds.has(id);
  }

  function isDimmed(id: string, layer: LayerId) {
    // In filter mode items are hidden via visible arrays — no dimming needed
    if (!selected || isFilterMode) return false;
    return !isActive(id, layer);
  }

  function toggle(id: string, layer: LayerId) {
    setSelected(prev =>
      prev?.id === id && prev?.layer === layer ? null : { id, layer },
    );
  }

  // ── Filtered data ────────────────────────────────────────────────────────────

  const activeProblems     = problems.filter(p => p.status !== "RESOLVED" && p.status !== "DEPRIORITIZED");
  const activeIntents      = intents.filter(i => i.status !== "CANCELLED");
  const stratFiltered      = stratObjs.filter(o => o.status !== "CANCELLED");
  const annualFiltered     = annualObjs.filter(o => o.status !== "CANCELLED");
  const quarterlyFiltered  = quarterlyObjs.filter(o => o.status !== "CANCELLED");
  const activeInitiatives  = initiatives.filter(i => i.status !== "CANCELLED");
  const activeEpics        = epics.filter(e => e.status !== "CANCELLED");
  const activeFeatures     = features.filter(f => f.status !== "CANCELLED");
  const activeStories      = stories.filter(s => s.status !== "CANCELLED");

  const visibleProblems    = isFiltering ? activeProblems.filter(p => inFilterView(p.id))    : activeProblems;
  const visibleIntents     = isFiltering ? activeIntents.filter(i => inFilterView(i.id))      : activeIntents;
  const visibleStratObjs   = isFiltering ? stratFiltered.filter(o => inFilterView(o.id))      : stratFiltered;
  const visibleAnnualObjs  = isFiltering ? annualFiltered.filter(o => inFilterView(o.id))     : annualFiltered;
  const visibleQuarterly   = isFiltering ? quarterlyFiltered.filter(o => inFilterView(o.id))  : quarterlyFiltered;
  const visibleInitiatives = isFiltering ? activeInitiatives.filter(i => inFilterView(i.id))  : activeInitiatives;
  const visibleEpics       = isFiltering ? activeEpics.filter(e => inFilterView(e.id))        : activeEpics;
  const visibleFeatures    = isFiltering ? activeFeatures.filter(f => inFilterView(f.id))     : activeFeatures;
  const visibleStories     = isFiltering ? activeStories.filter(s => inFilterView(s.id))      : activeStories;

  // ── Render ───────────────────────────────────────────────────────────────────

  const loadingConnections =
    (selected?.layer === "intents" && !intentProblems && !intentObjectives) ||
    (selected?.layer === "annual" && !annualAlignments);

  const btnZ = "h-7 w-7 rounded-lg border border-border/60 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-border flex items-center justify-center transition-colors shadow-sm";

  return (
    <div className="h-full flex flex-col gap-2">

      {/* Toolbar: zoom controls + clear */}
      <div className="flex items-center gap-1.5 shrink-0">
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mr-auto"
          >
            Limpiar selección
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={zoomOut} className={btnZ} title="Reducir zoom">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground w-10 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={zoomIn} className={btnZ} title="Aumentar zoom">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button onClick={zoomReset} className={cn(btnZ, "w-auto px-2 text-xs")} title="1:1">
            1:1
          </button>
        </div>
      </div>

      {/* Main container — SVG overlay + columns (scrollable) */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-auto rounded-xl border border-border/40 bg-muted/10"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <svg
          ref={svgRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ zIndex: 10, overflow: "visible" }}
        />

        <div className="flex w-max p-4" style={{ gap: colGap }}>

          {/* ── Diagnóstico ── */}
          <Column layer="problems" count={visibleProblems.length} colW={colW}>
            {visibleProblems.map(p => (
              <div key={p.id} className="group relative">
                <button
                  data-traceid={`problems-${p.id}`}
                  onClick={() => toggle(p.id, "problems")}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                    isActive(p.id, "problems")
                      ? `${LAYER_CFG.problems.activeBorder} shadow-md ring-1 ring-rose-200 dark:ring-rose-800`
                      : "border-border/50 hover:border-rose-200 hover:shadow-sm",
                    isDimmed(p.id, "problems") && "opacity-20 pointer-events-none",
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold leading-snug line-clamp-2 flex-1">{p.title}</p>
                    <span className={cn(
                      "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      SEV_COLORS[p.severity] ?? SEV_COLORS[3],
                    )}>
                      S{p.severity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{STATUS_L[p.status] ?? p.status}</span>
                    {p.intent_count > 0 && (
                      <span className="text-violet-600 dark:text-violet-400 font-medium">
                        {p.intent_count} estrategia{p.intent_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </button>
                <CardActions layer="problems" id={p.id} title={p.title} onCheckIn={openCheckIn} />
              </div>
            ))}
          </Column>

          <ColDivider active={selected?.layer === "problems"} />

          {/* ── Estrategia ── */}
          <Column layer="intents" count={visibleIntents.length} colW={colW}>
            {visibleIntents.map(i => (
              <div key={i.id} className="group relative">
                <button
                  data-traceid={`intents-${i.id}`}
                  onClick={() => toggle(i.id, "intents")}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                    isActive(i.id, "intents")
                      ? `${LAYER_CFG.intents.activeBorder} shadow-md ring-1 ring-violet-200 dark:ring-violet-800`
                      : "border-border/50 hover:border-violet-200 hover:shadow-sm",
                    isDimmed(i.id, "intents") && "opacity-20 pointer-events-none",
                  )}
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="text-sm shrink-0 leading-tight">
                      {CAT_ICON[i.category ?? "OTHER"] ?? "•"}
                    </span>
                    <p className="text-xs font-semibold leading-snug line-clamp-2">{i.title}</p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {i.target_year ? `Horizonte ${i.target_year}` : `${i.horizon_years}a`}
                    </span>
                    <div className="flex items-center gap-2">
                      {i.problem_count > 0 && (
                        <span className="text-rose-500 font-medium">{i.problem_count}d</span>
                      )}
                      {i.aligned_objectives_count > 0 && (
                        <span className="text-indigo-500 font-medium">{i.aligned_objectives_count}o</span>
                      )}
                    </div>
                  </div>
                </button>
                <CardActions layer="intents" id={i.id} title={i.title} onCheckIn={openCheckIn} />
              </div>
            ))}
          </Column>

          <ColDivider active={
            selected?.layer === "intents" ||
            (selected?.layer === "strategic") ||
            (selected?.layer === "annual" &&
              !!annualObjs.find(o => o.id === selected.id)?.parent_objective_id)
          } />

          {/* ── OKR Estratégico ── */}
          <Column layer="strategic" count={visibleStratObjs.length} colW={colW}>
            {visibleStratObjs.map(o => {
              const LevelIcon = o.level === "COMPANY" ? Building2 : Users;
              return (
                <div key={o.id} className="group relative">
                  <button
                    data-traceid={`strategic-${o.id}`}
                    onClick={() => toggle(o.id, "strategic")}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                      isActive(o.id, "strategic")
                        ? `${LAYER_CFG.strategic.activeBorder} shadow-md ring-1 ring-indigo-200 dark:ring-indigo-800`
                        : "border-border/50 hover:border-indigo-200 hover:shadow-sm",
                      isDimmed(o.id, "strategic") && "opacity-20 pointer-events-none",
                    )}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <ProgressRing
                        progress={o.progress} size={26}
                        status={o.status} className="shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        {o.code && <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{o.code}</span>}
                        <p className="text-xs font-semibold leading-snug line-clamp-2">{o.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className={cn("flex items-center gap-0.5", LAYER_CFG.strategic.accent)}>
                        <LevelIcon className="h-2.5 w-2.5" />
                        {o.level === "COMPANY" ? "Empresa" : "Área"}
                      </span>
                      <span className="tabular-nums">{o.progress}%</span>
                    </div>
                  </button>
                  <CardActions layer="strategic" id={o.id} title={o.title} onCheckIn={openCheckIn} />
                </div>
              );
            })}
          </Column>

          <ColDivider active={
            selected?.layer === "strategic" ||
            (selected?.layer === "annual" &&
              !!annualObjs.find(o => o.id === selected.id)?.parent_objective_id)
          } />

          {/* ── OKR Anual ── */}
          <Column layer="annual" count={visibleAnnualObjs.length} colW={colW}>
            {visibleAnnualObjs.map(o => {
              const LevelIcon = o.level === "COMPANY" ? Building2 : Users;
              return (
                <div key={o.id} className="group relative">
                  <button
                    data-traceid={`annual-${o.id}`}
                    onClick={() => toggle(o.id, "annual")}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                      isActive(o.id, "annual")
                        ? `${LAYER_CFG.annual.activeBorder} shadow-md ring-1 ring-blue-200 dark:ring-blue-800`
                        : "border-border/50 hover:border-blue-200 hover:shadow-sm",
                      isDimmed(o.id, "annual") && "opacity-20 pointer-events-none",
                    )}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <ProgressRing
                        progress={o.progress} size={26}
                        status={o.status} className="shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        {o.code && <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{o.code}</span>}
                        <p className="text-xs font-semibold leading-snug line-clamp-2">{o.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className={cn("flex items-center gap-0.5", LAYER_CFG.annual.accent)}>
                        <LevelIcon className="h-2.5 w-2.5" />
                        {o.level === "COMPANY" ? "Empresa" : "Área"}
                      </span>
                      {o.parent_objective_id && (
                        <span className="text-indigo-500 font-medium text-[9px]">vinculado</span>
                      )}
                    </div>
                  </button>
                  <CardActions layer="annual" id={o.id} title={o.title} onCheckIn={openCheckIn} />
                </div>
              );
            })}
          </Column>

          <ColDivider active={
            selected?.layer === "annual" ||
            (selected?.layer === "quarterly" &&
              !!quarterlyObjs.find(o => o.id === selected?.id)?.parent_objective_id)
          } />

          {/* ── OKR Trimestral ── */}
          <Column layer="quarterly" count={visibleQuarterly.length} colW={colW}>
            {visibleQuarterly.map(o => {
              const LevelIcon = o.level === "TEAM" ? Users : Building2;
              return (
                <div key={o.id} className="group relative">
                  <button
                    data-traceid={`quarterly-${o.id}`}
                    onClick={() => toggle(o.id, "quarterly")}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                      isActive(o.id, "quarterly")
                        ? `${LAYER_CFG.quarterly.activeBorder} shadow-md ring-1 ring-amber-200 dark:ring-amber-800`
                        : "border-border/50 hover:border-amber-200 hover:shadow-sm",
                      isDimmed(o.id, "quarterly") && "opacity-20 pointer-events-none",
                    )}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <ProgressRing
                        progress={o.progress} size={26}
                        status={o.status} className="shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        {o.code && <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{o.code}</span>}
                        <p className="text-xs font-semibold leading-snug line-clamp-2">{o.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className={cn("flex items-center gap-0.5", LAYER_CFG.quarterly.accent)}>
                        <LevelIcon className="h-2.5 w-2.5" />
                        {o.team_name ?? (o.level === "TEAM" ? "Equipo" : o.level === "INDIVIDUAL" ? "Individual" : "Empresa")}
                      </span>
                      <span className="tabular-nums">{o.progress}%</span>
                    </div>
                  </button>
                  <CardActions layer="quarterly" id={o.id} title={o.title} onCheckIn={openCheckIn} />
                </div>
              );
            })}
          </Column>

          <ColDivider active={
            selected?.layer === "quarterly" ||
            selected?.layer === "initiatives"
          } />

          {/* ── Iniciativas ── */}
          <Column layer="initiatives" count={visibleInitiatives.length} colW={colW}>
            {visibleInitiatives.map(i => (
              <div key={i.id} className="group relative">
                <button
                  data-traceid={`initiatives-${i.id}`}
                  onClick={() => toggle(i.id, "initiatives")}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                    isActive(i.id, "initiatives")
                      ? `${LAYER_CFG.initiatives.activeBorder} shadow-md ring-1 ring-emerald-200 dark:ring-emerald-800`
                      : "border-border/50 hover:border-emerald-200 hover:shadow-sm",
                    isDimmed(i.id, "initiatives") && "opacity-20 pointer-events-none",
                  )}
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <ProgressRing
                      progress={i.progress} size={26}
                      status={i.status} className="shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      {i.code && <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{i.code}</span>}
                      <p className="text-xs font-semibold leading-snug line-clamp-2">{i.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className={cn(LAYER_CFG.initiatives.accent)}>
                      {STATUS_L[i.status] ?? i.status}
                    </span>
                    <div className="flex items-center gap-2">
                      {i.key_results?.length > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {i.key_results.length} KR{i.key_results.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="tabular-nums">{i.progress}%</span>
                    </div>
                  </div>
                </button>
                <CardActions layer="initiatives" id={i.id} title={i.title} onCheckIn={openCheckIn} />
              </div>
            ))}
          </Column>

          <ColDivider active={
            selected?.layer === "initiatives" ||
            selected?.layer === "epics"
          } />

          {/* ── Épicas ── */}
          <Column layer="epics" count={visibleEpics.length} colW={colW}>
            {visibleEpics.map(e => (
              <div key={e.id} className="group relative">
                <button
                  data-traceid={`epics-${e.id}`}
                  onClick={() => toggle(e.id, "epics")}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                    isActive(e.id, "epics")
                      ? `${LAYER_CFG.epics.activeBorder} shadow-md ring-1 ring-teal-200 dark:ring-teal-800`
                      : "border-border/50 hover:border-teal-200 hover:shadow-sm",
                    isDimmed(e.id, "epics") && "opacity-20 pointer-events-none",
                  )}
                >
                  <div className="flex-1 min-w-0 mb-1.5">
                    {e.code && <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{e.code}</span>}
                    <p className="text-xs font-semibold leading-snug line-clamp-2">{e.title}</p>
                  </div>
                  {e.initiative_title && (
                    <p className="text-[9px] text-teal-600 dark:text-teal-400 truncate mb-1 leading-tight">
                      ↑ {e.initiative_title}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className={cn(LAYER_CFG.epics.accent)}>
                      {STATUS_L[e.status] ?? e.status}
                    </span>
                    {e.children_count > 0 && (
                      <span className="tabular-nums">{e.children_count} features</span>
                    )}
                  </div>
                </button>
                <CardActions layer="epics" id={e.id} title={e.title} onCheckIn={openCheckIn} />
              </div>
            ))}
          </Column>

          <ColDivider active={
            selected?.layer === "epics" ||
            selected?.layer === "features"
          } />

          {/* ── Features ── */}
          <Column layer="features" count={visibleFeatures.length} colW={colW}>
            {visibleFeatures.map(f => (
              <div key={f.id} className="group relative">
                <button
                  data-traceid={`features-${f.id}`}
                  onClick={() => toggle(f.id, "features")}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                    isActive(f.id, "features")
                      ? `${LAYER_CFG.features.activeBorder} shadow-md ring-1 ring-cyan-200 dark:ring-cyan-800`
                      : "border-border/50 hover:border-cyan-200 hover:shadow-sm",
                    isDimmed(f.id, "features") && "opacity-20 pointer-events-none",
                  )}
                >
                  <div className="flex-1 min-w-0 mb-1.5">
                    {f.code && <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{f.code}</span>}
                    <p className="text-xs font-semibold leading-snug line-clamp-2">{f.title}</p>
                  </div>
                  {f.parent_title && (
                    <p className="text-[9px] text-cyan-600 dark:text-cyan-400 truncate mb-1 leading-tight">
                      ↑ {f.parent_title}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className={cn(LAYER_CFG.features.accent)}>
                      {STATUS_L[f.status] ?? f.status}
                    </span>
                    {f.children_count > 0 && (
                      <span className="tabular-nums">{f.children_count} historias</span>
                    )}
                  </div>
                </button>
                <CardActions layer="features" id={f.id} title={f.title} onCheckIn={openCheckIn} />
              </div>
            ))}
          </Column>

          <ColDivider active={
            selected?.layer === "features" ||
            selected?.layer === "stories"
          } />

          {/* ── Historias de usuario ── */}
          <Column layer="stories" count={visibleStories.length} colW={colW}>
            {visibleStories.map(s => (
              <div key={s.id} className="group relative">
                <button
                  data-traceid={`stories-${s.id}`}
                  onClick={() => toggle(s.id, "stories")}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all duration-150 bg-card focus:outline-none",
                    isActive(s.id, "stories")
                      ? `${LAYER_CFG.stories.activeBorder} shadow-md ring-1 ring-purple-200 dark:ring-purple-800`
                      : "border-border/50 hover:border-purple-200 hover:shadow-sm",
                    isDimmed(s.id, "stories") && "opacity-20 pointer-events-none",
                  )}
                >
                  <div className="flex-1 min-w-0 mb-1.5">
                    {s.code && <span className="text-[9px] font-mono font-semibold text-muted-foreground block">{s.code}</span>}
                    <p className="text-xs font-semibold leading-snug line-clamp-2">{s.title}</p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className={cn(LAYER_CFG.stories.accent)}>
                      {STATUS_L[s.status] ?? s.status}
                    </span>
                    {s.story_points != null && (
                      <span className="tabular-nums">{s.story_points}pts</span>
                    )}
                  </div>
                </button>
                <CardActions layer="stories" id={s.id} title={s.title} onCheckIn={openCheckIn} />
              </div>
            ))}
          </Column>

        </div>
      </div>

      {/* Check-in drawer */}
      {checkInTarget && (
        <TraceabilityCheckInDrawer
          objectiveId={checkInTarget.id}
          objectiveTitle={checkInTarget.title}
          layer={checkInTarget.layer}
          onClose={() => setCheckInTarget(null)}
        />
      )}

      {/* Connection hint — shown as floating badge inside canvas when something is selected */}
      {selected && (
        <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground bg-background/90 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-1.5 shadow-sm w-fit">
          <Network className="h-3.5 w-3.5 shrink-0 text-primary" />
          {loadingConnections
            ? "Cargando conexiones..."
            : isFilterMode
              ? `${transitiveConnectedIds.size} elemento${transitiveConnectedIds.size !== 1 ? "s" : ""} en la jerarquía`
              : connectedIds.size > 0
                ? `${connectedIds.size} conexión${connectedIds.size !== 1 ? "es" : ""} directa${connectedIds.size !== 1 ? "s" : ""}`
                : "Sin conexiones directas"
          }
        </div>
      )}
    </div>
  );
}
