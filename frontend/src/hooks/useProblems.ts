"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Problem {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  category: "PEOPLE" | "PROCESS" | "TECHNOLOGY" | "MARKET" | "CULTURE" | "FINANCIAL" | "OPERATIONAL" | "OTHER";
  severity: number;
  frequency: number;
  priority_score: number;
  status: "IDENTIFIED" | "BEING_ADDRESSED" | "RESOLVED" | "DEPRIORITIZED";
  intent_count: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  code?: string | null;
}

export function useProblems() {
  return useQuery<Problem[]>({
    queryKey: ["problems"],
    queryFn: () => api.get("/problems"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      category: Problem["category"];
      severity: number;
      frequency: number;
    }) => api.post("/problems", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problems"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
    },
  });
}

export function useUpdateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      title?: string;
      description?: string;
      category?: Problem["category"];
      severity?: number;
      frequency?: number;
      status?: Problem["status"];
    }) => api.patch(`/problems/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["problems"] }),
  });
}

export function useProblemIntents(problemId: string | null) {
  return useQuery({
    queryKey: ["problems", problemId, "intents"],
    queryFn: () => api.get(`/problems/${problemId}/intents`),
    enabled: !!problemId,
  });
}

export function useDeleteProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/problems/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["problems"] }),
  });
}
