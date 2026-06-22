"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Target, BarChart3, Zap,
  ChevronLeft, ChevronRight, ChevronDown, Bot,
  AlertTriangle, Compass, CheckSquare, Rocket, LayoutGrid, Network, Layers,
  ChevronsUpDown, Check, Loader2, LayoutDashboard, Package2, GraduationCap, BookOpen,
  Stethoscope, Briefcase, Map, Handshake, Route, MonitorPlay, User, BellRing, Shield, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrgs } from "@/hooks/useAdmin";
import { useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItemDef = {
  key: string;
  href: string;
  icon: React.ElementType;
  tKey: string;
  group: string;
  desc: string;
  consultantOnly?: boolean;
  clientOnly?: boolean;
  /** Override group when persona is CONSULTANT */
  consultantGroup?: string;
  /** Pathname used for active detection when href has query params */
  activePathname?: string;
};

// ── Nav items ─────────────────────────────────────────────────────────────────
// group values: home | diagnostico | strategy | execution | analysis | consultor | learn

const NAV_ITEMS: NavItemDef[] = [
  // ── Inicio (always visible, no toggle) ────────────────────────────────────
  { key: "welcome",            href: "/welcome",             icon: LayoutDashboard,   tKey: "home",             group: "home",       desc: "Vista general y estado del sistema" },
  { key: "traceability",       href: "/traceability",        icon: Network,           tKey: "traceability",     group: "home",       desc: "Mapa completo de estrategia a ejecución" },
  { key: "my-okrs",            href: "/my-okrs",             icon: User,              tKey: "myOkrs",           group: "home",       clientOnly: true,  desc: "Mis KRs y por qué importa cada uno" },
  { key: "portfolio",          href: "/portfolio",           icon: Briefcase,         tKey: "portfolio",        group: "home",       consultantOnly: true, desc: "Vista consolidada de todas tus empresas clientes" },

  // ── Diagnóstico ───────────────────────────────────────────────────────────
  { key: "sector-assessment",  href: "/sector-assessment",   icon: Stethoscope,       tKey: "sectorAssessment", group: "diagnostico", desc: "Evaluación de amenazas estructurales del sector" },
  { key: "problems",           href: "/problems",            icon: AlertTriangle,     tKey: "problems",         group: "diagnostico", desc: "Brechas y problemas organizacionales identificados" },

  // ── Estrategia ────────────────────────────────────────────────────────────
  { key: "strategy",           href: "/strategy",            icon: Compass,           tKey: "strategy",         group: "strategy",   desc: "Visión, propósito y dirección de la organización" },
  { key: "strategic",          href: "/strategic",           icon: Target,            tKey: "okrs",             group: "strategy",   desc: "Objetivos y resultados clave del ciclo" },
  { key: "agreements",         href: "/agreements",          icon: Handshake,         tKey: "agreements",       group: "strategy",   desc: "Compromisos de junta, cliente o regulador" },
  { key: "program",            href: "/program",             icon: Map,               tKey: "program",          group: "strategy",   desc: "Programas de transformación y grandes iniciativas" },

  // ── Ejecución ─────────────────────────────────────────────────────────────
  { key: "tactical",           href: "/tactical",            icon: Zap,               tKey: "tacticalOkrs",     group: "execution",  desc: "Objetivos de equipo alineados a la estrategia" },
  { key: "checkins",           href: "/checkins",            icon: CheckSquare,       tKey: "checkins",         group: "execution",  desc: "Actualizaciones de progreso y confianza" },
  { key: "initiatives",        href: "/initiatives",         icon: Rocket,            tKey: "initiatives",      group: "execution",  desc: "Proyectos y acciones que impulsan los OKRs" },
  { key: "delivery",           href: "/delivery",            icon: Package2,          tKey: "delivery",         group: "execution",  desc: "Seguimiento de entregas por iniciativa" },
  { key: "backlog",            href: "/backlog",             icon: Layers,            tKey: "backlog",          group: "execution",  desc: "Lista priorizada de trabajo pendiente" },
  { key: "sprints",            href: "/sprints",             icon: LayoutGrid,        tKey: "sprints",          group: "execution",  desc: "Ciclos cortos de ejecución del equipo" },

  // ── Consejo ───────────────────────────────────────────────────────────────
  { key: "consejo",            href: "/consejo",             icon: Building2,         tKey: "consejo",          group: "consejo",    desc: "Gobierno del Consejo: Pulso OKR, No Negociables y Decisiones" },

  // ── Análisis ──────────────────────────────────────────────────────────────
  { key: "reports",            href: "/reports",             icon: BarChart3,         tKey: "reports",          group: "analysis",   desc: "Centro de reportes y análisis ejecutivos" },

  // ── Consultoría (solo consultor) ──────────────────────────────────────────
  { key: "consultant-digest",  href: "/settings?tab=misclientes",  activePathname: "/settings",  icon: BellRing, tKey: "consultantDigest", group: "consultor",  consultantOnly: true, desc: "Resumen y alertas de todas tus empresas cliente" },
  { key: "demo-setup",         href: "/demo-setup",          icon: MonitorPlay,       tKey: "demoSetup",        group: "consultor",  consultantOnly: true, desc: "Wizard express para mostrar la estrategia de un prospecto" },
  { key: "consultant-roadmap", href: "/consultant-roadmap",  icon: Route,             tKey: "consultantRoadmap",group: "consultor",  consultantOnly: true, desc: "Metodología de implementación OKR para consultores" },

  // ── Sistema ───────────────────────────────────────────────────────────────
  { key: "ai-assistant",       href: "/ai-assistant",        icon: Bot,               tKey: "aiAssistant",      group: "learn",      consultantGroup: "consultor", desc: "Agente de IA para análisis y recomendaciones" },
  { key: "getting-started",    href: "/getting-started",     icon: GraduationCap,     tKey: "gettingStarted",   group: "learn",      consultantGroup: "consultor", desc: "Pasos para configurar y usar el sistema" },
  { key: "docs",               href: "/docs",                icon: BookOpen,          tKey: "docs",             group: "learn",      consultantGroup: "consultor", desc: "Guías de referencia y metodología" },
];

// ── Group config ──────────────────────────────────────────────────────────────

const COLLAPSIBLE_GROUPS = ["diagnostico", "strategy", "execution", "consejo", "analysis", "consultor", "learn"] as const;
type CollapsibleGroup = typeof COLLAPSIBLE_GROUPS[number];

const GROUP_COLOR: Record<string, string> = {
  diagnostico: "text-rose-500",
  strategy:    "text-blue-500",
  execution:   "text-violet-500",
  consejo:     "text-purple-500",
  analysis:    "text-amber-500",
  consultor:   "text-indigo-500",
  learn:       "text-slate-400",
};

const GROUP_DOT: Record<string, string> = {
  diagnostico: "bg-rose-500",
  strategy:    "bg-blue-500",
  execution:   "bg-violet-500",
  consejo:     "bg-purple-500",
  analysis:    "bg-amber-500",
  consultor:   "bg-indigo-500",
  learn:       "bg-slate-400",
};

// ── Permission defaults ───────────────────────────────────────────────────────

const DEFAULT_MENU_CONFIG: Record<string, Record<string, boolean>> = {
  ADMIN: {
    welcome: true,  traceability: true,  "my-okrs": true,  "getting-started": true,  "demo-setup": true,  "consultant-roadmap": true,  "consultant-digest": true,  docs: true,
    "sector-assessment": true,  problems: true,  agreements: true,  strategy: true,  program: true,
    strategic: true,  tactical: true,  checkins: true,  initiatives: true,
    delivery: true,  backlog: true,  sprints: true,  reports: true,
    portfolio: true,  "ai-assistant": true,  consejo: true,
  },
  MANAGER: {
    welcome: true,  traceability: true,  "my-okrs": true,  "getting-started": true,  "demo-setup": false,  "consultant-roadmap": false,  "consultant-digest": false,  docs: true,
    "sector-assessment": true,  problems: true,  agreements: true,  strategy: true,  program: false,
    strategic: true,  tactical: false,  checkins: true,  initiatives: false,
    delivery: true,  backlog: true,  sprints: false,  reports: true,
    portfolio: false,  "ai-assistant": true,  consejo: false,
  },
  MEMBER: {
    welcome: true,  traceability: false,  "my-okrs": true,  "getting-started": true,  "demo-setup": false,  "consultant-roadmap": false,  "consultant-digest": false,  docs: true,
    "sector-assessment": false,  problems: false,  agreements: false,  strategy: false,  program: false,
    strategic: false,  tactical: true,  checkins: true,  initiatives: true,
    delivery: true,  backlog: true,  sprints: true,  reports: false,
    portfolio: false,  "ai-assistant": false,  consejo: false,
  },
  VIEWER: {
    welcome: true,  traceability: true,  "my-okrs": true,  "getting-started": false,  "demo-setup": false,  "consultant-roadmap": false,  "consultant-digest": false,  docs: true,
    "sector-assessment": true,  problems: false,  agreements: false,  strategy: false,  program: false,
    strategic: true,  tactical: false,  checkins: false,  initiatives: false,
    delivery: true,  backlog: true,  sprints: false,  reports: true,
    portfolio: false,  "ai-assistant": false,  consejo: false,
  },
  SECTOR_DIAGNOSTICS: {
    welcome: false,  traceability: false,  "my-okrs": false,  "getting-started": false,  "demo-setup": false,  "consultant-roadmap": false,  docs: false,
    "sector-assessment": true,  problems: false,  agreements: false,  strategy: false,  program: false,
    strategic: false,  tactical: false,  checkins: false,  initiatives: false,
    delivery: false,  backlog: false,  sprints: false,  reports: false,
    portfolio: false,  "ai-assistant": false,  consejo: false,
  },
};

// ── Plan config ───────────────────────────────────────────────────────────────

const PLAN_RANK: Record<string, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

// Modules available per plan — PRO includes everything FREE has
const PLAN_MODULES: Record<string, Set<string>> = {
  FREE: new Set([
    "welcome", "my-okrs", "strategic", "tactical", "checkins",
    "backlog", "sprints", "getting-started", "docs",
  ]),
  PRO: new Set([
    "welcome", "traceability", "my-okrs", "portfolio",
    "sector-assessment", "problems",
    "strategy", "strategic", "agreements", "program",
    "tactical", "checkins", "initiatives", "delivery", "backlog", "sprints",
    "reports", "ai-assistant", "consejo",
    "consultant-digest", "demo-setup", "consultant-roadmap",
    "getting-started", "docs",
  ]),
  ENTERPRISE: new Set(["*"]),
};

function effectivePlan(orgPlan: string, trialExpiresAt?: string | null): string {
  if (orgPlan !== "FREE") return orgPlan;
  if (trialExpiresAt && new Date(trialExpiresAt) > new Date()) return "PRO";
  return "FREE";
}

function isPlanVisible(key: string, orgPlan: string, trialExpiresAt?: string | null): boolean {
  const plan = effectivePlan(orgPlan, trialExpiresAt);
  const allowed = PLAN_MODULES[plan] ?? PLAN_MODULES.PRO;
  if (allowed.has("*")) return true;
  // Higher plans include lower plan modules
  if (PLAN_RANK[plan] >= PLAN_RANK.PRO) return PLAN_MODULES.PRO.has(key);
  return allowed.has(key);
}

// ── Visibility helpers ────────────────────────────────────────────────────────

function isRoleVisible(
  key: string,
  role: string,
  menuConfig: Record<string, Record<string, boolean>>,
  orgMode?: string,
): boolean {
  if (key === "sprints" && orgMode && orgMode !== "AGILE" && orgMode !== "HYBRID") return false;
  if (role === "OWNER") return true;
  if (role === "SECTOR_DIAGNOSTICS") return key === "sector-assessment";
  const roleConfig = menuConfig[role] ?? DEFAULT_MENU_CONFIG[role];
  if (!roleConfig) return true;
  return roleConfig[key] !== false;
}

function isPersonaVisible(item: NavItemDef, isConsultant: boolean): boolean {
  if (item.consultantOnly && !isConsultant) return false;
  if (item.clientOnly && isConsultant) return false;
  return true;
}

function effectiveGroup(item: NavItemDef, isConsultant: boolean): string {
  if (isConsultant && item.consultantGroup) return item.consultantGroup;
  return item.group;
}

function activeGroup(pathname: string, isConsultant: boolean): string {
  const match = [...NAV_ITEMS].slice().reverse().find(item => pathname.startsWith(item.activePathname ?? item.href));
  if (!match) return "home";
  return effectiveGroup(match, isConsultant);
}

// ── Org avatar color ──────────────────────────────────────────────────────────

const ORG_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500",
];
function orgColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ORG_COLORS[h % ORG_COLORS.length];
}

