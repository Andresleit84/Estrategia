"use client";

import { useState, useEffect } from "react";
import { useAdminOrgs, useUpdateOrgPlan, OrgSummary } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Users, Target, Save, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORM_ORG_ID = "3ff4962e-074a-4b1e-853b-eba11bb72f13";

const PLAN_STYLE: Record<string, string> = {
  FREE:       "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PRO:        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ENTERPRISE: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

// ── Semaphore ─────────────────────────────────────────────────────────────────

function trialStatus(startsAt: string | null | undefined, expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const now      = Date.now();
  const end      = new Date(expiresAt).getTime();
  const daysLeft = Math.ceil((end - now) / 86_400_000);

  if (daysLeft <= 0) return { level: "expired", daysLeft: 0, pct: 100 } as const;

  const start    = startsAt ? new Date(startsAt).getTime() : end - 15 * 86_400_000;
  const total    = Math.max(end - start, 1);
  const elapsed  = Math.max(now - start, 0);
  const pct      = Math.min(Math.round((elapsed / total) * 100), 100);

  const level = daysLeft <= 3 ? "red" : daysLeft <= 7 ? "amber" : "green";
  return { level, daysLeft, pct } as const;
}

type TrialLevel = "green" | "amber" | "red" | "expired";

const SEMAPHORE: Record<TrialLevel, { dot: string; bar: string; track: string; text: string; label: string }> = {
  green:   { dot: "bg-green-500",  bar: "bg-green-500",  track: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400",  label: "Al día" },
  amber:   { dot: "bg-amber-500",  bar: "bg-amber-500",  track: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-400",  label: "Por vencer" },
  red:     { dot: "bg-red-500",    bar: "bg-red-500",    track: "bg-red-100 dark:bg-red-900/30",      text: "text-red-700 dark:text-red-400",      label: "Urgente" },
  expired: { dot: "bg-slate-400",  bar: "bg-slate-400",  track: "bg-slate-100 dark:bg-slate-800",     text: "text-slate-500 dark:text-slate-400",  label: "Vencido" },
};

function TrialIndicator({ org }: { org: OrgSummary }) {
  if (org.plan !== "FREE") return null;
  const status = trialStatus(org.trial_starts_at, org.trial_expires_at);
  if (!status) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
        <span className="text-[11px] text-muted-foreground">Sin fecha</span>
      </div>
    );
  }

  const s = SEMAPHORE[status.level];
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

  return (
    <div className="space-y-1.5 pt-1 border-t border-border/50">
      {/* Semaphore row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "h-2.5 w-2.5 rounded-full shrink-0",
            s.dot,
            status.level === "red" && "animate-pulse",
          )} />
          <span className={cn("text-[11px] font-semibold", s.text)}>{s.label}</span>
          {status.level !== "expired" && (
            <span className="text-[11px] text-muted-foreground">
              · {status.daysLeft} día{status.daysLeft !== 1 ? "s" : ""} restantes
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{status.pct}% transcurrido</span>
      </div>

      {/* Progress bar */}
      <div className={cn("h-1.5 w-full rounded-full overflow-hidden", s.track)}>
        <div
          className={cn("h-full rounded-full transition-all", s.bar)}
          style={{ width: `${status.pct}%` }}
        />
      </div>

      {/* Date range */}
      {(org.trial_starts_at || org.trial_expires_at) && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{org.trial_starts_at ? fmtDate(org.trial_starts_at) : "—"}</span>
          <span>{org.trial_expires_at ? fmtDate(org.trial_expires_at) : "—"}</span>
        </div>
      )}
    </div>
  );
}

// ── OrgCard ───────────────────────────────────────────────────────────────────

function OrgCard({ org }: { org: OrgSummary }) {
  const [plan, setPlan]               = useState(org.plan);
  const [periodStart, setPeriodStart] = useState(
    org.trial_starts_at ? org.trial_starts_at.split("T")[0] : "",
  );
  const [periodEnd, setPeriodEnd] = useState(
    org.trial_expires_at ? org.trial_expires_at.split("T")[0] : "",
  );
  const [notes, setNotes] = useState("");

  useEffect(() => { setPlan(org.plan); }, [org.plan]);
  useEffect(() => { setPeriodStart(org.trial_starts_at ? org.trial_starts_at.split("T")[0] : ""); }, [org.trial_starts_at]);
  useEffect(() => { setPeriodEnd(org.trial_expires_at ? org.trial_expires_at.split("T")[0] : ""); }, [org.trial_expires_at]);

  const isDirty =
    plan !== org.plan ||
    periodStart !== (org.trial_starts_at?.split("T")[0] ?? "") ||
    periodEnd   !== (org.trial_expires_at?.split("T")[0] ?? "");

  const update     = useUpdateOrgPlan();
  const isPlatform = org.id === PLATFORM_ORG_ID;

  async function save() {
    try {
      await update.mutateAsync({
        orgId: org.id,
        plan: plan as any,
        periodStart: periodStart || undefined,
        periodEnd:   periodEnd   || undefined,
        notes:       notes       || undefined,
      });
      toast.success(`Plan de ${org.name} actualizado a ${plan}`);
      setNotes("");
    } catch {
      toast.error("Error al actualizar el plan");
    }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-3 transition-colors",
      isPlatform && "border-primary/20 bg-primary/3"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
            isPlatform ? "bg-primary/15" : "bg-muted"
          )}>
            {isPlatform
              ? <Shield className="h-4 w-4 text-primary" />
              : <Building2 className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">{org.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{org.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />{org.member_count}
            <span className="mx-0.5">·</span>
            <Target className="h-3 w-3" />{org.objective_count}
          </div>
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold", PLAN_STYLE[org.plan] ?? PLAN_STYLE.FREE)}>
            {org.plan}
          </span>
        </div>
      </div>

      {/* Semaphore — solo plan FREE */}
      {!isPlatform && <TrialIndicator org={org} />}

      {/* Controls */}
      {!isPlatform && (
        <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-border/50">
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Plan</label>
            <Select value={plan} onChange={e => setPlan(e.target.value)} className="h-8 text-xs py-0">
              <SelectOption value="FREE">Free</SelectOption>
              <SelectOption value="PRO">Pro</SelectOption>
              <SelectOption value="ENTERPRISE">Enterprise</SelectOption>
            </Select>
          </div>

          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Inicio</label>
            <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="h-8 text-xs" />
          </div>

          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vence</label>
            <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="h-8 text-xs" />
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Referencia de pago</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-8 text-xs" placeholder="Ej: transf. 28/05" />
          </div>

          <Button
            size="sm"
            variant={isDirty ? "default" : "outline"}
            className="h-8 gap-1.5 shrink-0"
            onClick={save}
            disabled={update.isPending}
          >
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      )}

      {isPlatform && (
        <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
          Organización de la plataforma — plan no editable.
        </p>
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function PlatformOrgsPanel() {
  const { data: orgs = [], isLoading } = useAdminOrgs();

  const sorted = [...orgs].sort((a, b) => {
    if (a.id === PLATFORM_ORG_ID) return -1;
    if (b.id === PLATFORM_ORG_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border bg-card p-4 h-32 animate-pulse bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {orgs.length} empresa{orgs.length !== 1 ? "s" : ""} registrada{orgs.length !== 1 ? "s" : ""}.
        Cambia el plan y guardá — toma efecto en el próximo request del usuario.
      </p>
      {sorted.map(org => <OrgCard key={org.id} org={org} />)}
    </div>
  );
}
