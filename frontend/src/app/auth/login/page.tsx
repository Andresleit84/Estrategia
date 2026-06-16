"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/auth";
import { getApiErrorMessage, isApiError } from "@/lib/api-client";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await authApi.login(email, password);
      router.push(user.role === "SECTOR_DIAGNOSTICS" ? "/sector-assessment" : "/welcome");
    } catch (err: unknown) {
      if (isApiError(err) && err.status >= 500) {
        setError("Ocurrió un error inesperado. Por favor intenta de nuevo en unos segundos.");
      } else {
        setError(getApiErrorMessage(err, t("invalidCredentials")));
      }
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.42)" }}>
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-white/70">
            {t("emailLabel")}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/60 focus:ring-indigo-500/20 h-11"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-white/70">
            {t("passwordLabel")}
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/60 focus:ring-indigo-500/20 h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "rgba(255,255,255,0.35)" }}
              tabIndex={-1}
              aria-label={showPass ? t("hidePassword") : t("showPassword")}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
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
          className="w-full h-11 text-sm font-semibold text-white gap-2 group mt-2"
          disabled={loading}
          style={{
            background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            border: "none",
            boxShadow: loading ? "none" : "0 0 30px rgba(99,102,241,0.35)",
          }}
        >
          {loading ? t("loading") : (
            <>
              {t("submit")}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3 text-center">
        <Link
          href="/auth/forgot-password"
          className="block text-sm transition-colors hover:text-indigo-300"
          style={{ color: "rgba(255,255,255,0.42)" }}
        >
          {t("forgotPassword")}
        </Link>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          {t("noAccount")}{" "}
          <Link href="/auth/register"
                className="font-medium transition-colors hover:text-indigo-300"
                style={{ color: "#818cf8" }}>
            {t("registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