// ── OrgSwitcher ───────────────────────────────────────────────────────────────

function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const { data: orgs = [] } = useMyOrgs();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const tSidebar = useTranslations("sidebar");

  const currentOrg = user?.org_name ?? "Empresa";
  const initials = currentOrg.slice(0, 2).toUpperCase();

  async function switchOrg(orgId: string) {
    if (orgId === user?.organization_id || switching) return;
    setSwitching(orgId);
    try {
      await api.post<any>("/auth/switch-org", { org_id: orgId });
      await qc.invalidateQueries();
      router.refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, tSidebar("errorSwitchOrg")));
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? currentOrg : undefined}
      >
        <div className={cn(
          "h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-white text-xs font-bold",
          orgColor(currentOrg)
        )}>
          {initials}
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 text-left text-sm font-semibold truncate text-sidebar-foreground">
              {currentOrg}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && orgs.length > 1 && (
        <div className={cn(
          "absolute z-50 mt-1 rounded-lg border bg-popover shadow-lg py-1 min-w-[200px]",
          collapsed ? "left-12 top-0" : "left-0 right-0 top-full"
        )}>
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {tSidebar("switchOrg")}
          </p>
          {orgs.map((org: any) => {
            const isActive = org.id === user?.organization_id;
            const isLoading = switching === org.id;
            return (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                disabled={!!switching}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted",
                  isActive && "font-medium"
                )}
              >
                <div className={cn("h-5 w-5 shrink-0 rounded flex items-center justify-center text-white text-[10px] font-bold", orgColor(org.name))}>
                  {org.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 min-w-0 truncate text-left">{org.name}</span>
                {isLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  : isActive && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Persona badge ─────────────────────────────────────────────────────────────

function PersonaBadge({ isConsultant, collapsed }: { isConsultant: boolean; collapsed: boolean }) {
  const tSidebar = useTranslations("sidebar");
  if (collapsed) return null;
  return (
    <div className={cn(
      "mx-2 mb-1 flex items-center gap-1.5 rounded-md px-2 py-1",
      isConsultant
        ? "bg-indigo-50 dark:bg-indigo-950/30"
        : "bg-emerald-50 dark:bg-emerald-950/30"
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0",
        isConsultant ? "bg-indigo-500" : "bg-emerald-500"
      )} />
      <span className={cn(
        "text-[10px] font-semibold uppercase tracking-widest",
        isConsultant ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400"
      )}>
        {isConsultant ? tSidebar("personaConsultant") : tSidebar("personaClient")}
      </span>
    </div>
  );
}

// ── Group header ──────────────────────────────────────────────────────────────

function GroupHeader({
  group, label, isOpen, onToggle,
}: {
  group: string; label: string; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-2 rounded-md transition-colors hover:bg-sidebar-accent group/gh"
      aria-expanded={isOpen}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", GROUP_DOT[group])} />
      <span className={cn(
        "flex-1 text-left text-[10px] font-semibold uppercase tracking-widest select-none transition-colors",
        "text-muted-foreground/60 group-hover/gh:text-muted-foreground"
      )}>
        {label}
      </span>
      <ChevronDown className={cn(
        "h-3 w-3 text-muted-foreground/50 group-hover/gh:text-muted-foreground transition-transform duration-200",
        !isOpen && "-rotate-90"
      )} />
    </button>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  const { data: orgs = [] } = useMyOrgs();
  const tNav    = useTranslations("nav");
  const tGroup  = useTranslations("navGroup");
  const tSidebar = useTranslations("sidebar");

  const menuConfig  = (user?.org_settings?.role_menu_config as Record<string, Record<string, boolean>>) ?? {};
  const menuLabels  = (user?.org_settings?.menu_labels as Record<string, string>) ?? {};
  const role        = user?.role ?? "MEMBER";
  const isConsultant = orgs.length > 1;
  const orgPlan     = user?.org_plan ?? "FREE";
  const trialExpires = user?.org_trial_expires_at;

  // Items filtered by plan → role → persona
  const visibleItems = NAV_ITEMS.filter(item =>
    isPlanVisible(item.key, orgPlan, trialExpires) &&
    isPersonaVisible(item, isConsultant) &&
    isRoleVisible(item.key, role, menuConfig, user?.org_mode)
  );

  const currentGroup = activeGroup(pathname, isConsultant);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(COLLAPSIBLE_GROUPS.filter(g => g === currentGroup))
  );

  useEffect(() => {
    const g = activeGroup(pathname, isConsultant);
    if (COLLAPSIBLE_GROUPS.includes(g as CollapsibleGroup) && !openGroups.has(g)) {
      setOpenGroups(prev => new Set([...prev, g]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(group: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  const homeItems = visibleItems.filter(i => i.group === "home");

  // Build grouped sections using effective group per persona
  const groupedSections = COLLAPSIBLE_GROUPS
    .map(g => ({
      group: g,
      items: visibleItems.filter(i => effectiveGroup(i, isConsultant) === g),
    }))
    .filter(s => s.items.length > 0);

  function NavLink({ item }: { item: NavItemDef }) {
    const label  = menuLabels[item.key] || tNav(item.tKey as Parameters<typeof tNav>[0]);
    const active = pathname.startsWith(item.activePathname ?? item.href);
    return (
      <Link
        href={item.href}
        title={sidebarCollapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground",
          sidebarCollapsed && "justify-center"
        )}
        aria-current={active ? "page" : undefined}
        aria-label={sidebarCollapsed ? label : undefined}
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!sidebarCollapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  }


  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-sidebar transition-all duration-200 h-full",
        sidebarCollapsed ? "w-14" : "w-56"
      )}
      aria-label={tSidebar("mainNav")}
    >
      {/* Logo + Org switcher */}
      <div className="border-b px-2 py-2 space-y-1">
        <div className={cn("flex items-center gap-2", sidebarCollapsed ? "justify-center px-0" : "px-1")}>
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold shrink-0">
            O
          </div>
          {!sidebarCollapsed && (
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              OKR System
            </span>
          )}
        </div>
        <OrgSwitcher collapsed={sidebarCollapsed} />
      </div>

      {/* Persona badge */}
      <div className="pt-2">
        <PersonaBadge isConsultant={isConsultant} collapsed={sidebarCollapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-1 px-2 space-y-0.5" aria-label={tSidebar("menu")}>

        {/* Home group — always visible, no toggle */}
        {homeItems.map(item => (
          <NavLink key={item.key} item={item} />
        ))}

        {/* Collapsible groups */}
        {groupedSections.map(({ group, items }) => {
          const isOpen = openGroups.has(group) || sidebarCollapsed;
          const label  = menuLabels[`group_${group}`] || tGroup(group as Parameters<typeof tGroup>[0]);

          return (
            <div key={group}>
              {!sidebarCollapsed && (
                <GroupHeader
                  group={group}
                  label={label}
                  isOpen={isOpen}
                  onToggle={() => toggleGroup(group)}
                />
              )}

              {sidebarCollapsed && (
                <div className="my-1.5 mx-1 h-px bg-sidebar-border" />
              )}

              {isOpen && (
                <div className="space-y-0.5 mt-0.5">
                  {items.map(item => (
                    <NavLink key={item.key} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Platform admin link — solo visible para el super-admin */}
      {user?.is_platform_admin && (
        <div className="border-t px-2 py-1.5">
          <Link
            href="/settings?tab=plataformaOrgs"
            title={sidebarCollapsed ? tSidebar("platformAdmin") : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname.startsWith("/admin") && "bg-sidebar-accent text-sidebar-primary",
              sidebarCollapsed && "justify-center"
            )}
          >
            <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && <span>{tSidebar("platformAdmin")}</span>}
          </Link>
        </div>
      )}

      {/* Toggle sidebar width */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full h-8", sidebarCollapsed ? "justify-center px-0" : "justify-start gap-2")}
          onClick={() => setSidebarCollapsed(v => !v)}
          aria-label={sidebarCollapsed ? tSidebar("expand") : tSidebar("collapseMenu")}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">{tSidebar("collapse")}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
