"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface TeamNode {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  parent_team_id: string | null;
  owner_id: string | null;
  owner_name: string | null;
  is_root: boolean;
  depth: number;
  member_count: number;
}

export interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  org_role: string;
  role: string;
  joined_at: string;
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<TeamNode[]>('/teams'),
  });
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => api.get<TeamMember[]>(`/teams/${teamId}/members`),
    enabled: !!teamId,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; parentTeamId?: string }) =>
      api.post('/teams', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId, role }: { teamId: string; userId: string; role?: string }) =>
      api.post(`/teams/${teamId}/members`, { user_id: userId, role }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['teams', vars.teamId, 'members'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      api.delete(`/teams/${teamId}/members/${userId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['teams', vars.teamId, 'members'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
