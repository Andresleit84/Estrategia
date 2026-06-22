"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useMyImpact, useMyItems,
  type ImpactNode, type ImpactNodeType,
} from "@/hooks/useBacklog";
import { useAllObjectives } from "@/hooks/useObjectives";
import { useBacklogList } from "@/hooks/useBacklog";
import { useCycles } from "@/hooks/useCycles";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  FileCode2, Layers, Rocket, TrendingUp, Target,
  Compass, Star, ArrowUpRight, GitBranch, CheckCircle2,
  ChevronDown, AlertTriangle, CheckCircle,
} from "lucide-react";

// ── Node entrance animation ──────────────────────────────────────────────────

const CHAIN_STYLE = `
@keyframes chain-in {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
.chain-node { animation: chain-in 0.35s ease both; }
`;

// ── Node config ───────────────────────────────────────────────────────────────

const NODE_CFG: Record<ImpactNodeType, {
  tKey:       string;
  icon:       React.ElementType;
  iconBg:     string;
  iconColor:  string;
  badge:      string;
  badgeText:  string;
  barColor:   string;
}> = {
  STORY:               { tKey: "typeStory",           icon: FileCode2,   iconBg: "bg-emerald-100 dark:bg-emerald-900/30",  iconColor: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/40",  badgeText: "text-emerald-700 dark:text-emerald-400", barColor: "bg-emerald-500" },
  FEATURE:             { tKey: "typeFeature",         icon: FileCode2,   iconBg: "bg-teal-100 dark:bg-teal-900/30",       iconColor: "text-teal-600 dark:text-teal-400",      badge: "bg-teal-100 dark:bg-teal-900/40",        badgeText: "text-teal-700 dark:text-teal-400",      barColor: "bg-teal-500" },
  EPIC:                { tKey: "typeEpic",            icon: Layers,      iconBg: "bg-cyan-100 dark:bg-cyan-900/30",       iconColor: "text-cyan-600 dark:text-cyan-400",      badge: "bg-cyan-100 dark:bg-cyan-900/40",        badgeText: "text-cyan-700 dark:text-cyan-400",      barColor: "bg-cyan-500" },
  INITIATIVE:          { tKey: "typeInitiative",      icon: Rocket,      iconBg: "bg-blue-100 dark:bg-blue-900/30",       iconColor: "text-blue-600 dark:text-blue-400",      badge: "bg-blue-100 dark:bg-blue-900/40",        badgeText: "text-blue-700 dark:text-blue-400",      barColor: "bg-blue-500" },
  KR:                  { tKey: "typeKr",              icon: TrendingUp,  iconBg: "bg-violet-100 dark:bg-violet-900/30",   iconColor: "text-violet-600 dark:text-violet-400",  badge: "bg-violet-100 dark:bg-violet-900/40",    badgeText: "text-violet-700 dark:text-violet-400",  barColor: "bg-violet-500" },
  OBJECTIVE_TEAM:      { tKey: "typeObjTeam",         icon: Target,      iconBg: "bg-purple-100 dark:bg-purple-900/30",   iconColor: "text-purple-600 dark:text-purple-400",  badge: "bg-purple-100 dark:bg-purple-900/40",    badgeText: "text-purple-700 dark:text-purple-400",  barColor: "bg-purple-500" },
  OBJECTIVE_AREA:      { tKey: "typeObjArea",         icon: Target,      iconBg: "bg-indigo-100 dark:bg-indigo-900/30",   iconColor: "text-indigo-600 dark:text-indigo-400",  badge: "bg-indigo-100 dark:bg-indigo-900/40",    badgeText: "text-indigo-700 dark:text-indigo-400",  barColor: "bg-indigo-500" },
  OBJECTIVE_COMPANY:   { tKey: "typeObjCompany",      icon: Target,      iconBg: "bg-blue-100 dark:bg-blue-900/30",       iconColor: "text-blue-700 dark:text-blue-300",      badge: "bg-blue-100 dark:bg-blue-900/40",        badgeText: "text-blue-700 dark:text-blue-300",      barColor: "bg-blue-600" },
  OBJECTIVE_INDIVIDUAL:{ tKey: "typeObjIndividual",   icon: Target,      iconBg: "bg-green-100 dark:bg-green-900/30",     iconColor: "text-green-600 dark:text-green-400",    badge: "bg-green-100 dark:bg-green-900/40",      badgeText: "text-green-700 dark:text-green-400",    barColor: "bg-green-500" },
  INTENT:              { tKey: "typeIntent",          icon: Compass,     iconBg: "bg-amber-100 dark:bg-amber-900/30",     iconColor: "text-amber-600 dark:text-amber-400",    badge: "bg-amber-100 dark:bg-amber-900/40",      badgeText: "text-amber-700 dark:text-amber-400",    barColor: "bg-amber-500" },
  VISION:              { tKey: "typeVision",          icon: Star,        iconBg: "bg-primary/10",                         iconColor: "text-primary",                          badge: "bg-primary/10",                          badgeText: "text-primary",                          barColor: "bg-primary" },
};

const TYPE_ABBREV_KEY: Record<string, string> = {
  STORY: "abbrevStory", FEATURE: "abbrevFeature", EPIC: "abbrevEpic",
};

function chainGapMessage(nodes: ImpactNode[], t: ReturnType<typeof useTranslations>): string {
  const lastType = nodes[nodes.length - 1]?.type;
  if (lastType === "INITIATIVE")          return t("partialKr");
  if (lastType === "KR")                  return t("partialObj");
  if (lastType?.startsWith("OBJECTIVE"))  return t("partialIntent");
  return t("partialVision");
}

function statusDot(status?: string) {
  if (!status) return null;
  const color =
    status === "IN_PROGRESS" || status === "ACTIVE"   ? "bg-emerald-500" :
    status === "OPEN"                                 ? "bg-slate-400" :
    status === "DONE" || status === "COMPLETED"       ? "bg-blue-500" :
    status === "AT_RISK"                              ? "bg-rose-500" :
    "bg-muted-foreground";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", color)} />;
}

// ── Item selector ─────────────────────────────────────────────────────────────

function ItemSelector({
  items, selectedId, onChange,
}: {
  items: { id: string; code: string; title: string; type: string }[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("components.impactChain");
  return (
    <div className="px-4 pt-3 pb-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {t("selectorLabel")}
      </p>
      <div className="relative">
        <select
          value={selectedId}
          onChange={e => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none rounded-lg border border-border bg-background",
            "pl-3 pr-8 py-2 text-xs font-medium text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
            "transition-colors cursor-pointer",
          )}
        >
          {items.map(item => (
            <option key={item.id} value={item.id}>
              [{t(TYPE_ABBREV_KEY[item.type] ?? "typeFeature")}] {item.code} — {item.title}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

// ── Single node row ───────────────────────────────────────────────────────────

function nodeHref(node: ImpactNode): string {
  if (!node.id) return node.href;
  if (node.type === 'STORY' || node.type === 'FEATURE' || node.type === 'EPIC') return `/backlog?open=${node.id}`;
  if (node.type === 'INITIATIVE') return `/initiatives?open=${node.id}`;
  return node.href;
}

function ChainNode({
  node, index, total, isMyItem,
}: {
  node: ImpactNode; index: number; total: number; isMyItem: boolean;
}) {
  const t        = useTranslations("components.impactChain");
  const cfg      = NODE_CFG[node.type];
  const Icon     = cfg.icon;
  const hasBelow = index < total - 1;
  const href     = nodeHref(node);

  return (
    <Link
      href={href}
      className={cn(
        "chain-node group flex items-start gap-3 px-4 py-2.5 rounded-xl transition-all duration-150",
        "hover:bg-muted/60",
        isMyItem && "bg-primary/5 hover:bg-primary/10",
      )}
      style={{ animationDelay: `${(total - 1 - index) * 70}ms` }}
    >
      {/* Left: icon + connector line */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
        <div className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
          cfg.iconBg,
          isMyItem && "ring-2 ring-primary/30",
        )}>
          <Icon className={cn("h-3.5 w-3.5", cfg.iconColor)} />
        </div>
        {hasBelow && (
          <div className="w-px flex-1 bg-border/50 mt-1" style={{ minHeight: 14 }} />
        )}
      </div>

      {/* Right: content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
            cfg.badge, cfg.badgeText,
          )}>
            {t(cfg.tKey)}
          </span>
          {node.code && (
            <span className="text-[10px] font-mono text-muted-foreground/70">{node.code}</span>
          )}
          {statusDot(node.status)}
          {isMyItem && (
            <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full ml-0.5">
              {t("youAreHere")}
            </span>
          )}
          <span className={cn(
            "ml-auto shrink-0 flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
            "border border-border/60 text-muted-foreground/70",
            "group-hover:border-primary/50 group-hover:text-primary group-hover:bg-primary/5 transition-all",
          )}>
            {t("view")} <ArrowUpRight className="h-2.5 w-2.5" />
          </span>
        </div>

        <p className={cn(
          "text-xs leading-snug mt-0.5 line-clamp-2",
          isMyItem ? "font-semibold text-foreground" : "font-medium text-foreground/80",
        )}>
          {node.title}
        </p>

        {node.progress !== undefined && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-muted max-w-[100px]">
              <div
                className={cn("h-full rounded-full transition-all", cfg.barColor)}
                style={{ width: `${Math.min(100, node.progress)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{node.progress}%</span>
            {node.confidence !== undefined && (
              <span className={cn(
                "text-[10px] tabular-nums",
                node.confidence >= 0.7 ? "text-emerald-600 dark:text-emerald-400" :
                node.confidence >= 0.4 ? "text-amber-500" : "text-rose-500",
              )}>
                conf. {Math.round(node.confidence * 100)}%
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Chain content ─────────────────────────────────────────────────────────────

function ChainContent({ data }: { data: { nodes: ImpactNode[]; complete: boolean } }) {
  const t          = useTranslations("components.impactChain");
  const displayed  = [...data.nodes].reverse();
  const myItemIdx  = displayed.length - 1;

  return (
    <>
      {data.complete ? (
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {t("completeChain")}
          </span>
        </div>
      ) : data.nodes.length === 1 ? (
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {t("noInitiative")}
          </span>
        </div>
      ) : data.nodes.length > 1 ? (
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {chainGapMessage(data.nodes, t)}
          </span>
        </div>
      ) : null}

      <div className="py-1">
        {displayed.map((node, i) => (
          <ChainNode
            key={`${node.type}-${node.code ?? i}`}
            node={node}
            index={i}
            total={displayed.length}
            isMyItem={i === myItemIdx}
          />
        ))}
      </div>
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ChainSkeleton() {
  return (
    <div className="space-y-0 px-2 py-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="flex items-start gap-3 px-2 py-2.5" style={{ opacity: 1 - i * 0.18 }}>
          <div className="flex flex-col items-center" style={{ width: 28 }}>
            <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
            {i < 3 && <div className="w-px flex-1 bg-border/30 mt-1" style={{ minHeight: 14 }} />}
          </div>
          <div className="flex-1 space-y-1.5 pb-1">
            <Skeleton className="h-3.5 w-16 rounded-full" />
            <Skeleton className={cn("h-3 rounded", i === 3 ? "w-2/3" : "w-full")} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Gap summary bar ───────────────────────────────────────────────────────────
// Lógica idéntica a trazabilidad/page.tsx gapGroups — mismas 4 categorías.

interface GapItem { id: string; code: string | null; title: string; href: string }
interface GapGroup { id: string; label: string; severity: "critical" | "high" | "medium"; items: GapItem[] }

function GapSummaryBar() {
  const { data: cycles  = [] } = useCycles();
  const { data: allObjs = [] } = useAllObjectives();
  const { data: epics   = [] } = useBacklogList({ type: "EPIC" });
  const { data: features= [] } = useBacklogList({ type: "FEATURE" });

  const groups = useMemo<GapGroup[]>(() => {
    const activeCycleIds = new Set(cycles.filter(c => c.status === "ACTIVE").map(c => c.id));

    // 1. OKRs sin resultado clave (kr_count === 0)
    const objsNoKr = allObjs
      .filter(o => activeCycleIds.has(o.cycle_id) && o.status !== "CANCELLED" && o.kr_count === 0)
      .map(o => ({ id: o.id, code: o.code, title: o.title, href: "/strategic" }));

    // 2. Épicas sin iniciativa vinculada
    const epicsNoInit = (epics as any[])
      .filter(e => !e.initiative_id)
      .map(e => ({ id: e.id, code: e.code, title: e.title, href: `/backlog?open=${e.id}` }));

    // 3. Features sin épica padre
    const featuresNoEpic = (features as any[])
      .filter(f => !f.parent_id)
      .map(f => ({ id: f.id, code: f.code, title: f.title, href: `/backlog?open=${f.id}` }));

    return [
      { id: "obj-no-kr",    label: "OKRs sin resultado clave",  severity: "critical" as const, items: objsNoKr    },
      { id: "epic-no-init", label: "Épicas sin iniciativa",     severity: "high"     as const, items: epicsNoInit },
      { id: "feat-no-epic", label: "Features sin épica",        severity: "medium"   as const, items: featuresNoEpic },
    ].filter(g => g.items.length > 0);
  }, [cycles, allObjs, epics, features]);

  const total = groups.reduce((s, g) => s + g.items.length, 0);

  if (total === 0) {
    return (
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-t bg-emerald-50/50 dark:bg-emerald-950/10">
        <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
          Sin brechas — cadena estratégica completa
        </span>
      </div>
    );
  }

  const severityColor: Record<string, string> = {
    critical: "text-rose-600 dark:text-rose-400",
    high:     "text-amber-600 dark:text-amber-400",
    medium:   "text-yellow-600 dark:text-yellow-400",
  };

  return (
    <div className="border-t">
      {/* Header */}
      <Link
        href="/traceability"
        className="flex items-center justify-between gap-2 px-4 py-2.5 bg-amber-50/70 dark:bg-amber-950/15 hover:bg-amber-100/60 dark:hover:bg-amber-950/25 transition-colors group"
      >
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Brechas pendientes
          </span>
          <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded-full tabular-nums">
            {total}
          </span>
        </div>
        <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
          Ver en trazabilidad <ArrowUpRight className="h-2.5 w-2.5" />
        </span>
      </Link>

      {/* Lista por categoría */}
      <div className="divide-y divide-border/40">
        {groups.map(group => (
          <div key={group.id} className="px-4 py-2">
            <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1", severityColor[group.severity])}>
              {group.label} ({group.items.length})
            </p>
            <div className="space-y-0.5">
              {group.items.slice(0, 4).map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-1.5 py-0.5 hover:text-primary transition-colors"
                >
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                  {item.code && (
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{item.code}</span>
                  )}
                  <span className="text-[10px] text-foreground/70 truncate">{item.title}</span>
                </Link>
              ))}
              {group.items.length > 4 && (
                <Link href="/traceability" className="text-[10px] text-muted-foreground hover:text-primary transition-colors pl-2.5">
                  +{group.items.length - 4} más…
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function ImpactChainWidget() {
  const t = useTranslations("components.impactChain");
  const { data: items, isLoading: itemsLoading } = useMyItems();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  // Use explicit selection or let backend auto-pick
  const activeId = selectedId ?? items?.[0]?.id;
  const { data, isLoading: chainLoading } = useMyImpact(activeId);

  const isLoading = itemsLoading || chainLoading;

  if (isLoading) return <ChainSkeleton />;

  if (!items || items.length === 0 || !data || data.nodes.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="h-11 w-11 rounded-xl bg-muted/80 flex items-center justify-center mx-auto mb-3 border border-border/50">
          <GitBranch className="h-5 w-5 text-muted-foreground/70" />
        </div>
        <p className="text-sm font-semibold text-foreground/70">{t("noActiveItems")}</p>
        <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[230px] mx-auto leading-relaxed">
          {t("noActiveItemsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-transparent">
      <style>{CHAIN_STYLE}</style>

      {/* Selector — only when user has multiple active items */}
      {items.length > 1 && (
        <ItemSelector
          items={items}
          selectedId={activeId!}
          onChange={setSelectedId}
        />
      )}

      <ChainContent data={data} />
      <GapSummaryBar />
    </div>
  );
}
