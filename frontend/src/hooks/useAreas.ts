"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface AreaTeam {
  id: string;
  name: string;
  description?: string;
  is_root: boolean;
  area_id?: string;
  member_count: number;
}

export interface Area {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  manager_id?: string;
  manager_name?: string;
  manager_avatar?: string;
  color: string;
  sort_order: number;
  team_count: number;
  member_count: number;
  teams: AreaTeam[];
  created_at: string;
  updated_at: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: string;
}

export function useAreas() {
  return useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: async () => {
      const res = await api.get<Area[]>("/areas");
      return res ?? [];
    },
  });
}

export function useOrgUsers() {
  return useQuery<OrgUser[]>({
    queryKey: ["areas", "users"],
    queryFn: async () => {
      const res = await api.get<OrgUser[]>("/areas/users");
      return res ?? [];
    },
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; manager_id?: string; color?: string }) =>
      api.post<Area>("/areas", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useUpdateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; manager_id?: string; color?: string }) =>
      api.patch<Area>(`/areas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/areas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  });
}

export function useAssignTeamToArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ areaId, teamId }: { areaId: string; teamId: string }) =>
      api.post<Area>(`/areas/${areaId}/teams/${teamId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useRemoveTeamFromArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ areaId, teamId }: { areaId: string; teamId: string }) =>
      api.delete<void>(`/areas/${areaId}/teams/${teamId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
