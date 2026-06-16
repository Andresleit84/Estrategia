"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, X, Building2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateInitiative, useUpdateInitiative, useLinkKr, useUnlinkKr, useSetInitiativeAreas, type Initiative } from "@/hooks/useInitiatives";
import { useCadenceDashboard } from "@/hooks/useCheckIns";
import { useActiveCycle } from "@/hooks/useCycles";
import { useAreas } from "@/hooks/useAreas";

interface PrefillValues {
  title?: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  primary_area?: string | null;
  involved_areas?: string[];
  suggested_dependencies?: { description: string; type: string }[];
}

interface InitiativeFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Initiative | null;
  defaultCycleId?: string;
  defaultTeamId?: string;
  prefillValues?: PrefillValues;
}

const INI_TEMPLATE = `Problema que resuelve:\n\nAlcance (qué incluye / qué no):\n\nCriterio de éxito:\n\nDependencias:`;

export function InitiativeForm({
  open,
  onOpenChange,
  editing,
  defaultCycleId,
  defaultTeamId,
  prefillValues,
}: InitiativeFormProps) {
  const { data: cycle } = useActiveCycle();
  const { data: cadenceRaw = [] } = useCadenceDashboard(cycle?.id ?? null);
  const { data: areas = [] } = useAreas();
  const allKrs = (cadenceRaw as any[]).map((k: any) => ({
    id: k.kr_id,
    code: k.kr_code,
    title: k.kr_title,
    progress: k.progress,
  }));

  const [title, setTitle]             = useState("");
  const [description, setDesc]        = useState(INI_TEMPLATE);
  const [startDate, setStart]         = useState("");
  const [dueDate, setDue]             = useState("");
  const [krSearch, setKrSearch]       = useState("");
  const [selectedKrs, setKrs]         = useState<string[]>([]);
  const [primaryArea, setPrimaryArea] = useState<string>("");
  const [involvedAreas, setInvolved]  = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? prefillValues?.title ?? "");
      setDesc(editing?.description ?? prefillValues?.description ?? INI_TEMPLATE);
      setStart(editing?.start_date?.slice(0, 10) ?? prefillValues?.start_date ?? "");
      setDue(editing?.due_date?.slice(0, 10) ?? prefillValues?.due_date ?? "");
      setKrs(editing?.key_results?.map((k) => k.id) ?? []);
      setKrSearch("");
      // Areas: from editing or AI prefill
      const pAreaId = editing?.primary_area_id
        ?? (prefillValues?.primary_area
            ? areas.find((a) => a.name === prefillValues.primary_area)?.id
            : undefined) ?? "";
      setPrimaryArea(pAreaId);
      const invIds = editing?.involved_areas?.filter((a) => !a.is_primary).map((a) => a.id)
        ?? (prefillValues?.involved_areas?.map((name) => areas.find((a) => a.name === name)?.id).filter(Boolean) as string[])
        ?? [];
      setInvolved(invIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, prefillValues?.title]);

  const createInit = useCreateInitiative();
  const updateInit = useUpdateInitiative();
  const setAreas   = useSetInitiativeAreas();
  const linkKr     = useLinkKr();
  const unlinkKr   = useUnlinkKr();
  const loading    = createInit.isPending || updateInit.isPending || setAreas.isPending || linkKr.isPending || unlinkKr.isPending;

  const filteredKrs = allKrs.filter((kr: any) =>
    !krSearch || kr.title.toLowerCase().includes(krSearch.toLowerCase())
  );

  function toggleKr(id: string) {
    setKrs((prev) => prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]);
  }

  const isDescUnchanged = description.trim() === INI_TEMPLATE.trim() || !description.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const descToSave = isDescUnchanged ? undefined : description.trim();

    const allAreaIds = new Set<string>();
    if (primaryArea) allAreaIds.add(primaryArea);
    for (const id of involvedAreas) allAreaIds.add(id);

    try {
      if (editing) {
        await updateInit.mutateAsync({
          id: editing.id,
          title: title.trim(),
          description: descToSave,
          start_date: startDate || undefined,
          due_date: dueDate || undefined,
        });
        // Sync areas
        const involvedWithoutPrimary = involvedAreas.filter((id) => id !== primaryArea);
        await setAreas.mutateAsync({
          id: editing.id,
          primary_area_id: primaryArea || undefined,
          involved_area_ids: involvedWithoutPrimary.length ? involvedWithoutPrimary : undefined,
        });
        // Diff KR links: add new ones, remove unselected
        const originalIds = editing.key_results?.map((k) => k.id) ?? [];
        const toLink   = selectedKrs.filter((id) => !originalIds.includes(id));
        const toUnlink = originalIds.filter((id) => !selectedKrs.includes(id));
        await Promise.all([
          ...toLink.map((krId)   => linkKr.mutateAsync({ initiativeId: editing.id, krId })),
          ...toUnlink.map((krId) => unlinkKr.mutateAsync({ initiativeId: editing.id, krId })),
        ]);
        toast.success("Iniciativa actualizada");
      } else {
        await createInit.mutateAsync({
          title: title.trim(),
          description: descToSave,
          cycle_id: defaultCycleId ?? cycle?.id,
          team_id: defaultTeamId,
          start_date: startDate || undefined,
          due_date: dueDate || undefined,
          kr_ids: selectedKrs.length ? selectedKrs : undefined,
          primary_area_id: primaryArea || undefined,
          involved_area_ids: allAreaIds.size > 0 ? Array.from(allAreaIds) : undefined,
        });
        toast.success("Iniciativa creada");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la iniciativa");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar iniciativa" : "Nueva iniciativa"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Modifica los datos de la iniciativa."
              : "Define un proyecto concreto vinculado a los KRs del ciclo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-5 py-1 pr-0.5">

            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="¿Qué proyecto vamos a ejecutar?"
                required
                minLength={3}
                autoFocus
              />
            </div>

            {/* Descripción estructurada */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Descripción</label>
              <p className="text-xs text-muted-foreground">
                <strong>Problema que resuelve</strong> (brecha u oportunidad) ·{" "}
                <strong>Alcance</strong> (qué incluye y qué no) ·{" "}
                <strong>Criterio de éxito</strong> (cómo mediremos el cierre) ·{" "}
                <strong>Dependencias</strong> (qué debe estar listo antes)
              </p>
              <textarea
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fecha inicio</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fecha límite</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDue(e.target.value)}
                />
              </div>
            </div>

            {/* Áreas */}
            {areas.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Áreas involucradas
                </label>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Área principal responsable</label>
                  <select
                    value={primaryArea}
                    onChange={(e) => setPrimaryArea(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sin área principal</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Áreas adicionales involucradas</label>
                  <div className="flex flex-wrap gap-1.5">
                    {areas.filter((a) => a.id !== primaryArea).map((a) => {
                      const selected = involvedAreas.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setInvolved((prev) =>
                            prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                          )}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                            selected
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                          {a.name}
                          {selected && <X className="h-2.5 w-2.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* KRs vinculados — disponible en creación y edición */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">KRs vinculados</label>
              <Input
                value={krSearch}
                onChange={(e) => setKrSearch(e.target.value)}
                placeholder="Buscar KR…"
              />
              {selectedKrs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedKrs.map((id) => {
                    const kr = allKrs.find((k: any) => k.id === id);
                    return kr ? (
                      <span
                        key={id}
                        className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                      >
                        {kr.code ? `${kr.code} — ` : ""}{kr.title.length > 30 ? kr.title.slice(0, 30) + "…" : kr.title}
                        <button
                          type="button"
                          onClick={() => toggleKr(id)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              <div className="max-h-36 overflow-y-auto border rounded-md divide-y">
                {filteredKrs.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground text-center">
                    Sin KRs disponibles en el ciclo activo
                  </p>
                ) : (
                  filteredKrs.slice(0, 20).map((kr: any) => (
                    <label
                      key={kr.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedKrs.includes(kr.id)}
                        onChange={() => toggleKr(kr.id)}
                        className="rounded"
                      />
                      {kr.code && <span className="font-mono text-[10px] font-semibold text-muted-foreground shrink-0">{kr.code}</span>}
                      <span className="flex-1 truncate">{kr.title}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {Math.round(kr.progress)}%
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Botones fijos abajo */}
          <div className="flex gap-2 pt-3 border-t mt-2 shrink-0">
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Guardar cambios" : "Crear iniciativa"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
