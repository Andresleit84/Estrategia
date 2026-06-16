"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useAreas, useCreateArea, useUpdateArea, useDeleteArea,
  useAssignTeamToArea, useRemoveTeamFromArea, useOrgUsers,
  type Area,
} from "@/hooks/useAreas";
import { useTeams } from "@/hooks/useTeams";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Plus, Pencil, Trash2, Users, X, Loader2, Layers,
  UserCircle, Link2, FolderOpen, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Avatar color ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6366f1","#3b82f6","#10b981","#f59e0b",
  "#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6",
];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (((h << 5) - h) + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none",
        `h-${size} w-${size}`, size <= 7 ? "text-[10px]" : "text-sm")}
      style={{ backgroundColor: bg }}
    >
      {initials}
    </div>
  );
}

// ─── Color picker ──────────────────────────────────────────────────────────────

const AREA_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f43f5e",
  "#f97316","#eab308","#22c55e","#14b8a6","#0ea5e9","#3b82f6",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {AREA_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-8 w-8 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center"
          style={{ backgroundColor: c, borderColor: value === c ? "#fff" : "transparent",
            boxShadow: value === c ? `0 0 0 3px ${c}` : "none" }}
        >
          {value === c && <Check className="h-4 w-4 text-white drop-shadow" />}
        </button>
      ))}
    </div>
  );
}

// ─── Form dialog ───────────────────────────────────────────────────────────────

