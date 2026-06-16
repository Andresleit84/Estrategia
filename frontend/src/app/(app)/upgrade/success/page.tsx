"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidate billing status and user session so plan shows updated
    queryClient.invalidateQueries({ queryKey: ["billing"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });

    const timer = setTimeout(() => router.push("/welcome"), 4000);
    return () => clearTimeout(timer);
  }, [queryClient, router]);

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">¡Bienvenido a Pro!</h1>
        <p className="text-muted-foreground">
          Tu suscripción fue activada exitosamente. Ahora tenés acceso completo a todas las funcionalidades.
        </p>
        {sessionId && (
          <p className="text-xs text-muted-foreground/60 font-mono">ref: {sessionId.slice(-8)}</p>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
        Redirigiendo al dashboard...
      </div>
    </div>
  );
}

export default function UpgradeSuccessPage() {
  return (
    <div className="p-6">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
