"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface PortfolioClient {
  org_id: string;
  org_name: string;
  org_plan: string;
  org_mode: string;
  active_cycle_id: string | null;
  active_cycle_name: string | null;
  active_cycle_days_remaining: number | null;
  objectives_count: number;
  krs_count: number;
  avg_progress: number;
  at_risk_count: number;
  last_checkin_at: string | null;
  last_checkin_days_ago: number | null;
  completion_pct: number;
  user_role: string;
}

export function usePortfolioMetrics() {
  return useQuery({
    queryKey: ["reports", "consultant-portfolio"],
    queryFn: () => api.get<PortfolioClient[]>("/reports/consultant-portfolio"),
    staleTime: 300_000,
  });
}
