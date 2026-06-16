"use client";

import { useRef, useState, useLayoutEffect, useCallback, useMemo, useEffect } from "react";
import { useObjectiveForest, type ObjectiveTreeNode, type TreeKR } from "@/hooks/useObjectives";
import { ProgressRing } from "@/components/okr/ProgressRing";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronRight, Plus, Pencil, User2, Building2, Users, UserCircle2,
  Target, ZoomOut, Maximize2,
} from "lucide-react";

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { label: string; border: string; bg: string; text: string; icon: React.ElementType }> = {
  COMPANY:    { label: "Empresa",    border: "border-l-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/20",      text: "text-blue-700 dark:text-blue-300",    icon: Building2 },
  AREA:       { label: "Área",       border: "border-l-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/20",  text: "text-violet-700 dark:text-violet-300", icon: Users },
  TEAM:       { label: "Equipo",     border: "border-l-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20",text: "text-emerald-700 dark:text-emerald-300",icon: Users },
  INDIVIDUAL: { label: "Individual", border: "border-l-orange-500",  bg: "bg-orange-50 dark:bg-orange-950/20",  text: "text-orange-700 dark:text-orange-300", icon: UserCircle2 },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CANCELLED: "bg-muted text-muted-foreground",
  DRAFT:     "bg-muted text-muted-foreground",
  AT_RISK:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function krChipClass(status: string, progress: number) {
  if (status === "COMPLETED") return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800";
  if (progress < 40) return "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800";
  if (progress < 70) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800";
  return "bg-muted text-muted-foreground border-border";
}

function statusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":    return "Activo";
    case "COMPLETED": return "Completado";
    case "DRAFT":     return "Borrador";
    case "CANCELLED": return "Cancelado";
    default:          return status;
  }
}

// ── Tree builder ──────────────────────────────────────────────────────────────

interface TreeNode extends ObjectiveTreeNode {
  children: TreeNode[];
}

