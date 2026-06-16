"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Lightbulb, Compass, CalendarRange, Zap, Rocket, Layers,
  Building2, Users, Target, Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/okr/ProgressRing";
import type { Objective } from "@/hooks/useObjectives";
import type { StrategicIntent } from "@/hooks/useStrategicIntents";
import type { Initiative, ObjectiveInitiativeLink } from "@/hooks/useInitiatives";
import type { BacklogItem } from "@/hooks/useBacklog";
import type { Agreement, AgreementLink } from "@/hooks/useAgreements";

// ── Types ──────────────────────────────────────────────────────────────────────

type PyramidLayer = "agreements" | "intents" | "strategic" | "annual" | "quarterly" | "initiatives" | "epics";

interface Selected { id: string; layer: PyramidLayer }

// ── Layer config ───────────────────────────────────────────────────────────────

const LAYERS: Array<{
  id: PyramidLayer;
  label: string;
  sublabel: string;
  Icon: React.ElementType;
  marginPct: number;
  accent: string;
  bg: string;
  border: string;
  chip: string;
  chipActive: string;
}> = [
  {
    id: "agreements", label: "Acuerdos", sublabel: "Junta · cliente · regulador",
    Icon: Handshake,     marginPct: 42,
    accent: "text-rose-700 dark:text-rose-300",
    bg:     "bg-rose-50  dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800",
    chip:       "bg-white dark:bg-rose-950/60 border-rose-200 dark:border-rose-700 text-rose-800 dark:text-rose-200",
    chipActive: "bg-rose-500 border-rose-500 text-white shadow-md ring-2 ring-rose-300 dark:ring-rose-700",
  },
  {
    id: "intents", label: "Intenciones estratégicas", sublabel: "Norte organizacional",
    Icon: Lightbulb,     marginPct: 34,
    accent: "text-violet-700 dark:text-violet-300",
    bg:     "bg-violet-50  dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800",
    chip:       "bg-white dark:bg-violet-950/60 border-violet-200 dark:border-violet-700 text-violet-800 dark:text-violet-200",
    chipActive: "bg-violet-500 border-violet-500 text-white shadow-md ring-2 ring-violet-300 dark:ring-violet-700",
  },
  {
    id: "strategic", label: "OKR Estratégico", sublabel: "Largo plazo · empresa",
    Icon: Compass,       marginPct: 26,
    accent: "text-indigo-700 dark:text-indigo-300",
    bg:     "bg-indigo-50  dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
    chip:       "bg-white dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200",
    chipActive: "bg-indigo-500 border-indigo-500 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700",
  },
  {
    id: "annual", label: "OKR Anual", sublabel: "Año fiscal",
    Icon: CalendarRange, marginPct: 18,
    accent: "text-blue-700 dark:text-blue-300",
    bg:     "bg-blue-50  dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    chip:       "bg-white dark:bg-blue-950/60 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200",
    chipActive: "bg-blue-500 border-blue-500 text-white shadow-md ring-2 ring-blue-300 dark:ring-blue-700",
  },
  {
    id: "quarterly", label: "OKR Trimestral", sublabel: "Equipos · 90 días",
    Icon: Zap,           marginPct: 10,
    accent: "text-amber-700 dark:text-amber-300",
    bg:     "bg-amber-50  dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    chip:       "bg-white dark:bg-amber-950/60 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200",
    chipActive: "bg-amber-500 border-amber-500 text-white shadow-md ring-2 ring-amber-300 dark:ring-amber-700",
  },
  {
    id: "initiatives", label: "Iniciativas", sublabel: "En ejecución",
    Icon: Rocket,        marginPct: 4,
    accent: "text-emerald-700 dark:text-emerald-300",
    bg:     "bg-emerald-50  dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    chip:       "bg-white dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200",
    chipActive: "bg-emerald-500 border-emerald-500 text-white shadow-md ring-2 ring-emerald-300 dark:ring-emerald-700",
  },
  {
    id: "epics", label: "Épicas", sublabel: "Backlog estratégico",
    Icon: Layers,        marginPct: 0,
    accent: "text-teal-700 dark:text-teal-300",
    bg:     "bg-teal-50  dark:bg-teal-950/30",
    border: "border-teal-200 dark:border-teal-800",
    chip:       "bg-white dark:bg-teal-950/60 border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-200",
    chipActive: "bg-teal-500 border-teal-500 text-white shadow-md ring-2 ring-teal-300 dark:ring-teal-700",
  },
];

