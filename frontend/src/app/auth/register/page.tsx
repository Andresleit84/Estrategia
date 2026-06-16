"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/60 focus:ring-indigo-500/20 h-11";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("auth.register");
  const [form, setForm] = useState({ orgName: "", orgSlug: "", email: "", password: "", name: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (field === "orgName") {
          next.orgSlug = value
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .slice(0, 50);
        }
        return next;
      });
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.register({ ...form, orgMode: "AGILE" });
      router.push("/onboarding");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("defaultError")));
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
        {/* Org section */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest"
             style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("sectionOrg")}
          </p>

          <div className="space-y-1.5">
            <label htmlFor="orgName" className="text-sm font-medium text-white/70">{t("orgNameLabel")}</label>
            <Input
              id="orgName" required value={form.orgName} onChange={set("orgName")}
              placeholder={t("orgNamePlaceholder")} className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="orgSlug" className="text-sm font-medium text-white/70">
              {t("slugLabel")}{" "}
              <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>{t("slugHint")}</span>
            </label>
            <Input
              id="orgSlug" required value={form.orgSlug} onChange={set("orgSlug")}
              placeholder={t("slugPlaceholder")} pattern="[a-z0-9-]+"
              title={t("slugValidation")} className={inputCls}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }} />

        {/* Admin section */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest"
             style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("sectionAdmin")}
          </p>

          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-white/70">{t("nameLabel")}</label>
            <Input id="name" required value={form.name} onChange={set("name")}
                   placeholder={t("namePlaceholder")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-white/70">{t("emailLabel")}</label>
            <Input id="email" type="email" autoComplete="email" required
                   value={form.email} onChange={set("email")}
                   placeholder={t("emailPlaceholder")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-white/70">{t("passwordLabel")}</label>
            <div className="relative">
              <Input id="password" type={showPass ? "text" : "password"} autoComplete="new-password" required
                     minLength={8} value={form.password} onChange={set("password")}
                     placeholder={t("passwordPlaceholder")} className={`${inputCls} pr-10`} />
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
        </div>

        {/* Terms acceptance */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/20 bg-white/5 accent-indigo-500 cursor-pointer"
          />
          <span className="text-sm leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
            {t("termsPrefix")}{" "}
            <Link href="/terms" target="_blank" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              {t("termsLink")}
            </Link>
            {" "}{t("termsMid")}{" "}
            <Link href="/privacy" target="_blank" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              {t("privacyLink")}
            </Link>
          </span>
        </label>

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
          className="w-full h-11 text-sm font-semibold text-white gap-2 group"
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

      <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
        {t("hasAccount")}{" "}
        <Link href="/auth/login"
              className="font-medium transition-colors hover:text-indigo-300"
              style={{ color: "#818cf8" }}>
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
