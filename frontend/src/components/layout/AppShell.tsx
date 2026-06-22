"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useSocket } from "@/hooks/useSocket";
import { useCycles } from "@/hooks/useCycles";
import { useAllObjectives } from "@/hooks/useObjectives";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { SetupGuide } from "@/components/shared/SetupGuide";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui.store";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getPageInfo } from "@/lib/nav-descriptions";

function TrialBanner() {
  const t    = useTranslations("components.trialBanner");
  const user = useAuthStore(s => s.user);
  const [dismissed, setDismissed] = useState(false);

  if (user?.org_plan !== "FREE" || !user?.org_trial_expires_at) return null;

  const daysLeft = Math.ceil(
    (new Date(user.org_trial_expires_at).getTime() - Date.now()) / 86400000
  );
  if (daysLeft <= 0 || daysLeft > 30) return null;
  if (dismissed && daysLeft > 7) return null;

  const urgent  = daysLeft <= 3;
  const warning = daysLeft <= 7;

  const styles = urgent
    ? { bar: "bg-red-500/10 border-red-500/20", text: "text-red-600 dark:text-red-400", dot: "bg-red-500", btn: "bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300" }
    : warning
    ? { bar: "bg-amber-500/10 border-amber-500/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", btn: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300" }
    : { bar: "bg-blue-500/8 border-blue-500/15", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500", btn: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-800 dark:text-blue-300" };

  const msg = urgent
    ? t("urgent", { n: daysLeft })
    : warning
    ? t("warning", { n: daysLeft })
    : t("normal",  { n: daysLeft });

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2 border-b text-xs shrink-0", styles.bar)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 animate-pulse", styles.dot)} />
      <p className={cn("flex-1 font-medium", styles.text)}>{msg}</p>
      <a
        href="/settings?tab=plataformaOrgs"
        className={cn("shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors", styles.btn)}
      >
        {t("viewPlan")}
      </a>
      {daysLeft > 7 && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-base leading-none"
          aria-label={t("dismiss")}
        >
          ×
        </button>
      )}
    </div>
  );
}

