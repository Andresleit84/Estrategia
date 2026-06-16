export interface JwtPayload {
  sub: string;       // user_id
  orgId: string;     // organization_id
  role: string;
  iat?: number;
  exp?: number;
}

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
