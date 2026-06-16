"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useDeliveryAdvisor } from "@/hooks/useAI";
import { Bot, Send, Sparkles, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div className={cn("max-w-[82%] space-y-1.5", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm",
          )}
        >
          {msg.content}
        </div>
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.sources.map((s, i) => (
              <span key={i} className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Suggested prompts ──────────────────────────────────────────────────────────

const QUICK_PROMPTS_PROGRAM = [
  "¿Qué entregables están en riesgo de incumplir su fecha?",
  "¿Qué falta para completar la primera fase?",
  "Sugiere criterios de aceptación para los entregables pendientes.",
  "¿Qué priorizo esta semana para avanzar más rápido?",
];

const QUICK_PROMPTS_PORTFOLIO = [
  "¿Qué programas están en mayor riesgo?",
  "¿Qué entregables vencen esta semana en todos los programas?",
  "¿Cuál programa necesita más atención ahora mismo?",
  "Dame un resumen del estado de todos los programas.",
];

// ── Main component ─────────────────────────────────────────────────────────────

interface DeliveryAiChatProps {
  open: boolean;
  onClose: () => void;
  programId?: string;
  programName: string;
}

export function DeliveryAiChat({ open, onClose, programId, programName }: DeliveryAiChatProps) {
  const [messages,       setMessages]      = useState<Message[]>([]);
  const [input,          setInput]         = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const advisor = useDeliveryAdvisor();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, advisor.isPending]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const welcomeContent = programId
        ? `Hola! Soy tu Delivery Coach para **${programName}**.\n\nConozco el estado de todas tus fases y entregables. Puedo ayudarte a:\n• Identificar riesgos y blockers\n• Priorizar tareas\n• Revisar criterios de aceptación\n• Planificar cierres de fase\n\n¿En qué te ayudo hoy?`
        : `Hola! Soy tu Delivery Coach.\n\nConozco el estado de todos tus programas de entrega. Puedo ayudarte a:\n• Revisar qué programas están en riesgo\n• Identificar entregables vencidos o bloqueados\n• Priorizar esfuerzo entre programas\n• Orientarte sobre gestión de fases y criterios de aceptación\n\n¿En qué te ayudo hoy?`;
      setMessages([{ role: "assistant", content: welcomeContent, sources: [] }]);
    }
  }, [open, programName, messages.length]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || advisor.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const res = await advisor.mutateAsync({
        ...(programId ? { program_id: programId } : {}),
        message: trimmed,
        conversation_id: conversationId ?? undefined,
      });
      setConversationId(res.conversation_id);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: res.reply,
        sources: res.sources,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Ocurrió un error al procesar tu mensaje. Intenta de nuevo.",
      }]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function reset() {
    setMessages([]);
    setConversationId(null);
    setInput("");
  }

  return (
    <>
      {/* Chat dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden flex flex-col" style={{ height: "min(680px, 90vh)" }}>
          {/* Header */}
          <DialogHeader className="shrink-0 px-4 py-3 border-b bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold">Delivery Coach</DialogTitle>
                <DialogDescription className="text-[10px] text-muted-foreground truncate">
                  Asistente IA · {programName}
                </DialogDescription>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {messages.length > 1 && (
                  <button
                    onClick={reset}
                    className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground"
                    title="Nueva conversación"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {advisor.isPending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts (only when no user messages yet) */}
          {messages.length <= 1 && !advisor.isPending && (
            <div className="shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
              {(programId ? QUICK_PROMPTS_PROGRAM : QUICK_PROMPTS_PORTFOLIO).map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-xs border rounded-full px-3 py-1 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors bg-background"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 px-4 pb-4 pt-2 border-t bg-background">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta... (Enter para enviar)"
                rows={2}
                className="resize-none text-sm flex-1 min-h-0"
                disabled={advisor.isPending}
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || advisor.isPending}
                className="h-10 w-10 shrink-0 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Powered by Claude · Shift+Enter para nueva línea
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
