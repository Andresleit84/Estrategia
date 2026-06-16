import Link from "next/link";
import { Check, Zap, Building2, Sparkles } from "lucide-react";

const plans = [
  {
    key: "FREE",
    label: "Free",
    price_usd: 0,
    price_ars: 0,
    icon: Zap,
    color: "text-slate-400",
    bg: "bg-slate-800/40",
    border: "border-slate-700",
    features: [
      "Hasta 5 miembros",
      "1 ciclo activo",
      "10 objetivos",
      "Check-ins básicos",
      "Reportes básicos",
    ],
    cta: "Empezar gratis",
    href: "/auth/register",
    highlight: false,
  },
  {
    key: "PRO",
    label: "Pro",
    price_usd: 49,
    price_ars: 49000,
    icon: Sparkles,
    color: "text-indigo-400",
    bg: "bg-indigo-950/40",
    border: "border-indigo-500/50",
    features: [
      "Hasta 50 miembros",
      "Ciclos ilimitados",
      "Objetivos ilimitados",
      "Agentes de IA integrados",
      "Todos los reportes",
      "Export PDF y CSV",
      "Notificaciones Telegram",
      "Soporte prioritario",
    ],
    cta: "Comenzar prueba de 15 días",
    href: "/auth/register",
    highlight: true,
  },
  {
    key: "ENTERPRISE",
    label: "Enterprise",
    price_usd: 0,
    price_ars: 0,
    icon: Building2,
    color: "text-purple-400",
    bg: "bg-purple-950/30",
    border: "border-purple-700/50",
    features: [
      "Miembros ilimitados",
      "Todo lo incluido en Pro",
      "SLA garantizado",
      "Onboarding dedicado",
      "Integración personalizada",
      "Facturación corporativa",
    ],
    cta: "Contactar ventas",
    href: "mailto:andres.enrique@sendoagil.com",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div
      className="min-h-screen py-20 px-4"
      style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a0a1a 100%)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <p className="text-sm font-semibold text-indigo-400 tracking-widest uppercase">Precios</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Simple. Transparente. Sin sorpresas.
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Empieza gratis. Cuando tu equipo crece, el sistema crece con vos.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.key}
                className={`rounded-2xl border p-8 relative ${plan.bg} ${plan.border} ${
                  plan.highlight ? "ring-2 ring-indigo-500/60 shadow-[0_0_60px_rgba(99,102,241,0.15)]" : ""
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                      MÁS POPULAR
                    </span>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <div className={`flex items-center gap-2 mb-3 ${plan.color}`}>
                      <Icon className="h-5 w-5" />
                      <span className="font-semibold text-sm">{plan.label}</span>
                    </div>
                    {plan.price_usd === 0 && plan.key === "FREE" ? (
                      <div>
                        <span className="text-4xl font-bold text-white">Gratis</span>
                      </div>
                    ) : plan.price_usd === 0 ? (
                      <div>
                        <span className="text-2xl font-bold text-white">A medida</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-4xl font-bold text-white">${plan.price_usd}</span>
                        <span className="text-white/40 text-sm ml-1">USD/mes</span>
                        <p className="text-white/30 text-xs mt-1">
                          ${plan.price_ars.toLocaleString("es-AR")} ARS/mes vía MercadoPago
                        </p>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.color}`} />
                        <span className="text-sm text-white/70">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                      plan.highlight
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                        : "bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ strip */}
        <div className="mt-16 text-center space-y-4">
          <p className="text-white/40 text-sm">
            Todos los planes incluyen 15 días de prueba gratuita en Pro · Sin tarjeta de crédito requerida para la prueba
          </p>
          <p className="text-white/30 text-xs">
            Precios en USD para pagos internacionales · Precios en ARS para pagos con MercadoPago (Argentina) ·{" "}
            <a href="mailto:andres.enrique@sendoagil.com" className="text-indigo-400 hover:text-indigo-300">
              Consultar para LATAM
            </a>
          </p>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              ¿Ya tenés cuenta? Iniciar sesión →
            </Link>
            <span className="text-white/20 text-xs hidden sm:inline">·</span>
            <div className="flex gap-3 text-xs text-white/25">
              <Link href="/terms" className="hover:text-white/50 transition-colors">Términos de servicio</Link>
              <span className="text-white/15">·</span>
              <Link href="/privacy" className="hover:text-white/50 transition-colors">Política de privacidad</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
