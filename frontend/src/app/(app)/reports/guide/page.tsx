"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Lightbulb, Compass, CalendarRange, Zap,
  Rocket, Layers, BookOpen, FileText, ArrowDown, ArrowRight,
  CheckCircle2, Info, Shuffle,
} from "lucide-react";

// ── Layer data ────────────────────────────────────────────────────────────────

const LAYERS = [
  {
    id: "problem",
    icon: AlertTriangle,
    label: "Diagnóstico",
    sublabel: "Problema organizacional",
    color: "rose",
    horizon: "Permanente",
    question: "¿Qué fricción o brecha frena a la organización?",
    definition: "Situación identificada que, si no se atiende, impide alcanzar los objetivos estratégicos.",
    example: "\"La tasa de abandono en los primeros 30 días supera el 40%.\"",
    rule: "Un diagnóstico puede originar una o varias intenciones estratégicas. No tiene fecha de vencimiento fija.",
    creates: "Intención estratégica",
  },
  {
    id: "intent",
    icon: Lightbulb,
    label: "Intención Estratégica",
    sublabel: "Dirección de largo plazo",
    color: "violet",
    horizon: "3–5 años",
    question: "¿Hacia dónde queremos movernos para resolver ese problema?",
    definition: "Declaración cualitativa de la dirección estratégica que la organización quiere tomar. No es un objetivo medible; es una apuesta.",
    example: "\"Convertirnos en la plataforma de referencia para retención de clientes B2B.\"",
    rule: "Cada intención puede alinearse a múltiples OKRs estratégicos. Puede derivar de uno o varios diagnósticos.",
    creates: "OKR Estratégico",
  },
  {
    id: "strategic",
    icon: Compass,
    label: "OKR Estratégico",
    sublabel: "Objetivo de largo plazo",
    color: "indigo",
    horizon: "2–3 años",
    question: "¿Qué resultado concreto, medible, demuestra que avanzamos en esa dirección?",
    definition: "Objetivo ambicioso con Key Results que miden el avance hacia la intención estratégica. Lo gestiona la dirección de la empresa.",
    example: "O: Liderar retención en el mercado LATAM. KR1: NPS +25 pts. KR2: Churn < 5%.",
    rule: "Se descompone en OKRs anuales. Un OKR anual solo puede tener UN padre estratégico.",
    creates: "OKR Anual",
  },
  {
    id: "annual",
    icon: CalendarRange,
    label: "OKR Anual",
    sublabel: "Objetivo de año fiscal",
    color: "blue",
    horizon: "1 año",
    question: "¿Qué logramos este año para acercarnos al OKR estratégico?",
    definition: "Desglose anual del OKR estratégico. Asignado por área o unidad de negocio. Debe ser alcanzable en 12 meses.",
    example: "O: Mejorar activación en el primer mes. KR1: TTFV < 3 días. KR2: Tutorial completion > 70%.",
    rule: "Se descompone en OKRs trimestrales. Una iniciativa larga puede vincularse directamente a un KR anual.",
    creates: "OKR Trimestral o Iniciativa",
  },
  {
    id: "quarterly",
    icon: Zap,
    label: "OKR Trimestral",
    sublabel: "Objetivo de 90 días",
    color: "amber",
    horizon: "90 días",
    question: "¿Qué movemos en este ciclo para avanzar el OKR anual?",
    definition: "OKR de equipo. Es el nivel donde se aterrizan las iniciativas y el trabajo de ejecución. Cadencia de check-in semanal o quincenal.",
    example: "O: Reducir abandono en onboarding. KR1: Paso 3 completion > 80%. KR2: Drop-off en paso 1 < 15%.",
    rule: "Una iniciativa se vincula al KR trimestral que más directamente mueve. No al tipo de ciclo: al KR específico.",
    creates: "Iniciativa",
  },
  {
    id: "initiative",
    icon: Rocket,
    label: "Iniciativa",
    sublabel: "Proyecto táctico de ejecución",
    color: "emerald",
    horizon: "Semanas–meses",
    question: "¿Qué construimos o hacemos para mover ese Key Result?",
    definition: "Proyecto con dueño, fechas y hitos. Está justificado porque mueve uno o más KRs. Puede vincular KRs de distintos niveles si el impacto es transversal.",
    example: "\"Rediseño del flujo de onboarding\" vinculada al KR1 del OKR trimestral y al TTFV del OKR anual.",
    rule: "Una iniciativa puede tener una o varias épicas. Sin iniciativa, una épica pierde justificación estratégica.",
    creates: "Épica",
  },
  {
    id: "epic",
    icon: Layers,
    label: "Épica",
    sublabel: "Bloque de valor entregable",
    color: "teal",
    horizon: "1–3 meses",
    question: "¿Qué capacidad o bloque de valor entrega esta iniciativa?",
    definition: "Agrupa features que juntas entregan una capacidad completa. Tiene criterios de aceptación de alto nivel y sponsor claro.",
    example: "\"Nuevo wizard de activación\" con 3 features: paso de perfil, paso de configuración, paso de primer uso.",
    rule: "Una épica pertenece a una sola iniciativa (o ninguna, para deuda técnica). Sus features son sus hijas directas.",
    creates: "Feature",
  },
  {
    id: "feature",
    icon: BookOpen,
    label: "Feature",
    sublabel: "Funcionalidad entregable",
    color: "sky",
    horizon: "1–2 sprints",
    question: "¿Qué funcionalidad habilita o completa esta épica?",
    definition: "Unidad de funcionalidad probable e independiente que entrega valor al usuario. Tiene criterios de aceptación verificables por QA.",
    example: "\"Formulario de perfil con validación en tiempo real y guardado automático.\"",
    rule: "Una feature pertenece a una sola épica. Sus historias son sus hijas directas. Es demostrable en una sprint review.",
    creates: "Historia de usuario",
  },
  {
    id: "story",
    icon: FileText,
    label: "Historia de Usuario",
    sublabel: "Unidad mínima ejecutable",
    color: "slate",
    horizon: "1–3 días",
    question: "¿Qué acción concreta hace el usuario para obtener este valor?",
    definition: "Descripción de una interacción específica del usuario. Formato: Como [rol] / Quiero [acción] / Para [beneficio]. Criterios: Dado / Cuando / Entonces.",
    example: "\"Como nuevo usuario, quiero completar mi perfil en 3 pasos para activar mi cuenta sin fricción.\"",
    rule: "Una historia pertenece a una sola feature. Es la unidad que entra a un sprint. Estimada en story points.",
    creates: null,
  },
];

