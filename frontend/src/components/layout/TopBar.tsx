"use client";

import { Moon, Sun, Search, CalendarRange, Menu, LogOut, Sparkles, ChevronDown, LifeBuoy, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useActiveCycle } from "@/hooks/useCycles";
import { NotificationsBell } from "./NotificationsBell";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { useUIStore } from "@/store/ui.store";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";

function UserMenu() {
  const { user } = useAuth();
  const setUser = useAuthStore(s => s.setUser);
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("topbar");


  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try { await authApi.logout(); } finally {
      setUser(null);
      qc.clear();
      router.push("/auth/login");
    }
  }

  const name = user?.name ?? user?.email ?? "Usuario";
  const initials = name.slice(0, 2).toUpperCase();
  const isPro = user?.org_plan === "PRO" || user?.org_plan === "ENTERPRISE";
  const canUpgrade = !isPro && (user?.role === "OWNER" || user?.role === "ADMIN");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-muted transition-colors"
        aria-label={t("userMenu")}
        aria-expanded={open}
      >
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium text-foreground max-w-[120px] truncate">
          {name}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border bg-popover shadow-lg py-1 z-50">
          {/* User info */}
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold",
                isPro ? "bg-indigo-500/15 text-indigo-400" : "bg-muted text-muted-foreground"
              )}>
                {user?.org_plan ?? "FREE"}
              </span>
              <span className="text-[10px] text-muted-foreground">{user?.org_name}</span>
            </div>
          </div>

          {/* Upgrade to Pro */}
          {canUpgrade && (
            <Link
              href="/upgrade"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-indigo-400 hover:bg-muted transition-colors"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              {t("upgradePro")}
            </Link>
          )}

          {/* Settings + Support */}
          <div className="border-t mt-1 pt-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
              {t("settings")}
            </Link>
            <Link
              href="/support"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <LifeBuoy className="h-4 w-4 shrink-0 text-muted-foreground" />
              {t("support")}
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t mt-1 pt-1">
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" />
              {loading ? t("loggingOut") : t("logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { data: activeCycle } = useActiveCycle();
  const [searchOpen, setSearchOpen] = useState(false);
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const t = useTranslations("topbar");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 gap-4">
      {/* Hamburger — mobile only */}
      <button
        onClick={toggleSidebar}
        className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors shrink-0"
        aria-label={t("openMenu")}
      >
        <Menu className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Ciclo activo */}
      <Link
        href="/cycles"
        className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity shrink-0"
        aria-label={t("goCycles")}
      >
        <CalendarRange className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground hidden sm:inline">{t("cycleLabel")}</span>
        {activeCycle ? (
          <>
            <span className="font-medium text-foreground">{activeCycle.name}</span>
            <Badge className="bg-okr-on-track-bg text-okr-on-track text-xs">{t("activeBadge")}</Badge>
          </>
        ) : (
          <span className="font-medium text-muted-foreground">{t("noCycle")}</span>
        )}
      </Link>

      {/* Search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden md:flex flex-1 max-w-sm items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 h-9 text-sm text-muted-foreground hover:bg-muted hover:border-border transition-all cursor-text"
        aria-label={t("openSearch")}
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{t("search")}</span>
        <kbd className="inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70 shadow-sm">
          Ctrl K
        </kbd>
      </button>

      {/* Mobile search icon */}
      <button
        onClick={() => setSearchOpen(true)}
        className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors"
        aria-label={t("mobileSearch")}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Acciones */}
      <div className="flex items-center gap-1 shrink-0">
        <NotificationsBell />

        <LocaleSwitcher />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={t("changeTheme")}
              />
            }
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>{t("changeTheme")}</TooltipContent>
        </Tooltip>

        <UserMenu />
      </div>

      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
