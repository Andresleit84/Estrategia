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

export interface ConsejoPackage {
  cycle: ConsejoPackageCycle;
  executive_summary: ConsejoExecutiveSummary;
  strategic_objectives: ConsejoStrategicObjective[];
  area_objectives: ConsejoAreaGroup[];
  top_risks: ConsejoRisk[];
  initiatives_summary: ConsejoInitiativesSummary;
  governance_commitments: ConsejoGovernanceCommitment[];
}

export function useConsejoPackage(cycleId: string | undefined) {
  return useQuery<ConsejoPackage>({
    queryKey: ["reports", "consejo-package", cycleId],
    queryFn: () => api.get<ConsejoPackage>(`/reports/consejo-package/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 5 * 60 * 1000,
  });
}
