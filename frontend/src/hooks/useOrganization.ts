"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  org_role: string;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  teams: Array<{ team_id: string; team_name: string; role: string }>;
}

export function useOrganization() {
  return useQuery({
    queryKey: ['organization', 'me'],
    queryFn: () => api.get<Record<string, unknown>>('/organizations/me'),
  });
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ['organization', 'members'],
    queryFn: () => api.get<OrgMember[]>('/organizations/me/members'),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; mode?: string; settings?: Record<string, unknown>; sector?: string }) =>
      api.patch('/organizations/me', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export function useInvitations() {
  return useQuery({
    queryKey: ['organization', 'invitations'],
    queryFn: () => api.get<Invitation[]>('/organizations/me/invitations'),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      api.post('/organizations/me/invitations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization', 'invitations'] }),
  });
}

export function useResendInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/organizations/me/invitations/${id}/resend`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization', 'invitations'] }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/organizations/me/members/${userId}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization', 'members'] }),
  });
}

export function useResetMemberPassword() {
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<{ newPassword: string }>(`/organizations/me/members/${userId}/reset-password`, {}),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/organizations/me/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization', 'members'] }),
  });
}

export function useSendResetEmail() {
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<{ ok: boolean }>(`/organizations/me/members/${userId}/send-reset-email`, {}),
  });
}
