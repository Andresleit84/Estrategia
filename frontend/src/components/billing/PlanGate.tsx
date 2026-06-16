"use client";

import { useAuth } from "@/hooks/useAuth";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type PlanLevel = "PRO" | "ENTERPRISE";

const PLAN_RANK: Record<string, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

const PLAN_FEATURES: Record<PlanLevel, string[]> = {
  PRO: [
    "Reportes ejecutivos y de riesgo",
    "Mapa de trazabilidad estratégica",
    "Iniciativas y entregables",
    "Diagnóstico sectorial",
    "Asistente de IA",
  ],
  ENTERPRISE: [
    "Miembros ilimitados",
    "SLA garantizado",
    "Onboarding dedicado",
    "Integraciones personalizadas",
  ],
};

function effectivePlan(orgPlan: string, trialExpiresAt?: string | null): string {
  if (orgPlan !== "FREE") return orgPlan;
  if (trialExpiresAt && new Date(trialExpiresAt) > new Date()) return "PRO";
  return "FREE";
}

export function PlanGate({
  plan,
  children,
}: {
  plan: PlanLevel;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const effective = effectivePlan(user.org_plan, user.org_trial_expires_at);
  if ((PLAN_RANK[effective] ?? 0) >= (PLAN_RANK[plan] ?? 0)) {
    return <>{children}</>;
  }

  const features = PLAN_FEATURES[plan];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">
            Disponible en el plan {plan}
          </h2>
          <p className="text-sm text-muted-foreground">
            Actualiza tu plan para acceder a esta funcionalidad y muchas más.
          </p>
        </div>

        <ul className="text-sm text-left space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button onClick={() => router.push("/settings?tab=billing")}>
            Ver planes
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
}
