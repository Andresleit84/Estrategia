"use client";

import { useState, useEffect, useMemo } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import { Search, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useCreateBacklogItem, useUpdateBacklogItem,
  type BacklogItem, type BacklogType, type BacklogPriority, type BacklogStatus,
} from "@/hooks/useBacklog";
import {
  TYPE_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, STORY_POINTS,
  getBacklogTemplate, getAcTemplate, isBlankTemplate, isBlankAcTemplate,
  BACKLOG_AC_HINTS,
} from "./backlog-config";

// ── TypeBadge (shared UI atom) ─────────────────────────────────────────────────

export function TypeBadge({ type }: { type: BacklogType }) {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded", cfg.bg, cfg.color)}>
      <Icon className="h-2.5 w-2.5" />{cfg.label}
    </span>
  );
}

// ── Dialog ─────────────────────────────────────────────────────────────────────

interface BacklogItemDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: BacklogItem | null;
  defaultType?: BacklogType;
  defaultParent?: BacklogItem | null;
  initiatives: any[];
  allItems: BacklogItem[];
  cycleId?: string;
}

export function BacklogItemDialog({
  open, onClose, editing, defaultType, defaultParent, initiatives, allItems, cycleId,
}: BacklogItemDialogProps) {
  const create = useCreateBacklogItem();
  const update = useUpdateBacklogItem();
  const [parentSearch, setParentSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentType = (editing?.type ?? defaultType ?? "EPIC") as BacklogType;

  const [form, setForm] = useState({
    type:                currentType,
    title:               editing?.title ?? "",
    description:         editing?.description ?? getBacklogTemplate(currentType),
    acceptance_criteria: editing?.acceptance_criteria ?? getAcTemplate(currentType),
    priority:            (editing?.priority ?? "MEDIUM") as BacklogPriority,
    story_points:        editing?.story_points?.toString() ?? "",
    parent_id:           editing?.parent_id ?? defaultParent?.id ?? "",
    initiative_id:       editing?.initiative_id ?? "",
    status:              (editing?.status ?? "OPEN") as BacklogStatus,
  });

  useEffect(() => {
    if (open) {
      const t = (editing?.type ?? defaultType ?? "EPIC") as BacklogType;
      setForm({
        type:                t,
        title:               editing?.title ?? "",
        description:         editing?.description ?? getBacklogTemplate(t),
        acceptance_criteria: editing?.acceptance_criteria ?? getAcTemplate(t),
        priority:            (editing?.priority ?? "MEDIUM") as BacklogPriority,
        story_points:        editing?.story_points?.toString() ?? "",
        parent_id:           editing?.parent_id ?? defaultParent?.id ?? "",
        initiative_id:       editing?.initiative_id ?? "",
        status:              (editing?.status ?? "OPEN") as BacklogStatus,
      });
      setError(null);
      setParentSearch("");
    }
  }, [open, editing?.id]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));
  }

  const eligibleParents = useMemo(() => {
    const pq = parentSearch.toLowerCase();
    if (form.type === "EPIC") return [];
    const parentType = form.type === "FEATURE" ? "EPIC" : ["EPIC", "FEATURE"];
    return allItems
      .filter(i => (Array.isArray(parentType) ? parentType.includes(i.type) : i.type === parentType) && i.id !== editing?.id)
      .filter(i => !pq || i.title.toLowerCase().includes(pq));
  }, [allItems, form.type, parentSearch, editing?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      ...(!editing && { type: form.type }),
      title:               form.title,
      description:         isBlankTemplate(form.description, form.type) ? undefined : form.description.trim(),
      acceptance_criteria: isBlankAcTemplate(form.acceptance_criteria, form.type) ? undefined : form.acceptance_criteria.trim(),
      priority:            form.priority,
      story_points:        form.story_points ? parseInt(form.story_points) : undefined,
      parent_id:           form.parent_id    || null,
      initiative_id:       form.initiative_id || null,
      cycle_id:            cycleId,
      ...(editing && { status: form.status }),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
      } else {
        await create.mutateAsync(payload as any);
      }
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Error al guardar"));
    }
  }

  const isPending = create.isPending || update.isPending;
  const typeLabel = TYPE_CONFIG[form.type]?.label ?? form.type;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${typeLabel}` : `Nueva ${typeLabel}`}</DialogTitle>
          {defaultParent && (
            <DialogDescription className="flex items-center gap-1.5 text-xs">
              <Link2 className="h-3 w-3" />
              Dentro de: <span className="font-mono text-[10px] font-semibold">{defaultParent.code}</span> <span className="font-medium">{defaultParent.title}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-0.5">

            {/* Type selector (create only) */}
            {!editing && !defaultType && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo</label>
                <div className="flex gap-2">
                  {(["EPIC", "FEATURE", "STORY"] as BacklogType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const Icon = cfg.Icon;
                    return (
                      <button
                        key={t} type="button"
                        onClick={() => setForm(p => ({
                          ...p, type: t, parent_id: "",
                          description: isBlankTemplate(p.description, p.type) ? getBacklogTemplate(t) : p.description,
                          acceptance_criteria: isBlankAcTemplate(p.acceptance_criteria, p.type) ? getAcTemplate(t) : p.acceptance_criteria,
                        }))}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-all",
                          form.type === t ? `border-primary ${cfg.bg} ${cfg.color}` : "border-border/60 text-muted-foreground hover:bg-muted/40",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título *</label>
              <Input required autoFocus value={form.title} onChange={set("title")} placeholder={`Título de la ${typeLabel.toLowerCase()}…`} />
            </div>

            {/* Priority + Points */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prioridad</label>
                <Select value={form.priority} onChange={set("priority")}>
                  {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as BacklogPriority[]).map(p => (
                    <SelectOption key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectOption>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Story points</label>
                <Select value={form.story_points} onChange={set("story_points")}>
                  <SelectOption value="">Sin estimar</SelectOption>
                  {STORY_POINTS.map(n => <SelectOption key={n} value={String(n)}>{n}</SelectOption>)}
                </Select>
              </div>
            </div>

            {/* Status (edit only) */}
            {editing && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Estado</label>
                <Select value={form.status} onChange={set("status")}>
                  {(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as BacklogStatus[]).map(s => (
                    <SelectOption key={s} value={s}>{STATUS_CONFIG[s].label}</SelectOption>
                  ))}
                </Select>
              </div>
            )}

            {/* Parent picker */}
            {form.type !== "EPIC" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {form.type === "FEATURE" ? "Épica padre" : "Feature / Épica padre"}
                  <span className="text-muted-foreground font-normal"> *</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input value={parentSearch} onChange={e => setParentSearch(e.target.value)} placeholder="Buscar…" className="pl-8 h-8 text-xs" />
                </div>
                <div className="rounded-xl border divide-y bg-card max-h-40 overflow-y-auto">
                  <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                    <input type="radio" name="parent_id" value="" checked={!form.parent_id} onChange={() => setForm(p => ({ ...p, parent_id: "" }))} className="shrink-0" />
                    <span className="text-sm text-muted-foreground">Sin padre</span>
                  </label>
                  {eligibleParents.map(o => (
                    <label key={o.id} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                      <input type="radio" name="parent_id" value={o.id} checked={form.parent_id === o.id} onChange={() => setForm(p => ({ ...p, parent_id: o.id }))} className="shrink-0" />
                      <TypeBadge type={o.type} />
                      {o.code && <span className="text-[10px] font-mono font-semibold text-muted-foreground shrink-0">{o.code}</span>}
                      <span className="text-xs flex-1 truncate">{o.title}</span>
                    </label>
                  ))}
                  {eligibleParents.length === 0 && parentSearch && (
                    <p className="px-3 py-3 text-xs text-muted-foreground text-center">Sin resultados</p>
                  )}
                </div>
              </div>
            )}

            {/* Initiative link */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Iniciativa vinculada <span className="text-muted-foreground font-normal">(trazabilidad)</span>
              </label>
              <Select value={form.initiative_id} onChange={set("initiative_id")}>
                <SelectOption value="">Sin iniciativa</SelectOption>
                {initiatives.map((i: any) => (
                  <SelectOption key={i.id} value={i.id}>{i.code ? `${i.code} — ${i.title}` : i.title}</SelectOption>
                ))}
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descripción</label>
              {form.type === "STORY"   && <p className="text-xs text-muted-foreground -mt-1"><strong>Como</strong> (rol) · <strong>Quiero</strong> (acción) · <strong>Para</strong> (beneficio)</p>}
              {form.type === "FEATURE" && <p className="text-xs text-muted-foreground -mt-1"><strong>Capacidad</strong> · <strong>Comportamiento</strong> · <strong>Dependencias</strong></p>}
              {form.type === "EPIC"    && <p className="text-xs text-muted-foreground -mt-1"><strong>Como</strong> (stakeholder) · <strong>Necesito</strong> (capacidad) · <strong>Para</strong> (objetivo)</p>}
              <Textarea value={form.description} onChange={set("description")} rows={4} className="font-mono text-sm" />
            </div>

            {/* Acceptance criteria */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Criterios de aceptación</label>
              <p className="text-xs text-muted-foreground -mt-1">{BACKLOG_AC_HINTS[form.type]}</p>
              <Textarea value={form.acceptance_criteria} onChange={set("acceptance_criteria")} rows={4} className="font-mono text-sm" />
            </div>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter className="pt-4 border-t mt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !form.title.trim()}>
              {isPending ? "Guardando..." : editing ? "Guardar cambios" : `Crear ${typeLabel.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
