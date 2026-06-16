"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  mode: string;
  created_at: string;
  trial_starts_at?: string | null;
  trial_expires_at?: string | null;
  member_count: number;
  active_cycles: number;
  objective_count: number;
}

export function useAdminOrgs() {
  return useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: () => api.get<OrgSummary[]>("/admin/organizations"),
    staleTime: 30_000,
  });
}

export function useUpdateOrgPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, plan, periodStart, periodEnd, notes }: {
      orgId: string; plan: string; periodStart?: string; periodEnd?: string; notes?: string;
    }) =>
      api.patch<{ ok: boolean }>(`/admin/organizations/${orgId}/plan`, {
        plan,
        period_start: periodStart,
        period_end: periodEnd,
        notes,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "organizations"] }),
  });
}

export function useMyOrgs() {
  return useQuery({
    queryKey: ["auth", "my-orgs"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/auth/my-orgs"),
    staleTime: 60_000,
  });
}
