"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AtRiskKr } from "./useCheckIns";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CadenceEntry {
  kr_id: string;
  kr_title: string;
  objective_title: string;
  objective_level: string;
  days_since_checkin: number;
  owner_name?: string;
}

export interface RiskDashboard {
  cycle: { id: string; name: string } | null;
  at_risk: AtRiskKr[];
  cadence: CadenceEntry[];
  last_sentinel_run: { content: Record<string, unknown>; created_at: string } | null;
  summary: {
    total_at_risk: number;
    company_level: number;
    stale_14d: number;
  };
}

export interface ObjectiveStat {
  code?: string;
  title: string;
  level: string;
  status: string;
  progress: number;
}

export interface ExecutiveBriefingDashboard {
  cycle: Record<string, unknown> | null;
  last_briefing: {
    id: string;
    type: string;
    title: string;
    content: Record<string, unknown>;
    created_at: string;
  } | null;
  objectives: ObjectiveStat[];
  cycle_score: number;
}

export interface AlignmentMapEntry {
  company_obj_id: string;
  company_title: string;
  company_progress: number;
  area_count: number;
  team_count: number;
  individual_count: number;
}

export interface AlignmentReport {
  cycle: { id: string; name: string } | null;
  gaps: unknown;
  alignment_map: AlignmentMapEntry[];
  last_audit: { content: Record<string, unknown>; created_at: string } | null;
  error?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useRiskDashboard(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "risk-dashboard", cycleId ?? "active"],
    queryFn: () =>
      api.get<RiskDashboard>(`/reports/risk-dashboard${cycleId ? `?cycle_id=${cycleId}` : ""}`),
  });
}

export function useExecutiveBriefingDashboard(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "executive-briefing", cycleId ?? "active"],
    queryFn: () =>
      api.get<ExecutiveBriefingDashboard>(
        `/reports/executive-briefing${cycleId ? `?cycle_id=${cycleId}` : ""}`
      ),
  });
}

export function useAlignmentReport(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "alignment", cycleId ?? "active"],
    queryFn: () =>
      api.get<AlignmentReport>(`/reports/alignment${cycleId ? `?cycle_id=${cycleId}` : ""}`),
  });
}

// ── Hito 10 ───────────────────────────────────────────────────────────────────

export interface HeatmapLevel {
  progress: number;
  count: number;
}

export interface AtRiskKrSummary {
  kr_id: string;
  kr_title: string;
  objective_title: string;
  confidence: number;
  progress: number;
  level: string;
}

export interface ExecutiveDashboard {
  organization_id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_status: string;
  cycle_score: number;
  total_objectives: number;
  completed_objectives: number;
  at_risk_krs: number;
  avg_progress: number;
  company_progress: number;
  area_progress: number;
  team_progress: number;
  heatmap: Record<string, HeatmapLevel>;
  top_at_risk_krs: AtRiskKrSummary[];
  last_updated: string;
}

export interface CycleHealth {
  cycle_id: string;
  cycle_name: string;
  cycle_status: string;
  start_date: string;
  end_date: string;
  total_objectives: number;
  draft_count: number;
  active_count: number;
  completed_count: number;
  cancelled_count: number;
  total_krs: number;
  completed_krs: number;
  at_risk_krs: number;
  avg_confidence: number;
  cycle_score: number;
  avg_progress: number;
  projected_close_date: string | null;
}

export interface TeamHealth {
  team_id: string;
  team_name: string;
  cycle_id: string;
  objective_count: number;
  avg_progress: number;
  avg_confidence: number;
  cadence_score: number;
  at_risk_count: number;
}

export interface PortfolioItem {
  id: string;
  team_id: string;
  team_name: string;
  title: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  progress_pct: number;
  owner_name: string | null;
  milestone_count: number;
  completed_milestones: number;
  is_overdue: boolean;
}

export interface WeeklyTrendPoint {
  week_number: number;
  week_start: string;
  avg_progress: number;
  checkin_count: number;
}

export interface CloseReport {
  cycle: Record<string, unknown>;
  summary: {
    total_objectives: number;
    completed: number;
    partial: number;
    missed: number;
    cancelled: number;
    completion_rate: number;
  };
  objectives: Array<Record<string, unknown>>;
  top_performers: Array<Record<string, unknown>>;
  needs_improvement: Array<Record<string, unknown>>;
  total_checkins: number;
  generated_at: string;
}

export function useExecutiveDashboard(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "executive-dashboard", cycleId ?? "active"],
    queryFn: () =>
      api.get<ExecutiveDashboard>(`/reports/executive-dashboard${cycleId ? `?cycle_id=${cycleId}` : ""}`),
    refetchInterval: 3 * 60 * 1000,
    refetchIntervalInBackground: false,
  });
}

export function useCycleHealth(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "cycle-health", cycleId ?? "active"],
    queryFn: () =>
      api.get<CycleHealth>(`/reports/cycle-health${cycleId ? `?cycle_id=${cycleId}` : ""}`),
  });
}

