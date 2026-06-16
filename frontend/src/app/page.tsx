"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowRight, Target, Brain, Zap, ChevronRight,
  Sparkles, BarChart3, GitBranch, Shield, Users,
  CheckCircle2, Play, Star, X, Eye, EyeOff, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/auth";
import { isApiError } from "@/lib/api-client";

/* ══════════════════════════════════════════════════════
   GLOBAL STYLES + KEYFRAMES
══════════════════════════════════════════════════════ */
const CSS = `
  @keyframes ld-mesh1   { 0%,100%{transform:translate(0,0) scale(1)}   50%{transform:translate(60px,-40px) scale(1.08)} }
  @keyframes ld-mesh2   { 0%,100%{transform:translate(0,0) scale(1)}   50%{transform:translate(-50px,60px) scale(1.12)} }
  @keyframes ld-mesh3   { 0%,100%{transform:translate(0,0) scale(1)}   60%{transform:translate(40px,50px) scale(1.06)} }
  @keyframes ld-float   { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-18px)} }
  @keyframes ld-float-r { 0%,100%{transform:translateY(0)}  50%{transform:translateY(14px)} }
  @keyframes ld-badge   { from{opacity:0;transform:translateY(-8px) scale(0.94)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes ld-fade-up { from{opacity:0;transform:translateY(26px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ld-scale-in{ from{opacity:0;transform:scale(0.88) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes ld-word    { from{opacity:0;transform:translateY(28px) rotateX(-20deg)} to{opacity:1;transform:translateY(0) rotateX(0)} }
  @keyframes ld-dot     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
  @keyframes ld-bar     { from{width:0} }
  @keyframes ld-glow    { 0%,100%{opacity:.8} 50%{opacity:1} }
  @keyframes ld-card-float { 0%,100%{transform:translateY(0) rotate(0.5deg)} 50%{transform:translateY(-12px) rotate(-0.5deg)} }
  @keyframes ld-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes ld-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes ld-pulse-glow { 0%,100%{box-shadow:0 0 28px rgba(37,99,235,.45)} 50%{box-shadow:0 0 50px rgba(37,99,235,.65),0 0 80px rgba(29,78,216,.2)} }
  @keyframes ld-spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes ld-noise-drift { 0%{transform:translate(0,0)} 100%{transform:translate(-10%,-10%)} }

  .ld-gradient-text {
    background: linear-gradient(90deg,#60A5FA,#93C5FD,#BFDBFE,#60A5FA);
    background-size: 200% auto;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ld-shimmer 4s linear infinite;
  }
  .ld-grid {
    background-image:
      linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  [data-reveal] {
    opacity: 0; transform: translateY(32px);
    transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1);
  }
  [data-reveal].in-view { opacity: 1; transform: translateY(0); }
  [data-reveal][data-delay="100"].in-view { transition-delay:.1s }
  [data-reveal][data-delay="200"].in-view { transition-delay:.2s }
  [data-reveal][data-delay="300"].in-view { transition-delay:.3s }
  [data-reveal][data-delay="400"].in-view { transition-delay:.4s }
`;

/* ══════════════════════════════════════════════════════
   ANIMATED COUNTER (IntersectionObserver)
══════════════════════════════════════════════════════ */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; obs.disconnect();
      const dur = 1800, t0 = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - t0) / dur, 1);
        setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: .5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ══════════════════════════════════════════════════════
   WORD REVEAL HEADLINE