// ── Color map ─────────────────────────────────────────────────────────────────

const COLOR: Record<string, {
  bg: string; border: string; badge: string; icon: string; dot: string; line: string;
}> = {
  rose:    { bg: "bg-rose-50 dark:bg-rose-950/30",    border: "border-rose-200 dark:border-rose-800",    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",    icon: "text-rose-600 dark:text-rose-400",    dot: "bg-rose-500",    line: "border-rose-200 dark:border-rose-800" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-950/30",  border: "border-violet-200 dark:border-violet-800",  badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",  icon: "text-violet-600 dark:text-violet-400",  dot: "bg-violet-500",  line: "border-violet-200 dark:border-violet-800" },
  indigo:  { bg: "bg-indigo-50 dark:bg-indigo-950/30",  border: "border-indigo-200 dark:border-indigo-800",  badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",  icon: "text-indigo-600 dark:text-indigo-400",  dot: "bg-indigo-500",  line: "border-indigo-200 dark:border-indigo-800" },
  blue:    { bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",    icon: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-500",    line: "border-blue-200 dark:border-blue-800" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",   icon: "text-amber-600 dark:text-amber-400",   dot: "bg-amber-500",   line: "border-amber-200 dark:border-amber-800" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", line: "border-emerald-200 dark:border-emerald-800" },
  teal:    { bg: "bg-teal-50 dark:bg-teal-950/30",    border: "border-teal-200 dark:border-teal-800",    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",    icon: "text-teal-600 dark:text-teal-400",    dot: "bg-teal-500",    line: "border-teal-200 dark:border-teal-800" },
  sky:     { bg: "bg-sky-50 dark:bg-sky-950/30",     border: "border-sky-200 dark:border-sky-800",     badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",     icon: "text-sky-600 dark:text-sky-400",     dot: "bg-sky-500",     line: "border-sky-200 dark:border-sky-800" },
  slate:   { bg: "bg-slate-50 dark:bg-slate-950/30",   border: "border-slate-200 dark:border-slate-800",   badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",   icon: "text-slate-500 dark:text-slate-400",   dot: "bg-slate-400",   line: "border-slate-200 dark:border-slate-700" },
};

// ── Dividers between strategy and execution ───────────────────────────────────

const DIVIDERS: Record<string, { label: string; color: string }> = {
  initiative: {
    label: "↓ ESTRATEGIA  →  EJECUCIÓN ↓",
    color: "bg-gradient-to-r from-amber-100 via-emerald-100 to-emerald-100 dark:from-amber-950/40 dark:via-emerald-950/40 dark:to-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
};

// ── Environment compatibility ─────────────────────────────────────────────────

const ENVS = [
  {
    label: "Ágil",
    icon: Zap,
    color: "amber",
    desc: "OKRs trimestrales → iniciativas → épicas → features → historias en sprints. Check-ins semanales. Entrega continua.",
    layers: ["quarterly", "initiative", "epic", "feature", "story"],
  },
  {
    label: "Cascada",
    icon: ArrowDown,
    color: "blue",
    desc: "OKRs anuales/estratégicos → iniciativas → épicas como fases → features como entregables. Sin sprints. Fases con gates.",
    layers: ["strategic", "annual", "initiative", "epic", "feature"],
  },
  {
    label: "Híbrido",
    icon: Shuffle,
    color: "violet",
    desc: "OKRs estratégicos y anuales definen la dirección. OKRs trimestrales y sprints ejecutan en ciclos cortos. Lo mejor de ambos mundos.",
    layers: ["strategic", "annual", "quarterly", "initiative", "epic", "feature", "story"],
  },
];

const layerDot: Record<string, string> = {
  problem: "bg-rose-500", intent: "bg-violet-500", strategic: "bg-indigo-500",
  annual: "bg-blue-500", quarterly: "bg-amber-500", initiative: "bg-emerald-500",
  epic: "bg-teal-500", feature: "bg-sky-500", story: "bg-slate-400",
};

// ── Key rules ─────────────────────────────────────────────────────────────────

const KEY_RULES = [
  {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    title: "La iniciativa se ata al Key Result, no al tipo de ciclo",
    desc: "Cuando creas una iniciativa, eliges el KR específico que va a mover. Ese KR puede pertenecer a un OKR trimestral, anual o estratégico. El sistema conecta automáticamente la cadena.",
  },
  {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    title: "Una épica sin iniciativa es deuda no justificada",
    desc: "Puedes crear épicas sin iniciativa (para deuda técnica o mejoras internas). Pero si una épica existe sin iniciativa, no hay OKR que justifique su existencia. Úsalo con intención.",
  },
  {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    title: "El progreso sube automáticamente",
    desc: "Cada check-in en un KR actualiza el OKR. El avance de historias actualiza la feature, que actualiza la épica, que actualiza la iniciativa. La cascada es automática.",
  },
  {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    title: "Trazabilidad completa en todo momento",
    desc: "Ve a Trazabilidad para ver el mapa completo: desde el problema original hasta la historia de usuario en sprint. Puedes hacer clic en cualquier elemento para ver sus conexiones.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Cómo funciona el sistema"
        description="Jerarquía completa: desde el diagnóstico estratégico hasta la historia de usuario. Válido para entornos ágiles, en cascada e híbridos."
      />

      {/* ── Visual hierarchy ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Cascada estratégica completa
        </h2>

        <div className="space-y-0">
          {LAYERS.map((layer, idx) => {
            const c = COLOR[layer.color];
            const Icon = layer.icon;
            const isFirst = idx === 0;
            const showDivider = layer.id === "initiative";

            return (
              <div key={layer.id}>
                {showDivider && (
                  <div className="flex items-center gap-3 my-2 px-1">
                    <div className="flex-1 border-t border-dashed border-emerald-300 dark:border-emerald-700" />
                    <span className={cn(
                      "text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border",
                      "bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-950/40 dark:to-emerald-950/40",
                      "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
                    )}>
                      Estrategia → Ejecución
                    </span>
                    <div className="flex-1 border-t border-dashed border-emerald-300 dark:border-emerald-700" />
                  </div>
                )}

                <div className="flex gap-0">
                  {/* Left connector */}
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <div className={cn(
                      "h-3 w-px",
                      isFirst ? "opacity-0" : "bg-border",
                    )} />
                    <div className={cn("h-3 w-3 rounded-full shrink-0 ring-2 ring-background", c.dot)} />
                    <div className={cn(
                      "flex-1 w-px min-h-[8px]",
                      layer.creates ? "bg-border" : "opacity-0",
                    )} />
                  </div>

                  {/* Card */}
                  <div className={cn(
                    "flex-1 min-w-0 rounded-xl border p-4 mb-2",
                    c.bg, c.border,
                  )}>
                    <div className="flex items-start gap-3 flex-wrap">
                      {/* Icon + label */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20">
                          <Icon className={cn("h-4.5 w-4.5", c.icon)} />
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold", c.icon)}>{layer.label}</p>
                          <p className="text-[10px] text-muted-foreground">{layer.sublabel}</p>
                        </div>
                      </div>

                      {/* Horizon badge */}
                      <span className={cn(
                        "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full self-start mt-1",
                        c.badge,
                      )}>
                        {layer.horizon}
                      </span>

                      {/* Arrow to next */}
                      {layer.creates && (
                        <div className="flex items-center gap-1.5 ml-auto shrink-0 self-start mt-1">
                          <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                          <span className="text-[10px] text-muted-foreground/60">crea</span>
                          <span className="text-[10px] font-semibold text-muted-foreground">{layer.creates}</span>
                        </div>
                      )}
                    </div>

                    {/* Content grid */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pregunta clave</p>
                        <p className="text-xs text-foreground italic">{layer.question}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Definición</p>
                        <p className="text-xs text-muted-foreground">{layer.definition}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ejemplo</p>
                        <p className="text-xs text-muted-foreground">{layer.example}</p>
                      </div>
                    </div>

                    <div className={cn(
                      "mt-2.5 rounded-lg px-3 py-2 text-xs",
                      "bg-white/50 dark:bg-black/20",
                    )}>
                      <span className="font-semibold">Regla: </span>
                      <span className="text-muted-foreground">{layer.rule}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Key rules ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Reglas fundamentales del sistema
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {KEY_RULES.map((rule, i) => {
            const Icon = rule.icon;
            return (
              <Card key={i} className="p-4 flex gap-3">
                <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", rule.color)} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{rule.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{rule.desc}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Environments ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          ¿Cómo funciona en tu entorno?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ENVS.map(env => {
            const Icon = env.icon;
            const c = COLOR[env.color];
            return (
              <Card key={env.label} className={cn("p-4 border-2 space-y-3", c.border)}>
                <div className="flex items-center gap-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", c.bg)}>
                    <Icon className={cn("h-4 w-4", c.icon)} />
                  </div>
                  <p className={cn("text-sm font-bold", c.icon)}>{env.label}</p>
                </div>
                <p className="text-xs text-muted-foreground">{env.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {env.layers.map(l => (
                    <span
                      key={l}
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", layerDot[l])} />
                      {LAYERS.find(x => x.id === l)?.label ?? l}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Connection summary ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Resumen de conexiones
        </h2>
        <Card className="p-4 overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b">
                <th className="text-left font-semibold text-muted-foreground pb-2 pr-4">Artefacto</th>
                <th className="text-left font-semibold text-muted-foreground pb-2 pr-4">Se conecta con</th>
                <th className="text-left font-semibold text-muted-foreground pb-2 pr-4">Tipo de vínculo</th>
                <th className="text-left font-semibold text-muted-foreground pb-2">Cardinalidad</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["Diagnóstico", "Intención Estratégica", "Muchos diagnósticos → muchas intenciones (M:M)", "N:N"],
                ["Intención Estratégica", "OKR Estratégico", "strategic_intent_id en el objetivo", "1:N"],
                ["OKR Estratégico", "OKR Anual", "parent_objective_id en el objetivo anual", "1:N"],
                ["OKR Anual", "OKR Trimestral", "parent_objective_id en el objetivo trimestral", "1:N"],
                ["OKR (cualquier nivel)", "Iniciativa", "initiative_key_results → key_results → objective", "N:N"],
                ["Iniciativa", "Épica", "initiative_id en backlog_items (EPIC)", "1:N"],
                ["Épica", "Feature", "parent_id en backlog_items (FEATURE)", "1:N"],
                ["Feature", "Historia", "parent_id en backlog_items (STORY)", "1:N"],
              ].map(([from, to, mechanism, card]) => (
                <tr key={from} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2 pr-4 font-medium text-foreground">{from}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                      {to}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{mechanism}</td>
                  <td className="py-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold",
                      card === "N:N"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                    )}>
                      {card}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Esta guía refleja el modelo de datos real del sistema</p>
            <p className="text-xs text-muted-foreground">
              Todos los vínculos descritos aquí están implementados en la base de datos. Puedes verificar cualquier conexión en la pantalla de{" "}
              <a href="/traceability" className="underline underline-offset-2 text-primary hover:text-primary/80">
                Trazabilidad
              </a>
              , donde se visualiza la cadena completa desde diagnóstico hasta historia de usuario.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
