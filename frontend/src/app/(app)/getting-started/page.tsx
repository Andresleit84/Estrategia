"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2, Network, CalendarRange, Rocket, Check, ChevronRight, ChevronLeft,
  Sparkles, Loader2, Plus, X, Pencil, AlertCircle, ArrowRight, CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateOrganization } from "@/hooks/useOrganization";
import { useCreateArea, useAreas } from "@/hooks/useAreas";
import { useCreateCycle, useActivateCycle, useActiveCycle } from "@/hooks/useCycles";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";

// ── Sector options ────────────────────────────────────────────────────────────

const SECTORS = [
  { value: "GENERIC",              label: "Empresa / Servicios" },
  { value: "COOPERATIVE_FINANCIAL",label: "Cooperativa / Financiera" },
  { value: "BANKING",              label: "Banca" },
  { value: "INSURANCE",            label: "Seguros" },
  { value: "OTHER",                label: "Otro" },
];

// ── Area suggestions by sector ────────────────────────────────────────────────

const AREA_SUGGESTIONS: Record<string, { name: string; description: string; color: string }[]> = {
  GENERIC: [
    { name: "Comercial",   description: "Ventas, clientes y desarrollo de negocio", color: "#3b82f6" },
    { name: "Operaciones", description: "Procesos internos y eficiencia operativa",  color: "#10b981" },
    { name: "RRHH",        description: "Talento, cultura y desarrollo organizacional", color: "#8b5cf6" },
    { name: "Tecnología",  description: "Sistemas, infraestructura y transformación digital", color: "#f59e0b" },
  ],
  COOPERATIVE_FINANCIAL: [
    { name: "Captación",           description: "Ahorro, depósitos y captación de socios",   color: "#3b82f6" },
    { name: "Colocación",          description: "Crédito, cartera y recuperación",            color: "#10b981" },
    { name: "RRHH",                description: "Talento y desarrollo organizacional",         color: "#8b5cf6" },
    { name: "Riesgo y Cumplimiento", description: "Control interno, riesgos y normativa",    color: "#ef4444" },
    { name: "Tecnología",          description: "Sistemas y transformación digital",           color: "#f59e0b" },
  ],
  BANKING: [
    { name: "Banca Comercial", description: "Productos, clientes y crecimiento de cartera", color: "#3b82f6" },
    { name: "Riesgos",         description: "Gestión de riesgos crediticio y operacional",   color: "#ef4444" },
    { name: "Operaciones",     description: "Procesos bancarios y back-office",               color: "#10b981" },
    { name: "RRHH",            description: "Talento, formación y cultura organizacional",    color: "#8b5cf6" },
    { name: "Sistemas y TI",   description: "Infraestructura tecnológica y seguridad",        color: "#f59e0b" },
  ],
  INSURANCE: [
    { name: "Siniestros",    description: "Reclamaciones, liquidación y atención al asegurado", color: "#ef4444" },
    { name: "Ventas",        description: "Colocación de pólizas y canal de distribución",     color: "#3b82f6" },
    { name: "Suscripción",   description: "Evaluación de riesgos y tarificación",              color: "#10b981" },
    { name: "RRHH",          description: "Talento y desarrollo organizacional",                color: "#8b5cf6" },
  ],
  OTHER: [
    { name: "Comercial",   description: "Ventas y desarrollo de negocio", color: "#3b82f6" },
    { name: "Operaciones", description: "Procesos internos",               color: "#10b981" },
    { name: "RRHH",        description: "Talento y cultura",               color: "#8b5cf6" },
    { name: "Tecnología",  description: "Sistemas y digitalización",       color: "#f59e0b" },
  ],
};

// ── Cycle helpers ─────────────────────────────────────────────────────────────

