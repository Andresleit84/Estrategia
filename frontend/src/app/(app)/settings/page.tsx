"use client";

import { useState, useEffect, useRef } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectOption } from "@/components/ui/select";
import {
  useOrganization, useOrgMembers, useUpdateOrganization,
  useInvitations, useInviteMember, useResendInvitation,
  useUpdateMemberRole, useResetMemberPassword, useRemoveMember, useSendResetEmail,
  type OrgMember,
} from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import {
  useUserProfile, useUpdateProfile, useMfaStatus,
  useSetupMfa, useEnableMfa, useDisableMfa, useLogoutAll,
} from "@/hooks/useUserProfile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2, Layers, User, Shield, Lock, Download, Trash2,
  CheckCircle, Smartphone, LogOut, AlertTriangle, Activity,
  MoreVertical, KeyRound, UserX, Send, UserPlus, ShieldCheck,
  Copy, Eye, EyeOff, Network, Users, ChevronRight, SlidersHorizontal, Loader2,
  Landmark, UserCog, Globe, BarChart3, CalendarRange, Database, MonitorSmartphone, RotateCcw, Upload, ChevronDown, Bell,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MonitorTab } from "@/components/settings/MonitorTab";
import { EmpresasTab } from "@/components/settings/EmpresasTab";
import { PlatformOrgsPanel } from "@/components/settings/PlatformOrgsPanel";
import { DemoTab } from "@/components/settings/DemoTab";
import { ImportTab } from "@/components/settings/ImportTab";
import { AreasPanel } from "@/components/settings/AreasPanel";
import { GovernancePanel } from "@/components/settings/GovernancePanel";
import { TeamsSettingsPanel } from "@/components/settings/TeamsSettingsPanel";
import { ParametersPanel } from "@/components/settings/ParametersPanel";
import { NotificationsPanel } from "@/components/settings/NotificationsPanel";
import { ConsultantNotificationsSection } from "@/components/settings/ConsultantNotificationsSection";
import { useOrgParameters } from "@/hooks/useOrgParameters";
import { useMyOrgs } from "@/hooks/useAdmin";
import { CyclesContent } from "@/app/(app)/cycles/page";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = [
  { value: "AGILE",       label: "Ágil",       desc: "Sprints, retrospectivas, velocidad de equipo" },
  { value: "TRADITIONAL", label: "Tradicional", desc: "Planificación anual, cascada de objetivos" },
  { value: "HYBRID",      label: "Híbrido",     desc: "Combina metodologías según el equipo" },
];

const SECTORS = [
  { value: "GENERIC",               label: "Genérico" },
  { value: "COOPERATIVE_FINANCIAL", label: "Cooperativa Financiera" },
  { value: "BANKING",               label: "Banca" },
  { value: "INSURANCE",             label: "Seguros" },
  { value: "OTHER",                 label: "Otro" },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER:              "bg-okr-completed-bg text-okr-completed",
  ADMIN:              "bg-okr-on-track-bg text-okr-on-track",
  MANAGER:            "bg-okr-at-risk-bg text-okr-at-risk",
  MEMBER:             "bg-muted text-muted-foreground",
  VIEWER:             "bg-muted text-muted-foreground",
  SECTOR_DIAGNOSTICS: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER:              "Propietario",
  ADMIN:              "Administrador",
  MANAGER:            "Estrategia",
  MEMBER:             "Táctico",
  VIEWER:             "Visualizador",
  SECTOR_DIAGNOSTICS: "Diagnóstico Sectorial",
};

const ASSIGNABLE_ROLES = [
  { value: "ADMIN",              label: "Administrador" },
  { value: "MANAGER",            label: "Estrategia" },
  { value: "MEMBER",             label: "Táctico" },
  { value: "VIEWER",             label: "Visualizador" },
  { value: "SECTOR_DIAGNOSTICS", label: "Diagnóstico Sectorial" },
];

const MENU_ITEMS = [
  { key: "welcome",            label: "Inicio",                   group: "Inicio" },
  { key: "my-okrs",            label: "Mis OKRs",                 group: "Inicio" },
  { key: "portfolio",          label: "Portafolio de clientes",   group: "Inicio" },
  { key: "sector-assessment",  label: "Diagnóstico Sectorial",    group: "Diagnóstico" },
  { key: "problems",           label: "Problemas detectados",     group: "Diagnóstico" },
  { key: "agreements",         label: "Acuerdos y compromisos",   group: "Estrategia" },
  { key: "strategy",           label: "Dirección estratégica",    group: "Estrategia" },
  { key: "program",            label: "Programa / Hoja de ruta",  group: "Estrategia" },
  { key: "strategic",          label: "OKRs de empresa",          group: "Estrategia" },
  { key: "traceability",       label: "Trazabilidad",             group: "Estrategia" },
  { key: "tactical",           label: "OKRs de equipo",           group: "Ejecución" },
  { key: "checkins",           label: "Check-ins",                group: "Ejecución" },
  { key: "initiatives",        label: "Iniciativas",              group: "Ejecución" },
  { key: "delivery",           label: "Entregables",              group: "Ejecución" },
  { key: "backlog",            label: "Backlog",                  group: "Ejecución" },
  { key: "sprints",            label: "Sprints",                  group: "Ejecución" },
  { key: "reports",            label: "Reportes",                 group: "Análisis" },
  { key: "cycle-close",        label: "Cierre de ciclo",          group: "Análisis" },
  { key: "governance",         label: "Gobierno OKR",             group: "Análisis" },
  { key: "consejo",            label: "Paquete Consejo",          group: "Análisis" },
  { key: "demo-setup",         label: "Demo Express",             group: "Consultoría" },
  { key: "consultant-roadmap", label: "Ruta de implementación",   group: "Consultoría" },
  { key: "ai-assistant",       label: "IA Asistente",             group: "Consultoría" },
  { key: "getting-started",    label: "Primeros pasos",           group: "Consultoría" },
  { key: "docs",               label: "Documentación",            group: "Consultoría" },
];

const DEFAULT_MENU_CONFIG: Record<string, Record<string, boolean>> = {
  ADMIN: {
    welcome: true,  "my-okrs": true,  portfolio: true,
    "sector-assessment": true,  problems: true,
    agreements: true,  strategy: true,  program: true,  strategic: true,  traceability: true,
    tactical: true,  checkins: true,  initiatives: true,  delivery: true,  backlog: true,  sprints: true,
    reports: true,  "cycle-close": true,  governance: true,  consejo: true,
    "demo-setup": true,  "consultant-roadmap": true,  "ai-assistant": true,  "getting-started": true,  docs: true,
  },
  MANAGER: {
    welcome: true,  "my-okrs": true,  portfolio: false,
    "sector-assessment": true,  problems: true,
    agreements: true,  strategy: true,  program: false,  strategic: true,  traceability: true,
    tactical: false,  checkins: true,  initiatives: false,  delivery: true,  backlog: true,  sprints: false,
    reports: true,  "cycle-close": true,  governance: true,  consejo: true,
    "demo-setup": false,  "consultant-roadmap": false,  "ai-assistant": true,  "getting-started": true,  docs: true,
  },
  MEMBER: {
    welcome: true,  "my-okrs": true,  portfolio: false,
    "sector-assessment": false,  problems: false,
    agreements: false,  strategy: false,  program: false,  strategic: false,  traceability: false,
    tactical: true,  checkins: true,  initiatives: true,  delivery: true,  backlog: true,  sprints: true,
    reports: false,  "cycle-close": false,  governance: false,  consejo: false,
    "demo-setup": false,  "consultant-roadmap": false,  "ai-assistant": false,  "getting-started": true,  docs: true,
  },
  SECTOR_DIAGNOSTICS: {
    welcome: false,  "my-okrs": false,  portfolio: false,
    "sector-assessment": true,  problems: false,
    agreements: false,  strategy: false,  program: false,  strategic: false,  traceability: false,
    tactical: false,  checkins: false,  initiatives: false,  delivery: false,  backlog: false,  sprints: false,
    reports: false,  "cycle-close": false,  governance: false,  consejo: false,
    "demo-setup": false,  "consultant-roadmap": false,  "ai-assistant": false,  "getting-started": false,  docs: false,
  },
};

