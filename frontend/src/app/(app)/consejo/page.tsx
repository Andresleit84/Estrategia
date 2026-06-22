"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { useConsejoPackage } from "@/hooks/useConsejoPackage";
import type { BoardGuardrail, BoardDecision } from "@/hooks/useConsejoPackage";
import { useGuardrails, useUpsertGuardrail, useDeleteGuardrail } from "@/hooks/useGuardrails";
import { useBoardDecisions, useUpsertBoardDecision, useDeleteBoardDecision, useSetKrCritical } from "@/hooks/useBoardDecisions";
import {
  useBoardSessions, useCreateBoardSession, useUpdateBoardSession, useDeleteBoardSession,
  useCycleKRs, useUpdateGuardrailStatus, useUpdateDecisionFollowup,
} from "@/hooks/useBoardSessions";
import type { BoardSession } from "@/hooks/useBoardSessions";
import { useBoardAgreements, useUpsertAgreement, useToggleAgreement, useDeleteAgreement } from "@/hooks/useBoardAgreements";
import { useCycles } from "@/hooks/useCycles";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Building2, Star, Shield, Gavel, Settings2, Plus, Pencil, Trash2, ChevronDown,
  ChevronUp, CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Printer, ArrowRight, Check, X, ChevronRight, FileText, Calendar, Users,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}
function fmtShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}
function fmtPct(n: number | null | undefined) {
  return `${Number(n ?? 0).toFixed(0)}%`;
}

const SESSION_STATUS_LABEL: Record<string, string> = {
  DRAFT:      "Borrador",
  PREPARING:  "Preparando",
  READY:      "Listo",
  PRESENTED:  "Presentado",
  CLOSED:     "Cerrado",
};
const SESSION_STATUS_COLOR: Record<string, string> = {
  DRAFT:     "bg-muted text-muted-foreground",
  PREPARING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  READY:     "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PRESENTED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  CLOSED:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};
const SESSION_STATUS_ORDER = ["DRAFT", "PREPARING", "READY", "PRESENTED", "CLOSED"] as const;

const GUARDRAIL_STATUS_COLOR: Record<string, string> = {
  VERDE: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  AMBER: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  ROJO:  "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
};
const GUARDRAIL_LEFT_BORDER: Record<string, string> = {
  VERDE: "border-l-green-500",
  AMBER: "border-l-amber-500",
  ROJO:  "border-l-red-500",
};
const DECISION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente", DECIDED: "Decidida", DEFERRED: "Diferida", CLOSED: "Cerrada",
};
const DECISION_STATUS_COLOR: Record<string, string> = {
  PENDING:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DECIDED:  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  DEFERRED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CLOSED:   "bg-muted text-muted-foreground",
};

const GUARDRAIL_CATEGORIES = [
  "Prudencia financiera",
  "Cumplimiento, ética y reputación",
  "Riesgo operacional y continuidad",
  "Cliente y misión",
  "Disciplina de ejecución",
];

