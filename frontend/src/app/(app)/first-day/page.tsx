"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import {
  useFirstDayContext,
  useFirstDayNarrative,
  useCompleteFirstDay,
} from "@/hooks/useFirstDay";
import { cn, formatKRValue } from "@/lib/utils";
import {
  Sparkles, Target, TrendingUp, Users, CheckSquare,
  ChevronRight, ChevronLeft, Building2, Calendar,
  BarChart2, Layers, Lightbulb, ArrowRight, Check,
  Star, Zap, BookOpen, Circle,
} from "lucide-react";

// ── Animated number ───────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let raf: number;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{display}{suffix}</span>;
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 80, stroke = 8, color = "#6366f1" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const [offset, setOffset] = useState(C);
  useEffect(() => {
    const t = setTimeout(() => setOffset(C - (C * Math.min(pct, 100)) / 100), 200);
    return () => clearTimeout(t);
  }, [pct, C]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }} />
    </svg>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/30",
  HIGH:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  MEDIUM:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW:      "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

// ── Step dots ─────────────────────────────────────────────────────────────────

function StepDots({ total, current, onGoto }: { total: number; current: number; onGoto: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onGoto(i)}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-6 h-2 bg-white"
              : i < current
              ? "w-2 h-2 bg-white/60 hover:bg-white/80"
              : "w-2 h-2 bg-white/20 hover:bg-white/40",
          )}
          aria-label={`Paso ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ── Step wrapper ──────────────────────────────────────────────────────────────

function StepCard({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return (
    <div className={cn(
      "absolute inset-0 flex items-start justify-center px-6 py-4 overflow-y-auto transition-all duration-500",
      visible ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none",
    )}>
      <div className="w-full max-w-2xl my-auto">
        {children}
      </div>
    </div>
  );
}

// ── Step 1: Bienvenida ────────────────────────────────────────────────────────

function Step1Welcome({ name, orgName }: { name: string; orgName: string }) {
  const firstName = name?.split(" ")[0] ?? "Bienvenido";
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/40">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shadow-lg">
            <Star className="w-4 h-4 text-amber-900" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
          Día 1 en {orgName}
        </p>
        <h1 className="text-5xl font-black text-white leading-tight">
          ¡Hola, {firstName}!
        </h1>
        <p className="text-xl text-white/70 max-w-md mx-auto leading-relaxed">
          Te preparamos un recorrido personalizado de <span className="text-white font-semibold">8 pasos</span> para que empieces con todo.
        </p>
      </div>
      <div className="flex justify-center gap-6 pt-2">
        {[
          { icon: Target,    label: "OKRs reales" },
          { icon: Users,     label: "Tu equipo"   },
          { icon: BookOpen,  label: "Tu historia" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Icon className="w-5 h-5 text-white/80" />
            </div>
            <span className="text-xs text-white/50">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Visión ────────────────────────────────────────────────────────────

function Step2Vision({ org }: { org: { name: string; vision: string; mission: string; values_list: string[] } }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
          <Star className="w-5 h-5 text-violet-300" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Paso 2 de 8</p>
          <h2 className="text-2xl font-bold text-white">Nuestra Visión</h2>
        </div>
      </div>

      {org.vision ? (
        <blockquote className="relative pl-5 border-l-2 border-violet-400">
          <p className="text-2xl font-light text-white/90 italic leading-relaxed">
            "{org.vision}"
          </p>
        </blockquote>
      ) : (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
          <p className="text-white/50">La visión de {org.name} está siendo definida por el equipo directivo.</p>
        </div>
      )}

      {org.mission && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Misión</p>
          <p className="text-white/80 leading-relaxed">{org.mission}</p>
        </div>
      )}

      {org.values_list.length > 0 && (
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Valores</p>
          <div className="flex flex-wrap gap-2">
            {org.values_list.map((v) => (
              <span key={v} className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-200 text-sm font-medium">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Ciclo ─────────────────────────────────────────────────────────────

function Step3Cycle({ cycle }: { cycle: NonNullable<import("@/hooks/useFirstDay").FirstDayCycle | null> }) {
  const start = new Date(cycle.start_date);
  const end   = new Date(cycle.end_date);
  const fmt   = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const typeLabel: Record<string, string> = { QUARTERLY: "Trimestral", ANNUAL: "Anual", CUSTOM: "Personalizado" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
          <Calendar className="w-5 h-5 text-indigo-300" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Paso 3 de 8</p>
          <h2 className="text-2xl font-bold text-white">El Ciclo Actual</h2>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-indigo-600/20 to-violet-600/20 border border-indigo-500/20 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-indigo-300 font-semibold uppercase tracking-widest mb-1">
              {typeLabel[cycle.type] ?? cycle.type}
            </p>
            <h3 className="text-2xl font-bold text-white">{cycle.name}</h3>
            <p className="text-white/50 text-sm mt-1">{fmt(start)} → {fmt(end)}</p>
          </div>
          <div className="relative shrink-0">
            <ProgressRing pct={cycle.progress_pct} size={80} color="#818cf8" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                <AnimatedNumber value={cycle.progress_pct} suffix="%" />
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="text-3xl font-black text-indigo-300">
              <AnimatedNumber value={cycle.days_remaining} />
            </p>
            <p className="text-xs text-white/50 mt-0.5">días restantes</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="text-3xl font-black text-violet-300">
              <AnimatedNumber value={cycle.total_days} />
            </p>
            <p className="text-xs text-white/50 mt-0.5">días totales</p>
          </div>
        </div>
      </div>

      <p className="text-white/60 text-sm leading-relaxed text-center">
        Empezamos el ciclo y ya llevamos el <span className="text-indigo-300 font-semibold">{cycle.progress_pct}%</span> del camino recorrido.
        Quedan <span className="text-white font-semibold">{cycle.days_remaining} días</span> para llegar a la meta.
      </p>
    </div>
  );
}

// ── Step 4: OKRs empresa ──────────────────────────────────────────────────────

function Step4CompanyOkrs({ objectives }: { objectives: import("@/hooks/useFirstDay").FirstDayObjective[] }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
          <Target className="w-5 h-5 text-blue-300" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Paso 4 de 8</p>
          <h2 className="text-2xl font-bold text-white">Hacia Dónde Vamos</h2>
        </div>
      </div>

      <p className="text-white/60 text-sm">
        Estos son los {objectives.length} objetivos que la empresa persigue este ciclo:
      </p>

      <div className="space-y-3">
        {objectives.length === 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center text-white/40">
            Los objetivos de empresa se configuran en el panel de administración.
          </div>
        )}
        {objectives.map((obj, i) => {
          const color = obj.progress >= 70 ? "#22c55e" : obj.progress >= 40 ? "#f59e0b" : "#ef4444";
          return (
            <div key={obj.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/8 transition-colors"
              style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-start gap-3">
                <div className="relative shrink-0 mt-0.5">
                  <ProgressRing pct={obj.progress} size={44} stroke={4} color={color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{obj.progress}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {obj.code && (
                      <span className="text-[10px] font-mono text-white/40 bg-white/10 px-1.5 py-0.5 rounded shrink-0">
                        {obj.code}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-white truncate">{obj.title}</p>
                  </div>
                  {obj.description && (
                    <p className="text-xs text-white/50 line-clamp-2">{obj.description}</p>
                  )}
                  <p className="text-xs text-white/30 mt-1">{obj.kr_count} resultado{obj.kr_count !== 1 ? "s" : ""} clave</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 5: Equipo ────────────────────────────────────────────────────────────

function Step5Team({
  team,
  teamObjective,
}: {
  team: import("@/hooks/useFirstDay").FirstDayTeam | null;
  teamObjective: import("@/hooks/useFirstDay").FirstDayObjective | null;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <Users className="w-5 h-5 text-emerald-300" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Paso 5 de 8</p>
          <h2 className="text-2xl font-bold text-white">Tu Equipo</h2>
        </div>
      </div>

      {!team ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">Serás asignado a un equipo próximamente. El administrador configurará tu membresía.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border border-emerald-500/20 p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{team.name}</h3>
                {team.description && (
                  <p className="text-white/60 text-sm mt-0.5">{team.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
                  <span><span className="text-emerald-300 font-bold">{team.member_count}</span> miembros</span>
                  {team.lead_name && (
                    <>
                      <span className="text-white/20">·</span>
                      <span>Lead: <span className="text-white/70">{team.lead_name}</span></span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {teamObjective && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Objetivo del equipo este ciclo</p>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0 mt-0.5">
                    <ProgressRing pct={teamObjective.progress} size={44} stroke={4} color="#34d399" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{teamObjective.progress}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {teamObjective.code && (
                      <span className="text-[10px] font-mono text-white/40 bg-white/10 px-1.5 py-0.5 rounded mr-2">
                        {teamObjective.code}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-white">{teamObjective.title}</p>
                    {teamObjective.description && (
                      <p className="text-xs text-white/50 mt-1 line-clamp-2">{teamObjective.description}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 6: Mis KRs ───────────────────────────────────────────────────────────

function Step6MyKrs({ krs }: { krs: import("@/hooks/useFirstDay").FirstDayKr[] }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
          <BarChart2 className="w-5 h-5 text-orange-300" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Paso 6 de 8</p>
          <h2 className="text-2xl font-bold text-white">Tu Contribución</h2>
        </div>
      </div>

      {krs.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center space-y-3">
          <BarChart2 className="w-10 h-10 text-white/20 mx-auto" />
          <div>
            <p className="text-white/70 font-medium">Aún no tienes resultados clave asignados</p>
            <p className="text-white/40 text-sm mt-1">Tu manager los asignará en breve. Los verás en el dashboard cuando estén listos.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-white/60 text-sm">
            Estos son los resultados clave que <span className="text-white font-medium">tú debes mover</span> este ciclo:
          </p>
          {krs.map((kr) => {
            const color = kr.progress >= 70 ? "#22c55e" : kr.progress >= 40 ? "#f59e0b" : "#f97316";
            const pct = Math.min(100, Math.round(
              ((kr.current_value - (kr.current_value - kr.target_value * (kr.progress / 100))) / Math.max(1, kr.target_value)) * 100
            ));
            return (
              <div key={kr.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0 mt-0.5">
                    <ProgressRing pct={kr.progress} size={44} stroke={4} color={color} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{kr.progress}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {kr.code && (
                        <span className="text-[10px] font-mono text-white/40 bg-white/10 px-1.5 py-0.5 rounded shrink-0">
                          {kr.code}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-white truncate">{kr.title}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span>{formatKRValue(kr.current_value, kr.metric_unit)} / {formatKRValue(kr.target_value, kr.metric_unit)}</span>
                      <span className="text-white/20">·</span>
                      <span className="truncate">{kr.objective_title}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, kr.progress)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step 7: Primera historia ──────────────────────────────────────────────────

function Step7FirstStory({ items }: { items: import("@/hooks/useFirstDay").FirstDayBacklogItem[] }) {
  const item = items[0];
  const typeLabel: Record<string, string> = { EPIC: "Épica", FEATURE: "Feature", STORY: "Historia de usuario" };
  const typeColor: Record<string, string> = {
    EPIC:    "bg-purple-500/20 text-purple-300 border-purple-500/30",
    FEATURE: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    STORY:   "bg-green-500/20 text-green-300 border-green-500/30",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
          <Layers className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Paso 7 de 8</p>
          <h2 className="text-2xl font-bold text-white">Tu Primera Historia</h2>
        </div>
      </div>

      {!item ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center space-y-3">
          <CheckSquare className="w-10 h-10 text-white/20 mx-auto" />
          <div>
            <p className="text-white/70 font-medium">Aún no tienes historias asignadas</p>
            <p className="text-white/40 text-sm mt-1">Tu equipo te asignará items del backlog en cuanto estés operativo.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-gradient-to-br from-cyan-600/20 to-teal-600/20 border border-cyan-500/20 p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {item.code && (
              <span className="font-mono text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded">
                {item.code}
              </span>
            )}
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", typeColor[item.type] ?? typeColor.STORY)}>
              {typeLabel[item.type] ?? item.type}
            </span>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", PRIORITY_COLOR[item.priority] ?? PRIORITY_COLOR.MEDIUM)}>
              {item.priority}
            </span>
          </div>

          <h3 className="text-lg font-bold text-white leading-snug">{item.title}</h3>

          {item.description && (
            <p className="text-white/60 text-sm leading-relaxed line-clamp-4">{item.description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-white/40 border-t border-white/10 pt-3">
            {item.story_points != null && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {item.story_points} puntos
              </span>
            )}
            {item.initiative_title && (
              <span className="flex items-center gap-1 truncate">
                <Layers className="w-3 h-3 shrink-0" />
                <span className="truncate">{item.initiative_title}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {items.length > 1 && (
        <p className="text-center text-xs text-white/40">
          Y {items.length - 1} {items.length === 2 ? "historia más" : "historias más"} esperando en el backlog
        </p>
      )}
    </div>
  );
}

// ── Step 8: El porqué (AI narrative) ─────────────────────────────────────────

function Step8Why({ narrative, isLoading }: { narrative: string; isLoading: boolean }) {
  const [displayed, setDisplayed] = useState("");
  const idxRef = useRef(0);

  useEffect(() => {
    if (!narrative || isLoading) return;
    setDisplayed("");
    idxRef.current = 0;
    const interval = setInterval(() => {
      idxRef.current += 3;
      setDisplayed(narrative.slice(0, idxRef.current));
      if (idxRef.current >= narrative.length) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [narrative, isLoading]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
          <Lightbulb className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-widest">Paso 8 de 8</p>
          <h2 className="text-2xl font-bold text-white">El Porqué</h2>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-amber-600/15 to-orange-600/15 border border-amber-500/20 p-6 min-h-[160px] flex items-start">
        {isLoading ? (
          <div className="space-y-3 w-full">
            <div className="flex items-center gap-2 text-amber-300/70">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm">Generando tu narrativa personalizada…</span>
            </div>
            {[80, 95, 70, 60].map((w, i) => (
              <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse"
                style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        ) : (
          <p className="text-white/85 text-base leading-relaxed">{displayed}<span className="animate-pulse">▋</span></p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 text-xs text-white/30">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Generado por IA con tus datos reales de la organización</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;

const STEP_GRADIENTS = [
  "from-violet-900 via-indigo-900 to-slate-900",
  "from-indigo-900 via-violet-900 to-slate-900",
  "from-indigo-900 via-blue-900 to-slate-900",
  "from-blue-900 via-indigo-900 to-slate-900",
  "from-emerald-900 via-teal-900 to-slate-900",
  "from-orange-900 via-amber-900 to-slate-900",
  "from-cyan-900 via-teal-900 to-slate-900",
  "from-amber-900 via-orange-900 to-slate-900",
];

export default function FirstDayPage() {
  const router  = useRouter();
  const authUser = useAuthStore(s => s.user);

  const [step, setStep] = useState(0);
  const [narrativeEnabled, setNarrativeEnabled] = useState(false);

  const { data: ctx, isLoading: ctxLoading } = useFirstDayContext();
  const { data: narrativeData, isLoading: narrativeLoading } = useFirstDayNarrative(narrativeEnabled);
  const { mutate: completeFirstDay } = useCompleteFirstDay();

  // Pre-fetch narrative when reaching step 7
  useEffect(() => {
    if (step === 6) setNarrativeEnabled(true);
  }, [step]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      completeFirstDay(undefined, {
        onSuccess: () => {
          if (authUser) {
            useAuthStore.getState().setUser({ ...authUser, first_day_completed_at: new Date().toISOString() });
          }
          router.replace("/welcome");
        },
      });
    }
  }, [step, completeFirstDay, router, authUser]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    completeFirstDay(undefined, {
      onSuccess: () => {
        if (authUser) {
          useAuthStore.getState().setUser({ ...authUser, first_day_completed_at: new Date().toISOString() });
        }
        router.replace("/welcome");
      },
    });
  }, [completeFirstDay, router, authUser]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, handlePrev]);

  if (ctxLoading || !ctx) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-6 h-6 text-violet-300" />
          </div>
          <p className="text-white/50 text-sm">Preparando tu bienvenida…</p>
        </div>
      </div>
    );
  }

  const isLastStep = step === TOTAL_STEPS - 1;
  const gradient   = STEP_GRADIENTS[step] ?? STEP_GRADIENTS[0];

  return (
    <div className={cn("fixed inset-0 z-40 bg-gradient-to-br transition-colors duration-700", gradient)}>
      {/* Background decorative number */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="text-[40vw] font-black text-white/[0.03] leading-none transition-all duration-500">
          {step + 1}
        </span>
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-5 right-5 text-white/30 hover:text-white/60 text-sm transition-colors z-10"
      >
        Saltar tour →
      </button>

      {/* Header */}
      <div className="absolute top-5 left-5 right-20 flex items-center gap-4 z-10">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-white/40" />
          <span className="text-white/40 text-sm truncate max-w-[160px]">{ctx.org.name}</span>
        </div>
        <div className="flex-1" />
        <StepDots total={TOTAL_STEPS} current={step} onGoto={setStep} />
      </div>

      {/* Steps */}
      <div className="absolute inset-0 pt-16 pb-24">
        <div className="relative h-full overflow-hidden">
          <StepCard visible={step === 0}>
            <Step1Welcome name={authUser?.name ?? ""} orgName={ctx.org.name} />
          </StepCard>
          <StepCard visible={step === 1}>
            <Step2Vision org={ctx.org} />
          </StepCard>
          <StepCard visible={step === 2}>
            {ctx.active_cycle ? (
              <Step3Cycle cycle={ctx.active_cycle} />
            ) : (
              <div className="text-center text-white/50">No hay ciclo activo configurado aún.</div>
            )}
          </StepCard>
          <StepCard visible={step === 3}>
            <Step4CompanyOkrs objectives={ctx.company_objectives} />
          </StepCard>
          <StepCard visible={step === 4}>
            <Step5Team team={ctx.my_team} teamObjective={ctx.team_objective} />
          </StepCard>
          <StepCard visible={step === 5}>
            <Step6MyKrs krs={ctx.my_krs} />
          </StepCard>
          <StepCard visible={step === 6}>
            <Step7FirstStory items={ctx.my_backlog_items} />
          </StepCard>
          <StepCard visible={step === 7}>
            <Step8Why
              narrative={narrativeData?.narrative ?? ""}
              isLoading={narrativeLoading || !narrativeData}
            />
          </StepCard>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="absolute bottom-0 left-0 right-0 p-5 flex items-center justify-between z-10">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
            step === 0
              ? "opacity-0 pointer-events-none"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/10",
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>

        <div className="text-white/30 text-xs tabular-nums">
          {step + 1} / {TOTAL_STEPS}
        </div>

        <button
          onClick={handleNext}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg",
            isLastStep
              ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400 shadow-violet-500/30"
              : "bg-white text-slate-900 hover:bg-white/90",
          )}
        >
          {isLastStep ? (
            <>
              <Check className="w-4 h-4" />
              Comenzar mi viaje
            </>
          ) : (
            <>
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