const TIMEZONES = [
  "America/Bogota", "America/Lima", "America/Santiago", "America/Buenos_Aires",
  "America/Mexico_City", "America/Caracas", "America/La_Paz", "America/Asuncion",
  "America/Guayaquil", "America/Montevideo", "America/Panama", "America/Costa_Rica",
  "America/New_York", "Europe/Madrid", "UTC",
];

type Tab =
  | "org" | "areas" | "gobierno" | "teams" | "cycles" | "usuarios" | "permisos"
  | "pantallas" | "parametros" | "notificaciones" | "import"
  | "empresas"
  | "profile" | "security" | "privacy"
  | "monitor" | "demo"
  | "misclientes"
  | "plataformaOrgs";

// ─── Nav icon + color config ──────────────────────────────────────────────────

const NAV_ICON: Record<Tab, { icon: React.ElementType; bg: string }> = {
  org:           { icon: Building2,          bg: "bg-blue-500" },
  gobierno:      { icon: Landmark,           bg: "bg-violet-500" },
  areas:         { icon: Network,            bg: "bg-indigo-500" },
  teams:         { icon: Users,              bg: "bg-cyan-600" },
  usuarios:      { icon: UserCog,            bg: "bg-emerald-500" },
  permisos:      { icon: KeyRound,           bg: "bg-amber-500" },
  pantallas:     { icon: MonitorSmartphone,  bg: "bg-sky-600" },
  parametros:    { icon: SlidersHorizontal,  bg: "bg-orange-500" },
  notificaciones:{ icon: Bell,              bg: "bg-violet-500" },
  cycles:        { icon: CalendarRange,      bg: "bg-sky-500" },
  empresas:      { icon: Globe,              bg: "bg-slate-500" },
  demo:          { icon: Database,           bg: "bg-fuchsia-600" },
  import:        { icon: Upload,            bg: "bg-blue-600" },
  profile:       { icon: User,               bg: "bg-purple-500" },
  security:      { icon: Shield,             bg: "bg-rose-500" },
  privacy:       { icon: Lock,               bg: "bg-pink-500" },
  monitor:       { icon: BarChart3,          bg: "bg-teal-500" },
  misclientes:   { icon: Building2,          bg: "bg-indigo-600" },
  plataformaOrgs:{ icon: Shield,             bg: "bg-rose-600" },
};

// ─── Sidebar nav definition ───────────────────────────────────────────────────

interface NavItem { id: Tab; label: string; roles?: string[]; trialHidden?: boolean; consultantOnly?: boolean; platformAdminOnly?: boolean }
interface NavGroup { heading: string; items: NavItem[]; roles?: string[]; hiddenForTrial?: boolean; consultantOnly?: boolean; platformAdminOnly?: boolean }

const NAV: NavGroup[] = [
  {
    heading: "org",
    items: [
      { id: "org",        label: "org",        roles: ["OWNER","ADMIN","MANAGER","MEMBER","VIEWER"] },
      { id: "gobierno",   label: "gobierno",   roles: ["OWNER","ADMIN"] },
      { id: "areas",      label: "areas",      roles: ["OWNER","ADMIN"] },
      { id: "teams",      label: "teams",      roles: ["OWNER","ADMIN","MANAGER"] },
      { id: "cycles",     label: "cycles",     roles: ["OWNER","ADMIN","MANAGER"] },
    ],
  },
  {
    heading: "people",
    items: [
      { id: "usuarios",       label: "usuarios",       roles: ["OWNER","ADMIN"] },
      { id: "permisos",       label: "permisos",       roles: ["OWNER","ADMIN"] },
      { id: "pantallas",      label: "pantallas",      roles: ["OWNER","ADMIN"] },
      { id: "parametros",     label: "parametros",     roles: ["OWNER","ADMIN"], trialHidden: true },
      { id: "notificaciones", label: "notificaciones", roles: ["OWNER","ADMIN"], trialHidden: true },
    ],
    roles: ["OWNER","ADMIN"],
  },
  {
    heading: "consulting",
    consultantOnly: true,
    items: [
      { id: "misclientes", label: "misclientes", consultantOnly: true },
    ],
  },
  {
    heading: "platform",
    platformAdminOnly: true,
    items: [
      { id: "plataformaOrgs", label: "plataformaOrgs", platformAdminOnly: true },
    ],
  },
  {
    heading: "account",
    items: [
      { id: "profile",  label: "profile" },
      { id: "security", label: "security" },
      { id: "privacy",  label: "privacy" },
    ],
  },
  {
    heading: "system",
    items: [
      { id: "empresas", label: "empresas", roles: ["OWNER"] },
      { id: "monitor",  label: "monitor",  roles: ["OWNER","ADMIN"] },
      { id: "demo",     label: "demo",     roles: ["OWNER"] },
      { id: "import",   label: "import",   roles: ["OWNER"] },
    ],
    roles: ["OWNER","ADMIN"],
    hiddenForTrial: true,
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function NavButton({ id, label, active, onClick }: {
  id: Tab; label: string; active: boolean; onClick: () => void;
}) {
  const cfg = NAV_ICON[id];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all",
        active
          ? "bg-primary/8 font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <span className={cn(
        "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
        cfg.bg,
        active ? "shadow-sm ring-1 ring-black/10" : "opacity-85"
      )}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </span>
      <span className="truncate">{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
    </button>
  );
}

