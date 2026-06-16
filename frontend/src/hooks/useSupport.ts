import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface SupportMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  is_staff: boolean;
  body: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  organization_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  title: string;
  category: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
  message_count: number;
  last_reply_at: string | null;
  first_message?: string;
  messages?: SupportMessage[];
}

const BASE = "/support";

export function useTickets() {
  return useQuery<SupportTicket[]>({
    queryKey: ["support-tickets"],
    queryFn: () => api.get(BASE),
  });
}

export function useTicket(id: string | null) {
  return useQuery<SupportTicket>({
    queryKey: ["support-ticket", id],
    queryFn: () => api.get(`${BASE}/${id}`),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; category: string; body: string }) =>
      api.post(BASE, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets"] }),
  });
}

export function useAddMessage(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.post(`${BASE}/${ticketId}/messages`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}

export function useUpdateStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      api.patch(`${BASE}/${ticketId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}
