"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import {
  useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  type Notification,
} from "@/hooks/useCheckIns";
import { NOTIFICATION_TYPE_COLORS } from "@/lib/constants";

function NotificationItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const locale = useLocale();
  return (
    <button
      onClick={() => !n.read_at && onRead(n.id)}
      className={cn(
        "w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex gap-2.5",
        !n.read_at && "bg-muted/20"
      )}
    >
      <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", NOTIFICATION_TYPE_COLORS[n.type] ?? "bg-muted-foreground")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium truncate", !n.read_at && "text-foreground")}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {new Date(n.created_at).toLocaleDateString(locale, {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
    </button>
  );
}

export function NotificationsBell() {
  const t = useTranslations("components.notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useNotifications();
  const markRead    = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unread = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={unread > 0 ? t("ariaUnread", { n: unread }) : t("ariaLabel")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">{t("title")}</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-primary hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {t("noNotifications")}
              </p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <NotificationItem key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
