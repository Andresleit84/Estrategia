"use client";

import { useState, useRef, useLayoutEffect, useMemo, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronRight, AlertCircle,
  Lightbulb, Compass, CalendarRange, Zap, Rocket, Layers, BookOpen, FileText,
  Pencil, ClipboardCheck, ZoomIn, ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { TraceabilityCheckInDrawer } from "@/components/okr/TraceabilityCheckInDrawer";
import type { Objective } from "@/hooks/useObjectives";
import type { StrategicIntent } from "@/hooks/useStrategicIntents";
import type { Initiative } from "@/hooks/useInitiatives";
import type { ObjectiveInitiativeLink } from "@/hooks/useInitiatives";
import type { BacklogItem } from "@/hooks/useBacklog";

// ── Types ──────────────────────────────────────────────────────────────────────

type LayerId = "intent" | "strategic" | "annual" | "quarterly" | "initiative" | "epic" | "feature" | "story";

interface TreeNode {
  id: string;
  layer: LayerId;
  label: string;
  progress?: number;
  status?: string;
  subtitle?: string;
  children: TreeNode[];
}

// ── Config ─────────────────────────────────────────────────────────────────────

const LAYER_CFG: Record<LayerId, {
  Icon: React.ElementType;
  accent: string;
  bg: string;
  border: string;
  badge: string;
  lineColor: string;
  label: string;
}> = {
  intent: {
    Icon: Lightbulb,
    accent: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-300 dark:border-violet-700",
    badge: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
    lineColor: "#a78bfa",
    label: "Intención",
  },
  strategic: {
    Icon: Compass,
    accent: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-300 dark:border-indigo-700",
    badge: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
    lineColor: "#818cf8",
    label: "Estratégico",
  },
  annual: {
    Icon: CalendarRange,
    accent: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-700",
    badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    lineColor: "#60a5fa",
    label: "Anual",
  },
  quarterly: {
    Icon: Zap,
    accent: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-700",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    lineColor: "#fbbf24",
    label: "Trimestral",
  },
  initiative: {
    Icon: Rocket,
    accent: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-700",
    badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    lineColor: "#34d399",
    label: "Iniciativa",
  },
  epic: {
    Icon: Layers,
    accent: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-300 dark:border-teal-700",
    badge: "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300",
    lineColor: "#2dd4bf",
    label: "Épica",
  },
  feature: {
    Icon: BookOpen,
    accent: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-sky-300 dark:border-sky-700",
    badge: "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
    lineColor: "#38bdf8",
    label: "Feature",
  },
  story: {
    Icon: FileText,
    accent: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-50 dark:bg-slate-950/40",
    border: "border-slate-300 dark:border-slate-700",
    badge: "bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300",
    lineColor: "#94a3b8",
    label: "Historia",
  },
};

// ── Action config ─────────────────────────────────────────────────────────────

const OKR_TREE_LAYERS = new Set<LayerId>(["strategic", "annual", "quarterly"]);

const TREE_EDIT_ROUTE: Record<LayerId, string> = {
  intent:     "/strategy",
  strategic:  "/strategic",
  annual:     "/cycles",
  quarterly:  "/tactical",
  initiative: "/initiatives",
  epic:       "/backlog",
  feature:    "/backlog",
  story:      "/backlog",
};

// ── Layout constants ───────────────────────────────────────────────────────────

const BASE_NODE_W = 190;
const H_GAP   = 14;
const V_GAP   = 52;

// ── Node card ──────────────────────────────────────────────────────────────────

const ACTION_BTN = "p-1 rounded-md bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shadow-sm";

function NodeCard({ node, nodeW, isExpanded, toggle, onEdit, onCheckIn }: {
  node: TreeNode;
  nodeW: number;
  isExpanded: boolean;
  toggle: () => void;
  onEdit: () => void;
  onCheckIn?: () => void;
}) {
  const cfg = LAYER_CFG[node.layer];
  const Icon = cfg.Icon;
  const canExpand = node.children.length > 0;

  return (
    <div
      data-treeid={node.id}
      onClick={() => canExpand && toggle()}
      style={{ width: nodeW }}
      className={cn(
        "group relative rounded-xl border-2 p-2.5 bg-card select-none transition-all duration-150",
        cfg.border,
        canExpand
          ? "cursor-pointer hover:shadow-lg hover:shadow-black/8 hover:-translate-y-0.5"
          : "cursor-default",
      )}
    >
      <div className={cn("flex items-center gap-1 mb-1.5", cfg.accent)}>
        <Icon className="h-3 w-3 shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider flex-1">{cfg.label}</span>
        {canExpand && (
          isExpanded
            ? <ChevronDown className="h-3 w-3 shrink-0" />
            : <ChevronRight className="h-3 w-3 shrink-0" />
        )}
      </div>

      <p className="text-[11px] font-semibold leading-snug line-clamp-3 text-foreground">
        {node.label}
      </p>

      {(node.progress !== undefined || node.subtitle) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {node.progress !== undefined && (
            <>
              <ProgressRing progress={node.progress} size={14} status={node.status} />
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {Math.round(node.progress)}%
              </span>
            </>
          )}
          {node.subtitle && (
            <span className="text-[9px] text-muted-foreground truncate ml-auto max-w-[60px]">
              {node.subtitle}
            </span>
          )}
        </div>
      )}

      {canExpand && (
        <div className={cn(
          "mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full inline-block",
          cfg.badge,
        )}>
          {node.children.length} {node.children.length === 1 ? "hijo" : "hijos"}
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute bottom-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
        {onCheckIn && (
          <button
            title="Registrar check-in"
            onClick={e => { e.stopPropagation(); onCheckIn(); }}
            className={ACTION_BTN}
          >
            <ClipboardCheck className="h-3 w-3" />
          </button>
        )}
        <button
          title="Editar"
          onClick={e => { e.stopPropagation(); onEdit(); }}
          className={ACTION_BTN}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Tree branch (recursive) ────────────────────────────────────────────────────

function TreeBranch({ node, nodeW, expanded, toggle, onEdit, onCheckIn }: {
  node: TreeNode;
  nodeW: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onEdit: (node: TreeNode) => void;
  onCheckIn: (node: TreeNode) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const visible = isExpanded ? node.children : [];

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node}
        nodeW={nodeW}
        isExpanded={isExpanded}
        toggle={() => toggle(node.id)}
        onEdit={() => onEdit(node)}
        onCheckIn={OKR_TREE_LAYERS.has(node.layer) ? () => onCheckIn(node) : undefined}
      />

      {visible.length > 0 && (
        <>
          <div style={{ height: V_GAP }} />
          <div className="flex items-start" style={{ gap: H_GAP }}>
            {visible.map(child => (
              <TreeBranch
                key={child.id}
                node={child}
                nodeW={nodeW}
                expanded={expanded}
                toggle={toggle}
                onEdit={onEdit}
                onCheckIn={onCheckIn}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── SVG line drawing ───────────────────────────────────────────────────────────

function drawLines(
  svg: SVGSVGElement,
  container: HTMLElement,
  node: TreeNode,
  expanded: Set<string>,
) {
  if (!expanded.has(node.id) || node.children.length === 0) return;

  const cRect = container.getBoundingClientRect();

  const pEl = container.querySelector<HTMLElement>(`[data-treeid="${node.id}"]`);
  if (!pEl) return;
  const pRect = pEl.getBoundingClientRect();

  const fromX = (pRect.left - cRect.left) + container.scrollLeft + pRect.width / 2;
  const fromY = (pRect.bottom - cRect.top) + container.scrollTop;

  const color = LAYER_CFG[node.layer].lineColor;

  for (const child of node.children) {
    const chEl = container.querySelector<HTMLElement>(`[data-treeid="${child.id}"]`);
    if (!chEl) continue;
    const chRect = chEl.getBoundingClientRect();

    const toX = (chRect.left - cRect.left) + container.scrollLeft + chRect.width / 2;
    const toY = (chRect.top - cRect.top) + container.scrollTop;

    const midY = (fromY + toY) / 2;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${fromX},${fromY} C ${fromX},${midY} ${toX},${midY} ${toX},${toY}`);
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("fill", "none");
    path.setAttribute("opacity", "0.55");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);

    drawLines(svg, container, child, expanded);
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  intents: StrategicIntent[];
  stratObjs: Objective[];
  annualObjs: Objective[];
  quarterlyObjs: Objective[];
  initiatives?: Initiative[];
  backlogTree?: BacklogItem[];
  objectiveLinks?: ObjectiveInitiativeLink[];
  externalSelection?: { id: string; layer: string } | null;
}

export function TraceabilityTree({
  intents, stratObjs, annualObjs, quarterlyObjs,
  initiatives = [], backlogTree = [], objectiveLinks = [],
  externalSelection,
}: Props) {
  const router = useRouter();
  const [checkInTarget, setCheckInTarget] = useState<{ id: string; title: string; layer: string } | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const nodeW = Math.round(BASE_NODE_W * zoom);

  const zoomIn    = useCallback(() => setZoom(z => Math.min(1.4, parseFloat((z + 0.1).toFixed(2)))), []);
  const zoomOut   = useCallback(() => setZoom(z => Math.max(0.55, parseFloat((z - 0.1).toFixed(2)))), []);
  const zoomReset = useCallback(() => setZoom(1.0), []);

  function handleEdit(node: TreeNode) {
    router.push(TREE_EDIT_ROUTE[node.layer]);
  }

  function handleCheckIn(node: TreeNode) {
    setCheckInTarget({ id: node.id, title: node.label, layer: node.layer });
  }
  const activeIntents   = intents.filter(i => i.status !== "CANCELLED");
  const activeStrat     = stratObjs.filter(o => o.status !== "CANCELLED");
  const activeAnnual    = annualObjs.filter(o => o.status !== "CANCELLED");
  const activeQuarterly = quarterlyObjs.filter(o => o.status !== "CANCELLED");
  const activeInitiatives = initiatives.filter(i => i.status !== "CANCELLED");

  // Pre-index backlog tree by initiative_id for quick lookup
  const epicsByInitiative = useMemo<Map<string, BacklogItem[]>>(() => {
    const m = new Map<string, BacklogItem[]>();
    for (const epic of backlogTree) {
      if (!epic.initiative_id) continue;
      const arr = m.get(epic.initiative_id) ?? [];
      arr.push(epic);
      m.set(epic.initiative_id, arr);
    }
    return m;
  }, [backlogTree]);

  // Build tree roots
  const roots = useMemo<TreeNode[]>(() => {
    function mapStory(s: BacklogItem): TreeNode {
      return {
        id: s.id, layer: "story",
        label: s.title, status: s.status,
        subtitle: s.assignee_name ?? undefined,
        children: [],
      };
    }

    function mapFeature(f: BacklogItem): TreeNode {
      return {
        id: f.id, layer: "feature",
        label: f.title, progress: f.progress, status: f.status,
        subtitle: f.assignee_name ?? undefined,
        children: (f.children ?? []).map(mapStory),
      };
    }

    function mapEpic(e: BacklogItem): TreeNode {
      return {
        id: e.id, layer: "epic",
        label: e.title, progress: e.progress, status: e.status,
        subtitle: undefined,
        children: (e.children ?? []).map(mapFeature),
      };
    }

    function initiativeNodes(quarterlyId: string): TreeNode[] {
      const linkedIds = new Set(
        objectiveLinks
          .filter(l => l.objective_id === quarterlyId)
          .map(l => l.initiative_id),
      );
      return activeInitiatives
        .filter(i => linkedIds.has(i.id))
        .map(i => ({
          id: i.id, layer: "initiative" as LayerId,
          label: i.title, progress: i.progress, status: i.status,
          subtitle: i.owner_name ?? undefined,
          children: (epicsByInitiative.get(i.id) ?? []).map(mapEpic),
        }));
    }

    function quarterly(annualId: string): TreeNode[] {
      return activeQuarterly
        .filter(q => q.parent_objective_id === annualId)
        .map(q => ({
          id: q.id, layer: "quarterly" as LayerId,
          label: q.title, progress: q.progress, status: q.status,
          subtitle: q.team_name ?? q.owner_name ?? undefined,
          children: initiativeNodes(q.id),
        }));
    }

    function annual(stratId: string): TreeNode[] {
      return activeAnnual
        .filter(a => a.parent_objective_id === stratId)
        .map(a => ({
          id: a.id, layer: "annual" as LayerId,
          label: a.title, progress: a.progress, status: a.status,
          subtitle: a.owner_name ?? undefined,
          children: [...quarterly(a.id), ...initiativeNodes(a.id)],
        }));
    }

    function strategic(intentId: string | null): TreeNode[] {
      return activeStrat
        .filter(s => s.strategic_intent_id === intentId)
        .map(s => ({
          id: s.id, layer: "strategic" as LayerId,
          label: s.title, progress: s.progress, status: s.status,
          subtitle: s.owner_name ?? undefined,
          children: [...annual(s.id), ...initiativeNodes(s.id)],
        }));
    }

    const result: TreeNode[] = activeIntents.map(i => ({
      id: i.id, layer: "intent" as LayerId,
      label: i.title, progress: undefined, status: undefined,
      subtitle: undefined,
      children: strategic(i.id),
    }));

    const orphanStrat = strategic(null);
    if (orphanStrat.length > 0) {
      result.push({
        id: "__no_intent__",
        layer: "intent",
        label: "Sin intención estratégica",
        children: orphanStrat,
      });
    }

    return result;
  }, [activeIntents, activeStrat, activeAnnual, activeQuarterly, activeInitiatives, epicsByInitiative, objectiveLinks]);

  // When a filter is active, keep only the subtree containing the selected node
  const filteredRoots = useMemo<TreeNode[]>(() => {
    if (!externalSelection) return roots;
    const { id: selId } = externalSelection;

    const visibleIds = new Set<string>();

    function traverse(node: TreeNode, ancestors: string[]): boolean {
      const isMatch = node.id === selId;
      let childMatch = false;
      for (const child of node.children) {
        if (traverse(child, [...ancestors, node.id])) childMatch = true;
      }
      if (isMatch || childMatch) {
        ancestors.forEach(id => visibleIds.add(id));
        visibleIds.add(node.id);
        if (isMatch) {
          function addAll(n: TreeNode) { visibleIds.add(n.id); n.children.forEach(addAll); }
          node.children.forEach(addAll);
        }
        return true;
      }
      return false;
    }

    roots.forEach(root => traverse(root, []));
    if (visibleIds.size === 0) return roots; // selection not found — show all

    function pruneNode(node: TreeNode): TreeNode | null {
      if (!visibleIds.has(node.id)) return null;
      return { ...node, children: node.children.map(pruneNode).filter((n): n is TreeNode => n !== null) };
    }

    return roots.map(pruneNode).filter((n): n is TreeNode => n !== null);
  }, [roots, externalSelection]);

  const allIds = useMemo<string[]>(() => {
    const ids: string[] = [];
    function walk(node: TreeNode) {
      if (node.children.length > 0) {
        ids.push(node.id);
        node.children.forEach(walk);
      }
    }
    filteredRoots.forEach(walk);
    return ids;
  }, [filteredRoots]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(roots.map(r => r.id)),
  );

  // Expand all visible nodes when filter selection changes (not on every allIds recompute)
  const allIdsRef = useRef(allIds);
  allIdsRef.current = allIds;
  const prevSelKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = externalSelection ? `${externalSelection.layer}:${externalSelection.id}` : null;
    if (key === prevSelKeyRef.current) return;
    prevSelKeyRef.current = key;
    if (externalSelection) {
      setExpanded(new Set(allIdsRef.current));
    } else {
      setExpanded(new Set(roots.map(r => r.id)));
    }
  }, [externalSelection, roots]);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("width",  String(container.scrollWidth));
    svg.setAttribute("height", String(container.scrollHeight));
    filteredRoots.forEach(root => drawLines(svg, container, root, expanded));
  });

  const totalNodes =
    activeIntents.length + activeStrat.length + activeAnnual.length + activeQuarterly.length +
    activeInitiatives.length + backlogTree.length;

  if (filteredRoots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No hay datos para construir el árbol</p>
        <p className="text-xs text-muted-foreground/60">
          Crea intenciones estratégicas y OKRs vinculados para ver la jerarquía
        </p>
      </div>
    );
  }

  const btnZ = "h-7 w-7 rounded-lg border border-border/60 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-border flex items-center justify-center transition-colors shadow-sm";

  const hasOrphanAnnual = activeAnnual.some(
    a => !a.parent_objective_id || !activeStrat.some(s => s.id === a.parent_objective_id),
  );

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Compact toolbar — single row */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground/60">{totalNodes} nodos</span>
        {hasOrphanAnnual && (
          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3 shrink-0" />
            OKRs anuales sin vínculo estratégico
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setExpanded(new Set(allIds))}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Expandir todo
          </button>
          <button
            onClick={() => setExpanded(new Set())}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Colapsar todo
          </button>
          <div className="flex items-center gap-1 border-l border-border/40 pl-2">
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
      </div>

      {/* Scrollable diagram */}
      <div
        className="flex-1 min-h-0 overflow-auto rounded-xl border border-border/40 bg-muted/10"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div
          ref={containerRef}
          className="relative inline-flex items-start p-6"
          style={{ gap: H_GAP * 3, minWidth: "100%" }}
        >
          <svg
            ref={svgRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ zIndex: 0, overflow: "visible" }}
          />
          <div style={{ position: "relative", zIndex: 1, gap: H_GAP * 3 }} className="inline-flex items-start">
            {filteredRoots.map(root => (
              <TreeBranch
                key={root.id}
                node={root}
                nodeW={nodeW}
                expanded={expanded}
                toggle={toggle}
                onEdit={handleEdit}
                onCheckIn={handleCheckIn}
              />
            ))}
          </div>
        </div>
      </div>

      {checkInTarget && (
        <TraceabilityCheckInDrawer
          objectiveId={checkInTarget.id}
          objectiveTitle={checkInTarget.title}
          layer={checkInTarget.layer}
          onClose={() => setCheckInTarget(null)}
        />
      )}
    </div>
  );
}
