"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCreateTeam } from "@/hooks/useTeams";
import { useCreateArea } from "@/hooks/useAreas";
import { useCreateGovernanceBody } from "@/hooks/useGovernance";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { Check, X, Loader2, Mail, Plus, Building2, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Bienvenida", "Estructura", "Equipos", "Miembros", "Listo"];

const PRESET_AREAS = ["RRHH", "TI", "Finanzas", "Cobranza", "Ventas", "Operaciones", "Legal", "Marketing"];
const AREA_COLORS  = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];
const GOV_TYPES = [
  { value: "CONSEJO",    label: "Consejo de Administración" },
  { value: "COMITE",     label: "Comité Directivo" },
  { value: "DIRECTORIO", label: "Directorio" },
  { value: "JUNTA",      label: "Junta General" },
  { value: "ASAMBLEA",   label: "Asamblea" },
  { value: "OTHER",      label: "Otro" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
            i < current   ? "bg-primary text-primary-foreground" :
            i === current ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" :
                            "bg-muted text-muted-foreground"
          )}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-px w-6", i < current ? "bg-primary" : "bg-muted")} />
          )}
        </div>
      ))}
    </div>
  );
}

type InviteStatus = "pending" | "sent" | "error";
interface InviteEntry { email: string; status: InviteStatus; error?: string }
interface AreaEntry   { name: string; color: string }

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mutateAsync: createTeam,  isPending: creatingTeam  } = useCreateTeam();
  const { mutateAsync: createArea,  isPending: creatingAreas } = useCreateArea();
  const { mutateAsync: createBody,  isPending: creatingBodies } = useCreateGovernanceBody();

  const [step, setStep] = useState(0);

  // Paso 1 — estructura
  const [areas, setAreas]                   = useState<AreaEntry[]>([]);
  const [areaInput, setAreaInput]           = useState("");
  const [hasGov, setHasGov]                 = useState(false);
  const [govName, setGovName]               = useState("");
  const [govType, setGovType]               = useState<"CONSEJO" | "COMITE" | "DIRECTORIO" | "JUNTA" | "ASAMBLEA" | "OTHER">("CONSEJO");
  const [structureError, setStructureError] = useState<string | null>(null);

  // Paso 2 — equipo
  const [teamName, setTeamName]   = useState("");
  const [teamDesc, setTeamDesc]   = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);

  // Paso 3 — invitaciones
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState("MEMBER");
  const [invites, setInvites]         = useState<InviteEntry[]>([]);
  const [sending, setSending]         = useState(false);

  // ── helpers áreas ──────────────────────────────────────────────────
  function addArea(name: string) {
    const n = name.trim();
    if (!n || areas.some(a => a.name.toLowerCase() === n.toLowerCase())) return;
    const color = AREA_COLORS[areas.length % AREA_COLORS.length];
    setAreas(prev => [...prev, { name: n, color }]);
    setAreaInput("");
  }

  const isSaving = creatingAreas || creatingBodies;

  async function handleStructureNext() {
    setStructureError(null);
    try {
      await Promise.all(
        areas.map((a) => createArea({ name: a.name, color: a.color }))
      );
      if (hasGov && govName.trim()) {
        await createBody({ name: govName.trim(), type: govType });
      }
      setStep(2);
    } catch (err: unknown) {
      setStructureError(getApiErrorMessage(err, "Error guardando la estructura"));
    }
  }

  // ── equipo ─────────────────────────────────────────────────────────
  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setTeamError(null);
    try {
      await createTeam({ name: teamName, description: teamDesc || undefined });
      setStep(3);
    } catch (err: unknown) {
      setTeamError(getApiErrorMessage(err, "Error al crear el equipo"));
    }
  }

  // ── invitaciones ───────────────────────────────────────────────────
  function addEmail() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@") || invites.some(i => i.email === email)) return;
    setInvites(prev => [...prev, { email, status: "pending" }]);
    setInviteEmail("");
  }

  async function sendInvitations() {
    const pending = invites.filter(i => i.status === "pending");
    if (pending.length === 0) { setStep(4); return; }
    setSending(true);
    const results = await Promise.allSettled(
      pending.map(entry =>
        api.post("/organizations/me/invitations", { email: entry.email, role: inviteRole })
      )
    );
    const resultByEmail = new Map(
      pending.map((entry, i) => [entry.email, results[i]])
    );
    setInvites(prev => prev.map((entry) => {
      const r = resultByEmail.get(entry.email);
      if (!r) return entry;
      if (r.status === "fulfilled") return { ...entry, status: "sent" };
      const msg = (r.reason as any)?.data?.message ?? "Error al enviar";
      return { ...entry, status: "error", error: Array.isArray(msg) ? msg[0] : msg };
    }));
    setSending(false);
    setStep(4);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground text-lg font-bold">O</div>
        </div>

        <StepIndicator current={step} />

        {/* PASO 0: Bienvenida */}
        {step === 0 && (
          <Card className="p-8 space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Bienvenido, {user?.name?.split(" ")[0]}</h1>
              <p className="text-muted-foreground">
                Tu organización <strong>{user?.org_name}</strong> está lista. Vamos a configurar lo esencial en 4 pasos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                { Icon: Building2, label: "Define áreas y gobierno" },
                { Icon: Users,     label: "Crea los equipos" },
                { Icon: Mail,      label: "Invita miembros" },
                { Icon: Check,     label: "Empieza con OKRs" },
              ].map(({ Icon, label }, i) => (
                <div key={label} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</div>
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(1)}>Empezar configuración</Button>
          </Card>
        )}

        {/* PASO 1: Estructura organizativa */}
        {step === 1 && (
          <Card className="p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Estructura organizativa</h2>
              <p className="text-sm text-muted-foreground">
                Define las áreas de tu organización y, si aplica, el cuerpo de gobierno. Puedes ampliar esto después desde Configuración.
              </p>
            </div>

            {/* Áreas */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Áreas
              </label>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_AREAS.filter(p => !areas.some(a => a.name === p)).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => addArea(preset)}
                    className="px-2.5 py-1 rounded-full text-xs border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Otra área personalizada…"
                  value={areaInput}
                  onChange={e => setAreaInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addArea(areaInput); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => addArea(areaInput)} disabled={!areaInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {areas.map(a => (
                    <span
                      key={a.name}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                      style={{ borderColor: a.color, color: a.color, backgroundColor: `${a.color}18` }}
                    >
                      {a.name}
                      <button
                        type="button"
                        onClick={() => setAreas(prev => prev.filter(x => x.name !== a.name))}
                        className="opacity-60 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Gobierno corporativo */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setHasGov(v => !v)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="mr-1">{hasGov ? "▾" : "▸"}</span>
                ¿Tienes cuerpo de gobierno? (Consejo, Comité, Directorio…)
              </button>

              {hasGov && (
                <div className="pl-5 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre (ej: Consejo de Administración)"
                      value={govName}
                      onChange={e => setGovName(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={govType}
                      onChange={e => setGovType(e.target.value as typeof govType)}
                      className="rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {GOV_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Puedes agregar más cuerpos y sus miembros desde Configuración → Gobierno.
                  </p>
                </div>
              )}
            </div>

            {structureError && <p className="text-sm text-destructive">{structureError}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={isSaving}>
                Omitir
              </Button>
              <Button className="flex-1" onClick={handleStructureNext} disabled={isSaving}>
                {isSaving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando…</>
                  : "Continuar"}
              </Button>
            </div>
          </Card>
        )}

        {/* PASO 2: Equipos */}
        {step === 2 && (
          <Card className="p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Crea tu primer equipo</h2>
              <p className="text-sm text-muted-foreground">
                Los OKRs tácticos se asignan a equipos. Luego podrás vincularlos a las áreas que acabas de crear.
              </p>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre del equipo</label>
                <Input required value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ej: Equipo de Producto" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Descripción <span className="font-normal">(opcional)</span></label>
                <Input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="¿De qué es responsable este equipo?" />
              </div>
              {teamError && <p className="text-sm text-destructive">{teamError}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(3)}>Omitir</Button>
                <Button type="submit" className="flex-1" disabled={creatingTeam}>
                  {creatingTeam ? "Creando…" : "Crear equipo"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* PASO 3: Invitaciones */}
        {step === 3 && (
          <Card className="p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Invita a tu equipo</h2>
              <p className="text-sm text-muted-foreground">Agrega los correos de tus colaboradores. También puedes hacerlo después desde Configuración.</p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="MEMBER">Miembro</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Button type="button" variant="outline" onClick={addEmail} disabled={!inviteEmail.trim()}>
                  Agregar
                </Button>
              </div>
              {invites.length > 0 && (
                <ul className="space-y-2">
                  {invites.map(entry => (
                    <li key={entry.email} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{entry.email}</span>
                      {entry.status === "sent"  && <Check className="h-4 w-4 text-okr-on-track shrink-0" />}
                      {entry.status === "error" && <span className="text-destructive text-xs">{entry.error}</span>}
                      {entry.status === "pending" && (
                        <button onClick={() => setInvites(p => p.filter(i => i.email !== entry.email))} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(4)} disabled={sending}>Omitir por ahora</Button>
              <Button className="flex-1" onClick={sendInvitations} disabled={sending}>
                {sending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando…</>
                  : invites.filter(i => i.status === "pending").length > 0
                    ? `Enviar ${invites.filter(i => i.status === "pending").length} invitación${invites.filter(i => i.status === "pending").length > 1 ? "es" : ""}`
                    : "Continuar"}
              </Button>
            </div>
          </Card>
        )}

        {/* PASO 4: Listo */}
        {step === 4 && (
          <Card className="p-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-okr-on-track-bg">
                <Check className="h-7 w-7 text-okr-on-track" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Todo listo</h2>
              {invites.filter(i => i.status === "sent").length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Se enviaron {invites.filter(i => i.status === "sent").length} invitación{invites.filter(i => i.status === "sent").length > 1 ? "es" : ""}.
                  Recibirán un enlace para unirse.
                </p>
              )}
              <p className="text-muted-foreground">
                Ya puedes comenzar a definir tus primeros OKRs estratégicos. El siguiente paso es crear un ciclo de planificación.
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-left space-y-1">
              <p className="font-medium text-foreground">¿Por dónde continuar?</p>
              <p className="text-muted-foreground">
                Puedes completar la configuración desde la <span className="font-semibold text-primary">Guía de Inicio</span> (botón en la parte inferior derecha) o explorar las secciones directamente desde la <span className="font-semibold text-primary">pantalla de inicio</span>.
              </p>
            </div>
            <Button className="w-full" onClick={() => router.push("/welcome")}>Ir a la pantalla de inicio</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
