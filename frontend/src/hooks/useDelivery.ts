"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProgramStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type PhaseStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
export type DeliverableStatus = "NOT_STARTED" | "IN_PROGRESS" | "IN_REVIEW" | "APPROVED" | "BLOCKED" | "CANCELLED";

export interface DeliveryProgram {
  id: string;
  name: string;
  description?: string;
  status: ProgramStatus;
  cycle_id?: string;
  cycle_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  phase_count: number;
  deliverable_count: number;
  completed_count: number;
  completion_pct: number;
}

export interface DeliveryDep {
  deliverable_id: string;
  depends_on_id: string;
  depends_on_title: string;
}

export interface Deliverable {
  id: string;
  phase_id: string;
  organization_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  status: DeliverableStatus;
  owner_id?: string;
  owner_name?: string;
  due_date?: string;
  document_url?: string;
  notes?: string;
  linked_objective_id?: string;
  linked_objective_title?: string;
  linked_initiative_id?: string;
  linked_initiative_title?: string;
  created_at: string;
  updated_at: string;
  dependencies: DeliveryDep[];
}

export interface DeliveryPhase {
  id: string;
  program_id: string;
  name: string;
  description?: string;
  gate_criteria?: string;
  target_start_date?: string;
  target_end_date?: string;
  status: PhaseStatus;
  order_index: number;
  owner_id?: string;
  owner_name?: string;
  deliverable_count: number;
  completed_count: number;
  completion_pct: number;
  deliverables: Deliverable[];
}

export interface ProgramDetail {
  program: DeliveryProgram;
  phases: DeliveryPhase[];
}

export interface UpcomingDeliverable {
  id: string;
  title: string;
  status: DeliverableStatus;
  due_date: string;
  days_until_due: number;
  is_overdue: boolean;
  owner_name?: string;
  phase_name: string;
  program_name: string;
  program_id: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function usePrograms() {
  return useQuery<DeliveryProgram[]>({
    queryKey: ["delivery", "programs"],
    queryFn: async () => {
      const res = await api.get<DeliveryProgram[]>("/delivery");
      return res ?? [];
    },
  });
}

export function useProgram(id: string | null) {
  return useQuery<ProgramDetail>({
    queryKey: ["delivery", "program", id],
    queryFn: () => api.get<ProgramDetail>(`/delivery/${id}`),
    enabled: !!id,
  });
}

export function useUpcomingDeliverables(days = 30) {
  return useQuery<UpcomingDeliverable[]>({
    queryKey: ["delivery", "upcoming", days],
    queryFn: async () => {
      const res = await api.get<UpcomingDeliverable[]>(`/delivery/upcoming?days=${days}`);
      return res ?? [];
    },
  });
}

// ── Program mutations ─────────────────────────────────────────────────────────

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; status?: ProgramStatus; cycle_id?: string }) =>
      api.post<DeliveryProgram>("/delivery", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery", "programs"] }),
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; status?: ProgramStatus; cycle_id?: string }) =>
      api.patch<DeliveryProgram>(`/delivery/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["delivery", "programs"] });
      qc.invalidateQueries({ queryKey: ["delivery", "program", vars.id] });
    },
  });
}

export function useDeleteProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/delivery/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery", "programs"] }),
  });
}

// ── Phase mutations ───────────────────────────────────────────────────────────

export function useCreatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ programId, ...data }: {
      programId: string;
      name: string;
      description?: string;
      gate_criteria?: string;
      target_start_date?: string;
      target_end_date?: string;
      owner_id?: string;
    }) => api.post<DeliveryPhase>(`/delivery/${programId}/phases`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["delivery", "program", vars.programId] }),
  });
}

export function useUpdatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, programId, ...data }: {
      phaseId: string;
      programId: string;
      name?: string;
      description?: string;
      gate_criteria?: string;
      target_start_date?: string;
      target_end_date?: string;
      status?: PhaseStatus;
      owner_id?: string;
    }) => api.patch<DeliveryPhase>(`/delivery/phases/${phaseId}`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["delivery", "program", vars.programId] }),
  });
}

export function useDeletePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, programId }: { phaseId: string; programId: string }) =>
      api.delete<{ success: boolean }>(`/delivery/phases/${phaseId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["delivery", "program", vars.programId] }),
  });
}

// ── Deliverable mutations ─────────────────────────────────────────────────────

export function useCreateDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, programId, ...data }: {
      phaseId: string;
      programId: string;
      title: string;
      description?: string;
      acceptance_criteria?: string;
      owner_id?: string;
      due_date?: string;
      document_url?: string;
      notes?: string;
    }) => api.post<Deliverable>(`/delivery/phases/${phaseId}/deliverables`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["delivery", "program", vars.programId] }),
  });
}

export function useUpdateDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ delivId, programId, ...data }: {
      delivId: string;
      programId: string;
      title?: string;
      description?: string;
      acceptance_criteria?: string;
      owner_id?: string;
      due_date?: string;
      status?: DeliverableStatus;
      document_url?: string;
      notes?: string;
    }) => api.patch<Deliverable>(`/delivery/deliverables/${delivId}`, data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["delivery", "program", vars.programId] }),
  });
}

export function useDeleteDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ delivId, programId }: { delivId: string; programId: string }) =>
      api.delete<{ success: boolean }>(`/delivery/deliverables/${delivId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["delivery", "program", vars.programId] }),
  });
}
