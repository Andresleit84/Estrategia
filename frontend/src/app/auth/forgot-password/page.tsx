"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { CheckCircle, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      setError("Ocurrió un error. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-green-400" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Revisa tu correo</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Si <strong className="text-white/70">{email}</strong> está registrado, recibirás un enlace
            para restablecer tu contraseña en los próximos minutos.
          </p>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          El enlace expira en 2 horas. Revisa también tu carpeta de spam.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-indigo-300 mt-2"
          style={{ color: "#818cf8" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-8 space-y-6"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 0 60px rgba(99,102,241,0.08)",
      }}
    >
      <div className="space-y-1 text-center">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-indigo-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">¿Olvidaste tu contraseña?</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.42)" }}>
          Ingresa tu email y te enviaremos un enlace para restablecerla.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-white/70">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/60 focus:ring-indigo-500/20 h-11"
          />
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}
            role="alert"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold text-white mt-2"
          disabled={loading || !email}
          style={{
            background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            border: "none",
            boxShadow: loading ? "none" : "0 0 30px rgba(99,102,241,0.35)",
          }}
        >
          {loading ? "Enviando..." : "Enviar enlace de recuperación"}
        </Button>
      </form>

      <p className="text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-indigo-300"
          style={{ color: "rgba(255,255,255,0.42)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
