"use client";

import { useState, useEffect, useRef } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  Sparkles, Globe, Building2, ChevronRight, Download, Check, X, Trash2,
  AlertCircle, Loader2, ChevronDown, ChevronUp, RefreshCw,
  Shield, TrendingUp, BarChart3, FileText, ArrowRight, Plus, Users, MapPin,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  useAiDiagnosticList, useAiDiagnosticOne, useCreateDiagnostic,
  useRegenerateDiagnostic, useDeleteDiagnostic,
  type DiagnosticReport, type SwotItem, type DiagnosticContent,
} from "@/hooks/useAiDiagnostic";
import { useCreateProblem, type Problem } from "@/hooks/useProblems";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";

// ─── Country list ─────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "EC", name: "Ecuador" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Perú" },
  { code: "BO", name: "Bolivia" },
  { code: "VE", name: "Venezuela" },
  { code: "MX", name: "México" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panamá" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "República Dominicana" },
  { code: "HT", name: "Haití" },
  { code: "JM", name: "Jamaica" },
  { code: "TT", name: "Trinidad y Tobago" },
  { code: "BR", name: "Brasil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "UY", name: "Uruguay" },
  { code: "PY", name: "Paraguay" },
  { code: "PR", name: "Puerto Rico" },
  { code: "ES", name: "España" },
  { code: "US", name: "Estados Unidos" },
];

// ─── SWOT config ──────────────────────────────────────────────────────────────

const SWOT_CONFIG = {
  strengths:    { label: "Fortalezas",   bg: "bg-emerald-50 dark:bg-emerald-950/20",  border: "border-emerald-200 dark:border-emerald-800", header: "bg-emerald-600", icon: "▲", textColor: "text-emerald-700 dark:text-emerald-400" },
  weaknesses:   { label: "Debilidades",  bg: "bg-red-50 dark:bg-red-950/20",          border: "border-red-200 dark:border-red-800",          header: "bg-red-600",     icon: "▼", textColor: "text-red-700 dark:text-red-400" },
  opportunities:{ label: "Oportunidades",bg: "bg-indigo-50 dark:bg-indigo-950/20",    border: "border-indigo-200 dark:border-indigo-800",    header: "bg-indigo-600",  icon: "◆", textColor: "text-indigo-700 dark:text-indigo-400" },
  threats:      { label: "Amenazas",     bg: "bg-amber-50 dark:bg-amber-950/20",       border: "border-amber-200 dark:border-amber-800",      header: "bg-amber-600",   icon: "⚠", textColor: "text-amber-700 dark:text-amber-400" },
};

type SwotKey = keyof typeof SWOT_CONFIG;

// ─── Swot Item Card ───────────────────────────────────────────────────────────

function SwotItemCard({
  item, quadrant, selected, onToggle,
}: {
  item: SwotItem; quadrant: SwotKey; selected: boolean; onToggle: () => void;
}) {
  const cfg = SWOT_CONFIG[quadrant];
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all cursor-pointer",
        cfg.bg, cfg.border,
        selected && "ring-2 ring-primary ring-offset-1",
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          "mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
          selected ? "bg-primary border-primary" : "border-muted-foreground/40 bg-background",
        )}>
          {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold leading-snug", cfg.textColor)}>{item.title}</p>
          {item.description && (
            <p className={cn(
              "text-xs text-muted-foreground mt-1 leading-relaxed",
              !expanded && "line-clamp-2",
            )}>
              {item.description}
            </p>
          )}
          {item.description && item.description.length > 100 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-0.5"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Menos" : "Más"}
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono shrink-0">{item.id}</div>
      </div>
    </div>
  );
}

// ─── Category config ──────────────────────────────────────────────────────────

const VALID_CATEGORIES: Problem["category"][] = [
  "PEOPLE","PROCESS","TECHNOLOGY","MARKET","CULTURE","FINANCIAL","OPERATIONAL","OTHER",
];
const CATEGORY_LABELS: Record<Problem["category"], string> = {
  PEOPLE: "Personas", PROCESS: "Proceso", TECHNOLOGY: "Tecnología",
  MARKET: "Mercado", CULTURE: "Cultura", FINANCIAL: "Financiero",
  OPERATIONAL: "Operacional", OTHER: "Otro",
};
function toValidCategory(raw: string | undefined): Problem["category"] {
  const upper = (raw ?? "").toUpperCase() as Problem["category"];
  return VALID_CATEGORIES.includes(upper) ? upper : "OTHER";
}