// ── Chain computation ──────────────────────────────────────────────────────────

function computeChain(
  sel: Selected | null,
  agreements: Agreement[],
  agreementLinks: AgreementLink[],
  intents: StrategicIntent[],
  stratObjs: Objective[],
  annualObjs: Objective[],
  quarterlyObjs: Objective[],
  initiatives: Initiative[],
  epics: BacklogItem[],
  links: ObjectiveInitiativeLink[],
): Set<string> | null {
  if (!sel) return null;
  const ids = new Set<string>([sel.id]);

  // ── Descend ────────────────────────────────────────────────────────────────
  function descend(layer: PyramidLayer, idList: string[]) {
    if (!idList.length) return;
    switch (layer) {
      case "agreements": {
        const epicIds = agreementLinks.filter(l => idList.includes(l.agreement_id)).map(l => { ids.add(l.backlog_item_id); return l.backlog_item_id; });
        descend("epics", epicIds); break;
      }
      case "intents": {
        const next = stratObjs.filter(o => o.strategic_intent_id && idList.includes(o.strategic_intent_id)).map(o => { ids.add(o.id); return o.id; });
        descend("strategic", next); break;
      }
      case "strategic": {
        const initNext = links.filter(l => idList.includes(l.objective_id)).map(l => { ids.add(l.initiative_id); return l.initiative_id; });
        descend("initiatives", initNext);
        const next = annualObjs.filter(o => o.parent_objective_id && idList.includes(o.parent_objective_id)).map(o => { ids.add(o.id); return o.id; });
        descend("annual", next); break;
      }
      case "annual": {
        const initNext = links.filter(l => idList.includes(l.objective_id)).map(l => { ids.add(l.initiative_id); return l.initiative_id; });
        descend("initiatives", initNext);
        const next = quarterlyObjs.filter(o => o.parent_objective_id && idList.includes(o.parent_objective_id)).map(o => { ids.add(o.id); return o.id; });
        descend("quarterly", next); break;
      }
      case "quarterly": {
        const next = links.filter(l => idList.includes(l.objective_id)).map(l => { ids.add(l.initiative_id); return l.initiative_id; });
        descend("initiatives", next); break;
      }
      case "initiatives": {
        epics.filter(e => e.initiative_id && idList.includes(e.initiative_id)).forEach(e => ids.add(e.id)); break;
      }
    }
  }

  // ── Ascend ─────────────────────────────────────────────────────────────────
  if (sel.layer === "strategic") {
    const o = stratObjs.find(x => x.id === sel.id);
    if (o?.strategic_intent_id) ids.add(o.strategic_intent_id);
  }
  if (sel.layer === "annual") {
    const o = annualObjs.find(x => x.id === sel.id);
    if (o?.parent_objective_id) {
      ids.add(o.parent_objective_id);
      const s = stratObjs.find(x => x.id === o.parent_objective_id);
      if (s?.strategic_intent_id) ids.add(s.strategic_intent_id);
    }
  }
  if (sel.layer === "quarterly") {
    const o = quarterlyObjs.find(x => x.id === sel.id);
    if (o?.parent_objective_id) {
      ids.add(o.parent_objective_id);
      const a = annualObjs.find(x => x.id === o.parent_objective_id);
      if (a?.parent_objective_id) {
        ids.add(a.parent_objective_id);
        const s = stratObjs.find(x => x.id === a.parent_objective_id);
        if (s?.strategic_intent_id) ids.add(s.strategic_intent_id);
      }
    }
  }
  if (sel.layer === "initiatives") {
    links.filter(l => l.initiative_id === sel.id).forEach(l => {
      ids.add(l.objective_id);
      const q = quarterlyObjs.find(x => x.id === l.objective_id);
      if (q?.parent_objective_id) {
        ids.add(q.parent_objective_id);
        const a = annualObjs.find(x => x.id === q.parent_objective_id);
        if (a?.parent_objective_id) {
          ids.add(a.parent_objective_id);
          const s = stratObjs.find(x => x.id === a.parent_objective_id);
          if (s?.strategic_intent_id) ids.add(s.strategic_intent_id);
        }
      }
      const s = stratObjs.find(x => x.id === l.objective_id);
      if (s?.strategic_intent_id) ids.add(s.strategic_intent_id);
    });
  }
  if (sel.layer === "epics") {
    const e = epics.find(x => x.id === sel.id);
    if (e?.initiative_id) {
      ids.add(e.initiative_id);
      links.filter(l => l.initiative_id === e.initiative_id).forEach(l => ids.add(l.objective_id));
    }
    // Ascend to agreements that link to this epic
    agreementLinks.filter(l => l.backlog_item_id === sel.id).forEach(l => ids.add(l.agreement_id));
  }

  descend(sel.layer, [sel.id]);
  return ids;
}

