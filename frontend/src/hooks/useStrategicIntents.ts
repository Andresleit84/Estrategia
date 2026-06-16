"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface StrategicIntent {
  id: string;
  organization_id: string;
  code?: string | null;
  title: string;
  description: string | null;
  horizon_years: number;
  target_year: number | null;
  category: "GROWTH" | "EFFICIENCY" | "CULTURE" | "INNOVATION" | "SUSTAINABILITY" | "OTHER" | null;
  status: "DRAFT" | "ACTIVE" | "ACHIEVED" | "CANCELLED";
  problem_count: number;
  aligned_objectives_count: number;
  created_at: string;
  updated_at: string;
}

export function useStrategicIntents() {
  return useQuery<StrategicIntent[]>({
    queryKey: ["strategic-intents"],
    queryFn: () => api.get("/strategic-intents"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStrategicIntent(id: string | null) {
  return useQuery<StrategicIntent>({
    queryKey: ["strategic-intents", id],
    queryFn: () => api.get(`/strategic-intents/${id}`),
    enabled: !!id,
  });
}

export function useCreateStrategicIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      horizon_years?: number;
      target_year?: number;
      category?: StrategicIntent["category"];
    }) => api.post("/strategic-intents", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategic-intents"] }),
  });
}

export function useUpdateStrategicIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      title?: string;
      description?: string;
      horizon_years?: number;
      target_year?: number;
      category?: StrategicIntent["category"];
      status?: StrategicIntent["status"];
    }) => api.patch(`/strategic-intents/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategic-intents"] }),
  });
}

export function useDeleteStrategicIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/strategic-intents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategic-intents"] }),
  });
}

export interface AISuggestion {
  title: string;
  description: string;
  category: NonNullable<StrategicIntent["category"]>;
  horizon_years: number;
  target_year: number;
  rationale: string;
}

export function useSuggestStrategicIntents() {
  return useMutation<{ suggestions: AISuggestion[]; error?: string }, Error>({
    mutationFn: () => api.post("/ai/suggest-strategic-intents", {}),
  });
}

export function useIntentProblems(intentId: string | null) {
  return useQuery({
    queryKey: ["strategic-intents", intentId, "problems"],
    queryFn: () => api.get(`/strategic-intents/${intentId}/problems`),
    enabled: !!intentId,
  });
}

export function useIntentObjectives(intentId: string | null) {
  return useQuery({
    queryKey: ["strategic-intents", intentId, "objectives"],
    queryFn: () => api.get(`/strategic-intents/${intentId}/objectives`),
    enabled: !!intentId,
  });
}
