"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, ExternalLink, Users, Target, Zap, BarChart3, Stethoscope, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import Link from "next/link";
import { useOrganization, useUpdateOrganization } from "@/hooks/useOrganization";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PhaseStatus = "not_started" | "in_progress" | "completed";

interface Activity {
  label: string;
  href?: string;
  description: string;
}

interface Phase {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  duration: string;
  effort: string;        // estimación para el consultor
  icon: React.ElementType;
  color: string;
  bgColor: string;
  deliverable: string;
  activities: Activity[];
}

const PHASES: Phase[] = [
  {
    id: "diagnosis",
    number: 1,
    title: "Diagnóstico",
    subtitle: "Entender el punto de partida",
    duration: "1–2 semanas",
    effort: "8–12 h consultor",
    icon: Stethoscope,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50",
    deliverable: "Informe de diagnóstico: sector, problemas prioritarios y brechas estratégicas",
    activities: [
      { label: "Evaluación del sector", href: "/sector-assessment", description: "Mapear amenazas estructurales con la metodología de las 5 fuerzas extendida." },
      { label: "Diagnóstico de problemas", href: "/problems", description: "Registrar los problemas organizacionales por severidad y frecuencia." },
      { label: "Entrevistas con líderes", description: "Validar hallazgos con OWNER/ADMIN. Mínimo 3 entrevistas de 45 min." },
      { label: "Acuerdos iniciales", href: "/agreements", description: "Registrar compromisos que ya existen antes de empezar la estrategia." },
    ],
  },
  {
    id: "strategy",
    number: 2,
    title: "Diseño estratégico",
    subtitle: "Definir adónde va la organización",
    duration: "1–2 semanas",
    effort: "6–10 h consultor",
    icon: Target,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50",
    deliverable: "Mapa estratégico aprobado: visión, intenciones y categorías con intents activos",
    activities: [
      { label: "Visión y propósito", href: "/strategy", description: "Redactar la visión organizacional en la sección de Mapa estratégico." },
      { label: "Intenciones estratégicas", href: "/strategy", description: "Definir 4–6 intenciones (GROWTH, INNOVATION, EFFICIENCY, CULTURE…) con el equipo directivo." },
      { label: "Taller de validación", description: "Presentar el mapa a la junta o comité directivo para aprobación formal." },
      { label: "Acuerdos de junta", href: "/agreements", description: "Registrar los acuerdos y compromisos que emerjan del taller." },
    ],
  },
  {
    id: "okrs",
    number: 3,
    title: "OKRs del ciclo",
    subtitle: "Traducir estrategia en objetivos medibles",
    duration: "1 semana",
    effort: "4–8 h consultor",
    icon: Target,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/50",
    deliverable: "OKRs aprobados: empresa + área + equipo, con KRs medibles y owners asignados",
    activities: [
      { label: "Crear ciclo", href: "/cycles", description: "Definir el período (trimestre, semestre o anual) y activarlo." },
      { label: "OKRs de empresa y área", href: "/strategic", description: "Máx. 5 objetivos × nivel, 3–5 KRs por objetivo. Usar OKR Coach para validar calidad." },
      { label: "OKRs de equipo", href: "/tactical", description: "Cada equipo alinea sus objetivos a los de empresa/área. Auditor detecta brechas." },
      { label: "Trazabilidad", href: "/traceability", description: "Verificar la cadena completa en la vista Pirámide o Mapa." },
    ],
  },
  {
    id: "execution",
    number: 4,
    title: "Ejecución",
    subtitle: "Operar el ritmo de trabajo",
    duration: "Duración del ciclo",
    effort: "2–4 h/semana consultor",
    icon: Zap,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50",
    deliverable: "Ritmo de ejecución establecido: check-ins semanales, iniciativas avanzando, sprints activos",
    activities: [
      { label: "Iniciativas y épicas", href: "/initiatives", description: "Vincular cada iniciativa a sus KRs. Convertir acuerdos en épicas con IA." },
      { label: "Backlog y sprints", href: "/backlog", description: "Descomponer épicas en features e historias. Generar sprints automáticamente." },
      { label: "Check-ins semanales", href: "/checkins", description: "Cada owner actualiza progreso con confianza y notas. Risk Sentinel detecta riesgos." },
      { label: "Seguimiento de acuerdos", href: "/agreements", description: "Revisar el estado de compromisos en cada reunión de seguimiento." },
    ],
  },
  {
    id: "review",
    number: 5,
    title: "Revisión y cierre",
    subtitle: "Aprender y preparar el siguiente ciclo",
    duration: "1 semana",
    effort: "4–6 h consultor",
    icon: BarChart3,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50",
    deliverable: "Reporte de cierre: logros, lecciones aprendidas, OKRs del siguiente ciclo iniciados",
    activities: [
      { label: "Dashboard ejecutivo", href: "/reports/executive-dashboard", description: "Revisar score final del ciclo, KPIs y comparativa con ciclos anteriores." },
      { label: "Cierre de ciclo", href: "/cycles", description: "Cerrar el ciclo y generar el reporte automático con Executive Briefer." },
      { label: "Reporte ejecutivo", href: "/reports/executive-briefing", description: "Descargar PDF o PPTX para presentar a la junta directiva." },
      { label: "Gobierno y acuerdos", href: "/agreements", description: "Marcar acuerdos como cumplidos. Registrar compromisos del próximo ciclo." },
    ],
  },
];