export function useTeamHealth(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "team-health", cycleId ?? "active"],
    queryFn: () =>
      api.get<TeamHealth[]>(`/reports/team-health${cycleId ? `?cycle_id=${cycleId}` : ""}`),
  });
}

export function usePortfolio(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "portfolio", cycleId ?? "active"],
    queryFn: () =>
      api.get<PortfolioItem[]>(`/reports/portfolio${cycleId ? `?cycle_id=${cycleId}` : ""}`),
  });
}

export interface AreaCheckinStatus {
  id: string;
  name: string;
  color: string;
  last_checkin: string | null;
  days_since: number | null;
  kr_count: number;
  checkins_last_14d: number;
}

export function useAreaCheckinStatus() {
  return useQuery({
    queryKey: ["reports", "area-checkin-status"],
    queryFn: () => api.get<AreaCheckinStatus[]>("/reports/area-checkin-status"),
    staleTime: 2 * 60 * 1000,
  });
}

export interface CommitmentRankingEntry {
  user_id: string;
  name: string;
  area_name: string | null;
  kr_count: number;
  checkins_30d: number;
  last_checkin_at: string | null;
  max_overdue_days: number;
}

export function useCommitmentRanking() {
  return useQuery({
    queryKey: ["reports", "commitment-ranking"],
    queryFn: () => api.get<CommitmentRankingEntry[]>("/reports/commitment-ranking"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useWeeklyTrend(cycleId?: string) {
  return useQuery({
    queryKey: ["reports", "weekly-trend", cycleId ?? "active"],
    queryFn: () =>
      api.get<WeeklyTrendPoint[]>(`/reports/weekly-trend${cycleId ? `?cycle_id=${cycleId}` : ""}`),
  });
}

export function useCloseReport(cycleId: string | null) {
  return useQuery({
    queryKey: ["reports", "close-report", cycleId],
    queryFn: () => api.get<{ content: CloseReport; created_at: string } | null>(`/reports/close-report/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 10 * 60_000,
  });
}

export function useGenerateCloseReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) =>
      api.post<CloseReport>(`/reports/close-report/${cycleId}`, {}),
    onSuccess: (_data, cycleId) => {
      qc.invalidateQueries({ queryKey: ["reports", "close-report", cycleId] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export interface UpcomingMilestone {
  milestone_id: string;
  initiative_id: string;
  milestone_title: string;
  milestone_status: string;
  due_date: string;
  days_until_due: number;
  initiative_title: string;
  initiative_status: string;
  team_name: string | null;
  owner_name: string | null;
  cycle_id: string;
}

export interface ActivityFeedItem {
  id: string;
  event_at: string;
  event_type: "checkin";
  actor_name: string | null;
  kr_title: string;
  objective_title: string;
  objective_level: string;
  current_value: number;
  confidence: number;
  notes: string | null;
  mood: string | null;
  team_name: string | null;
}

export function useUpcomingMilestones(days = 30) {
  return useQuery<UpcomingMilestone[]>({
    queryKey: ["reports", "upcoming-milestones", days],
    queryFn: () => api.get(`/reports/upcoming-milestones?days=${days}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivityFeed(cycleId?: string, teamId?: string, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cycleId) params.set("cycle_id", cycleId);
  if (teamId)  params.set("team_id", teamId);
  return useQuery<ActivityFeedItem[]>({
    queryKey: ["reports", "activity-feed", cycleId ?? "all", teamId ?? "all", limit],
    queryFn: () => api.get(`/reports/activity-feed?${params.toString()}`),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  });
}

// ── Governance Calendar ────────────────────────────────────────────────────────

export type GovernanceHorizon = "QUARTERLY" | "ANNUAL" | "3YEAR";
export type GovernanceStatus  = "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
export type GovernanceEventType =
  | "KICKOFF" | "CHECK_IN_HEALTH" | "MID_REVIEW"
  | "CYCLE_REVIEW" | "RETROSPECTIVE"
  | "STRATEGIC_REVIEW" | "ANNUAL_PLANNING" | "CUSTOM";

export interface GovernanceEvent {
  event_id:       string;
  event_type:     GovernanceEventType;
  title:          string;
  description:    string;
  responsible:    string;
  deliverable:    string;
  frequency:      string;
  scheduled_date: string;
  due_date:       string;
  cycle_id:       string;
  cycle_name:     string;
  cycle_type:     string;
  status:         GovernanceStatus;
  completion_pct: number;
  is_overdue:     boolean;
  is_custom:      boolean;
}

export function useGovernanceCalendar(horizon: GovernanceHorizon = "ANNUAL") {
  return useQuery<GovernanceEvent[]>({
    queryKey: ["reports", "governance", horizon],
    queryFn: () => api.get(`/reports/governance?horizon=${horizon}`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface CreateGovernanceActivityInput {
  title: string;
  event_type?: string;
  responsible?: string;
  deliverable?: string;
  description?: string;
  frequency?: string;
  scheduled_date: string;
  due_date?: string;
  status?: GovernanceStatus;
  cycle_id?: string;
}

export function useCreateGovernanceActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGovernanceActivityInput) =>
      api.post<{ id: string }>("/reports/governance/activities", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", "governance"] }),
  });
}

export function useUpdateGovernanceActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateGovernanceActivityInput> & { id: string }) =>
      api.patch<{ ok: boolean }>(`/reports/governance/activities/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", "governance"] }),
  });
}

export function useDeleteGovernanceActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ ok: boolean }>(`/reports/governance/activities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", "governance"] }),
  });
}

// ── Cycle Projection ──────────────────────────────────────────────────────────

export interface CycleProjectionObjective {
  id: string;
  code: string;
  title: string;
  level: string;
  status: string;
  progress: number;
  avg_confidence: number;
  forecastStatus: "on_track" | "at_risk" | "critical";
  obj_gap: number;
}

export interface CycleProjection {
  cycle: {
    id: string; name: string; start_date: string; end_date: string;
    days_elapsed: number; days_remaining: number; days_total: number;
    cycle_position_pct: number;
  } | null;
  actual_progress: number;
  expected_progress: number;
  gap: number;
  weekly_velocity: number;
  projected_final_progress: number;
  objectives: CycleProjectionObjective[];
}

export function useCycleProjection() {
  return useQuery<CycleProjection | null>({
    queryKey: ["reports", "cycle-projection"],
    queryFn: async () => {
      try {
        return await api.get<CycleProjection | null>("/reports/cycle-projection");
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ── Welcome Context ────────────────────────────────────────────────────────────

export interface WelcomeContext {
  user: { id: string; name: string; role: string } | null;
  active_cycle: {
    id: string; name: string; type: string; status: string;
    start_date: string; end_date: string;
    days_remaining: number; days_elapsed: number; total_days: number; cycle_pct: number;
    avg_progress: number;
    avg_confidence: number | null;
  } | null;
  my_objectives: Array<{ id: string; code: string; title: string; status: string; level: string; kr_count: number; owner_name?: string }>;
  pending_checkins: Array<{
    kr_id: string; kr_code: string; kr_title: string;
    obj_code: string; objective_title: string; obj_owner_name?: string;
    days_since: number; last_checkin_at: string | null; confidence: number; progress: number;
  }>;
  at_risk_krs: Array<{
    kr_id: string; kr_code: string; kr_title: string;
    obj_code: string; objective_title: string; kr_owner_name?: string;
    confidence: number; progress: number; level: string;
  }>;
  upcoming_governance: Array<{
    event_type: GovernanceEventType; title: string; responsible: string;
    deliverable: string; scheduled_date: string; due_date: string; status: GovernanceStatus;
  }>;
  org_stats: {
    total_objectives: number; on_track: number;
    at_risk: number; completed: number; at_risk_krs: number;
  } | null;
}

export function useWelcomeContext(cycleId?: string | null) {
  return useQuery<WelcomeContext>({
    queryKey: ["reports", "welcome-context", cycleId ?? "auto"],
    queryFn: () => {
      const url = cycleId
        ? `/reports/welcome-context?cycle_id=${cycleId}`
        : "/reports/welcome-context";
      return api.get(url);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

// ── Engagement ROI (WOW 4) ─────────────────────────────────────────────────────

export interface EngagementAgreement {
  id: string;
  code: string;
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "FULFILLED" | "CANCELLED";
  priority: string;
  source: string | null;
  due_date: string | null;
  is_overdue: boolean;
  epics_count: number;
}

export interface EngagementObjective {
  id: string;
  code: string | null;
  title: string;
  level: string;
  status: string;
  progress: number;
  category: "completed" | "partial" | "missed";
}

export interface EngagementRoi {
  cycle: {
    id: string; name: string; status: string;
    start_date: string; end_date: string; score: number;
  };
  org: { name: string };
  agreements: {
    items: EngagementAgreement[];
    total: number;
    fulfilled: number;
    in_progress: number;
    pending: number;
    fulfillment_rate: number;
  };
  objectives: {
    items: EngagementObjective[];
    total: number;
    completed: number;
    partial: number;
    missed: number;
    completion_rate: number;
  };
  work: {
    epics: number; features: number; stories: number;
    done_epics: number; done_features: number; done_stories: number;
    total_points: number; done_points: number;
    initiatives_total: number; initiatives_done: number;
  };
  check_ins_total: number;
}

export function useEngagementRoi(cycleId: string | null) {
  return useQuery<EngagementRoi | null>({
    queryKey: ["reports", "engagement-roi", cycleId],
    queryFn: () => api.get<EngagementRoi>(`/reports/engagement-roi/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 5 * 60_000,
  });
}
