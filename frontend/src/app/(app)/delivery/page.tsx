"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  usePrograms, useCreateProgram, useUpdateProgram, useDeleteProgram,
  type DeliveryProgram, type ProgramStatus,
} from "@/hooks/useDelivery";
import {
  Plus, Package2, CheckCircle2, Clock, Archive, MoreHorizontal,
  Pencil, Trash2, ChevronRight, Layers3, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<ProgramStatus, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT:     { label: "Borrador",   color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: Clock },
  ACTIVE:    { label: "Activo",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",   icon: Layers3 },
  COMPLETED: { label: "Completado", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300", icon: CheckCircle2 },
  ARCHIVED:  { label: "Archivado",  color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300", icon: Archive },
};

function progressColor(pct: number) {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 40) return "bg-blue-500";
  return "bg-amber-500";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ── Program Form Dialog ───────────────────────────────────────────────────────

interface ProgramFormProps {
  open: boolean;
  onClose: () => void;
  initial?: DeliveryProgram | null;
}

function ProgramFormDialog({ open, onClose, initial }: ProgramFormProps) {
  const t = useTranslations("pages.delivery");
  const create = useCreateProgram();
  const update = useUpdateProgram();

  const [name, setName]               = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus]           = useState<ProgramStatus>(initial?.status ?? "DRAFT");

  const isEdit = !!initial;
  const busy   = create.isPending || update.isPending;

  function reset() {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setStatus(initial?.status ?? "DRAFT");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (isEdit) {
      await update.mutateAsync({ id: initial!.id, name: name.trim(), description: description.trim() || undefined, status });
    } else {
      await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, status });
    }
    onClose();
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editProgram") : t("newProgramTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editProgramDesc") : t("newProgramDesc")}
          </DialogDescription>
        </DialogHeader>
        <form id="program-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prog-name">{t("programName")}</Label>
            <Input
              id="prog-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Programa Q2 2026"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prog-desc">{t("programDesc")}</Label>
            <Textarea
              id="prog-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional del programa..."
              rows={3}
            />
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="prog-status">{t("programStatus")}</Label>
              <Select
                id="prog-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProgramStatus)}
              >
                <option value="DRAFT">{t("statusDraft")}</option>
                <option value="ACTIVE">{t("statusActive")}</option>
                <option value="COMPLETED">{t("statusCompleted")}</option>
                <option value="ARCHIVED">{t("statusArchived")}</option>
              </Select>
            </div>
          )}
        </form>
        <DialogFooter className="-mb-4 -mx-4 px-4 py-3 border-t bg-muted/40 rounded-b-xl">
          <Button variant="ghost" onClick={() => { onClose(); reset(); }}>{t("cancelBtn")}</Button>
          <Button form="program-form" type="submit" disabled={busy || !name.trim()}>
            {busy ? t("saving") : isEdit ? t("saveChanges") : t("createProgram")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Program Card ──────────────────────────────────────────────────────────────

interface ProgramCardProps {
  program: DeliveryProgram;
  onEdit: (p: DeliveryProgram) => void;
  onDelete: (p: DeliveryProgram) => void;
}

function ProgramCard({ program, onEdit, onDelete }: ProgramCardProps) {
  const t = useTranslations("pages.delivery");
  const router  = useRouter();
  const meta    = STATUS_META[program.status];
  const StatusIcon = meta.icon;
  const pct     = Math.round(program.completion_pct ?? 0);

  return (
    <Card
      className="group relative flex flex-col gap-4 p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/delivery/${program.id}`)}
    >
      {/* actions */}
      <div
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(program)}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> {t("editProgram")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(program)} variant="destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> {t("deleteConfirmTitle")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* header */}
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Package2 className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{program.name}</p>
          {program.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{program.description}</p>
          )}
        </div>
      </div>

      {/* status + cycle */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.color)}>
          <StatusIcon className="h-3 w-3" />
          {program.status === "DRAFT" ? t("statusDraft") : program.status === "ACTIVE" ? t("statusActive") : program.status === "COMPLETED" ? t("statusCompleted") : t("statusArchived")}
        </span>
        {program.cycle_name && (
          <span className="text-xs text-muted-foreground">· {program.cycle_name}</span>
        )}
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 py-2">
          <p className="text-base font-bold text-foreground">{program.phase_count}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("phases")}</p>
        </div>
        <div className="rounded-lg bg-muted/50 py-2">
          <p className="text-base font-bold text-foreground">{program.deliverable_count}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("deliverables")}</p>
        </div>
        <div className="rounded-lg bg-muted/50 py-2">
          <p className="text-base font-bold text-foreground">{program.completed_count}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("completed")}</p>
        </div>
      </div>

      {/* progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t("progress")}</span>
          <span className="font-semibold text-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", progressColor(pct))}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-[10px] text-muted-foreground">{fmtDate(program.created_at)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Card>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteProgramDialog({ program, onClose }: { program: DeliveryProgram | null; onClose: () => void }) {
  const t = useTranslations("pages.delivery");
  const del = useDeleteProgram();

  async function handleDelete() {
    if (!program) return;
    await del.mutateAsync(program.id);
    onClose();
  }

  return (
    <Dialog open={!!program} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("deleteConfirmDesc", { name: program?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mb-4 -mx-4 px-4 py-3 border-t bg-muted/40 rounded-b-xl">
          <Button variant="ghost" onClick={onClose}>{t("cancelBtn")}</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
            {del.isPending ? t("deleting") : t("deleteConfirmTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "ACTIVE" | "DRAFT" | "COMPLETED" | "ARCHIVED";

const FILTER_TAB_IDS: FilterTab[] = ["all", "ACTIVE", "DRAFT", "COMPLETED", "ARCHIVED"];

export default function DeliveryPage() {
  const t = useTranslations("pages.delivery");
  const { data: programs = [], isLoading } = usePrograms();

  const [formOpen,      setFormOpen]      = useState(false);
  const [editTarget,    setEditTarget]    = useState<DeliveryProgram | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<DeliveryProgram | null>(null);
  const [filter,        setFilter]        = useState<FilterTab>("all");
  const [search,        setSearch]        = useState("");

  const filtered = programs.filter((p) => {
    const matchStatus = filter === "all" || p.status === filter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)} className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {t("newProgram")}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border p-1 gap-1">
          {FILTER_TAB_IDS.map((tabId) => {
            const tabLabel = tabId === "all" ? t("filterAll") : tabId === "ACTIVE" ? t("filterActive") : tabId === "DRAFT" ? t("filterDraft") : tabId === "COMPLETED" ? t("filterCompleted") : t("filterArchived");
            return (
              <button
                key={tabId}
                onClick={() => setFilter(tabId)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  filter === tabId
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tabLabel}
                {tabId !== "all" && programs.filter((p) => p.status === tabId).length > 0 && (
                  <span className={cn("ml-1.5 rounded-full px-1.5 py-px text-[10px]",
                    filter === tabId ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {programs.filter((p) => p.status === tabId).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package2}
          title={search ? t("noSearchResults") : t("emptyTitle")}
          description={
            search
              ? `No hay programas que coincidan con "${search}".`
              : t("emptyDesc")
          }
          actionLabel={!search ? t("emptyAction") : undefined}
          onAction={!search ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              onEdit={(prog) => setEditTarget(prog)}
              onDelete={(prog) => setDeleteTarget(prog)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ProgramFormDialog
        open={formOpen || !!editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        initial={editTarget}
      />
      <DeleteProgramDialog
        program={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />

    </div>
  );
}
