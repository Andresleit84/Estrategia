"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  initiative_id: string;
  title: string;
  description?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  due_date?: string;
  completed_at?: string;
  assignee_id?: string;
  assignee_name?: string;
  sort_order: number;
  is_overdue?: boolean;
  created_at: string;
  updated_at: string;
}

export interface InitiativeKr {
  id: string;
  code?: string;
  title: string;
  progress: number;
  status: string;
}

export interface InitiativeArea {
  id: string;
  name: string;
  color: string;
  is_primary: boolean;
}

export interface InitiativeDependency {
  id: string;
  description: string;
  type: "INTERNAL" | "EXTERNAL" | "DECISION";
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "BLOCKED";
  depends_on_id?: string;
  depends_on_title?: string;
  resolved_at?: string;
  created_at: string;
}

export interface Initiative {
  id: string;
  organization_id: string;
  cycle_id?: string;
  team_id?: string;
  owner_id?: string;
  sprint_id?: string;
  code?: string | null;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  progress: number;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  owner_avatar?: string;
  team_name?: string;
  is_overdue: boolean;
  days_overdue: number;
  milestones: Milestone[];
  key_results: InitiativeKr[];
  total_milestones: number;
  completed_milestones: number;
  // Areas
  primary_area_id?: string;
  primary_area_name?: string;
  primary_area_color?: string;
  involved_areas: InitiativeArea[];
  // Dependencies
  dependencies: InitiativeDependency[];
  open_dependencies_count: number;
}

export interface InitiativeHealth {
  status: string;
  health: "COMPLETED" | "CANCELLED" | "OVERDUE" | "AT_RISK" | "ON_TRACK" | "BEHIND";
  progress: number;
  days_overdue: number;
  completion_rate: number;
  total_milestones: number;
  completed_milestones: number;
  overdue_milestones: number;
  blocking_milestones: Milestone[];
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useInitiatives(filters?: { cycle_id?: string; team_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.cycle_id) params.set("cycle_id", filters.cycle_id);
  if (filters?.team_id)  params.set("team_id",  filters.team_id);
  if (filters?.status)   params.set("status",   filters.status);

  const qs = params.toString();
  return useQuery<Initiative[]>({
    queryKey: ["initiatives", filters],
    queryFn: async () => {
      const res = await api.get<Initiative[]>(`/initiatives${qs ? `?${qs}` : ""}`);
      return res ?? [];
    },
  });
}

export function useInitiative(id: string | null) {
  return useQuery<Initiative>({
    queryKey: ["initiative", id],
    queryFn: () => api.get<Initiative>(`/initiatives/${id}`),
    enabled: !!id,
  });
}

export function useInitiativeHealth(id: string | null) {
  return useQuery<InitiativeHealth>({
    queryKey: ["initiative-health", id],
    queryFn: () => api.get<InitiativeHealth>(`/initiatives/${id}/health`),
    enabled: !!id,
  });
}

export interface ObjectiveInitiativeLink {
  objective_id: string;
  initiative_id: string;
  initiative_title: string;
  initiative_status: string;
  initiative_progress: number;
  initiative_code: string | null;
}

export function useObjectiveInitiativeLinks() {
  return useQuery<ObjectiveInitiativeLink[]>({
    queryKey: ["initiative-objective-links"],
    queryFn: async () => {
      const res = await api.get<ObjectiveInitiativeLink[]>('/initiatives/objective-links');
      return res ?? [];
    },
    staleTime: 60_000,
  });
}

export function useKrInitiatives(krId: string | null) {
  return useQuery<Initiative[]>({
    queryKey: ["kr-initiatives", krId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/key-results/${krId}/initiatives`);
      return res ?? [];
    },
    enabled: !!krId,
  });
}

export function useOverdueMilestones() {
  return useQuery<any[]>({
    queryKey: ["overdue-milestones"],
    queryFn: async () => {
      const res = await api.get<any[]>(`/initiatives/overdue-milestones`);
      return res ?? [];
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      cycle_id?: string;
      team_id?: string;
      owner_id?: string;
      start_date?: string;
      due_date?: string;
      kr_ids?: string[];
      primary_area_id?: string;
      involved_area_ids?: string[];
    }) => api.post<Initiative>("/initiatives", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  });
}

export function useUpdateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; description?: string; status?: string; start_date?: string; due_date?: string; owner_id?: string }) =>
      api.patch<Initiative>(`/initiatives/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiatives"] });
      qc.invalidateQueries({ queryKey: ["initiative", vars.id] });
    },
  });
}

export function useDeleteInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/initiatives/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["initiatives"] }),
  });
}

export function useLinkKr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, krId }: { initiativeId: string; krId: string }) =>
      api.post<Initiative>(`/initiatives/${initiativeId}/key-results/${krId}`, {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["kr-initiatives"] });
    },
  });
}

export function useUnlinkKr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, krId }: { initiativeId: string; krId: string }) =>
      api.delete<Initiative>(`/initiatives/${initiativeId}/key-results/${krId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["kr-initiatives"] });
    },
  });
}

// ── Milestone mutations ──────────────────────────────────────────────────────

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, ...data }: { initiativeId: string; title: string; description?: string; due_date?: string; assignee_id?: string; sort_order?: number }) =>
      api.post<Milestone>(`/initiatives/${initiativeId}/milestones`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, milestoneId, ...data }: { initiativeId: string; milestoneId: string; [k: string]: any }) =>
      api.patch<Milestone>(`/initiatives/${initiativeId}/milestones/${milestoneId}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}

export function useCompleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, milestoneId }: { initiativeId: string; milestoneId: string }) =>
      api.post<Milestone>(`/initiatives/${initiativeId}/milestones/${milestoneId}/complete`, {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, milestoneId }: { initiativeId: string; milestoneId: string }) =>
      api.delete<void>(`/initiatives/${initiativeId}/milestones/${milestoneId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}

// ── Areas ────────────────────────────────────────────────────────────────────

export function useSetInitiativeAreas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, primary_area_id, involved_area_ids }: { id: string; primary_area_id?: string; involved_area_ids?: string[] }) =>
      api.patch<Initiative>(`/initiatives/${id}/areas`, { primary_area_id, involved_area_ids }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.id] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}

// ── Dependencies ─────────────────────────────────────────────────────────────

export function useAddDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, description, type, depends_on_id }: {
      initiativeId: string; description: string; type: string; depends_on_id?: string;
    }) =>
      api.post<InitiativeDependency>(`/initiatives/${initiativeId}/dependencies`, { description, type, depends_on_id }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}

export function useUpdateDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, depId, status, description }: {
      initiativeId: string; depId: string; status?: string; description?: string;
    }) =>
      api.patch<InitiativeDependency>(`/initiatives/${initiativeId}/dependencies/${depId}`, { status, description }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}

export function useDeleteDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ initiativeId, depId }: { initiativeId: string; depId: string }) =>
      api.delete<void>(`/initiatives/${initiativeId}/dependencies/${depId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["initiative", vars.initiativeId] });
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    },
  });
}
