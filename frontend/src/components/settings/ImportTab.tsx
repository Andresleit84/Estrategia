"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMyOrgs } from "@/hooks/useAdmin";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, CheckCircle2, Loader2, Upload, Trash2, FileText,
  Target, Calendar, TrendingUp, Rocket, Brain, ChevronDown, ChevronRight,
  RefreshCw, Plus,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportSource {
  id: string;
  label: string;
  content: string;
}

interface ImportData {
  strategic_intents: Array<{ title: string; description?: string; category: string }>;
  cycles: Array<{ name: string; duration: string; year?: number }>;
  objectives: Array<{ title: string; description?: string; level: string; cycle_duration: string; cycle_year?: number }>;
  key_results: Array<{ title: string; objective_title?: string; type: string; target?: number | null; unit?: string | null }>;
  initiatives: Array<{ title: string; description?: string }>;
}

interface ImportSummary {
  strategicIntents: number;
  objectives3year: number;
  objectivesAnnual: number;
  objectivesQuarterly: number;
  keyResults: number;
  initiatives: number;
}

interface ImportAnalysis {
  summary: ImportSummary;
  data: ImportData;
}

type PendingAction = "load" | "clean";
type DialogPhase = "analyzing" | "results";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSource(): ImportSource {
  return { id: Math.random().toString(36).slice(2), label: "", content: "" };
}

