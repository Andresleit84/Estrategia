"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface PlanningItem {
  id: string;
  session_id: string;
  stage: number;
  title: string;
  description: string | null;
  assignee: string | null;
  due_date: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  item_type: "ARTIFACT" | "ACTION" | "DECISION" | "RISK";
  sort_order: number;
  created_at: string;
}

export interface PlanningDependency {
  id: string;
  session_id: string;
  from_area: string;
  to_area: string;
  description: string | null;
  status: "OPEN" | "RESOLVED" | "ESCALATED" | "DEFERRED";
  owner: string | null;
  created_at: string;
}

export interface PlanningCapacity {
  id: string;
  session_id: string;
  area: string;
  objective_title: string | null;
  total_people: number;
  allocated: number;
  notes: string | null;
  created_at: string;
}

// ─── Items ───────────────────────────────────────────────────

function itemsKey(sessionId: string, stage: number) {
  return ["planning", "items", sessionId, stage];
}

export function usePlanningItems(sessionId: string | undefined, stage: number) {
  return useQuery<PlanningItem[]>({
    queryKey: itemsKey(sessionId ?? "", stage),
    queryFn: () =>
      api.get<PlanningItem[]>(`/planning/sessions/${sessionId}/items?stage=${stage}`),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

export function useUpsertPlanningItem(sessionId: string, stage: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PlanningItem> & { session_id: string; stage: number; title: string }) =>
      body.id
        ? api.patch(`/planning/items/${body.id}`, body)
        : api.post("/planning/items", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: itemsKey(sessionId, stage) }),
  });
}

export function useMovePlanningItem(sessionId: string, stage: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/planning/items/${id}/move`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: itemsKey(sessionId, stage) }),
  });
}

export function useDeletePlanningItem(sessionId: string, stage: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/planning/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: itemsKey(sessionId, stage) }),
  });
}

// ─── Dependencies ─────────────────────────────────────────────

function depsKey(sessionId: string) {
  return ["planning", "deps", sessionId];
}

export function usePlanningDependencies(sessionId: string | undefined) {
  return useQuery<PlanningDependency[]>({
    queryKey: depsKey(sessionId ?? ""),
    queryFn: () =>
      api.get<PlanningDependency[]>(`/planning/sessions/${sessionId}/dependencies`),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

export function useUpsertDependency(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PlanningDependency> & { session_id: string; from_area: string; to_area: string }) =>
      body.id
        ? api.patch(`/planning/dependencies/${body.id}`, body)
        : api.post("/planning/dependencies", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: depsKey(sessionId) }),
  });
}

export function useDeleteDependency(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/planning/dependencies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: depsKey(sessionId) }),
  });
}

// ─── Capacity ─────────────────────────────────────────────────

function capKey(sessionId: string) {
  return ["planning", "capacity", sessionId];
}

export function usePlanningCapacity(sessionId: string | undefined) {
  return useQuery<PlanningCapacity[]>({
    queryKey: capKey(sessionId ?? ""),
    queryFn: () =>
      api.get<PlanningCapacity[]>(`/planning/sessions/${sessionId}/capacity`),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

export function useUpsertCapacity(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PlanningCapacity> & { session_id: string; area: string }) =>
      body.id
        ? api.patch(`/planning/capacity/${body.id}`, body)
        : api.post("/planning/capacity", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: capKey(sessionId) }),
  });
}

export function useDeleteCapacity(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/planning/capacity/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: capKey(sessionId) }),
  });
}
