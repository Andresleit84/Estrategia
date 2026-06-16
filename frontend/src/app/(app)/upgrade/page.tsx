"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check, X, CreditCard, Wallet, Loader2, Sparkles, ArrowLeft,
  Mail, Zap, Building2, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBillingStatus, useStripeCheckout, useMpCheckout, useStripePortal } from "@/hooks/useBilling";
import { useAuthStore } from "@/store/auth.store";

// ── Plan definitions ─────────────────────────────────────────────────────────

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  id: "free" | "pro" | "enterprise";
  name: string;
  tagline: string;
  price: number | null;
  priceAnnual?: number;
  currency: string;
  period: string;
  badge?: string;
  badgeColor?: string;
  features: PlanFeature[];
  cta: string;
  ctaVariant: "default" | "outline" | "ghost";
  popular?: boolean;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function UpgradePage() {
  const t = useTranslations("pages.upgrade");
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const params = useSearchParams();
  const cancelled = params.get("cancelled") === "1";
  const user = useAuthStore(s => s.user);

  const { data: billing, isLoading: loadingStatus } = useBillingStatus();
  const stripeCheckout = useStripeCheckout();
  const mpCheckout = useMpCheckout();
  const stripePortal = useStripePortal();

  const isPro = billing?.plan === "PRO" || billing?.plan === "ENTERPRISE";
  const isEnterprise = billing?.plan === "ENTERPRISE";
  const isTrial = billing?.trial_active;
  const trialExpired = billing?.trial_expired;

  const monthlyUSD = 49;
  const annualUSD = 490;
  const monthlyAnnualUSD = Math.round(annualUSD / 12); // ~40
  const displayPrice = interval === "annual" ? monthlyAnnualUSD : monthlyUSD;

  const PLANS: Plan[] = [
    {
      id: "free",
      name: t("planFree.name"),
      tagline: t("planFree.tagline"),
      price: 0,
      currency: "USD",
      period: t("perMonth"),
      badge: isTrial ? t("planFree.badgeTrial") : t("planFree.badge"),
      badgeColor: isTrial ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-muted text-muted-foreground",
      features: [
        { label: t("planFree.f1"), included: true },
        { label: t("planFree.f2"), included: true },
        { label: t("planFree.f3"), included: true },
        { label: t("planFree.f4"), included: true },
        { label: t("planFree.f5"), included: false },
        { label: t("planFree.f6"), included: false },
        { label: t("planFree.f7"), included: false },
        { label: t("planFree.f8"), included: false },
      ],
      cta: isPro ? t("planFree.ctaDowngrade") : t("planFree.ctaCurrent"),
      ctaVariant: "outline",
    },
    {
      id: "pro",
      name: t("planPro.name"),
      tagline: t("planPro.tagline"),
      price: displayPrice,
      priceAnnual: annualUSD,
      currency: "USD",
      period: t("perMonth"),
      popular: true,
      badge: t("planPro.badge"),
      badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
      features: [
        { label: t("planPro.f1"), included: true },
        { label: t("planPro.f2"), included: true },
        { label: t("planPro.f3"), included: true },
        { label: t("planPro.f4"), included: true },
        { label: t("planPro.f5"), included: true },
        { label: t("planPro.f6"), included: true },
        { label: t("planPro.f7"), included: true },
        { label: t("planPro.f8"), included: true },
      ],
      cta: isPro ? t("planPro.ctaCurrent") : t("planPro.cta"),
      ctaVariant: "default",
    },
    {
      id: "enterprise",
      name: t("planEnterprise.name"),
      tagline: t("planEnterprise.tagline"),
      price: null,
      currency: "",
      period: "",
      badge: isEnterprise ? t("planEnterprise.badgeCurrent") : undefined,
      badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
      features: [
        { label: t("planEnterprise.f1"), included: true },
        { label: t("planEnterprise.f2"), included: true },
        { label: t("planEnterprise.f3"), included: true },
        { label: t("planEnterprise.f4"), included: true },
        { label: t("planEnterprise.f5"), included: true },
        { label: t("planEnterprise.f6"), included: true },
        { label: t("planEnterprise.f7"), included: true },
        { label: t("planEnterprise.f8"), included: true },
      ],
      cta: t("planEnterprise.cta"),
      ctaVariant: "outline",
    },
  ];

  const currentPlanId: "free" | "pro" | "enterprise" = isEnterprise ? "enterprise" : isPro ? "pro" : "free";

  const handleProCta = () => {
    if (isPro && billing?.has_subscription && billing.stripe_enabled) {
      stripePortal.mutate();
      return;
    }
    if (billing?.stripe_enabled) {
      stripeCheckout.mutate(interval);
    } else if (billing?.mp_enabled) {
      mpCheckout.mutate(interval);
    }
  };

  const isProPending = stripeCheckout.isPending || mpCheckout.isPending || stripePortal.isPending;

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-10 space-y-10">
      {cancelled && (
        <div className="max-w-2xl mx-auto bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-500 text-center">
          {t("cancelledMsg")}
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {isTrial && billing?.trial_expires_at
            ? t("trialExpiresSoon", { date: new Date(billing.trial_expires_at).toLocaleDateString("es", { day: "numeric", month: "long" }) })
            : trialExpired
              ? t("trialExpired")
              : t("pageSubtitle")}
        </p>
      </div>

      {/* Interval toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center bg-muted rounded-lg p-1 gap-0">
          <button
            onClick={() => setInterval("monthly")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              interval === "monthly" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("monthly")}
          </button>
          <button
            onClick={() => setInterval("annual")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all relative",
              interval === "annual" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t("annual")}
            <span className="absolute -top-2.5 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              -17%
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isProPlan = plan.id === "pro";
          const isEnterprisePlan = plan.id === "enterprise";

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6 space-y-5 transition-all",
                plan.popular
                  ? "border-indigo-500/60 dark:border-indigo-400/50 shadow-lg shadow-indigo-500/10 bg-card"
                  : "border-border bg-card",
                isCurrent && !plan.popular && "ring-2 ring-primary/30",
              )}
            >
              {/* Popular ribbon */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t("popular")}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                    plan.id === "free" ? "bg-muted" : plan.id === "pro" ? "bg-indigo-500/10" : "bg-violet-500/10",
                  )}>
                    {plan.id === "free" ? <Zap className="h-3.5 w-3.5 text-muted-foreground" /> :
                     plan.id === "pro" ? <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> :
                     <Building2 className="h-3.5 w-3.5 text-violet-500" />}
                  </div>
                  <span className="text-base font-bold text-foreground">{plan.name}</span>
                  {plan.badge && (
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto shrink-0", plan.badgeColor)}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{plan.tagline}</p>
              </div>

              {/* Price */}
              <div className="space-y-0.5">
                {plan.price === null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{t("planEnterprise.priceLine")}</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-semibold text-muted-foreground">$</span>
                    <span className="text-4xl font-bold text-foreground tabular-nums">{plan.price}</span>
                    {plan.currency && (
                      <span className="text-sm text-muted-foreground">{plan.currency} / {plan.period}</span>
                    )}
                  </div>
                )}
                {isProPlan && interval === "annual" && (
                  <p className="text-[11px] text-muted-foreground">
                    ${annualUSD} USD {t("billedAnnually")} · {t("youSave")} ${monthlyUSD * 12 - annualUSD}
                  </p>
                )}
                {isProPlan && billing?.mp_enabled && (
                  <p className="text-[11px] text-muted-foreground">
                    {interval === "annual" ? "$490,000" : "$49,000"} ARS / {interval === "annual" ? t("year") : t("month")} {t("viaMp")}
                  </p>
                )}
              </div>

              {/* CTA button */}
              <div>
                {isProPlan && !billing?.stripe_enabled && !billing?.mp_enabled ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">{t("noPayment")}</p>
                    <a
                      href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'soporte@sendoagil.com'}`}
                      className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {t("contactUs")}
                    </a>
                  </div>
                ) : isProPlan ? (
                  <Button
                    className={cn(
                      "w-full font-semibold",
                      isCurrent ? "" : "bg-indigo-600 hover:bg-indigo-700 text-white",
                    )}
                    variant={isCurrent ? "outline" : "default"}
                    onClick={handleProCta}
                    disabled={isProPending || isCurrent}
                  >
                    {isProPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("redirecting")}</>
                      : isCurrent
                        ? <>{plan.cta}</>
                        : <>{plan.cta} <ChevronRight className="h-4 w-4 ml-1" /></>}
                  </Button>
                ) : isEnterprisePlan ? (
                  <a
                    href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'soporte@sendoagil.com'}?subject=Enterprise`}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {plan.cta}
                  </a>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    {plan.cta}
                  </Button>
                )}

                {/* Payment method pills — solo en Pro con pagos activos */}
                {isProPlan && !isCurrent && (billing?.stripe_enabled || billing?.mp_enabled) && (
                  <div className="flex items-center justify-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
                    {billing?.stripe_enabled && (
                      <button
                        onClick={() => stripeCheckout.mutate(interval)}
                        disabled={isProPending}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <CreditCard className="h-3 w-3" /> Stripe
                      </button>
                    )}
                    {billing?.stripe_enabled && billing?.mp_enabled && <span>·</span>}
                    {billing?.mp_enabled && (
                      <button
                        onClick={() => mpCheckout.mutate(interval)}
                        disabled={isProPending}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Wallet className="h-3 w-3" /> MercadoPago
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Feature divider */}
              <div className="border-t pt-4 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isEnterprisePlan ? t("everythingInPro") : isCurrent && plan.id !== "pro" ? t("yourCurrentPlan") : t("includes")}
                </p>
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {f.included
                      ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
                      : <X className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/40" />}
                    <span className={cn(
                      "text-xs leading-relaxed",
                      f.included ? "text-foreground" : "text-muted-foreground/60",
                    )}>
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-xs text-muted-foreground mb-6">{t("terms")}</p>
        <div className="border-t pt-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Link href="/welcome" className="hover:text-foreground flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("backDashboard")}
          </Link>
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'soporte@sendoagil.com'}`}
            className="hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            {t("supportContact")} {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'soporte@sendoagil.com'}
          </a>
        </div>
      </div>
    </div>
  );
}
