"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface MyKR {
  kr_id: string;
  kr_title: string;
  current_value: number;
  target_value: number;
  start_value: number;
  metric_unit: string | null;
  confidence_pct: number;
  kr_status: string;
  kr_progress: number;
  check_in_cadence: string | null;
  objective_id: string;
  objective_title: string;
  objective_code: string | null;
  level: "COMPANY" | "AREA" | "TEAM" | "INDIVIDUAL";
  objective_progress: number;
  objective_status: string;
  team_id: string | null;
  team_name: string | null;
  area_id: string | null;
  area_name: string | null;
  last_checkin_at: string | null;
  days_since_checkin: number;
  cycle_id: string;
  cycle_name: string;
  cycle_end_date: string;
}

export interface NorthStarObjective {
  id: string;
  title: string;
  code: string | null;
  progress: number;
  status: string;
  cycle_name: string;
}

export interface MyWorkCycle {
  id: string;
  name: string;
  end_date: string;
  days_remaining: number;
}

export interface MyWorkData {
  krs: MyKR[];
  north_star: NorthStarObjective[];
  cycle: MyWorkCycle | null;
}

export function useMyWork(cycleId?: string) {
  return useQuery<MyWorkData>({
    queryKey: ["my-work", cycleId ?? "active"],
    queryFn: async () => {
      const params = cycleId ? `?cycleId=${cycleId}` : "";
      const data = await api.get<MyWorkData>(`/me/my-work${params}`);
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}
