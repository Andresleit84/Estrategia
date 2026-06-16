"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProgramCycleEntry {
  cycle_id: string;
  year_label: string;
  year_number: number;
  cycle_name: string;
  cycle_status: string;
  avg_progress: number;
  focus_areas: string[] | null;
}

export interface TransformationProgram {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  start_year: number;
  end_year: number;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  vision_statement: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  cycles_count: number;
  overall_progress: number;
  cycles: ProgramCycleEntry[];
}

export interface CreateProgramInput {
  title: string;
  description?: string;
  start_year: number;
  end_year: number;
  vision_statement?: string;
}

export interface UpdateProgramInput {
  id: string;
  title?: string;
  description?: string;
  status?: "ACTIVE" | "COMPLETED" | "PAUSED";
  vision_statement?: string;
}

export interface AddCycleInput {
  programId: string;
  cycle_id: string;
  year_label: string;
  year_number: number;
  focus_areas?: string[];
  expected_outcomes?: string;
}

export interface RemoveCycleInput {
  programId: string;
  cycleId: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePrograms() {
  return useQuery<TransformationProgram[]>({
    queryKey: ["transformation-programs"],
    queryFn: () => api.get("/transformation-programs"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useProgram(id: string | undefined) {
  return useQuery<TransformationProgram>({
    queryKey: ["transformation-programs", id],
    queryFn: () => api.get(`/transformation-programs/${id}`),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProgramInput) =>
      api.post<TransformationProgram>("/transformation-programs", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transformation-programs"] }),
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateProgramInput) =>
      api.patch<TransformationProgram>(`/transformation-programs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transformation-programs"] }),
  });
}

export function useAddProgramCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programId, ...dto }: AddCycleInput) =>
      api.post<TransformationProgram>(`/transformation-programs/${programId}/cycles`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transformation-programs"] }),
  });
}

export function useRemoveProgramCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programId, cycleId }: RemoveCycleInput) =>
      api.delete<TransformationProgram>(`/transformation-programs/${programId}/cycles/${cycleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transformation-programs"] }),
  });
}

export function useDeleteProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transformation-programs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transformation-programs"] }),
  });
}
