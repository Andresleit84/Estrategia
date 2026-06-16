"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePersonalBriefingLatest,
  useGeneratePersonalBriefing,
} from "@/hooks/useAI";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import {
  Sparkles, AlertTriangle, Handshake, Layers,
  RefreshCw, ChevronDown, CalendarClock, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function timeUntilMondayMeeting(t: ReturnType<typeof useTranslations>): { label: string; urgent: boolean } {
  const now = new Date();
  const dow = now.getDay();
  let daysUntil: number;
  if (dow === 1) {
    daysUntil = now.getHours() < 7 ? 0 : 7;
  } else {
    daysUntil = ((8 - dow) % 7) || 7;
  }
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(7, 0, 0, 0);

  const diffMs = next.getTime() - now.getTime();
  const diffH  = Math.floor(diffMs / 3_600_000);
  const diffM  = Math.floor((diffMs % 3_600_000) / 60_000);
  const urgent = diffH < 24;

  let label: string;
  if (diffH < 1)       label = t("meetingStartsIn", { n: diffM });
  else if (diffH < 24) label = `${t("mondayMeeting")} · ${t("meetingToday", { h: diffH, m: diffM })}`;
  else if (diffH < 48) label = `${t("mondayMeeting")} · ${t("meetingTomorrow")}`;
  else                 label = `${t("mondayMeeting")} · ${t("meetingInDays", { n: Math.ceil(diffH / 24) })}`;

  return { label, urgent };
}

function firstName(fullName?: string | null): string {
  if (!fullName) return "";
  return fullName.trim().split(" ")[0];
}

export function PersonalBriefingCard() {
  const t        = useTranslations("components.briefingCard");
  const { data, isLoading } = usePersonalBriefingLatest();
  const generate = useGeneratePersonalBriefing();
  const authUser = useAuthStore(s => s.user);
  const [expanded, setExpanded] = useState(false);

  const meeting  = timeUntilMondayMeeting(t);
  const row      = data ?? null;
  const report   = row?.content ?? null;
  const hasData  = !!report;
  const name     = firstName(report?.user_name ?? authUser?.name);

  const generatedAt = row?.created_at
    ? new Date(row.created_at).toLocaleDateString(undefined, {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  async function handleGenerate() {
    const toastId = toast.loading(t("preparing"));
    try {
      const result = await generate.mutateAsync();
      toast.dismiss(toastId);
      if (result && "error" in (result as object)) {
        toast.warning(String((result as { error?: string }).error) || t("noData"));
      } else {
        toast.success(t("ready"));
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(t("errorGenerate"));
      console.error("[PersonalBriefing]", err);
    }
  }

  if (isLoading) return <Skeleton className="h-52 rounded-2xl" />;

  const bullets     = report?.bullets ?? [];
  const atRisk      = report?.at_risk_krs ?? [];
  const agreements  = report?.agreements_due ?? [];
  const sprintItems = report?.sprint_items ?? [];
  const atRiskCount = report?.at_risk_count ?? 0;
  const agrCount    = report?.agreements_count ?? 0;
  const sprintCount = report?.sprint_items_count ?? 0;
  const allClear    = hasData && atRiskCount + agrCount + sprintCount === 0;

  return (
    <Card className="overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("title")}
            </p>
            {name && (
              <p className="text-sm font-semibold text-foreground leading-tight mt-0.5">
                {t("greeting", { name })}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 shrink-0"
          onClick={handleGenerate}
          disabled={generate.isPending}
        >
          <RefreshCw className={cn("h-3 w-3", generate.isPending && "animate-spin")} />
          {generate.isPending ? t("generating") : hasData ? t("update") : t("generate")}
        </Button>
      </div>

      {/* ── Countdown ── */}
      <div className={cn(
        "flex items-center gap-1.5 px-4 py-2 border-b text-[11px] font-medium",
        meeting.urgent
          ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400"
          : "bg-muted/10 text-muted-foreground",
      )}>
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        <span className={meeting.urgent ? "font-semibold" : ""}>{meeting.label}</span>
      </div>

      {/* ── Sin datos ── */}
      {!hasData && (
        <div className="px-5 py-8 text-center space-y-2">
          <CalendarClock className="h-8 w-8 text-muted-foreground/25 mx-auto" />
          <p className="text-sm font-semibold text-foreground/60">
            {name ? t("readyQuestion", { name }) : t("readyQuestionNoName")}
          </p>
          <p className="text-xs text-muted-foreground">{t("generatePrompt")}</p>
        </div>
      )}

      {/* ── Todo en orden ── */}
      {hasData && allClear && (
        <div className="px-5 py-7 text-center space-y-1.5">
          <div className="text-3xl">✅</div>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {name ? t("alignedWithName", { name }) : t("alignedNoName")}
          </p>
          <p className="text-xs text-muted-foreground">{t("noAlerts")}</p>
          {generatedAt && (
            <p className="text-[10px] text-muted-foreground/50 pt-2">{generatedAt}</p>
          )}
        </div>
      )}

      {/* ── Contenido principal ── */}
      {hasData && !allClear && (
        <>
          {/* Pills — links de navegación */}
          <div className="px-4 py-3 flex flex-wrap gap-2 border-b bg-muted/10">
            {atRiskCount > 0 && (
              <Link
                href="/reports/risk-dashboard"
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
              >
                <AlertTriangle className="h-3 w-3" />
                {t("krsAtRisk", { count: atRiskCount })}
              </Link>
            )}
            {agrCount > 0 && (
              <Link
                href="/agreements"
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
              >
                <Handshake className="h-3 w-3" />
                {t("urgentAgreements", { count: agrCount })}
              </Link>
            )}
            {sprintCount > 0 && (
              <Link
                href="/sprints"
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
              >
                <Layers className="h-3 w-3" />
                {t("activeStories", { count: sprintCount })}
              </Link>
            )}
          </div>

          {/* Bullets IA */}
          {bullets.length > 0 && (
            <div className="px-4 py-4 border-b">
              <p className="text-[11px] font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                {name
                  ? <><span className="text-primary">{name}</span>{", "}{t("mondayAction", { name: "" }).replace(`${name}, `, "")}</>
                  : t("mondayActionNoName")
                }
              </p>
              <ul className="space-y-2.5">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-3 leading-snug">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detalle colapsable */}
          {(atRisk.length > 0 || agreements.length > 0 || sprintItems.length > 0) && (
            <>
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors border-b bg-muted/20 hover:bg-muted/40"
              >
                {t("viewContext")}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")} />
              </button>

              {expanded && (
                <div className="divide-y">
                  {atRisk.length > 0 && (
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">
                          {t("krsAtRiskSection")}
                        </p>
                        <Link href="/reports/risk-dashboard" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                          Risk Dashboard <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                      {atRisk.slice(0, 4).map((kr, i) => {
                        const conf = Math.round(Number(kr.confidence ?? 0) * 100);
                        return (
                          <Link key={i} href="/strategic"
                            className="flex items-center justify-between gap-2 -mx-1 px-1 py-1 rounded hover:bg-muted/50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{kr.kr_title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{kr.objective_title}</p>
                            </div>
                            <span className={cn("text-xs font-bold tabular-nums shrink-0",
                              conf < 30 ? "text-red-500" : "text-amber-500")}>
                              {conf}%
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {agreements.length > 0 && (
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                          {t("urgentAgreementsSection")}
                        </p>
                        <Link href="/agreements" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                          {t("viewAgreements")} <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                      {agreements.slice(0, 3).map((a, i) => {
                        const days  = a.days_remaining;
                        const label = a.is_overdue || days === null ? t("overdue") : days === 0 ? t("today") : t("daysRemaining", { n: days });
                        return (
                          <Link key={i} href="/agreements"
                            className="flex items-center justify-between gap-2 -mx-1 px-1 py-1 rounded hover:bg-muted/50 transition-colors">
                            <p className="text-xs font-medium truncate flex-1">{a.title}</p>
                            <span className={cn("text-xs font-bold shrink-0",
                              a.is_overdue ? "text-red-500" : "text-amber-500")}>
                              {label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {sprintItems.length > 0 && (
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                          {t("activeStoriesSection")}
                        </p>
                        <Link href="/sprints" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-medium">
                          {t("viewSprint")} <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                      {sprintItems.slice(0, 3).map((s, i) => (
                        <Link key={i} href="/sprints"
                          className="flex items-center justify-between gap-2 -mx-1 px-1 py-1 rounded hover:bg-muted/50 transition-colors">
                          <p className="text-xs truncate flex-1">{s.title}</p>
                          <span className={cn("text-[10px] font-medium shrink-0",
                            s.status === "IN_PROGRESS" ? "text-blue-500" : "text-muted-foreground")}>
                            {s.status === "IN_PROGRESS" ? t("inProgress") : t("pendingStatus")}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {generatedAt && (
            <div className="px-4 py-2 bg-muted/20 border-t">
              <p className="text-[10px] text-muted-foreground">{t("updatedAt", { date: generatedAt })}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
