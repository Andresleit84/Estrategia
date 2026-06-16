import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface DiagnosticReport {
  id: string;
  organization_id: string;
  org_name: string;
  country_code: string;
  country_name: string;
  status: 'GENERATING' | 'READY' | 'ERROR';
  has_pdf: boolean;
  pdf_path: string | null;
  error_message: string | null;
  created_at: string;
  created_by_name: string;
  content?: DiagnosticContent;
}

export interface SwotItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: number;
  frequency: number;
  evidence?: string;
}

export interface EntityProfile {
  type: string;
  sector: string;
  estimated_size: string;
  geographic_scope: string;
  regulatory_classification: string;
  typical_structure: string;
  key_services: string[];
  member_or_client_profile: string;
  market_position: string;
  strategic_moment: string;
  key_figures: string;
  historical_context: string;
}

export interface DiagnosticContent {
  entity_profile: EntityProfile;
  executive_summary: string;
  organizational_context: string;
  regulatory_context: {
    entities: Array<{ name: string; type: string; role: string; website?: string }>;
    key_frameworks: string[];
    compliance_challenges: string;
  };
  benchmark: {
    sector: string;
    national_players: Array<{ name: string; type: string; market_share_approx: string; key_differentiator: string }>;
    latam_references: Array<{ name: string; country: string; type: string; relevance: string }>;
    industry_trends: string[];
  };
  swot: {
    strengths: SwotItem[];
    weaknesses: SwotItem[];
    opportunities: SwotItem[];
    threats: SwotItem[];
  };
  strategic_recommendations: Array<{
    priority: number;
    title: string;
    rationale: string;
    timeline: 'SHORT' | 'MEDIUM' | 'LONG';
    type: string;
  }>;
}

const KEYS = {
  list: ['ai-diagnostic'] as const,
  one: (id: string) => ['ai-diagnostic', id] as const,
};

export function useAiDiagnosticList() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: () => api.get<DiagnosticReport[]>('/ai/diagnostic'),
  });
}

export function useAiDiagnosticOne(id: string | null, enabled = true) {
  return useQuery({
    queryKey: KEYS.one(id ?? ''),
    queryFn: () => api.get<DiagnosticReport>(`/ai/diagnostic/${id}`),
    enabled: !!id && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'GENERATING' ? 3000 : false;
    },
  });
}

export function useCreateDiagnostic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { orgName: string; countryCode: string; countryName: string }) =>
      api.post<{ id: string }>('/ai/diagnostic', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list }),
  });
}

export function useImportDiagnosticItems() {
  return useMutation({
    mutationFn: ({ reportId, itemIds }: { reportId: string; itemIds: string[] }) =>
      api.post<{ imported: number; ids: string[] }>(`/ai/diagnostic/${reportId}/import`, { item_ids: itemIds }),
  });
}

export function useRegenerateDiagnostic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) =>
      api.post<{ id: string }>(`/ai/diagnostic/${reportId}/regenerate`, {}),
    onSuccess: (_, reportId) => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.one(reportId) });
    },
  });
}

export function useDeleteDiagnostic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) =>
      api.delete<void>(`/ai/diagnostic/${reportId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list }),
  });
}
