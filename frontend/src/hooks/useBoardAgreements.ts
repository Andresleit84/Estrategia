"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface BoardAgreement {
  id: string;
  board_session_id: string;
  text: string;
  owner: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export function useBoardAgreements(sessionId: string | undefined) {
  return useQuery<BoardAgreement[]>({
    queryKey: ["reports", "board-agreements", sessionId],
    queryFn: () => api.get<BoardAgreement[]>(`/reports/board-sessions/${sessionId}/agreements`),
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpsertAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, id, data }: {
      sessionId: string;
      id?: string;
      data: { text: string; owner?: string; due_date?: string };
    }) =>
      id
        ? api.patch(`/reports/board-agreements/${id}`, data)
        : api.post(`/reports/board-sessions/${sessionId}/agreements`, data),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["reports", "board-agreements", vars.sessionId] });
    },
  });
}

export function useToggleAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean; sessionId: string }) =>
      api.patch(`/reports/board-agreements/${id}/toggle`, { completed }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["reports", "board-agreements", vars.sessionId] });
    },
  });
}

export function useDeleteAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; sessionId: string }) =>
      api.delete(`/reports/board-agreements/${id}`),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["reports", "board-agreements", vars.sessionId] });
    },
  });
}
