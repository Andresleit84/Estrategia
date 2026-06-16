"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { KeyResult } from "@/components/okr/KRCard";

export function useKeyResults(objId: string | null) {
  return useQuery<KeyResult[]>({
    queryKey: ["key-results", objId],
    queryFn: () => api.get(`/objectives/${objId}/key-results`),
    enabled: !!objId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateKeyResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      objId,
      ...data
    }: {
      objId: string;
      title: string;
      type?: string;
      metric_unit?: string;
      start_value?: number;
      target_value: number;
      description?: string;
      owner_id?: string;
      team_id?: string;
      check_in_cadence?: string;
    }) => api.post(`/objectives/${objId}/key-results`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["key-results", vars.objId] });
      qc.invalidateQueries({ queryKey: ["objectives"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
    },
  });
}

export function useUpdateKeyResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      objId,
      ...data
    }: {
      id: string;
      objId: string;
      title?: string;
      description?: string;
      current_value?: number;
      confidence?: number;
      owner_id?: string;
      team_id?: string;
      type?: string;
      metric_unit?: string;
      start_value?: number;
      target_value?: number;
      check_in_cadence?: string;
    }) => api.patch(`/key-results/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["key-results", vars.objId] });
      qc.invalidateQueries({ queryKey: ["objectives"] });
    },
  });
}

export function useCancelKeyResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, objId }: { id: string; objId: string }) =>
      api.delete(`/key-results/${id}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["key-results", vars.objId] });
      qc.invalidateQueries({ queryKey: ["objectives"] });
    },
  });
}