// ── Chip ───────────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-green-400", DRAFT: "bg-gray-400", ACHIEVED: "bg-amber-400",
  CANCELLED: "bg-red-400", IN_PROGRESS: "bg-blue-400", DONE: "bg-green-400",
  TODO: "bg-gray-400", OPEN: "bg-gray-400",
};

function Chip({
  id, layer, label, progress, status, isSelected, inChain, hasSelection, onClick,
}: {
  id: string; layer: PyramidLayer; label: string;
  progress?: number; status?: string;
  isSelected: boolean; inChain: boolean; hasSelection: boolean;
  onClick: () => void;
}) {
  const cfg = LAYERS.find(l => l.id === layer)!;
  const dimmed = hasSelection && !inChain && !isSelected;

  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all duration-150 max-w-[200px] shrink-0",
        isSelected ? cfg.chipActive : cfg.chip,
        dimmed ? "opacity-20 pointer-events-none" : "hover:shadow-sm hover:scale-[1.02]",
        !isSelected && inChain && !hasSelection && cfg.chip,
        !isSelected && inChain && hasSelection && cn(cfg.chip, "ring-1 ring-current"),
      )}
    >
      {status && !isSelected && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[status] ?? "bg-gray-400")} />
      )}
      <span className="truncate max-w-[160px]">{label}</span>
      {progress != null && (
        <span className={cn("shrink-0 font-mono", isSelected ? "opacity-80" : "text-muted-foreground")}>
          {progress}%
        </span>
      )}
    </button>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  agreements?: Agreement[];
  agreementLinks?: AgreementLink[];
  intents: StrategicIntent[];
  stratObjs: Objective[];
  annualObjs: Objective[];
  quarterlyObjs: Objective[];
  initiatives: Initiative[];
  epics: BacklogItem[];
  objectiveLinks: ObjectiveInitiativeLink[];
  externalSelection?: { id: string; layer: string } | null;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function TraceabilityPyramid({
  agreements = [], agreementLinks = [],
  intents, stratObjs, annualObjs, quarterlyObjs,
  initiatives, epics, objectiveLinks, externalSelection,
}: Props) {
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    if (externalSelection) {
      const layer = externalSelection.layer as PyramidLayer;
      if (LAYERS.some(l => l.id === layer)) {
        setSelected({ id: externalSelection.id, layer });
      }
    } else {
      setSelected(null);
    }
  }, [externalSelection]);

  function toggle(id: string, layer: PyramidLayer) {
    setSelected(prev => prev?.id === id && prev.layer === layer ? null : { id, layer });
  }

  const chainIds = useMemo(
    () => computeChain(selected, agreements, agreementLinks, intents, stratObjs, annualObjs, quarterlyObjs, initiatives, epics, objectiveLinks),
    [selected, agreements, agreementLinks, intents, stratObjs, annualObjs, quarterlyObjs, initiatives, epics, objectiveLinks],
  );

  const activeAgreements   = agreements.filter(a => a.status !== "CANCELLED");
  const activeIntents      = intents.filter(i => i.status !== "CANCELLED");
  const activeStrategic    = stratObjs.filter(o => o.status !== "CANCELLED");
  const activeAnnual       = annualObjs.filter(o => o.status !== "CANCELLED");
  const activeQuarterly    = quarterlyObjs.filter(o => o.status !== "CANCELLED");
  const activeInitiatives  = initiatives.filter(i => i.status !== "CANCELLED");
  const activeEpics        = epics.filter(e => e.status !== "CANCELLED");

  const LAYER_ITEMS: Record<PyramidLayer, Array<{ id: string; label: string; progress?: number; status?: string; sub?: string }>> = {
    agreements:  activeAgreements.map(a => ({ id: a.id, label: a.title, status: a.status, sub: a.code })),
    intents:     activeIntents.map(i => ({ id: i.id, label: i.title, status: i.status })),
    strategic:   activeStrategic.map(o => ({ id: o.id, label: o.title, progress: o.progress, status: o.status, sub: o.code ?? undefined })),
    annual:      activeAnnual.map(o => ({ id: o.id, label: o.title, progress: o.progress, status: o.status, sub: o.code ?? undefined })),
    quarterly:   activeQuarterly.map(o => ({ id: o.id, label: o.title, progress: o.progress, status: o.status })),
    initiatives: activeInitiatives.map(i => ({ id: i.id, label: i.title, progress: i.progress, status: i.status })),
    epics:       activeEpics.map(e => ({ id: e.id, label: e.title, status: e.status })),
  };

  const totalItems = Object.values(LAYER_ITEMS).reduce((s, a) => s + a.length, 0);

  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <Target className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">Sin elementos para mostrar en la pirámide</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="py-6 min-h-full flex flex-col justify-center">
        {/* Selection hint */}
        {selected && (
          <div className="text-center mb-4">
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Limpiar selección — {chainIds!.size - 1} elemento{chainIds!.size !== 2 ? "s" : ""} en la cadena
            </button>
          </div>
        )}

        <div className="space-y-px">
          {LAYERS.map((layer, idx) => {
            const items = LAYER_ITEMS[layer.id];
            const Icon = layer.Icon;
            const isFirst = idx === 0;
            const isLast = idx === LAYERS.length - 1;

            return (
              <div
                key={layer.id}
                style={{
                  marginLeft:  `${layer.marginPct}%`,
                  marginRight: `${layer.marginPct}%`,
                }}
                className={cn(
                  "border px-4 py-3 transition-all",
                  layer.bg, layer.border,
                  isFirst && "rounded-t-2xl",
                  isLast  && "rounded-b-2xl",
                )}
              >
                {/* Layer header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/60 dark:bg-black/20")}>
                    <Icon className={cn("h-3.5 w-3.5", layer.accent)} />
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest", layer.accent)}>
                    {layer.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {items.length === 0 ? "sin elementos" : `${items.length} elemento${items.length !== 1 ? "s" : ""}`}
                  </span>
                </div>

                {/* Items */}
                {items.length === 0 ? (
                  <div className="flex items-center justify-center py-2 opacity-40">
                    <span className="text-[11px] text-muted-foreground italic">Vacío</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {items.map(item => (
                      <Chip
                        key={item.id}
                        id={item.id}
                        layer={layer.id}
                        label={item.label}
                        progress={item.progress}
                        status={item.status}
                        isSelected={selected?.id === item.id && selected.layer === layer.id}
                        inChain={chainIds?.has(item.id) ?? false}
                        hasSelection={!!selected}
                        onClick={() => toggle(item.id, layer.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
