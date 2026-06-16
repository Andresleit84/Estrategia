"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProgressRing } from "@/design-system/components/ProgressRing";
import { ConfidenceMeter } from "@/design-system/components/ConfidenceMeter";
import { StatusChip } from "@/design-system/components/StatusChip";
import { KRCard } from "@/design-system/components/KRCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { KRCardSkeleton, ObjectiveCardSkeleton } from "@/components/shared/SkeletonLoader";
import { Target, Plus } from "lucide-react";
import type { OKRStatus } from "@/design-system/tokens";

const STATUSES: OKRStatus[] = ["ON_TRACK", "AT_RISK", "BEHIND", "COMPLETED", "CANCELLED", "DRAFT"];

const DEMO_KR = {
  id: "kr-1",
  title: "Aumentar la tasa de activación de nuevos usuarios de 35% a 60%",
  type: "INCREASE" as const,
  metricUnit: "%",
  startValue: 35,
  currentValue: 48,
  targetValue: 60,
  progress: 52,
  confidence: 0.65,
  status: "AT_RISK" as const,
  ownerName: "Ana García",
  lastCheckInDaysAgo: 3,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
      <Separator />
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10">
      <PageHeader
        title="Design System"
        description="Componentes base del sistema OKR. Esta página es solo para desarrollo."
      />

      {/* Colores OKR */}
      <Section title="Semáforo OKR">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => <StatusChip key={s} status={s} />)}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {STATUSES.map((s) => <StatusChip key={s} status={s} size="sm" />)}
        </div>
      </Section>

      {/* Progress Rings */}
      <Section title="Progress Ring">
        <div className="flex flex-wrap items-end gap-6">
          {STATUSES.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <ProgressRing progress={i * 20} status={s} size="lg" />
              <span className="text-xs text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-6 mt-4">
          {([0, 25, 50, 75, 100] as number[]).map((p) => (
            <div key={p} className="flex flex-col items-center gap-2">
              <ProgressRing progress={p} size="sm" />
              <ProgressRing progress={p} size="md" />
              <ProgressRing progress={p} size="lg" />
            </div>
          ))}
        </div>
      </Section>

      {/* Confidence Meter */}
      <Section title="Confidence Meter">
        <div className="max-w-sm space-y-3">
          {[0.2, 0.4, 0.55, 0.7, 0.9].map((v) => (
            <div key={v} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-6 text-right font-mono">{v}</span>
              <ConfidenceMeter value={v} className="flex-1" />
            </div>
          ))}
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructivo</Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button size="sm">Pequeño</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Grande</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button><Plus className="h-4 w-4 mr-1.5" />Crear objetivo</Button>
          <Button variant="outline"><Plus className="h-4 w-4 mr-1.5" />Nuevo KR</Button>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge className="bg-okr-on-track-bg text-okr-on-track">Activo</Badge>
          <Badge className="bg-okr-at-risk-bg text-okr-at-risk">En riesgo</Badge>
        </div>
      </Section>

      {/* KR Card */}
      <Section title="KR Card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <KRCard data={DEMO_KR} onCheckIn={() => {}} onEdit={() => {}} onViewHistory={() => {}} />
          <KRCard
            data={{ ...DEMO_KR, id: "kr-2", status: "ON_TRACK", confidence: 0.82, progress: 74, lastCheckInDaysAgo: 0, title: "Reducir el churn mensual de 4.2% a 2%", type: "DECREASE", targetValue: 2, startValue: 4.2, currentValue: 3.1, metricUnit: "%" }}
            onCheckIn={() => {}}
          />
        </div>
      </Section>

      {/* Skeletons */}
      <Section title="Skeleton Loaders">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <KRCardSkeleton />
          <KRCardSkeleton />
        </div>
        <div className="mt-4 max-w-xl">
          <ObjectiveCardSkeleton />
        </div>
      </Section>

      {/* Empty States */}
      <Section title="Empty States">
        <Card className="overflow-hidden">
          <EmptyState
            icon={Target}
            title="Aún no hay OKRs en este ciclo"
            description="Define los objetivos de la empresa para arrancar el ciclo estratégico. Necesitas al menos 1 objetivo con 1 Key Result."
            actionLabel="Crear primer objetivo"
            onAction={() => {}}
          />
        </Card>
      </Section>

      {/* Tipografía */}
      <Section title="Tipografía">
        <div className="space-y-2">
          <p className="text-4xl font-bold">KPI grande — 87%</p>
          <p className="text-2xl font-semibold">Título de página</p>
          <p className="text-xl font-semibold">Título de sección</p>
          <p className="text-lg font-medium">Subtítulo</p>
          <p className="text-base">Cuerpo principal</p>
          <p className="text-sm text-muted-foreground">Texto secundario</p>
          <p className="text-xs text-muted-foreground">Metadata / labels</p>
          <p className="font-mono text-sm">Valores métricos: 42.3% → 68.1%</p>
        </div>
      </Section>
    </div>
  );
}
