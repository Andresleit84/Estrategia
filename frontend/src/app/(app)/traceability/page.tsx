"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Network, GitBranch, SlidersHorizontal, X, Share2,
  Triangle, Download, ImageIcon, FileImage, Filter,
  Play, Pause, MonitorPlay, ChevronRight,
  AlertTriangle, CircleDot, Layers, Rocket, Target, Workflow, Loader2,
} from "lucide-react";
import { Select, SelectOption } from "@/components/ui/select";
import { TraceabilityView } from "@/components/okr/TraceabilityView";
import { TraceabilityTree } from "@/components/okr/TraceabilityTree";
import { TraceabilityPyramid } from "@/components/okr/TraceabilityPyramid";
import { TraceabilityDeployTree } from "@/components/okr/TraceabilityDeployTree";
import { useProblems } from "@/hooks/useProblems";
import { useStrategicIntents } from "@/hooks/useStrategicIntents";
import { useCycles } from "@/hooks/useCycles";
import { useAllObjectives, useObjectiveTree } from "@/hooks/useObjectives";
import { useInitiatives, useObjectiveInitiativeLinks } from "@/hooks/useInitiatives";
import { useBacklogTree, useBacklogStats, useBacklogList } from "@/hooks/useBacklog";
import { useAgreements, useAgreementLinks } from "@/hooks/useAgreements";
import { useUIStore } from "@/store/ui.store";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type LayerId = "agreements" | "problems" | "intents" | "strategic" | "annual" | "quarterly" | "initiatives" | "epics" | "features" | "stories";
type ViewMode = "columns" | "tree" | "pyramid" | "deploy";

// ── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, active, onClick }: {
  label: string; value: number | string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Filtrar por: ${label}`}
      className={cn(
        "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-card text-xs shrink-0 transition-all select-none",
        active
          ? "ring-1 ring-primary bg-primary/5 border-primary/30 font-medium text-foreground"
          : "border-border/60 hover:border-primary/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="font-bold tabular-nums text-foreground">{value}</span>
      <span>{label}</span>
      <Filter className={cn(
        "h-2.5 w-2.5 transition-opacity shrink-0",
        active ? "opacity-70" : "opacity-0 group-hover:opacity-40",
      )} />
    </button>
  );
}

// ── ViewToggle ────────────────────────────────────────────────────────────────

const VIEW_OPTIONS: Array<{ id: ViewMode; icon: React.ElementType; label: string }> = [
  { id: "columns",  icon: Network,   label: "Mapa"        },
  { id: "tree",     icon: GitBranch, label: "Árbol"       },
  { id: "pyramid",  icon: Triangle,  label: "Pirámide"    },
  { id: "deploy",   icon: Workflow,  label: "Despliegue"  },
];

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg shrink-0">
      {VIEW_OPTIONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={label}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            mode === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

type FilterItem = { id: string; title?: string; name?: string; [k: string]: unknown };
interface FilterLevel { id: LayerId; label: string; items: FilterItem[] }

function FilterBar({ levels, activeLayer, activeItemId, onSelectLayer, onSelectItem, onClear }: {
  levels: FilterLevel[];
  activeLayer: LayerId | null;
  activeItemId: string | null;
  onSelectLayer: (l: LayerId | null) => void;
  onSelectItem: (id: string | null) => void;
  onClear: () => void;
}) {
  const activeItems = levels.find(l => l.id === activeLayer)?.items ?? [];
  const displayName = (i: FilterItem) => (i.title as string) || (i.name as string) || i.id;

  return (
    <div className="flex items-center gap-2 shrink-0 min-w-0">
      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select
        value={activeLayer ?? ""}
        onChange={e => { onSelectLayer((e.target.value as LayerId) || null); onSelectItem(null); }}
        className="h-7 text-xs w-[180px] shrink-0 py-0"
      >
        <SelectOption value="">Todos los niveles</SelectOption>
        {levels.map(l => (
          <SelectOption key={l.id} value={l.id} disabled={l.items.length === 0}>
            {l.label} ({l.items.length})
          </SelectOption>
        ))}
      </Select>

      {activeLayer && activeItems.length > 0 && (
        <Select
          value={activeItemId ?? ""}
          onChange={e => onSelectItem(e.target.value || null)}
          className="h-7 text-xs w-[260px] shrink-0 py-0"
        >
          <SelectOption value="">— Todos —</SelectOption>
          {activeItems.map(item => (
            <SelectOption key={item.id} value={item.id}>{displayName(item)}</SelectOption>
          ))}
        </Select>
      )}

      {(activeLayer || activeItemId) && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-auto"
        >
          <X className="h-3.5 w-3.5" />
          Limpiar filtro
        </button>
      )}
    </div>
  );
}

// ── ActiveFilterBanner — shown inside canvas when filter active ───────────────

function ActiveFilterBanner({ layer, item, onClear }: {
  layer: string; item: string | null; onClear: () => void;
}) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm text-xs font-medium text-primary shadow-sm pointer-events-auto">
      <Filter className="h-3 w-3 shrink-0" />
      <span>Filtro activo: <strong>{layer}</strong>{item ? ` › ${item}` : ""}</span>
      <button onClick={onClear} className="ml-1 hover:text-primary/60 transition-colors" title="Quitar filtro">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── IconBtn — compact icon button with tooltip ────────────────────────────────

function IconBtn({ icon: Icon, label, active, onClick, disabled }: {
  icon: React.ElementType; label: string;
  active?: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-lg border text-xs transition-all shrink-0",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Gap types ─────────────────────────────────────────────────────────────────

interface GapItem {
  id:    string;
  code?: string | null;
  title: string;
  href:  string;
}

interface GapGroup {
  id:       string;
  label:    string;
  desc:     string;
  icon:     React.ElementType;
  severity: "critical" | "high" | "medium";
  items:    GapItem[];
}

const SEVERITY_STYLE = {
  critical: {
    dot:   "bg-rose-500",
    badge: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
    row:   "border-l-rose-400",
  },
  high: {
    dot:   "bg-amber-500",
    badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    row:   "border-l-amber-400",
  },
  medium: {
    dot:   "bg-sky-400",
    badge: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400",
    row:   "border-l-sky-400",
  },
};

function GapsPanel({ groups, onClose }: {
  groups: GapGroup[];
  onClose: () => void;
}) {
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="absolute right-0 top-0 bottom-0 z-30 flex flex-col w-80 bg-background border-l border-border shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">Brechas de cadena</span>
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">
                {total}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              OKRs sin KR · Iniciativas sin KR · Épicas sin iniciativa · Features sin épica
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-2">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Network className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-foreground/80">Sin brechas</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Todos los elementos están correctamente vinculados en la cadena estratégica.
            </p>
          </div>
        ) : (
          groups.filter(g => g.items.length > 0).map(group => {
            const s = SEVERITY_STYLE[group.severity];
            const Icon = group.icon;
            return (
              <div key={group.id} className="mb-4">
                {/* Group header */}
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-semibold text-foreground/80 flex-1 truncate">{group.label}</span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", s.badge)}>
                    {group.items.length}
                  </span>
                </div>
                <p className="px-4 pb-1.5 text-[10px] text-muted-foreground leading-relaxed">{group.desc}</p>

                {/* Items */}
                <div className="space-y-0.5 px-2">
                  {group.items.slice(0, 12).map(item => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border-l-2 hover:bg-muted/60 transition-colors group",
                        s.row,
                        "border border-border/40 border-l-2",
                      )}
                    >
                      {item.code && (
                        <span className="text-[9px] font-mono font-bold text-muted-foreground/60 shrink-0 w-12 truncate">
                          {item.code}
                        </span>
                      )}
                      <span className="flex-1 text-xs text-foreground/80 truncate group-hover:text-foreground">
                        {item.title}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                    </Link>
                  ))}
                  {group.items.length > 12 && (
                    <p className="px-3 py-1.5 text-[10px] text-muted-foreground">
                      +{group.items.length - 12} más…
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      {total > 0 && (
        <div className="shrink-0 px-4 py-2.5 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Haz clic en cada elemento para ir directamente a corregirlo.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TraceabilityPage() {
  const t = useTranslations("pages.traceability");
  const { enterPresentation, presentationMode } = useUIStore();
  const [viewMode, setViewMode]           = useState<ViewMode>("columns");
  const [filterLayer, setFilterLayer]     = useState<LayerId | null>(null);
  const [filterItemId, setFilterItemId]   = useState<string | null>(null);
  const [showAllRelations, setShowAll]    = useState(false);
  const [downloading, setDownloading]     = useState(false);
  const [showDownloadMenu, setShowDlMenu] = useState(false);
  const [tourActive, setTourActive]       = useState(false);
  const [tourIdx, setTourIdx]             = useState(0);
  const [showGaps, setShowGaps]           = useState(false);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const downloadRef  = useRef<HTMLDivElement>(null);
  const tourRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close download menu on outside click
  useEffect(() => {
    if (!showDownloadMenu) return;
    function handler(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setShowDlMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDownloadMenu]);

  const VIEW_LABEL: Record<ViewMode, string> = { columns: "mapa", tree: "arbol", pyramid: "piramide", deploy: "despliegue" };

  const downloadPng = useCallback(async (scale: number) => {
    if (!canvasRef.current) return;
    setDownloading(true);
    setShowDlMenu(false);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(canvasRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: scale,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `trazabilidad-${VIEW_LABEL[viewMode]}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }, [canvasRef, viewMode]);

  const { data: cycles = [], isPending: cyclesLoading } = useCycles();
  const { data: problems        = [] } = useProblems();
  const { data: intents         = [] } = useStrategicIntents();
  const { data: agreements      = [] } = useAgreements();
  const { data: agreementLinks  = [] } = useAgreementLinks();

  const strategicCycle = cycles.find(c => c.type === "CUSTOM"    && c.status === "ACTIVE");
  const annualCycle    = cycles.find(c => c.type === "ANNUAL"    && c.status === "ACTIVE");
  const quarterlyCycle = cycles.find(c => c.type === "QUARTERLY" && c.status === "ACTIVE");

  // Una sola llamada para todos los objetivos del org, en paralelo con cycles.
  // Elimina la dependencia secuencial cycles→objectives que causaba que algunos
  // ciclos (annual, quarterly) no cargaran en la primera visita directa a la página.
  const { data: allObjs = [], isPending: objsPending } = useAllObjectives();
  const stratObjs     = useMemo(() => allObjs.filter(o => o.cycle_id === strategicCycle?.id), [allObjs, strategicCycle?.id]);
  const annualObjs    = useMemo(() => allObjs.filter(o => o.cycle_id === annualCycle?.id),    [allObjs, annualCycle?.id]);
  const quarterlyObjs = useMemo(() => allObjs.filter(o => o.cycle_id === quarterlyCycle?.id), [allObjs, quarterlyCycle?.id]);

  // Tree nodes — single recursive query from strategic root covers all levels
  const { data: stratTree = [], isLoading: treeLoading       } = useObjectiveTree(strategicCycle?.id ?? null);
  const { data: initiatives   = [], isLoading: initLoading    } = useInitiatives();
  const { data: backlogTree   = [], isLoading: backlogLoading } = useBacklogTree();
  const { data: backlogStats       } = useBacklogStats();
  const { data: objectiveLinks = [], isLoading: linksLoading  } = useObjectiveInitiativeLinks();
  const { data: epics          = [], isLoading: epicsLoading  } = useBacklogList({ type: "EPIC" });
  const { data: features       = [] } = useBacklogList({ type: "FEATURE" });
  const { data: stories        = [] } = useBacklogList({ type: "STORY" });

  // cycles y allObjs usan isPending — cubren el gap del primer render (fetchStatus='idle').
  // init/links usan isLoading — tienen endpoints rápidos y retry confiable.
  const isLoadingAll = cyclesLoading || objsPending || initLoading || linksLoading;

  const activeAgreements  = agreements.filter(a => a.status !== "CANCELLED");
  const activeProblems    = problems.filter(p => p.status !== "RESOLVED" && p.status !== "DEPRIORITIZED");
  const activeIntents     = intents.filter(i => i.status !== "CANCELLED");
  const activeStrategic   = stratObjs.filter(o => o.status !== "CANCELLED");
  const activeAnnual      = annualObjs.filter(o => o.status !== "CANCELLED");
  const activeQuarterly   = quarterlyObjs.filter(o => o.status !== "CANCELLED");
  const activeInitiatives = initiatives.filter(i => i.status !== "CANCELLED");

  // ── Gap analysis — computed from already-loaded data ─────────────────────────
  const gapGroups = useMemo<GapGroup[]>(() => {
    const objsNoKr = [...activeStrategic, ...activeAnnual, ...activeQuarterly]
      .filter(o => o.kr_count === 0)
      .map(o => ({ id: o.id, code: o.code, title: o.title, href: "/strategic" }));

    const initsNoKr = activeInitiatives
      .filter(i => !(i as any).key_results?.length)
      .map(i => ({ id: i.id, code: (i as any).code, title: i.title, href: `/initiatives?open=${i.id}` }));

    const epicsNoInit = (epics as any[])
      .filter(e => !e.initiative_id)
      .map(e => ({ id: e.id, code: e.code, title: e.title, href: `/backlog?open=${e.id}` }));

    const featuresNoEpic = (features as any[])
      .filter(f => !f.parent_id)
      .map(f => ({ id: f.id, code: f.code, title: f.title, href: `/backlog?open=${f.id}` }));

    return [
      {
        id:       "obj-no-kr",
        label:    "OKRs sin resultado clave",
        desc:     "Sin KR no se puede medir el progreso. Define al menos un resultado clave por objetivo.",
        icon:     Target,
        severity: "critical",
        items:    objsNoKr,
      },
      {
        id:       "init-no-kr",
        label:    "Iniciativas sin KR vinculado",
        desc:     "La iniciativa no está alineada a ningún resultado clave del ciclo.",
        icon:     Rocket,
        severity: "high",
        items:    initsNoKr,
      },
      {
        id:       "epic-no-init",
        label:    "Épicas sin iniciativa",
        desc:     "Estas épicas no están conectadas a ninguna iniciativa estratégica.",
        icon:     Layers,
        severity: "medium",
        items:    epicsNoInit,
      },
      {
        id:       "feat-no-epic",
        label:    "Features sin épica padre",
        desc:     "Features huérfanas: no pertenecen a ninguna épica del backlog.",
        icon:     CircleDot,
        severity: "medium",
        items:    featuresNoEpic,
      },
    ];
  }, [activeStrategic, activeAnnual, activeQuarterly, activeInitiatives, epics, features]);

  const totalGaps = gapGroups.reduce((s, g) => s + g.items.length, 0);

  const filterLevels: FilterLevel[] = useMemo(() => [
    { id: "agreements",  label: "Acuerdos",             items: activeAgreements  as unknown as FilterItem[] },
    { id: "problems",    label: t("stats.problems"),    items: activeProblems    as unknown as FilterItem[] },
    { id: "intents",     label: t("stats.strategies"),  items: activeIntents     as unknown as FilterItem[] },
    { id: "strategic",   label: t("stats.strategic"),   items: activeStrategic   as unknown as FilterItem[] },
    { id: "annual",      label: t("stats.annual"),      items: activeAnnual      as unknown as FilterItem[] },
    { id: "quarterly",   label: t("stats.quarterly"),   items: activeQuarterly   as unknown as FilterItem[] },
    { id: "initiatives", label: t("stats.initiatives"), items: activeInitiatives as unknown as FilterItem[] },
    { id: "epics",       label: t("stats.epics"),       items: epics             as unknown as FilterItem[] },
    { id: "features",    label: "Feature",              items: features          as unknown as FilterItem[] },
    { id: "stories",     label: "Historia",             items: stories           as unknown as FilterItem[] },
  ], [activeProblems, activeIntents, activeStrategic, activeAnnual, activeQuarterly, activeInitiatives, epics, features, stories, t]);

  const externalSelection = useMemo(
    () => (filterLayer && filterItemId) ? { id: filterItemId, layer: filterLayer as string } : null,
    [filterLayer, filterItemId],
  );

  // Label for the active filter banner
  const activeFilterLabel = useMemo(() => {
    if (!filterLayer) return null;
    const level = filterLevels.find(l => l.id === filterLayer);
    if (!level) return null;
    const item = filterItemId ? level.items.find(i => i.id === filterItemId) : null;
    const itemName = item ? ((item.title as string) || (item.name as string) || "") : null;
    return { layer: level.label, item: itemName };
  }, [filterLayer, filterItemId, filterLevels]);

  // ── Tour mode ──────────────────────────────────────────────────────────────

  // Build the ordered list of [layer, id] pairs for the tour
  const tourItems = useMemo<Array<{ layer: LayerId; id: string; label: string }>>(() => {
    const items: Array<{ layer: LayerId; id: string; label: string }> = [];
    activeAgreements.forEach(a => items.push({ layer: "agreements", id: a.id, label: a.title }));
    activeIntents.forEach(i   => items.push({ layer: "intents",     id: i.id, label: i.title }));
    activeStrategic.forEach(o => items.push({ layer: "strategic",   id: o.id, label: o.title }));
    activeAnnual.forEach(o    => items.push({ layer: "annual",      id: o.id, label: o.title }));
    activeQuarterly.forEach(o => items.push({ layer: "quarterly",   id: o.id, label: o.title }));
    activeInitiatives.forEach(i => items.push({ layer: "initiatives", id: i.id, label: i.title }));
    epics.forEach(e           => items.push({ layer: "epics",       id: e.id, label: e.title }));
    return items;
  }, [activeAgreements, activeIntents, activeStrategic, activeAnnual, activeQuarterly, activeInitiatives, epics]);

  const tourCurrent = tourItems[tourIdx] ?? null;

  // Set filter to tour current item
  useEffect(() => {
    if (!tourActive || !tourCurrent) return;
    setFilterLayer(tourCurrent.layer);
    setFilterItemId(tourCurrent.id);
    tourRef.current = setTimeout(() => {
      setTourIdx(prev => {
        const next = prev + 1;
        if (next >= tourItems.length) {
          setTourActive(false);
          setFilterLayer(null);
          setFilterItemId(null);
          return 0;
        }
        return next;
      });
    }, 2800);
    return () => { if (tourRef.current) clearTimeout(tourRef.current); };
  }, [tourActive, tourIdx, tourCurrent, tourItems.length]);

  function startTour() {
    setTourIdx(0);
    setTourActive(true);
    if (viewMode !== "pyramid") setViewMode("pyramid");
  }

  function stopTour() {
    setTourActive(false);
    if (tourRef.current) clearTimeout(tourRef.current);
    setFilterLayer(null);
    setFilterItemId(null);
  }

  function clearFilter() { setFilterLayer(null); setFilterItemId(null); }

  return (
    <div className="flex flex-col gap-2 px-6 pt-3 pb-2 h-full">

      {/* ── Row 1 ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Title */}
        <div className="flex items-center gap-2 shrink-0">
          <Network className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground whitespace-nowrap">{t("title")}</span>
        </div>

        {/* Stats pills — scrollable, with hint that they're clickable filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0 px-1">
          {/* Gap pill — always first, amber when there are gaps */}
          <button
            type="button"
            onClick={() => setShowGaps(v => !v)}
            title="Ver elementos sin vincular en la cadena estratégica"
            className={cn(
              "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs shrink-0 transition-all select-none font-medium",
              showGaps
                ? "ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-400/60 text-amber-700 dark:text-amber-400"
                : totalGaps > 0
                  ? "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20"
                  : "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400",
            )}
          >
            <AlertTriangle className={cn("h-3 w-3 shrink-0", totalGaps > 0 ? "text-amber-500" : "text-emerald-500")} />
            <span className="font-bold tabular-nums">{totalGaps}</span>
            <span>{totalGaps === 1 ? "brecha" : "brechas"}</span>
          </button>
          <div className="w-px h-4 bg-border/50 shrink-0 mx-0.5" />
          {activeAgreements.length > 0 && (
            <StatPill label="Acuerdos"                value={activeAgreements.length}    active={filterLayer === "agreements"}  onClick={() => { setFilterLayer(l => l === "agreements"  ? null : "agreements");  setFilterItemId(null); }} />
          )}
          <StatPill label={t("stats.problems")}    value={activeProblems.length}      active={filterLayer === "problems"}    onClick={() => { setFilterLayer(l => l === "problems"    ? null : "problems");    setFilterItemId(null); }} />
          <StatPill label={t("stats.strategies")}  value={activeIntents.length}       active={filterLayer === "intents"}     onClick={() => { setFilterLayer(l => l === "intents"     ? null : "intents");     setFilterItemId(null); }} />
          <StatPill label={t("stats.strategic")}   value={activeStrategic.length}     active={filterLayer === "strategic"}   onClick={() => { setFilterLayer(l => l === "strategic"   ? null : "strategic");   setFilterItemId(null); }} />
          <StatPill label={t("stats.annual")}      value={activeAnnual.length}        active={filterLayer === "annual"}      onClick={() => { setFilterLayer(l => l === "annual"      ? null : "annual");      setFilterItemId(null); }} />
          <StatPill label={t("stats.quarterly")}   value={activeQuarterly.length}     active={filterLayer === "quarterly"}   onClick={() => { setFilterLayer(l => l === "quarterly"   ? null : "quarterly");   setFilterItemId(null); }} />
          <StatPill label={t("stats.initiatives")} value={activeInitiatives.length}   active={filterLayer === "initiatives"} onClick={() => { setFilterLayer(l => l === "initiatives" ? null : "initiatives"); setFilterItemId(null); }} />
          <StatPill label={t("stats.epics")}       value={backlogStats?.epics ?? backlogTree.length} active={filterLayer === "epics"} onClick={() => { setFilterLayer(l => l === "epics" ? null : "epics"); setFilterItemId(null); }} />
        </div>

        {/* Right controls — compact icon buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tour mode */}
          <IconBtn
            icon={tourActive ? Pause : Play}
            label={tourActive ? "Pausar recorrido" : "Recorrido automático — muestra cada elemento uno a uno"}
            active={tourActive}
            disabled={tourItems.length === 0}
            onClick={tourActive ? stopTour : startTour}
          />

          {/* Presentation mode */}
          {!presentationMode && (
            <IconBtn
              icon={MonitorPlay}
              label="Modo presentación — oculta el menú para presentar al cliente"
              onClick={() => enterPresentation("")}
            />
          )}

          {viewMode === "columns" && (
            <IconBtn
              icon={Share2}
              label={showAllRelations ? "Ocultar todas las relaciones" : "Ver todas las relaciones"}
              active={showAllRelations}
              onClick={() => setShowAll(v => !v)}
            />
          )}


          {/* Download */}
          <div ref={downloadRef} className="relative">
            <IconBtn
              icon={Download}
              label={downloading ? "Exportando…" : "Exportar vista como PNG"}
              disabled={downloading}
              onClick={() => setShowDlMenu(v => !v)}
            />
            {showDownloadMenu && (
              <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border bg-popover p-1.5 shadow-xl">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Exportar vista actual
                </p>
                <button onClick={() => downloadPng(2)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">Alta resolución</p>
                    <p className="text-[10px] text-muted-foreground">PNG 2×, ideal para presentaciones</p>
                  </div>
                </button>
                <button onClick={() => downloadPng(1)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors">
                  <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">Estándar</p>
                    <p className="text-[10px] text-muted-foreground">PNG 1×, web y documentos</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <ViewToggle
            mode={viewMode}
            onChange={m => { setViewMode(m); if (m !== "columns") setShowAll(false); setShowDlMenu(false); if (m === "deploy") { setFilterLayer(null); setFilterItemId(null); } }}
          />
        </div>
      </div>

      {/* ── Row 2: filter bar ── */}
      <FilterBar
        levels={filterLevels}
        activeLayer={filterLayer}
        activeItemId={filterItemId}
        onSelectLayer={setFilterLayer}
        onSelectItem={setFilterItemId}
        onClear={clearFilter}
      />

      {/* ── Canvas ── */}
      <div ref={canvasRef} className="flex-1 min-h-0 relative overflow-hidden">
        {/* Loading state — blocks canvas until ALL core queries have data on this mount */}
        {isLoadingAll && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm rounded-xl">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando cadena estratégica…</p>
          </div>
        )}

        {/* Tour mode overlay */}
        {tourActive && tourCurrent && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full border border-primary/40 bg-primary/10 backdrop-blur-sm shadow-lg pointer-events-auto">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-xs font-medium text-primary">
              {tourCurrent.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {tourIdx + 1}/{tourItems.length}
            </span>
            <button onClick={stopTour} className="text-muted-foreground hover:text-foreground transition-colors" title="Detener">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Active filter banner — visible across all views */}
        {!tourActive && activeFilterLabel && (
          <ActiveFilterBanner
            layer={activeFilterLabel.layer}
            item={activeFilterLabel.item}
            onClear={clearFilter}
          />
        )}

        {/* Gaps panel — slides in from right */}
        {showGaps && (
          <GapsPanel groups={gapGroups} onClose={() => setShowGaps(false)} />
        )}

        {viewMode === "columns" && !isLoadingAll && (
          <TraceabilityView
            cycles={cycles}
            problems={problems}
            intents={intents}
            stratObjs={stratObjs}
            annualObjs={annualObjs}
            quarterlyObjs={quarterlyObjs}
            initiatives={initiatives}
            epics={epics}
            features={features}
            stories={stories}
            objectiveLinks={objectiveLinks}
            externalSelection={externalSelection}
            showAllRelations={showAllRelations}
          />
        )}
        {viewMode === "tree" && (
          <TraceabilityTree
            intents={intents}
            stratObjs={stratObjs}
            annualObjs={annualObjs}
            quarterlyObjs={quarterlyObjs}
            initiatives={initiatives}
            backlogTree={backlogTree}
            objectiveLinks={objectiveLinks}
            externalSelection={externalSelection}
          />
        )}
        {viewMode === "pyramid" && (
          <TraceabilityPyramid
            agreements={activeAgreements}
            agreementLinks={agreementLinks}
            intents={activeIntents}
            stratObjs={activeStrategic}
            annualObjs={activeAnnual}
            quarterlyObjs={activeQuarterly}
            initiatives={activeInitiatives}
            epics={epics}
            objectiveLinks={objectiveLinks}
            externalSelection={externalSelection}
          />
        )}
        {viewMode === "deploy" && (
          <TraceabilityDeployTree
            stratObjs={stratTree.filter(o => o.status !== "CANCELLED" && o.depth === 0)}
            annualObjs={stratTree.filter(o => o.status !== "CANCELLED" && o.depth === 1)}
            quarterlyObjs={stratTree.filter(o => o.status !== "CANCELLED" && o.depth >= 2)}
            objectiveLinks={objectiveLinks}
            externalSelection={externalSelection}
          />
        )}
      </div>
    </div>
  );
}
