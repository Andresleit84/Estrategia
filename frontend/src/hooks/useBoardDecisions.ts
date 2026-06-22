"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BoardDecision } from "./useConsejoPackage";

export function useBoardDecisions(cycleId: string | undefined) {
  return useQuery<BoardDecision[]>({
    queryKey: ["reports", "board-decisions", cycleId],
    queryFn: () => api.get<BoardDecision[]>(`/reports/board-decisions/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertBoardDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<BoardDecision> & { cycle_id?: string } }) =>
      id
        ? api.patch(`/reports/board-decisions/${id}`, data)
        : api.post("/reports/board-decisions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "board-decisions"] });
      qc.invalidateQueries({ queryKey: ["reports", "consejo-package"] });
    },
  });
}

export function useDeleteBoardDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reports/board-decisions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "board-decisions"] });
      qc.invalidateQueries({ queryKey: ["reports", "consejo-package"] });
    },
  });
}

export function useSetKrCritical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ krId, isCritical }: { krId: string; isCritical: boolean }) =>
      api.patch(`/reports/kr-critical/${krId}`, { is_critical: isCritical }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "consejo-package"] });
    },
  });
}
