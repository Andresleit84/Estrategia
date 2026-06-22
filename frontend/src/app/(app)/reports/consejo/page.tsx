"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useConsejoPackage } from "@/hooks/useConsejoPackage";
import type { BoardGuardrail, BoardDecision } from "@/hooks/useConsejoPackage";
import { useGuardrails, useUpsertGuardrail, useDeleteGuardrail } from "@/hooks/useGuardrails";
import { useUpsertBoardDecision, useDeleteBoardDecision } from "@/hooks/useBoardDecisions";
import { useCycles } from "@/hooks/useCycles";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, Printer, AlertTriangle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Star, Shield, Gavel,
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus,
  ArrowUpCircle, ArrowRightCircle, ArrowDownCircle,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}
function fmtPct(n: number | null | undefined) {
  return `${Number(n ?? 0).toFixed(0)}%`;
}

const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "En curso", AT_RISK: "En riesgo", BEHIND: "Rezagado",
  COMPLETED: "Completado", DRAFT: "Borrador", ACTIVE: "Activo", CANCELLED: "Cancelado",
};
const CYCLE_STATUS_KEY: Record<string, string> = {
  ACTIVE: "statusActive", CLOSED: "statusClosed", DRAFT: "statusDraft",
};
const STATUS_CHIP: Record<string, string> = {
  ON_TRACK:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  AT_RISK:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  BEHIND:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DRAFT:     "bg-muted text-muted-foreground",
};

const GUARDRAIL_STATUS_COLOR: Record<string, string> = {
  VERDE: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  AMBER: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  ROJO:  "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
};
const GUARDRAIL_LEFT_BORDER: Record<string, string> = {
  VERDE: "border-l-green-500",
  AMBER: "border-l-amber-500",
  ROJO:  "border-l-red-500",
};
const DECISION_STATUS_COLOR: Record<string, string> = {
  PENDING:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DECIDED:  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  DEFERRED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CLOSED:   "bg-muted text-muted-foreground",
};
const DECISION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente", DECIDED: "Decidida", DEFERRED: "Diferida", CLOSED: "Cerrada",
};

const GUARDRAIL_CATEGORIES = [
  "Prudencia financiera",
  "Cumplimiento, ética y reputación",
  "Riesgo operacional y continuidad",
  "Cliente y misión",
  "Disciplina de ejecución",
];

const PRINT_STYLES = `
@media print {
  aside, nav, [data-print-hide] { display: none !important; }
  body { background: white !important; color: black !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-break-before { page-break-before: always; }
}
`;

// ── Shared primitives ─────────────────────────────────────────────────────────

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={cn("h-2 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", STATUS_CHIP[status] ?? "bg-muted text-muted-foreground")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "UP" | "STABLE" | "DOWN" }) {
  if (trend === "UP")     return <TrendingUp   className="h-4 w-4 text-green-500" />;
  if (trend === "DOWN")   return <TrendingDown  className="h-4 w-4 text-red-500"   />;
  return                         <Minus         className="h-4 w-4 text-muted-foreground" />;
}

function SemáforoCircle({ status }: { status: "VERDE" | "AMBER" | "ROJO" }) {
  const colors = { VERDE: "bg-green-500", AMBER: "bg-amber-400", ROJO: "bg-red-500" };
  const labels = { VERDE: "Verde", AMBER: "Ámbar", ROJO: "Rojo" };
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", colors[status])} />
      <span className="text-xs font-medium">{labels[status]}</span>
    </span>
  );
}

// ── ConsejoSkeleton ────────────────────────────────────────────────────────────

function ConsejoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ── AreaSection ────────────────────────────────────────────────────────────────

