import { PlanGate } from "@/components/billing/PlanGate";

export default function AiAssistantLayout({ children }: { children: React.ReactNode }) {
  return <PlanGate plan="PRO">{children}</PlanGate>;
}