// ─── Score Buttons ────────────────────────────────────────────────────────────

function ScoreButtons({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "h-8 w-8 rounded-md border text-sm font-medium transition-colors",
            value === v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─── Review Import Dialog ─────────────────────────────────────────────────────

interface EditableItem {
  swotId: string;
  title: string;
  description: string;
  category: Problem["category"];
  severity: number;
  frequency: number;
}

function ReviewImportDialog({
  items: initialItems,
  onClose,
  onSuccess,
}: {
  items: EditableItem[];
  onClose: () => void;
  onSuccess: (count: number) => void;
}) {
  const [items, setItems] = useState<EditableItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const createProblem = useCreateProblem();

  function update(index: number, field: keyof EditableItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    setErrors((prev) => { const next = { ...prev }; delete next[index]; return next; });
  }

  async function handleSave() {
    const newErrors: Record<number, string> = {};
    items.forEach((item, i) => {
      if (!item.title.trim()) newErrors[i] = "El título es requerido";
    });
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    let saved = 0;
    for (const item of items) {
      try {
        await createProblem.mutateAsync({
          title: item.title.trim(),
          description: item.description.trim() || undefined,
          category: item.category,
          severity: item.severity,
          frequency: item.frequency,
        });
        saved++;
      } catch {
        // continue with the rest
      }
    }
    setSaving(false);
    onSuccess(saved);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Registrar como problemas organizacionales
            </DialogTitle>
            <DialogDescription>
              Revisa y edita cada ítem antes de registrarlo. Los campos de severidad y frecuencia determinan la prioridad.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.map((item, i) => (
            <div key={item.swotId} className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.swotId}</span>
                {errors[i] && <span className="text-xs text-destructive">{errors[i]}</span>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Título</label>
                <Input
                  value={item.title}
                  onChange={(e) => update(i, "title", e.target.value)}
                  className={cn("h-9 text-sm", errors[i] && "border-destructive")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Descripción</label>
                <Textarea
                  value={item.description}
                  onChange={(e) => update(i, "description", e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                  <Select
                    value={item.category}
                    onChange={(e) => update(i, "category", e.target.value)}
                    className="h-9 text-sm"
                  >
                    {VALID_CATEGORIES.map((c) => (
                      <SelectOption key={c} value={c}>{CATEGORY_LABELS[c]}</SelectOption>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Severidad (1–5)</label>
                  <ScoreButtons value={item.severity} onChange={(v) => update(i, "severity", v)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Frecuencia (1–5)</label>
                  <ScoreButtons value={item.frequency} onChange={(v) => update(i, "frequency", v)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{items.length} problema{items.length !== 1 ? "s" : ""} a registrar</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Registrar {items.length} problema{items.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report View ──────────────────────────────────────────────────────────────

function ReportView({
  report, onDownload,
}: {
  report: DiagnosticReport;
  onDownload: () => void;
}) {
  const content = report.content as DiagnosticContent | undefined;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewItems, setReviewItems] = useState<EditableItem[] | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const [tab, setTab] = useState("entity");

  const swot = content?.swot;
  const allItems = swot
    ? [...(swot.strengths ?? []), ...(swot.weaknesses ?? []), ...(swot.opportunities ?? []), ...(swot.threats ?? [])]
    : [];

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(quadrant: SwotKey) {
    const ids = swot?.[quadrant]?.map((i) => i.id) ?? [];
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function handleOpenReview() {
    if (!selected.size) return;
    const items = Array.from(selected)
      .map((id) => allItems.find((i) => i.id === id))
      .filter(Boolean)
      .map((item) => ({
        swotId: item!.id,
        title: item!.title ?? "",
        description: item!.description ?? "",
        category: toValidCategory(item!.category),
        severity: Math.max(1, Math.min(5, item!.severity ?? 3)),
        frequency: Math.max(1, Math.min(5, item!.frequency ?? 3)),
      }));
    setReviewItems(items);
  }

  if (!content) return null;

  return (
    <div className="space-y-4">
      {reviewItems && (
        <ReviewImportDialog
          items={reviewItems}
          onClose={() => setReviewItems(null)}
          onSuccess={(count) => {
            setReviewItems(null);
            setSelected(new Set());
            setImportSuccess(count);
            setTimeout(() => setImportSuccess(null), 4000);
          }}
        />
      )}

      {/* Header actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{report.org_name}</p>
          <p className="text-xs text-muted-foreground">{report.country_name} · {new Date(report.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        {selected.size > 0 && (
          <Button size="sm" onClick={handleOpenReview} className="gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Registrar {selected.size} problema{selected.size !== 1 ? "s" : ""}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onDownload} className="gap-1.5 shrink-0">
          <Download className="h-3.5 w-3.5" /> Descargar PDF
        </Button>
      </div>

      {importSuccess !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          {importSuccess} ítem{importSuccess !== 1 ? "s" : ""} importado{importSuccess !== 1 ? "s" : ""} al diagnóstico organizacional.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="entity" className="flex-1 gap-1.5"><Building2 className="h-3.5 w-3.5" />Entidad</TabsTrigger>
          <TabsTrigger value="swot" className="flex-1 gap-1.5"><BarChart3 className="h-3.5 w-3.5" />FODA</TabsTrigger>
          <TabsTrigger value="regulatory" className="flex-1 gap-1.5"><Shield className="h-3.5 w-3.5" />Regulatorio</TabsTrigger>
          <TabsTrigger value="benchmark" className="flex-1 gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Benchmark</TabsTrigger>
          <TabsTrigger value="recommendations" className="flex-1 gap-1.5"><FileText className="h-3.5 w-3.5" />Recomendaciones</TabsTrigger>
        </TabsList>

        {/* ── Entity tab ── */}
        <TabsContent value="entity" className="mt-4 space-y-4">
          {content.entity_profile && (() => {
            const ep = content.entity_profile;
            const sizeLabel: Record<string, string> = { MICRO: "Micro", SMALL: "Pequeña", MEDIUM: "Mediana", LARGE: "Grande" };
            const scopeLabel: Record<string, string> = { LOCAL: "Local", REGIONAL: "Regional", NATIONAL: "Nacional" };
            return (
              <>
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: ep.type,                         color: "bg-blue-600" },
                    { label: sizeLabel[ep.estimated_size] ?? ep.estimated_size, color: "bg-slate-700" },
                    { label: scopeLabel[ep.geographic_scope] ?? ep.geographic_scope, color: "bg-indigo-600" },
                  ].filter(b => b.label).map((b, i) => (
                    <span key={i} className={`${b.color} text-white text-xs font-semibold px-3 py-1 rounded-full`}>{b.label}</span>
                  ))}
                </div>

                {/* Sector + regulatory */}
                {(ep.sector || ep.regulatory_classification) && (
                  <Card className="p-4 border-l-4 border-l-blue-500">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Sector / Clasificación regulatoria</p>
                    <p className="text-sm text-foreground">{[ep.sector, ep.regulatory_classification].filter(Boolean).join("  ·  ")}</p>
                  </Card>
                )}

                {/* Strategic moment */}
                {ep.strategic_moment && (
                  <Card className="p-4 bg-primary/5 border-primary/20">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Momento estratégico actual</p>
                    <p className="text-sm text-foreground leading-relaxed">{ep.strategic_moment}</p>
                  </Card>
                )}

                {/* Typical structure */}
                {ep.typical_structure && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Estructura organizativa</p>
                    <p className="text-sm text-foreground leading-relaxed">{ep.typical_structure}</p>
                  </div>
                )}

                {/* Key services */}
                {ep.key_services?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Productos y servicios principales</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ep.key_services.map((s: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-blue-500 mt-0.5 shrink-0">›</span>{s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Member profile */}
                {ep.member_or_client_profile && (
                  <Card className="p-4 border-l-4 border-l-indigo-500">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Perfil de socios / clientes
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{ep.member_or_client_profile}</p>
                  </Card>
                )}

                {/* Market position */}
                {ep.market_position && (
                  <Card className="p-4 border-l-4 border-l-emerald-500">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Posición en el mercado
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{ep.market_position}</p>
                  </Card>
                )}

                {/* Key figures */}
                {ep.key_figures && (
                  <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Datos clave del sector</p>
                    <p className="text-sm text-foreground leading-relaxed">{ep.key_figures}</p>
                  </Card>
                )}

                {/* Historical context */}
                {ep.historical_context && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contexto histórico</p>
                    <p className="text-sm text-foreground leading-relaxed">{ep.historical_context}</p>
                  </div>
                )}

                {/* Organizational context */}
                {content.organizational_context && (
                  <Card className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contexto organizacional y de mercado</p>
                    <p className="text-sm text-foreground leading-relaxed">{content.organizational_context}</p>
                  </Card>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* ── FODA tab ── */}
        <TabsContent value="swot" className="mt-4 space-y-3">
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Selecciona ítems para importarlos como problemas en el diagnóstico organizacional
            </p>
          )}
          {!selected.size && (
            <p className="text-xs text-muted-foreground text-center">
              Haz clic en los ítems para seleccionarlos e importarlos al diagnóstico
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(Object.entries(SWOT_CONFIG) as [SwotKey, typeof SWOT_CONFIG[SwotKey]][]).map(([key, cfg]) => {
              const items = swot?.[key] ?? [];
              const selectedCount = items.filter((i) => selected.has(i.id)).length;

              return (
                <div key={key} className={cn("rounded-xl border overflow-hidden", cfg.border)}>
                  <div className={cn("px-4 py-2.5 flex items-center justify-between", cfg.header)}>
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      {cfg.icon} {cfg.label}
                    </span>
                    <button
                      className="text-xs text-white/70 hover:text-white transition-colors"
                      onClick={() => toggleAll(key)}
                    >
                      {selectedCount === items.length && items.length > 0 ? "Deselect." : "Sel. todos"}
                    </button>
                  </div>
                  <div className={cn("p-3 space-y-2", cfg.bg)}>
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Sin ítems</p>
                    )}
                    {items.map((item) => (
                      <SwotItemCard
                        key={item.id}
                        item={item}
                        quadrant={key}
                        selected={selected.has(item.id)}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Regulatory tab ── */}
        <TabsContent value="regulatory" className="mt-4 space-y-4">
          {content.organizational_context && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contexto organizacional</p>
              <p className="text-sm text-foreground leading-relaxed">{content.organizational_context}</p>
            </Card>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Organismos reguladores</p>
            {(content.regulatory_context?.entities ?? []).map((e, i) => (
              <Card key={i} className="p-4 border-l-4 border-l-blue-500">
                <p className="text-sm font-semibold text-foreground">{e.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{e.type} · {e.role}</p>
                {e.website && <a href={e.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">{e.website}</a>}
              </Card>
            ))}
          </div>
          {(content.regulatory_context?.key_frameworks ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Marcos normativos clave</p>
              <ul className="space-y-1">
                {content.regulatory_context.key_frameworks.map((fw, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5 shrink-0">›</span>{fw}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content.regulatory_context?.compliance_challenges && (
            <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Desafíos de cumplimiento</p>
              <p className="text-sm text-foreground leading-relaxed">{content.regulatory_context.compliance_challenges}</p>
            </Card>
          )}
        </TabsContent>

        {/* ── Benchmark tab ── */}
        <TabsContent value="benchmark" className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actores nacionales</p>
            <div className="space-y-2">
              {(content.benchmark?.national_players ?? []).map((p, i) => (
                <Card key={i} className="p-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.type}</span>
                      {p.market_share_approx && <span className="text-xs text-muted-foreground">{p.market_share_approx}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.key_differentiator}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Referencias LATAM & Caribe</p>
            <div className="space-y-2">
              {(content.benchmark?.latam_references ?? []).map((p, i) => (
                <Card key={i} className="p-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                    <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.country}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.relevance}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          {(content.benchmark?.industry_trends ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tendencias del sector</p>
              <ul className="space-y-1">
                {content.benchmark.industry_trends.map((t, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5 shrink-0">›</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* ── Recommendations tab ── */}
        <TabsContent value="recommendations" className="mt-4 space-y-3">
          {(content.strategic_recommendations ?? []).map((r, i) => {
            const timelineColor = r.timeline === 'SHORT' ? 'text-emerald-600 dark:text-emerald-400' : r.timeline === 'MEDIUM' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
            const timelineLabel = r.timeline === 'SHORT' ? 'Corto plazo' : r.timeline === 'MEDIUM' ? 'Mediano plazo' : 'Largo plazo';
            const borderColor = r.timeline === 'SHORT' ? 'border-l-emerald-500' : r.timeline === 'MEDIUM' ? 'border-l-blue-500' : 'border-l-orange-500';

            return (
              <Card key={i} className={cn("p-4 border-l-4", borderColor)}>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                    {r.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <span className={cn("text-xs font-medium", timelineColor)}>{timelineLabel}</span>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.rationale}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Generating State ─────────────────────────────────────────────────────────

// Estimated total generation time in seconds
const ESTIMATED_SECONDS = 90;

const GENERATION_STEPS = [
  { label: "Analizando perfil de la entidad",       duration: 10 },
  { label: "Consultando marco regulatorio",         duration: 15 },
  { label: "Investigando actores nacionales",       duration: 15 },
  { label: "Mapeando benchmarks LATAM y Caribe",   duration: 15 },
  { label: "Elaborando análisis FODA",              duration: 20 },
  { label: "Generando recomendaciones estratégicas",duration: 10 },
  { label: "Compilando informe ejecutivo",          duration: 5  },
];

function GeneratingState({ reportId, onReady }: { reportId: string; onReady: (r: DiagnosticReport) => void }) {
  const { data } = useAiDiagnosticOne(reportId);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Advance elapsed every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data?.status === 'READY') onReady(data);
  }, [data?.status]);

  // Progress: smooth curve that reaches ~95% at ESTIMATED_SECONDS, then holds
  const rawProgress = Math.min(elapsed / ESTIMATED_SECONDS, 0.95);
  // Ease-out so it moves fast at start and slows toward the end
  const progress = Math.round((1 - Math.pow(1 - rawProgress, 2)) * 95);

  // Determine current step based on elapsed
  let cumulative = 0;
  let currentStep = 0;
  for (let i = 0; i < GENERATION_STEPS.length; i++) {
    cumulative += GENERATION_STEPS[i].duration;
    if (elapsed < cumulative) { currentStep = i; break; }
    currentStep = GENERATION_STEPS.length - 1;
  }

  // Remaining time estimate (rough)
  const remaining = Math.max(0, ESTIMATED_SECONDS - elapsed);
  const remainingLabel = remaining > 60
    ? `~${Math.ceil(remaining / 60)} min`
    : remaining > 0
    ? `~${remaining}s`
    : "finalizando...";

  if (data?.status === 'ERROR') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-destructive">Error al generar el diagnóstico</p>
        <p className="text-xs text-muted-foreground max-w-xs">{data.error_message ?? "Verifica la configuración de la API de IA e intenta de nuevo."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header with icon + title */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative h-16 w-16">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
            <circle
              cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="text-primary transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Generando diagnóstico estratégico</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tiempo restante estimado: <span className="font-medium text-foreground">{remainingLabel}</span>
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5 px-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{elapsed}s transcurridos</span>
          <span>{remainingLabel} restantes</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-2 px-2">
        {GENERATION_STEPS.map((s, i) => {
          const isDone    = i < currentStep;
          const isActive  = i === currentStep;
          const isPending = i > currentStep;
          return (
            <div key={i} className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-300",
              isActive  && "bg-primary/8 border border-primary/20",
              isDone    && "opacity-50",
              isPending && "opacity-30",
            )}>
              <div className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                isDone   && "bg-emerald-100 dark:bg-emerald-900/30",
                isActive && "bg-primary/10",
                isPending&& "bg-muted",
              )}>
                {isDone
                  ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  : isActive
                  ? <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
              </div>
              <span className={cn(
                "text-xs",
                isActive  && "font-medium text-foreground",
                isDone    && "text-muted-foreground line-through",
                isPending && "text-muted-foreground",
              )}>
                {s.label}
              </span>
              {isDone && <Check className="h-3 w-3 text-emerald-500 ml-auto shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Note */}
      <p className="text-center text-xs text-muted-foreground px-4">
        Claude AI está analizando información pública del sector financiero en tu país.
        Puedes cerrar esta ventana — el diagnóstico estará disponible en el listado cuando finalice.
      </p>
      <p className="text-xs text-muted-foreground">Esto puede tomar 1-2 minutos</p>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export function DiagnosticWizard({ open, onClose, defaultOrgName = "" }: {
  open: boolean;
  onClose: () => void;
  defaultOrgName?: string;
}) {
  const [screen, setScreen] = useState<"list" | "form" | "generating" | "report">("list");
  const [orgName, setOrgName] = useState(defaultOrgName);
  const [countryCode, setCountryCode] = useState("EC");
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<DiagnosticReport | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");

  const { data: reports, isPending: loadingList } = useAiDiagnosticList();
  const { data: reportDetail } = useAiDiagnosticOne(activeReportId, screen === "report" && !!activeReportId);
  const createMut = useCreateDiagnostic();
  const regenerateMut = useRegenerateDiagnostic();
  const deleteMut = useDeleteDiagnostic();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOrgName(defaultOrgName);
      setFormError(null);
      setCountrySearch("");
      setScreen("list");
    }
  }, [open, defaultOrgName]);

  useEffect(() => {
    if (reportDetail && screen === "report") setActiveReport(reportDetail);
  }, [reportDetail, screen]);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );
  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);

  async function handleGenerate() {
    if (!orgName.trim()) return setFormError("El nombre de la organización es requerido");
    setFormError(null);
    try {
      const { id } = await createMut.mutateAsync({
        orgName: orgName.trim(),
        countryCode,
        countryName: selectedCountry?.name ?? countryCode,
      });
      setActiveReportId(id);
      setScreen("generating");
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err, "Error al iniciar el diagnóstico"));
    }
  }

  function openReport(report: DiagnosticReport) {
    setActiveReportId(report.id);
    setActiveReport(report);
    setScreen("report");
  }

  async function handleDownloadPdf(reportId: string) {
    try {
      const res = await fetch(`/api/v1/ai/diagnostic/${reportId}/pdf`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const report = (reports ?? []).find((r) => r.id === reportId) ?? activeReport;
      const filename = `diagnostico-${(report?.org_name ?? reportId).replace(/\s+/g, '-').toLowerCase()}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Diagnóstico Estratégico con IA
            </DialogTitle>
            <DialogDescription>
              Análisis FODA contextualizado con información regulatoria y benchmarks del sector financiero.
            </DialogDescription>
          </DialogHeader>

          {/* Breadcrumb nav */}
          {screen !== "list" && (
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
              <button onClick={() => setScreen("list")} className="hover:text-foreground transition-colors">Reportes</button>
              <ChevronRight className="h-3 w-3" />
              {screen === "form" && <span className="text-foreground">Nuevo diagnóstico</span>}
              {screen === "generating" && <span className="text-foreground">Generando...</span>}
              {screen === "report" && <span className="text-foreground">{activeReport?.org_name ?? "Reporte"}</span>}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── List screen ── */}
          {screen === "list" && (
            <div className="space-y-4">
              <Button className="w-full gap-2" onClick={() => setScreen("form")}>
                <Sparkles className="h-4 w-4" /> Generar nuevo diagnóstico
              </Button>

              {loadingList && (
                <div className="space-y-2">
                  {[1,2,3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
                </div>
              )}

              {!loadingList && (!reports || reports.length === 0) && (
                <div className="text-center py-10 space-y-2">
                  <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-sm text-muted-foreground">No hay diagnósticos generados aún</p>
                  <p className="text-xs text-muted-foreground">Genera tu primer análisis estratégico con IA</p>
                </div>
              )}

              {(reports ?? []).map((r) => (
                <div key={r.id}>
                  <Card
                    className={cn(
                      "p-4 hover:shadow-md transition-shadow",
                      r.status === 'READY' && "cursor-pointer",
                      r.status === 'GENERATING' && "opacity-70",
                    )}
                    onClick={() => r.status === 'READY' ? openReport(r) : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {r.status === 'READY'
                          ? <BarChart3 className="h-4 w-4 text-primary" />
                          : r.status === 'GENERATING'
                          ? <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          : <AlertCircle className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{r.org_name}</p>
                        <p className="text-xs text-muted-foreground">{r.country_name} · {r.created_by_name}</p>
                        <p className="text-xs text-muted-foreground/70">{new Date(r.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                            r.status === 'READY'      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                            r.status === 'GENERATING' ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" :
                                                        "bg-destructive/10 text-destructive",
                          )}>
                            {r.status === 'READY' ? "Listo" : r.status === 'GENERATING' ? "Generando..." : "Error"}
                          </span>
                          {r.has_pdf && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" /> PDF guardado
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {r.status === 'READY' && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Descargar PDF"
                            onClick={() => handleDownloadPdf(r.id)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600"
                          title="Regenerar"
                          disabled={r.status === 'GENERATING' || regenerateMut.isPending}
                          onClick={() => { regenerateMut.mutate(r.id); }}
                        >
                          {regenerateMut.isPending && regenerateMut.variables === r.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                          disabled={deleteMut.isPending}
                          onClick={() => setConfirmDeleteId(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {r.status === 'READY' && <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />}
                      </div>
                    </div>
                  </Card>
                  {/* Inline delete confirm */}
                  {confirmDeleteId === r.id && (
                    <div className="flex items-center gap-3 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-2.5 mt-1">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-sm text-destructive flex-1">¿Eliminar este diagnóstico?</p>
                      <Button size="sm" variant="destructive" className="h-7 text-xs"
                        disabled={deleteMut.isPending}
                        onClick={() => { deleteMut.mutate(r.id, { onSuccess: () => setConfirmDeleteId(null) }); }}>
                        {deleteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Eliminar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => setConfirmDeleteId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Form screen ── */}
          {screen === "form" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre de la organización</label>
                <Input
                  autoFocus
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="ej. Cooperativa de Ahorro y Crédito San Francisco"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">El nombre se usará para personalizar el análisis y el PDF.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">País</label>
                <Input
                  placeholder="Buscar país..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  className="h-9 mb-2"
                />
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-lg border p-2">
                  {filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCountryCode(c.code); setCountrySearch(""); }}
                      className={cn(
                        "text-left text-sm px-3 py-2 rounded-md transition-colors",
                        countryCode === c.code
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-foreground",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {selectedCountry && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Seleccionado: <span className="font-medium text-foreground">{selectedCountry.name}</span>
                  </p>
                )}
              </div>

              {/* Preview box */}
              <Card className="p-4 bg-primary/5 border-primary/20 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">El análisis incluirá</p>
                {[
                  "Contexto regulatorio del sector financiero en " + (selectedCountry?.name ?? "el país"),
                  "Benchmark con bancos y cooperativas nacionales",
                  "Referencias estratégicas LATAM y el Caribe",
                  "Análisis FODA con evidencia contextualizada",
                  "6+ recomendaciones estratégicas priorizadas",
                  "Informe PDF ejecutivo estilo McKinsey",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {item}
                  </div>
                ))}
              </Card>

              {formError && (
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
                </p>
              )}

              <Button
                className="w-full h-11 gap-2"
                onClick={handleGenerate}
                disabled={createMut.isPending || !orgName.trim()}
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generar diagnóstico con IA
                {!createMut.isPending && <ArrowRight className="h-4 w-4 ml-auto" />}
              </Button>
            </div>
          )}

          {/* ── Generating screen ── */}
          {screen === "generating" && activeReportId && (
            <GeneratingState
              reportId={activeReportId}
              onReady={(r) => { setActiveReport(r); setScreen("report"); }}
            />
          )}

          {/* ── Report screen ── */}
          {screen === "report" && (activeReport || reportDetail) && (
            <ReportView
              report={(reportDetail ?? activeReport)!}
              onDownload={() => handleDownloadPdf(activeReportId!)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Powered by Claude AI · {screen === "list" ? `${reports?.length ?? 0} diagnóstico${(reports?.length ?? 0) !== 1 ? "s" : ""}` : ""}
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
