"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { CheckCircle, XCircle, Loader2, Eye, EyeOff, Lock } from "lucide-react";

interface TokenInfo {
  email: string;
  name: string;
  expires_at: string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    api.get<TokenInfo>(`/auth/reset-password?token=${token}`)
      .then(data => { setInfo(data); setLoading(false); })
      .catch(() => { setInvalid(true); setLoading(false); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (password.length < 8) { setError("Mínimo 8 caracteres"); return; }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setDone(true);
      timerRef.current = setTimeout(() => router.push("/welcome"), 2500);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "El enlace ya expiró o fue utilizado. Solicitá uno nuevo."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando enlace...</span>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="text-center space-y-4 py-8">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Enlace inválido o expirado</h2>
        <p className="text-sm text-muted-foreground">
          Este enlace ya no es válido. Pedile a tu administrador que genere uno nuevo.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-8">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
        <h2 className="text-xl font-semibold">¡Contraseña actualizada!</h2>
        <p className="text-sm text-muted-foreground">Redirigiendo al dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
        <p className="text-sm text-muted-foreground">
          Hola <strong>{info?.name}</strong>, elegí tu nueva contraseña.
        </p>
        <p className="text-xs text-muted-foreground">{info?.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nueva contraseña</label>
          <div className="relative">
            <Input
              required
              autoFocus
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Confirmar contraseña</label>
          <Input
            required
            type={showPass ? "text" : "password"}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repetí tu contraseña"
            minLength={8}
          />
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting || !password || !confirm}>
          {submitting
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
            : "Guardar nueva contraseña"}
        </Button>
      </form>
    </div>
  );
}