function buildTree(flat: ObjectiveTreeNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of flat) map.set(n.id, { ...n, children: [] });
  const roots: TreeNode[] = [];
  for (const n of flat) {
    const node = map.get(n.id)!;
    if (n.parent_objective_id && map.has(n.parent_objective_id)) {
      map.get(n.parent_objective_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ── Node card ─────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: TreeNode;
  isExpanded: boolean;
  onToggle: () => void;
  onAddChild: (n: TreeNode) => void;
  onAddKr: (n: TreeNode) => void;
  onEdit?: (n: TreeNode) => void;
  cardRef: React.RefObject<HTMLDivElement>;
  searchTerm?: string;
  hideActions?: boolean;
}

function highlightText(text: string, term: string) {
  if (!term) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function NodeCard({ node, isExpanded, onToggle, onAddChild, onAddKr, onEdit, cardRef, searchTerm, hideActions = false }: NodeCardProps) {
  const meta = LEVEL_META[node.level] ?? LEVEL_META.COMPANY;
  const Icon = meta.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "w-[230px] rounded-xl border border-border/70 bg-card shadow-sm",
        "border-l-[3px] transition-shadow",
        meta.border,
        hovered && "shadow-md",
      )}
      style={{ zIndex: 2, position: "relative" }}
    >
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start gap-2">
          <ProgressRing progress={node.progress} size={48} status={node.status} className="shrink-0" />
          <div className="flex-1 min-w-0">
            {node.code && (
              <span className="text-[10px] font-mono font-semibold text-muted-foreground">{node.code}</span>
            )}
            <p className="text-[12px] font-semibold leading-tight line-clamp-2">{highlightText(node.title, searchTerm ?? "")}</p>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5", meta.bg, meta.text)}>
                <Icon className="h-2.5 w-2.5" />
                {meta.label}
              </span>
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", STATUS_COLORS[node.status] ?? STATUS_COLORS.DRAFT)}>
                {statusLabel(node.status)}
              </span>
            </div>
          </div>
          {node.children.length > 0 && (
            <button
              onClick={onToggle}
              className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
              aria-label={isExpanded ? "Colapsar" : "Expandir"}
            >
              <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
            </button>
          )}
        </div>

        {/* Owner + KR count */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 min-w-0">
            <User2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{node.owner_name ?? "Sin asignar"}</span>
          </span>
          {node.kr_count > 0 && (
            <span className="shrink-0 ml-1">{node.kr_count} KR{node.kr_count !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* KR chips */}
        {node.key_results.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {node.key_results.slice(0, 2).map((kr: TreeKR) => (
              <span
                key={kr.id}
                className={cn("text-[9px] px-1.5 py-0.5 rounded-full border leading-tight max-w-[100px] truncate", krChipClass(kr.status, kr.progress))}
                title={kr.title}
              >
                {kr.code ? `${kr.code} · ` : ""}{Math.round(kr.progress)}%
              </span>
            ))}
            {node.key_results.length > 2 && (
              <span className="text-[9px] text-muted-foreground self-center">+{node.key_results.length - 2}</span>
            )}
          </div>
        )}

        {/* Actions */}
        {!hideActions && (
          <div className="flex gap-1 pt-1.5 border-t border-border/50">
            {onEdit && (
              <>
                <button
                  onClick={() => onEdit(node)}
                  className="flex-1 flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded py-0.5 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <div className="w-px bg-border/50" />
              </>
            )}
            <button
              onClick={() => onAddChild(node)}
              className="flex-1 flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded py-0.5 transition-colors"
            >
              <Plus className="h-3 w-3" /> Hijo
            </button>
            <div className="w-px bg-border/50" />
            <button
              onClick={() => onAddKr(node)}
              className="flex-1 flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded py-0.5 transition-colors"
            >
              <Plus className="h-3 w-3" /> KR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tree branch (recursive) ───────────────────────────────────────────────────

interface BranchProps {
  node: TreeNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onAddChild: (n: TreeNode) => void;
  onAddKr: (n: TreeNode) => void;
  onEdit?: (n: TreeNode) => void;
  visibleIds?: Set<string>;
  searchTerm?: string;
  hideActions?: boolean;
}

function TreeBranch({ node, collapsed, onToggle, registerRef, onAddChild, onAddKr, onEdit, visibleIds, searchTerm, hideActions = false }: BranchProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible  = !visibleIds || visibleIds.has(node.id);
  // When searching, expand all; otherwise respect collapsed state
  const isExpanded = visibleIds ? true : !collapsed.has(node.id);

  // useLayoutEffect so refs are ready before parent computes SVG lines
  useLayoutEffect(() => {
    if (!isVisible) return;
    registerRef(node.id, cardRef.current);
    return () => registerRef(node.id, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="flex items-center gap-0">
      <NodeCard
        node={node}
        isExpanded={isExpanded}
        onToggle={() => onToggle(node.id)}
        onAddChild={onAddChild}
        onAddKr={onAddKr}
        onEdit={onEdit}
        cardRef={cardRef as React.RefObject<HTMLDivElement>}
        searchTerm={searchTerm}
        hideActions={hideActions}
      />

      {node.children.length > 0 && isExpanded && (
        <div className="ml-10 flex flex-col gap-4">
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              collapsed={collapsed}
              onToggle={onToggle}
              registerRef={registerRef}
              onAddChild={onAddChild}
              onAddKr={onAddKr}
              onEdit={onEdit}
              visibleIds={visibleIds}
              searchTerm={searchTerm}
              hideActions={hideActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface OkrTreeViewProps {
  cycleId?: string;
  cycleIds?: string[];
  hideActions?: boolean;
  search?: string;
  onAddChild: (node: ObjectiveTreeNode) => void;
  onAddKr: (node: ObjectiveTreeNode) => void;
  onEdit?: (node: ObjectiveTreeNode) => void;
}

interface SvgLine { x1: number; y1: number; x2: number; y2: number }

export function OkrTreeView({ cycleId, cycleIds, hideActions = false, search = "", onAddChild, onAddKr, onEdit }: OkrTreeViewProps) {
  const ids = cycleIds ?? (cycleId ? [cycleId] : []);
  const { data: flat, isLoading } = useObjectiveForest(ids);
  const tree = useMemo(() => buildTree(flat ?? []), [flat]);

  // IDs of nodes to show when searching: matching nodes + all their ancestors
  const visibleIds = useMemo(() => {
    if (!search) return undefined;
    const q = search.toLowerCase();
    const parentMap = new Map((flat ?? []).map(n => [n.id, n.parent_objective_id ?? ""]));
    const visible = new Set<string>();
    for (const n of (flat ?? [])) {
      if (!n.title.toLowerCase().includes(q)) continue;
      visible.add(n.id);
      let pid = parentMap.get(n.id);
      while (pid) { visible.add(pid); pid = parentMap.get(pid); }
    }
    return visible;
  }, [flat, search]);

  const containerRef  = useRef<HTMLDivElement>(null);
  const nodeRefs      = useRef<Map<string, HTMLDivElement>>(new Map());
  const [collapsed,   setCollapsed] = useState<Set<string>>(new Set());
  const [svgLines,    setSvgLines]  = useState<SvgLine[]>([]);
  const [svgDims,     setSvgDims]   = useState({ w: 0, h: 0 });

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else     nodeRefs.current.delete(id);
  }, []);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const computeLines = useCallback(() => {
    const el = containerRef.current;
    if (!el || !tree.length) return;

    const cRect = el.getBoundingClientRect();
    const { scrollLeft, scrollTop } = el;
    const lines: SvgLine[] = [];

    function visit(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (collapsed.has(node.id) || !node.children.length) continue;

        const parentEl = nodeRefs.current.get(node.id);
        if (!parentEl) { visit(node.children); continue; }

        const pr = parentEl.getBoundingClientRect();
        const x1 = pr.right - cRect.left + scrollLeft;
        const y1 = pr.top   - cRect.top  + scrollTop + pr.height / 2;

        for (const child of node.children) {
          const childEl = nodeRefs.current.get(child.id);
          if (!childEl) continue;
          const cr = childEl.getBoundingClientRect();
          const x2 = cr.left - cRect.left + scrollLeft;
          const y2 = cr.top  - cRect.top  + scrollTop + cr.height / 2;
          lines.push({ x1, y1, x2, y2 });
        }
        visit(node.children);
      }
    }

    visit(tree);
    setSvgLines(lines);
    setSvgDims({ w: el.scrollWidth, h: el.scrollHeight });
  }, [tree, collapsed]);

  // Recompute lines after layout (refs from children are registered via useLayoutEffect)
  useLayoutEffect(() => {
    computeLines();
  }, [computeLines, flat]);

  // Recompute lines on container resize
  useEffect(() => {
    const ctn = containerRef.current;
    if (!ctn) return;
    const ro = new ResizeObserver(() => computeLines());
    ro.observe(ctn);
    return () => ro.disconnect();
  }, [computeLines]);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    const allIds = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) { allIds.add(n.id); collect(n.children); }
    }
    collect(tree);
    setCollapsed(allIds);
  }, [tree]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-10">
            <Skeleton className="h-[110px] w-[230px] rounded-xl" />
            <Skeleton className="h-[110px] w-[230px] rounded-xl" />
            <Skeleton className="h-[110px] w-[230px] rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (!tree.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Target className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No hay objetivos en este ciclo</p>
        <p className="text-xs text-muted-foreground/70">Crea el primer objetivo desde la vista de lista</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {Object.entries(LEVEL_META).map(([level, meta]) => {
            const borderBg = meta.border.replace("border-l-", "bg-");
            return (
              <span key={level} className="flex items-center gap-1">
                <span className={cn("h-2.5 w-2.5 rounded-sm", borderBg)} />
                {meta.label}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Expandir todo
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" /> Colapsar todo
          </button>
        </div>
      </div>

      {/* Tree canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6"
        style={{ position: "relative" }}
      >
        {/* SVG connector lines */}
        {svgDims.w > 0 && (
          <svg
            width={svgDims.w}
            height={svgDims.h}
            className="absolute inset-0 pointer-events-none"
            style={{ top: 0, left: 0, zIndex: 1 }}
          >
            {svgLines.map((line, i) => {
              const mx = (line.x1 + line.x2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${line.x1} ${line.y1} C ${mx} ${line.y1} ${mx} ${line.y2} ${line.x2} ${line.y2}`}
                  className="stroke-border/70 fill-none"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
              );
            })}
          </svg>
        )}

        {/* Tree nodes */}
        <div className="flex flex-col gap-6 relative" style={{ zIndex: 2 }}>
          {tree.map((root) => (
            <TreeBranch
              key={root.id}
              node={root}
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              registerRef={registerRef}
              onAddChild={onAddChild}
              onAddKr={onAddKr}
              onEdit={onEdit}
              visibleIds={visibleIds}
              searchTerm={search || undefined}
              hideActions={hideActions}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