// ── Estimación de esfuerzo total ─────────────────────────────────────────────

const EFFORT_ROWS = [
  { phase: "Diagnóstico",         weeks: "1–2",   hours: "8–12",    sessions: 2 },
  { phase: "Diseño estratégico",  weeks: "1–2",   hours: "6–10",    sessions: 2 },
  { phase: "OKRs del ciclo",      weeks: "1",     hours: "4–8",     sessions: 1 },
  { phase: "Ejecución (semanal)", weeks: "ciclo", hours: "2–4 /sem",sessions: 1 },
  { phase: "Revisión y cierre",   weeks: "1",     hours: "4–6",     sessions: 1 },
];

// ── Phase card ────────────────────────────────────────────────────────────────

function PhaseCard({ phase, status, onToggleStatus }: {
  phase: Phase;
  status: PhaseStatus;
  onToggleStatus: (s: PhaseStatus) => void;
}) {
  const t = useTranslations("pages.consultantRoadmap");
  const [open, setOpen] = useState(false);
  const Icon = phase.icon;

  const nextStatus: Record<PhaseStatus, PhaseStatus> = {
    not_started: "in_progress",
    in_progress: "completed",
    completed: "not_started",
  };
  const statusLabel: Record<PhaseStatus, string> = {
    not_started: t("notStarted"),
    in_progress: t("inProgress"),
    completed: t("completedStatus"),
  };
  const statusColor: Record<PhaseStatus, string> = {
    not_started: "text-muted-foreground",
    in_progress: "text-blue-600 dark:text-blue-400",
    completed: "text-green-600 dark:text-green-400",
  };

  return (
    <Card className={cn("border transition-all", status === "completed" && "opacity-80")}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("rounded-xl p-2.5 border shrink-0", phase.bgColor)}>
            <Icon className={cn("h-5 w-5", phase.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground/60">FASE {phase.number}</span>
                  <span className={cn("text-xs font-medium", statusColor[status])}>{statusLabel[status]}</span>
                </div>
                <h3 className="font-semibold text-sm mt-0.5">{phase.title}</h3>
                <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium">{phase.duration}</p>
                  <p className="text-xs text-muted-foreground">{phase.effort}</p>
                </div>
                <button
                  onClick={() => onToggleStatus(nextStatus[status])}
                  className="shrink-0"
                  title={`Cambiar a: ${statusLabel[nextStatus[status]]}`}
                >
                  {status === "completed"
                    ? <CheckCircle2 className="h-6 w-6 text-green-500" />
                    : status === "in_progress"
                    ? <Clock className="h-6 w-6 text-blue-500" />
                    : <Circle className="h-6 w-6 text-muted-foreground/40" />
                  }
                </button>
              </div>
            </div>

            <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Entregable: </span>{phase.deliverable}
            </div>

            <button
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground mt-2 transition-colors"
              onClick={() => setOpen(o => !o)}
            >
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {open ? "Ocultar actividades" : `Ver ${phase.activities.length} actividades`}
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-4 space-y-2 pl-14">
            {phase.activities.map((act, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-xs">{act.label}</span>
                    {act.href && (
                      <Link href={act.href} className="text-primary hover:underline flex items-center gap-0.5 text-xs">
                        Abrir <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{act.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ConsultantRoadmapPage() {
  const t = useTranslations("pages.consultantRoadmap");
  const { data: org } = useOrganization();
  const update = useUpdateOrganization();

  const [localPhases, setLocalPhases] = useState<Record<string, PhaseStatus>>({});

  // Sync from server on first org load (org is undefined on mount)
  useEffect(() => {
    if (!org) return;
    const phases = ((org.settings as Record<string, unknown> | undefined)?.consultant_phases ?? {}) as Record<string, PhaseStatus>;
    setLocalPhases(phases);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  const setPhaseStatus = async (phaseId: string, status: PhaseStatus) => {
    const next = { ...localPhases, [phaseId]: status };
    setLocalPhases(next);
    try {
      await update.mutateAsync({
        settings: { ...(org?.settings as Record<string, unknown> ?? {}), consultant_phases: next },
      });
    } catch { /* silent — local state ok */ }
  };

  const completedCount = PHASES.filter(p => localPhases[p.id] === "completed").length;
  const inProgressCount = PHASES.filter(p => localPhases[p.id] === "in_progress").length;
  const progressPct = Math.round((completedCount / PHASES.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {completedCount}/{PHASES.length} {t("phases")} · {progressPct}% {t("completed")}
            </span>
          </div>
        }
      />

      {/* Barra de progreso */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">{t("engagementProgress")}</p>
          <span className="text-sm font-bold">{progressPct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="text-green-600 dark:text-green-400 font-medium">{completedCount} {t("completedCount")}</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">{inProgressCount} {t("inProgressCount")}</span>
          <span>{PHASES.length - completedCount - inProgressCount} {t("notStartedCount")}</span>
        </div>
      </Card>

      {/* Fases */}
      <div className="space-y-3">
        {PHASES.map(phase => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            status={localPhases[phase.id] ?? "not_started"}
            onToggleStatus={s => setPhaseStatus(phase.id, s)}
          />
        ))}
      </div>

      {/* Tabla de esfuerzo */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">{t("effortEstimate")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Referencia para planificar el engagement con el cliente</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t("colPhase")}</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">{t("colDuration")}</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">{t("colHours")}</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground">{t("colSessions")}</th>
              </tr>
            </thead>
            <tbody>
              {EFFORT_ROWS.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{r.phase}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{r.weeks}</td>
                  <td className="px-4 py-2.5 text-center">{r.hours}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{r.sessions}</td>
                </tr>
              ))}
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-2.5">Total (ciclo típico 90 días)</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">~15 sem</td>
                <td className="px-4 py-2.5 text-center">40–60 h</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">8–10 ses.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nota */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-800 dark:text-blue-300">
        <p className="font-medium mb-1">Consejo para la demo en conferencia</p>
        <p className="text-xs leading-relaxed">
          El flujo más impactante: registrar un acuerdo en <Link href="/agreements" className="underline">Acuerdos</Link>, convertirlo en épica con IA, verlo en el <Link href="/backlog" className="underline">backlog</Link> alineado al OKR correspondiente, y mostrarlo en la <Link href="/traceability" className="underline">vista de trazabilidad</Link> en pirámide. Desde el compromiso hasta la historia de usuario en menos de 5 minutos.
        </p>
      </div>
    </div>
  );
}
