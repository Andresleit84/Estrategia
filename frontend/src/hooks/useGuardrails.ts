"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BoardGuardrail } from "./useConsejoPackage";

export function useGuardrails() {
  return useQuery<BoardGuardrail[]>({
    queryKey: ["reports", "guardrails"],
    queryFn: () => api.get<BoardGuardrail[]>("/reports/guardrails"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertGuardrail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<BoardGuardrail> }) =>
      id
        ? api.patch(`/reports/guardrails/${id}`, data)
        : api.post("/reports/guardrails", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "guardrails"] });
      qc.invalidateQueries({ queryKey: ["reports", "consejo-package"] });
    },
  });
}

export function useDeleteGuardrail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reports/guardrails/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "guardrails"] });
      qc.invalidateQueries({ queryKey: ["reports", "consejo-package"] });
    },
  });
}
