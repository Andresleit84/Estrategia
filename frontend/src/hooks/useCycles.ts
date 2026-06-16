"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface Cycle {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  display_status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'OVERDUE';
  start_date: string;
  end_date: string;
  closed_at: string | null;
  objectives_count: number;
  avg_progress: number;
  score: number;
  days_remaining: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCycleInput {
  name: string;
  description?: string;
  type?: 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
  start_date: string;
  end_date: string;
}

export function useCycles() {
  return useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.get<Cycle[]>('/cycles'),
  });
}

export function useActiveCycle() {
  return useQuery({
    queryKey: ['cycles', 'active'],
    queryFn: () => api.get<Cycle | null>('/cycles/active'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCycle(id: string) {
  return useQuery({
    queryKey: ['cycles', id],
    queryFn: () => api.get<Cycle>(`/cycles/${id}`),
    enabled: !!id,
  });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCycleInput) => api.post<Cycle>('/cycles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycles'] });
      qc.invalidateQueries({ queryKey: ['setup-status'] });
    },
  });
}

export function useUpdateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateCycleInput> & { id: string }) =>
      api.patch<Cycle>(`/cycles/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles'] }),
  });
}

export function useActivateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Cycle>(`/cycles/${id}/activate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles'] }),
  });
}

export function useCloseCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Cycle>(`/cycles/${id}/close`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles'] }),
  });
}

export interface IncompleteObjective {
  id: string;
  title: string;
  level: string;
  status: string;
  progress: number;
  key_results: Array<{
    id: string;
    title: string;
    progress: number;
    status: string;
    current_value: number;
    target_value: number;
    metric_unit: string;
  }>;
}

export function useCycleIncomplete(cycleId: string | null) {
  return useQuery({
    queryKey: ['cycles', cycleId, 'incomplete'],
    queryFn: () => api.get<IncompleteObjective[]>(`/cycles/${cycleId}/incomplete`),
    enabled: !!cycleId,
    staleTime: 0,
  });
}

export function useRolloverCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromId, toCycleId, objectiveIds }: {
      fromId: string;
      toCycleId: string;
      objectiveIds: string[];
    }) => api.post<{ migrated: number }>(`/cycles/${fromId}/rollover`, {
      to_cycle_id: toCycleId,
      objective_ids: objectiveIds,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycles'] });
      qc.invalidateQueries({ queryKey: ['objectives'] });
    },
  });
}
