"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  ChevronRight, Building2, Users, User, Briefcase,
  Target, Maximize2, ZoomOut, Plus, Link2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/okr/ProgressRing";
import {
  useObjectives, useCreateObjective, useUpdateObjective, type Objective,
} from "@/hooks/useObjectives";
import { type Cycle } from "@/hooks/useCycles";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_CFG = {
  COMPANY:    { label: "Empresa",    Icon: Building2, badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", card: "border-indigo-200 dark:border-indigo-700", line: "bg-indigo-300 dark:bg-indigo-600", header: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800" },
  AREA:       { label: "Área",       Icon: Briefcase, badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",         card: "border-blue-200 dark:border-blue-700",    line: "bg-blue-300 dark:bg-blue-600",    header: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800" },
  TEAM:       { label: "Equipo",     Icon: Users,     badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",     card: "border-amber-200 dark:border-amber-700",  line: "bg-amber-300 dark:bg-amber-600",  header: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" },
  INDIVIDUAL: { label: "Individual", Icon: User,      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", card: "border-emerald-200 dark:border-emerald-700", line: "bg-emerald-300 dark:bg-emerald-600", header: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" },
} as const;

type Level = keyof typeof LEVEL_CFG;
const LEVELS: Level[] = ["COMPANY", "AREA", "TEAM", "INDIVIDUAL"];
const LEVEL_ORDER: Record<string, number> = { COMPANY: 0, AREA: 1, TEAM: 2, INDIVIDUAL: 3 };
const CHILD_LEVEL: Record<string, Level> = { COMPANY: "AREA", AREA: "TEAM", TEAM: "INDIVIDUAL" };

// ── Tree types & builder ──────────────────────────────────────────────────────

interface TreeNode extends Objective { children: TreeNode[] }

function buildTree(flat: Objective[]): { roots: TreeNode[]; hasLinks: boolean } {
  const map = new Map<string, TreeNode>();
  for (const n of flat) map.set(n.id, { ...n, children: [] });

  let hasLinks = false;
  const childIds = new Set<string>();
  for (const n of flat) {
    if (n.parent_objective_id && map.has(n.parent_objective_id)) {
      map.get(n.parent_objective_id)!.children.push(map.get(n.id)!);
      childIds.add(n.id);
      hasLinks = true;
    }
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.title.localeCompare(b.title));
    for (const n of nodes) sort(n.children);
  };
  const roots = flat.filter(n => !childIds.has(n.id)).map(n => map.get(n.id)!);
  sort(roots);
  return { roots, hasLinks };
}

function collectAllIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (ns: TreeNode[]) => { for (const n of ns) { ids.push(n.id); walk(n.children); } };
  walk(nodes);
  return ids;
}

// ── Create Child Dialog ───────────────────────────────────────────────────────

