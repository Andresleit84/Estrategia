"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { AlertTriangle, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type Variant = "destructive" | "warning" | "default";

export interface ConfirmOptions {
  title:         string;
  description?:  string;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      Variant;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  function respond(value: boolean) {
    state?.resolve(value);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialogView
          {...state}
          onConfirm={() => respond(true)}
          onCancel={() => respond(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConfirm() {
  return useContext(ConfirmContext);
}

// ── Dialog visual ─────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<Variant, {
  icon:     React.ElementType;
  iconCls:  string;
  bg:       string;
  btnCls:   string;
}> = {
  destructive: {
    icon:    Trash2,
    iconCls: "text-destructive",
    bg:      "bg-destructive/8 border border-destructive/20",
    btnCls:  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  warning: {
    icon:    AlertTriangle,
    iconCls: "text-amber-500",
    bg:      "bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40",
    btnCls:  "bg-amber-500 text-white hover:bg-amber-600",
  },
  default: {
    icon:    AlertCircle,
    iconCls: "text-primary",
    bg:      "bg-primary/5 border border-primary/20",
    btnCls:  "",
  },
};

function ConfirmDialogView({
  title, description, confirmLabel, cancelLabel, variant = "default",
  onConfirm, onCancel,
}: ConfirmState & { onConfirm: () => void; onCancel: () => void }) {
  const cfg  = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className={cn("flex items-center gap-3 rounded-lg p-3 mb-1", cfg.bg)}>
            <Icon className={cn("h-5 w-5 shrink-0", cfg.iconCls)} aria-hidden="true" />
            <DialogTitle className="text-base leading-snug">{title}</DialogTitle>
          </div>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground pt-1 px-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            onClick={onConfirm}
            className={cn(variant !== "default" && cfg.btnCls)}
            variant={variant === "default" ? "default" : "ghost"}
          >
            {confirmLabel ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
