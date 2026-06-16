import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// ─── 8 Structural Threats ─────────────────────────────────────────────────────

export const EIGHT_THREATS = [
  {
    key: "STRATEGIC_EXECUTION",
    title: "Ejecución Estratégica",
    description: "La brecha entre lo que el Consejo aprueba y lo que la Gerencia ejecuta",
    color: "blue",
    dimensions: [
      { key: "plan_clarity",          label: "Claridad y calidad del Plan Estratégico" },
      { key: "board_mgmt_alignment",  label: "Alineación Consejo–Gerencia sobre prioridades" },
      { key: "accountability_system", label: "Sistema de seguimiento y rendición de cuentas" },
      { key: "review_cadence",        label: "Cadencia de revisión y ajuste" },
    ],
  },
  {
    key: "GOVERNANCE_MATURITY",
    title: "Madurez de Gobernanza",
    description: "Capacidad del Consejo para gobernar bajo presión regulatoria creciente",
    color: "indigo",
    dimensions: [
      { key: "board_composition",     label: "Composición y diversidad de competencias del Consejo" },
      { key: "director_competency",   label: "Nivel de competencia individual de los directores" },
      { key: "governance_frameworks", label: "Marcos de gobierno corporativo (WOCCU-aligned)" },
      { key: "idoneity_compliance",   label: "Cumplimiento de idoneidad y regulación aplicable" },
    ],
  },
  {
    key: "MARGIN_DEPENDENCY",
    title: "Dependencia del Margen",
    description: "Concentración de ingresos en margen de intermediación — riesgo existencial ante compresión",
    color: "orange",
    dimensions: [
      { key: "income_concentration",    label: "Concentración en ingresos financieros vs. totales" },
      { key: "revenue_diversification", label: "Diversificación efectiva de ingresos no financieros" },
      { key: "margin_resilience",       label: "Resiliencia ante compresión de márgenes" },
      { key: "pricing_model",           label: "Modelo de pricing y propuesta de valor al socio" },
    ],
  },
  {
    key: "DIGITAL_CAPABILITY",
    title: "Capacidad Digital",
    description: "Transformación digital como pregunta de capacidad institucional, no de TI",
    color: "violet",
    dimensions: [
      { key: "digital_strategy",          label: "Estrategia y hoja de ruta digital documentada" },
      { key: "tech_talent",               label: "Talento tecnológico disponible e integrado" },
      { key: "tech_maturity",             label: "Madurez tecnológica actual (plataformas, datos)" },
      { key: "member_digital_experience", label: "Experiencia digital del socio" },
    ],
  },
  {
    key: "LEADERSHIP_TALENT",
    title: "Liderazgo y Talento",
    description: "La carrera por el talento ejecutivo que liderará la transformación ya empezó",
    color: "teal",
    dimensions: [
      { key: "leadership_pipeline",     label: "Pipeline de liderazgo interno identificado" },
      { key: "competency_compensation", label: "Framework de competencias y compensación" },
      { key: "culture_retention",       label: "Cultura, engagement y retención de talento clave" },
      { key: "development_programs",    label: "Programas de desarrollo y upskilling digital" },
    ],
  },
  {
    key: "BUSINESS_MODEL",
    title: "Modelo de Negocio",
    description: "Diversificación antes de que los entrantes digitales consoliden la relación con el socio",
    color: "rose",
    dimensions: [
      { key: "product_diversification", label: "Diversificación de productos y servicios" },
      { key: "embedded_finance",        label: "Readiness para embedded finance y open finance" },
      { key: "ecosystem_partnerships",  label: "Estrategia de ecosistema y alianzas" },
      { key: "cooperative_relevance",   label: "Relevancia del modelo cooperativo vs. entrantes" },
    ],
  },
  {
    key: "REGULATORY_PRESSURE",
    title: "Presión Regulatoria",
    description: "Cumplimiento como ventaja competitiva, no solo obligación",
    color: "amber",
    dimensions: [
      { key: "compliance_management",  label: "Gestión proactiva del cumplimiento regulatorio" },
      { key: "niif9_ecl",              label: "Preparación NIIF 9 / ECL y gestión de provisiones" },
      { key: "risk_framework",         label: "Marco de gestión de riesgos (AML, fraude, operacional)" },
      { key: "regulator_relationship", label: "Calidad de la relación con el ente regulador" },
    ],
  },
  {
    key: "MEMBER_DIGITAL_DISCONNECT",
    title: "Desconexión Digital del Socio",
    description: "Retención de la relación con el socio en la era de los entrantes digitales",
    color: "cyan",
    dimensions: [
      { key: "digital_value_prop",   label: "Propuesta de valor digital diferenciada" },
      { key: "digital_channels",     label: "Canales digitales y tasa de adopción" },
      { key: "data_personalization", label: "Datos, analytics y personalización" },
      { key: "loyalty_retention",    label: "Lealtad y retención digital del socio" },
    ],
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DimensionScore {
  id: string;
  dimension_key: string;
  score: number | null;
  notes: string | null;
}

export interface ThreatScore {
  id: string;
  threat_key: string;
  overall_score: number | null;
  benchmark: 'BELOW' | 'AT' | 'ABOVE' | null;
  evidence: string | null;
  ai_insights: string | null;
  updated_at: string;
  dimensions?: DimensionScore[];
}

export interface SectorAssessment {
  id: string;
  organization_id: string;
  session_id: string | null;
  created_by: string;
  created_by_name: string;
  title: string;
  engagement_type: 'DIAGNOSTIC' | 'ANNUAL_REVIEW' | 'FOLLOWUP';
  status: 'IN_PROGRESS' | 'COMPLETED';
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  completion_pct: number;
  avg_score: number | null;
  threat_scores: ThreatScore[];
}

export interface AiThreatPlan {
  prioridad: 'CRITICA' | 'ALTA' | 'MODERADA' | 'BUENA' | 'EXCELENTE';
  diagnostico?: string;
  plan_accion: string;
  kpis: string[];
}

export interface SessionDocument {
  id: string;
  name: string;
  doc_type: string;
  content: string;
  size_chars: number;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
}

export type DocType = 'survey' | 'interview' | 'report' | 'benchmark' | 'other';

export interface AiFortaleza {
  threat_key: string;
  score: number;
  razon: string;
}

export interface SessionAiPlan {
  generated_at: string;
  fortalezas: AiFortaleza[];
  debilidades: AiFortaleza[];
  diagnostico_general: string;
  insights_consenso: string;
  resumen_insumos?: string;
  roadmap: {
    acciones_30d: string[];
    iniciativas_90d: string[];
    transformaciones_180d: string[];
  };
  por_amenaza: Record<string, AiThreatPlan>;
  error?: string;
}

export interface AssessmentSession {
  id: string;
  organization_id: string;
  name: string;
  period_label: string;
  status: 'OPEN' | 'COMPLETED';
  calibrated_scores: Record<string, number> | null;
  session_documents: SessionDocument[];
  ai_plan: SessionAiPlan | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  total_assessments: number;
  completed_assessments: number;
  avg_score: number | null;
}

export interface ConsolidationScoreEntry {
  assessment_id: string;
  assessment_title: string;
  score: number;
  benchmark: string | null;
  engagement_type: string;
  assessed_at: string;
  assessor_name: string | null;
}

export interface ConsolidatedThreat {
  threat_key: string;
  avg_score: number;
  min_score: number;
  max_score: number;
  stddev: number | null;
  count: number;
  consensus_level: 'HIGH' | 'MEDIUM' | 'LOW';
  calibrated_score: number | null;
  scores: ConsolidationScoreEntry[];
}

export interface SessionConsolidation {
  session: {
    id: string;
    name: string;
    period_label: string;
    status: string;
    calibrated_scores: Record<string, number> | null;
  };
  meta: {
    total_assessments: number;
    completed_count: number;
    earliest_date: string | null;
    latest_date: string | null;
  };
  threats: ConsolidatedThreat[];
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  avatar_url: string | null;
  assessment_id: string | null;
  assessment_status: 'IN_PROGRESS' | 'COMPLETED' | null;
  completion_pct: number;
  completed: boolean;
  added_at: string;
}

export interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  org_role: string;
  avatar_url: string | null;
  is_active: boolean;
}

export interface MyParticipantSession {
  id: string;
  name: string;
  period_label: string;
  status: string;
  created_at: string;
  my_assessment_id: string | null;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

const KEYS = {
  sessions:             ['sector-assessment', 'sessions'] as const,
  session:              (id: string) => ['sector-assessment', 'sessions', id] as const,
  sessionConsolidation: (id: string) => ['sector-assessment', 'sessions', id, 'consolidation'] as const,
  sessionAssessments:   (id: string) => ['sector-assessment', 'sessions', id, 'assessments'] as const,
  sessionParticipants:  (id: string) => ['sector-assessment', 'sessions', id, 'participants'] as const,
  mySession:            ['sector-assessment', 'my-session'] as const,
  list:                 ['sector-assessment'] as const,
  one:                  (id: string) => ['sector-assessment', id] as const,
  orgMembers:           ['org', 'members'] as const,
};

// ─── Session Hooks ────────────────────────────────────────────────────────────

export function useSessions() {
  return useQuery({
    queryKey: KEYS.sessions,
    queryFn: () => api.get<AssessmentSession[]>('/sector-assessment/sessions'),
  });
}

export function useMySession() {
  return useQuery({
    queryKey: KEYS.mySession,
    queryFn: () => api.get<MyParticipantSession | null>('/sector-assessment/sessions/my'),
  });
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: KEYS.session(id ?? ''),
    queryFn: () => api.get<AssessmentSession>(`/sector-assessment/sessions/${id}`),
    enabled: !!id,
  });
}

