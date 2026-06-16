"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  Stethoscope, Plus, ChevronLeft, CheckCircle2, Circle,
  AlertCircle, ChevronRight, BarChart3, Trash2, Sparkles,
  Loader2, RefreshCw, Users, Calendar, Activity, TrendingUp, TrendingDown,
  UserCheck, UserX, ClipboardList, Copy, Check,
  Paperclip, Upload, FileText, X, FileCheck, Download,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  EIGHT_THREATS,
  useSessions, useSession, useSessionConsolidation, useSessionAssessments,
  useCreateSession, useDeleteSession, useCalibrateSession, useAnalyzeSession,
  useSessionParticipants, useAddParticipant, useRemoveParticipant, useOrgMembers,
  useNotifyParticipants,
  useAssessment, useCreateAssessment, useUpdateThreat, useCompleteAssessment, useDeleteAssessment,
  useMySession, useUploadSessionDocument, useDeleteSessionDocument, useDownloadSessionPdf,
  type AssessmentSession, type SectorAssessment, type ThreatScore,
  type SessionConsolidation, type ConsolidatedThreat, type SessionAiPlan, type AiFortaleza,
  type SessionParticipant, type SessionDocument,
} from "@/hooks/useSectorAssessment";
import { useAuthStore } from "@/store/auth.store";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGAGEMENT_TYPE_KEYS: Record<string, string> = {
  DIAGNOSTIC:    "initialDiagnosis",
  ANNUAL_REVIEW: "annualReview",
  FOLLOWUP:      "followUp",
};

const BENCHMARK_OPTIONS = [
  { value: "BELOW", labelKey: "belowSector", label: "Por debajo del sector" },
  { value: "AT",    labelKey: "atSector",    label: "En el sector"          },
  { value: "ABOVE", labelKey: "aboveSector", label: "Sobre el sector"       },
] as const satisfies ReadonlyArray<{ value: string; labelKey: string; label: string }>;

const SCORE_KEY_MAP: Record<number, string> = {
  1: "veryLow", 2: "low", 3: "moderate", 4: "good", 5: "excellent",
};

const THREAT_COLORS: Record<string, string> = {
  blue: "bg-blue-500", indigo: "bg-indigo-500", orange: "bg-orange-500",
  violet: "bg-violet-500", teal: "bg-teal-500", rose: "bg-rose-500",
  amber: "bg-amber-500", cyan: "bg-cyan-500",
};

const RADAR_LABELS: Record<string, string> = {
  STRATEGIC_EXECUTION:       "Ejecución estratégica",
  GOVERNANCE_MATURITY:       "Gobernanza",
  MARGIN_DEPENDENCY:         "Dependencia de margen",
  DIGITAL_CAPABILITY:        "Capacidad digital",
  LEADERSHIP_TALENT:         "Liderazgo y talento",
  BUSINESS_MODEL:            "Modelo de negocio",
  REGULATORY_PRESSURE:       "Presión regulatoria",
  MEMBER_DIGITAL_DISCONNECT: "Brecha digital socios",
};

const ENGAGEMENT_LABELS: Record<string, string> = {
  DIAGNOSTIC:    "Diagnóstico inicial",
  ANNUAL_REVIEW: "Revisión anual",
  FOLLOWUP:      "Seguimiento",
};

const RADAR_KEY_MAP: Record<string, string> = {
  STRATEGIC_EXECUTION:       "execution",
  GOVERNANCE_MATURITY:       "governance",
  MARGIN_DEPENDENCY:         "margin",
  DIGITAL_CAPABILITY:        "digital",
  LEADERSHIP_TALENT:         "leadership",
  BUSINESS_MODEL:            "business",
  REGULATORY_PRESSURE:       "regulatory",
  MEMBER_DIGITAL_DISCONNECT: "partners",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null | undefined) {
  if (!score) return "";
  if (score <= 2) return "text-red-600 dark:text-red-400";
  if (score <= 3) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

function scoreBg(score: number | null | undefined) {
  if (!score) return "bg-muted/50";
  if (score <= 2) return "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800";
  if (score <= 3) return "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800";
  return "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800";
}

function getThreatStatus(ts: ThreatScore | undefined, dimCount: number) {
  if (!ts) return "none";
  const dimScored = (ts.dimensions ?? []).filter((d) => d.score !== null).length;
  if (ts.overall_score !== null && dimScored >= dimCount) return "complete";
  if (ts.overall_score !== null || dimScored > 0) return "partial";
  return "none";
}

// ─── ScorePills ───────────────────────────────────────────────────────────────

function ScorePills({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const t = useTranslations("pages.sectorAssessment");
  return (
    <div className="flex gap-1.5" role="group" aria-label="1-5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          title={t(SCORE_KEY_MAP[v])}
          className={cn(
            "h-9 w-9 rounded-lg border text-sm font-semibold transition-all",
            value === v
              ? v <= 2 ? "bg-red-500 text-white border-red-500"
                : v === 3 ? "bg-amber-500 text-white border-amber-500"
                : "bg-green-500 text-white border-green-500"
              : "border-border hover:bg-muted text-foreground"
          )}
        >
          {v}
        </button>
      ))}
      {value && (
        <span className={cn("self-center text-xs font-medium ml-1", scoreColor(value))}>
          {t(SCORE_KEY_MAP[value])}
        </span>
      )}
    </div>
  );
}

// ─── Create Session Dialog ────────────────────────────────────────────────────

function CreateSessionDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (session: AssessmentSession) => void;
}) {
  const t = useTranslations("pages.sectorAssessment");
  const tCommon = useTranslations("common");
  const create = useCreateSession();
  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setName(""); setPeriod(""); setError(null); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const session = await create.mutateAsync({ name: name.trim(), period_label: period.trim() });
      onCreate(session);
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al crear la sesión"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newSession")}</DialogTitle>
          <DialogDescription>
            {t("newSessionDialogDesc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("sessionNameLabel")}</label>
            <Input
              required autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("sessionNamePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("period")}</label>
            <Input
              required
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder={t("periodPlaceholder")}
            />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon("cancel")}</Button>
            <Button type="submit" disabled={create.isPending || !name.trim() || !period.trim()}>
              {create.isPending ? t("creating") : t("createSession")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Assessment Dialog ─────────────────────────────────────────────────

function CreateAssessmentDialog({
  open,
  onClose,
  onCreate,
  sessionId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (assessment: SectorAssessment) => void;
  sessionId: string;
}) {
  const t = useTranslations("pages.sectorAssessment");
  const tCommon = useTranslations("common");
  const create = useCreateAssessment(sessionId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("DIAGNOSTIC");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setTitle(""); setType("DIAGNOSTIC"); setError(null); }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await create.mutateAsync({ title: title.trim(), engagement_type: type });
      onCreate(result);
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al crear la evaluación"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newAssessment")}</DialogTitle>
          <DialogDescription>
            {t("newAssessmentDesc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("assessmentNameLabel")}</label>
            <Input
              required autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("assessmentNamePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("typeLabel")}</label>
            <div className="grid grid-cols-1 gap-2">
              {Object.keys(ENGAGEMENT_TYPE_KEYS).map((value) => (
                <button
                  key={value} type="button" onClick={() => setType(value)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm text-left transition-colors",
                    type === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  )}
                >
                  <span className={cn("h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                    type === value ? "border-primary" : "border-muted-foreground/40")}>
                    {type === value && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  {t(ENGAGEMENT_TYPE_KEYS[value])}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon("cancel")}</Button>
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? t("creating") : t("startAssessment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Threat Panel ─────────────────────────────────────────────────────────────

function ThreatPanel({
  assessmentId, threatIdx, threatScores, onSaved, onNext,
}: {
  assessmentId: string;
  threatIdx: number;
  threatScores: ThreatScore[];
  onSaved: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("pages.sectorAssessment");
  const threat = EIGHT_THREATS[threatIdx];
  const existing = threatScores.find((ts) => ts.threat_key === threat.key);
  const updateThreat = useUpdateThreat();
  const [dimScores, setDimScores] = useState<Record<string, number>>({});
  const [dimNotes, setDimNotes] = useState<Record<string, string>>({});
  const [benchmark, setBenchmark] = useState<string>("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setBenchmark(existing.benchmark ?? "");
      setEvidence(existing.evidence ?? "");
      const ds: Record<string, number> = {};
      const dn: Record<string, string> = {};
      (existing.dimensions ?? []).forEach((d) => {
        if (d.score !== null) ds[d.dimension_key] = d.score;
        if (d.notes) dn[d.dimension_key] = d.notes;
      });
      setDimScores(ds);
      setDimNotes(dn);
    } else {
      setBenchmark(""); setEvidence(""); setDimScores({}); setDimNotes({});
    }
    setError(null);
  }, [threatIdx, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const avgScore = (() => {
    const scores = threat.dimensions.map((d) => dimScores[d.key]).filter((s): s is number => s !== undefined);
    if (!scores.length) return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  })();

  async function handleSave() {
    setError(null);
    try {
      const dimensions = threat.dimensions
        .map((d) => ({ dimension_key: d.key, score: dimScores[d.key], notes: dimNotes[d.key] || undefined }))
        .filter((d) => d.score !== undefined);
      await updateThreat.mutateAsync({
        id: assessmentId, threat_key: threat.key,
        overall_score: avgScore ?? undefined, benchmark: benchmark || undefined,
        evidence: evidence || undefined, dimensions,
      });
      onSaved();
      onNext();
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al guardar"));
    }
  }

  const colorDot = THREAT_COLORS[threat.color] ?? "bg-gray-400";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className={cn("h-3 w-3 rounded-full mt-1.5 shrink-0", colorDot)} />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{threat.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{threat.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {threat.dimensions.map((dim) => (
          <Card key={dim.key} className="p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">{dim.label}</p>
            <ScorePills
              value={dimScores[dim.key] ?? null}
              onChange={(v) => setDimScores((prev) => ({ ...prev, [dim.key]: v }))}
            />
            <Input
              placeholder="Nota o evidencia (opcional)"
              value={dimNotes[dim.key] ?? ""}
              onChange={(e) => setDimNotes((prev) => ({ ...prev, [dim.key]: e.target.value }))}
              className="text-sm"
            />
          </Card>
        ))}
      </div>

      {avgScore !== null && (
        <div className={cn("flex items-center justify-between rounded-lg border px-4 py-3", scoreBg(avgScore))}>
          <span className="text-sm font-medium">Score calculado</span>
          <span className={cn("text-xl font-bold font-mono", scoreColor(avgScore))}>
            {avgScore}<span className="text-sm font-normal opacity-60">/5</span>
          </span>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Posición vs. sector</p>
        <div className="flex gap-2 flex-wrap">
          {BENCHMARK_OPTIONS.map((opt) => (
            <button
              key={opt.value} type="button" onClick={() => setBenchmark(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm transition-colors",
                benchmark === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Evidencia y contexto</label>
        <Textarea
          rows={3}
          placeholder="Describir la situación actual, datos relevantes o hallazgos..."
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          className="text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-2" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <Button onClick={handleSave} disabled={updateThreat.isPending} className="w-full gap-2">
        {updateThreat.isPending ? "Guardando..." : (
          <>Guardar y continuar <ChevronRight className="h-4 w-4" /></>
        )}
      </Button>
    </div>
  );
}

// ─── ThreatRadar ──────────────────────────────────────────────────────────────

function ThreatRadar({ threatScores }: { threatScores: ThreatScore[] }) {
  const data = EIGHT_THREATS.map((t) => {
    const ts = threatScores.find((s) => s.threat_key === t.key);
    return { subject: RADAR_LABELS[t.key] ?? t.title, score: ts?.overall_score ?? 0, fullMark: 5 };
  });
  if (!data.some((d) => d.score > 0)) return null;
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        Perfil de amenazas
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="62%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#888" }} />
          <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
          <Tooltip formatter={(v) => [`${v}/5`, "Score"]} contentStyle={{
            background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
            borderRadius: "8px", fontSize: "12px",
          }} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── Assessment View (individual) ────────────────────────────────────────────

function AssessmentView({ assessmentId, onBack }: { assessmentId: string; onBack: () => void }) {
  const { data, isPending } = useAssessment(assessmentId);
  const complete = useCompleteAssessment();
  const [activeThreat, setActiveThreat] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const assessment = data as SectorAssessment | undefined;
  const threatScores: ThreatScore[] = assessment?.threat_scores ?? [];
  const completionPct = assessment?.completion_pct ?? 0;
  const allScored = completionPct >= 100;

  const handleSaved = useCallback(() => {}, []);
  const handleNext = useCallback(() => {
    setActiveThreat((prev) => Math.min(prev + 1, EIGHT_THREATS.length - 1));
  }, []);

  async function handleComplete() {
    setError(null);
    try { await complete.mutateAsync(assessmentId); }
    catch (err) { setError(getApiErrorMessage(err, "Error al completar")); }
  }

  if (isPending) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!assessment) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{assessment.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-xs">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{completionPct}% completado</span>
            {assessment.status === "COMPLETED" && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Completado
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <div className="space-y-1">
          {EIGHT_THREATS.map((threat, idx) => {
            const ts = threatScores.find((s) => s.threat_key === threat.key);
            const status = getThreatStatus(ts, EIGHT_THREATS[idx].dimensions.length);
            const isActive = activeThreat === idx;
            const colorDot = THREAT_COLORS[threat.color] ?? "bg-gray-400";
            return (
              <button
                key={threat.key}
                onClick={() => setActiveThreat(idx)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                  isActive ? "bg-sidebar-accent text-sidebar-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colorDot)} />
                <span className="flex-1 min-w-0 text-xs font-medium truncate">{threat.title}</span>
                {status === "complete" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />}
                {status === "partial" && <Circle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                {ts?.overall_score && (
                  <span className={cn("text-xs font-mono font-semibold shrink-0", scoreColor(ts.overall_score))}>
                    {ts.overall_score}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-6 min-w-0">
          <ThreatPanel
            key={`${assessmentId}-${activeThreat}`}
            assessmentId={assessmentId} threatIdx={activeThreat}
            threatScores={threatScores} onSaved={handleSaved} onNext={handleNext}
          />

          {threatScores.length > 0 && <ThreatRadar threatScores={threatScores} />}

          {allScored && assessment.status !== "COMPLETED" && (
            <div className="pt-2 border-t space-y-2">
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button onClick={handleComplete} disabled={complete.isPending} className="gap-2" size="lg">
                <CheckCircle2 className="h-4 w-4" />
                {complete.isPending ? "Completando..." : "Completar evaluación"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dispersion Chart (SVG) ───────────────────────────────────────────────────

const D_START = 110, D_END = 720, D_ROW = 54, D_TOP = 42, D_BOTTOM = 36;
const D_W = 780, D_H = D_TOP + 8 * D_ROW + D_BOTTOM;
const DOT_R = 7;

function dx(s: number) { return D_START + ((s - 1) / 4) * (D_END - D_START); }

function dotColor(s: number) {
  return s <= 2 ? '#ef4444' : s <= 3 ? '#f59e0b' : '#22c55e';
}

function computeJitter(scores: ConsolidatedThreat['scores'], rowH: number, r: number): number[] {
  const groups = new Map<number, number[]>();
  scores.forEach((s, i) => {
    const key = Math.round(s.score * 2);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });
  const jitters = new Array<number>(scores.length).fill(0);
  groups.forEach((indices) => {
    const n = indices.length;
    if (n <= 1) return;
    const step = Math.min(r * 2.4, (rowH * 0.64) / n);
    indices.forEach((idx, pos) => { jitters[idx] = (pos - (n - 1) / 2) * step; });
  });
  return jitters;
}

function DispersionChart({ threats }: { threats: ConsolidatedThreat[] }) {
  return (
    <svg viewBox={`0 0 ${D_W} ${D_H}`} className="w-full" aria-label="Dispersión de puntuaciones">

      {/* Zone colors under axis */}
      <rect x={dx(1)} y={D_TOP} width={dx(2) - dx(1)} height={D_H - D_TOP - D_BOTTOM} fill="#ef4444" fillOpacity={0.035} />
      <rect x={dx(2)} y={D_TOP} width={dx(3) - dx(2)} height={D_H - D_TOP - D_BOTTOM} fill="#f59e0b" fillOpacity={0.025} />
      <rect x={dx(4)} y={D_TOP} width={dx(5) - dx(4)} height={D_H - D_TOP - D_BOTTOM} fill="#22c55e" fillOpacity={0.04} />

      {/* Grid lines */}
      {[1, 2, 3, 4, 5].map((v) => (
        <line key={v} x1={dx(v)} x2={dx(v)} y1={D_TOP - 8} y2={D_H - D_BOTTOM}
          stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} strokeDasharray={v === 3 ? "3 3" : undefined} />
      ))}

      {/* Axis labels */}
      {[1, 2, 3, 4, 5].map((v) => (
        <text key={v} x={dx(v)} y={D_H - D_BOTTOM + 16} textAnchor="middle"
          fontSize={12} fontWeight={500} fill="currentColor" fillOpacity={0.5}>
          {v}
        </text>
      ))}
      {/* Axis zone labels */}
      <text x={(dx(1) + dx(2)) / 2} y={D_H - D_BOTTOM + 30} textAnchor="middle" fontSize={9} fill="#ef4444" fillOpacity={0.6}>Crítico</text>
      <text x={(dx(2) + dx(4)) / 2} y={D_H - D_BOTTOM + 30} textAnchor="middle" fontSize={9} fill="#f59e0b" fillOpacity={0.6}>En desarrollo</text>
      <text x={(dx(4) + dx(5)) / 2} y={D_H - D_BOTTOM + 30} textAnchor="middle" fontSize={9} fill="#22c55e" fillOpacity={0.6}>Fortaleza</text>

      {/* Legend */}
      <g transform={`translate(${D_START}, 20)`}>
        <circle cx={0} cy={0} r={6} fill="#22c55e" fillOpacity={0.85} />
        <circle cx={0} cy={0} r={6} fill="none" stroke="white" strokeOpacity={0.4} strokeWidth={1.5} />
        <text x={9} y={4} fontSize={10} fill="currentColor" fillOpacity={0.6}>≥ 4</text>

        <circle cx={46} cy={0} r={6} fill="#f59e0b" fillOpacity={0.85} />
        <circle cx={46} cy={0} r={6} fill="none" stroke="white" strokeOpacity={0.4} strokeWidth={1.5} />
        <text x={55} y={4} fontSize={10} fill="currentColor" fillOpacity={0.6}>3</text>

        <circle cx={86} cy={0} r={6} fill="#ef4444" fillOpacity={0.85} />
        <circle cx={86} cy={0} r={6} fill="none" stroke="white" strokeOpacity={0.4} strokeWidth={1.5} />
        <text x={95} y={4} fontSize={10} fill="currentColor" fillOpacity={0.6}>≤ 2</text>

        <polygon points="141,-7 149,0 141,7 133,0" fill="#6366f1" fillOpacity={0.9} />
        <text x={153} y={4} fontSize={10} fill="currentColor" fillOpacity={0.6}>Promedio</text>

        <line x1={234} y1={0} x2={252} y2={0} stroke="#a78bfa" strokeWidth={4} strokeLinecap="round" />
        <text x={256} y={4} fontSize={10} fill="currentColor" fillOpacity={0.6}>Calibrado</text>

        <text x={340} y={4} fontSize={9} fill="currentColor" fillOpacity={0.4}>
          Número dentro del ● = score del evaluador
        </text>
      </g>

      {/* Rows */}
      {EIGHT_THREATS.map((t, i) => {
        const threat = threats.find((th) => th.threat_key === t.key);
        const yc = D_TOP + i * D_ROW + D_ROW / 2;

        return (
          <g key={t.key}>
            {/* Alternating row bg */}
            {i % 2 === 0 && (
              <rect x={0} y={D_TOP + i * D_ROW} width={D_W} height={D_ROW}
                fill="currentColor" fillOpacity={0.018} />
            )}

            {/* Row label */}
            <text x={D_START - 8} y={yc + 4} textAnchor="end" fontSize={11} fontWeight={500}
              fill="currentColor" fillOpacity={threat ? 0.8 : 0.3}>
              {RADAR_LABELS[t.key]}
            </text>

            {threat ? (() => {
              const jitters = computeJitter(threat.scores, D_ROW, DOT_R);
              const hasRange = threat.count > 1 && threat.max_score > threat.min_score;

              return (
                <>
                  {/* Range band min→max */}
                  {hasRange && (
                    <rect
                      x={dx(threat.min_score)}
                      y={yc - DOT_R - 3}
                      width={dx(threat.max_score) - dx(threat.min_score)}
                      height={(DOT_R + 3) * 2}
                      rx={DOT_R + 3}
                      fill="currentColor" fillOpacity={0.07}
                    />
                  )}

                  {/* Individual vote dots */}
                  {threat.scores.map((s, j) => {
                    const cx = dx(s.score);
                    const cy = yc + jitters[j];
                    const fill = dotColor(s.score);
                    const scoreLabel = Number.isInteger(s.score) ? String(s.score) : s.score.toFixed(1);
                    return (
                      <g key={j}>
                        <circle cx={cx} cy={cy} r={DOT_R}
                          fill={fill} fillOpacity={0.85}
                          stroke="white" strokeOpacity={0.45} strokeWidth={1.5}>
                          <title>{s.assessor_name ?? 'Evaluador'}: {s.score}/5</title>
                        </circle>
                        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight={700}
                          fill="white" pointerEvents="none">
                          {scoreLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* Average diamond */}
                  {(() => {
                    const mx = dx(threat.avg_score), R = 8;
                    return (
                      <g>
                        <polygon
                          points={`${mx},${yc - R} ${mx + R},${yc} ${mx},${yc + R} ${mx - R},${yc}`}
                          fill="#6366f1" fillOpacity={0.92}
                          stroke="white" strokeOpacity={0.45} strokeWidth={1.5}>
                          <title>Promedio: {threat.avg_score}/5</title>
                        </polygon>
                        <text x={mx} y={yc + R + 11} textAnchor="middle" fontSize={8}
                          fill="#6366f1" fontWeight={700} fillOpacity={0.9}>
                          {threat.avg_score}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Calibrated line */}
                  {threat.calibrated_score != null && (
                    <g>
                      <line
                        x1={dx(threat.calibrated_score) - 10} x2={dx(threat.calibrated_score) + 10}
                        y1={yc} y2={yc}
                        stroke="#a78bfa" strokeWidth={4} strokeLinecap="round">
                        <title>Calibrado: {threat.calibrated_score}/5</title>
                      </line>
                      <text x={dx(threat.calibrated_score)} y={yc - 14} textAnchor="middle"
                        fontSize={9} fill="#a78bfa" fontWeight={700} fillOpacity={0.9}>
                        {threat.calibrated_score}
                      </text>
                    </g>
                  )}

                  {/* Consensus indicator */}
                  <text x={D_W - 6} y={yc + 4} textAnchor="end" fontSize={9}
                    fill={threat.consensus_level === 'LOW' ? '#ef4444' : threat.consensus_level === 'MEDIUM' ? '#f59e0b' : '#22c55e'}
                    fillOpacity={0.75}>
                    {threat.consensus_level === 'LOW' ? '↕ diverge' : threat.consensus_level === 'MEDIUM' ? '~ medio' : '✓ consenso'}
                  </text>
                </>
              );
            })() : (
              <text x={D_START + 8} y={yc + 4} fontSize={10} fill="currentColor" fillOpacity={0.3}>sin datos</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Consolidation Radar ──────────────────────────────────────────────────────

function ConsolidationRadar({ threats }: { threats: ConsolidatedThreat[] }) {
  const data = EIGHT_THREATS.map((t) => {
    const td = threats.find((th) => th.threat_key === t.key);
    return { subject: RADAR_LABELS[t.key], avg: td?.calibrated_score ?? td?.avg_score ?? 0, fullMark: 5 };
  });
  if (!data.some((d) => d.avg > 0)) return null;
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 text-foreground flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        Perfil consolidado
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="62%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#888" }} />
          <Radar name="Consolidado" dataKey="avg" stroke="#6366f1" fill="#6366f1" fillOpacity={0.18} />
          <Tooltip formatter={(v) => [`${v}/5`, "Score"]} contentStyle={{
            background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
            borderRadius: "8px", fontSize: "12px",
          }} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── Strengths & Weaknesses ───────────────────────────────────────────────────

function StrengthsWeaknesses({ threats }: { threats: ConsolidatedThreat[] }) {
  if (threats.length === 0) return null;

  const scored = threats.filter(t => t.avg_score != null);
  const sorted = [...scored].sort((a, b) =>
    (b.calibrated_score ?? b.avg_score) - (a.calibrated_score ?? a.avg_score)
  );
  const strengths = sorted.slice(0, Math.min(3, Math.ceil(sorted.length / 2)));
  const weaknesses = [...sorted].reverse().slice(0, Math.min(3, Math.ceil(sorted.length / 2)));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
          <TrendingUp className="h-4 w-4" /> Puntos fuertes
        </div>
        {strengths.map((t) => {
          const threat = EIGHT_THREATS.find((th) => th.key === t.threat_key);
          const score = t.calibrated_score ?? t.avg_score;
          return (
            <div key={t.threat_key} className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 px-3 py-1.5 min-w-0">
              <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{threat?.title ?? t.threat_key}</span>
              <span className="text-sm font-bold font-mono text-green-700 dark:text-green-400 shrink-0">{score}/5</span>
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
          <TrendingDown className="h-4 w-4" /> Puntos débiles
        </div>
        {weaknesses.map((t) => {
          const threat = EIGHT_THREATS.find((th) => th.key === t.threat_key);
          const score = t.calibrated_score ?? t.avg_score;
          return (
            <div key={t.threat_key} className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-1.5 min-w-0">
              <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{threat?.title ?? t.threat_key}</span>
              <span className="text-sm font-bold font-mono text-red-700 dark:text-red-400 shrink-0">{score}/5</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calibration Panel ────────────────────────────────────────────────────────

function CalibrationPanel({
  threats,
  sessionId,
  initialCalibrated,
}: {
  threats: ConsolidatedThreat[];
  sessionId: string;
  initialCalibrated: Record<string, number> | null;
}) {
  const calibrate = useCalibrateSession();
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    EIGHT_THREATS.forEach((t) => {
      const threat = threats.find((th) => th.threat_key === t.key);
      if (threat) init[t.key] = String(initialCalibrated?.[t.key] ?? threat.avg_score);
    });
    return init;
  });
  const [saved, setSaved] = useState(!!initialCalibrated);

  async function handleSave() {
    const numericScores: Record<string, number> = {};
    Object.entries(scores).forEach(([k, v]) => {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 1 && n <= 5) numericScores[k] = Math.round(n * 10) / 10;
    });
    await calibrate.mutateAsync({ sessionId, scores: numericScores });
    setSaved(true);
  }

  const activeThreats = EIGHT_THREATS.filter((t) => threats.find((th) => th.threat_key === t.key));

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Calibración de scores</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          El promedio es automático. Ajusta si hay contexto que justifique un score diferente al promedio estadístico.
        </p>
      </div>

      <div className="space-y-2">
        {activeThreats.map((t) => {
          const threat = threats.find((th) => th.threat_key === t.key)!;
          return (
            <div key={t.key} className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-1.5">
              {/* fila 1: dimensión + promedio + input de calibración */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-foreground flex-1 truncate min-w-0" title={t.title}>
                  {RADAR_LABELS[t.key]}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  prom:{" "}
                  <span className={cn("font-semibold", scoreColor(threat.avg_score))}>
                    {threat.avg_score}
                  </span>
                </span>
                <input
                  type="number" min="1" max="5" step="0.1"
                  value={scores[t.key] ?? threat.avg_score}
                  onChange={(e) => { setScores((prev) => ({ ...prev, [t.key]: e.target.value })); setSaved(false); }}
                  className="w-14 text-sm border border-input rounded-md px-2 py-0.5 text-center bg-background text-foreground shrink-0"
                />
              </div>
              {/* fila 2: chip por usuario con su nombre y score */}
              <div className="flex flex-wrap gap-1">
                {threat.scores.map((s, i) => {
                  const firstName = s.assessor_name?.split(" ")[0] ?? `Eval. ${i + 1}`;
                  return (
                    <span
                      key={i}
                      title={s.assessor_name ?? undefined}
                      className="inline-flex items-center gap-1 rounded-md bg-background border border-border/70 px-1.5 py-0.5"
                    >
                      <span className="text-[10px] text-muted-foreground leading-none">{firstName}</span>
                      <span className={cn("text-[11px] font-mono font-bold leading-none", scoreColor(s.score))}>
                        {s.score}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={calibrate.isPending} size="sm" variant="outline" className="gap-2">
          {calibrate.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...</> : "Guardar calibración"}
        </Button>
        {saved && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Calibración guardada
          </span>
        )}
      </div>
    </Card>
  );
}

// ─── Document Upload Section ─────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "survey",    label: "Encuesta" },
  { value: "interview", label: "Entrevista" },
  { value: "report",    label: "Informe" },
  { value: "benchmark", label: "Benchmark" },
  { value: "other",     label: "Otro" },
] as const;

function DocumentUploadSection({
  sessionId,
  documents,
}: {
  sessionId: string;
  documents: SessionDocument[];
}) {
  const upload = useUploadSessionDocument(sessionId);
  const remove = useDeleteSessionDocument(sessionId);
  const [docType, setDocType] = useState<string>("survey");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md", "csv"].includes(ext ?? "")) {
      setError("Formato no soportado. Usa PDF, TXT, MD o CSV.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo supera el límite de 10 MB. No es posible cargarlo.");
      return;
    }
    try {
      await upload.mutateAsync({ file, docType });
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al subir el documento"));
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Insumos de soporte</h3>
        <Badge variant="secondary" className="text-xs">{documents.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Sube encuestas, entrevistas, informes o benchmarks. El agente IA los integrará con los scores en el análisis.
      </p>

      {/* Zona de upload */}
      <div className="flex gap-2 items-start">
        <select
          value={docType}
          onChange={e => setDocType(e.target.value)}
          className="text-xs border border-input rounded-md px-2 py-1.5 bg-background text-foreground shrink-0"
        >
          {DOC_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-4 cursor-pointer transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
            upload.isPending && "opacity-50 pointer-events-none",
          )}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          {upload.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground text-center">
            {upload.isPending ? "Procesando..." : "Arrastra o haz clic — PDF, TXT, MD, CSV · máx 10 MB"}
          </span>
          <input
            type="file"
            accept=".pdf,.txt,.md,.csv"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
            disabled={upload.isPending}
          />
        </label>
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}

      {/* Lista de documentos */}
      {documents.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {documents.map(doc => {
            const typeLabel = DOC_TYPES.find(t => t.value === doc.doc_type)?.label ?? doc.doc_type;
            const kbSize = Math.round(doc.size_chars / 10) / 100;
            return (
              <div key={doc.id} className="flex items-center gap-2 rounded-md bg-muted/40 border border-border/60 px-2.5 py-1.5">
                <FileCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {typeLabel} · {kbSize} KB · {doc.uploaded_by_name}
                  </p>
                </div>
                <button
                  onClick={() => remove.mutate(doc.id)}
                  disabled={remove.isPending}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Eliminar documento"
                >
                  {remove.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Session AI Plan Panel ────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  CRITICA:    { label: "Crítica",    bg: "bg-red-50 dark:bg-red-900/20",    text: "text-red-700 dark:text-red-300",    border: "border-red-200 dark:border-red-800" },
  ALTA:       { label: "Alta",       bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  MODERADA:   { label: "Moderada",   bg: "bg-amber-50 dark:bg-amber-900/20",  text: "text-amber-700 dark:text-amber-300",  border: "border-amber-200 dark:border-amber-800" },
  BUENA:      { label: "Buena",      bg: "bg-blue-50 dark:bg-blue-900/20",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-200 dark:border-blue-800" },
  EXCELENTE:  { label: "Excelente",  bg: "bg-green-50 dark:bg-green-900/20",  text: "text-green-700 dark:text-green-300",  border: "border-green-200 dark:border-green-800" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? { label: priority, bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border", cfg.bg, cfg.text, cfg.border)}>
      {cfg.label}
    </span>
  );
}

const ROADMAP_ITEMS = [
  { key: "acciones_30d" as const,       label: "30 días",   bg: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",   text: "text-red-700 dark:text-red-300" },
  { key: "iniciativas_90d" as const,    label: "90 días",   bg: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
  { key: "transformaciones_180d" as const, label: "180 días", bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",   text: "text-blue-700 dark:text-blue-300" },
] as const;

function FortalezaCard({ item, type }: { item: AiFortaleza; type: 'fortaleza' | 'debilidad' }) {
  const threat = EIGHT_THREATS.find((t) => t.key === item.threat_key);
  const isStrength = type === 'fortaleza';
  return (
    <div className={cn(
      "rounded-lg border p-3 flex items-start gap-3",
      isStrength ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                 : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{threat?.title ?? item.threat_key}</span>
          <span className={cn("text-sm font-bold font-mono", isStrength ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
            {item.score}/5
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.razon}</p>
      </div>
    </div>
  );
}

function SessionAiPlanPanel({
  session,
  sessionId,
  completedCount,
  onAnalyze,
  isPending,
}: {
  session: AssessmentSession;
  sessionId: string;
  completedCount: number;
  onAnalyze: () => void;
  isPending: boolean;
}) {
  const plan = session.ai_plan as SessionAiPlan | null | undefined;
  const downloadPdf = useDownloadSessionPdf();

  if (isPending) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">El agente analiza los {completedCount} diagnósticos...</p>
          <p className="text-xs text-muted-foreground">Identifica fortalezas, debilidades y genera recomendaciones</p>
        </div>
      </Card>
    );
  }

  if (!plan || plan.error) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Análisis IA consolidado
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Identifica fortalezas, debilidades, genera plan de acción con hoja de ruta a 30/90/180 días
            </p>
            {plan?.error && <p className="text-xs text-destructive mt-1">{plan.error}</p>}
          </div>
          <Button onClick={onAnalyze} className="gap-2 shrink-0">
            <Sparkles className="h-4 w-4" /> Generar análisis IA
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Análisis IA consolidado
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPdf.mutate(sessionId)}
            disabled={downloadPdf.isPending}
            className="gap-1.5"
          >
            {downloadPdf.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</>
              : <><Download className="h-3.5 w-3.5" /> Descargar PDF</>
            }
          </Button>
          <Button variant="outline" size="sm" onClick={onAnalyze} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerar
          </Button>
        </div>
      </div>

      {/* Fortalezas y Debilidades */}
      {((plan.fortalezas?.length ?? 0) > 0 || (plan.debilidades?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(plan.fortalezas?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                <TrendingUp className="h-4 w-4" /> Puntos fuertes
              </div>
              {plan.fortalezas.map((f, i) => <FortalezaCard key={i} item={f} type="fortaleza" />)}
            </div>
          )}
          {(plan.debilidades?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
                <TrendingDown className="h-4 w-4" /> Puntos débiles
              </div>
              {plan.debilidades.map((d, i) => <FortalezaCard key={i} item={d} type="debilidad" />)}
            </div>
          )}
        </div>
      )}

      {/* Diagnostic */}
      {plan.diagnostico_general && (
        <Card className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnóstico general</p>
          <p className="text-sm text-foreground leading-relaxed">{plan.diagnostico_general}</p>
        </Card>
      )}

      {/* Consensus */}
      {plan.insights_consenso && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Consenso entre evaluadores</p>
          <p className="text-sm text-foreground leading-relaxed">{plan.insights_consenso}</p>
        </Card>
      )}

      {/* Síntesis de insumos documentales */}
      {plan.resumen_insumos && (
        <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
              Síntesis de insumos documentales
            </p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{plan.resumen_insumos}</p>
        </Card>
      )}

      {/* Roadmap */}
      {plan.roadmap && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {ROADMAP_ITEMS.map(({ key, label, bg, text }) => (
            <div key={key} className={cn("rounded-lg border p-4", bg)}>
              <p className={cn("text-xs font-semibold mb-2", text)}>{label}</p>
              <ul className="space-y-1.5">
                {(plan.roadmap?.[key] ?? []).map((action, i) => (
                  <li key={i} className="text-xs text-foreground flex gap-2">
                    <span className="shrink-0 opacity-60 font-bold">·</span>{action}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Per-threat */}
      {plan.por_amenaza && Object.keys(plan.por_amenaza).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalle por amenaza</p>
          <div className="grid grid-cols-1 gap-3">
            {EIGHT_THREATS.filter((t) => plan.por_amenaza[t.key]).map((t) => {
              const tp = plan.por_amenaza[t.key];
              return (
                <Card key={t.key} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{t.title}</p>
                    <PriorityBadge priority={tp.prioridad} />
                  </div>
                  {tp.diagnostico && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">{tp.diagnostico}</p>
                  )}
                  <p className="text-xs text-foreground leading-relaxed">{tp.plan_accion}</p>
                  {(tp.kpis?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tp.kpis.map((kpi, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">{kpi}</span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Participants Panel ───────────────────────────────────────────────────────

function ParticipantRow({
  participant,
  isAdmin,
  onRemove,
  isRemoving,
}: {
  participant: SessionParticipant;
  isAdmin: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const initials = participant.user_name
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
        participant.completed
          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      )}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{participant.user_name}</p>
        {!participant.completed && participant.completion_pct > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[80px]">
              <div className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${participant.completion_pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{participant.completion_pct}%</span>
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {participant.completed ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3" /> Completado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5">
            <Circle className="h-3 w-3" /> Pendiente
          </span>
        )}
        {isAdmin && (
          <button
            onClick={onRemove}
            disabled={isRemoving}
            className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
            title="Quitar participante"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ParticipantsPanel({ sessionId, isAdmin }: { sessionId: string; isAdmin: boolean }) {
  const { data: participants = [], isLoading } = useSessionParticipants(sessionId);
  const { data: members = [] } = useOrgMembers();
  const addParticipant = useAddParticipant(sessionId);
  const removeParticipant = useRemoveParticipant(sessionId);
  const notifyParticipants = useNotifyParticipants(sessionId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);

  const completed = participants.filter((p) => p.completed);
  const pending   = participants.filter((p) => !p.completed);
  const pct = participants.length ? Math.round((completed.length / participants.length) * 100) : 0;

  const alreadyAdded = new Set(participants.map((p) => p.user_id));
  const available = members.filter((m) => !alreadyAdded.has(m.user_id));

  async function handleNotify() {
    await notifyParticipants.mutateAsync();
    setNotifyDone(true);
    setTimeout(() => setNotifyDone(false), 3000);
  }

  if (isLoading) {
    return <div className="h-24 rounded-lg bg-muted animate-pulse" />;
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Participantes convocados</span>
          {participants.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {completed.length}/{participants.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && pending.length > 0 && (
            <Button
              size="sm" variant="outline"
              className="gap-1.5 h-7 text-xs"
              disabled={notifyParticipants.isPending || notifyDone}
              onClick={handleNotify}
            >
              {notifyDone
                ? <><Check className="h-3 w-3 text-green-500" /> Enviado</>
                : notifyParticipants.isPending
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</>
                  : "Notificar pendientes"
              }
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
              onClick={() => setPickerOpen(true)}>
              <Plus className="h-3 w-3" /> Agregar
            </Button>
          )}
        </div>
      </div>

      {participants.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Agrega los participantes para hacer seguimiento de quién ha completado el diagnóstico."
              : "El administrador aún no ha definido la lista de participantes."}
          </p>
        </div>
      ) : (
        <div className="p-2">
          {/* Progress bar */}
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              <span className="font-semibold text-green-600 dark:text-green-400">{completed.length}</span>
              {" de "}{participants.length} completaron
            </span>
          </div>

          {/* Completed section */}
          {completed.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Completaron ({completed.length})
              </p>
              {completed.map((p) => (
                <ParticipantRow
                  key={p.user_id}
                  participant={p}
                  isAdmin={isAdmin}
                  onRemove={() => removeParticipant.mutate(p.user_id)}
                  isRemoving={removeParticipant.isPending}
                />
              ))}
            </div>
          )}

          {/* Pending section */}
          {pending.length > 0 && (
            <div className={cn(completed.length > 0 && "mt-2 pt-2 border-t")}>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pendientes ({pending.length})
              </p>
              {pending.map((p) => (
                <ParticipantRow
                  key={p.user_id}
                  participant={p}
                  isAdmin={isAdmin}
                  onRemove={() => removeParticipant.mutate(p.user_id)}
                  isRemoving={removeParticipant.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Member picker dialog */}
      {isAdmin && (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar participante</DialogTitle>
              <DialogDescription>
                Selecciona los miembros de la organización que deben completar este diagnóstico.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Todos los miembros ya están agregados.
                </p>
              ) : (
                available.map((m, i) => (
                  <button key={m.user_id ?? String(i)}
                    onClick={() => { addParticipant.mutate(m.user_id); }}
                    disabled={addParticipant.isPending}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors disabled:opacity-50">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPickerOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

// ─── Session View ─────────────────────────────────────────────────────────────

type SessionTab = "evaluaciones" | "consolidacion";

function SessionView({
  sessionId,
  onBack,
  onOpenAssessment,
}: {
  sessionId: string;
  onBack: () => void;
  onOpenAssessment: (id: string) => void;
}) {
  const { data: session } = useSession(sessionId);
  const { data: assessments, isPending: loadingAssessments } = useSessionAssessments(sessionId);
  const { data: consolidation, isPending: loadingConsolidation } = useSessionConsolidation(sessionId);
  const deleteAssessment = useDeleteAssessment();
  const analyzeSession = useAnalyzeSession();
  const [tab, setTab] = useState<SessionTab>("evaluaciones");
  const [createOpen, setCreateOpen] = useState(false);

  const s = session as AssessmentSession | undefined;
  const list = assessments ?? [];
  const consData = consolidation as SessionConsolidation | undefined;
  const threats = consData?.threats ?? [];
  const completedCount = consData?.meta?.completed_count ?? 0;

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 mt-0.5">
          <ChevronLeft className="h-4 w-4" /> Sesiones
        </Button>
        <div className="flex-1 min-w-0">
          {s ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{s.name}</h1>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Calendar className="h-3 w-3" /> {s.period_label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                <Users className="h-3.5 w-3.5 inline mr-1" />
                {s.completed_assessments}/{s.total_assessments} evaluaciones completadas
                {s.avg_score && <span className="ml-2 font-medium text-foreground">&nbsp;·&nbsp; Promedio: {s.avg_score}/5</span>}
              </p>
            </>
          ) : (
            <div className="h-7 w-64 bg-muted animate-pulse rounded" />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b -mb-2">
        {([
          { id: "evaluaciones", label: "Evaluaciones" },
          { id: "consolidacion", label: "Consolidación" },
        ] as { id: SessionTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.id === "evaluaciones" && list.length > 0 && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{list.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "evaluaciones" ? (
        <div className="space-y-4">
          <ParticipantsPanel sessionId={sessionId} isAdmin={isAdmin} />

          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Agregar mi evaluación
            </Button>
          </div>

          {loadingAssessments ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : list.length === 0 ? (
            <Card className="overflow-hidden">
              <EmptyState
                icon={Stethoscope}
                title="Sin evaluaciones aún"
                description="Sé el primero en agregar tu evaluación individual a esta sesión"
                actionLabel="Agregar mi evaluación"
                onAction={() => setCreateOpen(true)}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {list.map((a) => (
                <Card key={a.id} className="p-5 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => onOpenAssessment(a.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant={a.status === "COMPLETED" ? "default" : "secondary"}>
                          {a.status === "COMPLETED" ? "Completada" : "En progreso"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {ENGAGEMENT_LABELS[a.engagement_type] ?? a.engagement_type}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground truncate">{a.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(a.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                        {a.created_by_name && ` · ${a.created_by_name}`}
                      </p>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Completado</span>
                          <span className="font-medium text-foreground">{a.completion_pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${a.completion_pct}%` }} />
                        </div>
                      </div>
                      {a.avg_score && (
                        <p className={cn("text-sm font-semibold mt-2", scoreColor(a.avg_score))}>
                          Score: {a.avg_score}/5
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAssessment.mutate(a.id); }}
                      disabled={deleteAssessment.isPending}
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <CreateAssessmentDialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            sessionId={sessionId}
            onCreate={(a) => { setCreateOpen(false); onOpenAssessment(a.id); }}
          />
        </div>
      ) : (
        // Consolidación tab
        <div className="space-y-6">
          {loadingConsolidation ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : completedCount === 0 ? (
            <Card className="overflow-hidden">
              <EmptyState
                icon={Activity}
                title="Sin evaluaciones completadas"
                description="Al menos una persona debe completar su evaluación para ver la consolidación"
              />
            </Card>
          ) : (
            <>
              {/* Strengths & Weaknesses (auto-computed) */}
              <Card className="p-5">
                <StrengthsWeaknesses threats={threats} />
              </Card>

              {/* Dispersion — full width */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Dispersión de puntuaciones
                </h3>
                <DispersionChart threats={threats} />
              </Card>

              {/* Radar + Calibration side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <ConsolidationRadar threats={threats} />
                <CalibrationPanel
                  threats={threats}
                  sessionId={sessionId}
                  initialCalibrated={consData?.session?.calibrated_scores ?? null}
                />
              </div>

              {/* Insumos de soporte + Análisis IA */}
              {s && (
                <>
                  <DocumentUploadSection
                    sessionId={sessionId}
                    documents={s.session_documents ?? []}
                  />
                  <SessionAiPlanPanel
                    session={s}
                    sessionId={sessionId}
                    completedCount={completedCount}
                    onAnalyze={() => analyzeSession.mutate(sessionId)}
                    isPending={analyzeSession.isPending}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sessions List ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onOpen,
  onDelete,
}: {
  session: AssessmentSession;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const del = useDeleteSession();
  return (
    <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow group" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Calendar className="h-3 w-3" /> {session.period_label}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {session.completed_assessments}/{session.total_assessments} completadas
            </span>
          </div>
          <h3 className="font-semibold text-foreground truncate">{session.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(session.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
            {session.created_by_name && ` · ${session.created_by_name}`}
          </p>

          {/* Progress */}
          {session.total_assessments > 0 && (
            <div className="mt-3 space-y-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((session.completed_assessments / session.total_assessments) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {session.avg_score && (
            <p className={cn("text-sm font-semibold mt-2", scoreColor(session.avg_score))}>
              Score promedio: {session.avg_score}/5
            </p>
          )}
          {session.ai_plan && !('error' in session.ai_plan) && (
            <p className="text-xs text-primary flex items-center gap-1 mt-1">
              <Sparkles className="h-3 w-3" /> Plan IA generado
            </p>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); del.mutate(session.id, { onSuccess: onDelete }); }}
          disabled={del.isPending}
          className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-opacity shrink-0"
          aria-label="Eliminar sesión"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}

// ─── Participant View (SECTOR_DIAGNOSTICS role) ───────────────────────────────

function ParticipantView() {
  const { user } = useAuthStore();
  const { data: mySession, isPending } = useMySession();
  const createAssessment = useCreateAssessment(mySession?.id);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [inForm, setInForm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (mySession?.my_assessment_id && assessmentId === null) {
      setAssessmentId(mySession.my_assessment_id);
    }
  }, [mySession?.my_assessment_id, assessmentId]);

  if (isPending) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-52 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!mySession) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <UserX className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Usuario sin perfil asignado</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            No tienes asignado acceso a ninguna sesión de diagnóstico.
            Comunícate con el administrador para que te incluya en una sesión.
          </p>
        </div>
      </div>
    );
  }

  if (inForm && assessmentId) {
    return <AssessmentView assessmentId={assessmentId} onBack={() => setInForm(false)} />;
  }

  async function handleStart() {
    setStartError(null);
    setStarting(true);
    try {
      let id = assessmentId;
      if (!id) {
        const assessment = await createAssessment.mutateAsync({
          title: `Valoración — ${user?.name ?? "Participante"}`,
          engagement_type: "DIAGNOSTIC",
        });
        id = assessment.id;
        setAssessmentId(id);
      }
      setInForm(true);
    } catch (err) {
      setStartError(getApiErrorMessage(err, "Error al iniciar la valoración"));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Diagnóstico Sectorial"
        description={`${mySession.name} · ${mySession.period_label}`}
      />
      <Card className="p-6 space-y-5 max-w-xl">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{mySession.name}</h3>
            <p className="text-sm text-muted-foreground">{mySession.period_label}</p>
          </div>
          {assessmentId && (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Activity className="h-3 w-3" /> En progreso
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Evalúa las <strong className="text-foreground">8 amenazas estructurales</strong> de la organización.
          Tu valoración individual, junto con la de los demás participantes, formará parte del diagnóstico consolidado.
        </p>

        {startError && <p className="text-sm text-destructive">{startError}</p>}

        <Button onClick={handleStart} disabled={starting} className="gap-2">
          {starting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Iniciando...</>
            : assessmentId
              ? <><ClipboardList className="h-4 w-4" /> Continuar valoración</>
              : <><Plus className="h-4 w-4" /> Iniciar valoración</>
          }
        </Button>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = "sessions" | "session" | "assessment";

function AdminView() {
  const { data: sessions, isPending } = useSessions();
  const [view, setView] = useState<View>("sessions");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function openSession(id: string) { setSessionId(id); setView("session"); }
  function openAssessment(id: string) { setAssessmentId(id); setView("assessment"); }
  function backToSessions() { setView("sessions"); setSessionId(null); }
  function backToSession() { setView("session"); setAssessmentId(null); }

  if (view === "assessment" && assessmentId) {
    return (
      <AssessmentView
        assessmentId={assessmentId}
        onBack={backToSession}
      />
    );
  }

  if (view === "session" && sessionId) {
    return (
      <SessionView
        sessionId={sessionId}
        onBack={backToSessions}
        onOpenAssessment={openAssessment}
      />
    );
  }

  const list = sessions ?? [];

  if (isPending) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Diagnóstico Sectorial" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Diagnóstico Sectorial"
        description="Gestiona sesiones de diagnóstico colectivo de las 8 amenazas estructurales"
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva sesión
          </Button>
        }
      />

      {list.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={Stethoscope}
            title="Sin sesiones de diagnóstico"
            description="Crea una sesión para que múltiples personas evalúen las 8 amenazas estructurales y obtener un diagnóstico consolidado"
            actionLabel="Nueva sesión"
            onAction={() => setCreateOpen(true)}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {list.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onOpen={() => openSession(s.id)}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}

      <CreateSessionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(s) => { setCreateOpen(false); openSession(s.id); }}
      />
    </div>
  );
}

export default function SectorAssessmentPage() {
  const user = useAuthStore(s => s.user);
  if (user?.role === "SECTOR_DIAGNOSTICS") return <ParticipantView />;
  return <AdminView />;
}
