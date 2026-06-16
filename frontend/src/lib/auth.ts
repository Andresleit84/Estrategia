import { api } from './api-client';

export interface UserSession {
  user_id: string;
  organization_id: string;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  email_verified: boolean;
  org_slug: string;
  org_name: string;
  org_plan: string;
  org_mode: string;
  org_settings: Record<string, unknown>;
  org_trial_expires_at?: string | null;
  org_sector?: string;
  is_platform_admin: boolean;
  first_day_completed_at?: string | null;
}

export interface RegisterInput {
  orgName: string;
  orgSlug: string;
  orgMode?: string;
  email: string;
  password: string;
  name: string;
}

export interface TrialRegisterInput {
  name: string;
  email: string;
  company: string;
  password: string;
}

export const authApi = {
  registerTrial: (data: TrialRegisterInput) =>
    api.post<{ user: UserSession }>('/auth/trial', data),

  register: (data: RegisterInput) =>
    api.post<{ user: UserSession }>('/auth/register', data),

  login: (email: string, password: string) =>
    api.post<{ user: UserSession }>('/auth/login', { email, password }),

  logout: () =>
    api.post<void>('/auth/logout', {}),

  me: () =>
    api.get<{ user: UserSession }>('/auth/me'),

  refresh: () =>
    api.post<{ ok: boolean }>('/auth/refresh', {}),
};
