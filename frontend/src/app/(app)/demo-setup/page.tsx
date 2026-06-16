"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ChevronRight, ChevronLeft, Building2, Target, BarChart3,
  Rocket, Loader2, Pencil, Check, AlertCircle, ArrowRight, Eye,
  AlertTriangle, Lightbulb, Network, RefreshCw, ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActiveCycle, useCycles } from "@/hooks/useCycles";
import { useCreateObjective } from "@/hooks/useObjectives";
import { useCreateKeyResult } from "@/hooks/useKeyResults";
import { useSuggestDemoStrategy, type DemoObjectiveSuggestion, type DemoStrategyResponse } from "@/hooks/useAI";
import { useCreateInitiative } from "@/hooks/useInitiatives";
import { useCreateBacklogItem } from "@/hooks/useBacklog";
import { useUIStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAreas } from "@/hooks/useAreas";

const STORAGE_KEY = "demo_wizard_state";

const INDUSTRIES = [
  "Tecnología / SaaS",
  "Retail / E-commerce",
  "Servicios financieros",
  "Salud y bienestar",
  "Manufactura",
  "Educación",
  "Consultoría / Servicios",
  "Logística / Distribución",
  "Inmobiliaria",
  "Otro",
];

interface KrDraft {
  title: string;
  target_value: number;
  metric_unit: string;
}

interface ObjDraft {
  title: string;
  description: string;
  key_results: KrDraft[];
}

type LogType = "done" | "pending" | "error" | "section";

interface BuildEntry {
  text: string;
  indent?: boolean;
  type: LogType;
}

const STEPS = [
  {
    label: "Contexto",
    icon: Building2,
    hint: "Claude analizará el desafío y generará la estrategia completa: problemas, intenciones y objetivos.",
  },
  {
    label: "Objetivos",
    icon: Target,
    hint: "Ajustarás los números y metas para que sean realistas y relevantes para este cliente.",
  },
  {
    label: "Resultados",
    icon: BarChart3,
    hint: "Revisarás el resumen final y confirmarás antes de construir la estrategia en el sistema.",
  },
  {
    label: "Lanzar",
    icon: Rocket,
    hint: "",
  },
];

// ── Build Log ─────────────────────────────────────────────────────────────────

