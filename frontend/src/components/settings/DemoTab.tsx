"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMyOrgs } from "@/hooks/useAdmin";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Loader2, Database, Terminal, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SeedResult { success: boolean; output: string; lines: number }

type PendingAction = "seed" | "clean";

export function DemoTab() {
  const { data: orgs, isLoading } = useMyOrgs();
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>("seed");
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const qc = useQueryClient();
  const router = useRouter();

  const seed = useMutation({
    mutationFn: (organizationId: string) =>
      api.post<SeedResult>("/demo/seed", { organizationId }),
    onSuccess: (data) => {
      setResult(data);
      setShowConfirm(false);
      qc.invalidateQueries();
      router.refresh();
    },
    onError: () => { setShowConfirm(false); },
  });

  const clean = useMutation({
    mutationFn: (organizationId: string) =>
      api.post<{ success: boolean; message: string }>("/demo/clean", { organizationId }),
    onSuccess: (data) => {
      setResult(null);
      setShowConfirm(false);
      toast.success(data.message);
    },
    onError: (err) => {
      setShowConfirm(false);
      toast.error(getApiErrorMessage(err, "Error al limpiar la organización"));
    },
  });

  const isPending = seed.isPending || clean.isPending;
  const selectedOrg = orgs?.find(o => o.id === selectedOrgId);

  function handleConfirm() {
    if (pendingAction === "seed") seed.mutate(selectedOrgId);
    else clean.mutate(selectedOrgId);
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20">
          <h3 className="text-sm font-semibold">Cargar datos demo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Carga 3 años de historia OKR completa de Caja Cooprogreso para demostrar la plataforma.
            Los datos existentes en la organización seleccionada serán reemplazados.
          </p>
        </div>
        <div className="p-5 space-y-4">

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Esta acción es <strong>destructiva</strong>: borra todos los OKRs, ciclos, iniciativas
              y usuarios de la organización elegida, y los reemplaza con el dataset demo.
              Solo el propietario puede ejecutarla.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Organización destino</label>
            <Select
              value={selectedOrgId}
              onChange={e => { setSelectedOrgId(e.target.value); setResult(null); }}
            >
              <SelectOption value="">— Selecciona una organización —</SelectOption>
              {orgs?.map(o => (
                <SelectOption key={o.id} value={o.id}>{o.name}</SelectOption>
              ))}
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">Dataset: Caja Cooprogreso</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-none">
              <li>• Plan estratégico 3 años + ciclos anuales y trimestrales 2023–2025</li>
              <li>• Objetivos de empresa, área, equipo e individuales en árbol completo</li>
              <li>• 100+ Key Results con historial de check-ins realista</li>
              <li>• 14 iniciativas vinculadas a KRs</li>
              <li>• Sprints, épicas, features e historias de usuario</li>
              <li>• 6 usuarios demo con roles variados</li>
            </ul>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              disabled={!selectedOrgId || isPending}
              onClick={() => { setPendingAction("seed"); setShowConfirm(true); }}
              variant="destructive"
              className="gap-2"
            >
              <Database className="h-4 w-4" />
              Cargar datos demo
            </Button>
            <Button
              disabled={!selectedOrgId || isPending}
              onClick={() => { setPendingAction("clean"); setShowConfirm(true); }}
              variant="outline"
              className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/5 dark:border-destructive/40"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar organización
            </Button>
          </div>
        </div>
      </Card>

      {seed.isError && (
        <Card className="border-destructive/30 p-4">
          <p className="text-sm text-destructive">
            {getApiErrorMessage(seed.error, "Error al cargar el demo")}
          </p>
        </Card>
      )}

      {result && (
        <Card className={`overflow-hidden border-2 ${result.success ? "border-green-500/30" : "border-destructive/30"}`}>
          <div className={`px-5 py-3 border-b flex items-center gap-2 ${result.success ? "bg-green-50 dark:bg-green-950/20" : "bg-destructive/10"}`}>
            {result.success ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Datos cargados correctamente en {selectedOrg?.name}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm font-semibold text-destructive">Error al cargar datos</span>
              </>
            )}
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">
                Output ({result.lines} líneas)
              </span>
            </div>
            <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">
              {result.output || "(sin salida)"}
            </pre>
          </div>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={open => !open && !isPending && setShowConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "seed"
                ? `¿Cargar datos demo en ${selectedOrg?.name}?`
                : `¿Limpiar todos los datos de ${selectedOrg?.name}?`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                {pendingAction === "seed" ? (
                  <>Se eliminarán <strong>todos los datos existentes</strong> de{" "}
                  <strong>{selectedOrg?.name}</strong> y serán reemplazados con el dataset demo.</>
                ) : (
                  <>Se eliminarán <strong>todos los OKRs, ciclos, iniciativas y usuarios</strong> de{" "}
                  <strong>{selectedOrg?.name}</strong>. La organización quedará en blanco.</>
                )}{" "}
                Esta acción no se puede deshacer.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingAction === "seed"
                ? "El proceso puede tardar hasta 30 segundos. No cierres esta ventana mientras se ejecuta."
                : "La limpieza tarda unos segundos."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleConfirm}
              className="gap-2 min-w-[160px]"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />
                  {pendingAction === "seed" ? "Cargando datos…" : "Limpiando…"}</>
              ) : (
                pendingAction === "seed" ? "Confirmar y cargar" : "Confirmar y limpiar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
