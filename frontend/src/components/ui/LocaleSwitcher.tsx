"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

function getCurrentLocale(): Locale {
  if (typeof document === "undefined") return "es";
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const val = match?.[1] ?? "es";
  return LOCALES.includes(val as Locale) ? (val as Locale) : "es";
}

interface LocaleSwitcherProps {
  variant?: "light" | "dark";
  className?: string;
}

export function LocaleSwitcher({ variant = "light", className }: LocaleSwitcherProps) {
  const router = useRouter();
  const tLang  = useTranslations("languages");

  function switchLocale(locale: Locale) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  const current = getCurrentLocale();

  return (
    <div className={cn("flex items-center rounded-lg p-0.5 gap-0.5", variant === "dark" ? "bg-white/5" : "bg-muted/60", className)}>
      {LOCALES.map((locale) => {
        const active = current === locale;
        return (
          <button
            key={locale}
            onClick={() => switchLocale(locale)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              variant === "dark"
                ? active
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
                : active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
            )}
            title={tLang(locale)}
          >
            {locale.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