export function useSessionConsolidation(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.sessionConsolidation(sessionId ?? ''),
    queryFn: () => api.get<SessionConsolidation>(`/sector-assessment/sessions/${sessionId}/consolidation`),
    enabled: !!sessionId,
  });
}

export function useSessionAssessments(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.sessionAssessments(sessionId ?? ''),
    queryFn: () => api.get<SectorAssessment[]>(`/sector-assessment/sessions/${sessionId}/assessments`),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; period_label: string }) =>
      api.post<AssessmentSession>('/sector-assessment/sessions', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.sessions }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/sector-assessment/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.sessions }),
  });
}

export function useCalibrateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, scores }: { sessionId: string; scores: Record<string, number> }) =>
      api.patch<SessionConsolidation>(`/sector-assessment/sessions/${sessionId}/calibrate`, { scores }),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: KEYS.sessionConsolidation(sessionId) });
      qc.invalidateQueries({ queryKey: KEYS.session(sessionId) });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

export function useAnalyzeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<AssessmentSession>(`/sector-assessment/sessions/${sessionId}/analyze`, {}),
    onSuccess: (_, sessionId) => {
      qc.invalidateQueries({ queryKey: KEYS.session(sessionId) });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

export function useUploadSessionDocument(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, docType }: { file: File; docType: string }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('doc_type', docType);
      return api.post<AssessmentSession>(
        `/sector-assessment/sessions/${sessionId}/documents`,
        form,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.session(sessionId) });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