function TrendIcon({ trend }: { trend: "UP" | "STABLE" | "DOWN" }) {
  if (trend === "UP")   return <TrendingUp   className="h-3.5 w-3.5 text-green-500" />;
  if (trend === "DOWN") return <TrendingDown  className="h-3.5 w-3.5 text-red-500"   />;
  return                       <Minus         className="h-3.5 w-3.5 text-muted-foreground" />;
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={cn("h-1.5 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

type TabId = "pulso" | "guardrails" | "decisions" | "setup";

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "pulso",      label: "Pulso Mensual",    icon: FileText  },
    { id: "guardrails", label: "No Negociables",   icon: Shield    },
    { id: "decisions",  label: "Decisiones",       icon: Gavel     },
    { id: "setup",      label: "Configurar",       icon: Settings2 },
  ];
  return (
    <div className="flex gap-1 border-b border-border pb-0 mb-6">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            active === t.id
              ? "border-purple-500 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <t.icon className="h-4 w-4" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Workflow bar ──────────────────────────────────────────────────────────────

function WorkflowBar({ status, onAdvance, canEdit }: {
  status: BoardSession["status"];
  onAdvance: (s: BoardSession["status"]) => void;
  canEdit: boolean;
}) {
  const currentIdx = SESSION_STATUS_ORDER.indexOf(status);
  const nextStatus = SESSION_STATUS_ORDER[currentIdx + 1] as BoardSession["status"] | undefined;
  const nextLabel: Record<string, string> = {
    DRAFT:     "Comenzar preparación →",
    PREPARING: "Marcar como Listo →",
    READY:     "Sesión presentada →",
    PRESENTED: "Cerrar Pulso →",
  };
  return (
    <div className="flex items-center gap-0 bg-muted/30 rounded-lg p-1 mb-6">
      {SESSION_STATUS_ORDER.map((s, i) => {
        const isDone   = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={s} className="flex items-center flex-1">
            <div className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
              isDone   && "text-green-600 dark:text-green-400",
              isActive && "bg-background shadow-sm text-foreground font-semibold",
              !isDone && !isActive && "text-muted-foreground"
            )}>
              {isDone && <Check className="h-3 w-3" />}
              {SESSION_STATUS_LABEL[s]}
            </div>
            {i < SESSION_STATUS_ORDER.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        );
      })}
      {canEdit && nextStatus && (
        <Button size="sm" className="ml-3 h-7 text-xs shrink-0" onClick={() => onAdvance(nextStatus)}>
          {nextLabel[status]}
        </Button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAB 1: PULSO MENSUAL
// ════════════════════════════════════════════════════════════════════

function PulsoCard({ session, isActive, onClick }: { session: BoardSession; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all",
        isActive
          ? "border-purple-500 bg-purple-50/30 dark:bg-purple-900/10"
          : "border-border hover:border-purple-300 hover:bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", SESSION_STATUS_COLOR[session.status])}>
              {SESSION_STATUS_LABEL[session.status]}
            </span>
            {session.pending_decisions > 0 && (
              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                {session.pending_decisions} dec. pendiente{session.pending_decisions > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold truncate">{session.cycle_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sesión: {fmtShort(session.session_date)}
            {session.chair && ` · ${session.chair}`}
          </p>
        </div>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform", isActive && "rotate-90")} />
      </div>
    </button>
  );
}

function NewSessionDialog({ open, onClose, cycles }: {
  open: boolean;
  onClose: () => void;
  cycles: { id: string; name: string }[];
}) {
  const today = new Date().toISOString().split("T")[0];
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? "");
  const [sessionDate, setSessionDate] = useState(today);
  const [chair, setChair] = useState("");
  const [secretary, setSecretary] = useState("");
  const create = useCreateBoardSession();

  const save = async () => {
    if (!cycleId || !sessionDate) return;
    await create.mutateAsync({ cycle_id: cycleId, session_date: sessionDate, chair: chair || undefined, secretary: secretary || undefined });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nuevo Pulso Mensual</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ciclo</label>
            <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={cycleId} onChange={e => setCycleId(e.target.value)}>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha de sesión</label>
            <input type="date" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Presidente del Consejo</label>
            <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={chair} onChange={e => setChair(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Secretario/a</label>
            <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={secretary} onChange={e => setSecretary(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={create.isPending || !cycleId || !sessionDate}>
            {create.isPending ? "Creando…" : "Crear Pulso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PulsoDetail({ session, canEdit }: { session: BoardSession; canEdit: boolean }) {
  const update = useUpdateBoardSession();
  const del = useDeleteBoardSession();
  const [editNotes, setEditNotes] = useState(false);
  const [directorNotes, setDirectorNotes] = useState(session.director_notes ?? "");
  const [meetingNotes, setMeetingNotes] = useState(session.meeting_notes ?? "");

  const { data: pkg, isLoading } = useConsejoPackage(session.cycle_id);

  const advance = async (nextStatus: BoardSession["status"]) => {
    await update.mutateAsync({ id: session.id, data: { status: nextStatus } });
  };

  const saveNotes = async () => {
    await update.mutateAsync({ id: session.id, data: { director_notes: directorNotes, meeting_notes: meetingNotes } });
    setEditNotes(false);
  };

  return (
    <div className="flex-1 min-w-0 space-y-6">
      {/* Header del Pulso */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">Pulso — {session.cycle_name}</h2>
          <p className="text-sm text-muted-foreground">
            Sesión: {fmtDate(session.session_date)}
            {session.chair && <> · Pdte: {session.chair}</>}
            {session.secretary && <> · Sec: {session.secretary}</>}
          </p>
        </div>
        <div className="flex items-center gap-2" data-print-hide>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Exportar PDF
          </Button>
          {canEdit && session.status !== "CLOSED" && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
              onClick={() => del.mutate(session.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Workflow */}
      <WorkflowBar status={session.status} onAdvance={advance} canEdit={canEdit} />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : pkg ? (
        <>
          {/* Semáforo ejecutivo */}
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">Semáforo Ejecutivo</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
              {[
                { label: "Total",     v: pkg.executive_summary?.total_objectives ?? 0,    c: "text-foreground" },
                { label: "En curso",  v: pkg.executive_summary?.on_track ?? 0,            c: "text-green-600 dark:text-green-400" },
                { label: "En riesgo", v: pkg.executive_summary?.at_risk ?? 0,             c: "text-amber-600 dark:text-amber-400" },
                { label: "Rezagado",  v: pkg.executive_summary?.behind ?? 0,              c: "text-red-600 dark:text-red-400" },
                { label: "Completado",v: pkg.executive_summary?.completed ?? 0,           c: "text-blue-600 dark:text-blue-400" },
                { label: "Confianza", v: `${pkg.executive_summary?.confidence_avg ?? 0}%`, c: "text-foreground" },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <p className={cn("text-xl font-bold tabular-nums", m.c)}>{m.v}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Avance global</span>
                <span className="font-semibold text-foreground">{fmtPct(pkg.executive_summary?.overall_progress)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full",
                  (pkg.executive_summary?.overall_progress ?? 0) >= 70 ? "bg-green-500" :
                  (pkg.executive_summary?.overall_progress ?? 0) >= 40 ? "bg-amber-500" : "bg-red-500"
                )} style={{ width: `${Math.min(pkg.executive_summary?.overall_progress ?? 0, 100)}%` }} />
              </div>
            </div>
          </Card>

          {/* KRs Críticos */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">KRs Críticos — Gates del OKR</h3>
            </div>
            {!pkg.critical_krs?.length ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Sin KRs marcados como críticos.</p>
                <p className="text-xs text-muted-foreground mt-1">Ve a la pestaña <strong>Configurar</strong> para marcarlos.</p>
              </div>
            ) : (
              <div className="divide-y">
                {pkg.critical_krs.map(kr => (
                  <div key={kr.id} className="py-3 grid grid-cols-[1fr_auto] gap-4 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-sm font-medium truncate">{kr.title}</span>
                        <span className={cn("text-xs px-1.5 rounded", {
                          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400": kr.status === "ON_TRACK",
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400": kr.status === "AT_RISK",
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400": kr.status === "BEHIND",
                        })}>
                          {kr.status === "ON_TRACK" ? "En curso" : kr.status === "AT_RISK" ? "En riesgo" : "Rezagado"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5">{kr.objective_title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-2 justify-end">
                        <ProgressBar value={kr.progress} className="w-16" />
                        <span className="text-xs tabular-nums w-10">{fmtPct(kr.progress)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Conf: {fmtPct(kr.confidence)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* No Negociables inline */}
          {!!pkg.guardrails?.length && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">No Negociables</h3>
              </div>
              <div className="divide-y">
                {pkg.guardrails.map(g => (
                  <div key={g.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", {
                        "bg-green-500": g.status === "VERDE",
                        "bg-amber-400": g.status === "AMBER",
                        "bg-red-500":   g.status === "ROJO",
                      })} />
                      <span className="text-sm truncate">{g.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <TrendIcon trend={g.trend} />
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", {
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400": g.status === "VERDE",
                        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400": g.status === "AMBER",
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400":         g.status === "ROJO",
                      })}>
                        {g.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Decisiones */}
          {!!pkg.requested_decisions?.length && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Gavel className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Decisiones Solicitadas ({pkg.requested_decisions.length}/3)
                </h3>
              </div>
              <div className="space-y-3">
                {pkg.requested_decisions.map((d, i) => (
                  <div key={d.id} className="bg-muted/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">#{i+1}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", DECISION_STATUS_COLOR[d.status])}>
                        {DECISION_STATUS_LABEL[d.status]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{d.title}</p>
                    {d.recommendation && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">→ Rec: {d.recommendation}</p>
                    )}
                    {d.decision_note && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ {d.decision_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Notas del Director */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Notas de Preparación</h3>
              {canEdit && !editNotes && (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setEditNotes(true)}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Notas del Director (pre-sesión)</label>
                  <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                    value={directorNotes} onChange={e => setDirectorNotes(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notas de la sesión (post-reunión)</label>
                  <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                    value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNotes} disabled={update.isPending}>
                    {update.isPending ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditNotes(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                {session.director_notes
                  ? <p className="whitespace-pre-wrap">{session.director_notes}</p>
                  : <p className="italic">Sin notas de preparación.</p>
                }
                {session.meeting_notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notas de sesión</p>
                    <p className="whitespace-pre-wrap">{session.meeting_notes}</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Acuerdos de sesión */}
          <AgreementsSection sessionId={session.id} canEdit={canEdit} sessionStatus={session.status} />
        </>
      ) : null}
    </div>
  );
}

// ── Acuerdos de sesión ────────────────────────────────────────────────────────

function AgreementsSection({ sessionId, canEdit, sessionStatus }: {
  sessionId: string;
  canEdit: boolean;
  sessionStatus: BoardSession["status"];
}) {
  const { data: agreements = [], isLoading } = useBoardAgreements(sessionId);
  const upsert = useUpsertAgreement();
  const toggle = useToggleAgreement();
  const del = useDeleteAgreement();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ text: "", owner: "", due_date: "" });

  const resetForm = () => { setForm({ text: "", owner: "", due_date: "" }); setShowForm(false); setEditingId(null); };

  const startEdit = (a: { id: string; text: string; owner: string | null; due_date: string | null }) => {
    setEditingId(a.id);
    setForm({ text: a.text, owner: a.owner ?? "", due_date: a.due_date ?? "" });
    setShowForm(false);
  };

  const save = async () => {
    if (!form.text.trim()) return;
    await upsert.mutateAsync({
      sessionId,
      id: editingId ?? undefined,
      data: { text: form.text, owner: form.owner || undefined, due_date: form.due_date || undefined },
    });
    resetForm();
  };

  const isEditable = canEdit && sessionStatus !== "CLOSED";

  const done = agreements.filter(a => a.completed).length;
  const total = agreements.length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Acuerdos de la Sesión
          </h3>
          {total > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {done}/{total} cumplidos
            </span>
          )}
        </div>
        {isEditable && !showForm && !editingId && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3" /> Agregar
          </Button>
        )}
      </div>

      {/* Barra de progreso de acuerdos */}
      {total > 0 && (
        <div className="mb-4">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Formulario nuevo */}
      {showForm && (
        <AgreementForm
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={resetForm}
          isPending={upsert.isPending}
          label="Agregar acuerdo"
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : !agreements.length && !showForm ? (
        <p className="text-sm text-muted-foreground italic">
          Sin acuerdos registrados.
          {isEditable && " Agrega los compromisos concretos que salieron de la sesión."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {agreements.map(a => (
            <div key={a.id}>
              {editingId === a.id ? (
                <AgreementForm
                  form={form}
                  setForm={setForm}
                  onSave={save}
                  onCancel={resetForm}
                  isPending={upsert.isPending}
                  label="Guardar"
                />
              ) : (
                <div className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-lg group transition-colors",
                  a.completed ? "opacity-60" : "hover:bg-muted/30"
                )}>
                  {/* Checkbox */}
                  <button
                    disabled={!isEditable}
                    onClick={() => toggle.mutate({ id: a.id, completed: !a.completed, sessionId })}
                    className={cn(
                      "mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                      a.completed
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-muted-foreground/40 hover:border-green-400",
                      !isEditable && "cursor-default"
                    )}
                  >
                    {a.completed && <Check className="h-2.5 w-2.5" />}
                  </button>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", a.completed && "line-through text-muted-foreground")}>
                      {a.text}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {a.owner && (
                        <span className="text-xs text-muted-foreground">{a.owner}</span>
                      )}
                      {a.due_date && (
                        <span className={cn(
                          "text-xs",
                          !a.completed && new Date(a.due_date) < new Date()
                            ? "text-red-500 font-medium"
                            : "text-muted-foreground"
                        )}>
                          {fmtShort(a.due_date)}
                          {!a.completed && new Date(a.due_date) < new Date() && " · vencido"}
                        </span>
                      )}
                      {a.completed && a.completed_at && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          ✓ {fmtShort(a.completed_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  {isEditable && (
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                        onClick={() => startEdit(a)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                        onClick={() => del.mutate({ id: a.id, sessionId })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AgreementForm({ form, setForm, onSave, onCancel, isPending, label }: {
  form: { text: string; owner: string; due_date: string };
  setForm: React.Dispatch<React.SetStateAction<{ text: string; owner: string; due_date: string }>>;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  label: string;
}) {
  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20 mb-2 space-y-2">
      <textarea
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[60px]"
        placeholder="¿Qué se acordó? Ej: Compliance entrega evidencia SGF al Consejo antes del 15-jul"
        value={form.text}
        onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          placeholder="Responsable"
          value={form.owner}
          onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
        />
        <input
          type="date"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={form.due_date}
          onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={isPending || !form.text.trim()}>
          {isPending ? "Guardando…" : label}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

function TabPulso({ canEdit }: { canEdit: boolean }) {
  const { data: cycles = [] } = useCycles();
  const { data: sessions = [], isLoading } = useBoardSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDlg, setNewDlg] = useState(false);

  const selected = sessions.find(s => s.id === selectedId) ?? sessions[0] ?? null;

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 min-w-0">
      {/* Sessions list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Sesiones</h3>
          {canEdit && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setNewDlg(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo Pulso
            </Button>
          )}
        </div>
        {!sessions.length ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Sin sesiones del Consejo</p>
            {canEdit && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setNewDlg(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear primer Pulso
              </Button>
            )}
          </div>
        ) : (
          sessions.map(s => (
            <PulsoCard
              key={s.id}
              session={s}
              isActive={s.id === (selected?.id)}
              onClick={() => setSelectedId(s.id)}
            />
          ))
        )}
      </div>

      {/* Session detail */}
      <div className="min-w-0">
        {selected
          ? <PulsoDetail session={selected} canEdit={canEdit} />
          : (
            <div className="flex items-center justify-center h-64 border border-dashed rounded-lg text-muted-foreground text-sm">
              Selecciona una sesión para ver el Pulso
            </div>
          )
        }
      </div>

      <NewSessionDialog
        open={newDlg}
        onClose={() => setNewDlg(false)}
        cycles={cycles}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAB 2: GUARDRAILS (No Negociables)
// ════════════════════════════════════════════════════════════════════

function GuardrailStatusPicker({ current, onChange }: {
  current: "VERDE" | "AMBER" | "ROJO";
  onChange: (s: "VERDE" | "AMBER" | "ROJO") => void;
}) {
  return (
    <div className="flex gap-1">
      {(["VERDE", "AMBER", "ROJO"] as const).map(s => (
        <button key={s} onClick={() => onChange(s)}
          className={cn("h-6 w-6 rounded-full border-2 transition-all",
            s === "VERDE" ? "bg-green-500" : s === "AMBER" ? "bg-amber-400" : "bg-red-500",
            current === s ? "border-foreground scale-110" : "border-transparent opacity-50 hover:opacity-100"
          )}
          title={s}
        />
      ))}
    </div>
  );
}

function GuardrailForm({ initial, guardrailId, onDone }: {
  initial: Partial<BoardGuardrail>;
  guardrailId?: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    category: initial.category ?? GUARDRAIL_CATEGORIES[0],
    title: initial.title ?? "",
    risk_description: initial.risk_description ?? "",
    kri_description: initial.kri_description ?? "",
    threshold: initial.threshold ?? "",
    escalation_trigger: initial.escalation_trigger ?? "",
    owner: initial.owner ?? "",
    status: (initial.status ?? "VERDE") as "VERDE" | "AMBER" | "ROJO",
    trend: (initial.trend ?? "STABLE") as "UP" | "STABLE" | "DOWN",
  });
  const upsert = useUpsertGuardrail();

  const save = async () => {
    if (!form.title.trim()) return;
    await upsert.mutateAsync({ id: guardrailId, data: form });
    onDone();
  };

  const f = (label: string, key: keyof typeof form, type: "input" | "textarea" | "select" = "input") => (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {type === "textarea" ? (
        <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[60px]"
          value={form[key] as string} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
      ) : (
        <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={form[key] as string} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
      )}
    </div>
  );

  return (
    <div className="space-y-4 p-5 border rounded-lg bg-muted/20">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoría</label>
        <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
          {GUARDRAIL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {f("Enunciado", "title")}
      {f("Riesgo que protege", "risk_description", "textarea")}
      {f("Indicador / KRI y fuente de datos", "kri_description", "textarea")}
      {f("Umbral / criterio observable", "threshold")}
      {f("Trigger de escalamiento al Consejo", "escalation_trigger", "textarea")}
      {f("Dueño ejecutivo", "owner")}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Estado</label>
          <GuardrailStatusPicker current={form.status} onChange={s => setForm(p => ({ ...p, status: s }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tendencia</label>
          <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={form.trend} onChange={e => setForm(p => ({ ...p, trend: e.target.value as "UP"|"STABLE"|"DOWN" }))}>
            <option value="UP">Mejorando ↑</option>
            <option value="STABLE">Estable →</option>
            <option value="DOWN">Deteriorando ↓</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={save} disabled={upsert.isPending || !form.title.trim()}>
          {upsert.isPending ? "Guardando…" : guardrailId ? "Actualizar" : "Agregar Guardrail"}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

function TabGuardrails({ canEdit }: { canEdit: boolean }) {
  const { data: guardrails = [], isLoading } = useGuardrails();
  const deleteG = useDeleteGuardrail();
  const updateStatus = useUpdateGuardrailStatus();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, BoardGuardrail[]>();
    for (const g of guardrails) {
      if (!map.has(g.category)) map.set(g.category, []);
      map.get(g.category)!.push(g);
    }
    return Array.from(map.entries());
  }, [guardrails]);

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">No Negociables del Consejo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Límites que el Consejo no puede transgredir. Se definen una vez al año y se monitorean mensualmente en el Pulso.
          </p>
        </div>
        {canEdit && !showForm && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditingId(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5" /> Agregar Guardrail
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && !editingId && (
        <GuardrailForm initial={{}} onDone={() => setShowForm(false)} />
      )}

      {/* Empty */}
      {!guardrails.length && !showForm && (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">Sin No Negociables configurados</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Define los límites que el Consejo no puede transgredir: prudencia financiera, cumplimiento,
            riesgo operacional, cliente y disciplina de ejecución.
          </p>
          {canEdit && (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Definir primer guardrail
            </Button>
          )}
        </div>
      )}

      {/* Grouped list */}
      {grouped.map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">{category}</h3>
          <div className="space-y-2">
            {items.map(g => (
              <div key={g.id}>
                {editingId === g.id ? (
                  <GuardrailForm initial={g} guardrailId={g.id} onDone={() => setEditingId(null)} />
                ) : (
                  <Card className={cn("p-4 border-l-4", GUARDRAIL_LEFT_BORDER[g.status] ?? "border-l-muted")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-semibold">{g.title}</p>
                        {g.kri_description && <p className="text-xs text-muted-foreground">Señal: {g.kri_description}</p>}
                        {g.threshold && <p className="text-xs text-muted-foreground">Umbral: {g.threshold}</p>}
                        {g.escalation_trigger && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Trigger: {g.escalation_trigger}</p>
                        )}
                        {g.owner && <p className="text-xs text-muted-foreground">Dueño: {g.owner}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Quick status update */}
                        {canEdit && (
                          <GuardrailStatusPicker
                            current={g.status}
                            onChange={s => updateStatus.mutate({ id: g.id, status: s, trend: g.trend })}
                          />
                        )}
                        <div className="flex items-center gap-1">
                          <TrendIcon trend={g.trend} />
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", GUARDRAIL_STATUS_COLOR[g.status])}>
                            {g.status}
                          </span>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingId(g.id)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteG.mutate(g.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAB 3: DECISIONES (Bitácora)
// ════════════════════════════════════════════════════════════════════

function DecisionForm({ cycleId, initial, decisionId, onDone }: {
  cycleId: string;
  initial: Partial<BoardDecision>;
  decisionId?: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [context, setContext] = useState(initial.context ?? "");
  const [options, setOptions] = useState<string[]>(initial.options?.length ? initial.options : [""]);
  const [recommendation, setRecommendation] = useState(initial.recommendation ?? "");
  const [status, setStatus] = useState<BoardDecision["status"]>(initial.status ?? "PENDING");
  const [owner, setOwner] = useState(initial.owner ?? "");
  const [decisionNote, setDecisionNote] = useState(initial.decision_note ?? "");
  const upsert = useUpsertBoardDecision();

  const save = async () => {
    if (!title.trim()) return;
    await upsert.mutateAsync({ id: decisionId, data: {
      cycle_id: cycleId, title, context, options: options.filter(o => o.trim()),
      recommendation, status, owner, decision_note: decisionNote,
    }});
    onDone();
  };

  return (
    <div className="space-y-4 p-5 border rounded-lg bg-muted/20">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Decisión solicitada</label>
        <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué necesita resolver el Consejo?" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contexto / Por qué escala</label>
        <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[60px]"
          value={context} onChange={e => setContext(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Opciones</label>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <input className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={opt} onChange={e => setOptions(o => o.map((x, idx) => idx === i ? e.target.value : x))}
              placeholder={`Opción ${String.fromCharCode(65 + i)}`} />
            {options.length > 1 && (
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive"
                onClick={() => setOptions(o => o.filter((_, idx) => idx !== i))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setOptions(o => [...o, ""])}>
          <Plus className="h-3 w-3" /> Opción
        </Button>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recomendación de la Dirección</label>
        <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[60px]"
          value={recommendation} onChange={e => setRecommendation(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</label>
          <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={status} onChange={e => setStatus(e.target.value as BoardDecision["status"])}>
            <option value="PENDING">Pendiente</option>
            <option value="DECIDED">Decidida</option>
            <option value="DEFERRED">Diferida</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsable</label>
          <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={owner} onChange={e => setOwner(e.target.value)} />
        </div>
      </div>
      {status === "DECIDED" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Resolución del Consejo — ¿Cómo se verifica en el próximo Pulso?
          </label>
          <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none min-h-[60px]"
            value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={save} disabled={upsert.isPending || !title.trim()}>
          {upsert.isPending ? "Guardando…" : decisionId ? "Actualizar" : "Agregar Decisión"}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

// ── Decision card (shared lista + kanban) ─────────────────────────────────────

function DecisionCard({ d, i, canEdit, onEdit, onDelete, expanded, onToggleFollowup }: {
  d: BoardDecision;
  i: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  expanded: boolean;
  onToggleFollowup: () => void;
}) {
  const daysSince = useMemo(() => {
    const ref = d.status !== "PENDING" && d.decided_at ? d.decided_at : d.created_at;
    return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
  }, [d]);

  const isStale = d.status === "PENDING" && daysSince > 30;

  return (
    <Card className={cn("p-4 cursor-grab active:cursor-grabbing", isStale && "border-amber-300 dark:border-amber-800")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", DECISION_STATUS_COLOR[d.status])}>
              {DECISION_STATUS_LABEL[d.status]}
            </span>
            {isStale && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {daysSince}d sin mover
              </span>
            )}
            {!isStale && daysSince > 0 && (
              <span className="text-xs text-muted-foreground">{daysSince}d</span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug">{d.title}</p>
          {d.owner && <p className="text-xs text-muted-foreground">{d.owner}</p>}
          {d.context && <p className="text-xs text-muted-foreground line-clamp-2">{d.context}</p>}
          {d.recommendation && (
            <p className="text-xs text-blue-600 dark:text-blue-400 truncate">→ {d.recommendation}</p>
          )}
          {d.decision_note && (
            <div className="flex items-start gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{d.decision_note}</span>
            </div>
          )}
          {d.status === "DECIDED" && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
              onClick={e => { e.stopPropagation(); onToggleFollowup(); }}
            >
              <CheckCircle2 className={cn("h-3.5 w-3.5", (d as any).follow_up_verified ? "text-green-500" : "")} />
              Seguimiento
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          {expanded && (
            <FollowupInline decision={d} onClose={onToggleFollowup} canEdit={canEdit} />
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={e => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

const KANBAN_COLS: { status: BoardDecision["status"]; label: string; color: string }[] = [
  { status: "PENDING",  label: "Pendiente",  color: "border-blue-300  dark:border-blue-800"  },
  { status: "DECIDED",  label: "Decidida",   color: "border-green-300 dark:border-green-800" },
  { status: "DEFERRED", label: "Diferida",   color: "border-amber-300 dark:border-amber-800" },
  { status: "CLOSED",   label: "Cerrada",    color: "border-muted"                           },
];

function KanbanColumn({ col, items, canEdit, onEdit, onDelete, expanded, onToggleFollowup, onDrop }: {
  col: typeof KANBAN_COLS[number];
  items: BoardDecision[];
  canEdit: boolean;
  onEdit: (d: BoardDecision) => void;
  onDelete: (id: string) => void;
  expanded: string | null;
  onToggleFollowup: (id: string) => void;
  onDrop: (id: string, newStatus: BoardDecision["status"]) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col min-w-[220px] flex-1 rounded-lg border-2 transition-colors",
        over ? "border-purple-400 bg-purple-50/30 dark:bg-purple-900/10" : col.color + " bg-muted/10"
      )}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id, col.status);
      }}
    >
      {/* Column header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{col.label}</span>
        <span className="text-xs tabular-nums text-muted-foreground bg-muted rounded-full px-2 py-0.5">{items.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 min-h-[80px]">
        {items.map((d, i) => (
          <div
            key={d.id}
            draggable={canEdit}
            onDragStart={e => {
              e.dataTransfer.setData("text/plain", d.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <DecisionCard
              d={d} i={i} canEdit={canEdit}
              onEdit={() => onEdit(d)}
              onDelete={() => onDelete(d.id)}
              expanded={expanded === d.id}
              onToggleFollowup={() => onToggleFollowup(d.id)}
            />
          </div>
        ))}
        {!items.length && (
          <div className="flex-1 flex items-center justify-center py-6">
            <span className="text-xs text-muted-foreground/50">Sin decisiones</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TabDecisions ──────────────────────────────────────────────────────────────

function TabDecisions({ canEdit }: { canEdit: boolean }) {
  const { data: cycles = [] } = useCycles();
  const [cycleId, setCycleId] = useState("");
  const [view, setView] = useState<"list" | "kanban">("kanban");

  const activeCycle = cycles.find(c => c.status === "ACTIVE") ?? cycles[0];
  const effectiveCycleId = cycleId || activeCycle?.id || "";

  const { data: decisions = [], isLoading } = useBoardDecisions(effectiveCycleId || undefined);
  const upsert = useUpsertBoardDecision();
  const del = useDeleteBoardDecision();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedFollowup, setExpandedFollowup] = useState<string | null>(null);

  const canAdd = decisions.filter(d => d.status !== "CLOSED").length < 3;

  const moveDecision = async (id: string, newStatus: BoardDecision["status"]) => {
    const d = decisions.find(x => x.id === id);
    if (!d || d.status === newStatus) return;
    await upsert.mutateAsync({ id, data: { status: newStatus } });
  };

  if (isLoading) return <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Decisiones del Consejo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Máx. 3 decisiones activas por ciclo. Arrastrá la tarjeta para cambiar su estado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm h-9"
            value={cycleId} onChange={e => setCycleId(e.target.value)}>
            <option value="">Ciclo activo</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Vista toggle */}
          <div className="flex rounded-md border border-border overflow-hidden h-9">
            <button
              onClick={() => setView("list")}
              className={cn("px-3 text-xs font-medium transition-colors flex items-center gap-1.5",
                view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Minus className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn("px-3 text-xs font-medium transition-colors flex items-center gap-1.5",
                view === "kanban" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <ChevronRight className="h-3.5 w-3.5" /> Kanban
            </button>
          </div>
          {canEdit && !showForm && canAdd && (
            <Button size="sm" className="gap-1.5 h-9" onClick={() => { setEditingId(null); setShowForm(true); }}>
              <Plus className="h-3.5 w-3.5" /> Agregar
            </Button>
          )}
        </div>
      </div>

      {showForm && !editingId && effectiveCycleId && (
        <DecisionForm cycleId={effectiveCycleId} initial={{}} onDone={() => setShowForm(false)} />
      )}

      {!decisions.length && !showForm && (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Gavel className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">Sin decisiones registradas</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Registra las decisiones que el Consejo necesita tomar.
          </p>
          {canEdit && effectiveCycleId && (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Primera decisión
            </Button>
          )}
        </div>
      )}

      {/* ── KANBAN ── */}
      {view === "kanban" && !!decisions.length && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLS.map(col => {
            const colItems = decisions.filter(d => d.status === col.status);
            return (
              <KanbanColumn
                key={col.status}
                col={col}
                items={colItems}
                canEdit={canEdit}
                onEdit={d => { setEditingId(d.id); setShowForm(false); }}
                onDelete={id => del.mutate(id)}
                expanded={expandedFollowup}
                onToggleFollowup={id => setExpandedFollowup(expandedFollowup === id ? null : id)}
                onDrop={moveDecision}
              />
            );
          })}
        </div>
      )}

      {/* ── LISTA ── */}
      {view === "list" && !!decisions.length && (
        <div className="space-y-3 max-w-3xl">
          {decisions.map((d, i) => (
            <div key={d.id}
              draggable={false}
            >
              {editingId === d.id && effectiveCycleId ? (
                <DecisionForm cycleId={effectiveCycleId} initial={d} decisionId={d.id} onDone={() => setEditingId(null)} />
              ) : (
                <DecisionCard
                  d={d} i={i} canEdit={canEdit}
                  onEdit={() => setEditingId(d.id)}
                  onDelete={() => del.mutate(d.id)}
                  expanded={expandedFollowup === d.id}
                  onToggleFollowup={() => setExpandedFollowup(expandedFollowup === d.id ? null : d.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inline edit en kanban */}
      {view === "kanban" && editingId && effectiveCycleId && (
        <div className="max-w-xl">
          <DecisionForm
            cycleId={effectiveCycleId}
            initial={decisions.find(d => d.id === editingId) ?? {}}
            decisionId={editingId}
            onDone={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  );
}

function FollowupInline({ decision, onClose, canEdit }: { decision: BoardDecision; onClose: () => void; canEdit: boolean }) {
  const [note, setNote] = useState((decision as any).follow_up_note ?? "");
  const [verified, setVerified] = useState((decision as any).follow_up_verified ?? false);
  const updateFollowup = useUpdateDecisionFollowup();

  return (
    <div className="mt-2 p-3 border rounded-md bg-muted/20 space-y-2">
      <p className="text-xs font-medium">¿Se ejecutó? ¿Cómo se verifica en el próximo Pulso?</p>
      {canEdit ? (
        <>
          <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs resize-none min-h-[56px]"
            value={note} onChange={e => setNote(e.target.value)} placeholder="Nota de seguimiento…" />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />
              Verificado en el Pulso
            </label>
            <Button size="sm" className="h-6 text-xs" onClick={() => {
              updateFollowup.mutate({ id: decision.id, follow_up_note: note, follow_up_verified: verified });
              onClose();
            }}>
              Guardar
            </Button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{(decision as any).follow_up_note || "Sin nota de seguimiento."}</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TAB 4: CONFIGURAR (KRs Críticos)
// ════════════════════════════════════════════════════════════════════

function TabSetup({ canEdit }: { canEdit: boolean }) {
  const { data: cycles = [] } = useCycles();
  const activeCycle = cycles.find(c => c.status === "ACTIVE") ?? cycles[0];
  const [cycleId, setCycleId] = useState(activeCycle?.id ?? "");
  const effectiveCycleId = cycleId || activeCycle?.id || "";

  const { data: krs = [], isLoading } = useCycleKRs(effectiveCycleId || undefined);
  const setKrCritical = useSetKrCritical();

  const grouped = useMemo(() => {
    const map = new Map<string, { objTitle: string; objCode: string | null; items: typeof krs }>();
    for (const kr of krs) {
      if (!map.has(kr.objective_id)) {
        map.set(kr.objective_id, { objTitle: kr.objective_title, objCode: kr.objective_code, items: [] });
      }
      map.get(kr.objective_id)!.items.push(kr);
    }
    return Array.from(map.values());
  }, [krs]);

  const criticalCount = krs.filter(k => k.is_critical).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold">Configurar KRs Críticos — Gates del OKR</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Un KR Crítico (Gate) es aquel que si falla, el OKR no cuenta aunque los demás estén en verde.
          Marca los KRs que funcionan como restricción o cuello de botella del objetivo.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <select className="rounded-md border border-border bg-background px-3 py-2 text-sm h-9"
          value={cycleId} onChange={e => setCycleId(e.target.value)}>
          <option value="">Ciclo activo</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <Star className="h-4 w-4" />
            <span>{criticalCount} KR{criticalCount > 1 ? "s" : ""} marcado{criticalCount > 1 ? "s" : ""} como Gate</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : !grouped.length ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Star className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm">Selecciona un ciclo con OKRs para configurar KRs Críticos</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ objTitle, objCode, items }) => (
            <div key={objTitle}>
              <div className="flex items-center gap-2 mb-2">
                {objCode && <span className="text-xs font-mono text-muted-foreground">{objCode}</span>}
                <h3 className="text-sm font-semibold">{objTitle}</h3>
              </div>
              <div className="space-y-1.5 pl-3 border-l-2 border-muted">
                {items.map(kr => (
                  <div key={kr.id} className={cn(
                    "flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg border transition-colors",
                    kr.is_critical ? "border-amber-300 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-900/50" : "border-border hover:border-muted-foreground/30"
                  )}>
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        disabled={!canEdit}
                        onClick={() => setKrCritical.mutate({ krId: kr.id, isCritical: !kr.is_critical })}
                        className={cn(
                          "h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                          kr.is_critical
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-muted-foreground/30 hover:border-amber-400",
                          !canEdit && "cursor-default"
                        )}
                        title={kr.is_critical ? "Desmarcar como Gate" : "Marcar como Gate"}
                      >
                        <Star className="h-3.5 w-3.5" fill={kr.is_critical ? "currentColor" : "none"} />
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {kr.code && <span className="font-mono text-muted-foreground mr-1 text-xs">{kr.code}</span>}
                          {kr.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{kr.objective_level}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                      <div className="text-right hidden sm:block">
                        <ProgressBar value={kr.progress} className="w-16 mb-0.5" />
                        <span className="tabular-nums">{fmtPct(kr.progress)}</span>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full font-medium", {
                        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400": kr.status === "ON_TRACK",
                        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400": kr.status === "AT_RISK",
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400": kr.status === "BEHIND",
                        "bg-muted text-muted-foreground": !["ON_TRACK","AT_RISK","BEHIND"].includes(kr.status),
                      })}>
                        {kr.status === "ON_TRACK" ? "OK" : kr.status === "AT_RISK" ? "Riesgo" : kr.status === "BEHIND" ? "Atrás" : kr.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guide */}
      <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
        <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">¿Cuándo marcar un KR como Gate?</h4>
        <ul className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
          <li>• <strong>Define si el objetivo es real o cosmético:</strong> si no se cumple, el OKR no cuenta aunque otros KRs estén en verde</li>
          <li>• <strong>Es indicador líder / restricción / cuello de botella</strong> del objetivo</li>
          <li>• <strong>No</strong> se puede compensar con el avance de otros KRs</li>
          <li>• Regla práctica: máx. 1-2 Gates por objetivo</li>
        </ul>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════════

export default function ConsejoPage() {
  const [tab, setTab] = useState<TabId>("pulso");
  const { user } = useAuth();
  const canEdit = user?.role === "OWNER" || user?.role === "ADMIN";

  return (
    <div className="p-6 space-y-0">
      <PageHeader
        title="Consejo"
        description="Sistema de gobierno del Consejo: Pulso OKR mensual, No Negociables y Bitácora de Decisiones"
        actions={
          <Link href="/reports/consejo" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <FileText className="h-4 w-4" />
            Informe imprimible
          </Link>
        }
      />

      <div className="mt-6">
        <TabBar active={tab} onChange={setTab} />

        {tab === "pulso"      && <TabPulso      canEdit={canEdit} />}
        {tab === "guardrails" && <TabGuardrails canEdit={canEdit} />}
        {tab === "decisions"  && <TabDecisions  canEdit={canEdit} />}
        {tab === "setup"      && <TabSetup      canEdit={canEdit} />}
      </div>
    </div>
  );
}
