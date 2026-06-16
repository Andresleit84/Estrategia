import { PlanGate } from "@/components/billing/PlanGate";

export default function TraceabilityLayout({ children }: { children: React.ReactNode }) {
  return <PlanGate plan="PRO">{children}</PlanGate>;
}
