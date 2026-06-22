"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface PlanningSession {
  id: string;
  organization_id: string;
  cycle_id: string | null;
  cycle_name: string | null;
  cycle_type: string | null;
  name: string;
  description: string | null;
  type: "QUARTERLY" | "ANNUAL" | "PI";
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
  current_stage: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  total_items: number;
  done_items: number;
  blocked_items: number;
}

export function usePlanningSessions() {
  return useQuery<PlanningSession[]>({
    queryKey: ["planning", "sessions"],
    queryFn: () => api.get<PlanningSession[]>("/planning/sessions"),
    staleTime: 60_000,
  });
}

export function useCreatePlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      cycle_id?: string;
      name: string;
      type?: string;
      description?: string;
    }) => api.post("/planning/sessions", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planning", "sessions"] }),
  });
}

export function useUpdatePlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      name?: string;
      status?: string;
      current_stage?: number;
      description?: string;
    }) => api.patch(`/planning/sessions/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planning", "sessions"] }),
  });
}

export function useDeletePlanningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/planning/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planning", "sessions"] }),
  });
}