export function useDeleteSessionDocument(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      api.delete<AssessmentSession>(`/sector-assessment/sessions/${sessionId}/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.session(sessionId) });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

// ─── Session Participant Hooks ────────────────────────────────────────────────

export function useSessionParticipants(sessionId: string | null) {
  return useQuery({
    queryKey: KEYS.sessionParticipants(sessionId ?? ''),
    queryFn: () => api.get<SessionParticipant[]>(`/sector-assessment/sessions/${sessionId}/participants`),
    enabled: !!sessionId,
  });
}

export function useAddParticipant(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<SessionParticipant[]>(`/sector-assessment/sessions/${sessionId}/participants`, { user_id: userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.sessionParticipants(sessionId) }),
  });
}

export function useRemoveParticipant(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete<SessionParticipant[]>(`/sector-assessment/sessions/${sessionId}/participants/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.sessionParticipants(sessionId) }),
  });
}

export function useNotifyParticipants(sessionId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ sent: number }>(`/sector-assessment/sessions/${sessionId}/participants/notify`, {}),
  });
}

export function useOrgMembers() {
  return useQuery({
    queryKey: KEYS.orgMembers,
    queryFn: () => api.get<OrgMember[]>('/organizations/me/members'),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Individual Assessment Hooks ──────────────────────────────────────────────

export function useAssessments() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: () => api.get<SectorAssessment[]>('/sector-assessment'),
  });
}

export function useAssessment(id: string | null) {
  return useQuery({
    queryKey: KEYS.one(id ?? ''),
    queryFn: () => api.get<SectorAssessment>(`/sector-assessment/${id}`),
    enabled: !!id,
  });
}

export function useCreateAssessment(sessionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { title: string; engagement_type?: string }) => {
      const url = sessionId
        ? `/sector-assessment/sessions/${sessionId}/assessments`
        : '/sector-assessment';
      return api.post<SectorAssessment>(url, dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      if (sessionId) {
        qc.invalidateQueries({ queryKey: KEYS.sessionAssessments(sessionId) });
        qc.invalidateQueries({ queryKey: KEYS.session(sessionId) });
        qc.invalidateQueries({ queryKey: KEYS.sessions });
      }
    },
  });
}

export function useUpdateThreat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, ...dto
    }: {
      id: string;
      threat_key: string;
      overall_score?: number;
      benchmark?: string;
      evidence?: string;
      ai_insights?: string;
      dimensions?: { dimension_key: string; score?: number; notes?: string }[];
    }) => api.patch<SectorAssessment>(`/sector-assessment/${id}/threats`, dto),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.one(vars.id) });
      qc.invalidateQueries({ queryKey: KEYS.list });
    },
  });
}

export function useCompleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<SectorAssessment>(`/sector-assessment/${id}/complete`, {}),
    onSuccess: (data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.one(id) });
      qc.invalidateQueries({ queryKey: KEYS.list });
      if (data?.session_id) {
        qc.invalidateQueries({ queryKey: KEYS.sessionAssessments(data.session_id) });
        qc.invalidateQueries({ queryKey: KEYS.sessionConsolidation(data.session_id) });
        qc.invalidateQueries({ queryKey: KEYS.session(data.session_id) });
        qc.invalidateQueries({ queryKey: KEYS.sessions });
      }
    },
  });
}

export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/sector-assessment/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

export function useDownloadSessionPdf() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
      const res = await fetch(`${BASE_URL}/sector-assessment/sessions/${sessionId}/pdf`, {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) throw new Error('Error al generar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagnostico-${sessionId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}