const COLOR_STYLES = {
  blue:   { bar: "bg-blue-500",   bg: "from-blue-500/[0.06]",   text: "text-blue-600 dark:text-blue-400",   dot: "bg-blue-400"   },
  rose:   { bar: "bg-rose-500",   bg: "from-rose-500/[0.06]",   text: "text-rose-600 dark:text-rose-400",   dot: "bg-rose-400"   },
  violet: { bar: "bg-violet-500", bg: "from-violet-500/[0.06]", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-400" },
  amber:  { bar: "bg-amber-500",  bg: "from-amber-500/[0.06]",  text: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-400"  },
  gray:   { bar: "bg-gray-400",   bg: "from-gray-400/[0.05]",   text: "text-gray-500 dark:text-gray-400",    dot: "bg-gray-400"   },
} as const;

function PageContextBar({ pathname }: { pathname: string }) {
  const info = getPageInfo(pathname);
  if (!info) return null;
  const c = COLOR_STYLES[info.color];
  return (
    <div className={`relative flex gap-4 border-b bg-gradient-to-r ${c.bg} to-transparent px-6 py-3.5`}>
      {/* Accent bar */}
      <div className={`absolute left-0 inset-y-0 w-[3px] rounded-r-full ${c.bar} opacity-70`} />
      <div className="min-w-0">
        <div className={`flex items-center gap-1.5 mb-1`}>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${c.text}`}>
            {info.tagline}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          {info.description}
        </p>
      </div>
    </div>
  );
}

// Canvas/board pages that benefit from full monitor width
const FULL_WIDTH_ROUTES = [
  "/traceability",
  "/backlog",
  "/reports",
  "/portfolio",
  "/program",
  "/delivery",
  "/sprints",
  "/agreements",
];

function PresentationBar({ company, onExit }: { company: string; onExit: () => void }) {
  const t = useTranslations("components.presentationBar");
  const [showNav, setShowNav] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // ── Draggable position ───────────────────────────────────────────────────
  // Initialized lazily on first render so SSR is safe.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Set initial position once mounted (right-aligned, top)
  useEffect(() => {
    setPos({ x: window.innerWidth - 300, y: 16 });
  }, []);

  function onBarMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Only drag from the background pill — not from buttons inside it
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const current = pos ?? { x: window.innerWidth - 300, y: 16 };
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: current.x, origY: current.y };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 40, dragRef.current.origY + dy)),
      });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Close dropdown when route changes
  useEffect(() => { setShowNav(false); setNavigatingTo(null); }, [pathname]);

  const sections = [
    { labelKey: "sectionTraceability",  descKey: "descTraceability",  href: "/traceability",               icon: "🗺️" },
    { labelKey: "sectionOkrs",          descKey: "descOkrs",          href: "/strategic",                  icon: "🎯" },
    { labelKey: "sectionTacticalOkrs",  descKey: "descTacticalOkrs",  href: "/tactical",                   icon: "⚡" },
    { labelKey: "sectionInitiatives",   descKey: "descInitiatives",   href: "/initiatives",                icon: "🚀" },
    { labelKey: "sectionBacklog",       descKey: "descBacklog",       href: "/backlog",                    icon: "📋" },
    { labelKey: "sectionCheckins",      descKey: "descCheckins",      href: "/checkins",                   icon: "✅" },
    { labelKey: "sectionReports",       descKey: "descReports",       href: "/reports/executive-dashboard", icon: "📊" },
  ];

  function navigateTo(href: string) {
    if (navigatingTo) return;
    setNavigatingTo(href);
    setShowNav(false);
    startTransition(() => { router.push(href); });
  }

  const currentSection = sections.find(s => pathname === s.href || pathname?.startsWith(s.href + "/"));

  // Determine dropdown direction: open upward if bar is in lower half of screen
  const dropUp = pos !== null && pos.y > window.innerHeight / 2;

  if (!pos) return null; // avoid flash before position is set

  return (
    <div
      className="fixed z-50 flex flex-col items-start gap-2 select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Nav dropdown — above or below depending on position */}
      {showNav && dropUp && (
        <div className="rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-sm p-1.5 min-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2.5 py-1.5">
            {t("goToSection")}
          </p>
          {sections.map(s => {
            const isCurrent = pathname === s.href || pathname?.startsWith(s.href + "/");
            return (
              <button
                key={s.href}
                onClick={() => navigateTo(s.href)}
                disabled={isCurrent || !!navigatingTo}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-default"
              >
                <span className="text-base leading-none shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm leading-tight", isCurrent ? "font-semibold text-primary" : "text-foreground")}>{t(s.labelKey as Parameters<typeof t>[0])}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t(s.descKey as Parameters<typeof t>[0])}</div>
                </div>
                {isCurrent && <span className="shrink-0 text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded-full">{t("here")}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Main bar */}
      <div
        onMouseDown={onBarMouseDown}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur-sm text-sm cursor-grab active:cursor-grabbing"
        title={t("dragToMove")}
      >
        {isPending ? (
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        )}
        <span className="font-semibold text-foreground max-w-[140px] truncate">{company || "Demo"}</span>
        {currentSection && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-xs text-muted-foreground">{currentSection.icon} {t(currentSection.labelKey as Parameters<typeof t>[0])}</span>
          </>
        )}
        <div className="w-px h-4 bg-border mx-1" />
        <button
          onClick={() => setShowNav(v => !v)}
          disabled={isPending}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isPending ? t("loading") : t("navigate")}
        </button>
        <button
          onClick={onExit}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
        >
          {t("exit")}
        </button>
      </div>

      {/* Nav dropdown — below bar (default, when in upper half) */}
      {showNav && !dropUp && (
        <div className="rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-sm p-1.5 min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-150">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2.5 py-1.5">
            {t("goToSection")}
          </p>
          {sections.map(s => {
            const isCurrent = pathname === s.href || pathname?.startsWith(s.href + "/");
            return (
              <button
                key={s.href}
                onClick={() => navigateTo(s.href)}
                disabled={isCurrent || !!navigatingTo}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-default"
              >
                <span className="text-base leading-none shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm leading-tight", isCurrent ? "font-semibold text-primary" : "text-foreground")}>{t(s.labelKey as Parameters<typeof t>[0])}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t(s.descKey as Parameters<typeof t>[0])}</div>
                </div>
                {isCurrent && <span className="shrink-0 text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded-full">{t("here")}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { connect, disconnect } = useSocket();
  const { sidebarOpen, closeSidebar, presentationMode, presentationCompany, exitPresentation } = useUIStore();
  const pathname = usePathname();

  // Pre-warm cache global: ciclos y objetivos están disponibles antes de que
  // cualquier página los necesite, eliminando la dependencia de navegación previa.
  useCycles();
  useAllObjectives();

  const isFullWidth = !!pathname && FULL_WIDTH_ROUTES.some(
    r => pathname === r || pathname.endsWith(r) || pathname.includes(r + "/"),
  );

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  if (presentationMode) {
    return (
      <ConfirmProvider>
        <div className="h-full bg-background overflow-auto">
          <PresentationBar company={presentationCompany} onExit={exitPresentation} />
          <div className="w-full min-h-full">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </div>
      </ConfirmProvider>
    );
  }

  return (
    <ConfirmProvider>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <TrialBanner />
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Mobile overlay backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/50 md:hidden"
              onClick={closeSidebar}
              aria-hidden="true"
            />
          )}
          {/* Sidebar: always visible on md+, drawer on mobile */}
          <div className={`
            fixed inset-y-0 left-0 z-30 md:relative md:translate-x-0 md:flex
            transition-transform duration-200
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          `}>
            <Sidebar />
          </div>
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <TopBar />
            <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
              <PageContextBar pathname={pathname ?? ""} />
              <div className={isFullWidth ? "w-full min-h-full" : "max-w-5xl w-full min-h-full"}>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </div>
            </main>
          </div>
          <SetupGuide />
        </div>
      </div>
    </ConfirmProvider>
  );
}
