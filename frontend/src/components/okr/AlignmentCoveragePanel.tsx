"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, Building2, Users, User,
  AlertCircle, Sparkles, Loader2, Check, Network, Link2, Plus,
  Pencil, Unlink, ExternalLink, RefreshCw,
} from "lucide-react";
import {
  useAlignmentMap,
  useCreateObjective,
  useObjectives,
  useUpdateObjective,
  type AlignmentMapEntry,
  type AlignmentAreaNode,
} from "@/hooks/useObjectives";
import { useCreateKeyResult } from "@/hooks/useKeyResults";
import { useSuggestTeamOkrs, type TeamOkrGapSuggestion } from "@/hooks/useAI";
import { useAreas } from "@/hooks/useAreas";
import { useTeams } from "@/hooks/useTeams";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Semáforo con etiqueta ────────────────────────────────────────────────────

function StatusBadge({ hasTeams, hasAreas }: { hasTeams: boolean; hasAreas: boolean }) {
  if (hasTeams) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
        Con equipos
      </span>
    );
  }
  if (hasAreas) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        Solo área
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full shrink-0">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
      Sin cobertura
    </span>
  );
}

function SemaphoreLegend() {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground flex-wrap">
      <span className="font-semibold text-foreground shrink-0">Semáforo:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
        <strong className="text-foreground">Con equipos</strong> — hay objetivos de equipo alineados
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
        <strong className="text-foreground">Solo área</strong> — hay objetivos de área pero ningún equipo los recoge
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
        <strong className="text-foreground">Sin cobertura</strong> — ningún objetivo de área ni equipo está alineado
      </span>
    </div>
  );
}

// ── MiniProgress ─────────────────────────────────────────────────────────────

function MiniProgress({ value }: { value: number }) {
  const color =
    value >= 70 ? "bg-green-500" :
    value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="h-1 w-10 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">{value}%</span>
    </div>
  );
}

// ── AreaSubtree ───────────────────────────────────────────────────────────────

