import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface FirstDayOrg {
  id: string;
  name: string;
  vision: string;
  mission: string;
  values_list: string[];
  sector: string;
}

export interface FirstDayCycle {
  id: string;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  total_days: number;
  progress_pct: number;
}

export interface FirstDayObjective {
  id: string;
  code: string;
  title: string;
  description: string;
  progress: number;
  kr_count: number;
}

export interface FirstDayTeam {
  id: string;
  name: string;
  description: string;
  member_count: number;
  lead_name: string | null;
}

export interface FirstDayKr {
  id: string;
  code: string;
  title: string;
  progress: number;
  metric_unit: string;
  current_value: number;
  target_value: number;
  status: string;
  objective_title: string;
}

export interface FirstDayBacklogItem {
  id: string;
  code: string;
  type: string;
  title: string;
  description: string;
  story_points: number | null;
  status: string;
  priority: string;
  initiative_title: string | null;
  initiative_id: string | null;
}

export interface FirstDayContext {
  org: FirstDayOrg;
  active_cycle: FirstDayCycle | null;
  company_objectives: FirstDayObjective[];
  my_team: FirstDayTeam | null;
  team_objective: FirstDayObjective | null;
  my_krs: FirstDayKr[];
  my_backlog_items: FirstDayBacklogItem[];
}

export function useFirstDayContext() {
  return useQuery<FirstDayContext>({
    queryKey: ['first-day-context'],
    queryFn: () => api.get<FirstDayContext>('/me/first-day'),
    staleTime: 10 * 60_000,
  });
}

export function useFirstDayNarrative(enabled: boolean) {
  return useQuery<{ narrative: string }>({
    queryKey: ['first-day-narrative'],
    queryFn: () => api.post<{ narrative: string }>('/ai/first-day-narrative', {}),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useCompleteFirstDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/me/first-day/complete', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}
