"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

function withAiTimeout<T>(promise: Promise<T>, ms = 60_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('La IA tardó demasiado. Intenta de nuevo.')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(id));
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Briefing {
  id: string;
  type: "risk_sentinel" | "executive_briefing" | "alignment_audit" | "cycle_close" | "personal_briefing";
  title: string;
  cycle_id: string | null;
  cycle_name: string | null;
  created_at: string;
  content?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  cycle_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface StrategyAdvisorResponse {
  reply: string;
  conversation_id: string;
  sources: string[];
  suggested_actions?: string[];
}

export interface EarlyWarning {
  objective_id: string;
  objective_title: string;
  level: string;
  code: string | null;
  current_progress: number;
  projected_progress: number;
  days_remaining: number;
  pace_per_day: number;
  already_at_risk: boolean;
}

export interface EarlyWarningAction {
  objective: string;
  action: string;
  urgency: 'critical' | 'high' | 'medium';
}

export interface RiskSentinelReport {
  total_at_risk: number;
  company_level_at_risk: number;
  stale_krs: number;
  cycle?: string;
  analysis: string;
  priorities: string[];
  recommendations: string[];
  early_warnings: EarlyWarning[];
  early_warnings_analysis: string;
  early_warning_actions: EarlyWarningAction[];
  generated_at: string;
  generated_by: string;
}

export interface ExecutiveBriefingReport {
  cycle_name?: string;
  cycle_status?: string;
  total_objectives: number;
  on_track: number;
  behind: number;
  completed: number;
  at_risk_count: number;
  cycle_score: number;
  narrative: string;
  highlights: string[];
  risks: string[];
  next_steps: string[];
  generated_at: string;
  generated_by: string;
}

export interface AlignmentAuditReport {
  cycle_name: string;
  alignment_score: number;
  analysis: string;
  suggestions: string[];
  alignment_map_count: number;
  generated_at: string;
  generated_by: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useBriefings(type?: string) {
  return useQuery({
    queryKey: ["ai", "briefings", type ?? "all"],
    queryFn: () => api.get<Briefing[]>(`/ai/briefings${type ? `?type=${type}` : ""}`),
  });
}

export function useBriefing(id: string) {
  return useQuery({
    queryKey: ["ai", "briefings", id],
    queryFn: () => api.get<Briefing>(`/ai/briefings/${id}`),
    enabled: !!id,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["ai", "conversations"],
    queryFn: () => api.get<Conversation[]>("/ai/conversations"),
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useStrategyAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { message: string; conversation_id?: string; cycle_id?: string }) =>
      api.post<StrategyAdvisorResponse>("/ai/strategy-advisor", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "conversations"] });
    },
  });
}

export function useRunRiskSentinel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { cycle_id?: string }) =>
      api.post<RiskSentinelReport>("/ai/risk-sentinel", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "briefings"] });
      qc.invalidateQueries({ queryKey: ["reports", "risk-dashboard"] });
    },
  });
}

export function useRunExecutiveBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { cycle_id?: string }) =>
      api.post<ExecutiveBriefingReport>("/ai/executive-briefing", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "briefings"] });
      qc.invalidateQueries({ queryKey: ["reports", "executive-briefing"] });
    },
  });
}

export interface CycleCloseBriefing {
  cycle_name: string;
  cycle_id: string;
  cycle_score: number;
  total_objectives: number;
  completed: number;
  active_at_close: number;
  cancelled: number;
  completion_rate: number;
  at_risk_count: number;
  narrative: string;
  achievements: string[];
  misses: string[];
  learnings: string[];
  next_cycle_recommendations: string[];
  generated_at: string;
}

export function useGenerateCycleCloseBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) =>
      api.post<CycleCloseBriefing>(`/ai/cycle-close-briefing/${cycleId}`, {}),
    onSuccess: (_data, cycleId) => {
      qc.invalidateQueries({ queryKey: ["ai", "cycle-close", cycleId] });
      qc.invalidateQueries({ queryKey: ["ai", "briefings"] });
    },
  });
}

