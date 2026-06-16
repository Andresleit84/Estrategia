"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LifeBuoy, Plus, MessageSquare, Clock, CheckCircle2, AlertCircle, XCircle, ChevronRight, Send, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { useTickets, useTicket, useCreateTicket, useAddMessage, useUpdateStatus, type SupportTicket } from "@/hooks/useSupport";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "general", labelKey: "typeGeneral" },
  { value: "bug",     labelKey: "typeBug" },
  { value: "feature", labelKey: "typeFeature" },
  { value: "billing", labelKey: "typeBilling" },
  { value: "access",  labelKey: "typeAccess" },
  { value: "other",   labelKey: "typeOther" },
];

const STATUS_CONFIG: Record<SupportTicket["status"], { labelKey: string; color: string; icon: React.ElementType }> = {
  open:        { labelKey: "statusOpen",       color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: AlertCircle },
  in_progress: { labelKey: "statusInProgress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",     icon: Clock },
  resolved:    { labelKey: "statusResolved",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  closed:      { labelKey: "statusClosed",     color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",        icon: XCircle },
};

function timeAgo(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SupportTicket["status"] }) {
  const t = useTranslations("pages.support");
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.color)}>
      <Icon className="w-3 h-3" />
      {t(cfg.labelKey)}
    </span>
  );
}

// ── New ticket modal ──────────────────────────────────────────────────────────

function NewTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("pages.support");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateTicket();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ title, category, body });
      setTitle(""); setCategory("general"); setBody("");
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al crear el ticket"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newTicketTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t("newTicketTitle")}</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <SelectOption key={c.value} value={c.value}>{t(c.labelKey)}</SelectOption>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t("subject")}</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Describe brevemente el problema o solicitud"
              required
              minLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t("message")}</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Explica con detalle tu consulta, problema o solicitud..."
              rows={5}
              required
              minLength={10}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon("cancel")}</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Enviando..." : t("newTicket")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Ticket detail panel ───────────────────────────────────────────────────────

function TicketDetail({ ticket, onClose, isStaff }: {
  ticket: SupportTicket;
  onClose: () => void;
  isStaff: boolean;
}) {
  const t = useTranslations("pages.support");
  const { data, isLoading } = useTicket(ticket.id);
  const [reply, setReply] = useState("");
  const addMsg = useAddMessage(ticket.id);
  const updateStatus = useUpdateStatus(ticket.id);
  const { user } = useAuth();
  const getCatLabel = (value: string) => { const c = CATEGORIES.find(cat => cat.value === value); return c ? t(c.labelKey) : value; };

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    await addMsg.mutateAsync(reply.trim());
    setReply("");
  }

  const detail = data ?? ticket;
  const messages = detail.messages ?? [];
  const isClosed = detail.status === "closed";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusBadge status={detail.status} />
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {getCatLabel(detail.category)}
            </span>
          </div>
          <h3 className="font-semibold text-foreground leading-snug">{detail.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {detail.user_name} · {timeAgo(detail.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isStaff && !isClosed && (
            <Select
              value={detail.status}
              onChange={(e) => updateStatus.mutate(e.target.value)}
              className="text-xs h-8 w-36"
            >
              <SelectOption value="open">{t("statusOpen")}</SelectOption>
              <SelectOption value="in_progress">{t("statusInProgress")}</SelectOption>
              <SelectOption value="resolved">{t("statusResolved")}</SelectOption>
              <SelectOption value="closed">{t("statusClosed")}</SelectOption>
            </Select>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes aún</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.user_id;
            return (
              <div key={msg.id} className={cn("flex gap-2.5", isOwn ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  msg.is_staff
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    : "bg-muted text-muted-foreground"
                )}>
                  {msg.sender_name.charAt(0).toUpperCase()}
                </div>
                <div className={cn("max-w-[75%] space-y-1", isOwn ? "items-end" : "items-start")}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground">{msg.sender_name}</span>
                    {msg.is_staff && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
                        Soporte
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(msg.created_at)}</span>
                  </div>
                  <div className={cn(
                    "text-sm px-3 py-2 rounded-xl whitespace-pre-wrap leading-relaxed",
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  )}>
                    {msg.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply box */}
      {!isClosed ? (
        <form onSubmit={handleReply} className="p-3 border-t border-border">
          <div className="flex gap-2 items-end">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={2}
              className="resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply(e as any);
              }}
            />
            <Button type="submit" size="icon" disabled={!reply.trim() || addMsg.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Ctrl+Enter para enviar</p>
        </form>
      ) : (
        <div className="p-3 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">Este ticket está cerrado</p>
        </div>
      )}
    </div>
  );
}

// ── Ticket row ────────────────────────────────────────────────────────────────

function TicketRow({ ticket, active, onClick }: {
  ticket: SupportTicket;
  active: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("pages.support");
  const getCatLabel = (value: string) => { const c = CATEGORIES.find(cat => cat.value === value); return c ? t(c.labelKey) : value; };
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all",
        active
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/20 hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-sm text-foreground leading-snug flex-1 min-w-0 truncate">
          {ticket.title}
        </span>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="bg-muted px-1.5 py-0.5 rounded-full">
          {getCatLabel(ticket.category)}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {ticket.message_count}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="w-3 h-3" />
          {timeAgo(ticket.updated_at)}
        </span>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      </div>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const t = useTranslations("pages.support");
  const { user } = useAuth();
  const { data: tickets = [], isLoading } = useTickets();
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const isStaff = user?.role === "OWNER" || user?.role === "ADMIN";

  const openTickets     = tickets.filter((tk) => tk.status === "open" || tk.status === "in_progress");
  const resolvedTickets = tickets.filter((tk) => tk.status === "resolved" || tk.status === "closed");

  return (
    <div className="h-full flex flex-col min-h-0 p-6 pb-0">
      <PageHeader
        title={t("title")}
        description={isStaff ? t("desc") : t("sendInquiry")}
        actions={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {t("newTicket")}
          </Button>
        }
      />

      <div className="flex-1 min-h-0 flex gap-4 pb-6 overflow-hidden">
        {/* Ticket list */}
        <div className={cn(
          "flex flex-col gap-2 overflow-y-auto",
          selected ? "hidden lg:flex lg:w-[380px] shrink-0" : "w-full"
        )}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title={t("noTickets")}
              description="Crea un ticket para reportar un problema o hacer una consulta."
              onAction={() => setNewOpen(true)}
              actionLabel={t("newTicket")}
            />
          ) : (
            <>
              {openTickets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    {t("activeTickets")} ({openTickets.length})
                  </p>
                  {openTickets.map((t) => (
                    <TicketRow
                      key={t.id}
                      ticket={t}
                      active={selected?.id === t.id}
                      onClick={() => setSelected(t)}
                    />
                  ))}
                </div>
              )}
              {resolvedTickets.length > 0 && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    {t("resolvedTickets")} ({resolvedTickets.length})
                  </p>
                  {resolvedTickets.map((t) => (
                    <TicketRow
                      key={t.id}
                      ticket={t}
                      active={selected?.id === t.id}
                      onClick={() => setSelected(t)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="flex-1 min-w-0 rounded-xl border border-border bg-card flex flex-col min-h-0 overflow-hidden">
            <TicketDetail
              ticket={selected}
              onClose={() => setSelected(null)}
              isStaff={isStaff}
            />
          </div>
        )}
      </div>

      <NewTicketModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
