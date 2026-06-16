"use client";

import { useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useRouter } from "next/navigation";

export function LocaleSync() {
  const { data: profile } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (!profile?.locale) return;
    const current = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
    if (current !== profile.locale) {
      document.cookie = `NEXT_LOCALE=${profile.locale}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
    }
  }, [profile?.locale]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
