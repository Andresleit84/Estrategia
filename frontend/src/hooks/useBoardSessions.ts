"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface BoardSession {
  id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_type: string;
  cycle_status: string;
  cycle_start: string;
  cycle_end: string;
  session_date: string;
  status: "DRAFT" | "PREPARING" | "READY" | "PRESENTED" | "CLOSED";
  chair: string | null;
  secretary: string | null;
  director_notes: string | null;
  meeting_notes: string | null;
  created_at: string;
  updated_at: string;
  decisions_count: number;
  pending_decisions: number;
}

export interface CycleKR {
  id: string;
  code: string | null;
  title: string;
  is_critical: boolean;
  status: string;
  confidence_pct: number;
  progress: number;
  objective_id: string;
  objective_code: string | null;
  objective_title: string;
  objective_level: string;
  cycle_id: string;
}

export function useBoardSessions() {
  return useQuery<BoardSession[]>({
    queryKey: ["reports", "board-sessions"],
    queryFn: () => api.get<BoardSession[]>("/reports/board-sessions"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateBoardSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { cycle_id: string; session_date: string; chair?: string; secretary?: string }) =>
      api.post<{ id: string }>("/reports/board-sessions", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", "board-sessions"] }),
  });
}

export function useUpdateBoardSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BoardSession> }) =>
      api.patch(`/reports/board-sessions/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", "board-sessions"] }),
  });
}

export function useDeleteBoardSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reports/board-sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", "board-sessions"] }),
  });
}

export function useCycleKRs(cycleId: string | undefined) {
  return useQuery<CycleKR[]>({
    queryKey: ["reports", "cycle-krs", cycleId],
    queryFn: () => api.get<CycleKR[]>(`/reports/cycle-krs/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateGuardrailStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, trend, note }: { id: string; status: string; trend: string; note?: string }) =>
      api.patch(`/reports/guardrails/${id}/status`, { status, trend, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "guardrails"] });
      qc.invalidateQueries({ queryKey: ["reports", "consejo-package"] });
    },
  });
}

export function useUpdateDecisionFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, follow_up_note, follow_up_verified }: { id: string; follow_up_note: string; follow_up_verified?: boolean }) =>
      api.patch(`/reports/board-decisions/${id}/followup`, { follow_up_note, follow_up_verified }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", "board-decisions"] }),
  });
}
