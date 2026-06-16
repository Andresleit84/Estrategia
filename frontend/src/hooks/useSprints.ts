"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SprintKr {
  kr_id: string;
  kr_title: string;
  progress: number;
  status: string;
  metric_unit?: string;
  expected_contribution: number;
}

export interface SprintInitiative {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  progress: number;
  is_overdue: boolean;
  team_name?: string;
  owner_name?: string;
  due_date?: string;
  total_milestones: number;
  completed_milestones: number;
}

export interface Sprint {
  sprint_id: string;
  organization_id: string;
  cycle_id: string;
  team_id: string;
  team_name: string;
  sprint_name: string;
  sprint_code?: string | null;
  goal?: string;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  start_date: string;
  end_date: string;
  planned_velocity: number;
  actual_velocity: number;
  sprint_num?: number;
  initiative_count?: number;
  kr_count?: number;
  created_at: string;
}

export interface SprintBoard extends Sprint {
  sprint_krs: SprintKr[];
  initiatives: SprintInitiative[];
  todo_count: number;
  in_progress_count: number;
  done_count: number;
  total_count: number;
}

export interface BurnupPoint {
  sprint_id: string;
  sprint_name: string;
  sprint_num: number;
  end_date: string;
  status: string;
  ideal_progress: number;
  actual_progress: number;
  planned_velocity: number;
  actual_velocity: number;
}

export interface OkrImpact {
  sprint_id: string;
  sprint_name: string;
  status: string;
  start_date: string;
  end_date: string;
  key_results: Array<{
    kr_id: string;
    kr_title: string;
    metric_unit?: string;
    expected_contribution: number;
    current_progress: number;
    progress_at_start: number;
    actual_contribution: number;
  }>;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useSprints(filters?: { cycle_id?: string; team_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.cycle_id) params.set("cycle_id", filters.cycle_id);
  if (filters?.team_id)  params.set("team_id",  filters.team_id);
  if (filters?.status)   params.set("status",   filters.status);

  const qs = params.toString();
  return useQuery<Sprint[]>({
    queryKey: ["sprints", filters],
    queryFn: async () => {
      const res = await api.get<Sprint[]>(`/sprints${qs ? `?${qs}` : ""}`);
      return res ?? [];
    },
  });
}

export function useSprintBoard(sprintId: string | null) {
  return useQuery<SprintBoard>({
    queryKey: ["sprints", sprintId, "board"],
    queryFn: () => api.get<SprintBoard>(`/sprints/${sprintId}`),
    enabled: !!sprintId,
  });
}

export function useActiveSprintForTeam(teamId: string | null) {
  return useQuery<SprintBoard | null>({
    queryKey: ["sprints", "active", teamId],
    queryFn: () => api.get<SprintBoard | null>(`/sprints/active?team_id=${teamId}`),
    enabled: !!teamId,
  });
}

export function useSprintOkrImpact(sprintId: string | null) {
  return useQuery<OkrImpact>({
    queryKey: ["sprints", sprintId, "okr-impact"],
    queryFn: () => api.get<OkrImpact>(`/sprints/${sprintId}/okr-impact`),
    enabled: !!sprintId,
  });
}

export function useBurnup(cycleId: string | null, teamId: string | null) {
  return useQuery<BurnupPoint[]>({
    queryKey: ["burnup", cycleId, teamId],
    queryFn: async () => {
      const res = await api.get<BurnupPoint[]>(`/cycles/${cycleId}/sprints/burnup?team_id=${teamId}`);
      return res ?? [];
    },
    enabled: !!(cycleId && teamId),
  });
}

export function useSprintVelocity(teamId: string | null) {
  return useQuery<Sprint[]>({
    queryKey: ["velocity", teamId],
    queryFn: async () => {
      const res = await api.get<Sprint[]>(`/teams/${teamId}/velocity`);
      return res ?? [];
    },
    enabled: !!teamId,
  });
}

export function useSprintTimeline(cycleId: string | null, teamId?: string) {
  const qs = teamId ? `?team_id=${teamId}` : "";
  return useQuery<Sprint[]>({
    queryKey: ["sprint-timeline", cycleId, teamId],
    queryFn: async () => {
      const res = await api.get<Sprint[]>(`/cycles/${cycleId}/sprints/timeline${qs}`);
      return res ?? [];
    },
    enabled: !!cycleId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      cycle_id: string;
      team_id: string;
      name: string;
      goal?: string;
      start_date: string;
      end_date: string;
      planned_velocity?: number;
    }) => api.post<SprintBoard>("/sprints", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name?: string; goal?: string; start_date?: string; end_date?: string; planned_velocity?: number }) =>
      api.patch<SprintBoard>(`/sprints/${id}`, dto),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["sprints", vars.id] });
    },
  });
}

export function useActivateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) => api.post<SprintBoard>(`/sprints/${sprintId}/activate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });
}

export function useCloseSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, velocity }: { id: string; velocity?: number }) =>
      api.post<{ sprint: SprintBoard; suggested_checkins: unknown[] }>(`/sprints/${id}/close`, { velocity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["burnup"] });
      qc.invalidateQueries({ queryKey: ["velocity"] });
    },
  });
}

export function useGenerateSprints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      cycle_id: string;
      team_id: string;
      sprint_length_weeks: number;
      planned_velocity?: number;
      start_from?: string;
    }) => api.post<Sprint[]>("/sprints/generate", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) => api.delete(`/sprints/${sprintId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });
}

export function useLinkKrToSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, kr_id, expected_contribution }: { sprintId: string; kr_id: string; expected_contribution?: number }) =>
      api.post<SprintBoard>(`/sprints/${sprintId}/krs`, { kr_id, expected_contribution }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["sprints", vars.sprintId] }),
  });
}

export function useUnlinkKrFromSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, krId }: { sprintId: string; krId: string }) =>
      api.delete(`/sprints/${sprintId}/krs/${krId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["sprints", vars.sprintId] }),
  });
}