function getCurrentQuarter(): { q: number; year: number; start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const starts = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
  const ends   = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`];
  return { q, year, start: starts[q - 1], end: ends[q - 1] };
}

function getAnnualDates(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEP_ICONS = [Building2, Network, CalendarRange, Rocket];

// ── Area chip (selectable + editable) ────────────────────────────────────────

interface AreaDraft {
  id: string;
  name: string;
  description: string;
  color: string;
  selected: boolean;
  editing: boolean;
}

function AreaChip({ area, onChange, onRemove }: {
  area: AreaDraft;
  onChange: (a: Partial<AreaDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer",
      area.selected ? "border-primary bg-primary/5" : "border-border bg-muted/30 opacity-60"
    )}
      onClick={() => !area.editing && onChange({ selected: !area.selected })}
    >
      <div className="mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0"
        style={{ borderColor: area.color, backgroundColor: area.selected ? area.color : "transparent" }}
      >
        {area.selected && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        {area.editing ? (
          <Input
            value={area.name}
            autoFocus
            className="h-6 text-sm py-0 px-1 mb-1"
            onClick={e => e.stopPropagation()}
            onChange={e => onChange({ name: e.target.value })}
            onBlur={() => onChange({ editing: false })}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") onChange({ editing: false }); }}
          />
        ) : (
          <p className="text-sm font-medium leading-tight">{area.name}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{area.description}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={e => { e.stopPropagation(); onChange({ editing: true, selected: true }); }}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          onClick={e => { e.stopPropagation(); onRemove(); }}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function GettingStartedPage() {
  const t = useTranslations("pages.gettingStartedWizard");
  const STEPS = [
    { label: t("stepCompany"),   icon: STEP_ICONS[0] },
    { label: t("stepAreas"),     icon: STEP_ICONS[1] },
    { label: t("stepCycle"),     icon: STEP_ICONS[2] },
    { label: t("stepDoneLabel"), icon: STEP_ICONS[3] },
  ];
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return") ?? null;
  const currentUser = useAuthStore(s => s.user);
  const { data: existingAreas = [], isLoading: areasLoading } = useAreas();
  const { data: activeCycle, isLoading: cycleLoading } = useActiveCycle();

  const updateOrg     = useUpdateOrganization();
  const createArea    = useCreateArea();
  const createCycle   = useCreateCycle();
  const activateCycle = useActivateCycle();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auto-advance to first missing step once data loads
  const didAutoAdvance = useRef(false);
  useEffect(() => {
    if (areasLoading || cycleLoading || didAutoAdvance.current) return;
    didAutoAdvance.current = true;
    const hasAreas = existingAreas.length > 0;
    const hasCycleNow = !!activeCycle;
    if (hasAreas && hasCycleNow) {
      // Everything done — go straight to summary
      setStep(3);
    } else if (hasAreas && !hasCycleNow) {
      // Only cycle missing — skip to step 2
      setStep(2);
    }
    // If no areas, stay at step 0 (start from beginning)
  }, [areasLoading, cycleLoading, existingAreas, activeCycle]);

  // ── Step 0: Org ──────────────────────────────────────────────────────────
  const [orgName, setOrgName] = useState(currentUser?.org_name ?? "");
  const [sector, setSector] = useState(currentUser?.org_sector ?? "GENERIC");

  // ── Step 1: Areas ────────────────────────────────────────────────────────
  const suggestions = AREA_SUGGESTIONS[sector] ?? AREA_SUGGESTIONS.GENERIC;
  const [areas, setAreas] = useState<AreaDraft[]>([]);
  const [newAreaName, setNewAreaName] = useState("");

  // Sync suggestions when sector changes
  useEffect(() => {
    const sugg = AREA_SUGGESTIONS[sector] ?? AREA_SUGGESTIONS.GENERIC;
    setAreas(sugg.map((s, i) => ({
      id: `s-${i}`,
      name: s.name,
      description: s.description,
      color: s.color,
      selected: true,
      editing: false,
    })));
  }, [sector]);

  // ── Step 2: Cycle ────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [cycleType, setCycleType] = useState<"QUARTERLY" | "ANNUAL">("ANNUAL");
  const [cycleName, setCycleName] = useState(`Plan Estratégico ${currentYear}`);
  const [cycleStart, setCycleStart] = useState(getAnnualDates(currentYear).start);
  const [cycleEnd, setCycleEnd]     = useState(getAnnualDates(currentYear).end);
  const [createdCycleId, setCreatedCycleId] = useState<string | null>(null);

  function switchCycleType(t: "QUARTERLY" | "ANNUAL") {
    setCycleType(t);
    if (t === "ANNUAL") {
      setCycleName(`Plan Estratégico ${currentYear}`);
      const d = getAnnualDates(currentYear);
      setCycleStart(d.start); setCycleEnd(d.end);
    } else {
      const q = getCurrentQuarter();
      setCycleName(`Q${q.q} ${q.year}`);
      setCycleStart(q.start); setCycleEnd(q.end);
    }
  }

  // ── Step 3: summary ──────────────────────────────────────────────────────
  const [createdAreas, setCreatedAreas] = useState<string[]>([]);

  // ── Computed ─────────────────────────────────────────────────────────────
  const selectedAreas = areas.filter(a => a.selected && a.name.trim());
  const hasExistingAreas = existingAreas.length > 0;
  const hasCycle = !!activeCycle || !!createdCycleId;

  // ── Handlers ─────────────────────────────────────────────────────────────

  function addCustomArea() {
    if (!newAreaName.trim()) return;
    const colors = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4"];
    setAreas(prev => [...prev, {
      id: `custom-${Date.now()}`,
      name: newAreaName.trim(),
      description: "",
      color: colors[prev.length % colors.length],
      selected: true,
      editing: false,
    }]);
    setNewAreaName("");
  }

  function updateArea(id: string, patch: Partial<AreaDraft>) {
    setAreas(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }

  function removeArea(id: string) {
    setAreas(prev => prev.filter(a => a.id !== id));
  }

  async function handleNext() {
    setError("");
    setSaving(true);
    try {
      if (step === 0) {
        // Update org name + sector
        if (orgName.trim() && (orgName !== currentUser?.org_name || sector !== currentUser?.org_sector)) {
          await updateOrg.mutateAsync({ name: orgName.trim(), sector });
        }
        setStep(1);
      } else if (step === 1) {
        // Create selected areas (skip if org already has areas)
        const toCreate = hasExistingAreas ? [] : selectedAreas;
        const names: string[] = [];
        for (const a of toCreate) {
          await createArea.mutateAsync({ name: a.name, description: a.description, color: a.color });
          names.push(a.name);
        }
        setCreatedAreas(names);
        if (names.length > 0) {
          await qc.invalidateQueries({ queryKey: ["areas"] });
        }
        setStep(2);
      } else if (step === 2) {
        // Create + activate cycle (only if no active cycle)
        if (!activeCycle) {
          const cycle = await createCycle.mutateAsync({
            name: cycleName.trim(),
            type: cycleType,
            start_date: cycleStart,
            end_date: cycleEnd,
          });
          await activateCycle.mutateAsync(cycle.id);
          setCreatedCycleId(cycle.id);
        }
        // Invalidate so demo-setup sees fresh areas + cycle
        await qc.invalidateQueries({ queryKey: ["areas"] });
        await qc.invalidateQueries({ queryKey: ["cycles"] });
        setStep(3);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("already") || msg.includes("ya existe")
        ? "Ya existe un elemento con ese nombre. Cambia el nombre e intenta de nuevo."
        : msg);
    } finally {
      setSaving(false);
    }
  }

  const canGoNext =
    step === 0 ? orgName.trim().length > 1 :
    step === 1 ? (hasExistingAreas || selectedAreas.length > 0) :
    step === 2 ? (cycleName.trim().length > 0 && cycleStart && cycleEnd) :
    false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col items-center justify-start py-12 px-4">
      {/* Header */}
      <div className="text-center mb-8 max-w-lg">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          {t("wizardTitle")}
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          {t("wizardSubtitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("wizardDesc")}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                done ? "border-primary bg-primary text-primary-foreground" :
                active ? "border-primary bg-primary/10 text-primary" :
                "border-border bg-muted text-muted-foreground"
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={cn("text-xs hidden sm:block", active ? "text-foreground font-medium" : "text-muted-foreground")}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-xl">

        {/* ── Step 0: Empresa ─────────────────────────────────────────────── */}
        {step === 0 && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t("yourOrg")}</h2>
              <p className="text-sm text-muted-foreground">Confirma el nombre y el tipo de organización. Esto personaliza el lenguaje del sistema.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("orgName")}</label>
                <Input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Ej: Cooperativa Progreso"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("typeSlash")}</label>
                <div className="grid grid-cols-1 gap-2">
                  {SECTORS.map(s => (
                    <label key={s.value} className={cn(
                      "flex items-center gap-3 rounded-lg border px-4 py-2.5 cursor-pointer transition-colors text-sm",
                      sector === s.value ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/40"
                    )}>
                      <input type="radio" name="sector" value={s.value} checked={sector === s.value}
                        onChange={() => setSector(s.value)} className="shrink-0" />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Step 1: Áreas ───────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-1">{t("orgAreas")}</h2>
              {hasExistingAreas ? (
                <p className="text-sm text-muted-foreground">
                  Tu organización ya tiene <strong>{existingAreas.length} área{existingAreas.length > 1 ? "s" : ""}</strong> configuradas. Puedes continuar o gestionarlas en{" "}
                  <a href="/settings?tab=areas" target="_blank" className="text-primary underline">Configuración → Áreas</a>.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecciona las áreas de tu organización. Las sugerencias son para <strong>{SECTORS.find(s => s.value === sector)?.label}</strong> — edítalas si es necesario.
                </p>
              )}
            </div>

            {hasExistingAreas ? (
              <Card className="p-4 space-y-2">
                {existingAreas.map(a => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                    </div>
                  </div>
                ))}
              </Card>
            ) : (
              <div className="space-y-2">
                {areas.map(a => (
                  <AreaChip key={a.id} area={a}
                    onChange={patch => updateArea(a.id, patch)}
                    onRemove={() => removeArea(a.id)}
                  />
                ))}
                {/* Add custom */}
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Agregar área personalizada…"
                    value={newAreaName}
                    onChange={e => setNewAreaName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomArea()}
                    className="text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addCustomArea} disabled={!newAreaName.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {selectedAreas.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Se crearán <strong>{selectedAreas.length}</strong> área{selectedAreas.length > 1 ? "s" : ""} al continuar
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Ciclo ───────────────────────────────────────────────── */}
        {step === 2 && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">{t("firstCycle")}</h2>
              {activeCycle ? (
                <p className="text-sm text-muted-foreground">
                  {t("hasCycle")}: <strong>{activeCycle.name}</strong>. Puedes continuar directamente.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  El ciclo delimita el período de tus OKRs. Sin ciclo activo no puedes crear objetivos.
                </p>
              )}
            </div>

            {activeCycle ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{activeCycle.name}</p>
                  <p className="text-xs text-muted-foreground">{activeCycle.start_date} → {activeCycle.end_date}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Type selector */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("cycleType")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["ANNUAL","QUARTERLY"] as const).map(ct => (
                      <button key={ct} onClick={() => switchCycleType(ct)}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left",
                          cycleType === ct ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"
                        )}>
                        <div className="font-medium">{ct === "ANNUAL" ? t("annual") : t("quarterly")}</div>
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                          {ct === "ANNUAL" ? "12 meses — ideal para planes estratégicos" : "3 meses — ideal para equipos ágiles"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nombre del ciclo</label>
                  <Input value={cycleName} onChange={e => setCycleName(e.target.value)} placeholder="Ej: Plan Estratégico 2026" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("startLabel")}</label>
                    <Input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("endLabel")}</label>
                    <Input type="date" value={cycleEnd} onChange={e => setCycleEnd(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── Step 3: Done ────────────────────────────────────────────────── */}
        {step === 3 && (
          <Card className="p-8 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">{t("allSet")}, {currentUser?.name?.split(" ")[0] ?? ""}!</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Tu organización está configurada. Ya puedes crear OKRs, hacer demos y alinear equipos sin errores de prerrequisitos.
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-left space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4 shrink-0" />
                <span>Organización: <strong>{orgName || currentUser?.org_name}</strong></span>
              </div>
              {createdAreas.length > 0 && (
                <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{createdAreas.length} áreas creadas: <strong>{createdAreas.join(", ")}</strong></span>
                </div>
              )}
              {hasExistingAreas && createdAreas.length === 0 && (
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{existingAreas.length} área{existingAreas.length > 1 ? "s" : ""} ya configurada{existingAreas.length > 1 ? "s" : ""}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4 shrink-0" />
                <span>Ciclo activo: <strong>{activeCycle?.name ?? cycleName}</strong></span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {returnTo ? (
                <Button size="lg" onClick={() => router.push(returnTo)} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  {returnTo === "/demo-setup" ? "Ir al Demo Express →" : "Continuar →"}
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={() => router.push("/strategic")} className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Crear primer OKR
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => router.push("/demo-setup")} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Hacer un demo
                  </Button>
                </>
              )}
            </div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Navigation */}
        {step < 3 && (
          <div className={cn("flex mt-6", step === 0 ? "justify-end" : "justify-between")}>
            {step > 0 && (
              <Button variant="ghost" onClick={() => { setStep(s => s - 1); setError(""); }} disabled={saving}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Atrás
              </Button>
            )}
            <Button onClick={handleNext} disabled={!canGoNext || saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 2 ? (activeCycle ? "Continuar →" : "Crear ciclo y continuar →") : "Siguiente"}
              {!saving && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Skip for existing orgs */}
        {step < 3 && (
          <p className="text-center mt-4 text-xs text-muted-foreground">
            ¿Ya tienes todo configurado?{" "}
            <button onClick={() => router.push("/welcome")} className="text-primary underline">
              Ir al inicio directamente
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
