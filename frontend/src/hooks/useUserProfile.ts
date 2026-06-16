"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface UserProfile {
  user_id: string;
  timezone: string;
  locale: string;
  notify_at_risk: boolean;
  notify_checkin_reminder: boolean;
  notify_weekly_briefing: boolean;
  updated_at: string;
}

export interface MfaStatus {
  enabled: boolean;
  verified_at: string | null;
}

export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: ["me", "profile"],
    queryFn: () => api.get("/me/profile"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserProfile>) => api.patch("/me/profile", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "profile"] }),
  });
}

export function useMfaStatus() {
  return useQuery<MfaStatus>({
    queryKey: ["me", "mfa"],
    queryFn: () => api.get("/me/mfa"),
    staleTime: 60 * 1000,
  });
}

export function useSetupMfa() {
  return useMutation({
    mutationFn: () => api.post<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }>("/me/mfa/setup", {}),
  });
}

export function useEnableMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post("/me/mfa/enable", { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "mfa"] }),
  });
}

export function useDisableMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post("/me/mfa/disable", { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "mfa"] }),
  });
}

export function useLogoutAll() {
  return useMutation({
    mutationFn: () => api.post("/auth/logout-all", {}),
    onSuccess: () => { window.location.href = "/auth/login"; },
  });
}
