import { PlanGate } from "@/components/billing/PlanGate";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <PlanGate plan="PRO">{children}</PlanGate>;
}
