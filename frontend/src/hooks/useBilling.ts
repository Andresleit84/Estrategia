import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface BillingStatus {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  trial_active: boolean;
  trial_expired: boolean;
  trial_expires_at: string | null;
  has_subscription: boolean;
  period_end: string | null;
  billing_interval: "monthly" | "annual";
  stripe_enabled: boolean;
  mp_enabled: boolean;
}

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ["billing", "status"],
    queryFn: () => api.get<BillingStatus>("/billing/status"),
    staleTime: 60_000,
  });
}

export function useStripeCheckout() {
  return useMutation({
    mutationFn: (interval: "monthly" | "annual") =>
      api.post<{ url: string }>("/billing/stripe/checkout", { interval }),
    onSuccess: ({ url }) => { window.location.href = url; },
  });
}

export function useMpCheckout() {
  return useMutation({
    mutationFn: (interval: "monthly" | "annual") =>
      api.post<{ url: string }>("/billing/mercadopago/checkout", { interval }),
    onSuccess: ({ url }) => { window.location.href = url; },
  });
}

export function useStripePortal() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>("/billing/stripe/portal", {}),
    onSuccess: ({ url }) => { window.location.href = url; },
  });
}
