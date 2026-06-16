"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { useTranslations } from "next-intl";
import {
  Search, X, Target, Zap, Layers, BookOpen, FileText,
  Rocket, CalendarRange, CornerDownLeft, ArrowUp, ArrowDown,
  Clock, BarChart3, CheckSquare, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalSearch, type SearchResult } from "@/hooks/useGlobalSearch";

// ── Icon map ────────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  OKR_COMPANY: Target,
  OKR_TEAM:    Zap,
  EPIC:        Layers,
  FEATURE:     BookOpen,
  STORY:       FileText,
  INITIATIVE:  Rocket,
  CYCLE:       CalendarRange,
};

const TYPE_COLOR: Record<string, string> = {
  OKR_COMPANY: "text-blue-500",
  OKR_TEAM:    "text-violet-500",
  EPIC:        "text-violet-600",
  FEATURE:     "text-blue-600",
  STORY:       "text-green-600",
  INITIATIVE:  "text-amber-500",
  CYCLE:       "text-sky-500",
};

// ── Quick nav link definitions (labels resolved via t() inside component) ──────

const QUICK_LINK_DEFS = [
  { tKey: "strategicOkrs", href: "/strategic",   Icon: Target,        color: "text-blue-500" },
  { tKey: "tacticalOkrs",  href: "/tactical",    Icon: Zap,           color: "text-violet-500" },
  { tKey: "checkins",      href: "/checkins",    Icon: CheckSquare,   color: "text-green-500" },
  { tKey: "backlog",       href: "/backlog",     Icon: Layers,        color: "text-indigo-500" },
  { tKey: "sprints",       href: "/sprints",     Icon: LayoutGrid,    color: "text-cyan-500" },
  { tKey: "initiatives",   href: "/initiatives", Icon: Rocket,        color: "text-amber-500" },
  { tKey: "reports",       href: "/reports",     Icon: BarChart3,     color: "text-rose-500" },
  { tKey: "cycles",        href: "/cycles",      Icon: CalendarRange, color: "text-sky-500" },
];

// ── Component ───────────────────────────────────────────────────────────────────

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const t       = useTranslations("components.search");
  const router  = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  const [query, setQuery]         = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [debouncedQ]              = useDebounce(query, 280);

  const { data: results = [], isFetching } = useGlobalSearch(debouncedQ);

  const QUICK_LINKS = QUICK_LINK_DEFS.map(d => ({ ...d, label: t(d.tKey as Parameters<typeof t>[0]) }));

  // Group results by category
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flat = results;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(-1); }, [debouncedQ]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }

    const items = query.trim().length >= 2 ? flat : QUICK_LINKS;
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      navigate(items[activeIdx].href);
    }
  }

  if (!open) return null;

  const showResults = debouncedQ.trim().length >= 2;
  const showEmpty   = showResults && !isFetching && results.length === 0;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={t("ariaLabel")}
        aria-modal="true"
        className="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl border bg-background shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className={cn("h-4 w-4 shrink-0 transition-colors", isFetching ? "text-primary animate-pulse" : "text-muted-foreground")} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label={t("ariaSearch")}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("clearSearch")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        {/* Body */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto">

          {/* Quick links (no query) */}
          {!showResults && (
            <div className="p-3">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t("quickAccess")}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {QUICK_LINKS.map(({ label, href, Icon, color }, idx) => (
                  <button
                    key={href}
                    data-idx={idx}
                    onClick={() => navigate(href)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                      "hover:bg-muted",
                      activeIdx === idx && "bg-muted",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", color)} aria-hidden="true" />
                    <span className="truncate text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {showResults && isFetching && (
            <div className="p-3 space-y-1.5">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse">
                  <div className="h-4 w-4 rounded bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-2.5 w-1/3 rounded bg-muted/60" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">{t("noResults")} <span className="font-medium text-foreground">"{debouncedQ}"</span></p>
            </div>
          )}

          {/* Results grouped by category */}
          {showResults && !isFetching && results.length > 0 && (
            <div className="p-2">
              {Object.entries(grouped).map(([category, items]) => {
                const flatOffset = flat.findIndex(r => r.id === items[0].id);
                return (
                  <div key={category} className="mb-1 last:mb-0">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {category}
                    </p>
                    {items.map((result, i) => {
                      const idx  = flatOffset + i;
                      const Icon = TYPE_ICON[result.type_key] ?? FileText;
                      const clr  = TYPE_COLOR[result.type_key] ?? "text-muted-foreground";
                      return (
                        <button
                          key={result.id}
                          data-idx={idx}
                          onClick={() => navigate(result.href)}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                            "hover:bg-muted",
                            activeIdx === idx && "bg-muted",
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", clr)} aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          </div>
                          {activeIdx === idx && (
                            <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-[10px] text-muted-foreground/70">
          <span className="flex items-center gap-1"><ArrowUp className="h-2.5 w-2.5" /><ArrowDown className="h-2.5 w-2.5" /> {t("kbNavigate")}</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="h-2.5 w-2.5" /> {t("kbOpen")}</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">ESC</kbd> {t("kbClose")}</span>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
