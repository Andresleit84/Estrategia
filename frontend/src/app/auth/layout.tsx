"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Target, Brain, Zap, BarChart3 } from "lucide-react";
import { GlobeCanvas } from "@/components/auth/GlobeCanvas";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";

const QUOTES = [
  {
    heading: "Claridad estratégica,\nejecución implacable.",
    sub: "De la visión de empresa al equipo en minutos.",
  },
  {
    heading: "OKRs que se\ndescriben solos.",
    sub: "El coach IA siempre está disponible inline.",
  },
  {
    heading: "Ágil o clásico,\ntú decides.",
    sub: "Sprints vinculados a Key Results nativamente.",
  },
];

const PERKS = [
  { icon: Target, text: "OKRs en cascada en 4 niveles" },
  { icon: Brain,  text: "6 agentes IA autónomos integrados" },
  { icon: Zap,    text: "Modo ágil nativo con sprints" },
  { icon: BarChart3, text: "Dashboards ejecutivos en tiempo real" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [qi, setQi] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setQi((i) => (i + 1) % QUOTES.length);
        setFading(false);
      }, 400);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const q = QUOTES[qi];

  return (
    <div className="h-full flex overflow-x-hidden" style={{ background: "#07070f" }}>

      {/* ── Left panel ────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col lg:w-[52%] relative overflow-hidden shrink-0">

        {/* Background */}
        <div className="absolute inset-0"
             style={{ background: "linear-gradient(160deg,#080818 0%,#0c0b22 50%,#070715 100%)" }} />
        <div className="absolute inset-0 ld-grid opacity-40 pointer-events-none" />

        {/* Globe — centrado, detrás del contenido */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
             style={{ zIndex: 1 }}>
          <GlobeCanvas size={560} />
        </div>

        {/* Vignette lateral derecha para fusionar el globo con el panel del form */}
        <div className="absolute inset-y-0 right-0 w-24 pointer-events-none"
             style={{ zIndex: 2, background: "linear-gradient(to right, transparent, #07070f)" }} />

        {/* Content */}
        <div className="relative flex flex-col justify-between h-full p-8 xl:p-12 overflow-hidden"
             style={{ zIndex: 10 }}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 w-fit">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white text-sm"
                 style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              O
            </div>
            <span className="font-semibold text-white">OKR System</span>
          </Link>

          {/* Quote */}
          <div>
            <div
              style={{
                opacity: fading ? 0 : 1,
                transform: fading ? "translateY(8px)" : "translateY(0)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
              }}
            >
              <h2
                className="text-3xl font-extrabold text-white whitespace-pre-line leading-tight mb-3"
                style={{ textShadow: "0 2px 32px rgba(4,3,14,0.9), 0 0 60px rgba(99,102,241,0.3)" }}
              >
                {q.heading}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.42)" }}>{q.sub}</p>
            </div>

            {/* Quote dots */}
            <div className="flex gap-1.5 mt-6 mb-10">
              {QUOTES.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: i === qi ? 20 : 6,
                    height: 6,
                    background: i === qi ? "#818cf8" : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>

            {/* Perks */}
            <ul className="space-y-3">
              {PERKS.map((p, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}
                  >
                    <p.icon className="w-4 h-4" style={{ color: "#818cf8" }} />
                  </div>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.58)" }}>{p.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats */}
          <div className="flex gap-2 flex-wrap">
            {[
              { n: "4",   l: "Niveles" },
              { n: "6+",  l: "Agentes IA" },
              { n: "13",  l: "Módulos" },
            ].map((s, i) => (
              <div
                key={i}
                className="flex-1 min-w-[80px] rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-lg font-extrabold tabular-nums" style={{ color: "#a5b4fc" }}>{s.n}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.32)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────── */}
      <div
        className="flex-1 min-w-0 flex flex-col items-center justify-center p-6 sm:p-10 relative"
        style={{ background: "#09090f" }}
      >
        {/* Language switcher — top right */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LocaleSwitcher variant="dark" />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Link href="/" className="flex items-center gap-2.5 justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white text-sm"
                 style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              O
            </div>
            <span className="font-semibold text-white">OKR System</span>
          </Link>
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
