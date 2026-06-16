"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react";

interface InviteInfo {
  email: string;
  org_name: string;
  role: string;
  expires_at: string;
}

function AcceptInvitationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); }, []);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoadingInfo(false); return; }
    api.get<InviteInfo>(`/auth/invitation?token=${token}`)
      .then(data => { setInfo(data); setLoadingInfo(false); })
      .catch(() => { setInvalid(true); setLoadingInfo(false); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/accept-invitation", { token, name, password });
      setDone(true);
      redirectTimerRef.current = setTimeout(() => router.push("/welcome"), 2000);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Error al aceptar la invitación"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInfo) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando invitación...</span>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="text-center space-y-4 py-8">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Invitación inválida o expirada</h2>
        <p className="text-sm text-muted-foreground">
          Este enlace ya no es válido. Pedile a tu administrador que te envíe una nueva invitación.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-8">
        <CheckCircle className="h-12 w-12 text-okr-on-track mx-auto" />
        <h2 className="text-xl font-semibold">¡Bienvenido a {info?.org_name}!</h2>
        <p className="text-sm text-muted-foreground">Redirigiendo al dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Acepta tu invitación</h1>
        <p className="text-sm text-muted-foreground">
          Te invitaron a unirte a <strong>{info?.org_name}</strong> como <strong>{info?.role === "ADMIN" ? "Administrador" : "Miembro"}</strong>.
        </p>
        <p className="text-xs text-muted-foreground">Cuenta: {info?.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tu nombre completo</label>
          <Input
            required
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre Apellido"
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Elegí una contraseña</label>
          <div className="relative">
            <Input
              required
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

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Activando cuenta...</> : "Activar mi cuenta"}
        </Button>
      </form>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    }>
      <AcceptInvitationForm />
    </Suspense>
  );
}