export function useCycleCloseBriefing(cycleId: string | null) {
  return useQuery({
    queryKey: ["ai", "cycle-close", cycleId],
    queryFn: () => api.get<{ content: CycleCloseBriefing; created_at: string } | null>(`/ai/cycle-close-briefing/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 5 * 60_000,
  });
}

export interface EngagementAnalysisReport {
  cycle_name: string;
  cycle_id: string;
  cycle_score: number;
  agreement_rate: number;
  objective_rate: number;
  headline: string;
  narrative: string;
  highlights: string[];
  risks: string[];
  renewal_recommendation: string;
  next_cycle_focus: string[];
  generated_at: string;
  generated_by: string;
}

export function useEngagementAnalysis(cycleId: string | null) {
  return useQuery<{ content: EngagementAnalysisReport; created_at: string } | null>({
    queryKey: ["ai", "engagement-analysis", cycleId],
    queryFn: () => api.get(`/ai/engagement-analysis/${cycleId}`),
    enabled: !!cycleId,
    staleTime: 10 * 60_000,
  });
}

export function useGenerateEngagementAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) =>
      withAiTimeout(api.post<EngagementAnalysisReport>(`/ai/engagement-analysis/${cycleId}`, {}), 60_000),
    onSuccess: (_data, cycleId) => {
      qc.invalidateQueries({ queryKey: ["ai", "engagement-analysis", cycleId] });
      qc.invalidateQueries({ queryKey: ["ai", "briefings"] });
    },
  });
}

export interface OkrSuggestion {
  title: string;
  description: string;
  rationale: string;
  key_results: {
    title: string;
    type: 'INCREASE' | 'DECREASE' | 'MAINTAIN' | 'ACHIEVE';
    metric_unit: string;
    start_value: number;
    target_value: number;
  }[];
}

export function useSuggestOkrs() {
  return useMutation({
    mutationFn: (dto: { cycle_id: string; level: 'COMPANY' | 'AREA' | 'TEAM' | 'INDIVIDUAL'; cycle_type: string }) =>
      withAiTimeout(api.post<{ suggestions: OkrSuggestion[]; error?: string }>('/ai/suggest-okrs', dto)),
  });
}

export function useRunAlignmentAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { cycle_id?: string }) =>
      api.post<AlignmentAuditReport>("/ai/alignment-audit", dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "briefings"] });
      qc.invalidateQueries({ queryKey: ["reports", "alignment"] });
    },
  });
}

export interface InitiativeSuggestion {
  title: string;
  description: string;
  rationale: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  target_cycle_horizon?: 'CUSTOM' | 'ANNUAL' | 'QUARTERLY';
  estimated_duration_weeks: number;
  aligned_objectives: string[];
  primary_area?: string | null;
  involved_areas?: string[];
  suggested_dependencies?: { description: string; type: 'INTERNAL' | 'EXTERNAL' | 'DECISION' }[];
  milestones: { title: string; week_offset: number }[];
}

export function useSuggestInitiatives() {
  return useMutation({
    mutationFn: (dto: { cycle_id: string }) =>
      withAiTimeout(api.post<{ suggestions: InitiativeSuggestion[]; error?: string }>('/ai/suggest-initiatives', dto)),
  });
}

export interface SuggestedDeliverable {
  title: string;
  description: string;
  acceptance_criteria: string;
}

export interface SuggestedPhase {
  name: string;
  description: string;
  gate_criteria: string;
  deliverables: SuggestedDeliverable[];
}

export function useSuggestDelivery() {
  return useMutation({
    mutationFn: (dto: { program_id: string }) =>
      withAiTimeout(api.post<{ phases: SuggestedPhase[]; error?: string }>('/ai/suggest-delivery', dto)),
  });
}

export interface BacklogSuggestion {
  title: string;
  description: string;
  acceptance_criteria: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
  initiative_hint: string | null;
  features: { title: string; description: string; acceptance_criteria: string }[];
}

export function useSuggestBacklog() {
  return useMutation({
    mutationFn: (dto: { cycle_id?: string }) =>
      withAiTimeout(api.post<{ suggestions: BacklogSuggestion[]; error?: string }>('/ai/suggest-backlog', dto)),
  });
}

export interface TeamOkrGapSuggestion {
  company_obj_id: string | null;
  company_title: string;
  team_okrs: OkrSuggestion[];
}

export function useSuggestTeamOkrs() {
  return useMutation({
    mutationFn: (dto: { cycle_id: string }) =>
      withAiTimeout(api.post<{ gap_suggestions: TeamOkrGapSuggestion[]; error?: string }>('/ai/suggest-team-okrs', dto)),
  });
}

export interface DeliveryAdvisorResponse {
  reply: string;
  conversation_id: string | null;
  sources: string[];
}

export function useDeliveryAdvisor() {
  return useMutation({
    mutationFn: (dto: { program_id?: string; message: string; conversation_id?: string }) =>
      api.post<DeliveryAdvisorResponse>('/ai/delivery-advisor', dto),
  });
}


export interface DemoKeyResult {
  title: string;
  target_value: number;
  metric_unit: string;
}

export interface DemoObjectiveSuggestion {
  title: string;
  description: string;
  key_results: DemoKeyResult[];
}

export interface DemoProblemSuggestion {
  title: string;
  description?: string;
  category: string;
  severity: number;
  frequency: number;
}

export interface DemoIntentSuggestion {
  title: string;
  description?: string;
  category: string;
  horizon_years: number;
  problem_indices: number[];
}

export interface DemoAreaOkrSuggestion {
  company_obj_index: number;
  title: string;
  description?: string;
  key_results: DemoKeyResult[];
}

export interface DemoTeamOkrSuggestion {
  area_okr_index: number;
  title: string;
  description?: string;
  key_results: DemoKeyResult[];
}

export interface DemoStorySuggestion {
  title: string;
  acceptance_criteria?: string;
  story_points?: number;
}

export interface DemoInitiativeSuggestion {
  area_okr_index: number;
  title: string;
  description?: string;
  stories: DemoStorySuggestion[];
}

export interface DemoStrategyResponse {
  objectives: DemoObjectiveSuggestion[];
  problems: DemoProblemSuggestion[];
  strategic_intents: DemoIntentSuggestion[];
  area_okrs: DemoAreaOkrSuggestion[];
  team_okrs: DemoTeamOkrSuggestion[];
  initiatives: DemoInitiativeSuggestion[];
}

export function useSuggestDemoStrategy() {
  return useMutation({
    mutationFn: (dto: { company: string; industry: string; challenge: string }) =>
      withAiTimeout(
        api.post<DemoStrategyResponse>('/ai/suggest-demo-strategy', dto),
        90_000,
      ),
  });
}

// ── Personal Briefing ─────────────────────────────────────────────────────────

export interface PersonalBriefingKr {
  kr_title: string;
  objective_title: string;
  confidence: number;
  progress: number;
  days_since_checkin: number | null;
  status: string;
}

export interface PersonalBriefingAgreement {
  title: string;
  code: string | null;
  due_date: string | null;
  is_overdue: boolean;
  days_remaining: number | null;
  priority: string;
}

export interface PersonalBriefingSprintItem {
  title: string;
  type: string;
  status: string;
  priority: string;
  story_points: number | null;
}

export interface PersonalBriefingObjective {
  title: string;
  level: string;
  progress: number;
}

export interface PersonalBriefingReport {
  user_name: string;
  user_email: string;
  cycle_id: string | null;
  at_risk_krs: PersonalBriefingKr[];
  at_risk_count: number;
  agreements_due: PersonalBriefingAgreement[];
  agreements_count: number;
  sprint_items: PersonalBriefingSprintItem[];
  sprint_items_count: number;
  my_objectives: PersonalBriefingObjective[];
  objectives_count: number;
  bullets: string[];
  generated_at: string;
}

export interface PersonalBriefingLatest {
  id: string;
  type: string;
  title: string;
  cycle_id: string | null;
  content: PersonalBriefingReport;
  created_at: string;
}

export function usePersonalBriefingLatest() {
  return useQuery<PersonalBriefingLatest | null>({
    queryKey: ["ai", "personal-briefing", "latest"],
    queryFn: () => api.get<PersonalBriefingLatest | null>("/ai/personal-briefing/latest"),
    staleTime: 10 * 60_000,
  });
}

export function useGeneratePersonalBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      withAiTimeout(api.post<PersonalBriefingReport & { error?: string }>("/ai/personal-briefing", {}), 60_000),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "personal-briefing"] });
      qc.invalidateQueries({ queryKey: ["ai", "briefings"] });
    },
  });
}