// Fila editable con acciones (editar título / desvincular)
function ObjRow({
  id,
  title,
  progress,
  owner,
  color,
  Icon,
  indent = false,
  onRefetch,
}: {
  id: string;
  title: string;
  progress: number;
  owner?: string | null;
  color: string;
  Icon: React.ElementType;
  indent?: boolean;
  onRefetch: () => void;
}) {
  const updateObj = useUpdateObjective();
  const [editing,   setEditing]   = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [saving,    setSaving]    = useState(false);

  async function handleSaveTitle() {
    if (!editTitle.trim() || editTitle === title) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateObj.mutateAsync({ id, title: editTitle.trim() });
      onRefetch();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function handleDetach() {
    setSaving(true);
    try {
      await updateObj.mutateAsync({ id, parent_objective_id: null });
      onRefetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("group flex items-center gap-2 py-1 rounded px-2 hover:bg-muted/30", indent && "ml-4")}>
      <Icon className={cn("h-3 w-3 shrink-0", color)} />

      {editing ? (
        <input
          autoFocus
          className="flex-1 text-xs font-medium bg-transparent border-b border-primary outline-none min-w-0"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={e => {
            if (e.key === "Enter") handleSaveTitle();
            if (e.key === "Escape") { setEditing(false); setEditTitle(title); }
          }}
        />
      ) : (
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium truncate block">{title}</span>
          {owner && <span className="text-[10px] text-muted-foreground">{owner}</span>}
        </div>
      )}

      <MiniProgress value={Math.round(progress)} />

      {/* Acciones — solo visibles en hover */}
      {!editing && !saving && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => { setEditTitle(title); setEditing(true); }}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Editar nombre"
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={handleDetach}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Desvincular de este objetivo"
          >
            <Unlink className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
      {saving && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground shrink-0" />}
    </div>
  );
}

function AreaSubtree({ area, onRefetch }: { area: AlignmentAreaNode; onRefetch: () => void }) {
  return (
    <div className="space-y-0.5">
      <ObjRow
        id={area.id} title={area.title} progress={area.progress} owner={area.owner}
        color="text-blue-500" Icon={Users} onRefetch={onRefetch}
      />
      {area.team_objectives?.map((team) => (
        <div key={team.id} className="space-y-0.5">
          <ObjRow
            id={team.id} title={team.title} progress={team.progress}
            owner={team.team_name ?? team.owner ?? undefined}
            color="text-amber-500" Icon={Users} indent onRefetch={onRefetch}
          />
          {team.individual_objectives?.map((ind) => (
            <ObjRow
              key={ind.id} id={ind.id} title={ind.title} progress={ind.progress}
              owner={ind.owner ?? undefined}
              color="text-muted-foreground/60" Icon={User} indent onRefetch={onRefetch}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── AlignDialog (genérico para área o equipo) ─────────────────────────────────

// AlignDialog: primero elige el área/equipo organizacional, luego crea o vincula el OKR
function AlignDialog({
  level,
  parentObjId,
  parentObjLabel,
  cycleId,
  open,
  onClose,
  onAligned,
}: {
  level: "AREA" | "TEAM";
  parentObjId: string;
  parentObjLabel: string;
  cycleId: string;
  open: boolean;
  onClose: () => void;
  onAligned: () => void;
}) {
  const { data: areas  = [], refetch: refetchAreas  } = useAreas();
  const { data: teams  = [], refetch: refetchTeams  } = useTeams();
  const [refreshing, setRefreshing] = useState(false);
  const { data: allObjs = [], isPending: loadingObjs } = useObjectives(open ? cycleId : undefined, level);
  const updateObj = useUpdateObjective();
  const createObj = useCreateObjective();

  // Paso 1: elegir el área/equipo organizacional
  const [orgUnitId, setOrgUnitId] = useState("");
  // Paso 2: vincular existente o crear nuevo OKR
  const [mode,       setMode]      = useState<"pick" | "create">("pick");
  const [selectedId, setSelectedId] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [step,       setStep]       = useState<1 | 2>(1);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  // Reset al abrir
  React.useEffect(() => {
    if (open) { setOrgUnitId(""); setSelectedId(""); setQuickTitle(""); setStep(1); setError(""); setMode("pick"); }
  }, [open]);

  const orgUnits = level === "AREA"
    ? areas.map(a => ({ id: a.id, name: a.name, sub: a.description }))
    : teams.map(t => ({ id: t.id, name: t.name, sub: t.owner_name ? `Responsable: ${t.owner_name}` : null }));

  const candidates = allObjs.filter(o => o.status !== "CANCELLED");

  // Al avanzar al paso 2: si no hay candidatos, ir directo a "crear"
  function goToStep2() {
    setStep(2);
    setMode(candidates.length > 0 ? "pick" : "create");
  }

  async function handleAlign() {
    if (!selectedId) return;
    setSaving(true); setError("");
    try {
      await updateObj.mutateAsync({ id: selectedId, parent_objective_id: parentObjId });
      onAligned(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular. Inténtalo de nuevo.");
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!quickTitle.trim()) return;
    setSaving(true); setError("");
    try {
      await createObj.mutateAsync({
        title: quickTitle.trim(),
        level,
        cycle_id: cycleId,
        parent_objective_id: parentObjId,
      });
      onAligned(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear. Inténtalo de nuevo.");
      setSaving(false);
    }
  }

  const selectedUnit = orgUnits.find(u => u.id === orgUnitId);
  const isArea = level === "AREA";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            {isArea ? "Cubrir con un área" : "Cubrir con un equipo"}
          </DialogTitle>
          <DialogDescription>
            <span className="block text-xs text-muted-foreground">
              Objetivo de empresa: <strong className="text-foreground">{parentObjLabel}</strong>
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
            step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>1</span>
          <span className={step === 1 ? "text-foreground font-medium" : ""}>
            {isArea ? "¿Qué área lo cubrirá?" : "¿Qué equipo lo cubrirá?"}
          </span>
          <div className="flex-1 h-px bg-border" />
          <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>2</span>
          <span className={step === 2 ? "text-foreground font-medium" : ""}>OKR para esa {isArea ? "área" : "equipo"}</span>
        </div>

        {/* Paso 1: elegir área / equipo organizacional */}
        {step === 1 && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto py-1">
            {orgUnits.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 space-y-3">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  No hay {isArea ? "áreas" : "equipos"} configurados en esta organización.
                  {" "}Créalos en Configuración y luego vuelve aquí.
                </p>
                <div className="flex gap-2">
                  <a
                    href={isArea ? "/settings?tab=areas" : "/settings?tab=teams"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <ExternalLink className="h-3 w-3" />
                      Ir a Configuración (nueva pestaña)
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs"
                    disabled={refreshing}
                    onClick={async () => {
                      setRefreshing(true);
                      await (isArea ? refetchAreas() : refetchTeams());
                      setRefreshing(false);
                    }}
                  >
                    {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Ya los creé, actualizar
                  </Button>
                </div>
              </div>
            ) : (
              orgUnits.map(u => (
                <label key={u.id} className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  orgUnitId === u.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                )}>
                  <input type="radio" name="org_unit" value={u.id}
                    checked={orgUnitId === u.id}
                    onChange={() => setOrgUnitId(u.id)}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{u.name}</p>
                    {u.sub && <p className="text-[11px] text-muted-foreground truncate">{u.sub}</p>}
                  </div>
                </label>
              ))
            )}
          </div>
        )}

        {/* Paso 2: vincular OKR existente o crear uno */}
        {step === 2 && (
          <div className="space-y-3">
            {/* Contexto */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              {isArea ? "Área" : "Equipo"}: <strong>{selectedUnit?.name}</strong>
              {" → "}cubrirá: <strong>{parentObjLabel}</strong>
            </div>

            {/* Tabs si hay candidatos */}
            {!loadingObjs && candidates.length > 0 && (
              <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
                <button className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === "pick" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setMode("pick")}>
                  Vincular existente ({candidates.length})
                </button>
                <button className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === "create" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setMode("create")}>
                  Crear nuevo OKR
                </button>
              </div>
            )}

            {loadingObjs && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Vincular existente */}
            {!loadingObjs && mode === "pick" && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {candidates.map(o => (
                  <label key={o.id} className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                    selectedId === o.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  )}>
                    <input type="radio" name="align_obj" value={o.id}
                      checked={selectedId === o.id}
                      onChange={() => setSelectedId(o.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{o.title}</p>
                      {o.team_name && <p className="text-[10px] text-muted-foreground">{o.team_name}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Crear nuevo */}
            {!loadingObjs && mode === "create" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre del OKR para {selectedUnit?.name}</label>
                <Input
                  autoFocus
                  placeholder={isArea
                    ? `Ej: Optimizar procesos en ${selectedUnit?.name ?? "el área"}`
                    : `Ej: Mejorar eficiencia del ${selectedUnit?.name ?? "equipo"}`}
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !saving && quickTitle.trim() && handleCreate()}
                />
                <p className="text-[11px] text-muted-foreground">
                  Se creará vinculado automáticamente. Añade resultados clave desde la vista de OKRs.
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="ghost" onClick={() => setStep(1)} disabled={saving} className="mr-auto">
              ← Atrás
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {step === 1 && (
            <Button onClick={goToStep2} disabled={!orgUnitId || orgUnits.length === 0}>
              Siguiente →
            </Button>
          )}
          {step === 2 && mode === "pick" && (
            <Button onClick={handleAlign} disabled={!selectedId || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {saving ? "Vinculando…" : "Vincular OKR"}
            </Button>
          )}
          {step === 2 && mode === "create" && (
            <Button onClick={handleCreate} disabled={!quickTitle.trim() || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {saving ? "Creando…" : "Crear y vincular"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CoverageRow ───────────────────────────────────────────────────────────────

function CoverageRow({
  entry,
  cycleId,
  onRefetch,
}: {
  entry: AlignmentMapEntry;
  cycleId: string;
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [alignAreaOpen, setAlignAreaOpen] = useState(false);
  const [alignTeamOpen, setAlignTeamOpen] = useState(false);
  const hasAreas = entry.area_count > 0;
  const hasTeams = entry.team_count > 0;

  // Para alinear equipo, necesitamos el id del primer área bajo este objetivo
  const firstAreaId = entry.area_objectives?.[0]?.id ?? entry.company_obj_id;
  const firstAreaTitle = entry.area_objectives?.[0]?.title ?? entry.company_title;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          aria-expanded={expanded}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{entry.company_title}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StatusBadge hasTeams={hasTeams} hasAreas={hasAreas} />
              <MiniProgress value={Math.round(entry.company_progress)} />
              <span className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {hasAreas && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-blue-400 shrink-0" />
                    {entry.area_count === 1
                      ? <span className="truncate max-w-[160px]" title={entry.area_objectives[0]?.title}>
                          {entry.area_objectives[0]?.title ?? "1 área"}
                        </span>
                      : `${entry.area_count} áreas`}
                  </span>
                )}
                {hasTeams && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-amber-400 shrink-0" />
                    {entry.team_count === 1
                      ? <span className="truncate max-w-[140px]"
                          title={entry.area_objectives.flatMap(a => a.team_objectives).find(Boolean)?.title}>
                          {entry.area_objectives.flatMap(a => a.team_objectives).find(Boolean)?.title ?? "1 equipo"}
                        </span>
                      : `${entry.team_count} equipos`}
                  </span>
                )}
                {entry.individual_count > 0 && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {entry.individual_count} ind.
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {/* Botones de alineación según el estado */}
        {!hasTeams && !hasAreas && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 shrink-0"
            onClick={(e) => { e.stopPropagation(); setAlignAreaOpen(true); }}
            title="Asignar un área organizacional que cubra este objetivo"
          >
            <Link2 className="h-3 w-3" />
            Asignar área
          </Button>
        )}
        {hasAreas && !hasTeams && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 shrink-0 border-amber-300 dark:border-amber-600"
            onClick={(e) => { e.stopPropagation(); setAlignTeamOpen(true); }}
            title="Asignar un equipo que ejecute el objetivo del área"
          >
            <Link2 className="h-3 w-3" />
            Asignar equipo
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-t bg-muted/10 px-4 py-2 space-y-1">
          {entry.area_objectives?.length > 0 ? (
            entry.area_objectives.map((area) => (
              <AreaSubtree key={area.id} area={area} onRefetch={onRefetch} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-2 text-center">
              Sin objetivos de área vinculados a este objetivo.
            </p>
          )}
        </div>
      )}

      {/* Diálogo: alinear área → empresa */}
      {alignAreaOpen && (
        <AlignDialog
          level="AREA"
          parentObjId={entry.company_obj_id}
          parentObjLabel={entry.company_title}
          cycleId={cycleId}
          open={alignAreaOpen}
          onClose={() => setAlignAreaOpen(false)}
          onAligned={() => { onRefetch(); setExpanded(true); }}
        />
      )}

      {/* Diálogo: alinear equipo → área */}
      {alignTeamOpen && (
        <AlignDialog
          level="TEAM"
          parentObjId={firstAreaId}
          parentObjLabel={firstAreaTitle}
          cycleId={cycleId}
          open={alignTeamOpen}
          onClose={() => setAlignTeamOpen(false)}
          onAligned={() => { onRefetch(); setExpanded(true); }}
        />
      )}
    </div>
  );
}

// ── GapSuggestions ────────────────────────────────────────────────────────────

function GapSuggestions({
  suggestions,
  cycleId,
  onCreated,
}: {
  suggestions: TeamOkrGapSuggestion[];
  cycleId: string;
  onCreated: () => void;
}) {
  const createObjective = useCreateObjective();
  const createKr = useCreateKeyResult();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!suggestions.length) return null;

  async function handleCreate(gap: TeamOkrGapSuggestion, gapIdx: number, okrIdx: number) {
    const key = `${gapIdx}-${okrIdx}`;
    const okr = gap.team_okrs[okrIdx];
    if (!okr) return;

    setSaving(s => ({ ...s, [key]: true }));
    setErrors(e => ({ ...e, [key]: "" }));
    try {
      const created = await createObjective.mutateAsync({
        title: okr.title,
        description: okr.description || undefined,
        level: "AREA",
        cycle_id: cycleId,
        parent_objective_id: gap.company_obj_id ?? undefined,
      });
      const objId = (created as { id: string }).id;

      for (const kr of (okr.key_results ?? []).slice(0, 3)) {
        const krType = kr.type || "INCREASE";
        const rawTarget = Number(kr.target_value) || 0;
        const target = Math.max(1, Math.round(rawTarget || 10));
        const start = krType === "DECREASE"
          ? (kr.start_value != null && kr.start_value > target ? kr.start_value : target * 2)
          : (kr.start_value ?? 0);
        try {
          await createKr.mutateAsync({
            objId,
            title: kr.title,
            target_value: target,
            start_value: start,
            metric_unit: kr.metric_unit || undefined,
            type: krType,
          });
        } catch { /* KR failure is secondary — objective is already created */ }
      }

      setSaved(s => ({ ...s, [key]: true }));
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear el objetivo";
      setErrors(e => ({ ...e, [key]: msg }));
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        OKRs sugeridos para cubrir brechas
      </p>
      {suggestions.map((gap, gi) => (
        <div key={gi} className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-primary/10 bg-primary/10">
            <p className="text-xs font-medium text-primary truncate">
              Cubre brecha: {gap.company_title}
            </p>
          </div>
          <div className="px-4 py-2 space-y-3">
            {gap.team_okrs.map((okr, oi) => {
              const key = `${gi}-${oi}`;
              const isSaved = saved[key];
              const isSaving = saving[key];
              const errMsg = errors[key];
              return (
                <div key={oi} className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium leading-snug", isSaved && "text-muted-foreground line-through")}>
                        {okr.title}
                      </p>
                      {okr.rationale && (
                        <p className="text-xs text-muted-foreground mt-0.5">{okr.rationale}</p>
                      )}
                      <div className="space-y-0.5 mt-1.5">
                        {okr.key_results?.slice(0, 3).map((kr, ki) => (
                          <div key={ki} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                            <span className="truncate">{kr.title}</span>
                            <span className="shrink-0 tabular-nums text-[10px]">
                              {kr.start_value}→{kr.target_value} {kr.metric_unit}
                            </span>
                          </div>
                        ))}
                      </div>
                      {errMsg && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {errMsg}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 mt-0.5">
                      {isSaved ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Check className="h-3.5 w-3.5" />
                          Creado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={errMsg ? "destructive" : "outline"}
                          className="h-7 text-xs gap-1"
                          onClick={() => handleCreate(gap, gi, oi)}
                          disabled={isSaving}
                        >
                          {isSaving
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Plus className="h-3 w-3" />}
                          {isSaving ? "Creando…" : errMsg ? "Reintentar" : "Crear OKR"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

export function AlignmentCoveragePanel({ cycleId }: { cycleId: string }) {
  const { data = [], isPending, isFetching, refetch } = useAlignmentMap(cycleId);
  const suggest = useSuggestTeamOkrs();
  const router = useRouter();
  const [gapSuggestions, setGapSuggestions] = useState<TeamOkrGapSuggestion[]>([]);

  if (isPending) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        No hay objetivos de empresa en este ciclo.
      </div>
    );
  }

  const totalAreas       = data.reduce((s, e) => s + e.area_count, 0);
  const totalTeams       = data.reduce((s, e) => s + e.team_count, 0);
  const totalIndividuals = data.reduce((s, e) => s + e.individual_count, 0);
  const gaps             = data.filter((e) => e.team_count === 0);

  async function handleSuggest() {
    const result = await suggest.mutateAsync({ cycle_id: cycleId });
    setGapSuggestions(result.gap_suggestions ?? []);
  }

  return (
    <div className="space-y-4">
      {/* Header row with refresh */}
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1.5 text-muted-foreground"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          {isFetching ? "Actualizando…" : "Actualizar"}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Empresa",    value: data.length,      Icon: Building2, color: "text-violet-500" },
          { label: "Área",       value: totalAreas,       Icon: Users,     color: "text-blue-500"   },
          { label: "Equipo",     value: totalTeams,       Icon: Users,     color: "text-amber-500"  },
          { label: "Individual", value: totalIndividuals, Icon: User,      color: "text-green-500"  },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-lg border bg-card p-3 flex items-center gap-3">
            <Icon className={cn("h-4 w-4 shrink-0", color)} />
            <div>
              <p className="text-lg font-bold leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Leyenda del semáforo */}
      <SemaphoreLegend />

      {/* Gaps alert + suggest button */}
      {gaps.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>{gaps.length} objetivo{gaps.length !== 1 ? "s" : ""} sin cobertura de equipos:</strong>{" "}
              {gaps.map((g) => g.company_title).join(", ")}
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">
              Usa el botón <strong>Alinear área</strong> en cada fila para vincular objetivos existentes, o genera sugerencias con IA.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 shrink-0 border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={handleSuggest}
            disabled={suggest.isPending}
          >
            {suggest.isPending
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Sparkles className="h-3 w-3" />}
            {suggest.isPending ? "Generando…" : "Sugerir OKRs"}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-700/50 p-3">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-xs text-green-800 dark:text-green-300 flex-1">
            Todos los objetivos tienen cobertura de equipos.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 shrink-0 border-green-300 hover:bg-green-100"
            onClick={() => router.push("/traceability")}
          >
            <Network className="h-3 w-3" />
            Ver trazabilidad
          </Button>
        </div>
      )}

      {/* Coverage tree */}
      <div className="space-y-2">
        {data.map((entry) => (
          <CoverageRow
            key={entry.company_obj_id}
            entry={entry}
            cycleId={cycleId}
            onRefetch={() => refetch()}
          />
        ))}
      </div>

      {/* AI gap suggestions */}
      {gapSuggestions.length > 0 && (
        <>
          <GapSuggestions
            suggestions={gapSuggestions}
            cycleId={cycleId}
            onCreated={() => refetch()}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => router.push("/traceability")}
          >
            <Network className="h-3.5 w-3.5" />
            Ver trazabilidad completa
          </Button>
        </>
      )}
    </div>
  );
}
