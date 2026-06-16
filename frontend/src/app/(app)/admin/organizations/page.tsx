"use client";

import { useState } from "react";
import { useAdminOrgs, useUpdateOrgPlan, OrgSummary } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Building2, Users, Target, Calendar, Save, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  FREE:       { label: "Free",       className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  PRO:        { label: "Pro",        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  ENTERPRISE: { label: "Enterprise", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
};

const PLATFORM_ORG_ID = "3ff4962e-074a-4b1e-853b-eba11bb72f13";

function OrgRow({ org }: { org: OrgSummary }) {
  const [plan, setPlan]         = useState(org.plan);
  const [periodEnd, setPeriodEnd] = useState(
    org.trial_expires_at ? org.trial_expires_at.split("T")[0] : "",
  );
  const [notes, setNotes]       = useState("");
  const isDirty = plan !== org.plan || periodEnd !== (org.trial_expires_at?.split("T")[0] ?? "");

  const update = useUpdateOrgPlan();
  const isPlatform = org.id === PLATFORM_ORG_ID;

  async function save() {
    try {
      await update.mutateAsync({ orgId: org.id, plan: plan as any, periodEnd: periodEnd || undefined, notes: notes || undefined });
      toast.success(`Plan de ${org.name} actualizado a ${plan}`);
      setNotes("");
    } catch {
      toast.error("Error al actualizar el plan");
    }
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {isPlatform
              ? <Shield className="h-4 w-4 text-primary" />
              : <Building2 className="h-4 w-4 text-muted-foreground" />
            }
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{org.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{org.slug}</p>
          </div>
        </div>
      </td>

      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {org.member_count}
          <span className="mx-1 text-border">·</span>
          <Target className="h-3.5 w-3.5" /> {org.objective_count}
        </div>
      </td>

      <td className="py-3 px-4">
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold",
          PLAN_BADGE[org.plan]?.className
        )}>
          {PLAN_BADGE[org.plan]?.label ?? org.plan}
        </span>
      </td>

      <td className="py-3 px-4">
        <Select
          value={plan}
          onChange={e => setPlan(e.target.value)}
          disabled={isPlatform}
          className="h-8 w-32 text-xs py-0"
        >
          <SelectOption value="FREE">Free</SelectOption>
          <SelectOption value="PRO">Pro</SelectOption>
          <SelectOption value="ENTERPRISE">Enterprise</SelectOption>
        </Select>
      </td>

      <td className="py-3 px-4">
        <Input
          type="date"
          value={periodEnd}
          onChange={e => setPeriodEnd(e.target.value)}
          className="h-8 text-xs w-36"
          disabled={isPlatform}
          placeholder="Vence"
        />
      </td>

      <td className="py-3 px-4">
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="h-8 text-xs w-48"
          placeholder="Ej: Transferencia 15/05"
          disabled={isPlatform}
        />
      </td>

      <td className="py-3 px-4">
        {!isPlatform && (
          <Button
            size="sm"
            variant={isDirty ? "default" : "outline"}
            className="h-8 gap-1.5"
            onClick={save}
            disabled={update.isPending}
          >
            {update.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" />
            }
            Guardar
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function AdminOrganizationsPage() {
  const { user } = useAuth();
  const { data: orgs = [], isLoading } = useAdminOrgs();
  const router = useRouter();

  const isPlatformAdmin = user?.is_platform_admin === true;

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted-foreground">Acceso restringido.</p>
      </div>
    );
  }

  const sorted = [...orgs].sort((a, b) => {
    if (a.id === PLATFORM_ORG_ID) return -1;
    if (b.id === PLATFORM_ORG_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Organizaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {orgs.length} empresa{orgs.length !== 1 ? "s" : ""} registrada{orgs.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Uso</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Plan actual</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Nuevo plan</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Vence</th>
                <th className="py-2.5 px-4 text-left text-xs font-medium text-muted-foreground">Referencia pago</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(org => <OrgRow key={org.id} org={org} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