function AreaFormDialog({ open, onClose, editing }: {
  open: boolean; onClose: () => void; editing?: Area | null;
}) {
  const { data: orgUsers = [] } = useOrgUsers();
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();

  const [name, setName]       = useState(editing?.name ?? "");
  const [desc, setDesc]       = useState(editing?.description ?? "");
  const [color, setColor]     = useState(editing?.color ?? AREA_COLORS[0]);
  const [manager, setManager] = useState(editing?.manager_id ?? "");

  const loading = createArea.isPending || updateArea.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), description: desc.trim() || undefined, color, manager_id: manager || undefined };
    if (editing) await updateArea.mutateAsync({ id: editing.id, ...payload });
    else await createArea.mutateAsync(payload);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: color }}>
              {name ? name[0].toUpperCase() : "A"}
            </div>
            <DialogTitle>{editing ? "Editar área" : "Nueva área"}</DialogTitle>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="ej. RRHH, TI, Cobranza…" required minLength={2} autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descripción</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Responsabilidad principal del área" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Color identificador</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Responsable</label>
            <select value={manager} onChange={e => setManager(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Sin responsable asignado</option>
              {orgUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Guardar" : "Crear área"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign team dialog ────────────────────────────────────────────────────────

function AssignTeamDialog({ area, open, onClose }: { area: Area; open: boolean; onClose: () => void }) {
  const confirm = useConfirm();
  const { data: allTeams = [] } = useTeams();
  const { data: allAreas = [] } = useAreas();
  const assign = useAssignTeamToArea();
  const remove = useRemoveTeamFromArea();

  const allAssignedIds = new Set(allAreas.flatMap(a => a.teams.map(t => t.id)));
  const assignedToThisArea = new Set(area.teams.map(t => t.id));
  const unassigned = allTeams.filter(t => !allAssignedIds.has(t.id) && !assignedToThisArea.has(t.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: area.color }}>
              {area.name[0].toUpperCase()}
            </div>
            <DialogTitle>Equipos en {area.name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {area.teams.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Asignados a esta área
              </p>
              <div className="divide-y rounded-xl border overflow-hidden">
                {area.teams.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5 bg-card">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.member_count} personas</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      disabled={remove.isPending}
                      onClick={async () => {
                        const ok = await confirm({ title: `¿Quitar "${t.name}" del área?`,
                          description: "El equipo quedará sin área asignada.", confirmLabel: "Quitar", variant: "warning" });
                        if (ok) remove.mutate({ areaId: area.id, teamId: t.id });
                      }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unassigned.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Disponibles para asignar
              </p>
              <div className="divide-y rounded-xl border overflow-hidden max-h-52 overflow-y-auto">
                {unassigned.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold">
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-sm">{t.name}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      disabled={assign.isPending}
                      onClick={() => assign.mutate({ areaId: area.id, teamId: t.id })}>
                      {assign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                      Asignar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {area.teams.length === 0 && unassigned.length === 0 && (
            <div className="py-6 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Todos los equipos ya tienen área asignada.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Area card ─────────────────────────────────────────────────────────────────

function AreaCard({ area, onEdit, onDelete, onManageTeams }: {
  area: Area;
  onEdit: () => void;
  onDelete: () => void;
  onManageTeams: () => void;
}) {
  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      {/* Color top stripe */}
      <div className="h-1 w-full" style={{ backgroundColor: area.color }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Area initial circle */}
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: area.color }}>
              {area.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight">{area.name}</h3>
              {area.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{area.description}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Manager */}
        {area.manager_name && (
          <div className="flex items-center gap-2 mb-3">
            <Avatar name={area.manager_name} size={6} />
            <span className="text-xs text-muted-foreground">{area.manager_name}</span>
            <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">Responsable</span>
          </div>
        )}

        {/* Stats + teams button */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FolderOpen className="h-3.5 w-3.5" />
              <strong className="text-foreground">{area.team_count}</strong> equipos
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <strong className="text-foreground">{area.member_count}</strong> personas
            </span>
          </div>

          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onManageTeams}>
            <FolderOpen className="h-3 w-3" /> Equipos
          </Button>
        </div>

        {/* Team chips */}
        {area.teams.length > 0 && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
            {area.teams.slice(0, 4).map(t => (
              <span key={t.id}
                className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border"
                style={{ borderColor: area.color + "40", backgroundColor: area.color + "10", color: area.color }}>
                {t.name}
              </span>
            ))}
            {area.teams.length > 4 && (
              <span className="text-xs text-muted-foreground flex items-center">+{area.teams.length - 4} más</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function AreasPanel() {
  const confirm    = useConfirm();
  const { data: areas = [], isLoading } = useAreas();
  const deleteArea = useDeleteArea();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<Area | null>(null);
  const [teamArea, setTeamArea] = useState<Area | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  const totalMembers = areas.reduce((s, a) => s + a.member_count, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Áreas organizativas</h3>
          <p className="text-sm text-muted-foreground">
            Unidades funcionales de la empresa. Cada equipo pertenece a un área.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nueva área
        </Button>
      </div>

      {/* Stats strip */}
      {areas.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Áreas",    value: areas.length,                                    color: "bg-primary/10 text-primary" },
            { label: "Equipos",  value: areas.reduce((s, a) => s + a.team_count, 0),     color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
            { label: "Personas", value: totalMembers,                                    color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border bg-card px-3 py-3 text-center">
              <p className={cn("text-xl font-bold leading-none inline-flex h-9 w-9 items-center justify-center rounded-full mx-auto", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Areas grid */}
      {areas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Layers className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Sin áreas configuradas</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Crea áreas como RRHH, TI, Cobranza y asigna equipos a cada una.
          </p>
          <Button size="sm" className="mt-5 gap-1.5"
            onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Crear primera área
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {areas.map(area => (
            <AreaCard
              key={area.id}
              area={area}
              onEdit={() => { setEditing(area); setFormOpen(true); }}
              onManageTeams={() => setTeamArea(area)}
              onDelete={async () => {
                const ok = await confirm({
                  title: `¿Eliminar el área "${area.name}"?`,
                  description: "Los equipos asignados quedarán sin área. Esta acción no se puede deshacer.",
                  confirmLabel: "Eliminar área", variant: "destructive",
                });
                if (ok) deleteArea.mutate(area.id);
              }}
            />
          ))}
        </div>
      )}

      <AreaFormDialog open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }} editing={editing} />

      {teamArea && (
        <AssignTeamDialog area={teamArea} open={!!teamArea}
          onClose={() => setTeamArea(null)} />
      )}
    </div>
  );
}
