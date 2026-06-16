"use client";

import { useState } from "react";
import { getApiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useGovernanceBodies, useCreateGovernanceBody, useUpdateGovernanceBody,
  useDeleteGovernanceBody, useAddGovernanceMember, useRemoveGovernanceMember,
  BODY_TYPE_LABELS, type GovernanceBody,
} from "@/hooks/useGovernance";
import { useOrgUsers } from "@/hooks/useAreas";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Plus, Pencil, Trash2, Users, X, Loader2, ShieldCheck, UserPlus,
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

function Avatar({ name, size = 8, title }: { name: string; size?: number; title?: string }) {
  const bg = avatarColor(name);
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const sizeClass = {
    6: "h-6 w-6 text-[9px]", 7: "h-7 w-7 text-[10px]",
    8: "h-8 w-8 text-xs", 9: "h-9 w-9 text-sm", 10: "h-10 w-10 text-sm",
  }[size] ?? "h-8 w-8 text-xs";

  return (
    <div title={title ?? name}
      className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none border-2 border-card", sizeClass)}
      style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}

// ─── Body type config ──────────────────────────────────────────────────────────

const BODY_TYPES: { value: GovernanceBody["type"]; label: string }[] = [
  { value: "CONSEJO",    label: "Consejo" },
  { value: "COMITE",     label: "Comité" },
  { value: "DIRECTORIO", label: "Directorio" },
  { value: "JUNTA",      label: "Junta" },
  { value: "ASAMBLEA",   label: "Asamblea" },
  { value: "OTHER",      label: "Otro" },
];

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CONSEJO:    { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800", dot: "#7c3aed" },
  COMITE:     { bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-700 dark:text-blue-300",    border: "border-blue-200 dark:border-blue-800",   dot: "#2563eb" },
  DIRECTORIO: { bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-700 dark:text-amber-300",  border: "border-amber-200 dark:border-amber-800",  dot: "#d97706" },
  JUNTA:      { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800", dot: "#059669" },
  ASAMBLEA:   { bg: "bg-rose-50 dark:bg-rose-950/30",    text: "text-rose-700 dark:text-rose-300",    border: "border-rose-200 dark:border-rose-800",   dot: "#e11d48" },
  OTHER:      { bg: "bg-slate-50 dark:bg-slate-900/40",  text: "text-slate-600 dark:text-slate-300",  border: "border-slate-200 dark:border-slate-700",  dot: "#64748b" },
};

// ─── Body form dialog ──────────────────────────────────────────────────────────

function BodyFormDialog({ open, onClose, editing }: {
  open: boolean; onClose: () => void; editing?: GovernanceBody | null;
}) {
  const create = useCreateGovernanceBody();
  const update = useUpdateGovernanceBody();
  const [name, setName]  = useState(editing?.name ?? "");
  const [type, setType]  = useState<GovernanceBody["type"]>(editing?.type ?? "CONSEJO");
  const [desc, setDesc]  = useState(editing?.description ?? "");
  const loading = create.isPending || update.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), type, description: desc.trim() || undefined };
    if (editing) await update.mutateAsync({ id: editing.id, ...payload });
    else await create.mutateAsync(payload);
    onClose();
  }

  const ts = TYPE_STYLES[type];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border-2", ts.bg, ts.border)}>
              <ShieldCheck className={cn("h-5 w-5", ts.text)} />
            </div>
            <DialogTitle>{editing ? "Editar órgano de gobierno" : "Nuevo órgano de gobierno"}</DialogTitle>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="ej. Consejo de Administración…" required minLength={2} autoFocus />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {BODY_TYPES.map(bt => {
                const s = TYPE_STYLES[bt.value];
                const active = type === bt.value;
                return (
                  <button key={bt.value} type="button" onClick={() => setType(bt.value)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all",
                      active ? cn(s.bg, s.text, s.border, "shadow-sm") : "border-border hover:bg-muted/50"
                    )}>
                    {bt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descripción</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Función o alcance de decisión" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Members dialog ────────────────────────────────────────────────────────────

function MembersDialog({ body, open, onClose }: {
  body: GovernanceBody; open: boolean; onClose: () => void;
}) {
  const { data: orgUsers = [] } = useOrgUsers();
  const confirm = useConfirm();
  const addMember    = useAddGovernanceMember();
  const removeMember = useRemoveGovernanceMember();
  const [userId, setUserId]  = useState("");
  const [roleLabel, setRole] = useState("");
  const [addError, setAddError] = useState("");

  const memberIds = new Set(body.members.map(m => m.user_id));
  const available  = orgUsers.filter(u => !memberIds.has(u.id));
  const ts = TYPE_STYLES[body.type];

  async function handleAdd() {
    if (!userId) return;
    setAddError("");
    try {
      await addMember.mutateAsync({ bodyId: body.id, user_id: userId, role_label: roleLabel || undefined });
      setUserId(""); setRole("");
    } catch (err: unknown) {
      setAddError(getApiErrorMessage(err, "Error al agregar miembro"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border-2", ts.bg, ts.border)}>
              <ShieldCheck className={cn("h-4 w-4", ts.text)} />
            </div>
            <div>
              <DialogTitle className="leading-none">{body.name}</DialogTitle>
              <p className={cn("text-xs font-semibold mt-0.5", ts.text)}>{BODY_TYPE_LABELS[body.type]}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Current members */}
          {body.members.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Miembros ({body.members.length})
              </p>
              <div className="divide-y rounded-xl border overflow-hidden">
                {body.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 group hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size={8} />
                      <div>
                        <p className="text-sm font-medium leading-none">{m.name}</p>
                        {m.role_label && (
                          <p className="text-xs text-muted-foreground mt-1">{m.role_label}</p>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      disabled={removeMember.isPending}
                      onClick={async () => {
                        const ok = await confirm({ title: `¿Quitar a ${m.name}?`,
                          description: "Se eliminará del órgano. Puede volver a agregarse.", confirmLabel: "Quitar", variant: "warning" });
                        if (ok) removeMember.mutate({ bodyId: body.id, userId: m.user_id });
                      }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add member */}
          {available.length > 0 && (
            <div className="space-y-2.5 rounded-xl border p-4 bg-muted/20">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Agregar miembro
              </p>
              <select value={userId} onChange={e => setUserId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Seleccionar persona…</option>
                {available.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
              </select>
              <Input value={roleLabel} onChange={e => setRole(e.target.value)}
                placeholder="Rol en el órgano (ej. Presidente, Vocal…)" />
              {addError && <p className="text-xs text-destructive">{addError}</p>}
              <Button size="sm" className="w-full gap-1.5"
                onClick={handleAdd} disabled={!userId || addMember.isPending}>
                {addMember.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <UserPlus className="h-4 w-4" />}
                Agregar al órgano
              </Button>
            </div>
          )}

          {body.members.length === 0 && available.length === 0 && (
            <div className="py-6 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Todos los usuarios ya son miembros.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Governance body card ──────────────────────────────────────────────────────

function BodyCard({ body, onEdit, onDelete, onManageMembers }: {
  body: GovernanceBody;
  onEdit: () => void;
  onDelete: () => void;
  onManageMembers: () => void;
}) {
  const ts = TYPE_STYLES[body.type];

  return (
    <Card className={cn("overflow-hidden group transition-shadow hover:shadow-md border-2", ts.border)}>
      <div className={cn("px-4 py-3 flex items-start justify-between gap-3", ts.bg)}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{body.name}</span>
            <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", ts.text, ts.border, "bg-white/60 dark:bg-black/20")}>
              {BODY_TYPE_LABELS[body.type]}
            </span>
          </div>
          {body.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body.description}</p>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-3">
        {body.members.length > 0 ? (
          <div className="flex items-center justify-between">
            {/* Face pile */}
            <button
              onClick={onManageMembers}
              className="flex items-center gap-3 group/pile hover:opacity-80 transition-opacity"
            >
              <div className="flex -space-x-2">
                {body.members.slice(0, 6).map(m => (
                  <Avatar key={m.id} name={m.name} size={8}
                    title={m.role_label ? `${m.name} — ${m.role_label}` : m.name} />
                ))}
                {body.members.length > 6 && (
                  <div className="h-8 w-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    +{body.members.length - 6}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground group-hover/pile:text-foreground transition-colors">
                {body.member_count} {body.member_count === 1 ? "miembro" : "miembros"}
              </span>
            </button>

            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onManageMembers}>
              <UserPlus className="h-3.5 w-3.5" /> Gestionar
            </Button>
          </div>
        ) : (
          <button onClick={onManageMembers}
            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <div className="flex -space-x-1">
              {[0,1,2].map(i => (
                <div key={i} className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/50" />
              ))}
            </div>
            <span>Sin miembros — haz clic para agregar</span>
          </button>
        )}
      </div>
    </Card>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function GovernancePanel() {
  const confirm    = useConfirm();
  const { data: bodies = [], isLoading } = useGovernanceBodies();
  const deleteBody = useDeleteGovernanceBody();
  const [formOpen, setFormOpen]     = useState(false);
  const [editing, setEditing]       = useState<GovernanceBody | null>(null);
  const [memberBody, setMemberBody] = useState<GovernanceBody | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  const totalMembers = bodies.reduce((s, b) => s + b.member_count, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Órganos de gobierno</h3>
          <p className="text-sm text-muted-foreground">
            Consejo, Comité, Directorio u otras instancias de dirección.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo órgano
        </Button>
      </div>

      {/* Stats strip */}
      {bodies.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Órganos",  value: bodies.length, color: "bg-primary/10 text-primary" },
            { label: "Miembros", value: totalMembers,  color: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border bg-card px-3 py-3 text-center">
              <p className={cn("text-xl font-bold leading-none inline-flex h-9 w-9 items-center justify-center rounded-full mx-auto", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      )}

      {bodies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <ShieldCheck className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Sin órganos de gobierno</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Para cooperativas y empresas con Consejo, Comité Directivo u otras instancias.
          </p>
          <Button size="sm" className="mt-5 gap-1.5"
            onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Crear primero
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {bodies.map(body => (
            <BodyCard
              key={body.id}
              body={body}
              onEdit={() => { setEditing(body); setFormOpen(true); }}
              onManageMembers={() => setMemberBody(body)}
              onDelete={async () => {
                const ok = await confirm({
                  title: `¿Eliminar "${body.name}"?`,
                  description: "Se eliminarán el órgano y todos sus miembros. Esta acción no se puede deshacer.",
                  confirmLabel: "Eliminar", variant: "destructive",
                });
                if (ok) deleteBody.mutate(body.id);
              }}
            />
          ))}
        </div>
      )}

      <BodyFormDialog open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }} editing={editing} />

      {memberBody && (
        <MembersDialog body={memberBody} open={!!memberBody}
          onClose={() => setMemberBody(null)} />
      )}
    </div>
  );
}