const LEVEL_LABEL: Record<string, string> = {
  COMPANY: "Empresa", AREA: "Área", TEAM: "Equipo",
};
const DURATION_LABEL: Record<string, string> = {
  "3Y": "3 años", ANNUAL: "Anual", QUARTERLY: "Trimestral",
};
const KR_TYPE_LABEL: Record<string, string> = {
  INCREASE: "↑ Aumentar", DECREASE: "↓ Reducir", MAINTAIN: "→ Mantener", ACHIEVE: "✓ Lograr",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportTab() {
  const { data: orgs, isLoading } = useMyOrgs();
  const [sources, setSources] = useState<ImportSource[]>([makeSource()]);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPhase, setDialogPhase] = useState<DialogPhase>("analyzing");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>("load");
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearFirst, setClearFirst] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const addFileRef = useRef<HTMLInputElement>(null);
  const fileSlotRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const qc = useQueryClient();
  const router = useRouter();

  const hasContent = sources.some(s => s.content.trim().length > 0);

  const analyze = useMutation({
    mutationFn: (srcs: ImportSource[]) =>
      api.post<ImportAnalysis>("/import/analyze", {
        sources: srcs.map(s => ({ label: s.label || "Fuente", content: s.content })),
      }),
    onSuccess: (data) => {
      setAnalysis(data);
      setDialogPhase("results");
      const total = Object.values(data.summary).reduce((a, b) => a + b, 0);
      if (total === 0) {
        toast.warning(
          "La IA no encontró elementos estructurados. Asegúrate de que el documento contenga metas, planes o indicadores.",
          { duration: 6000 },
        );
      }
    },
    onError: (err) => {
      setDialogOpen(false);
      toast.error(getApiErrorMessage(err, "Error al analizar el contenido"));
    },
  });

  const load = useMutation({
    mutationFn: ({ organizationId, data, clearFirst }: { organizationId: string; data: ImportData; clearFirst: boolean }) =>
      api.post<{ success: boolean; message: string }>("/import/load", { organizationId, data, clearFirst }),
    onSuccess: (data) => {
      setShowConfirm(false);
      toast.success(data.message);
      qc.invalidateQueries();
      router.refresh();
    },
    onError: (err) => {
      setShowConfirm(false);
      toast.error(getApiErrorMessage(err, "Error al cargar los datos"));
    },
  });

  const clean = useMutation({
    mutationFn: (organizationId: string) =>
      api.post<{ success: boolean; message: string }>("/demo/clean", { organizationId }),
    onSuccess: (data) => {
      setShowConfirm(false);
      toast.success(data.message);
    },
    onError: (err) => {
      setShowConfirm(false);
      toast.error(getApiErrorMessage(err, "Error al limpiar la organización"));
    },
  });

  const isPending = analyze.isPending || load.isPending || clean.isPending;
  const selectedOrg = orgs?.find(o => o.id === selectedOrgId);

  const ANALYSIS_STEPS = [
    "Leyendo el contenido de las fuentes…",
    "Identificando intenciones estratégicas…",
    "Extrayendo objetivos y ciclos…",
    "Mapeando Key Results e iniciativas…",
    "Estructurando y validando la respuesta…",
  ];

  useEffect(() => {
    if (dialogPhase !== "analyzing") { setAnalysisStep(0); return; }
    setAnalysisStep(0);
    const id = setInterval(() => {
      setAnalysisStep(prev => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 6000);
    return () => clearInterval(id);
  }, [dialogPhase]);

  function handleAnalyze() {
    if (!hasContent) return;
    setAnalysis(null);
    setDialogPhase("analyzing");
    setExpanded(new Set());
    setDialogOpen(true);
    analyze.mutate(sources);
  }

  function readFile(file: File, onContent: (label: string, content: string) => void) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande. Máximo 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      if (!buffer) return;
      const bytes = new Uint8Array(buffer);
      let encoding = "utf-8";
      let start = 0;
      if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = "utf-16le"; start = 2; }
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = "utf-16be"; start = 2; }
      else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) { start = 3; }
      const content = new TextDecoder(encoding).decode(buffer.slice(start));
      const label = file.name.replace(/\.[^.]+$/, "");
      onContent(label, content);
    };
    reader.onerror = () => toast.error(`No se pudo leer "${file.name}". Prueba con .txt o .md.`);
    reader.readAsArrayBuffer(file);
  }

  function handleFileIntoSlot(slotId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file, (label, content) => {
      setSources(prev => prev.map(s => s.id === slotId ? { ...s, label, content } : s));
      toast.success(`"${file.name}" cargado`);
    });
    e.target.value = "";
  }

  function addSource() {
    if (sources.length >= 5) return;
    setSources(prev => [...prev, makeSource()]);
  }

  function removeSource(id: string) {
    setSources(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return filtered.length > 0 ? filtered : [makeSource()];
    });
  }

  function updateSource(id: string, field: "label" | "content", value: string) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  function handleAddFileReanalyze(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file, (label, content) => {
      const newSource = { id: Math.random().toString(36).slice(2), label, content };
      const updated = [...sources, newSource];
      setSources(updated);
      setDialogPhase("analyzing");
      setDialogOpen(true);
      analyze.mutate(updated);
    });
    e.target.value = "";
  }

  function handleConfirm() {
    if (pendingAction === "load" && analysis) {
      load.mutate({ organizationId: selectedOrgId, data: analysis.data, clearFirst });
    } else if (pendingAction === "clean") {
      clean.mutate(selectedOrgId);
    }
  }

  function toggleSection(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function resetAll() {
    setDialogOpen(false);
    setSources([makeSource()]);
    setAnalysis(null);
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">

      {/* ── Importar ──────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20">
          <h3 className="text-sm font-semibold">Importar datos con IA</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sube un documento y el agente clasifica automáticamente intenciones, objetivos, KRs e iniciativas.
          </p>
        </div>

        <div className="p-5 space-y-3">
          {/* Source slots */}
          {sources.map((src, idx) => (
            <div key={src.id} className="rounded-lg border bg-muted/10 overflow-hidden">
              {/* Slot header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={src.label}
                  onChange={e => updateSource(src.id, "label", e.target.value)}
                  placeholder={`Fuente ${idx + 1}`}
                  className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground/50 min-w-0"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Cargar desde archivo"
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => fileSlotRefs.current.get(src.id)?.click()}
                  >
                    <Upload className="h-3 w-3" />
                    Archivo
                  </button>
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    className="hidden"
                    ref={el => { if (el) fileSlotRefs.current.set(src.id, el); else fileSlotRefs.current.delete(src.id); }}
                    onChange={e => handleFileIntoSlot(src.id, e)}
                  />
                  {sources.length > 1 && (
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => removeSource(src.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {/* Content textarea */}
              <textarea
                value={src.content}
                onChange={e => updateSource(src.id, "content", e.target.value)}
                placeholder="Pega aquí el contenido — plan estratégico, metas, indicadores, actas, presupuesto…"
                rows={5}
                className="w-full resize-y px-3 py-2.5 text-xs bg-transparent outline-none placeholder:text-muted-foreground/40 leading-relaxed font-mono"
              />
            </div>
          ))}

          {/* Add source + Analyze */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {sources.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={addSource}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir fuente
              </Button>
            )}
            <Button
              disabled={!hasContent || analyze.isPending}
              onClick={handleAnalyze}
              className="gap-2"
              size="sm"
            >
              {analyze.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Analizando…</>
                : <><Brain className="h-4 w-4" />Analizar con IA</>}
            </Button>
            {!hasContent && (
              <p className="text-xs text-muted-foreground w-full">
                Escribe, pega contenido o carga un archivo (.txt .md .csv .json — máx. 5 MB).
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── Cargar / Limpiar organización ─────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20">
          <h3 className="text-sm font-semibold">Organización destino</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecciona dónde cargar los datos analizados o limpiar el contenido existente.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Cargar datos</strong> añade los elementos analizados a la organización seleccionada.
              <strong> Limpiar</strong> elimina todos los OKRs, ciclos e iniciativas existentes.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Organización destino</label>
            <Select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}>
              <SelectOption value="">— Selecciona una organización —</SelectOption>
              {orgs?.map(o => (
                <SelectOption key={o.id} value={o.id}>{o.name}</SelectOption>
              ))}
            </Select>
          </div>

          {/* clearFirst toggle */}
          <label className="flex items-start gap-2.5 cursor-pointer group w-fit">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                checked={clearFirst}
                onChange={e => setClearFirst(e.target.checked)}
              />
            </div>
            <div className="text-xs leading-snug">
              <span className="font-medium">Limpiar OKRs existentes antes de importar</span>
              <span className="block text-muted-foreground">
                Elimina ciclos, objetivos, KRs e iniciativas actuales y luego carga los datos nuevos desde cero.
              </span>
            </div>
          </label>

          <div className="flex gap-2 flex-wrap">
            <Button
              disabled={!selectedOrgId || !analysis || isPending}
              onClick={() => { setPendingAction("load"); setShowConfirm(true); }}
              className="gap-2"
            >
              {clearFirst ? <RefreshCw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {clearFirst ? "Limpiar e importar" : "Cargar datos analizados"}
            </Button>
            <Button
              disabled={!selectedOrgId || isPending}
              onClick={() => { setPendingAction("clean"); setShowConfirm(true); }}
              variant="outline"
              className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/5 dark:border-destructive/40"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar organización
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Analysis dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={open => {
          if (!open && !analyze.isPending) setDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {dialogPhase === "analyzing" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary animate-pulse" />
                  Analizando con IA…
                </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-5">
                {/* Steps list */}
                <ul className="space-y-2.5">
                  {ANALYSIS_STEPS.map((step, i) => {
                    const done = i < analysisStep;
                    const active = i === analysisStep;
                    return (
                      <li key={i} className={`flex items-center gap-3 text-sm transition-colors duration-300 ${done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground/40"}`}>
                        <span className="shrink-0 h-5 w-5 flex items-center justify-center">
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : active ? (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                          )}
                        </span>
                        {step}
                      </li>
                    );
                  })}
                </ul>
                {/* Progress bar */}
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-[5800ms] ease-linear"
                    style={{ width: `${Math.min(((analysisStep + 1) / ANALYSIS_STEPS.length) * 90, 90)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  El agente clasifica intenciones, objetivos, KRs e iniciativas. Puede tardar hasta 30 s.
                </p>
              </div>
            </>
          ) : analysis ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Análisis completado
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Summary sentence */}
                <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm">
                  Encontré:{" "}
                  {[
                    analysis.summary.strategicIntents > 0 &&
                      <strong key="si">{analysis.summary.strategicIntents} intenciones estratégicas</strong>,
                    analysis.summary.objectives3year > 0 &&
                      <strong key="3y">{analysis.summary.objectives3year} OKRs estratégicos (3 años)</strong>,
                    analysis.summary.objectivesAnnual > 0 &&
                      <strong key="an">{analysis.summary.objectivesAnnual} OKRs anuales</strong>,
                    analysis.summary.objectivesQuarterly > 0 &&
                      <strong key="qt">{analysis.summary.objectivesQuarterly} OKRs trimestrales</strong>,
                    analysis.summary.keyResults > 0 &&
                      <strong key="kr">{analysis.summary.keyResults} Key Results</strong>,
                    analysis.summary.initiatives > 0 &&
                      <strong key="in">{analysis.summary.initiatives} iniciativas</strong>,
                  ].filter(Boolean).reduce<React.ReactNode[]>((acc, el, i, arr) => {
                    acc.push(el);
                    if (i < arr.length - 1) acc.push(i === arr.length - 2 ? " y " : ", ");
                    return acc;
                  }, []) || "No se detectaron elementos estructurados."}
                </div>

                {/* Summary grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Intenciones",       icon: Target,     value: analysis.summary.strategicIntents },
                    { label: "OKRs 3 años",        icon: Brain,      value: analysis.summary.objectives3year },
                    { label: "OKRs anuales",       icon: Calendar,   value: analysis.summary.objectivesAnnual },
                    { label: "OKRs trimestrales",  icon: Calendar,   value: analysis.summary.objectivesQuarterly },
                    { label: "Key Results",        icon: TrendingUp, value: analysis.summary.keyResults },
                    { label: "Iniciativas",        icon: Rocket,     value: analysis.summary.initiatives },
                  ].map(({ label, icon: Icon, value }) => (
                    <div key={label} className="rounded-md border bg-muted/20 px-2 py-2 flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="text-base font-bold leading-none">{value}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight truncate">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Expandable detail sections */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {[
                    { key: "intents", label: "Intenciones estratégicas", items: analysis.data.strategic_intents,
                      render: (i: ImportData["strategic_intents"][0]) => `${i.title} — ${i.category}` },
                    { key: "objectives", label: "Objetivos", items: analysis.data.objectives,
                      render: (o: ImportData["objectives"][0]) =>
                        `[${LEVEL_LABEL[o.level] ?? o.level}] [${DURATION_LABEL[o.cycle_duration] ?? o.cycle_duration}${o.cycle_year ? ` ${o.cycle_year}` : ""}] ${o.title}` },
                    { key: "keyResults", label: "Key Results", items: analysis.data.key_results,
                      render: (k: ImportData["key_results"][0]) =>
                        `${KR_TYPE_LABEL[k.type] ?? k.type}${k.target != null ? ` hasta ${k.target}${k.unit ?? ""}` : ""} — ${k.title}` },
                    { key: "initiatives", label: "Iniciativas", items: analysis.data.initiatives,
                      render: (i: ImportData["initiatives"][0]) => i.title },
                  ].filter(s => s.items.length > 0).map(section => (
                    <div key={section.key} className="rounded-md border overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => toggleSection(section.key)}
                      >
                        <span className="text-xs font-medium">{section.label} ({section.items.length})</span>
                        {expanded.has(section.key)
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      {expanded.has(section.key) && (
                        <ul className="divide-y text-xs">
                          {section.items.map((item, i) => (
                            <li key={i} className="px-3 py-1.5 text-muted-foreground">
                              {section.render(item as never)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:flex-row">
                <div className="flex gap-2 flex-1 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={analyze.isPending}
                    onClick={() => addFileRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Añadir otro archivo
                  </Button>
                  <input
                    ref={addFileRef}
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    className="hidden"
                    onChange={handleAddFileReanalyze}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={resetAll}
                  >
                    Nuevo análisis
                  </Button>
                </div>
                <Button
                  disabled={!selectedOrgId}
                  onClick={() => {
                    setDialogOpen(false);
                    setPendingAction("load");
                    setShowConfirm(true);
                  }}
                  className="gap-2"
                  title={!selectedOrgId ? "Selecciona una organización primero" : undefined}
                >
                  {clearFirst ? <RefreshCw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {clearFirst ? "Limpiar e importar" : "Cargar en organización"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Confirm dialog ────────────────────────────────────────────────── */}
      <Dialog open={showConfirm} onOpenChange={open => !open && !isPending && setShowConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "load"
                ? `¿Cargar datos en ${selectedOrg?.name}?`
                : `¿Limpiar todos los datos de ${selectedOrg?.name}?`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                {pendingAction === "load" && clearFirst ? (
                  <>Se eliminarán los <strong>ciclos, objetivos, KRs e iniciativas</strong> actuales de{" "}
                  <strong>{selectedOrg?.name}</strong> y luego se cargarán los datos nuevos.
                  Los <strong>usuarios, equipos y configuración no se tocan</strong>.</>
                ) : pendingAction === "load" ? (
                  <>Se añadirán los elementos analizados a <strong>{selectedOrg?.name}</strong>.
                  Los datos existentes <strong>no se borran</strong>.</>
                ) : (
                  <>Se eliminarán <strong>todos los OKRs, ciclos, iniciativas y usuarios</strong> de{" "}
                  <strong>{selectedOrg?.name}</strong>. La organización quedará en blanco.</>
                )}{" "}
                Esta acción no se puede deshacer.
              </p>
            </div>
            {pendingAction === "load" && analysis && (
              <p className="text-xs text-muted-foreground">
                {clearFirst && "Primero se limpiará la organización. Luego s"}
                {!clearFirst && "S"}e cargarán: {[
                  analysis.summary.strategicIntents > 0 && `${analysis.summary.strategicIntents} intenciones`,
                  (analysis.summary.objectives3year + analysis.summary.objectivesAnnual + analysis.summary.objectivesQuarterly) > 0 &&
                    `${analysis.summary.objectives3year + analysis.summary.objectivesAnnual + analysis.summary.objectivesQuarterly} objetivos`,
                  analysis.summary.keyResults > 0 && `${analysis.summary.keyResults} KRs`,
                  analysis.summary.initiatives > 0 && `${analysis.summary.initiatives} iniciativas`,
                ].filter(Boolean).join(", ") || "sin elementos detectados"}.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant={pendingAction === "load" ? "default" : "destructive"}
              disabled={isPending}
              onClick={handleConfirm}
              className="gap-2 min-w-[160px]"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />
                  {pendingAction === "load" && clearFirst ? "Limpiando e importando…" : pendingAction === "load" ? "Cargando…" : "Limpiando…"}</>
              ) : (
                pendingAction === "load" && clearFirst ? "Limpiar e importar" : pendingAction === "load" ? "Confirmar y cargar" : "Confirmar y limpiar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
