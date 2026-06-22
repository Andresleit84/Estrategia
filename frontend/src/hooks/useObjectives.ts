"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Objective {
  id: string;
  organization_id: string;
  cycle_id: string;
  parent_objective_id: string | null;
  strategic_intent_id: string | null;
  owner_id: string | null;
  team_id: string | null;
  title: string;
  description: string | null;
  level: "COMPANY" | "AREA" | "TEAM" | "INDIVIDUAL";
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  progress: number;
  kr_count: number;
  owner_name: string | null;
  owner_email: string | null;
  team_name: string | null;
  created_at: string;
  updated_at: string;
  code: string | null;
}

export interface AlignmentObjNode {
  id: string;
  title: string;
  progress: number;
  status: string;
  owner: string | null;
}

export interface AlignmentTeamNode extends AlignmentObjNode {
  team_name: string | null;
  individual_objectives: AlignmentObjNode[];
}

export interface AlignmentAreaNode extends AlignmentObjNode {
  team_objectives: AlignmentTeamNode[];
}

export interface AlignmentMapEntry {
  company_obj_id: string;
  organization_id: string;
  cycle_id: string;
  company_title: string;
  company_progress: number;
  company_status: string;
  company_owner: string | null;
  area_objectives: AlignmentAreaNode[];
  area_count: number;
  team_count: number;
  individual_count: number;
}

export function useObjectives(
  cycleId?: string,
  level?: string,
  filters?: { status?: string; owner_id?: string; team_id?: string },
) {
  const params = new URLSearchParams();
  if (cycleId)              params.set("cycle_id", cycleId);
  if (level)                params.set("level", level);
  if (filters?.status)      params.set("status", filters.status);
  if (filters?.owner_id)    params.set("owner_id", filters.owner_id);
  if (filters?.team_id)     params.set("team_id", filters.team_id);
  const qs = params.toString();

  return useQuery<Objective[]>({
    queryKey: ["objectives", cycleId, level, filters],
    queryFn: () => api.get(`/objectives${qs ? `?${qs}` : ""}`),
    enabled: !!cycleId,
    staleTime: 2 * 60 * 1000,
  });
}

// Trae todos los objetivos del org en una sola llamada. Permite cargar en paralelo
// con cycles sin depender secuencialmente de que cycles cargue primero.
export function useAllObjectives() {
  return useQuery<Objective[]>({
    queryKey: ["objectives", "all"],
    queryFn: () => api.get("/objectives"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useObjective(id: string | null) {
  return useQuery<Objective>({
    queryKey: ["objectives", id],
    queryFn: () => api.get(`/objectives/${id}`),
    enabled: !!id,
  });
}

export function useAlignmentMap(cycleId: string | null) {
  return useQuery<AlignmentMapEntry[]>({
    queryKey: ["objectives", "alignment", cycleId],
    queryFn: () => api.get(`/objectives/alignment?cycle_id=${cycleId}`),
    enabled: !!cycleId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      level?: string;
      cycle_id: string;
      parent_objective_id?: string;
      owner_id?: string;
      team_id?: string;
      strategic_intent_id?: string;
    }) => api.post("/objectives", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objectives"] });
      qc.invalidateQueries({ queryKey: ["cycles"] });
      qc.invalidateQueries({ queryKey: ["setup-status"] });
    },
  });
}

export function useUpdateObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; description?: string; owner_id?: string; parent_objective_id?: string | null; strategic_intent_id?: string | null }) =>
      api.patch(`/objectives/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objectives"] });
    },
  });
}

export function useCancelObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/objectives/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objectives"] });
      qc.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
}

export function useObjectiveAlignments(objectiveId: string | null) {
  return useQuery<Objective[]>({
    queryKey: ["objectives", objectiveId, "alignments"],
    queryFn: () => api.get(`/objectives/${objectiveId}/alignments`),
    enabled: !!objectiveId,
  });
}

export function useAddAlignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.post(`/objectives/${sourceId}/alignments/${targetId}`, {}),
    onSuccess: (_d, { sourceId }) => {
      qc.invalidateQueries({ queryKey: ["objectives", sourceId, "alignments"] });
    },
  });
}

export function useRemoveAlignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.delete(`/objectives/${sourceId}/alignments/${targetId}`),
    onSuccess: (_d, { sourceId }) => {
      qc.invalidateQueries({ queryKey: ["objectives", sourceId, "alignments"] });
    },
  });
}

export interface TreeKR {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  progress: number;
  status: string;
  confidence: number;
  type: string;
  kr_category?: "RESULTADO" | "CAPACIDAD" | "BALANCE" | null;
  kpi_description?: string | null;
  gap_note?: string | null;
  recommendation?: string | null;
  refs_data?: {
    links_down?: { annual?: string[]; quarterly?: string[] };
    links_up?: string[];
    foda?: Array<{ code: string; desc: string }>;
    sugef?: Array<{ code: string; desc: string; status?: "inicial" | "atiende" }>;
    deps?: Array<{ pilar: string; rel: string }>;
  } | null;
  current_value: number;
  target_value: number;
  metric_unit: string;
  trend?: string;
}

export interface ObjectiveTreeNode {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  level: "COMPANY" | "AREA" | "TEAM" | "INDIVIDUAL";
  status: string;
  progress: number;
  parent_objective_id: string | null;
  owner_id: string | null;
  owner_name: string | null;
  team_id: string | null;
  team_name: string | null;
  kr_count: number;
  depth: number;
  key_results: TreeKR[];
}

export function useObjectiveTree(cycleId: string | null) {
  return useQuery<ObjectiveTreeNode[]>({
    queryKey: ["objectives", "tree", cycleId],
    queryFn: () => api.get(`/objectives/tree?cycle_id=${cycleId}`),
    enabled: !!cycleId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useObjectiveForest(cycleIds: string[]) {
  const q0 = useObjectiveTree(cycleIds[0] ?? null);
  const q1 = useObjectiveTree(cycleIds[1] ?? null);
  const q2 = useObjectiveTree(cycleIds[2] ?? null);
  const data = useMemo(() => {
    const all = [...(q0.data ?? []), ...(q1.data ?? []), ...(q2.data ?? [])];
    const seen = new Set<string>();
    return all.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
  }, [q0.data, q1.data, q2.data]);
  return { data, isLoading: q0.isLoading || q1.isLoading || q2.isLoading };
}
