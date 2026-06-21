"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type AgreementStatus = "OPEN" | "PENDING" | "IN_PROGRESS" | "TRACKING" | "EVIDENCE" | "FULFILLED" | "CLOSED" | "ESCALATED" | "CANCELLED";
export type AgreementPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Agreement {
  id: string;
  organization_id: string;
  cycle_id: string | null;
  code: string;
  title: string;
  description: string | null;
  source: string | null;
  agreement_date: string | null;
  due_date: string | null;
  status: AgreementStatus;
  priority: AgreementPriority;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  completion_notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  cycle_name: string | null;
  is_overdue: boolean;
  linked_items_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgreementStats {
  total: number;
  pending: number;
  in_progress: number;
  fulfilled: number;
  cancelled: number;
  overdue: number;
}

export function useAgreements(status?: string) {
  return useQuery<Agreement[]>({
    queryKey: ["agreements", status ?? "all"],
    queryFn: () => api.get(`/agreements${status ? `?status=${status}` : ""}`),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAgreementStats(options?: { enabled?: boolean }) {
  return useQuery<AgreementStats>({
    queryKey: ["agreements", "stats"],
    queryFn: () => api.get("/agreements/stats"),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useAgreement(id: string | null) {
  return useQuery<Agreement>({
    queryKey: ["agreements", id],
    queryFn: () => api.get(`/agreements/${id}`),
    enabled: !!id,
  });
}

export function useCreateAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      source?: string;
      agreement_date?: string;
      due_date?: string;
      priority?: AgreementPriority;
      cycle_id?: string;
      owner_id?: string;
    }) => api.post("/agreements", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agreements"] });
    },
  });
}

export function useUpdateAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      title?: string;
      description?: string;
      source?: string;
      agreement_date?: string;
      due_date?: string;
      priority?: AgreementPriority;
      status?: AgreementStatus;
      cycle_id?: string;
      owner_id?: string;
      completion_notes?: string;
    }) => api.patch(`/agreements/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agreements"] });
    },
  });
}

export function useDeleteAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agreements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agreements"] });
    },
  });
}

export interface EpicSuggestion {
  epic_title: string | null;
  epic_description: string | null;
  suggested_objective_id: string | null;
  suggested_objective_title: string | null;
  rationale: string;
}

export function useConvertAgreementToEpic() {
  return useMutation<EpicSuggestion, Error, string>({
    mutationFn: (agreement_id: string) =>
      api.post("/ai/convert-agreement-epic", { agreement_id }),
  });
}

export interface AgreementLink {
  agreement_id: string;
  backlog_item_id: string;
}

export function useAgreementLinks() {
  return useQuery<AgreementLink[]>({
    queryKey: ["agreements", "links"],
    queryFn: () => api.get("/agreements/links"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnlinkAgreementItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agreementId, backlogItemId }: { agreementId: string; backlogItemId: string }) =>
      api.delete(`/agreements/${agreementId}/items/${backlogItemId}`),
    onSuccess: (_, { agreementId }) => {
      qc.invalidateQueries({ queryKey: ["agreements"] });
      qc.invalidateQueries({ queryKey: ["agreements", agreementId, "items"] });
      qc.invalidateQueries({ queryKey: ["agreements", "links"] });
    },
  });
}

export function useLinkAgreementItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agreementId, backlogItemId }: { agreementId: string; backlogItemId: string }) =>
      api.post(`/agreements/${agreementId}/items`, { backlog_item_id: backlogItemId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agreements"] });
      qc.invalidateQueries({ queryKey: ["agreements", "links"] });
    },
  });
}
