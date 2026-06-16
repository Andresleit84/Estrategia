"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ConsultantClientHealth {
  org_id: string;
  org_name: string;
  cycle_id: string | null;
  cycle_name: string | null;
  cycle_score: number | null;
  active_objectives: number;
  on_track: number;
  at_risk: number;
  completed: number;
  krs_at_risk: number;
  digest_enabled: boolean;
  client_alerts_enabled: boolean;
  linked_at: string;
}

export function useConsultantClients() {
  return useQuery({
    queryKey: ["consultant", "clients"],
    queryFn: () => api.get<ConsultantClientHealth[]>("/consultant/clients"),
    staleTime: 60_000,
  });
}

export function useAddConsultantClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => api.post("/consultant/clients", { org_id: orgId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultant"] }),
  });
}

export function useRemoveConsultantClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => api.delete(`/consultant/clients/${orgId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultant"] }),
  });
}

export function useToggleConsultantDigest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, enabled }: { orgId: string; enabled: boolean }) =>
      api.put(`/consultant/clients/${orgId}/digest`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultant"] }),
  });
}

export function useToggleClientAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, enabled }: { orgId: string; enabled: boolean }) =>
      api.put(`/consultant/clients/${orgId}/client-alerts`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultant"] }),
  });
}

export function useTriggerConsultantDigest() {
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean; sent_channels: string[] }>("/consultant/digest/trigger", {}),
  });
}