function BuildLog({ entries }: { entries: BuildEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="rounded-lg border border-border bg-zinc-950 dark:bg-zinc-900 p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-1.5 text-left">
      {entries.map((entry, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200",
            entry.indent && "pl-5"
          )}
        >
          {entry.type === "section" && (
            <span className="text-primary/70 shrink-0 mt-0.5">──</span>
          )}
          {entry.type === "done" && (
            <span className="text-emerald-400 shrink-0">✓</span>
          )}
          {entry.type === "pending" && (
            <Loader2 className="h-3 w-3 text-zinc-400 animate-spin shrink-0 mt-0.5" />
          )}
          {entry.type === "error" && (
            <span className="text-red-400 shrink-0">✗</span>
          )}
          <span
            className={cn(
              entry.type === "error" && "text-red-400",
              entry.type === "section" && "text-primary/70 font-semibold",
              entry.type === "done" && !entry.indent && "text-zinc-100",
              entry.type === "done" && entry.indent && "text-zinc-400",
              entry.type === "pending" && "text-zinc-400"
            )}
          >
            {entry.text}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DemoSetupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { enterPresentation } = useUIStore();
  const { data: activeCycle, isLoading: cycleLoading, refetch: refetchCycle } = useActiveCycle();
  const { data: allCycles = [] } = useCycles();
  const { data: areas = [], isLoading: areasLoading } = useAreas();
  const createObjective = useCreateObjective();
  const createKr = useCreateKeyResult();
  const createInitiative = useCreateInitiative();
  const createBacklogItem = useCreateBacklogItem();
  const suggestStrategy = useSuggestDemoStrategy();

  const currentUser = useAuthStore(s => s.user);

  // Redirect to onboarding if prerequisites missing (wait for both to load)
  useEffect(() => {
    if (areasLoading || cycleLoading) return;
    const noAreas = areas.length === 0;
    const noCycle = !activeCycle;
    if (noAreas || noCycle) {
      router.replace("/getting-started?return=/demo-setup");
    }
  }, [areas, areasLoading, activeCycle, cycleLoading, router]);

  // Step NEVER persists — always starts at 0 (avoids stale state after reload)
  const [step, setStep] = useState(0);

  // Only persist context inputs — NOT step, objectives, or AI results
  const [company, setCompany] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY + "_company") ?? ""; } catch { return ""; }
  });
  const [industry, setIndustry] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY + "_industry") ?? INDUSTRIES[0]; } catch { return INDUSTRIES[0]; }
  });
  const [challenge, setChallenge] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY + "_challenge") ?? ""; } catch { return ""; }
  });

  // AI results: never persisted (always regenerated fresh)
  const [demoStrategy, setDemoStrategy] = useState<DemoStrategyResponse | null>(null);
  const [objectives, setObjectives] = useState<ObjDraft[]>([]);
  const [generatedFor, setGeneratedFor] = useState("");

  const [aiError, setAiError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [buildLog, setBuildLog] = useState<BuildEntry[]>([]);
  const [launchError, setLaunchError] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [checkingCycle, setCheckingCycle] = useState(false);

  // Only persist context inputs (company/industry/challenge) — user doesn't retype them on reload
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY + "_company", company);
      sessionStorage.setItem(STORAGE_KEY + "_industry", industry);
      sessionStorage.setItem(STORAGE_KEY + "_challenge", challenge);
    } catch { /* ignore */ }
  }, [company, industry, challenge]);

  // ── Step navigation ────────────────────────────────────────────────────────

  async function goNext() {
    if (step === 0) {
      // Generate BEFORE advancing — demo always has data (AI or fallback)
      if (objectives.length === 0 || generatedFor !== company) {
        await generateObjectives();
      }
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }

  function goPrev() {
    if (step > 0) setStep(step - 1);
  }

  // ── Fallback objectives when AI is unavailable ─────────────────────────────

  function buildLocalFallback(co: string, ind: string): ObjDraft[] {
    const sector = ind || "el sector";
    return [
      {
        title: `Consolidar posición de ${co} como líder en ${sector}`,
        description: "Establecer ventajas sostenibles frente a la competencia.",
        key_results: [
          { title: "Aumentar cuota de mercado de 15% a 25%", target_value: 25, metric_unit: "%" },
          { title: "Alcanzar NPS de 60 o superior", target_value: 60, metric_unit: "NPS" },
        ],
      },
      {
        title: "Acelerar el crecimiento de ingresos recurrentes",
        description: "Diversificar fuentes de ingreso y aumentar retención de clientes.",
        key_results: [
          { title: "Incrementar ingresos recurrentes en un 40%", target_value: 40, metric_unit: "%" },
          { title: "Reducir churn mensual a menos del 2%", target_value: 2, metric_unit: "%" },
        ],
      },
      {
        title: "Desarrollar capacidades organizacionales críticas",
        description: "Fortalecer el equipo y los procesos que soportan la estrategia.",
        key_results: [
          { title: "Alcanzar eNPS de 40 o superior", target_value: 40, metric_unit: "eNPS" },
          { title: "Implementar 3 procesos clave documentados", target_value: 3, metric_unit: "procesos" },
        ],
      },
    ];
  }

  // ── AI generation ──────────────────────────────────────────────────────────

  async function generateObjectives() {
    setAiError("");
    setGenerating(true);
    const targetCompany = company;

    const applyResult = (res: DemoStrategyResponse) => {
      setGenerating(false);
      setDemoStrategy(res);
      setGeneratedFor(targetCompany);
      setObjectives(
        (res.objectives ?? []).slice(0, 3).map((o: DemoObjectiveSuggestion) => ({
          title: o.title,
          description: o.description ?? "",
          key_results: (o.key_results ?? []).slice(0, 2).map(kr => ({
            title: kr.title,
            target_value: kr.target_value,
            metric_unit: kr.metric_unit,
          })),
        }))
      );
    };

    // First attempt
    try {
      const res = await suggestStrategy.mutateAsync({ company: targetCompany, industry, challenge });
      applyResult(res);
      return;
    } catch { /* try once more */ }

    // Auto-retry after 2 seconds
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await suggestStrategy.mutateAsync({ company: targetCompany, industry, challenge });
      applyResult(res);
      return;
    } catch { /* use local fallback */ }

    // Local fallback — demo always works, even sin conexión a IA
    setGeneratedFor(targetCompany);
    setObjectives(buildLocalFallback(targetCompany, industry));
    setAiError("IA no disponible — usando objetivos de ejemplo. Puedes editarlos antes de lanzar.");
    setGenerating(false);
  }

  // ── Objective editing ──────────────────────────────────────────────────────

  function updateObjTitle(idx: number, title: string) {
    setObjectives(prev => prev.map((o, i) => i === idx ? { ...o, title } : o));
  }

  function updateKr(objIdx: number, krIdx: number, field: keyof KrDraft, value: string | number) {
    setObjectives(prev => prev.map((o, i) => {
      if (i !== objIdx) return o;
      return {
        ...o,
        key_results: o.key_results.map((kr, j) =>
          j === krIdx ? { ...kr, [field]: field === "target_value" ? Number(value) : value } : kr
        ),
      };
    }));
  }

  function addKr(objIdx: number) {
    setObjectives(prev => prev.map((o, i) =>
      i !== objIdx ? o : {
        ...o,
        key_results: [...o.key_results, { title: "", target_value: 10, metric_unit: "" }],
      }
    ));
  }

  function removeKr(objIdx: number, krIdx: number) {
    setObjectives(prev => prev.map((o, i) =>
      i !== objIdx ? o : {
        ...o,
        key_results: o.key_results.filter((_, j) => j !== krIdx),
      }
    ));
  }

  // ── Launch ─────────────────────────────────────────────────────────────────

  async function launch() {
    if (!activeCycle?.id) {
      setLaunchError("No hay un ciclo activo. Crea un ciclo antes de hacer el demo.");
      return;
    }
    setLaunching(true);
    setLaunchError("");
    setBuildLog([]);

    const log = (text: string, type: LogType = "done", indent = false) => {
      setBuildLog(prev => [...prev, { text, type, indent }]);
    };

    // Identificar ciclos por tipo para la pirámide de trazabilidad:
    // strategic=CUSTOM, annual=ANNUAL, quarterly=QUARTERLY
    const customCycle   = allCycles.find(c => c.type === "CUSTOM"    && c.status === "ACTIVE");
    const annualCycle   = allCycles.find(c => c.type === "ANNUAL"    && c.status === "ACTIVE");
    const quarterCycle  = allCycles.find(c => c.type === "QUARTERLY" && c.status === "ACTIVE");

    const strategicCycleId = customCycle?.id   ?? activeCycle.id;
    const annualCycleId    = annualCycle?.id    ?? customCycle?.id   ?? activeCycle.id;
    const quarterCycleId   = quarterCycle?.id   ?? annualCycle?.id   ?? activeCycle.id;
    const orgId            = activeCycle.organization_id;

    try {
      const validObjs = objectives.filter(o => o.title.trim());

      // ── Fetch org teams for KR assignment ────────────────────────────────
      let orgTeams: Array<{ id: string; name: string }> = [];
      try {
        const teamsRes = await api.get<Array<{ id: string; name: string }>>('/teams');
        orgTeams = Array.isArray(teamsRes) ? teamsRes : [];
      } catch { /* no teams module or empty — skip */ }

      function pickTeamId(okrTitle: string, fallbackIndex: number): string | undefined {
        if (orgTeams.length === 0) return undefined;
        const lower = okrTitle.toLowerCase();
        const match = orgTeams.find(t =>
          t.name.toLowerCase().split(/\s+/).some(w => w.length > 3 && lower.includes(w))
        );
        if (match) return match.id;
        // round-robin fallback so every team gets coverage
        return orgTeams[fallbackIndex % orgTeams.length]?.id;
      }

      // ── Reset completo — limpiar TODOS los ciclos activos + org-wide data ──
      log("Limpiando datos de demos anteriores…", "pending");
      const activeCycleIds = [...new Set(
        allCycles.filter(c => c.status === "ACTIVE").map(c => c.id)
      )];
      // Primera llamada: limpia org-wide (problemas, intents, iniciativas, backlog)
      // y también el primer ciclo. Resto: solo sus objetivos.
      const [firstCycleId, ...restCycleIds] = activeCycleIds.length > 0
        ? activeCycleIds
        : [strategicCycleId];
      await api.post("/demo/reset-objectives", { organizationId: orgId, cycleId: firstCycleId }).catch(() => {});
      await Promise.all(restCycleIds.map(cid =>
        api.post("/demo/reset-objectives", { organizationId: orgId, cycleId: cid }).catch(() => {})
      ));
      setBuildLog([{ text: "Organización limpia — sin datos de demos anteriores", type: "done" }]);

      // ── Problemas ──────────────────────────────────────────────────────────
      const problems = demoStrategy?.problems ?? [];
      if (problems.length > 0) {
        log(`Problemas organizacionales (${problems.length})`, "section");
      }
      const problemIds: string[] = [];
      for (const p of problems) {
        log(`${p.title}`, "done");
        try {
          const created = await api.post<{ id: string }>("/problems", {
            title: p.title.slice(0, 500),
            description: p.description,
            category: p.category,
            severity: Math.min(5, Math.max(1, Math.round(p.severity))),
            frequency: Math.min(5, Math.max(1, Math.round(p.frequency))),
          });
          problemIds.push(created.id);
        } catch {
          problemIds.push("");
        }
      }

      // ── Intenciones estratégicas ───────────────────────────────────────────
      const intents = demoStrategy?.strategic_intents ?? [];
      if (intents.length > 0) {
        log(`Intenciones estratégicas (${intents.length})`, "section");
      }
      for (const si of intents) {
        log(`${si.title}`, "done");
        try {
          const created = await api.post<{ id: string }>("/strategic-intents", {
            title: si.title.slice(0, 500),
            description: si.description,
            category: si.category,
            horizon_years: Math.min(10, Math.max(1, Math.round(si.horizon_years ?? 3))),
          });
          for (const pidx of (si.problem_indices ?? [])) {
            const pid = problemIds[pidx];
            if (pid) await api.post(`/problems/${pid}/intents/${created.id}`, {}).catch(() => {});
          }
        } catch { /* continuar */ }
      }

      // ── OKRs empresa — en ciclo CUSTOM (estratégico) ─────────────────────
      log(`OKRs estratégicos empresa (${validObjs.length} → ciclo estratégico)`, "section");
      const companyObjIds: string[] = [];
      for (let i = 0; i < validObjs.length; i++) {
        const obj = validObjs[i];
        log(`${obj.title}`, "done");
        const created = await createObjective.mutateAsync({
          title: obj.title,
          description: obj.description || undefined,
          level: "COMPANY",
          cycle_id: strategicCycleId,
        });
        const objId: string = (created as { id: string }).id;
        companyObjIds.push(objId);

        for (const kr of obj.key_results.filter(kr => kr.title.trim())) {
          log(kr.title, "done", true);
          await createKr.mutateAsync({
            objId,
            title: kr.title,
            target_value: Math.max(1, Math.round(Number(kr.target_value) || 10)),
            metric_unit: kr.metric_unit || undefined,
            type: "INCREASE",
          });
        }
      }

      // ── OKRs área — en ciclo ANNUAL ───────────────────────────────────────
      const areaOkrs = demoStrategy?.area_okrs ?? [];
      if (areaOkrs.length > 0) {
        log(`OKRs de área (${areaOkrs.length} → ciclo anual)`, "section");
      }
      const areaObjIds: string[] = [];
      for (const areaOkr of areaOkrs) {
        const parentId = companyObjIds[areaOkr.company_obj_index];
        if (!parentId) { areaObjIds.push(""); continue; }
        log(`${areaOkr.title}`, "done");
        try {
          const created = await createObjective.mutateAsync({
            title: areaOkr.title,
            description: areaOkr.description || undefined,
            level: "AREA",
            cycle_id: annualCycleId,
            parent_objective_id: parentId,
          });
          const areaId: string = (created as { id: string }).id;
          areaObjIds.push(areaId);
          const areaTeamId = pickTeamId(areaOkr.title, areaOkr.company_obj_index);
          for (const kr of (areaOkr.key_results ?? []).filter(kr => kr.title.trim())) {
            log(kr.title, "done", true);
            await createKr.mutateAsync({
              objId: areaId,
              title: kr.title,
              target_value: Math.max(1, Math.round(Number(kr.target_value) || 10)),
              metric_unit: kr.metric_unit || undefined,
              type: "INCREASE",
              team_id: areaTeamId,
            });
          }
        } catch { areaObjIds.push(""); }
      }

      // ── OKRs equipo — en ciclo QUARTERLY ─────────────────────────────────
      const teamOkrs = demoStrategy?.team_okrs ?? [];
      if (teamOkrs.length > 0) {
        log(`OKRs trimestral equipo (${teamOkrs.length} → ciclo trimestral)`, "section");
      }
      // Indexado por area_okr_index del team OKR para emparejar con las iniciativas
      const teamObjKrIds: Record<number, string[]> = {};
      for (const teamOkr of teamOkrs) {
        const parentId = areaObjIds[teamOkr.area_okr_index];
        if (!parentId) continue;
        log(`${teamOkr.title}`, "done");
        try {
          const created = await createObjective.mutateAsync({
            title: teamOkr.title,
            description: teamOkr.description || undefined,
            level: "TEAM",
            cycle_id: quarterCycleId,
            parent_objective_id: parentId,
          });
          const teamId: string = (created as { id: string }).id;
          const assignedTeamId = pickTeamId(teamOkr.title, teamOkr.area_okr_index);
          const krIds: string[] = [];
          for (const kr of (teamOkr.key_results ?? []).filter(kr => kr.title.trim())) {
            log(kr.title, "done", true);
            const createdKr = await createKr.mutateAsync({
              objId: teamId,
              title: kr.title,
              target_value: Math.max(1, Math.round(Number(kr.target_value) || 10)),
              metric_unit: kr.metric_unit || undefined,
              type: "INCREASE",
              team_id: assignedTeamId,
            });
            krIds.push((createdKr as { id: string }).id);
          }
          teamObjKrIds[teamOkr.area_okr_index] = krIds;
        } catch { teamObjKrIds[teamOkr.area_okr_index] = []; }
      }

      // ── Iniciativas + EPIC → FEATURE → STORY ─────────────────────────────
      const initiatives = demoStrategy?.initiatives ?? [];
      if (initiatives.length > 0) {
        log(`Iniciativas y backlog (${initiatives.length} iniciativas)`, "section");
      }
      for (let iniIdx = 0; iniIdx < initiatives.length; iniIdx++) {
        const ini = initiatives[iniIdx];
        log(`${ini.title}`, "done");
        // Vincular al KR del team OKR correspondiente (cadena trimestral)
        const linkedKrIds = teamObjKrIds[ini.area_okr_index] ?? [];
        try {
          const createdIni = await createInitiative.mutateAsync({
            title: ini.title,
            description: ini.description,
            cycle_id: quarterCycleId,
            kr_ids: linkedKrIds.slice(0, 1),
          });
          const iniId: string = (createdIni as { id: string }).id;
          const stories = (ini.stories ?? []).filter(s => s.title.trim());
          if (stories.length > 0) {
            // EPIC — agrupa las features de la iniciativa
            const epic = await createBacklogItem.mutateAsync({
              type: "EPIC",
              title: ini.title,
              priority: "HIGH",
              initiative_id: iniId,
              cycle_id: quarterCycleId,
            });
            const epicId: string = (epic as { id: string }).id;
            log(`Épica: ${ini.title}`, "done", true);

            // FEATURE — un nivel intermedio entre EPIC y STORYs
            const feature = await createBacklogItem.mutateAsync({
              type: "FEATURE",
              title: `${ini.title} — Funcionalidades`,
              priority: "HIGH",
              parent_id: epicId,
              initiative_id: iniId,
              cycle_id: quarterCycleId,
            });
            const featureId: string = (feature as { id: string }).id;
            log(`Feature: ${ini.title} — Funcionalidades`, "done", true);

            // STORYs bajo el FEATURE
            for (const story of stories) {
              log(story.title, "done", true);
              await createBacklogItem.mutateAsync({
                type: "STORY",
                title: story.title,
                acceptance_criteria: story.acceptance_criteria,
                story_points: story.story_points,
                priority: "HIGH",
                parent_id: featureId,
                initiative_id: iniId,
                cycle_id: quarterCycleId,
              });
            }
          }
        } catch { /* continuar */ }
      }

      // ── Final ──────────────────────────────────────────────────────────────
      log("¡Pirámide completa — estratégico → anual → trimestral → backlog!", "section");
      await new Promise(r => setTimeout(r, 1200));

      // Limpiar estado de sesión — demo completado
      try {
        [STORAGE_KEY + "_company", STORAGE_KEY + "_industry", STORAGE_KEY + "_challenge"]
          .forEach(k => sessionStorage.removeItem(k));
      } catch { /* ignore */ }

      enterPresentation(company || "Demo");
      router.push("/traceability");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(
        msg.includes("límite")
          ? "El ciclo ya tiene el máximo de objetivos. Usa 'Limpiar organización' y vuelve a intentarlo."
          : "Error al construir la estrategia. Verifica la consola e inténtalo de nuevo.",
        "error"
      );
      setLaunchError(
        msg.includes("límite")
          ? "El ciclo ya tiene el máximo de objetivos permitidos. Usa 'Limpiar organización' en el panel de administración y vuelve a intentarlo."
          : "Error al crear los objetivos. Inténtalo de nuevo."
      );
      setLaunching(false);
    }
  }

  // ── Computed values ────────────────────────────────────────────────────────

  const canGoNext =
    step === 0 ? company.trim().length > 0 && challenge.trim().length > 10 :
    step === 1 ? objectives.length > 0 && objectives.some(o => o.title.trim()) :
    step === 2 ? true : false;

  const currentHint = STEPS[step]?.hint;

  const problemCount = demoStrategy?.problems?.length ?? 3;
  const intentCount = demoStrategy?.strategic_intents?.length ?? 2;
  const areaOkrCount = demoStrategy?.area_okrs?.length ?? 3;
  const teamOkrCount = demoStrategy?.team_okrs?.length ?? 2;
  const storyCount = demoStrategy?.initiatives?.reduce((acc, i) => acc + (i.stories?.length ?? 0), 0) ?? 6;
  const iniCount = demoStrategy?.initiatives?.length ?? 2;
  const companyObjCount = objectives.filter(o => o.title.trim()).length;
  const totalKrs = objectives.reduce((acc, o) => acc + o.key_results.filter(kr => kr.title.trim()).length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col items-center justify-start py-12 px-4">
      {/* Header */}
      <div className="text-center mb-8 max-w-lg">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          Wizard de Demo — 15 minutos
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Construye la estrategia de tu prospecto
        </h1>
        <p className="text-sm text-muted-foreground">
          En 4 pasos rápidos, tu prospecto verá su propia estrategia completa en el sistema.
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

      {/* Step content */}
      <div className="w-full max-w-2xl">

        {/* Step 0: Context */}
        {step === 0 && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">¿A quién le vamos a mostrar?</h2>
              <p className="text-sm text-muted-foreground">Escribe el nombre de la empresa y su mayor desafío estratégico actual.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nombre de la empresa</label>
                <Input
                  placeholder="Ej: Constructora del Pacífico"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Industria</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                >
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Desafíos y contexto estratégico</label>
                <Textarea
                  placeholder={"Podés listar varios desafíos. Ej:\n1. Alta rotación de clientes — el 40% abandona en los primeros 90 días.\n2. Costos operativos creciendo más rápido que los ingresos.\n3. El equipo no tiene visibilidad de cómo su trabajo impacta la estrategia."}
                  value={challenge}
                  onChange={e => setChallenge(e.target.value)}
                  className="min-h-[120px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">{challenge.length}/600 — listá 2–4 desafíos concretos para que la IA genere una estrategia más precisa</p>
              </div>
            </div>
          </Card>
        )}

        {/* Step 1: Objectives */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-1">Objetivos estratégicos</h2>
              <p className="text-sm text-muted-foreground">Claude generó estos objetivos para <strong>{company}</strong>. Edítalos si es necesario.</p>
            </div>

            {/* Step 1 never shows spinner — generation happens before advancing */}

            {aiError && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {aiError}
              </div>
            )}

            {/* Summary pills from AI */}
            {!generating && demoStrategy && (
              <div className="flex flex-wrap gap-2 justify-center">
                <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-1 text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3" />
                  {demoStrategy.problems?.length ?? 0} problemas identificados
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-800 px-3 py-1 text-xs text-violet-700 dark:text-violet-300">
                  <Lightbulb className="h-3 w-3" />
                  {demoStrategy.strategic_intents?.length ?? 0} intenciones estratégicas
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-3 py-1 text-xs text-blue-700 dark:text-blue-300">
                  <Network className="h-3 w-3" />
                  {demoStrategy.area_okrs?.length ?? 0} OKRs de área
                </div>
              </div>
            )}

            {!generating && objectives.map((obj, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingIdx === i ? (
                      <div className="space-y-2">
                        <Input
                          value={obj.title}
                          onChange={e => updateObjTitle(i, e.target.value)}
                          autoFocus
                          className="font-medium"
                        />
                        <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Listo
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-medium leading-snug flex-1">{obj.title}</p>
                        <button onClick={() => setEditingIdx(i)} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {obj.description && (
                      <p className="text-xs text-muted-foreground mt-1">{obj.description}</p>
                    )}
                  </div>
                </div>
                <div className="pl-9 text-xs text-muted-foreground space-y-1">
                  {obj.key_results.map((kr, j) => (
                    <div key={j} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      {kr.title}
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            {!generating && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full border border-dashed"
                onClick={generateObjectives}
                disabled={generating}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Regenerar con IA
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Key Results */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-1">Resultados clave</h2>
              <p className="text-sm text-muted-foreground">Ajusta los números y métricas para que sean realistas para {company}.</p>
            </div>
            {objectives.map((obj, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm font-medium leading-snug">{obj.title}</p>
                </div>
                <div className="pl-8 space-y-2">
                  {obj.key_results.map((kr, j) => (
                    <div key={j} className="grid grid-cols-[1fr_100px_80px_auto] gap-2 items-center">
                      <Input
                        value={kr.title}
                        onChange={e => updateKr(i, j, "title", e.target.value)}
                        placeholder="Descripción del resultado"
                        className="text-xs h-8"
                      />
                      <Input
                        type="number"
                        value={kr.target_value}
                        onChange={e => updateKr(i, j, "target_value", e.target.value)}
                        placeholder="Meta"
                        className="text-xs h-8 text-center"
                      />
                      <Input
                        value={kr.metric_unit}
                        onChange={e => updateKr(i, j, "metric_unit", e.target.value)}
                        placeholder="Unidad"
                        className="text-xs h-8 text-center"
                      />
                      <button
                        onClick={() => removeKr(i, j)}
                        disabled={obj.key_results.length <= 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Eliminar KR"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addKr(i)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    Agregar KR
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Step 3: Launch */}
        {step === 3 && (
          <Card className="p-8 text-center space-y-6">
            {/* Loading overlay */}
            {launching ? (
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Claude está construyendo la estrategia de <strong>{company}</strong>…
                </p>
                <BuildLog entries={buildLog} />
                <p className="text-xs text-muted-foreground">No cierres esta pestaña</p>
              </div>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
                  <Rocket className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">¡Estrategia lista para {company}!</h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Claude construirá la pirámide estratégica completa en vivo. Tu prospecto verá cada pieza aparecer en tiempo real.
                  </p>
                </div>

                {/* Stats grid — pirámide completa */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-2.5 text-center">
                    <div className="text-lg font-bold text-red-700 dark:text-red-300">{problemCount}</div>
                    <div className="text-[10px] text-red-600 dark:text-red-400">Problemas</div>
                  </div>
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 p-2.5 text-center">
                    <div className="text-lg font-bold text-violet-700 dark:text-violet-300">{intentCount}</div>
                    <div className="text-[10px] text-violet-600 dark:text-violet-400">Intenciones</div>
                  </div>
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-center">
                    <div className="text-lg font-bold text-primary">{companyObjCount}</div>
                    <div className="text-[10px] text-muted-foreground">OKRs empresa</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-2.5 text-center">
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{areaOkrCount}</div>
                    <div className="text-[10px] text-blue-600 dark:text-blue-400">OKRs área</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-2.5 text-center">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{teamOkrCount}</div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">OKRs equipo</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-2.5 text-center">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{storyCount}</div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">Historias US</div>
                  </div>
                </div>

                {/* Qué verás */}
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Pirámide completa que verá tu prospecto</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      {problemCount} problemas → {intentCount} intenciones estratégicas a 3-5 años
                    </li>
                    <li className="flex items-start gap-2">
                      <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      {companyObjCount} OKRs empresa → {areaOkrCount} OKRs área → {teamOkrCount} OKRs equipo
                    </li>
                    <li className="flex items-start gap-2">
                      <Network className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                      {iniCount} iniciativas con {storyCount} historias de usuario en el backlog
                    </li>
                    <li className="flex items-start gap-2">
                      <Eye className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      Trazabilidad completa visible: problema → estrategia → OKR → historia
                    </li>
                  </ul>
                </div>

                {/* Confirmación */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 text-left space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                      <p className="font-medium mb-1">Confirma antes de continuar</p>
                      <p>
                        La estrategia se creará en <strong>{currentUser?.org_name ?? "tu organización"}</strong>
                        {activeCycle && <>, ciclo <strong>{activeCycle.name}</strong></>}.
                        {" "}Los datos de demo anteriores serán reemplazados automáticamente.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-amber-800 dark:text-amber-300 pl-6">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-amber-600"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                    />
                    Entendido, crear en <strong className="mx-1">{currentUser?.org_name ?? "esta organización"}</strong>
                  </label>
                </div>

                {!activeCycle && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-left space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>No hay un ciclo activo en esta organización. Crea uno y luego vuelve aquí — el wizard guardó tu avance.</span>
                    </div>
                    <div className="flex gap-2 pl-6">
                      <a href="/cycles" target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <ExternalLink className="h-3 w-3" />
                          Crear ciclo (nueva pestaña)
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        disabled={checkingCycle}
                        onClick={async () => {
                          setCheckingCycle(true);
                          await refetchCycle();
                          await qc.invalidateQueries({ queryKey: ["cycles"] });
                          setCheckingCycle(false);
                        }}
                      >
                        {checkingCycle
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                        Ya lo creé, verificar
                      </Button>
                    </div>
                  </div>
                )}

                {launchError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive text-left">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {launchError}
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full max-w-xs mx-auto"
                  onClick={launch}
                  disabled={!activeCycle || !confirmed}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Construir estrategia completa
                </Button>
              </>
            )}
          </Card>
        )}

        {/* Hint */}
        {!launching && currentHint && step < 3 && (
          <div className="flex items-start gap-2 mt-4 px-1 text-xs text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
            <span><strong className="text-foreground">A continuación:</strong> {currentHint}</span>
          </div>
        )}

        {/* Navigation */}
        <div className={cn("flex mt-6", step === 0 ? "justify-end" : "justify-between")}>
          {step > 0 && step < 3 && (
            <Button variant="ghost" onClick={goPrev} disabled={generating || launching}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Atrás
            </Button>
          )}
          {step === 3 && !launching && (
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Atrás
            </Button>
          )}
          {step < 3 && (
            <Button onClick={goNext} disabled={!canGoNext || generating} className="gap-1.5">
              {generating && step === 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {generating && step === 0 ? "Generando estrategia…" : step === 2 ? "Ver resumen final" : "Siguiente"}
              {!generating && <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
