"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface SetupStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  url: string;
  icon: string;
}

export interface SetupStatus {
  steps: SetupStep[];
  completed: number;
  total: number;
  percentage: number;
}

export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: ["setup-status"],
    queryFn: () => api.get("/system/setup-status"),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useInvalidateSetupStatus() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["setup-status"] });
}