══════════════════════════════════════════════════════ */
function WordReveal({ text, className, baseDelay = 0 }: {
  text: string; className?: string; baseDelay?: number;
}) {
  return (
    <span className={className} style={{ perspective: "800px" }}>
      {text.split(" ").map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em] last:mr-0">
          <span
            className="inline-block"
            style={{
              animation: `ld-word .75s cubic-bezier(.16,1,.3,1) both`,
              animationDelay: `${baseDelay + i * 90}ms`,
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </span>
  );
}

/* ══════════════════════════════════════════════════════
   3D TILT CARD WRAPPER
══════════════════════════════════════════════════════ */
function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width  - 0.5;
    const y = (e.clientY - top)  / height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) scale(1.025)`;
    el.style.transition = "transform .1s ease";
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.style.transform = "perspective(900px) rotateY(0) rotateX(0) scale(1)";
    el.style.transition = "transform .6s cubic-bezier(.16,1,.3,1)";
  }, []);

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ANIMATED PROGRESS BAR
══════════════════════════════════════════════════════ */
function Bar({ value, delay = 0, from = "from-blue-600 via-blue-500 to-blue-400" }: {
  value: number; delay?: number; from?: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), delay + 800); return () => clearTimeout(t); }, [value, delay]);
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div className={`h-full bg-gradient-to-r ${from} rounded-full`}
        style={{ width: `${w}%`, transition: "width 1.6s cubic-bezier(.16,1,.3,1)" }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   HERO OKR CARD
══════════════════════════════════════════════════════ */
const KRS = [
  { title: "NPS promedio ≥ 72",      progress: 85, ok: true,  trend: "↑" },
  { title: "Revenue $2M ARR",         progress: 71, ok: true,  trend: "→" },
  { title: "Retención cliente 94%",   progress: 62, ok: false, trend: "↓" },
];

function HeroCard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 400); return () => clearTimeout(t); }, []);

  return (
    <div
      className="relative w-[440px] max-w-[92vw] rounded-2xl p-6 backdrop-blur-xl"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(37,99,235,0.3)",
        boxShadow: "0 0 0 1px rgba(37,99,235,0.1), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)",
        animation: mounted ? "ld-card-float 7s ease-in-out infinite" : "none",
        opacity: mounted ? 1 : 0,
        transition: "opacity .7s ease",
      }}
    >
      {/* Shimmer top border */}
      <div className="absolute top-0 inset-x-0 h-px rounded-t-2xl pointer-events-none"
        style={{ background: "linear-gradient(90deg,transparent,rgba(96,165,250,0.7),transparent)" }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: "ld-dot 2s ease-in-out infinite" }} />
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>Q1 2026 · Ciclo Activo</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(37,99,235,0.12)", color: "#93C5FD", border: "1px solid rgba(37,99,235,0.28)" }}>
          COMPANY
        </span>
      </div>

      {/* Objective */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-sm font-semibold text-white leading-snug">Liderar el mercado latinoamericano</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>3 key results · 8 iniciativas</p>
          </div>
          <span className="text-2xl font-extrabold text-white tabular-nums shrink-0">78%</span>
        </div>
        <Bar value={78} />
      </div>

      {/* KRs */}
      <div className="space-y-2.5 mb-4">
        {KRS.map((kr, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${kr.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className="text-xs flex-1 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{kr.title}</span>
              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.22)" }}>{kr.trend}</span>
              <span className={`text-xs font-mono font-bold ${kr.ok ? "text-emerald-400" : "text-amber-400"}`}>{kr.progress}%</span>
            </div>
            <Bar value={kr.progress} delay={i * 200 + 300}
              from={kr.ok ? "from-emerald-500 to-teal-400" : "from-amber-500 to-orange-400"} />
          </div>
        ))}
      </div>

      {/* AI insight */}
      <div className="flex items-start gap-2 rounded-xl p-3"
        style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#60A5FA" }} />
        <p className="text-xs leading-relaxed" style={{ color: "#93C5FD" }}>
          <span className="font-semibold">OKR Coach:</span>{" "}
          KR de retención necesita atención. Sugiero programar check-in esta semana.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MARQUEE STRIP
══════════════════════════════════════════════════════ */
const MARQUEE_ITEMS = [
  { icon: Target,    label: "OKRs Estratégicos" },
  { icon: Brain,     label: "6 Agentes IA"       },
  { icon: Zap,       label: "Sprints Ágiles"      },
  { icon: BarChart3, label: "Dashboards Ejecutivos" },
  { icon: GitBranch, label: "Cascada Estratégica"  },
  { icon: Shield,    label: "Enterprise Security"  },
  { icon: Users,     label: "Multi-tenancy"        },
  { icon: Star,      label: "Check-ins IA"         },
];

function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="relative overflow-hidden py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, #04091A, transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, #04091A, transparent)" }} />

      <div className="flex gap-12 w-max" style={{ animation: "ld-marquee 28s linear infinite" }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 shrink-0">
            <item.icon className="w-4 h-4" style={{ color: "rgba(96,165,250,0.55)" }} />
            <span className="text-sm font-medium whitespace-nowrap" style={{ color: "rgba(255,255,255,0.28)" }}>
              {item.label}
            </span>
            <span className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   FEATURES
══════════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: GitBranch, color: "#60A5FA",
    bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.18)",
    hoverBorder: "rgba(96,165,250,0.42)",
    title: "Cascada estratégica",
    desc: "Conecta la visión con cada equipo e individuo. 4 niveles organizacionales con alineación automática.",
  },
  {
    icon: Brain, color: "#93C5FD",
    bg: "rgba(147,197,253,0.06)", border: "rgba(147,197,253,0.16)",
    hoverBorder: "rgba(147,197,253,0.38)",
    title: "Agentes IA autónomos",
    desc: "Coach inline, Sentinel de riesgos, Executive Briefer. IA que trabaja sin que se lo pidas.",
  },
  {
    icon: Zap, color: "#fbbf24",
    bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.18)",
    hoverBorder: "rgba(251,191,36,0.45)",
    title: "Modo ágil nativo",
    desc: "Sprints vinculados a Key Results, cadencia semanal automática y backlog priorizado.",
  },
  {
    icon: BarChart3, color: "#34d399",
    bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.18)",
    hoverBorder: "rgba(52,211,153,0.45)",
    title: "Dashboards ejecutivos",
    desc: "Heatmap de salud, radar organizacional y briefings PDF. Para el comité directivo.",
  },
  {
    icon: Users, color: "#fb7185",
    bg: "rgba(251,113,133,0.06)", border: "rgba(251,113,133,0.18)",
    hoverBorder: "rgba(251,113,133,0.45)",
    title: "Multi-tenancy enterprise",
    desc: "Organizaciones aisladas, equipos anidados, roles granulares y onboarding guiado.",
  },
  {
    icon: Shield, color: "#60a5fa",
    bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.18)",
    hoverBorder: "rgba(96,165,250,0.45)",
    title: "Seguridad enterprise",
    desc: "MFA TOTP, tokens con rotation, RLS en PostgreSQL, GDPR compliant y audit log.",
  },
];

/* ══════════════════════════════════════════════════════
   NAV (scroll-aware)
══════════════════════════════════════════════════════ */
function Nav({ onTrialClick }: { onTrialClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-500"
      style={{
        background: scrolled ? "rgba(4,9,26,0.93)" : "rgba(4,9,26,0.0)",
        backdropFilter: scrolled ? "blur(24px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      <Link href="/" className="flex items-center gap-2.5 group">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white transition-transform group-hover:scale-105"
          style={{ background: "linear-gradient(135deg,#1D4ED8,#2563EB)", boxShadow: "0 0 16px rgba(37,99,235,0.38)" }}
        >
          O
        </div>
        <span className="font-semibold text-sm text-white/80 group-hover:text-white transition-colors">OKR System</span>
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/auth/login">
          <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/5 text-sm">
            Iniciar sesión
          </Button>
        </Link>
        <Button size="sm" onClick={onTrialClick}
          className="text-white text-sm font-semibold gap-1.5"
          style={{ background: "linear-gradient(135deg,#1D4ED8,#2563EB)", border: "none", animation: "ld-pulse-glow 3s ease-in-out infinite" }}>
          Trial gratis <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════
   TRIAL MODAL
══════════════════════════════════════════════════════ */
function TrialModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    setLoading(true); setError("");
    try {
      await authApi.registerTrial(form);
      router.push("/onboarding");
    } catch (err: unknown) {
      const msg = isApiError(err) ? (err.data?.message ?? err.message) : (err instanceof Error ? err.message : "");
      const msgStr = Array.isArray(msg) ? msg.join(", ") : (msg ?? "");
      if (msgStr.toLowerCase().includes("email") || msgStr.toLowerCase().includes("existe")) {
        setError("Este email ya está registrado en esa organización. Inicia sesión.");
      } else if (msgStr) {
        setError(msgStr);
      } else {
        setError("Ocurrió un error. Intenta de nuevo.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(4,9,26,0.85)", backdropFilter: "blur(16px)" }}>
      <div className="relative w-full max-w-md rounded-2xl p-8"
        style={{ background: "#0a1628", border: "1px solid rgba(37,99,235,0.25)", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}>

        {/* Top shimmer */}
        <div className="absolute top-0 inset-x-0 h-px rounded-t-2xl"
          style={{ background: "linear-gradient(90deg,transparent,rgba(96,165,250,0.7),transparent)" }} />

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-7">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4 text-xs font-medium"
            style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)", color: "#93C5FD" }}>
            <Sparkles className="w-3 h-3" />
            Trial gratuito — 15 días
          </div>
          <h2 className="text-2xl font-bold text-white">Crear tu organización</h2>
          <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Acceso completo durante 15 días, sin tarjeta de crédito.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-white/60">Nombre completo</p>
            <Input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Ana García"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-white/60">Email corporativo</p>
            <Input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="ana@empresa.com"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-white/60">Nombre de la organización</p>
            <Input
              value={form.company}
              onChange={e => set("company", e.target.value)}
              placeholder="Acme Corp"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-white/60">Contraseña</p>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-blue-500/60 pr-10"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base font-semibold text-white gap-2 mt-2"
            style={{ background: "linear-gradient(135deg,#1D4ED8,#2563EB)", border: "none" }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando organización…</>
              : <>Comenzar trial gratuito <ArrowRight className="w-4 h-4" /></>
            }
          </Button>

          <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
            ¿Ya tienes cuenta?{" "}
            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [trialOpen, setTrialOpen] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.06 }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#04091A" }}>
      <style>{CSS}</style>

      {trialOpen && <TrialModal onClose={() => setTrialOpen(false)} />}

      <Nav onTrialClick={() => setTrialOpen(true)} />

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-20">

        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute" style={{
            top: "-20%", left: "-15%", width: 800, height: 800, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(29,78,216,0.22) 0%, transparent 65%)",
            animation: "ld-mesh1 14s ease-in-out infinite",
          }} />
          <div className="absolute" style={{
            bottom: "-10%", right: "-15%", width: 900, height: 900, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 65%)",
            animation: "ld-mesh2 18s ease-in-out infinite",
          }} />
          <div className="absolute" style={{
            top: "40%", left: "40%", transform: "translate(-50%,-50%)", width: 600, height: 400, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(37,99,235,0.07) 0%, transparent 70%)",
            animation: "ld-mesh3 22s ease-in-out infinite",
          }} />
          {/* Rotating ring decoration */}
          <div className="absolute" style={{
            top: "10%", right: "8%", width: 320, height: 320, borderRadius: "50%",
            border: "1px solid rgba(37,99,235,0.1)",
            animation: "ld-spin-slow 40s linear infinite",
          }}>
            <div style={{
              position: "absolute", top: -3, left: "50%", width: 6, height: 6, borderRadius: "50%",
              background: "rgba(96,165,250,0.6)", transform: "translateX(-50%)",
            }} />
          </div>
          <div className="absolute" style={{
            top: "12%", right: "10%", width: 240, height: 240, borderRadius: "50%",
            border: "1px solid rgba(59,130,246,0.07)",
            animation: "ld-spin-slow 28s linear infinite reverse",
          }} />
          {/* Grid */}
          <div className="absolute inset-0 ld-grid opacity-[0.6]" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-5xl mx-auto">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-10 text-xs font-medium cursor-default"
            style={{
              background: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(37,99,235,0.22)",
              color: "#93C5FD",
              animation: "ld-badge .8s cubic-bezier(.16,1,.3,1) .1s both",
            }}
          >
            <Sparkles className="w-3 h-3" style={{ animation: "ld-dot 2s ease-in-out infinite" }} />
            Sistema OKR con 6 Agentes IA integrados
            <ChevronRight className="w-3 h-3 opacity-50" />
          </div>

          {/* Headline — word by word */}
          <h1 className="text-5xl sm:text-6xl lg:text-[80px] font-black tracking-tight mb-6 leading-[1.05]">
            <WordReveal text="Ejecuta tu estrategia" baseDelay={200}
              className="block text-white" />
            <span className="block mt-1">
              {"con ".split("").map((c, i) => (
                <span key={i} className="inline-block text-white"
                  style={{ animation: `ld-word .75s cubic-bezier(.16,1,.3,1) ${500 + i * 40}ms both` }}>
                  {c === " " ? " " : c}
                </span>
              ))}
              <span className="ld-gradient-text"
                style={{ display: "inline-block", animation: "ld-word .75s cubic-bezier(.16,1,.3,1) 620ms both" }}>
                claridad total
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.38)", animation: "ld-fade-up .9s cubic-bezier(.16,1,.3,1) .65s both" }}
          >
            OKRs estratégicos y tácticos, agentes IA autónomos, sprints ágiles
            y diagnóstico organizacional — en una sola plataforma cohesiva.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap items-center justify-center gap-4 mb-20"
            style={{ animation: "ld-fade-up .9s cubic-bezier(.16,1,.3,1) .8s both" }}
          >
            <Button
              size="lg"
              onClick={() => setTrialOpen(true)}
              className="h-13 px-9 text-base font-bold text-white gap-2 group relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#1D4ED8,#2563EB)",
                border: "none",
                animation: "ld-pulse-glow 3s ease-in-out 1s infinite",
                height: 52,
                fontSize: 15,
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                Comenzar trial gratuito — 15 días
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
              </span>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg,#2563EB,#3B82F6)" }} />
            </Button>
            <Link href="/auth/login">
              <Button
                size="lg"
                variant="ghost"
                className="h-13 px-8 text-base gap-2 group"
                style={{ color: "rgba(255,255,255,0.45)", height: 52 }}
              >
                <Play className="w-4 h-4 group-hover:text-white transition-colors" />
                <span className="group-hover:text-white/70 transition-colors">Iniciar sesión</span>
              </Button>
            </Link>
          </div>

          {/* 3D Card */}
          <div style={{ animation: "ld-scale-in 1.1s cubic-bezier(.16,1,.3,1) 1s both" }}
            className="flex justify-center">
            <TiltCard>
              <HeroCard />
            </TiltCard>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-40 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, #04091A)" }} />
      </section>

      {/* ════════════════════════════════════════════
          MARQUEE
      ════════════════════════════════════════════ */}
      <Marquee />

      {/* ════════════════════════════════════════════
          FEATURES
      ════════════════════════════════════════════ */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20" data-reveal>
            <p className="text-xs font-mono uppercase tracking-[0.22em] mb-5"
              style={{ color: "#60A5FA", letterSpacing: "0.22em" }}>
              Capacidades
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5 leading-tight">
              Todo integrado,{" "}
              <span className="ld-gradient-text">desde el día&nbsp;1</span>
            </h2>
            <p className="max-w-xl mx-auto text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
              Sin integraciones complejas. Sin herramientas fragmentadas. Lógica de negocio en base de datos, UX de primer nivel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                data-reveal
                data-delay={String(((i % 3) * 100) + 100)}
                className="group relative rounded-2xl p-6 cursor-default transition-all duration-400"
                style={{
                  background: f.bg,
                  border: `1px solid ${f.border}`,
                  transition: "transform .3s cubic-bezier(.16,1,.3,1), border-color .3s ease, box-shadow .3s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = f.hoverBorder;
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px) scale(1.015)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 60px ${f.color}18`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = f.border;
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0) scale(1)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                {/* Top glow on hover */}
                <div className="absolute top-0 inset-x-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg,transparent,${f.color},transparent)` }} />

                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: f.bg, border: `1px solid ${f.border}` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-white mb-2 text-base">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          STATS
      ════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div
            className="relative rounded-3xl p-12 sm:p-16 overflow-hidden"
            data-reveal
            style={{
              background: "linear-gradient(135deg,rgba(29,78,216,0.1),rgba(37,99,235,0.07))",
              border: "1px solid rgba(37,99,235,0.2)",
            }}
          >
            {/* Background decoration */}
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)" }} />

            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
              {[
                { n: 4,  s: "",  label: "Niveles organizacionales", sub: "empresa → área → equipo → individual" },
                { n: 6,  s: "+", label: "Agentes IA autónomos",      sub: "trabajan en segundo plano 24/7"        },
                { n: 13, s: "",  label: "Módulos integrados",         sub: "OKRs, check-ins, sprints, diagnóstico" },
              ].map((stat, i) => (
                <div key={i} data-reveal data-delay={String(i * 150)}>
                  <div className="text-5xl sm:text-6xl font-black mb-3 tabular-nums" style={{ color: "#93C5FD" }}>
                    <Counter target={stat.n} suffix={stat.s} />
                  </div>
                  <div className="font-semibold text-white mb-1">{stat.label}</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CTA + CHECKLIST
      ════════════════════════════════════════════ */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          {/* Checklist */}
          <div data-reveal>
            <p className="text-xs font-mono uppercase tracking-[0.2em] mb-5" style={{ color: "#60A5FA" }}>Incluido</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-10 leading-tight">
              Listo para usar,<br />
              <span className="ld-gradient-text">sin configuración extra</span>
            </h2>
            <ul className="space-y-4">
              {[
                "OKRs estratégicos y tácticos en 4 niveles",
                "6 agentes IA integrados nativamente",
                "Sprints y cadencia ágil nativa",
                "Check-ins asistidos por IA",
                "Diagnóstico organizacional profundo",
                "Exportación PDF y WebSockets real-time",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 group">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#60A5FA" }} />
                  </div>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA card */}
          <div
            data-reveal data-delay="200"
            className="relative rounded-2xl p-10 text-center overflow-hidden"
            style={{
              background: "linear-gradient(160deg,rgba(29,78,216,0.12),rgba(37,99,235,0.07))",
              border: "1px solid rgba(37,99,235,0.22)",
            }}
          >
            {/* Top shimmer */}
            <div className="absolute top-0 inset-x-0 h-px"
              style={{ background: "linear-gradient(90deg,transparent,rgba(96,165,250,0.7),transparent)" }} />

            <div className="w-18 h-18 rounded-2xl flex items-center justify-center mx-auto mb-7"
              style={{ background: "linear-gradient(135deg,#1D4ED8,#2563EB)", width: 72, height: 72, boxShadow: "0 0 40px rgba(37,99,235,0.38)" }}>
              <Target className="w-9 h-9 text-white" />
            </div>
            <h3 className="text-2xl font-extrabold text-white mb-3">¿Listo para empezar?</h3>
            <p className="text-sm mb-9 leading-relaxed max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.38)" }}>
              Configura tu organización en minutos y comienza a alinear tu equipo alrededor de lo que más importa.
            </p>
            <Button
              size="lg"
              onClick={() => setTrialOpen(true)}
              className="w-full h-13 text-base font-bold text-white gap-2 group overflow-hidden relative"
              style={{ background: "linear-gradient(135deg,#1D4ED8,#2563EB)", border: "none", height: 52 }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Comenzar trial gratuito — 15 días
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
              </span>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg,#2563EB,#3B82F6)" }} />
            </Button>
            <p className="text-xs mt-5" style={{ color: "rgba(255,255,255,0.18)" }}>
              Sin tarjeta de crédito · 15 días completos
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════ */}
      <footer className="py-12 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#1D4ED8,#2563EB)" }}>
              O
            </div>
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>OKR System</span>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
            Sistema de gestión estratégica con IA
          </p>
          <div className="flex gap-6">
            {[["Iniciar sesión", "/auth/login"], ["Registrarse", "/auth/register"]].map(([label, href]) => (
              <Link key={href} href={href}
                className="text-xs transition-colors hover:text-white/50"
                style={{ color: "rgba(255,255,255,0.22)" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