function SettingsSidebar({
  tab, setTab, orgName, role, isTrial, notificationsEnabled, isConsultant, isPlatformAdmin,
}: {
  tab: Tab; setTab: (t: Tab) => void; orgName: string; role: string; isTrial: boolean; notificationsEnabled: boolean; isConsultant: boolean; isPlatformAdmin: boolean;
}) {
  const tNav = useTranslations("settings.nav");
  return (
    <nav className="w-60 shrink-0 flex flex-col gap-5">
      {/* Company card */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/8 to-primary/3 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
          {tNav("activeCompany")}
        </p>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shrink-0 select-none shadow-sm">
            {orgName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none truncate">{orgName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isTrial ? tNav("trialPeriod") : tNav("activeConfig")}
            </p>
          </div>
        </div>
      </div>

      {/* Groups */}
      {NAV.map((group) => {
        if (group.roles && !group.roles.includes(role)) return null;
        if (isTrial && group.hiddenForTrial) return null;
        if (group.consultantOnly && !isConsultant) return null;
        if (group.platformAdminOnly && !isPlatformAdmin) return null;
        const items = group.items.filter(i => {
          if (i.consultantOnly && !isConsultant) return false;
          if (i.platformAdminOnly && !isPlatformAdmin) return false;
          if (i.roles && !i.roles.includes(role)) return false;
          if (!i.trialHidden) return true;
          if (i.id === 'notificaciones') return notificationsEnabled;
          return !isTrial;
        });
        if (!items.length) return null;
        return (
          <div key={group.heading}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1.5">
              {tNav(`groups.${group.heading}`)}
            </p>
            <ul className="space-y-0.5">
              {items.map(item => (
                <li key={item.id}>
                  <NavButton
                    id={item.id}
                    label={tNav(`items.${item.id}`)}
                    active={tab === item.id}
                    onClick={() => setTab(item.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// ─── MFA Setup Panel ──────────────────────────────────────────────────────────

function MfaSetupPanel({ onDone }: { onDone: () => void }) {
  const setup = useSetupMfa();
  const enable = useEnableMfa();
  const [code, setCode] = useState("");
  const [qrData, setQrData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setup.mutateAsync().then(setQrData).catch(() => setError("Error al generar el código QR"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEnable() {
    setError("");
    try {
      await enable.mutateAsync(code);
      onDone();
    } catch {
      setError("Código inválido. Verifica tu app de autenticación.");
    }
  }

  if (!qrData) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escanea el código QR con tu app de autenticación (Google Authenticator, Authy, etc.)
      </p>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrData.qrCodeDataUrl} alt="QR MFA" className="h-40 w-40 border rounded-lg" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Código de verificación (6 dígitos)</label>
        <Input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          className="font-mono tracking-widest text-center"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleEnable} disabled={code.length !== 6 || enable.isPending} className="w-full">
        {enable.isPending ? "Verificando..." : "Activar MFA"}
      </Button>
    </div>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────────────────

function ResetPasswordDialog({ member, onClose }: { member: OrgMember | null; onClose: () => void }) {
  const reset = useResetMemberPassword();
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  useEffect(() => {
    if (member) {
      setNewPwd("");
      reset.mutateAsync(member.user_id).then(r => setNewPwd(r.newPassword)).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.user_id]);

  function handleCopy() {
    navigator.clipboard.writeText(newPwd);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={!!member} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Contraseña temporal generada</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Se generó una contraseña temporal para <strong>{member?.name}</strong>. Compártela de forma segura.
          </p>
          {reset.isPending ? <Skeleton className="h-10 w-full" /> : (
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm tracking-widest">
                {showPwd ? newPwd : "••••••••••••"}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowPwd(p => !p)}>
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={onClose}>Listo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invite Member Dialog ─────────────────────────────────────────────────────

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteMember();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [done, setDone] = useState(false);

  function handleSubmit() {
    invite.mutate({ email, role }, {
      onSuccess: () => { setDone(true); setEmail(""); setRole("MEMBER"); },
    });
  }

  function handleClose() { setDone(false); setEmail(""); setRole("MEMBER"); invite.reset(); onClose(); }

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invitar miembro</DialogTitle></DialogHeader>
        {done ? (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">Invitación enviada a <strong>{email}</strong></p>
            <p className="text-xs text-muted-foreground">El enlace expira en 7 días.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Correo electrónico</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                onKeyDown={e => e.key === "Enter" && email && handleSubmit()} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Perfil de acceso</label>
              <Select value={role} onChange={e => setRole(e.target.value)}>
                {ASSIGNABLE_ROLES.map(r => <SelectOption key={r.value} value={r.value}>{r.label}</SelectOption>)}
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "ADMIN"              && "Acceso completo a la organización."}
                {role === "MANAGER"            && "Vista estratégica: OKRs de empresa, área, reportes."}
                {role === "MEMBER"             && "Vista táctica: OKRs de equipo, check-ins, iniciativas."}
                {role === "VIEWER"             && "Solo lectura en las secciones habilitadas."}
                {role === "SECTOR_DIAGNOSTICS" && "Acceso exclusivo al diagnóstico sectorial. Solo puede valorar las 8 amenazas estructurales."}
              </p>
            </div>
            {invite.isError && <p className="text-sm text-destructive">{String((invite.error as any)?.data?.message ?? "Error al enviar invitación")}</p>}
          </div>
        )}
        <DialogFooter>
          {done ? <Button variant="outline" onClick={handleClose}>Cerrar</Button> : (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!email || invite.isPending} className="gap-1.5">
                <Send className="h-4 w-4" />
                {invite.isPending ? "Enviando..." : "Enviar invitación"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Avatar color (users tab) ─────────────────────────────────────────────────

const USER_AVATAR_COLORS = [
  "#6366f1","#3b82f6","#10b981","#f59e0b",
  "#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6",
];
function userAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (((h << 5) - h) + name.charCodeAt(i)) | 0;
  return USER_AVATAR_COLORS[Math.abs(h) % USER_AVATAR_COLORS.length];
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2)  return "Ahora";
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `Hace ${d}d`;
  if (d < 30) return `Hace ${Math.floor(d / 7)}sem`;
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short" });
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({ member, canManage, currentUserId, onResetPassword, onRemove }: {
  member: OrgMember; canManage: boolean; currentUserId: string;
  onResetPassword: (m: OrgMember) => void; onRemove: (m: OrgMember) => void;
}) {
  const updateRole    = useUpdateMemberRole();
  const sendReset     = useSendResetEmail();

  const isCurrentUser = member.user_id === currentUserId;
  const isOwner       = member.org_role === "OWNER";
  const bg            = userAvatarColor(member.name);
  const initials      = member.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  function handleSendEmail() {
    const tid = toast.loading(`Enviando enlace a ${member.email}...`);
    sendReset.mutate(member.user_id, {
      onSuccess: () => toast.success("Enlace enviado", {
        id: tid, description: `Se envió a ${member.email}`,
      }),
      onError: (err: unknown) => toast.error("No se pudo enviar", {
        id: tid,
        description: getApiErrorMessage(err, "Verificá la configuración de correo"),
      }),
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/30 transition-colors">
      {/* Avatar */}
      <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 select-none"
        style={{ backgroundColor: bg }}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none truncate">
          {member.name}
          {isCurrentUser && <span className="ml-1.5 text-xs text-muted-foreground font-normal">(tú)</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{member.email}</p>
      </div>

      {/* Role */}
      {canManage && !isOwner && !isCurrentUser ? (
        <Select value={member.org_role}
          onChange={e => updateRole.mutate({ userId: member.user_id, role: e.target.value })}
          className="w-32 text-xs h-7 py-0 shrink-0">
          {ASSIGNABLE_ROLES.map(r => <SelectOption key={r.value} value={r.value}>{r.label}</SelectOption>)}
        </Select>
      ) : (
        <Badge className={cn("text-xs shrink-0", ROLE_COLORS[member.org_role])}>
          {ROLE_LABELS[member.org_role] ?? member.org_role}
        </Badge>
      )}

      {/* Last login */}
      <span className="text-xs text-muted-foreground w-20 text-right shrink-0 hidden sm:block">
        {relativeTime(member.last_login_at)}
      </span>

      {/* Actions */}
      {canManage && !isOwner && !isCurrentUser ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted shrink-0 transition-opacity">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSendEmail} disabled={sendReset.isPending} className="gap-2">
              <Send className="h-4 w-4 text-blue-500" /> Enviar enlace por email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResetPassword(member)} className="gap-2">
              <KeyRound className="h-4 w-4" /> Contraseña temporal
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onRemove(member)} className="gap-2 text-destructive focus:text-destructive">
              <UserX className="h-4 w-4" /> Eliminar de la organización
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : <div className="w-7 shrink-0" />}
    </div>
  );
}

// ─── Mode feature matrix ─────────────────────────────────────────────────────

const MODE_FEATURES: Record<string, { enabled: string[]; disabled: string[] }> = {
  AGILE: {
    enabled:  ["OKRs empresa y equipo", "Sprints y backlog", "Check-ins", "Iniciativas", "Reportes"],
    disabled: [],
  },
  TRADITIONAL: {
    enabled:  ["OKRs empresa y equipo", "Check-ins", "Iniciativas", "Reportes"],
    disabled: ["Sprints y backlog"],
  },
  HYBRID: {
    enabled:  ["OKRs empresa y equipo", "Sprints y backlog", "Check-ins", "Iniciativas", "Reportes"],
    disabled: [],
  },
};

// ─── Tab: Configuración (solo ajustes de empresa) ────────────────────────────

function OrgTab() {
  const { user } = useAuth();
  const { data: org, isLoading } = useOrganization();
  const { mutate: updateOrg, isPending, isSuccess } = useUpdateOrganization();
  const [name, setName]       = useState("");
  const [mode, setMode]       = useState("AGILE");
  const [sector, setSector]   = useState("GENERIC");
  const [noDirty, setNoDirty] = useState(false);
  const [initializedOrgId, setInitializedOrgId] = useState<string | null>(null);
  const t = useTranslations("settings.org");

  useEffect(() => {
    if (org && (org.id as string) !== initializedOrgId) {
      setName((org.name as string) ?? "");
      setMode((org.mode as string) ?? "AGILE");
      setSector((org.sector as string) ?? "GENERIC");
      setInitializedOrgId(org.id as string);
    }
  }, [org, initializedOrgId]);

  const canEdit    = user?.role === "OWNER" || user?.role === "ADMIN";
  const savedName  = (org?.name as string) ?? "";
  const savedMode  = (org?.mode as string) ?? "AGILE";
  const savedSector = (org?.sector as string) ?? "GENERIC";
  const isDirty    = !!initializedOrgId && (name.trim() !== savedName || mode !== savedMode || sector !== savedSector);

  function handleSave() {
    if (!isDirty) { setNoDirty(true); setTimeout(() => setNoDirty(false), 3000); return; }
    updateOrg({ name: name.trim(), mode, sector });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="h-44 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Identity */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20">
          <h3 className="text-sm font-semibold">{t("sectionIdentity")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("sectionDesc")}</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0 select-none">
              {name[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <label className="text-sm font-medium">{t("nameLabel")}</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!canEdit}
                placeholder={t("namePlaceholder")}
              />
            </div>
          </div>

          {/* Slug — read-only with explanation */}
          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">{t("slugLabel")}</label>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                {t("slugImmutable")}
              </span>
            </div>
            <p className="font-mono text-base font-semibold">{org?.slug as string}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("slugInfo")}
            </p>
          </div>
        </div>
      </Card>

      {/* Mode */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20">
          <h3 className="text-sm font-semibold">{t("modeLabel")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("modeDesc")}
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODES.map(m => {
              const features = MODE_FEATURES[m.value];
              const isSelected = mode === m.value;
              return (
                <button
                  key={m.value}
                  disabled={!canEdit}
                  onClick={() => { setMode(m.value); setNoDirty(false); }}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/40",
                    !canEdit && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{m.label}</p>
                    {isSelected && (
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{m.desc}</p>
                  <ul className="space-y-1">
                    {features.enabled.map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                    {features.disabled.map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground line-through">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Mode change warning */}
          {isDirty && mode !== savedMode && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("modeWarning1")}
                {mode === "TRADITIONAL" && ` ${t("modeWarning2")}`}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Sector */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20">
          <h3 className="text-sm font-semibold">{t("sectorLabel")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("sectorDesc")}
          </p>
        </div>
        <div className="p-5">
          <Select value={sector} onChange={e => setSector(e.target.value)} disabled={!canEdit}>
            {SECTORS.map(s => <SelectOption key={s.value} value={s.value}>{s.label}</SelectOption>)}
          </Select>
        </div>
      </Card>

      {/* Save */}
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? t("saving") : t("saveBtn")}
          </Button>
          {isSuccess && !isDirty && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" /> {t("savedMsg")}
            </span>
          )}
          {noDirty && (
            <span className="text-sm text-muted-foreground">
              {t("noPendingMsg")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Usuarios (miembros + invitaciones) ──────────────────────────────────

function UsersTab() {
  const { user }  = useAuth();
  const { data: members, isLoading: membersLoading } = useOrgMembers();
  const { data: invitations } = useInvitations();
  const resendInv   = useResendInvitation();
  const removeMember = useRemoveMember();
  const t = useTranslations("settings.users");
  const [showInvite, setShowInvite]   = useState(false);
  const [resetTarget, setResetTarget] = useState<OrgMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);
  const [search, setSearch] = useState("");

  const canEdit = user?.role === "OWNER" || user?.role === "ADMIN";

  const filtered = members?.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
  );

  // Role counts for stats strip
  const roleCounts = members?.reduce<Record<string, number>>((acc, m) => {
    acc[m.org_role] = (acc[m.org_role] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      {!membersLoading && members && members.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: t("statTotal"),   value: members.length,             color: "bg-primary/10 text-primary" },
            { label: t("statAdmins"),  value: (roleCounts.ADMIN ?? 0) + (roleCounts.OWNER ?? 0), color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" },
            { label: t("statStrategy"),value: roleCounts.MANAGER ?? 0,    color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30" },
            { label: t("statPending"), value: invitations?.length ?? 0,   color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border bg-card px-3 py-3 text-center">
              <p className={cn("text-xl font-bold leading-none inline-flex h-9 w-9 items-center justify-center rounded-full mx-auto", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">{label}</p>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b gap-3">
          <div className="relative flex-1 max-w-xs">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-9 pr-3 h-8 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {canEdit && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-3.5 w-3.5" /> {t("inviteBtn")}
            </Button>
          )}
        </div>

        {/* Column headers */}
        <div className="hidden sm:grid px-4 py-2 bg-muted/30 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: "2.25rem 1fr 8rem 5rem 1.75rem" }}>
          <div />
          <div>{t("colPerson")}</div>
          <div>{t("colProfile")}</div>
          <div className="text-right">{t("colLastAccess")}</div>
          <div />
        </div>

        {/* Members */}
        <div className="divide-y">
          {membersLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              </div>
            ))
          ) : filtered?.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search ? t("noResults", { search }) : t("noMembers")}
            </div>
          ) : (
            filtered?.map(m => (
              <MemberRow key={m.user_id} member={m} canManage={canEdit}
                currentUserId={user?.user_id ?? ""}
                onResetPassword={setResetTarget} onRemove={setRemoveTarget} />
            ))
          )}
        </div>
      </Card>

      {/* Pending invitations */}
      {canEdit && invitations && invitations.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center">
                <Send className="h-3 w-3 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold">{t("pendingInvites")}</h3>
              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                {invitations.length}
              </span>
            </div>
          </div>
          <div className="divide-y">
            {invitations.map(inv => {
              const daysLeft = Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / 86400000);
              return (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={cn("text-[10px] h-4 px-1.5", ROLE_COLORS[inv.role])}>
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {daysLeft > 0 ? t("expiresIn", { daysLeft }) : t("expired")}
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs gap-1.5 shrink-0"
                    disabled={resendInv.isPending}
                    onClick={() => {
                      const tid = toast.loading(t("resending"));
                      resendInv.mutate(inv.id, {
                        onSuccess: () => toast.success(t("resent"), { id: tid, description: inv.email }),
                        onError: () => toast.error(t("resendError"), { id: tid, description: t("resendErrorDesc") }),
                      });
                    }}>
                    <Send className="h-3 w-3" /> {t("resendBtn")}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} />
      <ResetPasswordDialog member={resetTarget} onClose={() => setResetTarget(null)} />

      <Dialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("removeFromOrg")}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            {removeTarget && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: userAvatarColor(removeTarget.name) }}>
                  {removeTarget.name.split(" ").map((w:string) => w[0]).slice(0,2).join("").toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{removeTarget.name}</p>
                  <p className="text-xs text-muted-foreground">{removeTarget.email}</p>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t("removeConfirmDesc")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>{t("cancelBtn")}</Button>
            <Button variant="destructive" disabled={removeMember.isPending}
              onClick={() => removeMember.mutate(removeTarget!.user_id, { onSuccess: () => setRemoveTarget(null) })}>
              {removeMember.isPending ? t("removeBtn") : t("removeConfirmBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Permission profiles ──────────────────────────────────────────────────────

const PERMISSION_PROFILES: Array<{
  id: string;
  label: string;
  desc: string;
  color: string;
  dotColor: string;
  config: Record<string, boolean>;
}> = [
  {
    id: "CONSULTOR",
    label: "Consultor",
    desc: "Acceso completo + herramientas de consultoría y portafolio",
    color: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
    dotColor: "bg-indigo-500",
    config: {
      welcome: true,  "my-okrs": false,  portfolio: true,
      "sector-assessment": true,  problems: true,
      agreements: true,  strategy: true,  program: true,  strategic: true,  traceability: true,
      tactical: true,  checkins: true,  initiatives: true,  delivery: true,  backlog: true,  sprints: false,
      reports: true,  "cycle-close": true,  governance: true,  consejo: true,
      "demo-setup": true,  "consultant-roadmap": true,  "ai-assistant": true,  "getting-started": true,  docs: true,
    },
  },
  {
    id: "DIRECTOR",
    label: "Director Estratégico",
    desc: "Estrategia, OKRs de empresa y reportes ejecutivos",
    color: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    dotColor: "bg-blue-500",
    config: {
      welcome: true,  "my-okrs": true,  portfolio: false,
      "sector-assessment": true,  problems: true,
      agreements: true,  strategy: true,  program: true,  strategic: true,  traceability: true,
      tactical: false,  checkins: true,  initiatives: false,  delivery: false,  backlog: false,  sprints: false,
      reports: true,  "cycle-close": true,  governance: true,  consejo: true,
      "demo-setup": false,  "consultant-roadmap": false,  "ai-assistant": true,  "getting-started": true,  docs: true,
    },
  },
  {
    id: "EJECUTOR",
    label: "Ejecutor",
    desc: "OKRs de equipo, check-ins e iniciativas del día a día",
    color: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
    dotColor: "bg-violet-500",
    config: {
      welcome: true,  "my-okrs": true,  portfolio: false,
      "sector-assessment": false,  problems: false,
      agreements: false,  strategy: false,  program: false,  strategic: false,  traceability: false,
      tactical: true,  checkins: true,  initiatives: true,  delivery: true,  backlog: true,  sprints: true,
      reports: false,  "cycle-close": false,  governance: false,  consejo: false,
      "demo-setup": false,  "consultant-roadmap": false,  "ai-assistant": false,  "getting-started": true,  docs: true,
    },
  },
  {
    id: "OBSERVADOR",
    label: "Observador",
    desc: "Solo lectura — ve estrategia y reportes, sin edición",
    color: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    dotColor: "bg-amber-500",
    config: {
      welcome: true,  "my-okrs": true,  portfolio: false,
      "sector-assessment": true,  problems: false,
      agreements: false,  strategy: true,  program: false,  strategic: true,  traceability: true,
      tactical: false,  checkins: false,  initiatives: false,  delivery: true,  backlog: false,  sprints: false,
      reports: true,  "cycle-close": false,  governance: true,  consejo: true,
      "demo-setup": false,  "consultant-roadmap": false,  "ai-assistant": false,  "getting-started": false,  docs: true,
    },
  },
  {
    id: "SECTORIAL",
    label: "Especialista Sectorial",
    desc: "Acceso exclusivo al diagnóstico del sector",
    color: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
    dotColor: "bg-rose-500",
    config: {
      welcome: false,  "my-okrs": false,  portfolio: false,
      "sector-assessment": true,  problems: false,
      agreements: false,  strategy: false,  program: false,  strategic: false,  traceability: false,
      tactical: false,  checkins: false,  initiatives: false,  delivery: false,  backlog: false,  sprints: false,
      reports: false,  "cycle-close": false,  governance: false,  consejo: false,
      "demo-setup": false,  "consultant-roadmap": false,  "ai-assistant": false,  "getting-started": false,  docs: false,
    },
  },
];

// ─── Tab: Permisos ────────────────────────────────────────────────────────────

const PERM_ROLES = [
  { role: "ADMIN",              label: "Administrador",       shortLabel: "Admin" },
  { role: "MANAGER",            label: "Director estratégico", shortLabel: "Director" },
  { role: "MEMBER",             label: "Ejecutor",            shortLabel: "Ejecutor" },
  { role: "SECTOR_DIAGNOSTICS", label: "Esp. Sectorial",      shortLabel: "Sectorial" },
];

function PermissionsTab() {
  const { data: org, isLoading } = useOrganization();
  const { mutate: updateOrg, isPending, isSuccess } = useUpdateOrganization();
  const t = useTranslations("settings.permissions");

  const currentConfig = (org?.settings as Record<string, unknown> | null)?.role_menu_config as Record<string, Record<string, boolean>> | undefined;
  const [config, setConfig] = useState<Record<string, Record<string, boolean>>>({});
  const [initializedOrgId, setInitializedOrgId] = useState<string | null>(null);
  const [appliedProfile, setAppliedProfile] = useState<Record<string, string>>({});

  useEffect(() => {
    if (org && (org.id as string) !== initializedOrgId) {
      setConfig({
        ADMIN:              { ...DEFAULT_MENU_CONFIG.ADMIN,              ...(currentConfig?.ADMIN ?? {}) },
        MANAGER:            { ...DEFAULT_MENU_CONFIG.MANAGER,            ...(currentConfig?.MANAGER ?? {}) },
        MEMBER:             { ...DEFAULT_MENU_CONFIG.MEMBER,             ...(currentConfig?.MEMBER ?? {}) },
        SECTOR_DIAGNOSTICS: { ...DEFAULT_MENU_CONFIG.SECTOR_DIAGNOSTICS, ...(currentConfig?.SECTOR_DIAGNOSTICS ?? {}) },
      });
      setInitializedOrgId(org.id as string);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function toggle(role: string, key: string) {
    setConfig(prev => ({ ...prev, [role]: { ...prev[role], [key]: !prev[role]?.[key] } }));
    setAppliedProfile(prev => { const n = { ...prev }; delete n[role]; return n; });
  }

  function toggleGroup(role: string, group: string, value: boolean) {
    const keys = MENU_ITEMS.filter(i => i.group === group).map(i => i.key);
    setConfig(prev => ({
      ...prev,
      [role]: { ...prev[role], ...Object.fromEntries(keys.map(k => [k, value])) },
    }));
    setAppliedProfile(prev => { const n = { ...prev }; delete n[role]; return n; });
  }

  function applyProfile(profileId: string, role: string) {
    const profile = PERMISSION_PROFILES.find(p => p.id === profileId);
    if (!profile) return;
    setConfig(prev => ({ ...prev, [role]: { ...profile.config } }));
    setAppliedProfile(prev => ({ ...prev, [role]: profileId }));
  }

  function handleSave() {
    const currentSettings = ((org?.settings as Record<string, unknown>) ?? {});
    updateOrg({ settings: { ...currentSettings, role_menu_config: config } });
  }

  const groups = Array.from(new Set(MENU_ITEMS.map(i => i.group)));

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      {/* Info */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">{t("title")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("desc")}
            </p>
          </div>
        </div>
      </Card>

      {/* Plantillas de persona */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
          {t("templatesLabel")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PERMISSION_PROFILES.map(profile => {
            const enabledCount = Object.values(profile.config).filter(Boolean).length;
            return (
              <div
                key={profile.id}
                className={cn("relative rounded-xl border p-3.5 transition-all", profile.color)}
              >
                <div className="flex items-start gap-2.5 mb-2.5">
                  <span className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", profile.dotColor)} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-none">{profile.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{profile.desc}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{t("sectionsEnabled", { enabledCount })}</p>
                  </div>
                </div>

                {/* Apply buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {PERM_ROLES.map(({ role, shortLabel }) => {
                    const isApplied = appliedProfile[role] === profile.id;
                    return (
                      <button
                        key={role}
                        onClick={() => applyProfile(profile.id, role)}
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all",
                          isApplied
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background/70 hover:bg-background border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground"
                        )}
                        title={t("applyTitle", { profile: profile.label, label: shortLabel })}
                      >
                        {isApplied ? "✓ " : ""}{shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Matrix */}
      <Card className="overflow-hidden">
        {/* Header row */}
        <div className="grid border-b bg-muted/30 sticky top-0 z-10" style={{ gridTemplateColumns: "1fr repeat(4, minmax(100px, 130px))" }}>
          <div className="px-4 py-3 text-xs font-semibold text-muted-foreground">{t("colSection")}</div>
          {PERM_ROLES.map(({ role, label }) => {
            const applied = appliedProfile[role];
            const profile = PERMISSION_PROFILES.find(p => p.id === applied);
            return (
              <div key={role} className="px-2 py-3 text-center space-y-1">
                <Badge className={cn("text-[10px] px-1.5", ROLE_COLORS[role])}>{label}</Badge>
                {profile && (
                  <p className={cn("text-[9px] font-semibold truncate", profile.dotColor.replace("bg-", "text-"))}>
                    {profile.label}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {groups.map(group => {
          const groupItems = MENU_ITEMS.filter(i => i.group === group);
          return (
            <div key={group}>
              {/* Group header with per-role bulk toggle */}
              <div className="grid items-center bg-muted/20 border-b" style={{ gridTemplateColumns: "1fr repeat(4, minmax(100px, 130px))" }}>
                <div className="px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</span>
                </div>
                {PERM_ROLES.map(({ role }) => {
                  const allOn = groupItems.every(i => config[role]?.[i.key]);
                  const allOff = groupItems.every(i => !config[role]?.[i.key]);
                  return (
                    <div key={role} className="flex justify-center py-1.5">
                      <button
                        onClick={() => toggleGroup(role, group, !allOn)}
                        title={allOn ? `Desactivar todo "${group}" para ${role}` : `Activar todo "${group}" para ${role}`}
                        className={cn(
                          "text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-colors",
                          allOn  ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" :
                          allOff ? "bg-muted text-muted-foreground border-border hover:bg-muted/60" :
                                   "bg-primary/5 text-primary/70 border-primary/10 hover:bg-primary/10"
                        )}
                      >
                        {allOn ? t("allOn") : allOff ? t("allOff") : t("partial")}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Items */}
              {groupItems.map(item => (
                <div
                  key={item.key}
                  className="grid items-center border-b last:border-0 hover:bg-muted/10 transition-colors"
                  style={{ gridTemplateColumns: "1fr repeat(4, minmax(100px, 130px))" }}
                >
                  <div className="px-4 py-2.5 text-sm text-foreground/80">{item.label}</div>
                  {PERM_ROLES.map(({ role }) => (
                    <div key={role} className="flex justify-center py-2.5">
                      <button
                        onClick={() => toggle(role, item.key)}
                        className={cn(
                          "h-5 w-9 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          config[role]?.[item.key] ? "bg-primary" : "bg-muted-foreground/25"
                        )}
                        role="switch"
                        aria-checked={!!config[role]?.[item.key]}
                      >
                        <span className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          config[role]?.[item.key] ? "left-[calc(100%-1.125rem)]" : "left-0.5"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending || !initializedOrgId}>
          {isPending ? t("saving") : t("saveBtn")}
        </Button>
        {isSuccess && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> {t("savedMsg")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Pantallas ───────────────────────────────────────────────────────────

const SCREEN_SECTIONS = [
  {
    groupKey: null,
    groupDefault: null,
    sectionLabel: "Inicio",
    items: [
      { key: "welcome",   defaultLabel: "Inicio" },
      { key: "my-okrs",   defaultLabel: "Mis OKRs" },
      { key: "portfolio", defaultLabel: "Portafolio de clientes" },
    ],
  },
  {
    groupKey: "group_diagnostico",
    groupDefault: "Diagnóstico",
    sectionLabel: "Diagnóstico",
    items: [
      { key: "sector-assessment", defaultLabel: "Diagnóstico Sectorial" },
      { key: "problems",          defaultLabel: "Problemas detectados" },
    ],
  },
  {
    groupKey: "group_strategy",
    groupDefault: "Estrategia",
    sectionLabel: "Estrategia",
    items: [
      { key: "agreements",  defaultLabel: "Acuerdos y compromisos" },
      { key: "strategy",    defaultLabel: "Dirección estratégica" },
      { key: "program",     defaultLabel: "Programa / Hoja de ruta" },
      { key: "strategic",   defaultLabel: "OKRs de empresa" },
      { key: "traceability",defaultLabel: "Trazabilidad" },
    ],
  },
  {
    groupKey: "group_execution",
    groupDefault: "Ejecución",
    sectionLabel: "Ejecución",
    items: [
      { key: "tactical",    defaultLabel: "OKRs de equipo" },
      { key: "checkins",    defaultLabel: "Check-ins" },
      { key: "initiatives", defaultLabel: "Iniciativas" },
      { key: "delivery",    defaultLabel: "Entregables" },
      { key: "backlog",     defaultLabel: "Backlog" },
      { key: "sprints",     defaultLabel: "Sprints" },
    ],
  },
  {
    groupKey: "group_analysis",
    groupDefault: "Análisis",
    sectionLabel: "Análisis",
    items: [
      { key: "reports",     defaultLabel: "Reportes" },
      { key: "cycle-close", defaultLabel: "Cierre de ciclo" },
      { key: "governance",  defaultLabel: "Gobierno OKR" },
      { key: "consejo",     defaultLabel: "Paquete Consejo" },
    ],
  },
  {
    groupKey: "group_consultor",
    groupDefault: "Consultoría",
    sectionLabel: "Consultoría / Aprende",
    items: [
      { key: "demo-setup",         defaultLabel: "Demo Express" },
      { key: "consultant-roadmap", defaultLabel: "Ruta de implementación" },
      { key: "ai-assistant",       defaultLabel: "IA Asistente" },
      { key: "getting-started",    defaultLabel: "Primeros pasos" },
      { key: "docs",               defaultLabel: "Documentación" },
    ],
  },
];

function ScreenLabelsTab() {
  const { data: org, isLoading } = useOrganization();
  const { mutate: updateOrg, isPending, isSuccess } = useUpdateOrganization();
  const t = useTranslations("settings.screens");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [initializedOrgId, setInitializedOrgId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (org && (org.id as string) !== initializedOrgId) {
      setLabels(((org.settings as Record<string, unknown>)?.menu_labels as Record<string, string>) ?? {});
      setInitializedOrgId(org.id as string);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  // Keys habilitadas para al menos un rol según la config efectiva de la org
  const roleMenuConfig = (org?.settings as Record<string, unknown> | null)
    ?.role_menu_config as Record<string, Record<string, boolean>> | undefined;
  const effectiveConfig = {
    ADMIN:              { ...DEFAULT_MENU_CONFIG.ADMIN,              ...(roleMenuConfig?.ADMIN ?? {}) },
    MANAGER:            { ...DEFAULT_MENU_CONFIG.MANAGER,            ...(roleMenuConfig?.MANAGER ?? {}) },
    MEMBER:             { ...DEFAULT_MENU_CONFIG.MEMBER,             ...(roleMenuConfig?.MEMBER ?? {}) },
    SECTOR_DIAGNOSTICS: { ...DEFAULT_MENU_CONFIG.SECTOR_DIAGNOSTICS, ...(roleMenuConfig?.SECTOR_DIAGNOSTICS ?? {}) },
  };
  const enabledKeys = new Set<string>(
    Object.values(effectiveConfig).flatMap(cfg =>
      Object.entries(cfg).filter(([, on]) => on).map(([k]) => k)
    )
  );
  const visibleSections = SCREEN_SECTIONS
    .map(s => ({ ...s, items: s.items.filter(i => enabledKeys.has(i.key)) }))
    .filter(s => s.items.length > 0);

  function toggleSection(label: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function handleChange(key: string, value: string) {
    setLabels(prev => ({ ...prev, [key]: value }));
  }

  function handleResetKey(key: string) {
    setLabels(prev => { const next = { ...prev }; delete next[key]; return next; });
  }

  function handleResetAll() {
    setLabels({});
  }

  function handleSave() {
    const currentSettings = ((org?.settings as Record<string, unknown>) ?? {});
    updateOrg({ settings: { ...currentSettings, menu_labels: labels } });
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <MonitorSmartphone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">{t("title")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("desc")}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {visibleSections.map(section => {
          const isOpen = openSections.has(section.sectionLabel);
          const customCount = [
            ...(section.groupKey && labels[section.groupKey] ? [1] : []),
            ...section.items.filter(i => labels[i.key]),
          ].length;

          return (
            <Card key={section.sectionLabel} className="overflow-hidden">
              {/* Collapsible header */}
              <button
                onClick={() => toggleSection(section.sectionLabel)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors text-left"
                aria-expanded={isOpen}
              >
                <ChevronDown className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  !isOpen && "-rotate-90"
                )} />
                <span className="text-sm font-semibold flex-1">{section.sectionLabel}</span>
                <span className="text-xs text-muted-foreground">
                  {section.items.length} {section.items.length === 1 ? t("screen") : t("screens")}
                  {section.groupKey && ` ${t("plusHeader")}`}
                </span>
                {customCount > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
                    {customCount}
                  </span>
                )}
              </button>

              {/* Expandable content */}
              {isOpen && (
                <div className="border-t">
                  {/* Group label rename (only for collapsible groups) */}
                  {section.groupKey && (
                    <div className="flex items-center gap-3 px-5 py-3 bg-muted/20 border-b">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0">
                        {t("headerLabel")}
                      </span>
                      <Input
                        value={labels[section.groupKey] ?? ""}
                        onChange={e => handleChange(section.groupKey!, e.target.value)}
                        placeholder={section.groupDefault!}
                        className="h-8 text-xs font-semibold max-w-xs"
                      />
                      {labels[section.groupKey] && (
                        <button
                          onClick={() => handleResetKey(section.groupKey!)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={t("restoreTitle")}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {t("originalLabel", { value: section.groupDefault })}
                      </span>
                    </div>
                  )}

                  {/* Items */}
                  {section.items.map((item, idx) => (
                    <div
                      key={item.key}
                      className={cn(
                        "grid items-center px-5 py-3 gap-4",
                        idx < section.items.length - 1 && "border-b",
                        "hover:bg-muted/10 transition-colors"
                      )}
                      style={{ gridTemplateColumns: "160px 1fr auto auto" }}
                    >
                      <span className="text-sm text-muted-foreground truncate">{item.defaultLabel}</span>
                      <Input
                        value={labels[item.key] ?? ""}
                        onChange={e => handleChange(item.key, e.target.value)}
                        placeholder={item.defaultLabel}
                        className="h-8 text-sm max-w-sm"
                      />
                      {labels[item.key] ? (
                        <button
                          onClick={() => handleResetKey(item.key)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={t("restoreTitle")}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {labels[item.key] && (
                        <span className="text-xs text-primary font-medium whitespace-nowrap">
                          → {labels[item.key]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending || !initializedOrgId}>
          {isPending ? t("saving") : t("saveBtn")}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleResetAll} className="gap-1.5 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          {t("restoreAll")}
        </Button>
        {isSuccess && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> {t("savedMsg")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Perfil ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading } = useUserProfile();
  const update = useUpdateProfile();
  const router = useRouter();
  const t = useTranslations("settings.profile");
  const tLang = useTranslations("languages");
  const [form, setForm] = useState({ timezone: "America/Bogota", locale: "es",
    notify_at_risk: true, notify_checkin_reminder: true, notify_weekly_briefing: true });

  useEffect(() => { if (profile) setForm({ ...form, ...profile }); }, [profile]); // eslint-disable-line

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  async function handleSave() {
    await update.mutateAsync(form);
    document.cookie = `NEXT_LOCALE=${form.locale}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <Card className="p-6 space-y-5">
      <h2 className="text-base font-semibold">{t("title")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("timezone")}</label>
          <Select value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
            {TIMEZONES.map(tz => <SelectOption key={tz} value={tz}>{tz}</SelectOption>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("language")}</label>
          <Select value={form.locale} onChange={e => setForm(p => ({ ...p, locale: e.target.value }))}>
            <SelectOption value="es">{tLang("es")}</SelectOption>
            <SelectOption value="en">{tLang("en")}</SelectOption>
          </Select>
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t("notifications")}</h3>
        {[
          { key: "notify_at_risk" as const,          label: t("atRisk"),          desc: t("atRiskDesc") },
          { key: "notify_checkin_reminder" as const, label: t("checkinReminder"), desc: t("checkinReminderDesc") },
          { key: "notify_weekly_briefing" as const,  label: t("weeklyBriefing"),  desc: t("weeklyBriefingDesc") },
        ].map(({ key, label, desc }) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </label>
        ))}
      </div>
      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? t("saving") : t("save")}
      </Button>
      {update.isSuccess && <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {t("saved")}</p>}
    </Card>
  );
}

// ─── Tab: Seguridad ───────────────────────────────────────────────────────────

function SecurityTab() {
  const { data: mfa, isLoading } = useMfaStatus();
  const disable = useDisableMfa();
  const logoutAll = useLogoutAll();
  const t = useTranslations("settings.security");
  const [showSetup, setShowSetup] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [disableError, setDisableError] = useState("");

  async function handleDisable() {
    setDisableError("");
    try {
      await disable.mutateAsync(disableCode);
      setShowDisable(false);
      setDisableCode("");
    } catch {
      setDisableError(t("mfaInvalidCode"));
    }
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold">{t("mfaTitle")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mfa?.enabled
                  ? t("mfaActivatedOn", { date: mfa.verified_at ? new Date(mfa.verified_at).toLocaleDateString() : "—" })
                  : t("mfaSubtitle")}
              </p>
            </div>
          </div>
          {mfa?.enabled
            ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">{t("mfaActive")}</Badge>
            : <Badge variant="secondary" className="text-xs">{t("mfaInactive")}</Badge>}
        </div>
        {!mfa?.enabled && !showSetup && (
          <Button size="sm" variant="outline" onClick={() => setShowSetup(true)}>
            <Lock className="h-4 w-4 mr-1.5" /> {t("enableMfa")}
          </Button>
        )}
        {showSetup && !mfa?.enabled && <MfaSetupPanel onDone={() => setShowSetup(false)} />}
        {mfa?.enabled && !showDisable && (
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
            onClick={() => setShowDisable(true)}>
            {t("disableMfa")}
          </Button>
        )}
        {showDisable && mfa?.enabled && (
          <div className="space-y-3 border rounded-lg p-4 bg-destructive/5">
            <p className="text-sm text-muted-foreground">{t("mfaCodePrompt")}</p>
            <Input value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("mfaCodePlaceholder")} maxLength={6} className="font-mono tracking-widest text-center w-32" />
            {disableError && <p className="text-sm text-destructive">{disableError}</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleDisable}
                disabled={disableCode.length !== 6 || disable.isPending}>
                {disable.isPending ? "..." : t("confirmBtn")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowDisable(false); setDisableCode(""); }}>
                {t("cancelBtn")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-start gap-3">
          <LogOut className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold">{t("revokeSessionsTitle")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("revokeSessionsDesc")}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
          onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending}>
          {logoutAll.isPending ? t("signingOut") : t("revokeSessionsTitle")}
        </Button>
      </Card>
    </div>
  );
}

// ─── Tab: Privacidad ──────────────────────────────────────────────────────────

function PrivacyTab() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const t = useTranslations("settings.privacy");
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010/api/v1";

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`${apiBase}/me/account`, { method: "DELETE", credentials: "include" });
      window.location.href = "/auth/login";
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold">{t("exportTitle")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("exportDesc")}
            </p>
          </div>
        </div>
        <a href={`${apiBase}/me/export-data`} download
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors">
          <Download className="h-4 w-4" /> {t("exportBtn")}
        </a>
      </Card>

      <Card className="p-6 space-y-4 border-destructive/30">
        <div className="flex items-start gap-3">
          <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-destructive">{t("deleteTitle")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("deleteDesc")}
            </p>
          </div>
        </div>
        {!confirmDelete ? (
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
            onClick={() => setConfirmDelete(true)}>
            {t("deleteBtn")}
          </Button>
        ) : (
          <div className="space-y-3 border border-destructive/30 rounded-lg p-4 bg-destructive/5">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{t("deleteWarning")}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? t("deleting") : t("deleteConfirmTitle")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>{t("cancelBtn")}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TAB_TITLES: Partial<Record<Tab, string>> = {
  org:        "Configuración de empresa",
  areas:      "Áreas",
  gobierno:   "Órganos de gobierno",
  teams:      "Equipos",
  usuarios:   "Usuarios",
  permisos:   "Permisos de menú",
  pantallas:  "Configuración de pantallas",
  parametros: "Parámetros del sistema",
  empresas:   "Mis empresas",
  profile:    "Perfil y preferencias",
  security:   "Seguridad",
  privacy:    "Privacidad",
  monitor:    "Monitoreo del sistema",
  demo:       "Cargar datos demo",
  misclientes:    "Mis Clientes",
  plataformaOrgs: "Organizaciones de la plataforma",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: orgParams } = useOrgParameters();
  const { data: myOrgs = [] } = useMyOrgs();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) ?? "org";
  const [tab, setTab] = useState<Tab>(initialTab);

  const orgName       = user?.org_name ?? "Empresa";
  const role          = user?.role ?? "MEMBER";
  const isTrial       = !!(user?.org_trial_expires_at && new Date(user.org_trial_expires_at) > new Date());
  const isConsultant  = myOrgs.length > 1;
  const isPlatformAdmin = user?.is_platform_admin === true;
  // Notifications tab: visible for consultants always, or when not trial, or when consultant enabled it for this org
  const notificationsEnabled = isConsultant || !isTrial || !!(orgParams?.raw?.notifications_feature_enabled);

  return (
    <div className="flex gap-8 p-6 max-w-5xl items-start">
      {/* Sidebar */}
      <SettingsSidebar tab={tab} setTab={setTab} orgName={orgName} role={role} isTrial={isTrial} notificationsEnabled={notificationsEnabled} isConsultant={isConsultant} isPlatformAdmin={isPlatformAdmin} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b">
          {NAV_ICON[tab] && (() => {
            const cfg = NAV_ICON[tab];
            const Icon = cfg.icon;
            return (
              <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm", cfg.bg)}>
                <Icon className="h-4 w-4 text-white" />
              </span>
            );
          })()}
          <h2 className="text-base font-semibold">{TAB_TITLES[tab]}</h2>
        </div>

        {tab === "org"        && <OrgTab />}
        {tab === "areas"      && <AreasPanel />}
        {tab === "gobierno"   && <GovernancePanel />}
        {tab === "teams"      && <TeamsSettingsPanel />}
        {tab === "usuarios"   && <UsersTab />}
        {tab === "permisos"   && <PermissionsTab />}
        {tab === "pantallas"  && <ScreenLabelsTab />}
        {tab === "parametros"     && <ParametersPanel />}
        {tab === "misclientes"    && <ConsultantNotificationsSection />}
        {tab === "notificaciones" && <NotificationsPanel />}
        {tab === "empresas"   && <EmpresasTab />}
        {tab === "profile"    && <ProfileTab />}
        {tab === "security"   && <SecurityTab />}
        {tab === "privacy"    && <PrivacyTab />}
        {tab === "cycles"     && <CyclesContent compact />}
        {tab === "monitor"    && <MonitorTab />}
        {tab === "demo"       && <DemoTab />}
        {tab === "import"         && <ImportTab />}
        {tab === "plataformaOrgs" && <PlatformOrgsPanel />}
      </div>
    </div>
  );
}
