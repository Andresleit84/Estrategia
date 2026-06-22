"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ConsejoPackageCycle {
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  days_elapsed: number;
  days_remaining: number;
  status: string;
}

export interface ConsejoExecutiveSummary {
  total_objectives: number;
  on_track: number;
  at_risk: number;
  behind: number;
  completed: number;
  overall_progress: number;
  confidence_avg: number;
}

export interface ConsejoStrategicObjective {
  id: string;
  code: string | null;
  title: string;
  progress: number;
  status: string;
  owner_name: string | null;
  kr_count: number;
  kr_on_track: number;
}

export interface ConsejoAreaGroup {
  area_name: string;
  objectives: Array<{
    id: string;
    code: string | null;
    title: string;
    progress: number;
    status: string;
  }>;
}

export interface ConsejoRisk {
  kr_code: string | null;
  kr_title: string;
  objective_title: string;
  objective_level: string;
  progress: number;
  confidence: number;
  owner_name: string | null;
  days_since_checkin: number;
}

export interface ConsejoInitiativesSummary {
  total: number;
  on_track: number;
  at_risk: number;
  overdue: number;
}

export interface ConsejoGovernanceCommitment {
  event_type: string;
  title: string;
  due_date: string;
  status: string;
}

export interface CriticalKR {
  id: string;
  code: string | null;
  title: string;
  objective_id: string;
  objective_code: string | null;
  objective_title: string;
  progress: number;
  confidence: number;
  status: string;
  owner_name: string | null;
  days_since_checkin: number;
}

export interface BoardGuardrail {
  id: string;
  category: string;
  title: string;
  risk_description: string | null;
  kri_description: string | null;
  threshold: string | null;
  escalation_trigger: string | null;
  owner: string | null;
  status: "VERDE" | "AMBER" | "ROJO";
  trend: "UP" | "STABLE" | "DOWN";
}

export interface BoardDecision {
  id: string;
  title: string;
  context: string | null;
  options: string[];
  recommendation: string | null;
  status: "PENDING" | "DECIDED" | "DEFERRED" | "CLOSED";
  owner: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface ConsejoPackage {
  cycle: ConsejoPackageCycle;
  executive_summary: ConsejoExecutiveSummary;
  strategic_objectives: ConsejoStrategicObjective[];
  area_objectives: ConsejoAreaGroup[];
  top_risks: ConsejoRisk[];
  initiatives_summary: ConsejoInitiativesSummary;
  governance_commitments: ConsejoGovernanceCommitment[];
  critical_krs: CriticalKR[];
  guardrails: BoardGuardrail[];
  requested_decisions: BoardDecision[];
}

export function useConsejoPackage(cycleId: string | undefined) {
  return useQuery<ConsejoPackage>({
    queryKey: ["reports", "consejo-package", cycleId],
    queryFn: () => api.get<ConsejoPackage>(`/reports/consejo-package/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 5 * 60 * 1000,
  });
}
