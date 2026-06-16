"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CalendarRange, Users, Target, CheckSquare, Bot,
  BarChart3, ShieldCheck, Settings2, ArrowRight,
  Info, Lightbulb, AlertTriangle, Zap, Clock,
  Mail, UserPlus, RefreshCw, TrendingUp, Brain,
  FileText, Download, Lock, ChevronRight,
} from "lucide-react";

// ── Tab definitions ─────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const TAB_DEFS = [
  { id: "cycles",     key: "cycles",     icon: CalendarRange, color: "blue" },
  { id: "teams",      key: "teams",      icon: Users,         color: "emerald" },
  { id: "okrs",       key: "createOkrs", icon: Target,        color: "indigo" },
  { id: "checkins",   key: "checkins",   icon: CheckSquare,   color: "amber" },
  { id: "ai",         key: "aiAgents",   icon: Bot,           color: "violet" },
  { id: "dashboards", key: "dashboards", icon: BarChart3,     color: "sky" },
  { id: "governance", key: "governance", icon: ShieldCheck,   color: "rose" },
  { id: "settings",   key: "settings",   icon: Settings2,     color: "slate" },
] as const;

// ── Color map ────────────────────────────────────────────────────────────────

const COLOR: Record<string, { bg: string; border: string; icon: string; tab: string; badge: string }> = {
  blue:    { bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800",    icon: "text-blue-600 dark:text-blue-400",    tab: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", icon: "text-emerald-600 dark:text-emerald-400", tab: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  indigo:  { bg: "bg-indigo-50 dark:bg-indigo-950/30",  border: "border-indigo-200 dark:border-indigo-800",  icon: "text-indigo-600 dark:text-indigo-400",  tab: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",  badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800",   icon: "text-amber-600 dark:text-amber-400",   tab: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-950/30",  border: "border-violet-200 dark:border-violet-800",  icon: "text-violet-600 dark:text-violet-400",  tab: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",  badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  sky:     { bg: "bg-sky-50 dark:bg-sky-950/30",     border: "border-sky-200 dark:border-sky-800",     icon: "text-sky-600 dark:text-sky-400",     tab: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",     badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  rose:    { bg: "bg-rose-50 dark:bg-rose-950/30",    border: "border-rose-200 dark:border-rose-800",    icon: "text-rose-600 dark:text-rose-400",    tab: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  slate:   { bg: "bg-slate-50 dark:bg-slate-950/30",   border: "border-slate-200 dark:border-slate-800",   icon: "text-slate-600 dark:text-slate-400",   tab: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",   badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

// ── Shared section helpers ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Step({ n, text, sub }: { n: number; text: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
        {n}
      </span>
      <div>
        <p className="text-sm text-foreground">{text}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Tip({ text, icon: Icon = Lightbulb }: { text: string; icon?: React.ElementType }) {
  return (
    <div className="flex gap-2 items-start rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2.5">
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
      <p className="text-xs text-foreground">{text}</p>
    </div>
  );
}

function Warn({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
      <p className="text-xs text-foreground">{text}</p>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline underline-offset-2">
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

// ── Tab content ──────────────────────────────────────────────────────────────

function CyclesContent() {
  const t = useTranslations("pages.docs");
  return (
    <div className="space-y-6">
      <Section title={t("whatIsCycle")}>
        <p className="text-sm text-muted-foreground">
          Un ciclo define el período de tiempo en el que viven los OKRs. Sin un ciclo activo, no puedes crear objetivos.
          Cada ciclo tiene un tipo, fechas de inicio/fin, y un estado (borrador, activo, cerrado).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: t("quarterly"), sub: "90 días", desc: "Para OKRs tácticos y de equipo. Cadencia ágil." },
            { label: t("annual"), sub: "1 año", desc: "Para OKRs de área o unidad de negocio." },
            { label: t("strategic"), sub: "2–3 años", desc: "Para objetivos de empresa y dirección ejecutiva." },
          ].map(ct => (
            <Card key={ct.label} className="p-3 space-y-1">
              <p className="text-sm font-semibold">{ct.label}</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ct.sub}</span>
              <p className="text-xs text-muted-foreground">{ct.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title={t("setupCycle")}>
        <div className="space-y-2.5">
          <Step n={1} text={`${t("goCycles")} → "${t("newCycle")}"`} sub="Menú lateral izquierdo, sección Estrategia." />
          <Step n={2} text={t("chooseCycleType")} sub="Recomendación: empieza con un ciclo Trimestral para equipos." />
          <Step n={3} text={t("assignDates")} sub="Para un Q2 típico: 1 de abril – 30 de junio." />
          <Step n={4} text={t("clickActivate")} sub="Solo puede haber un ciclo activo por tipo a la vez. Los demás quedan en borrador." />
          <Step n={5} text="Crea tus OKRs dentro del ciclo activo" sub="Los objetivos se vinculan al ciclo al crearlos." />
        </div>
        <Tip text="Crea primero el ciclo estratégico (2–3 años) si tienes OKRs de empresa. Los ciclos anuales y trimestrales se descomponen del estratégico para mantener trazabilidad." />
      </Section>

      <Section title={t("closeCycle")}>
        <div className="space-y-2.5">
          <Step n={1} text="Al final del período, ve a Ciclos y selecciona el ciclo activo" />
          <Step n={2} text='Haz clic en "Cerrar ciclo"' sub="Esto congela el progreso y genera el reporte final automáticamente." />
          <Step n={3} text="Revisa el reporte de cierre generado por el Executive Briefer (IA)" sub="Disponible en Reportes → Executive Briefing." />
          <Step n={4} text="Crea el siguiente ciclo y transfiere OKRs incompletos si es necesario" />
        </div>
        <Warn text="Un ciclo cerrado no se puede reabrir. Los check-ins en OKRs de ese ciclo quedan bloqueados. Asegúrate de que todos los check-ins finales estén registrados antes de cerrar." />
      </Section>

      <div className="pt-2">
        <NavLink href="/cycles" label="Ir a Ciclos" />
      </div>
    </div>
  );
}

function TeamsContent() {
  const t = useTranslations("pages.docs");
  return (
    <div className="space-y-6">
      <Section title={t("inviteMembers")}>
        <div className="space-y-2.5">
          <Step n={1} text='Ve a Configuración → pestaña "Equipo"' sub="Solo los roles ADMIN y OWNER pueden invitar." />
          <Step n={2} text='Haz clic en "Invitar miembro"' />
          <Step n={3} text="Ingresa el email y elige el rol" sub="Ver tabla de roles más abajo." />
          <Step n={4} text="El usuario recibirá un email con enlace de activación (válido 48 horas)" />
          <Step n={5} text="Una vez aceptada, la invitación aparece como activa en la lista" />
        </div>
        <Tip text="Puedes invitar a varias personas a la vez haciendo clic en 'Invitar' varias veces seguidas antes de cerrar el panel." />
      </Section>

      <Section title={t("rolesPermissions")}>
        <Card className="overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Rol</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Puede ver</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Puede editar</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { role: "OWNER", see: "Todo", edit: "Todo", admin: "✓ Billing incluido" },
                { role: "ADMIN", see: "Todo", edit: "Todo excepto billing", admin: "✓" },
                { role: "MANAGER", see: "Estratégico + Táctico", edit: "OKRs de su área", admin: "—" },
                { role: "MEMBER", see: "Táctico + Backlog", edit: "Sus tareas y check-ins", admin: "—" },
                { role: "VIEWER", see: "OKRs + Reportes (solo lectura)", edit: "—", admin: "—" },
              ].map(r => (
                <tr key={r.role} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-semibold">{r.role}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.see}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.edit}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.admin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Warn text="El rol OWNER no se puede cambiar desde la UI. Contacta soporte si necesitas transferir la propiedad de la organización." />
      </Section>

      <Section title={t("manageTeams")}>
        <div className="space-y-2.5">
          <Step n={1} text='Ve a Configuración → pestaña "Equipos"' />
          <Step n={2} text="Crea un equipo con nombre y agrega miembros" sub="Los equipos agrupan personas que comparten OKRs tácticos." />
          <Step n={3} text="Asigna OKRs tácticos al equipo desde la vista de OKRs Tácticos" />
          <Step n={4} text="Los miembros del equipo verán sus OKRs tácticos destacados en su vista personal" />
        </div>
        <Tip text="Un miembro puede pertenecer a múltiples equipos. Los check-ins que hace siempre quedan asociados al KR, independientemente del equipo." />
      </Section>

      <div className="pt-2">
        <NavLink href="/settings" label="Ir a Configuración" />
      </div>
    </div>
  );
}

function OKRsContent() {
  return (
    <div className="space-y-6">
      <Section title="Anatomía de un buen OKR">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4 space-y-2 border-indigo-200 dark:border-indigo-800">
            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Objetivo (O)</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-indigo-400" /> Cualitativo e inspirador, no medible en sí mismo</li>
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-indigo-400" /> Responde: ¿qué queremos lograr?</li>
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-indigo-400" /> Ambicioso pero alcanzable en el ciclo</li>
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-indigo-400" /> Ejemplo: "Dominar la retención en LATAM"</li>
            </ul>
          </Card>
          <Card className="p-4 space-y-2 border-violet-200 dark:border-violet-800">
            <p className="text-sm font-bold text-violet-600 dark:text-violet-400">Key Result (KR)</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-violet-400" /> Medible con valor inicial, meta y unidad</li>
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-violet-400" /> Responde: ¿cómo sabemos que lo logramos?</li>
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-violet-400" /> 2–4 KRs por objetivo, no más</li>
              <li className="flex gap-1.5"><ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-violet-400" /> Ejemplo: "Churn mensual &lt; 3% en Q2"</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section title="Tipos de Key Result">
        <div className="space-y-2">
          {[
            { type: "INCREASE", label: "Aumentar", ex: "NPS de 30 a 55", color: "text-emerald-600 dark:text-emerald-400" },
            { type: "DECREASE", label: "Reducir", ex: "Churn de 8% a 3%", color: "text-rose-600 dark:text-rose-400" },
            { type: "ACHIEVE", label: "Lograr (binario)", ex: "Lanzar v2 del producto: sí/no", color: "text-blue-600 dark:text-blue-400" },
            { type: "MAINTAIN", label: "Mantener en rango", ex: "Uptime entre 99.5% y 99.9%", color: "text-amber-600 dark:text-amber-400" },
          ].map(t => (
            <div key={t.type} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30">
              <span className={cn("text-xs font-bold font-mono shrink-0 mt-0.5 w-20", t.color)}>{t.type}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.ex}</p>
              </div>
            </div>
          ))}
        </div>
        <Tip text="El sistema calcula el progreso automáticamente según el tipo. Para ACHIEVE, el progreso es 0% o 100%. Para los demás, se interpola entre el valor inicial y la meta." />
      </Section>

      <Section title="Crear un OKR paso a paso">
        <div className="space-y-2.5">
          <Step n={1} text='Ve a OKRs Estratégicos (o Tácticos) → "Nuevo objetivo"' />
          <Step n={2} text="Escribe el objetivo y vincula al ciclo activo" />
          <Step n={3} text="Agrega 2–4 Key Results: elige tipo, valor inicial, meta y unidad" />
          <Step n={4} text="Opcionalmente: usa el botón ✨ para sugerencias de KRs por IA" sub="La IA analiza el ciclo y la intención estratégica para sugerir KRs relevantes." />
          <Step n={5} text="Vincula a un OKR padre si corresponde (para crear la cascada estratégica)" />
          <Step n={6} text='Haz clic en "Publicar" para que sea visible al equipo' />
        </div>
        <Warn text="Un OKR en borrador no genera alertas ni aparece en los reportes del equipo. Publica cuando esté listo para ser monitoreado." />
      </Section>

      <div className="pt-2 flex gap-3 flex-wrap">
        <NavLink href="/strategic" label="OKRs Estratégicos" />
        <NavLink href="/tactical" label="OKRs Tácticos" />
      </div>
    </div>
  );
}

function CheckinsContent() {
  return (
    <div className="space-y-6">
      <Section title="¿Para qué sirve un check-in?">
        <p className="text-sm text-muted-foreground">
          El check-in actualiza el valor actual de un Key Result y registra el contexto del avance.
          Sin check-ins, el sistema no puede calcular el progreso ni generar alertas de riesgo.
        </p>
      </Section>

      <Section title="Hacer un check-in">
        <div className="space-y-2.5">
          <Step n={1} text='Ve a Check-ins → "Nuevo check-in"' />
          <Step n={2} text="Selecciona el Key Result que quieres actualizar" />
          <Step n={3} text="Ingresa el nuevo valor actual" sub="El sistema calcula automáticamente el % de progreso." />
          <Step n={4} text="Agrega una nota breve (opcional pero recomendada)" sub="¿Qué pasó? ¿Hay bloqueos? ¿Qué viene la próxima semana?" />
          <Step n={5} text="Indica tu nivel de confianza (0–100%)" sub="0% = casi seguro que no se logra. 100% = muy confiado. Esto alimenta el Risk Sentinel." />
          <Step n={6} text='Guarda el check-in' sub="El progreso del OKR se recalcula instantáneamente." />
        </div>
        <Tip text="El nivel de confianza es más valioso que el progreso numérico. Un KR al 80% con confianza al 20% está en riesgo real. Sé honesto." />
      </Section>

      <Section title="Cadencia recomendada">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { ciclo: "Trimestral", cadencia: "Semanal", color: "amber" },
            { ciclo: "Anual", cadencia: "Quincenal", color: "blue" },
            { ciclo: "Estratégico", cadencia: "Mensual", color: "indigo" },
          ].map(c => (
            <Card key={c.ciclo} className="p-3 space-y-1">
              <p className="text-sm font-semibold">{c.ciclo}</p>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{c.cadencia}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Check-ins y el Risk Sentinel">
        <p className="text-sm text-muted-foreground">
          Cada noche, el agente Risk Sentinel analiza todos los KRs activos. Si un KR lleva más de
          2 semanas sin check-in o su confianza bajó más de 20 puntos, el Sentinel genera una alerta
          visible en el dashboard y en el reporte de riesgos.
        </p>
        <Tip text="Mantén los check-ins al día para que el Risk Sentinel tenga datos precisos. Un KR sin check-ins recientes se marcará automáticamente como 'sin datos'." icon={Brain} />
      </Section>

      <div className="pt-2">
        <NavLink href="/checkins" label="Ir a Check-ins" />
      </div>
    </div>
  );
}

function AIContent() {
  return (
    <div className="space-y-6">
      <Section title="Agentes disponibles">
        <div className="space-y-2">
          {[
            {
              name: "OKR Coach",
              trigger: "Al crear/editar OKRs",
              desc: "Sugiere Key Results basados en el contexto del ciclo y la intención estratégica. Accede con el botón ✨ en el formulario de OKR.",
              icon: Target,
              color: "indigo",
            },
            {
              name: "Risk Sentinel",
              trigger: "Automático — cada noche",
              desc: "Analiza todos los KRs activos. Detecta KRs en riesgo por falta de check-ins, confianza baja o progreso estancado. Las alertas aparecen en el dashboard.",
              icon: AlertTriangle,
              color: "rose",
            },
            {
              name: "Alignment Auditor",
              trigger: "Al publicar un ciclo o crear un OKR de equipo",
              desc: "Verifica que los OKRs de equipo estén alineados con los objetivos estratégicos. Alerta si hay OKRs huérfanos sin padre estratégico.",
              icon: ShieldCheck,
              color: "amber",
            },
            {
              name: "Check-in Assistant",
              trigger: "En el drawer de check-in",
              desc: "Sugiere el texto de la nota del check-in basado en el historial del KR y el contexto del ciclo. Opcional — puedes ignorarlo.",
              icon: CheckSquare,
              color: "blue",
            },
            {
              name: "Executive Briefer",
              trigger: "Lunes (cron) + al cerrar ciclo",
              desc: "Genera un reporte ejecutivo semanal con los highlights, riesgos y recomendaciones del ciclo. Disponible en Reportes → Executive Briefing.",
              icon: FileText,
              color: "violet",
            },
            {
              name: "Strategy Advisor",
              trigger: "Chat bajo demanda",
              desc: "Chat libre con contexto completo de tus OKRs. Consulta estrategia, pide análisis de ciclos anteriores, o explora escenarios. Disponible en IA Asistente.",
              icon: Brain,
              color: "emerald",
            },
          ].map(agent => {
            const Icon = agent.icon;
            const c = COLOR[agent.color];
            return (
              <Card key={agent.name} className={cn("p-4 flex gap-3 border", c.border)}>
                <div className={cn("h-9 w-9 rounded-lg shrink-0 flex items-center justify-center", c.bg)}>
                  <Icon className={cn("h-4 w-4", c.icon)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", c.badge)}>
                      {agent.trigger}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{agent.desc}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Cómo activar el OKR Coach">
        <div className="space-y-2.5">
          <Step n={1} text='Abre el formulario de "Nuevo objetivo" en OKRs Estratégicos o Tácticos' />
          <Step n={2} text='Escribe el título del objetivo y vincula al ciclo' />
          <Step n={3} text='Haz clic en el botón ✨ junto a "Agregar Key Result"' />
          <Step n={4} text="La IA analiza el contexto y propone 3–5 KRs con tipo, unidad y meta sugerida" />
          <Step n={5} text="Acepta los KRs que quieras o edítalos antes de guardar" />
        </div>
        <Tip text="El Coach considera el nombre del ciclo, la intención estratégica vinculada y los KRs existentes en el mismo OKR para generar sugerencias relevantes." />
      </Section>

      <Section title="Leer las alertas del Risk Sentinel">
        <div className="space-y-2.5">
          <Step n={1} text="Ve al Dashboard de Inicio (/) o al panel de Riesgos en Reportes" />
          <Step n={2} text="Los KRs marcados en rojo o naranja tienen alertas activas del Sentinel" />
          <Step n={3} text="Haz clic en el KR para ver el detalle de la alerta y la recomendación" />
          <Step n={4} text="Responde la alerta haciendo un check-in con valor actualizado y nota de contexto" />
        </div>
        <Warn text="Las alertas del Sentinel no desaparecen automáticamente. Un check-in nuevo con confianza mejorada marcará la alerta como resuelta en la próxima ejecución nocturna." />
      </Section>

      <div className="pt-2">
        <NavLink href="/ai-assistant" label="Ir a IA Asistente" />
      </div>
    </div>
  );
}

function DashboardsContent() {
  return (
    <div className="space-y-6">
      <Section title="Dashboard de Inicio">
        <p className="text-sm text-muted-foreground">
          La pantalla de inicio (<code className="text-xs bg-muted px-1 py-0.5 rounded">/welcome</code>) es tu vista personal. Muestra:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: TrendingUp, label: "Progreso del ciclo activo", desc: "Barra de progreso global de todos los OKRs del ciclo actual." },
            { icon: AlertTriangle, label: "Alertas urgentes", desc: "KRs en riesgo identificados por el Risk Sentinel la noche anterior." },
            { icon: CheckSquare, label: "Check-ins pendientes", desc: "KRs que llevan más de 7 días sin actualización." },
            { icon: Zap, label: "Mis OKRs activos", desc: "Solo los OKRs donde eres responsable o miembro del equipo." },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex gap-2.5 p-3 rounded-lg bg-muted/30">
                <Icon className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Dashboard Ejecutivo">
        <p className="text-sm text-muted-foreground">
          Accesible desde <strong>Reportes → Dashboard Ejecutivo</strong>. Vista completa del ciclo para
          dirección y C-suite.
        </p>
        <div className="space-y-2.5">
          <Step n={1} text="Selecciona el ciclo que quieres revisar en el selector de ciclos" />
          <Step n={2} text="El gráfico radar muestra el progreso por área o equipo" />
          <Step n={3} text="La tabla de OKRs muestra estado, progreso y confianza promedio de cada objetivo" />
          <Step n={4} text="Los íconos de tendencia (↑↓) comparan con el check-in anterior" />
          <Step n={5} text='Haz clic en "Exportar PDF" para generar el reporte ejecutivo en formato A4' sub="El PDF incluye portada, resumen ejecutivo, tabla de OKRs y análisis de riesgos." />
        </div>
      </Section>

      <Section title="Reporte de Trazabilidad">
        <p className="text-sm text-muted-foreground">
          La vista de <strong>Trazabilidad</strong> muestra el mapa completo: desde el diagnóstico
          estratégico hasta la historia de usuario en sprint. Cómo leerlo:
        </p>
        <div className="space-y-2.5">
          <Step n={1} text="Cada línea es un camino de alineamiento" sub="Diagnóstico → Intención → OKR Estratégico → OKR Táctico → Iniciativa → Épica → Historia." />
          <Step n={2} text="Los colores indican el estado de progreso" sub="Verde = en camino. Amarillo = en riesgo. Rojo = bloqueado o muy retrasado." />
          <Step n={3} text="Haz clic en cualquier nodo para ver sus detalles y conexiones" />
          <Step n={4} text="Usa los filtros por ciclo, equipo o estado para enfocar la vista" />
        </div>
        <Tip text="La trazabilidad es especialmente útil en revisiones de ciclo para identificar qué trabajo de ejecución NO tiene justificación estratégica (épicas sin iniciativa)." icon={Info} />
      </Section>

      <Section title="Interpretar el nivel de confianza">
        <div className="space-y-1.5">
          {[
            { range: "80–100%", label: "Confianza alta", color: "text-emerald-600 dark:text-emerald-400", desc: "El KR va en camino. Sin intervención necesaria." },
            { range: "50–79%", label: "Confianza media", color: "text-amber-600 dark:text-amber-400", desc: "Hay riesgo pero controlado. Monitorear de cerca." },
            { range: "20–49%", label: "Confianza baja", color: "text-orange-600 dark:text-orange-400", desc: "Riesgo real. Considerar ajuste de alcance o recursos." },
            { range: "0–19%", label: "En peligro", color: "text-rose-600 dark:text-rose-400", desc: "El KR probablemente no se cumplirá. Escalar o redefinir." },
          ].map(c => (
            <div key={c.range} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
              <span className="text-xs font-bold font-mono w-14 shrink-0">{c.range}</span>
              <span className={cn("text-xs font-semibold w-28 shrink-0", c.color)}>{c.label}</span>
              <span className="text-xs text-muted-foreground">{c.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="pt-2 flex gap-3 flex-wrap">
        <NavLink href="/welcome" label="Ir al Dashboard" />
        <NavLink href="/reports/executive-dashboard" label="Dashboard Ejecutivo" />
        <NavLink href="/traceability" label="Trazabilidad" />
      </div>
    </div>
  );
}

function GovernanceContent() {
  return (
    <div className="space-y-6">
      <Section title="¿Qué es el Gobierno OKR?">
        <p className="text-sm text-muted-foreground">
          El módulo de Governance (<strong>Reportes → Gobierno OKR</strong>) consolida métricas de
          calidad y cumplimiento del proceso OKR en toda la organización. Está pensado para
          el responsable del proceso (Chief of Staff, PMO, Director de Estrategia).
        </p>
      </Section>

      <Section title="Métricas de governance">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: RefreshCw, label: "Cadencia de check-ins", desc: "% de KRs con check-in en los últimos 7 días. Meta: > 80%." },
            { icon: TrendingUp, label: "Tasa de completitud", desc: "% de OKRs que terminaron el ciclo con progreso ≥ 70%. Benchmark Google: 60–70%." },
            { icon: AlertTriangle, label: "OKRs sin alineamiento", desc: "Objetivos tácticos sin OKR padre estratégico. Señal de trabajo sin dirección." },
            { icon: Brain, label: "Score de confianza promedio", desc: "Confianza media de todos los KRs activos. < 50% indica ciclo en riesgo sistémico." },
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="flex gap-2.5 p-3 rounded-lg bg-muted/30">
                <Icon className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Routine de revisión de ciclo (recomendada)">
        <div className="space-y-2.5">
          <Step n={1} text="Lunes — revisar alertas del Risk Sentinel en el dashboard" sub="Responder con check-in si el KR es tuyo." />
          <Step n={2} text="Miércoles — OKR sync de equipos" sub="15–30 min. Revisar progreso, bloqueos y check-ins de la semana." />
          <Step n={3} text="Viernes — actualizar todos los check-ins pendientes" sub="El Sentinel corre el lunes. Mejor tener datos frescos." />
          <Step n={4} text="Fin de ciclo — revisión ejecutiva con el reporte del Executive Briefer" sub="Ver: qué se logró, qué no, por qué, qué aprendimos." />
          <Step n={5} text="Cierre — archivar ciclo y crear el siguiente" sub="Transferir OKRs incompletos si aplica." />
        </div>
      </Section>

      <Section title="Exportar para directorio o board">
        <div className="space-y-2.5">
          <Step n={1} text="Ve a Reportes → Dashboard Ejecutivo" />
          <Step n={2} text='Haz clic en "Exportar PDF"' sub="Genera reporte A4 con portada, tabla de OKRs y análisis de riesgos." />
          <Step n={3} text='O ve a Ciclos → selecciona el ciclo → "Generar presentación PPTX"' sub="Genera una presentación ejecutiva lista para compartir en reunión de board." />
        </div>
        <Tip text="El reporte PDF y el PPTX se generan con los datos en tiempo real al momento de exportar. No se guardan en el sistema." icon={Download} />
      </Section>

      <div className="pt-2">
        <NavLink href="/reports/governance" label="Ir a Governance" />
      </div>
    </div>
  );
}

function SettingsContent() {
  return (
    <div className="space-y-6">
      <Section title="Configuración de la organización">
        <div className="space-y-2">
          {[
            { icon: Settings2, label: "Perfil de organización", desc: "Nombre, logo, zona horaria, moneda y configuración de idioma." },
            { icon: Users, label: "Equipo y roles", desc: "Invitar miembros, cambiar roles, revocar accesos y ver invitaciones pendientes." },
            { icon: Lock, label: "Permisos de menú por rol", desc: "Qué secciones del sidebar ve cada rol. Configurable por ADMIN u OWNER." },
            { icon: Zap, label: "Modo operativo", desc: "AGILE (sprints), WATERFALL (fases) o HYBRID. Afecta qué módulos aparecen en el sidebar." },
            { icon: Mail, label: "Notificaciones", desc: "Email de resumen semanal, alertas del Risk Sentinel y recordatorios de check-in." },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex gap-2.5 p-3 rounded-lg bg-muted/30">
                <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Cambiar el modo operativo">
        <p className="text-sm text-muted-foreground mb-3">
          El modo operativo determina qué módulos de ejecución están disponibles.
        </p>
        <Card className="overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Modo</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Módulos activos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="hover:bg-muted/20"><td className="px-3 py-2 font-semibold">AGILE</td><td className="px-3 py-2 text-muted-foreground">Backlog, Sprints, Entregas + todos los demás</td></tr>
              <tr className="hover:bg-muted/20"><td className="px-3 py-2 font-semibold">WATERFALL</td><td className="px-3 py-2 text-muted-foreground">Iniciativas, Épicas, Features — sin Sprints</td></tr>
              <tr className="hover:bg-muted/20"><td className="px-3 py-2 font-semibold">HYBRID</td><td className="px-3 py-2 text-muted-foreground">Todo habilitado</td></tr>
            </tbody>
          </table>
        </Card>
        <Warn text="Cambiar el modo operativo no elimina datos existentes, pero ocultará secciones del sidebar para los roles que no tienen acceso. Los datos de sprints se preservan aunque el modo cambie a WATERFALL." />
      </Section>

      <Section title="Plan y facturación">
        <div className="space-y-2.5">
          <Step n={1} text="Ve a Configuración → pestaña Facturación" />
          <Step n={2} text="El plan actual y el límite de miembros activos aparecen al tope" />
          <Step n={3} text='Si necesitas más capacidad, haz clic en "Ver planes" o ve a /upgrade' />
        </div>
        <Tip text="El plan STARTER incluye hasta 10 miembros y 1 organización. El plan PRO incluye miembros ilimitados, múltiples organizaciones y los agentes de IA avanzados." icon={UserPlus} />
      </Section>

      <div className="pt-2">
        <NavLink href="/settings" label="Ir a Configuración" />
      </div>
    </div>
  );
}

// ── Tab router ───────────────────────────────────────────────────────────────

const CONTENT: Record<string, React.ReactNode> = {
  cycles:     <CyclesContent />,
  teams:      <TeamsContent />,
  okrs:       <OKRsContent />,
  checkins:   <CheckinsContent />,
  ai:         <AIContent />,
  dashboards: <DashboardsContent />,
  governance: <GovernanceContent />,
  settings:   <SettingsContent />,
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const t = useTranslations("pages.docs");
  const TABS: Tab[] = TAB_DEFS.map(d => ({ id: d.id, label: t(d.key), icon: d.icon, color: d.color }));
  const [activeTab, setActiveTab] = useState("cycles");
  const tab = TABS.find(tab => tab.id === activeTab)!;
  const c = COLOR[tab.color];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Documentación"
        description="Guías prácticas para configurar y operar el sistema OKR."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/getting-started" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Guía de inicio <ArrowRight className="h-3 w-3" />
            </Link>
            <Link href="/reports/guide" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Referencia del modelo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />

      <div className="flex gap-6 min-h-0">
        {/* Sidebar nav */}
        <nav className="w-44 shrink-0 space-y-0.5">
          {TABS.map(tb => {
            const Icon = tb.icon;
            const isActive = tb.id === activeTab;
            const tc = COLOR[tb.color];
            return (
              <button
                key={tb.id}
                onClick={() => setActiveTab(tb.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                  isActive
                    ? cn("bg-sidebar-accent text-sidebar-primary", tc.icon)
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {tb.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", c.bg)}>
                {(() => { const Icon = tab.icon; return <Icon className={cn("h-4.5 w-4.5", c.icon)} />; })()}
              </div>
              <h2 className="text-base font-bold text-foreground">{tab.label}</h2>
            </div>
            {CONTENT[activeTab]}
          </Card>
        </div>
      </div>
    </div>
  );
}
