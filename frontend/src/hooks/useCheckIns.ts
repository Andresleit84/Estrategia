"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface CheckIn {
  id: string;
  kr_id: string;
  user_id: string;
  checked_at: string;
  current_value: number;
  confidence: number;
  notes?: string;
  mood?: string;
  kr_title: string;
  metric_unit: string;
  target_value: number;
  start_value: number;
  kr_type: string;
  checked_by_name: string;
  prev_value?: number;
  delta?: number;
}

export interface AtRiskKr {
  id: string;
  kr_title: string;
  kr_code?: string | null;
  metric_unit: string;
  current_value: number;
  target_value: number;
  progress: number;
  confidence: number;
  status: string;
  last_checkin_at?: string;
  days_since_checkin: number;
  owner_name?: string;
  objective_id: string;
  objective_title: string;
  obj_code?: string | null;
  objective_level: string;
  cycle_id: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
  read_at?: string;
  created_at: string;
}

export function useCheckInHistory(krId: string | null) {
  return useQuery<CheckIn[]>({
    queryKey: ["check-in-history", krId],
    queryFn: () => api.get(`/key-results/${krId}/check-ins`),
    enabled: !!krId,
    staleTime: 30_000,
  });
}

export function useCreateCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      krId,
      ...data
    }: {
      krId: string;
      current_value: number;
      confidence: number;
      notes?: string;
      mood?: string;
    }) => api.post(`/key-results/${krId}/check-ins`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["check-in-history", vars.krId] });
      qc.invalidateQueries({ queryKey: ["key-results"] });
      qc.invalidateQueries({ queryKey: ["objectives"] });
      qc.invalidateQueries({ queryKey: ["at-risk-krs"] });
      qc.invalidateQueries({ queryKey: ["cadence-dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["reports", "welcome-context"] });
      qc.invalidateQueries({ queryKey: ["active-cycle"] });
    },
  });
}

export function useAtRiskKrs(cycleId?: string) {
  return useQuery<AtRiskKr[]>({
    queryKey: ["at-risk-krs", cycleId],
    queryFn: () => api.get(`/at-risk-krs${cycleId ? `?cycle_id=${cycleId}` : ""}`),
    staleTime: 2 * 60_000,
  });
}

export function useCadenceDashboard(cycleId: string | null) {
  return useQuery({
    queryKey: ["cadence-dashboard", cycleId],
    queryFn: () => api.get(`/cadence-dashboard?cycle_id=${cycleId}`),
    enabled: !!cycleId,
    staleTime: 2 * 60_000,
  });
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch("/notifications/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export interface KrForecast {
  // Legacy — backward-compatible with fn_predict_kr_completion
  trend: "up" | "down" | "flat";
  probability: number;
  projected_date: string | null;
  projected_value: number;
  data_points: number;
  insufficient_data: boolean;
  // WOW-3 enriched fields
  action_type: "COMPLETED" | "ON_TRACK" | "INCREASE_PACE" | "URGENT_CHECKIN" | "INSUFFICIENT_DATA";
  pace_current_per_day: number;
  pace_needed_per_day: number;
  pace_ratio: number;
  projected_value_at_cycle_end: number;
  projected_completion_pct: number;
  gap_units: number;
  gap_pct: number;
  days_remaining: number;
  weeks_remaining: number;
  is_on_pace: boolean;
  recommended_checkins_per_week: number;
  value_needed_per_checkin: number;
  scenario_optimistic_pct: number;
  scenario_base_pct: number;
  scenario_pessimistic_pct: number;
  days_since_last_checkin: number;
  cadence_days: number;
  metric_unit: string;
  kr_type: string;
}

export function useKrPrediction(krId: string | null) {
  return useQuery<KrForecast | null>({
    queryKey: ["kr-prediction", krId],
    queryFn: () => api.get<KrForecast | null>(`/key-results/${krId}/predict`),
    enabled: !!krId,
    staleTime: 5 * 60_000,
  });
}

export interface CheckinAssistantResult {
  suggestion: string | null;
  questions: string[];
  question: string | null;
}

export function useCheckinAssistant() {
  return useMutation({
    mutationFn: (data: { kr_id: string; current_value: number; confidence: number }) =>
      api.post<CheckinAssistantResult>("/ai/checkin-assistant", data),
  });
}

export function useCheckinSummary() {
  return useMutation({
    mutationFn: (checkInId: string) =>
      api.post<{ summary: string | null }>(`/ai/checkin-summary/${checkInId}`, {}),
  });
}