function AreaSection({ area_name, objectives }: { area_name: string; objectives: Array<{ id: string; code: string | null; title: string; progress: number; status: string }> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{area_name}</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{objectives.length}</Badge>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="divide-y">
          {objectives.map(obj => (
            <div key={obj.id} className="px-4 py-3 grid grid-cols-[1fr_100px_80px] gap-3 items-center text-sm">
              <div className="min-w-0">
                {obj.code && <span className="text-xs font-mono text-muted-foreground mr-2">{obj.code}</span>}
                <span className="font-medium">{obj.title}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ProgressBar value={obj.progress} className="flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{fmtPct(obj.progress)}</span>
                </div>
              </div>
              <div className="flex justify-end"><StatusChip status={obj.status} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GovernanceRow ──────────────────────────────────────────────────────────────

const GOV_STATUS_CHIP: Record<string, string> = {
  UPCOMING:    "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  OVERDUE:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ── KRs Críticos section ───────────────────────────────────────────────────────

function CriticalKRsSection({ criticalKRs }: { criticalKRs: NonNullable<ReturnType<typeof useConsejoPackage>["data"]>["critical_krs"] }) {
  if (!criticalKRs?.length) {
    return (
      <Card className="p-6 text-center border-dashed">
        <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium text-muted-foreground">Sin KRs Críticos configurados</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Los KRs Críticos son los "gates" del OKR: si fallan, el objetivo no cuenta aunque otros KRs estén en verde.
          Un administrador puede marcarlos desde la edición de cada KR en{" "}
          <Link href="/strategic" className="underline hover:text-foreground">Estratégico</Link> o{" "}
          <Link href="/tactical" className="underline hover:text-foreground">Táctico</Link>.
        </p>
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-amber-50 dark:bg-amber-950/20 text-xs text-muted-foreground uppercase tracking-wide border-b border-amber-200 dark:border-amber-900">
            <th className="text-left px-4 py-3 font-semibold">KR (Gate)</th>
            <th className="text-left px-4 py-3 font-semibold">Objetivo</th>
            <th className="text-left px-4 py-3 font-semibold w-36">Avance</th>
            <th className="text-left px-4 py-3 font-semibold w-24">Confianza</th>
            <th className="text-left px-4 py-3 font-semibold w-28">Estado</th>
            <th className="text-right px-4 py-3 font-semibold w-28">Último CI</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {criticalKRs.map(kr => {
            const isAlert = kr.status === "AT_RISK" || kr.status === "BEHIND" || kr.confidence < 50;
            return (
              <tr key={kr.id} className={cn("transition-colors", isAlert ? "bg-red-50/30 dark:bg-red-950/10" : "hover:bg-muted/20")}>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Star className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" aria-label="KR Crítico" />
                    <div>
                      {kr.code && <span className="text-xs font-mono text-muted-foreground mr-1">{kr.code}</span>}
                      <span className="font-medium">{kr.title}</span>
                      {kr.owner_name && <p className="text-xs text-muted-foreground mt-0.5">{kr.owner_name}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {kr.objective_code && <span className="font-mono mr-1">{kr.objective_code}</span>}
                  {kr.objective_title}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={kr.progress} className="w-20" />
                    <span className="text-xs tabular-nums text-muted-foreground">{fmtPct(kr.progress)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("h-2 w-2 rounded-full", kr.confidence >= 70 ? "bg-green-500" : kr.confidence >= 40 ? "bg-amber-400" : "bg-red-500")} />
                    <span className="text-xs tabular-nums">{fmtPct(kr.confidence)}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusChip status={kr.status} /></td>
                <td className="px-4 py-3 text-right">
                  {kr.days_since_checkin < 0 ? (
                    <span className="text-xs text-red-500">Sin check-in</span>
                  ) : (
                    <span className={cn("text-xs tabular-nums flex items-center justify-end gap-1", kr.days_since_checkin > 14 ? "text-red-500" : "text-muted-foreground")}>
                      <Clock className="h-3 w-3" />
                      {kr.days_since_checkin}d
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Guardrail Form Dialog ──────────────────────────────────────────────────────

interface GuardrailFormState {
  category: string;
  title: string;
  risk_description: string;
  kri_description: string;
  threshold: string;
  escalation_trigger: string;
  owner: string;
  status: "VERDE" | "AMBER" | "ROJO";
  trend: "UP" | "STABLE" | "DOWN";
}

function GuardrailDialog({
  open, onClose, initial, guardrailId,
}: {
  open: boolean;
  onClose: () => void;
  initial: Partial<BoardGuardrail>;
  guardrailId?: string;
}) {
  const [form, setForm] = useState<GuardrailFormState>({
    category: initial.category ?? GUARDRAIL_CATEGORIES[0],
    title: initial.title ?? "",
    risk_description: initial.risk_description ?? "",
    kri_description: initial.kri_description ?? "",
    threshold: initial.threshold ?? "",
    escalation_trigger: initial.escalation_trigger ?? "",
    owner: initial.owner ?? "",
    status: (initial.status ?? "VERDE") as GuardrailFormState["status"],
    trend: (initial.trend ?? "STABLE") as GuardrailFormState["trend"],
  });
  const upsert = useUpsertGuardrail();

  const save = async () => {
    if (!form.title.trim()) return;
    await upsert.mutateAsync({ id: guardrailId, data: form });
    onClose();
  };

  const field = (label: string, key: keyof GuardrailFormState, type: "input" | "textarea" = "input") => (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {type === "textarea" ? (
        <textarea
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[64px] focus:outline-none focus:ring-1 focus:ring-ring"
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{guardrailId ? "Editar No Negociable" : "Agregar No Negociable"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoría</label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              {GUARDRAIL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {field("Enunciado (claro, no ambiguo)", "title")}
          {field("Riesgo que protege", "risk_description", "textarea")}
          {field("Indicador / KRI y fuente", "kri_description", "textarea")}
          {field("Umbral / criterio", "threshold")}
          {field("Trigger de escalamiento", "escalation_trigger", "textarea")}
          {field("Dueño ejecutivo", "owner")}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado (semáforo)</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as "VERDE" | "AMBER" | "ROJO" }))}
              >
                <option value="VERDE">Verde — Dentro de límites</option>
                <option value="AMBER">Ámbar — En observación</option>
                <option value="ROJO">Rojo — Breach / escalamiento</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tendencia</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.trend}
                onChange={e => setForm(f => ({ ...f, trend: e.target.value as "UP" | "STABLE" | "DOWN" }))}
              >
                <option value="UP">Mejorando</option>
                <option value="STABLE">Estable</option>
                <option value="DOWN">Deteriorando</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={upsert.isPending || !form.title.trim()}>
            {upsert.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Guardrails section ─────────────────────────────────────────────────────────

function GuardrailsSection({ guardrails, canEdit }: { guardrails: BoardGuardrail[]; canEdit: boolean }) {
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<BoardGuardrail | null>(null);
  const deleteG = useDeleteGuardrail();
  const { data: liveGuardrails = guardrails } = useGuardrails();

  const openNew = () => { setEditing(null); setDlgOpen(true); };
  const openEdit = (g: BoardGuardrail) => { setEditing(g); setDlgOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            No Negociables del Consejo — Guardrails
          </h3>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={openNew} data-print-hide>
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        )}
      </div>

      {!liveGuardrails.length ? (
        <Card className="p-6 text-center border-dashed">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-muted-foreground">Sin No Negociables configurados</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Define los límites que el Consejo no puede transgredir: prudencia financiera, cumplimiento,
            riesgo operacional y disciplina de ejecución.
          </p>
          {canEdit && (
            <Button variant="outline" size="sm" className="mt-4" onClick={openNew} data-print-hide>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Definir primer guardrail
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {liveGuardrails.map(g => (
            <Card key={g.id} className={cn("p-4 border-l-4", GUARDRAIL_LEFT_BORDER[g.status] ?? "border-l-muted")}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{g.category}</Badge>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", GUARDRAIL_STATUS_COLOR[g.status])}>
                      <SemáforoCircle status={g.status} />
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendIcon trend={g.trend} />
                      {g.trend === "UP" ? "Mejorando" : g.trend === "DOWN" ? "Deteriorando" : "Estable"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{g.title}</p>
                  {g.kri_description && <p className="text-xs text-muted-foreground">Señal: {g.kri_description}</p>}
                  {g.threshold && <p className="text-xs text-muted-foreground">Umbral: {g.threshold}</p>}
                  {g.escalation_trigger && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Trigger: {g.escalation_trigger}
                    </p>
                  )}
                  {g.owner && <p className="text-xs text-muted-foreground">Dueño: {g.owner}</p>}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0" data-print-hide>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteG.mutate(g.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <GuardrailDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        initial={editing ?? {}}
        guardrailId={editing?.id}
      />
    </div>
  );
}

// ── Decision Form Dialog ───────────────────────────────────────────────────────

function DecisionDialog({
  open, onClose, initial, decisionId, cycleId,
}: {
  open: boolean;
  onClose: () => void;
  initial: Partial<BoardDecision & { cycle_id?: string }>;
  decisionId?: string;
  cycleId: string;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [context, setContext] = useState(initial.context ?? "");
  const [options, setOptions] = useState<string[]>(initial.options ?? [""]);
  const [recommendation, setRecommendation] = useState(initial.recommendation ?? "");
  const [status, setStatus] = useState<BoardDecision["status"]>(initial.status ?? "PENDING");
  const [owner, setOwner] = useState(initial.owner ?? "");
  const [decisionNote, setDecisionNote] = useState(initial.decision_note ?? "");
  const upsert = useUpsertBoardDecision();

  const save = async () => {
    if (!title.trim()) return;
    await upsert.mutateAsync({
      id: decisionId,
      data: { cycle_id: cycleId, title, context, options: options.filter(o => o.trim()), recommendation, status, owner, decision_note: decisionNote },
    });
    onClose();
  };

  const addOption = () => setOptions(o => [...o, ""]);
  const removeOption = (i: number) => setOptions(o => o.filter((_, idx) => idx !== i));
  const setOption = (i: number, v: string) => setOptions(o => o.map((x, idx) => idx === i ? v : x));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{decisionId ? "Editar Decisión" : "Agregar Decisión Solicitada"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Decisión solicitada</label>
            <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué necesita resolver el Consejo?" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contexto / Por qué escala</label>
            <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[72px] focus:outline-none focus:ring-1 focus:ring-ring"
              value={context} onChange={e => setContext(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Opciones</label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`Opción ${i+1}`} />
                {options.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeOption(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 mt-1 text-xs" onClick={addOption}>
              <Plus className="h-3 w-3" /> Agregar opción
            </Button>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recomendación</label>
            <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[64px] focus:outline-none focus:ring-1 focus:ring-ring"
              value={recommendation} onChange={e => setRecommendation(e.target.value)} placeholder="Opción recomendada por la dirección" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={status} onChange={e => setStatus(e.target.value as BoardDecision["status"])}>
                <option value="PENDING">Pendiente</option>
                <option value="DECIDED">Decidida</option>
                <option value="DEFERRED">Diferida</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsable de seguimiento</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={owner} onChange={e => setOwner(e.target.value)} />
            </div>
          </div>
          {status === "DECIDED" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resolución del Consejo</label>
              <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[64px] focus:outline-none focus:ring-1 focus:ring-ring"
                value={decisionNote} onChange={e => setDecisionNote(e.target.value)} placeholder="¿Qué decidió el Consejo? ¿Cómo se verá en el próximo Pulso?" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={upsert.isPending || !title.trim()}>
            {upsert.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Decisions section ──────────────────────────────────────────────────────────

function DecisionsSection({ decisions, canEdit, cycleId }: { decisions: BoardDecision[]; canEdit: boolean; cycleId: string }) {
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<BoardDecision | null>(null);
  const deleteD = useDeleteBoardDecision();

  const pending = decisions.filter(d => d.status === "PENDING").length;
  const canAdd = canEdit && decisions.length < 3;

  const openNew = () => { setEditing(null); setDlgOpen(true); };
  const openEdit = (d: BoardDecision) => { setEditing(d); setDlgOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Decisiones Solicitadas al Consejo
          </h3>
          {pending > 0 && (
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0 text-xs">
              {pending} pendiente{pending > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2" data-print-hide>
            {decisions.length >= 3 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Máx. 3 decisiones por sesión</span>
            )}
            <Button
              variant="outline" size="sm" className="gap-1.5 h-8"
              onClick={openNew} disabled={!canAdd}
            >
              <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
          </div>
        )}
      </div>

      {!decisions.length ? (
        <Card className="p-6 text-center border-dashed">
          <Gavel className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-muted-foreground">Sin decisiones solicitadas</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Registra aquí las decisiones que requieren resolución del Consejo: trade-offs, guardrails, desbloqueos estructurales.
            Máximo 3 por sesión.
          </p>
          {canEdit && (
            <Button variant="outline" size="sm" className="mt-4" onClick={openNew} data-print-hide>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar primera decisión
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {decisions.map((d, i) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">#{i + 1}</span>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", DECISION_STATUS_COLOR[d.status])}>
                      {DECISION_STATUS_LABEL[d.status]}
                    </span>
                    {d.owner && <span className="text-xs text-muted-foreground">Responsable: {d.owner}</span>}
                  </div>
                  <p className="text-sm font-semibold">{d.title}</p>
                  {d.context && <p className="text-xs text-muted-foreground">{d.context}</p>}
                  {d.options?.length > 0 && (
                    <ul className="space-y-0.5">
                      {d.options.map((opt, oi) => (
                        <li key={oi} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="shrink-0 mt-0.5 font-mono">{String.fromCharCode(65 + oi)}.</span>
                          <span>{opt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {d.recommendation && (
                    <div className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/20 rounded p-2">
                      <span className="font-semibold text-blue-700 dark:text-blue-300 shrink-0">Recomendación:</span>
                      <span className="text-blue-800 dark:text-blue-200">{d.recommendation}</span>
                    </div>
                  )}
                  {d.status === "DECIDED" && d.decision_note && (
                    <div className="flex items-start gap-2 text-xs bg-green-50 dark:bg-green-950/20 rounded p-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-green-800 dark:text-green-200">{d.decision_note}</span>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0" data-print-hide>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteD.mutate(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <DecisionDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        initial={editing ?? {}}
        decisionId={editing?.id}
        cycleId={cycleId}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsejoPage() {
  const t = useTranslations("pages.consejo");
  const { data: cycles = [], isLoading: cyclesLoading } = useCycles();
  const [cycleId, setCycleId] = useState<string>("");
  const { user } = useAuth();

  const { data, isLoading } = useConsejoPackage(cycleId || undefined);

  const canEdit = user?.role === "OWNER" || user?.role === "ADMIN";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="p-6 space-y-6">
        <PageHeader
          title={t("title")}
          description={t("desc")}
          actions={
            <div className="flex items-center gap-2" data-print-hide>
              {data && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" />
                  {t("printPdf")}
                </Button>
              )}
              <Link
                href="/reports"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Reportes
              </Link>
            </div>
          }
        />

        {/* Cycle selector */}
        <div className="flex items-center gap-3" data-print-hide>
          <Select id="consejo-cycle" value={cycleId} onChange={e => setCycleId(e.target.value)} className="max-w-xs">
            <SelectOption value="">{t("selectCycle")}</SelectOption>
            {cycles.map(c => (
              <SelectOption key={c.id} value={c.id}>
                {c.name} — {t(CYCLE_STATUS_KEY[c.status] ?? "statusDraft")}
              </SelectOption>
            ))}
          </Select>
        </div>

        {/* Empty state */}
        {!cycleId && (
          <div className="text-center py-20 text-muted-foreground">
            <Printer className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Selecciona un ciclo para generar el Paquete Consejo</p>
            <p className="text-sm mt-1">El reporte se genera al momento de la consulta.</p>
          </div>
        )}

        {cycleId && isLoading && <ConsejoSkeleton />}

        {cycleId && !isLoading && data && (
          <div className="space-y-8">

            {/* Cycle header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{data.cycle?.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {data.cycle?.start_date && fmtDate(data.cycle.start_date)} — {data.cycle?.end_date && fmtDate(data.cycle.end_date)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{data.cycle?.days_elapsed ?? 0}</span> días transcurridos
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{data.cycle?.days_remaining ?? 0}</span> días restantes
                </span>
                <StatusChip status={data.cycle?.status ?? ""} />
              </div>
            </div>

            {/* 1. Resumen Ejecutivo */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                {t("execSummary")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: t("totalObjectives"), value: data.executive_summary?.total_objectives ?? 0,     color: "text-foreground" },
                  { label: t("onTrack"),          value: data.executive_summary?.on_track ?? 0,            color: "text-green-600 dark:text-green-400" },
                  { label: t("atRisk"),           value: data.executive_summary?.at_risk ?? 0,             color: "text-amber-600 dark:text-amber-400" },
                  { label: t("behind"),           value: data.executive_summary?.behind ?? 0,              color: "text-red-600 dark:text-red-400" },
                  { label: t("completed"),        value: data.executive_summary?.completed ?? 0,           color: "text-blue-600 dark:text-blue-400" },
                  { label: t("avgConfidence"),    value: `${data.executive_summary?.confidence_avg ?? 0}%`, color: "text-foreground" },
                ].map(m => (
                  <Card key={m.label} className="p-4 text-center">
                    <p className={cn("text-2xl font-bold tabular-nums", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                  </Card>
                ))}
              </div>
              <Card className="mt-4 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{t("cycleProgress")}</span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {fmtPct(data.executive_summary?.overall_progress)}
                  </span>
                </div>
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      (data.executive_summary?.overall_progress ?? 0) >= 70 ? "bg-green-500" :
                      (data.executive_summary?.overall_progress ?? 0) >= 40 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(data.executive_summary?.overall_progress ?? 0, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Basado en {data.executive_summary?.total_objectives ?? 0} objetivos activos
                </p>
              </Card>
            </section>

            {/* 2. KRs Críticos (Gates del OKR) */}
            <section className="print-break-before">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  KRs Críticos — Gates del OKR
                </h3>
                <span className="text-xs text-muted-foreground">
                  · Si un gate falla, el OKR no cuenta aunque otros KRs estén en verde
                </span>
              </div>
              <CriticalKRsSection criticalKRs={data.critical_krs ?? []} />
            </section>

            {/* 3. No Negociables */}
            <section>
              <GuardrailsSection guardrails={data.guardrails ?? []} canEdit={canEdit} />
            </section>

            {/* 4. Decisiones Solicitadas */}
            <section>
              <DecisionsSection decisions={data.requested_decisions ?? []} canEdit={canEdit} cycleId={cycleId} />
            </section>

            {/* 5. Objetivos Estratégicos */}
            <section className="print-break-before">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                {t("institutionObjectives")}
              </h3>
              {!data.strategic_objectives?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sin objetivos estratégicos registrados.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">{t("colObjective")}</th>
                        <th className="text-left px-4 py-3 font-semibold w-36">{t("colProgress")}</th>
                        <th className="text-left px-4 py-3 font-semibold w-28">{t("colStatus")}</th>
                        <th className="text-left px-4 py-3 font-semibold w-36">{t("colOwner")}</th>
                        <th className="text-center px-4 py-3 font-semibold w-24">{t("onTrackKrs")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.strategic_objectives.map(obj => (
                        <tr key={obj.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            {obj.code && <span className="text-xs font-mono text-muted-foreground mr-2">{obj.code}</span>}
                            <span className="font-medium">{obj.title}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={obj.progress} className="w-20" />
                              <span className="text-xs tabular-nums text-muted-foreground">{fmtPct(obj.progress)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><StatusChip status={obj.status} /></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{obj.owner_name ?? "—"}</td>
                          <td className="px-4 py-3 text-center text-xs tabular-nums">{obj.kr_on_track} / {obj.kr_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 6. Objetivos por Área */}
            {!!data.area_objectives?.length && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                  {t("objectivesByArea")}
                </h3>
                <div className="space-y-3">
                  {data.area_objectives.map(area => (
                    <AreaSection key={area.area_name} {...area} />
                  ))}
                </div>
              </section>
            )}

            {/* 7. KRs En Riesgo */}
            <section className="print-break-before">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                {t("topRisks")}
              </h3>
              {!data.top_risks?.length ? (
                <Card className="p-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">{t("noRisks")}</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {data.top_risks.map((risk, i) => {
                    const isCritical = risk.confidence < 40 || risk.days_since_checkin > 14;
                    return (
                      <Card key={i} className={cn("p-4 border-l-4", isCritical ? "border-l-red-500" : "border-l-amber-500")}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {risk.kr_code && <span className="text-xs font-mono text-muted-foreground">{risk.kr_code}</span>}
                              <span className="text-sm font-semibold">{risk.kr_title}</span>
                              {isCritical && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {risk.objective_title}
                              <span className="ml-2 opacity-60">{risk.objective_level}</span>
                            </p>
                            {risk.owner_name && <p className="text-xs text-muted-foreground mt-1">Responsable: {risk.owner_name}</p>}
                          </div>
                          <div className="flex items-center gap-4 text-xs shrink-0">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <ProgressBar value={risk.progress} className="w-20" />
                                <span className="tabular-nums text-muted-foreground">{fmtPct(risk.progress)}</span>
                              </div>
                              <p className="text-muted-foreground mt-1">Confianza: {risk.confidence}%</p>
                            </div>
                            {risk.days_since_checkin >= 0 && (
                              <div className={cn("flex items-center gap-1", risk.days_since_checkin > 14 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                                <Clock className="h-3 w-3" />
                                <span>{risk.days_since_checkin === -1 ? "Sin check-in" : `${risk.days_since_checkin}d sin check-in`}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 8. Resumen de Iniciativas */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                Resumen de Iniciativas
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total",    value: data.initiatives_summary?.total ?? 0,    color: "text-foreground" },
                  { label: "En Curso", value: data.initiatives_summary?.on_track ?? 0, color: "text-green-600 dark:text-green-400" },
                  { label: "En Riesgo",value: data.initiatives_summary?.at_risk ?? 0,  color: "text-amber-600 dark:text-amber-400" },
                  { label: "Vencidas", value: data.initiatives_summary?.overdue ?? 0,  color: "text-red-600 dark:text-red-400" },
                ].map(m => (
                  <Card key={m.label} className="p-4 text-center">
                    <p className={cn("text-2xl font-bold tabular-nums", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                  </Card>
                ))}
              </div>
            </section>

            {/* 9. Agenda de Gobierno */}
            {!!data.governance_commitments?.length && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
                  Agenda de Gobierno
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">Actividad</th>
                        <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                        <th className="text-left px-4 py-3 font-semibold">Fecha límite</th>
                        <th className="text-left px-4 py-3 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.governance_commitments.map((g, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{g.title}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{g.event_type}</td>
                          <td className="px-4 py-3 text-xs">{g.due_date ? fmtDate(g.due_date) : "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", GOV_STATUS_CHIP[g.status] ?? "bg-muted text-muted-foreground")}>
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </>
  );
}
