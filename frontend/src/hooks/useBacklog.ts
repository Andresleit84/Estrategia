"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export type BacklogType     = "EPIC" | "FEATURE" | "STORY";
export type BacklogStatus   = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type BacklogPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface BacklogItem {
  id:                   string;
  organization_id:      string;
  type:                 BacklogType;
  title:                string;
  description?:         string;
  acceptance_criteria?: string;
  status:               BacklogStatus;
  priority:             BacklogPriority;
  story_points?:        number;
  parent_id?:           string;
  parent_title?:        string;
  parent_type?:         BacklogType;
  initiative_id?:       string;
  initiative_title?:    string;
  sprint_id?:           string;
  sprint_name?:         string;
  assignee_id?:         string;
  assignee_name?:       string;
  cycle_id?:            string;
  cycle_name?:          string;
  created_by?:          string;
  created_at:           string;
  updated_at:           string;
  // Computed
  children_count:       number;
  completed_children:   number;
  total_story_points:   number;
  done_story_points:    number;
  progress:             number;
  code?:                string | null;
  parent_code?:         string | null;
  // Tree children (only in tree view)
  children?:            BacklogItem[];
}

export interface BacklogStats {
  total:        number;
  epics:        number;
  features:     number;
  stories:      number;
  done:         number;
  in_progress:  number;
  total_points: number;
  done_points:  number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useBacklogList(filters?: {
  type?:          BacklogType;
  status?:        BacklogStatus;
  priority?:      BacklogPriority;
  initiative_id?: string;
  cycle_id?:      string;
  sprint_id?:     string | null;
}) {
  const params = new URLSearchParams();
  if (filters?.type)          params.set("type",          filters.type);
  if (filters?.status)        params.set("status",        filters.status);
  if (filters?.priority)      params.set("priority",      filters.priority);
  if (filters?.initiative_id) params.set("initiative_id", filters.initiative_id);
  if (filters?.cycle_id)      params.set("cycle_id",      filters.cycle_id);
  if (filters?.sprint_id !== undefined) params.set("sprint_id", filters.sprint_id === null ? "null" : filters.sprint_id);
  const qs = params.toString();

  return useQuery<BacklogItem[]>({
    queryKey: ["backlog", filters],
    queryFn:  () => api.get(`/backlog${qs ? `?${qs}` : ""}`),
    staleTime: 60_000,
  });
}

export function useBacklogTree(filters?: { initiative_id?: string; cycle_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.initiative_id) params.set("initiative_id", filters.initiative_id);
  if (filters?.cycle_id)      params.set("cycle_id",      filters.cycle_id);
  const qs = params.toString();

  return useQuery<BacklogItem[]>({
    queryKey: ["backlog-tree", filters],
    queryFn:  () => api.get(`/backlog/tree${qs ? `?${qs}` : ""}`),
    staleTime: 60_000,
  });
}

export function useBacklogStats(filters?: { initiative_id?: string; cycle_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.initiative_id) params.set("initiative_id", filters.initiative_id);
  if (filters?.cycle_id)      params.set("cycle_id",      filters.cycle_id);
  const qs = params.toString();

  return useQuery<BacklogStats>({
    queryKey: ["backlog-stats", filters],
    queryFn:  () => api.get(`/backlog/stats${qs ? `?${qs}` : ""}`),
    staleTime: 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateBacklogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type:                 BacklogType;
      title:                string;
      description?:         string;
      acceptance_criteria?: string;
      priority?:            BacklogPriority;
      story_points?:        number;
      parent_id?:           string;
      initiative_id?:       string;
      sprint_id?:           string;
      assignee_id?:         string;
      cycle_id?:            string;
    }) => api.post<BacklogItem>("/backlog", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog"] });
      qc.invalidateQueries({ queryKey: ["backlog-tree"] });
      qc.invalidateQueries({ queryKey: ["backlog-stats"] });
    },
  });
}

export function useUpdateBacklogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: any }) =>
      api.patch<BacklogItem>(`/backlog/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog"] });
      qc.invalidateQueries({ queryKey: ["backlog-tree"] });
      qc.invalidateQueries({ queryKey: ["backlog-stats"] });
    },
  });
}

export function useDeleteBacklogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/backlog/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog"] });
      qc.invalidateQueries({ queryKey: ["backlog-tree"] });
      qc.invalidateQueries({ queryKey: ["backlog-stats"] });
    },
  });
}

// ── My impact chain ───────────────────────────────────────────────────────────

export type ImpactNodeType =
  | "STORY" | "FEATURE" | "EPIC"
  | "INITIATIVE"
  | "KR"
  | "OBJECTIVE_TEAM" | "OBJECTIVE_AREA" | "OBJECTIVE_COMPANY" | "OBJECTIVE_INDIVIDUAL"
  | "INTENT"
  | "VISION";

export interface ImpactNode {
  type:        ImpactNodeType;
  id?:         string;
  code?:       string;
  title:       string;
  status?:     string;
  progress?:   number;
  confidence?: number;
  category?:   string;
  href:        string;
}

export interface MyImpactChain {
  nodes:    ImpactNode[];
  complete: boolean;
}

export interface MyActiveItem {
  id:       string;
  code:     string;
  title:    string;
  type:     string;
  status:   string;
  priority: string;
}

export function useMyItems() {
  return useQuery({
    queryKey: ["backlog", "my-items"],
    queryFn:  () => api.get<MyActiveItem[]>("/backlog/my-items"),
    staleTime: 5 * 60_000,
  });
}

export function useMyImpact(itemId?: string) {
  return useQuery({
    queryKey: ["backlog", "my-impact", itemId ?? "auto"],
    queryFn:  () => api.get<MyImpactChain>(
      itemId ? `/backlog/my-impact?item_id=${itemId}` : "/backlog/my-impact",
    ),
    staleTime: 5 * 60_000,
  });
}
