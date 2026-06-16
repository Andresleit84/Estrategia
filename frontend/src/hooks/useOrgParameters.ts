"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// ── Notification types ────────────────────────────────────────────────────────

export type NotifChannel = 'email' | 'telegram';
export type NotifFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type NotifType = 'risk_sentinel' | 'executive_briefer' | 'checkin_reminder' | 'cycle_closure' | 'agreement_status';

export interface NotifSetting {
  enabled: boolean;
  channels: NotifChannel[];
  hour: number;                   // 0-23
  frequency: NotifFrequency;
  day_of_week?: number;           // 0=Sun … 6=Sat (weekly only)
  day_of_month?: number;          // 1-28 (monthly / quarterly / annual)
  month_of_year?: number;         // 1-12 (annual only)
  quarter_start_month?: number;   // 1-12 (quarterly: first month of Q1)
  stale_days?: number;
}

export interface NotifLogEntry {
  sent_at: string;    // ISO
  channels: string[]; // e.g. ["email(2)", "telegram"]
}

export interface OrgNotifications {
  timezone: string;
  telegram_chat_id: string;   // per-org Telegram chat (overrides global)
  email_recipients: string;   // extra emails, comma-separated
  risk_sentinel: NotifSetting;
  executive_briefer: NotifSetting;
  checkin_reminder: NotifSetting;
  cycle_closure: NotifSetting;
  agreement_status: NotifSetting;
}

// ── Parameters ────────────────────────────────────────────────────────────────

export interface OrgParameters {
  organization_id: string;
  max_objectives_per_level: number;
  max_krs_per_objective: number;
  auto_complete_threshold: number;
  confidence_at_risk: number;
  confidence_on_track: number;
  progress_behind_threshold: number;
  stale_checkin_days: number;
  unstarted_kr_days: number;
  story_points_scale: number[];
  max_sprints_per_year: number;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from: string;
  smtp_pass?: string;
  notifications: OrgNotifications;
  // last-sent timestamps (ISO strings)
  notif_sent_risk_sentinel?: string;
  notif_sent_executive_briefer?: string;
  notif_sent_checkin_reminder?: string;
  notif_sent_cycle_closure?: string;
  notif_sent_agreement_status?: string;
  raw: Record<string, unknown>;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const NOTIFICATION_DEFAULTS: OrgNotifications = {
  timezone: 'America/Lima',
  telegram_chat_id: '',
  email_recipients: '',
  risk_sentinel:     { enabled: true,  channels: ['email','telegram'], hour: 2,  frequency: 'daily'  },
  executive_briefer: { enabled: true,  channels: ['email','telegram'], hour: 8,  frequency: 'weekly', day_of_week: 1 },
  checkin_reminder:  { enabled: true,  channels: ['telegram'],          hour: 10, frequency: 'weekly', day_of_week: 4, stale_days: 7 },
  cycle_closure:     { enabled: true,  channels: ['telegram'],          hour: 9,  frequency: 'daily'  },
  agreement_status:  { enabled: true,  channels: ['email','telegram'], hour: 8,  frequency: 'weekly', day_of_week: 1, stale_days: 7 },
};

const DEFAULTS: Omit<OrgParameters, 'organization_id' | 'raw'> = {
  max_objectives_per_level: 5,
  max_krs_per_objective:    5,
  auto_complete_threshold:  70,
  confidence_at_risk:       0.40,
  confidence_on_track:      0.70,
  progress_behind_threshold: 30,
  stale_checkin_days:       14,
  unstarted_kr_days:        7,
  story_points_scale:       [1, 2, 3, 5, 8, 13, 21],
  max_sprints_per_year:     52,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_from: '',
  smtp_pass: '',
  notifications: NOTIFICATION_DEFAULTS,
};

export { DEFAULTS as PARAMETER_DEFAULTS };

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useOrgParameters() {
  return useQuery({
    queryKey: ['org-parameters'],
    queryFn:  () => api.get<OrgParameters>('/organizations/me/parameters'),
    staleTime: 60_000,
  });
}

export function useUpdateOrgParameters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Partial<Omit<OrgParameters, 'organization_id' | 'raw'>>) =>
      api.patch<OrgParameters>('/organizations/me/parameters', params),
    onSuccess: (data) => {
      qc.setQueryData(['org-parameters'], data);
    },
  });
}

export interface TriggerResult {
  ok: boolean;
  sent_channels: string[];
  message?: string;
}

export function useTriggerNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: NotifType) =>
      api.post<TriggerResult>(`/ai/notifications/trigger/${type}`, {}),
    onSuccess: () => {
      // Refresh parameters so last-sent timestamps update in UI
      qc.invalidateQueries({ queryKey: ['org-parameters'] });
    },
  });
}
