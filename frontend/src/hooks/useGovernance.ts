"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface GovMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role_label?: string;
  sort_order: number;
}

export interface GovernanceBody {
  id: string;
  org_id: string;
  name: string;
  type: "CONSEJO" | "COMITE" | "DIRECTORIO" | "JUNTA" | "ASAMBLEA" | "OTHER";
  description?: string;
  sort_order: number;
  member_count: number;
  members: GovMember[];
  created_at: string;
  updated_at: string;
}

export const BODY_TYPE_LABELS: Record<GovernanceBody["type"], string> = {
  CONSEJO:    "Consejo",
  COMITE:     "Comité",
  DIRECTORIO: "Directorio",
  JUNTA:      "Junta",
  ASAMBLEA:   "Asamblea",
  OTHER:      "Otro",
};

export function useGovernanceBodies() {
  return useQuery<GovernanceBody[]>({
    queryKey: ["governance"],
    queryFn: async () => {
      const res = await api.get<GovernanceBody[]>("/governance");
      return res ?? [];
    },
  });
}

export function useCreateGovernanceBody() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: GovernanceBody["type"]; description?: string }) =>
      api.post<GovernanceBody>("/governance", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance"] }),
  });
}

export function useUpdateGovernanceBody() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; type?: GovernanceBody["type"]; description?: string }) =>
      api.patch<GovernanceBody>(`/governance/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance"] }),
  });
}

export function useDeleteGovernanceBody() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/governance/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance"] }),
  });
}

export function useAddGovernanceMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bodyId, user_id, role_label }: { bodyId: string; user_id: string; role_label?: string }) =>
      api.post<GovernanceBody>(`/governance/${bodyId}/members`, { user_id, role_label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance"] }),
  });
}

export function useRemoveGovernanceMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bodyId, userId }: { bodyId: string; userId: string }) =>
      api.delete<GovernanceBody>(`/governance/${bodyId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance"] }),
  });
}
