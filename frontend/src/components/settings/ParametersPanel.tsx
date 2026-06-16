"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOrgParameters, useUpdateOrgParameters,
  PARAMETER_DEFAULTS, type OrgParameters,
} from "@/hooks/useOrgParameters";
import { CheckCircle, Loader2, Info, Target, BarChart2, Clock, ListChecks, Zap, Mail, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditableParams = Omit<OrgParameters, "organization_id" | "raw">;

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, description, children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b bg-muted/20">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </Card>
  );
}

// ─── Number field ─────────────────────────────────────────────────────────────

function NumberField({
  label, description, value, onChange, min, max, step = 1, unit,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="w-24 text-right"
        />
        {unit && <span className="text-xs text-muted-foreground w-12">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Story Points Field ───────────────────────────────────────────────────────

function StoryPointsField({
  value, onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const [raw, setRaw] = useState(value.join(", "));
  const [error, setError] = useState("");

  useEffect(() => { setRaw(value.join(", ")); }, [value]);

  function handleBlur() {
    const parts = raw.split(/[\s,]+/).filter(Boolean).map(Number);
    if (parts.some(isNaN) || parts.length < 3) {
      setError("Mínimo 3 valores numéricos separados por coma");
      return;
    }
    const sorted = [...new Set(parts)].sort((a, b) => a - b);
    setError("");
    setRaw(sorted.join(", "));
    onChange(sorted);
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Escala de Story Points</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Valores disponibles al estimar historias en el backlog (Fibonacci recomendado).
        </p>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
      <div className="shrink-0">
        <Input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={handleBlur}
          placeholder="1, 2, 3, 5, 8, 13, 21"
          className="w-52 text-right font-mono text-sm"
        />
      </div>
    </div>
  );
}

// ─── SMTP Section ────────────────────────────────────────────────────────────

function SmtpSection({ form, set }: {
  form: EditableParams;
  set: <K extends keyof EditableParams>(key: K, val: EditableParams[K]) => void;
}) {
  const [showPass, setShowPass] = useState(false);
  const isConfigured = !!form.smtp_host;

  return (
    <Section icon={Mail} title="Correo saliente (SMTP)"
      description="Configura el servidor desde el que se envían invitaciones y enlaces de restablecimiento de contraseña.">

      {/* Status indicator */}
      <div className={cn(
        "flex items-center gap-2 text-xs px-3 py-2 rounded-lg",
        isConfigured
          ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
          : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
      )}>
        <span className={cn("h-2 w-2 rounded-full", isConfigured ? "bg-green-500" : "bg-amber-400")} />
        {isConfigured ? "SMTP configurado — los correos se envían correctamente." : "Sin configurar — los correos se registran en el log del servidor pero no se envían."}
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Servidor SMTP</p>
          <Input
            value={form.smtp_host}
            onChange={e => set("smtp_host", e.target.value)}
            placeholder="smtp.gmail.com"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Puerto</p>
          <Input
            type="number"
            value={form.smtp_port}
            onChange={e => set("smtp_port", parseInt(e.target.value) || 587)}
            placeholder="587"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Usuario</p>
          <Input
            value={form.smtp_user}
            onChange={e => set("smtp_user", e.target.value)}
            placeholder="tu@empresa.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Contraseña / App password</p>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              value={form.smtp_pass === "***" ? "" : (form.smtp_pass ?? "")}
              onChange={e => set("smtp_pass", e.target.value)}
              placeholder={form.smtp_pass === "***" ? "••••••••••• (ya configurada)" : "Contraseña o token de app"}
              autoComplete="new-password"
              className="pr-10 font-mono text-sm"
            />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 pt-1">
        <p className="text-sm font-medium">Dirección remitente (From)</p>
        <Input
          value={form.smtp_from}
          onChange={e => set("smtp_from", e.target.value)}
          placeholder="OKR System <noreply@miempresa.com>"
        />
        <p className="text-xs text-muted-foreground">
          Aparecerá como remitente en todos los correos del sistema. Ej: <code>Nombre &lt;correo@dominio.com&gt;</code>
        </p>
      </div>
    </Section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParametersPanel() {
  const { data: params, isLoading } = useOrgParameters();
  const update = useUpdateOrgParameters();
  const [form, setForm] = useState<EditableParams>(PARAMETER_DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (params && !initialized) {
      const { organization_id: _, raw: __, ...rest } = params;
      setForm(rest);
      setInitialized(true);
    }
  }, [params, initialized]);

  function set<K extends keyof EditableParams>(key: K, val: EditableParams[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    // If smtp_pass is empty string, don't send it (keep existing password in DB)
    const payload = { ...form };
    if (!payload.smtp_pass || payload.smtp_pass === "") delete payload.smtp_pass;
    await update.mutateAsync(payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  function stripSaved(p: EditableParams) {
    // Don't count smtp_pass "***" (masked saved value) as dirty
    return { ...p, smtp_pass: p.smtp_pass === "***" ? "***" : p.smtp_pass };
  }
  const savedForm = params
    ? (() => { const { organization_id: _, raw: __, ...rest } = params; return rest; })()
    : PARAMETER_DEFAULTS;
  const isDirty = JSON.stringify(stripSaved(form)) !== JSON.stringify(stripSaved(savedForm));

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Estos parámetros aplican a toda la organización. Los cambios se reflejan inmediatamente en las validaciones y alertas del sistema.
        </p>
      </div>

      {/* OKR Limits */}
      <Section icon={Target} title="Límites de OKRs"
        description="Controla cuántos objetivos y resultados clave pueden crearse por ciclo y nivel.">
        <NumberField
          label="Máx. objetivos por nivel"
          description="Límite de objetivos activos por nivel (empresa, área, equipo) en un ciclo."
          value={form.max_objectives_per_level}
          onChange={(v) => set("max_objectives_per_level", v)}
          min={1} max={20} unit="obj."
        />
        <div className="border-t pt-4">
          <NumberField
            label="Máx. KRs por objetivo"
            description="Límite de resultados clave activos por objetivo."
            value={form.max_krs_per_objective}
            onChange={(v) => set("max_krs_per_objective", v)}
            min={1} max={15} unit="KRs"
          />
        </div>
        <div className="border-t pt-4">
          <NumberField
            label="Umbral de auto-completado"
            description="Progreso mínimo para que el sistema marque automáticamente un objetivo como completado."
            value={form.auto_complete_threshold}
            onChange={(v) => set("auto_complete_threshold", v)}
            min={50} max={100} unit="%"
          />
        </div>
      </Section>

      {/* Confidence & Progress thresholds */}
      <Section icon={BarChart2} title="Umbrales de confianza y progreso"
        description="Define cuándo un KR se clasifica como En riesgo, En curso o Detrás del plan.">
        <NumberField
          label="Umbral AT RISK (confianza)"
          description="Por debajo de este valor un KR se marca como En riesgo (rojo)."
          value={Math.round(form.confidence_at_risk * 100)}
          onChange={(v) => set("confidence_at_risk", v / 100)}
          min={10} max={60} unit="% conf."
        />
        <div className="border-t pt-4">
          <NumberField
            label="Umbral ON TRACK (confianza)"
            description="Por encima de este valor un KR se marca como En curso (verde)."
            value={Math.round(form.confidence_on_track * 100)}
            onChange={(v) => set("confidence_on_track", v / 100)}
            min={50} max={95} unit="% conf."
          />
        </div>
        <div className="border-t pt-4">
          <NumberField
            label="Umbral BEHIND (brecha de progreso)"
            description="Si el progreso esperado supera al real en más de este porcentaje, el KR se marca como Detrás."
            value={form.progress_behind_threshold}
            onChange={(v) => set("progress_behind_threshold", v)}
            min={5} max={60} unit="%"
          />
        </div>

        {/* Visual guide */}
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-green-500" />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0%</span>
            <span className="text-red-500">AT RISK &lt; {Math.round(form.confidence_at_risk * 100)}%</span>
            <span className="text-green-600">ON TRACK &gt; {Math.round(form.confidence_on_track * 100)}%</span>
            <span>100%</span>
          </div>
        </div>
      </Section>

      {/* Staleness */}
      <Section icon={Clock} title="Alertas de actividad"
        description="Cuándo el sistema considera que un OKR está inactivo o sin actualizar.">
        <NumberField
          label="Check-in obsoleto"
          description="Días sin actualizar un KR antes de marcarlo como inactivo."
          value={form.stale_checkin_days}
          onChange={(v) => set("stale_checkin_days", v)}
          min={3} max={60} unit="días"
        />
        <div className="border-t pt-4">
          <NumberField
            label="KR sin iniciar"
            description="Días desde el inicio del ciclo para alertar sobre un KR que aún no tiene progreso."
            value={form.unstarted_kr_days}
            onChange={(v) => set("unstarted_kr_days", v)}
            min={1} max={30} unit="días"
          />
        </div>
      </Section>

      {/* Backlog / Sprints */}
      <Section icon={ListChecks} title="Backlog y Sprints"
        description="Parámetros para la gestión táctica y de entregas.">
        <StoryPointsField
          value={form.story_points_scale}
          onChange={(v) => { set("story_points_scale", v); setSaved(false); }}
        />
        <div className="border-t pt-4">
          <NumberField
            label="Máx. sprints por año"
            description="Límite de sprints que puede crear un equipo en un año calendario."
            value={form.max_sprints_per_year}
            onChange={(v) => set("max_sprints_per_year", v)}
            min={12} max={104} unit="sprints"
          />
        </div>
      </Section>

      {/* SMTP */}
      <SmtpSection form={form} set={set} />

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={handleSave}
          disabled={update.isPending || !isDirty}
          className="gap-2"
        >
          {update.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
            : <><Zap className="h-4 w-4" /> Guardar parámetros</>}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" /> Cambios guardados
          </span>
        )}
        {update.isError && (
          <span className="text-sm text-destructive">Error al guardar</span>
        )}
      </div>
    </div>
  );
}