function CreateChildDialog({
  open, onClose, parent, cycles,
}: {
  open: boolean;
  onClose: () => void;
  parent: Objective;
  cycles: Cycle[];
}) {
  const create = useCreateObjective();
  const defaultLevel = (CHILD_LEVEL[parent.level] ?? "AREA") as Level;
  const parentCycle  = cycles.find(c => c.id === parent.cycle_id);
  const defaultCycle = useMemo(() => {
    if (parentCycle?.type === "CUSTOM")   return cycles.find(c => c.type === "ANNUAL"    && c.status === "ACTIVE") ?? parentCycle;
    if (parentCycle?.type === "ANNUAL")   return cycles.find(c => c.type === "QUARTERLY" && c.status === "ACTIVE") ?? parentCycle;
    return parentCycle ?? cycles.find(c => c.status === "ACTIVE");
  }, [parentCycle, cycles]);

  const [form, setForm] = useState({
    title: "", description: "", level: defaultLevel, cycleId: defaultCycle?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ title: "", description: "", level: defaultLevel, cycleId: defaultCycle?.id ?? "" });
      setError(null);
    }
  }, [open, defaultLevel, defaultCycle?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        level: form.level,
        cycle_id: form.cycleId,
        parent_objective_id: parent.id,
      });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Error al crear el objetivo"));
    }
  }

  const activeCycles = cycles.filter(c => c.status === "ACTIVE");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar objetivo hijo</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            Bajo: {(parent as any).code && <span className="font-mono text-[10px] font-semibold mr-0.5">{(parent as any).code}</span>}<span className="font-medium text-foreground">{parent.title}</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Título</label>
            <Input
              required autoFocus
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="¿Qué quieres lograr?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nivel</label>
              <Select
                value={form.level}
                onChange={e => setForm(p => ({ ...p, level: e.target.value as Level }))}
              >
                {LEVELS.filter(l => LEVEL_ORDER[l] > LEVEL_ORDER[parent.level]).map(l => (
                  <SelectOption key={l} value={l}>{LEVEL_CFG[l].label}</SelectOption>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ciclo</label>
              <Select
                value={form.cycleId}
                onChange={e => setForm(p => ({ ...p, cycleId: e.target.value }))}
              >
                {activeCycles.map(c => (
                  <SelectOption key={c.id} value={c.id}>{c.name}</SelectOption>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="¿Por qué es importante?"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creando..." : "Crear objetivo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Link Parent Dialog ────────────────────────────────────────────────────────

function LinkParentDialog({
  open, onClose, node, allObjectives,
}: {
  open: boolean;
  onClose: () => void;
  node: Objective;
  allObjectives: Objective[];
}) {
  const update = useUpdateObjective();
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setSelectedId(""); setError(null); }
  }, [open]);

  const candidates = useMemo(() =>
    allObjectives
      .filter(o => o.id !== node.id && o.status !== "CANCELLED" && LEVEL_ORDER[o.level] < LEVEL_ORDER[node.level])
      .sort((a, b) => (LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]) || a.title.localeCompare(b.title)),
    [allObjectives, node],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({ id: node.id, parent_objective_id: selectedId });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Error al vincular"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular objetivo padre</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            Objetivo: <span className="font-medium text-foreground">{node.title}</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay objetivos de nivel superior disponibles.
            </p>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Selecciona el objetivo padre</label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {candidates.map(c => {
                  const cfg = LEVEL_CFG[c.level as Level];
                  const Icon = cfg.Icon;
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        selectedId === c.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <input
                        type="radio" name="parent" value={c.id}
                        checked={selectedId === c.id}
                        onChange={() => setSelectedId(c.id)}
                        className="sr-only"
                      />
                      <div className={cn("h-2 w-2 rounded-full shrink-0 border-2 transition-colors", selectedId === c.id ? "border-primary bg-primary" : "border-muted-foreground/40")} />
                      <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", cfg.badge)}>
                        <Icon className="h-2.5 w-2.5" />{cfg.label}
                      </span>
                      {c.code && <span className="font-mono text-[10px] font-semibold text-muted-foreground shrink-0">{c.code}</span>}
                      <span className="text-sm line-clamp-1 flex-1">{c.title}</span>
                      <ProgressRing progress={c.progress} size={20} status={c.status} className="shrink-0" />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!selectedId || update.isPending}>
              {update.isPending ? "Vinculando..." : "Vincular padre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared card actions ───────────────────────────────────────────────────────

function CardActions({
  node, allObjectives, cycles,
  onAddChild, onLinkParent,
}: {
  node: Objective;
  allObjectives: Objective[];
  cycles: Cycle[];
  onAddChild: (n: Objective) => void;
  onLinkParent: (n: Objective) => void;
}) {
  const canAddChild   = node.level !== "INDIVIDUAL" && node.status !== "CANCELLED";
  const canLinkParent = LEVEL_ORDER[node.level] > 0 && !node.parent_objective_id;
  const hasCandidates = allObjectives.some(
    o => o.id !== node.id && o.status !== "CANCELLED" && LEVEL_ORDER[o.level] < LEVEL_ORDER[node.level],
  );

  if (!canAddChild && !canLinkParent) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      {canLinkParent && hasCandidates && (
        <button
          onClick={e => { e.stopPropagation(); onLinkParent(node); }}
          className="flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-1 rounded-lg transition-colors"
        >
          <Link2 className="h-3 w-3" />
          Vincular padre
        </button>
      )}
      {canAddChild && (
        <button
          onClick={e => { e.stopPropagation(); onAddChild(node); }}
          className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors"
        >
          <Plus className="h-3 w-3" />
          Agregar hijo
        </button>
      )}
    </div>
  );
}

// ── Tree row (recursive) ──────────────────────────────────────────────────────

function TreeRow({
  node, collapsed, onToggle, onAddChild, onLinkParent, cycles, allObjectives,
}: {
  node: TreeNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (n: Objective) => void;
  onLinkParent: (n: Objective) => void;
  cycles: Cycle[];
  allObjectives: Objective[];
}) {
  const isExpanded = !collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  const cfg = LEVEL_CFG[node.level as Level] ?? LEVEL_CFG.COMPANY;
  const Icon = cfg.Icon;

  return (
    <div>
      <div className={cn("flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 bg-card hover:shadow-sm transition-shadow", cfg.card)}>
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "shrink-0 h-5 w-5 flex items-center justify-center rounded transition-colors",
            hasChildren ? "hover:bg-muted cursor-pointer" : "opacity-0 pointer-events-none",
          )}
        >
          <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform duration-150", isExpanded && hasChildren && "rotate-90")} />
        </button>
        <ProgressRing progress={node.progress} size={30} status={node.status} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            {node.code && (
              <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{node.code}</span>
            )}
            <p className="text-sm font-semibold leading-snug line-clamp-1">{node.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full", cfg.badge)}>
              <Icon className="h-2.5 w-2.5" />{cfg.label}
            </span>
            {node.team_name  && <span className="text-[10px] text-muted-foreground">{node.team_name}</span>}
            {node.owner_name && <span className="text-[10px] text-muted-foreground">· {node.owner_name}</span>}
          </div>
        </div>
        {node.kr_count > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
            {node.kr_count} KR{node.kr_count !== 1 ? "s" : ""}
          </span>
        )}
        <CardActions
          node={node} allObjectives={allObjectives} cycles={cycles}
          onAddChild={onAddChild} onLinkParent={onLinkParent}
        />
      </div>

      {isExpanded && hasChildren && (
        <div className="relative ml-10 mt-1 space-y-1.5">
          <div className={cn("absolute w-0.5 top-0 bottom-4", cfg.line)} style={{ left: "-16px" }} />
          {node.children.map(child => (
            <div key={child.id} className="relative">
              <div className={cn("absolute h-0.5 w-4", cfg.line)} style={{ left: "-16px", top: "21px" }} />
              <TreeRow
                node={child} collapsed={collapsed} onToggle={onToggle}
                onAddChild={onAddChild} onLinkParent={onLinkParent}
                cycles={cycles} allObjectives={allObjectives}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Level cascade (no parent links) ──────────────────────────────────────────

function LevelCascade({
  byLevel, allObjectives, cycles, onAddChild, onLinkParent,
}: {
  byLevel: Partial<Record<Level, Objective[]>>;
  allObjectives: Objective[];
  cycles: Cycle[];
  onAddChild: (n: Objective) => void;
  onLinkParent: (n: Objective) => void;
}) {
  const activeLevels = LEVELS.filter(l => (byLevel[l]?.length ?? 0) > 0);

  return (
    <div className="space-y-0">
      {activeLevels.map((level, idx) => {
        const nodes = byLevel[level]!;
        const cfg   = LEVEL_CFG[level];
        const Icon  = cfg.Icon;
        const isLast = idx === activeLevels.length - 1;

        return (
          <div key={level}>
            {/* Section header */}
            <div className={cn("rounded-xl border px-3 py-2 flex items-center gap-2", cfg.header)}>
              <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg shrink-0", cfg.badge)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn("text-xs font-bold", cfg.badge.split(" ").filter(c => c.startsWith("text-")).join(" "))}>
                {cfg.label}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">
                {nodes.length} objetivo{nodes.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Objective rows */}
            <div className="relative ml-8 mt-1 space-y-1.5">
              <div className={cn("absolute w-0.5 top-0 bottom-0", cfg.line)} style={{ left: "-16px" }} />
              {nodes.map(node => (
                <div key={node.id} className="relative">
                  <div className={cn("absolute h-0.5 w-4", cfg.line)} style={{ left: "-16px", top: "21px" }} />
                  <div className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-xl border-2 bg-card hover:shadow-sm transition-shadow", cfg.card)}>
                    <ProgressRing progress={node.progress} size={30} status={node.status} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug line-clamp-1">{node.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {node.team_name  && <span className="text-[10px] text-muted-foreground">{node.team_name}</span>}
                        {node.owner_name && <span className="text-[10px] text-muted-foreground">· {node.owner_name}</span>}
                      </div>
                    </div>
                    {node.kr_count > 0 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                        {node.kr_count} KR{node.kr_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    <CardActions
                      node={node} allObjectives={allObjectives} cycles={cycles}
                      onAddChild={onAddChild} onLinkParent={onLinkParent}
                    />
                  </div>
                </div>
              ))}
            </div>

            {!isLast && (
              <div className="flex flex-col items-center my-2 gap-0">
                <div className="w-0.5 h-3 bg-border/40" />
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />
                <div className="w-0.5 h-3 bg-border/40" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OKRCascadeTree({ cycles }: { cycles: Cycle[] }) {
  const strategicCycle = cycles.find(c => c.type === "CUSTOM"    && c.status === "ACTIVE");
  const annualCycle    = cycles.find(c => c.type === "ANNUAL"    && c.status === "ACTIVE");
  const quarterlyCycle = cycles.find(c => c.type === "QUARTERLY" && c.status === "ACTIVE");

  const { data: s = [], isLoading: ls } = useObjectives(strategicCycle?.id);
  const { data: a = [], isLoading: la } = useObjectives(annualCycle?.id);
  const { data: q = [], isLoading: lq } = useObjectives(quarterlyCycle?.id);

  const isLoading = ls || la || lq;

  const { roots, hasLinks, byLevel, allObjectives } = useMemo(() => {
    const seen = new Set<string>();
    const merged: Objective[] = [];
    for (const obj of [...s, ...a, ...q]) {
      if (!seen.has(obj.id) && obj.status !== "CANCELLED") {
        seen.add(obj.id);
        merged.push(obj);
      }
    }
    const { roots, hasLinks } = buildTree(merged);
    const byLevel: Partial<Record<Level, Objective[]>> = {};
    for (const obj of merged) {
      const lvl = obj.level as Level;
      if (!byLevel[lvl]) byLevel[lvl] = [];
      byLevel[lvl]!.push(obj);
    }
    for (const lvl of LEVELS) byLevel[lvl]?.sort((a, b) => a.title.localeCompare(b.title));
    return { roots, hasLinks, byLevel, allObjectives: merged };
  }, [s, a, q]);

  const [collapsed,     setCollapsed]     = useState<Set<string>>(new Set());
  const [addChildFor,   setAddChildFor]   = useState<Objective | null>(null);
  const [linkParentFor, setLinkParentFor] = useState<Objective | null>(null);

  const toggle      = useCallback((id: string) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const expandAll   = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => setCollapsed(new Set(collectAllIds(roots))), [roots]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-[52px] rounded-xl bg-muted/50 animate-pulse" />)}
      </div>
    );
  }

  if (!allObjectives.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Target className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Sin objetivos activos</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Crea el primer objetivo para ver el árbol</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {LEVELS.filter(l => (byLevel[l]?.length ?? 0) > 0).map(level => {
            const { Icon, badge, label } = LEVEL_CFG[level];
            return (
              <span key={level} className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full", badge)}>
                <Icon className="h-2.5 w-2.5" />{label} ({byLevel[level]!.length})
              </span>
            );
          })}
        </div>
        {hasLinks && (
          <div className="flex items-center gap-1">
            <button onClick={expandAll}   className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
              <Maximize2 className="h-3.5 w-3.5" /> Expandir todo
            </button>
            <button onClick={collapseAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
              <ZoomOut className="h-3.5 w-3.5" /> Colapsar todo
            </button>
          </div>
        )}
      </div>

      {/* Tree content */}
      {hasLinks ? (
        <div className="space-y-2">
          {roots.map(root => (
            <TreeRow
              key={root.id} node={root} collapsed={collapsed} onToggle={toggle}
              onAddChild={setAddChildFor} onLinkParent={setLinkParentFor}
              cycles={cycles} allObjectives={allObjectives}
            />
          ))}
        </div>
      ) : (
        <LevelCascade
          byLevel={byLevel} allObjectives={allObjectives} cycles={cycles}
          onAddChild={setAddChildFor} onLinkParent={setLinkParentFor}
        />
      )}

      {/* Dialogs */}
      {addChildFor && (
        <CreateChildDialog
          open={!!addChildFor}
          onClose={() => setAddChildFor(null)}
          parent={addChildFor}
          cycles={cycles}
        />
      )}
      {linkParentFor && (
        <LinkParentDialog
          open={!!linkParentFor}
          onClose={() => setLinkParentFor(null)}
          node={linkParentFor}
          allObjectives={allObjectives}
        />
      )}
    </div>
  );
}
