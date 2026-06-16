"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useStrategyAdvisor,
  useConversations,
  type Conversation,
  type StrategyAdvisorResponse,
} from "@/hooks/useAI";
import { useActiveCycle } from "@/hooks/useCycles";
import { useObjectives } from "@/hooks/useObjectives";
import { Bot, Send, ChevronRight, Loader2, AlertCircle, AtSign } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  suggested_actions?: string[];
}

// ── Action chip routes ────────────────────────────────────────────────────────

const ACTION_ROUTES: Record<string, string> = {
  "Ver Risk Dashboard": "/reports/risk-dashboard",
  "Ver Check-ins": "/checkins",
  "Ver Alineación": "/strategic",
  "Ver Briefing Ejecutivo": "/reports/executive-briefing",
  "Ver OKRs": "/strategic",
};

// ── Conversation sidebar ──────────────────────────────────────────────────────

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  loading,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const t = useTranslations("pages.aiAssistant");
  return (
    <div className="w-60 shrink-0 border-r flex flex-col bg-muted/30">
      <div className="p-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("conversations")}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        {!loading && conversations.length === 0 && (
          <p className="text-xs text-muted-foreground p-2 text-center mt-4">
            {t("noConversations")}
          </p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
              "hover:bg-muted",
              activeId === c.id ? "bg-muted font-medium" : "text-muted-foreground"
            )}
          >
            <p className="truncate">{c.title || t("noTitle")}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {t("messages", { n: c.message_count })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onActionClick,
}: {
  msg: Message;
  onActionClick: (action: string) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 h-7 w-7 rounded-full bg-brand flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={cn("max-w-[72%] space-y-2", isUser && "items-end flex flex-col")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>

        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.sources.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 border rounded-full px-2 py-0.5"
              >
                <ChevronRight className="h-2.5 w-2.5" />
                {s}
              </span>
            ))}
          </div>
        )}

        {!isUser && msg.suggested_actions && msg.suggested_actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {msg.suggested_actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onActionClick(action)}
                className="text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full px-2.5 py-1 transition-colors"
              >
                {action} →
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="mt-1 h-7 w-7 rounded-full bg-brand flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── @ Mention dropdown ────────────────────────────────────────────────────────

function MentionDropdown({
  query,
  objectives,
  onSelect,
}: {
  query: string;
  objectives: Array<{ id: string; title: string; level: string }>;
  onSelect: (title: string) => void;
}) {
  const t = useTranslations("pages.aiAssistant");
  const filtered = objectives
    .filter((o) => o.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  if (filtered.length === 0) return null;

  const LEVEL_COLOR: Record<string, string> = {
    COMPANY:    "text-brand",
    AREA:       "text-blue-500",
    TEAM:       "text-purple-500",
    INDIVIDUAL: "text-gray-500",
  };

  return (
    <div className="absolute bottom-full left-0 mb-1 w-72 bg-popover border rounded-xl shadow-lg overflow-hidden z-50">
      <p className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5 border-b uppercase tracking-wider">
        {t("objectives")}
      </p>
      {filtered.map((obj) => (
        <button
          key={obj.id}
          onClick={() => onSelect(obj.title)}
          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <AtSign className={cn("h-3.5 w-3.5 shrink-0", LEVEL_COLOR[obj.level] ?? "text-muted-foreground")} />
          <span className="truncate">{obj.title}</span>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{obj.level}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const t = useTranslations("pages.aiAssistant");
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: convLoading } = useConversations();
  const { data: activeCycle } = useActiveCycle();
  const { data: objectives = [] } = useObjectives(activeCycle?.id);
  const advisor = useStrategyAdvisor();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, advisor.isPending]);

  function startNewConversation() {
    setMessages([]);
    setConversationId(null);
    setActiveHistoryId(null);
  }

  function handleSelectConversation(id: string) {
    setActiveHistoryId(id);
    setMessages([]);
    setConversationId(id);
  }

  function handleActionClick(action: string) {
    const route = ACTION_ROUTES[action];
    if (route) {
      router.push(route);
    } else {
      // Send as a follow-up message
      setInput(action);
      textareaRef.current?.focus();
    }
  }

  function handleMentionSelect(title: string) {
    const cursorPos = textareaRef.current?.selectionStart ?? input.length;
    const atPos = input.lastIndexOf("@", cursorPos);
    const newInput = input.slice(0, atPos) + `@${title} ` + input.slice(cursorPos);
    setInput(newInput);
    setMentionQuery(null);
    textareaRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);

    // Detect @ mention trigger
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || advisor.isPending) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setMentionQuery(null);

    try {
      const res: StrategyAdvisorResponse = await advisor.mutateAsync({
        message: text,
        conversation_id: conversationId ?? undefined,
      });
      setConversationId(res.conversation_id);
      setActiveHistoryId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          sources: res.sources,
          suggested_actions: res.suggested_actions,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("errorMsg"),
        },
      ]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") { setMentionQuery(null); return; }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mentionQuery !== null) return; // wait for mention selection
      handleSend();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeHistoryId}
        onSelect={handleSelectConversation}
        loading={convLoading}
      />

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b px-6 py-3 flex items-center justify-between">
          <PageHeader
            title={t("agentName")}
            description={t("agentDesc")}
            className="pb-0"
          />
          <Button variant="outline" size="sm" onClick={startNewConversation}>
            {t("newConversation")}
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-brand/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-brand" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{t("agentName")}</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {t("agentDesc")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {[
                  "¿Cuáles son los principales riesgos de este ciclo?",
                  "¿Cómo podemos mejorar la alineación de equipos?",
                  "Analiza el progreso de nuestros OKRs de empresa",
                  "¿Qué debería priorizar esta semana?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="text-left text-xs text-muted-foreground border rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} onActionClick={handleActionClick} />
          ))}

          {advisor.isPending && <TypingIndicator />}

          {advisor.isError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {t("errorMsg")}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t px-6 py-4 bg-background">
          <div className="relative flex items-end gap-2">
            {/* @ mention dropdown */}
            {mentionQuery !== null && (
              <MentionDropdown
                query={mentionQuery}
                objectives={objectives as Array<{ id: string; title: string; level: string }>}
                onSelect={handleMentionSelect}
              />
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-muted/40 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring max-h-32 overflow-y-auto"
              style={{ minHeight: "2.75rem" }}
              disabled={advisor.isPending}
              aria-label={t("placeholder")}
            />
            <Button
              size="icon"
              className="rounded-xl h-11 w-11 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || advisor.isPending}
              aria-label={t("sendBtn")}
            >
              {advisor.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
