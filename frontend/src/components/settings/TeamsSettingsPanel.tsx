"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { KRCardSkeleton } from "@/components/shared/SkeletonLoader";
import {
  useTeams, useTeamMembers, useCreateTeam, useAddMember, useRemoveMember,
  type TeamNode, type TeamMember,
} from "@/hooks/useTeams";
import { useAreas, useAssignTeamToArea, useRemoveTeamFromArea } from "@/hooks/useAreas";
import { useOrgMembers } from "@/hooks/useOrganization";
import {
  Users, Plus, ChevronRight, UserPlus, X, Loader2, Building2,
  Crown, Eye, User as UserIcon,
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

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const sizeClass: Record<number, string> = {
    6: "h-6 w-6 text-[9px]", 7: "h-7 w-7 text-[10px]",
    8: "h-8 w-8 text-xs", 9: "h-9 w-9 text-sm",
  };
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", sizeClass[size] ?? sizeClass[8])}
      style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}

// ─── Team role config ──────────────────────────────────────────────────────────

const TEAM_ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  LEAD:     { label: "Líder",      icon: Crown,    color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
  MEMBER:   { label: "Miembro",    icon: UserIcon, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  OBSERVER: { label: "Observador", icon: Eye,      color: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
};

// ─── Add member dialog ─────────────────────────────────────────────────────────

function AddMemberDialog({ teamId, existingMembers, onClose }: {
  teamId: string; existingMembers: TeamMember[]; onClose: () => void;
}) {
  const { data: orgMembers = [] } = useOrgMembers();
  const { mutate: addMember, isPending } = useAddMember();
  const [role, setRole]     = useState("MEMBER");
  const [search, setSearch] = useState("");

  const existingIds = new Set(existingMembers.map(m => m.user_id));
  const available = orgMembers
    .filter(m => !existingIds.has(m.user_id))
    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));

  function add(userId: string) {
    addMember({ teamId, userId, role }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <Card className="w-full max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold">Agregar miembro</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {available.length} personas disponibles
            </p>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} autoFocus className="flex-1" />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="MEMBER">Miembro</option>
              <option value="LEAD">Líder</option>
              <option value="OBSERVER">Observador</option>
            </select>
          </div>

          {available.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {orgMembers.length === 0 ? "No hay personas en la organización." : "Todos ya están en este equipo."}
            </div>
          ) : (
            <ul className="space-y-1 max-h-60 overflow-y-auto -mx-1 px-1">
              {available.map(m => (
                <li key={m.user_id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => add(m.user_id)}>
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} size={8} />
                    <div>
                      <p className="text-sm font-medium leading-none">{m.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" disabled={isPending}
                    className="opacity-0 group-hover:opacity-100 h-7 text-xs gap-1 transition-opacity">
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Agregar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Members panel ─────────────────────────────────────────────────────────────

function MembersPanel({ teamId }: { teamId: string }) {
  const { data: members = [], isLoading } = useTeamMembers(teamId);
  const { mutate: removeMember } = useRemoveMember();
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) return <div className="p-4 space-y-2">{[...Array(3)].map((_,i) => <KRCardSkeleton key={i} />)}</div>;

  return (
    <>
      <div>
        {members.length === 0 ? (
          <EmptyState icon={UserPlus} title="Sin miembros"
            description="Este equipo aún no tiene personas asignadas."
            actionLabel="Agregar miembro" onAction={() => setShowAdd(true)} />
        ) : (
          <div className="divide-y">
            {members.map(m => {
              const roleConf = TEAM_ROLE_CONFIG[m.role] ?? TEAM_ROLE_CONFIG.MEMBER;
              const RoleIcon = roleConf.icon;
              return (
                <div key={m.user_id} className="flex items-center justify-between px-4 py-3 group hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={m.name} size={8} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", roleConf.color)}>
                      <RoleIcon className="h-2.5 w-2.5" />{roleConf.label}
                    </span>
                    <button onClick={() => removeMember({ teamId, userId: m.user_id })}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ml-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {members.length > 0 && (
        <div className="px-4 py-3 border-t">
          <Button size="sm" variant="outline" className="w-full gap-1.5"
            onClick={() => setShowAdd(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Agregar persona
          </Button>
        </div>
      )}

      {showAdd && <AddMemberDialog teamId={teamId} existingMembers={members} onClose={() => setShowAdd(false)} />}
    </>
  );
}

// ─── Create team dialog ────────────────────────────────────────────────────────

function CreateTeamDialog({ onClose }: { onClose: () => void }) {
  const [name, setName]   = useState("");
  const [desc, setDesc]   = useState("");
  const { mutate, isPending, error } = useCreateTeam();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    mutate({ name, description: desc || undefined }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">Crear equipo</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre *</label>
            <Input required value={name} onChange={e => setName(e.target.value)}
              placeholder="ej. Equipo de Producto" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Responsabilidad del equipo" />
          </div>
          {error && <p className="text-sm text-destructive">{(error as any)?.message}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 gap-1.5" disabled={!name || isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear equipo
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─── Area selector ─────────────────────────────────────────────────────────────

function AreaSelector({ teamId, currentAreaId }: { teamId: string; currentAreaId: string | null }) {
  const { data: areas = [] } = useAreas();
  const { mutate: assignTeam, isPending: isAssigning } = useAssignTeamToArea();
  const { mutate: removeTeam, isPending: isRemoving }  = useRemoveTeamFromArea();
  const isPending = isAssigning || isRemoving;

  const currentArea = areas.find(a => a.id === currentAreaId);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "") {
      if (currentAreaId) removeTeam({ areaId: currentAreaId, teamId });
    } else {
      if (currentAreaId && currentAreaId !== value) {
        removeTeam({ areaId: currentAreaId, teamId }, { onSuccess: () => assignTeam({ areaId: value, teamId }) });
      } else if (!currentAreaId) {
        assignTeam({ areaId: value, teamId });
      }
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/20">
      <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: currentArea ? currentArea.color + "30" : undefined }}>
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <span className="text-sm text-muted-foreground shrink-0">Área</span>
      <div className="relative flex-1">
        <select value={currentAreaId ?? ""} onChange={handleChange} disabled={isPending}
          className={cn("w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed")}>
          <option value="">Sin área asignada</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {isPending && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground pointer-events-none" />}
      </div>
    </div>
  );
}

// ─── Team row ──────────────────────────────────────────────────────────────────

function TeamRow({ team, selected, areaName, areaColor, onClick }: {
  team: TeamNode; selected: boolean; areaName: string | null; areaColor: string | null; onClick: () => void;
}) {
  const initials = team.name.slice(0, 2).toUpperCase();
  const bg = avatarColor(team.name);

  return (
    <button onClick={onClick}
      className={cn("w-full flex items-center justify-between px-3 py-3 rounded-xl text-left transition-all",
        selected ? "bg-primary/8 border border-primary/20 shadow-sm" : "hover:bg-muted/60 border border-transparent"
      )}>
      <div className="flex items-center gap-2.5 min-w-0" style={{ paddingLeft: `${team.depth * 12}px` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
          style={{ backgroundColor: bg }}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium leading-none truncate", selected && "text-primary")}>{team.name}</p>
          {areaName && (
            <div className="flex items-center gap-1 mt-1">
              <span className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: areaColor ?? "#6b7280" }} />
              <span className="text-[10px] text-muted-foreground truncate">{areaName}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-xs text-muted-foreground">{team.member_count}</span>
        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", selected && "rotate-90 text-primary")} />
      </div>
    </button>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function TeamsSettingsPanel() {
  const { data: teams, isLoading } = useTeams();
  const { data: areas = [] }       = useAreas();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const selectedTeam = teams?.find(t => t.id === selectedId);
  const { data: selectedMembers = [] } = useTeamMembers(selectedId ?? "");

  const teamAreaMap = new Map<string, { areaId: string; areaName: string; areaColor: string }>();
  for (const area of areas) {
    for (const at of area.teams) {
      teamAreaMap.set(at.id, { areaId: area.id, areaName: area.name, areaColor: area.color });
    }
  }
  const selectedAreaInfo = selectedTeam ? (teamAreaMap.get(selectedTeam.id) ?? null) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Equipos</h3>
          <p className="text-sm text-muted-foreground">Gestiona equipos, miembros y su área organizativa.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo equipo
        </Button>
      </div>

      {/* Stats strip */}
      {teams && teams.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Equipos",  value: teams.length,                                          color: "bg-primary/10 text-primary" },
            { label: "Personas", value: teams.reduce((s, t) => s + (t.member_count ?? 0), 0), color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" },
            { label: "Con área", value: teamAreaMap.size,                                      color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border bg-card px-3 py-3 text-center">
              <p className={cn("text-xl font-bold leading-none inline-flex h-9 w-9 items-center justify-center rounded-full mx-auto", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_,i) => <KRCardSkeleton key={i} />)}</div>
      ) : !teams?.length ? (
        <Card className="overflow-hidden">
          <EmptyState icon={Users} title="Sin equipos"
            description="Crea el primer equipo para organizar personas y OKRs."
            actionLabel="Crear equipo" onAction={() => setShowCreate(true)} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* List */}
          <Card className="lg:col-span-2 p-2 space-y-0.5 h-fit">
            {teams.map(t => (
              <TeamRow key={t.id} team={t} selected={t.id === selectedId}
                areaName={teamAreaMap.get(t.id)?.areaName ?? null}
                areaColor={teamAreaMap.get(t.id)?.areaColor ?? null}
                onClick={() => setSelectedId(t.id)} />
            ))}
          </Card>

          {/* Detail */}
          <Card className="lg:col-span-3 overflow-hidden">
            {selectedTeam ? (
              <>
                {/* Header */}
                <div className="px-4 py-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: avatarColor(selectedTeam.name) }}>
                      {selectedTeam.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm leading-none">{selectedTeam.name}</h3>
                      {selectedTeam.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{selectedTeam.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Area selector */}
                <AreaSelector teamId={selectedTeam.id} currentAreaId={selectedAreaInfo?.areaId ?? null} />

                {/* Members */}
                <MembersPanel teamId={selectedTeam.id} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="flex -space-x-3 mb-4">
                  {(teams.slice(0, 3)).map(t => (
                    <div key={t.id} className="h-10 w-10 rounded-full border-2 border-card flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: avatarColor(t.name) }}>
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-muted-foreground">Selecciona un equipo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Haz clic en cualquier equipo para gestionar sus miembros y área.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {showCreate && <CreateTeamDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}
