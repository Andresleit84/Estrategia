"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamNode } from "@/hooks/useTeams";

interface TeamPickerProps {
  value: string;
  onChange: (teamId: string) => void;
  teams: TeamNode[] | undefined;
  placeholder?: string;
}

export function TeamPicker({ value, onChange, teams, placeholder = "Buscar equipo o área..." }: TeamPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selected = value ? teams?.find(t => t.id === value) : null;

  const filtered = (teams ?? []).filter(t => {
    if (!query.trim()) return true;
    return t.name.toLowerCase().includes(query.toLowerCase());
  });

  // Calculate fixed dropdown position from the trigger element
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown  = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(teamId: string) {
    onChange(teamId);
    setOpen(false);
    setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setQuery("");
  }

  const dropdown = open && typeof window !== "undefined" ? createPortal(
    <div ref={dropdownRef} style={dropdownStyle} className="rounded-lg border bg-popover shadow-md max-h-48 overflow-y-auto">
      <button
        type="button"
        onClick={() => select("")}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors",
          !value && "bg-primary/5"
        )}
      >
        <div className="h-7 w-7 rounded-full bg-muted border flex items-center justify-center shrink-0">
          <X className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="text-xs text-muted-foreground">Sin área asignada</div>
        {!value && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
      </button>

      {filtered.length === 0 && query && (
        <p className="px-3 py-3 text-xs text-muted-foreground text-center">
          Sin resultados para "{query}"
        </p>
      )}

      {filtered.map(t => (
        <button
          type="button"
          key={t.id}
          onClick={() => select(t.id)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors border-t border-border/40",
            value === t.id && "bg-primary/5"
          )}
        >
          <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{t.name}</div>
            {t.owner_name && (
              <div className="text-[10px] text-muted-foreground truncate">Líder: {t.owner_name}</div>
            )}
          </div>
          {value === t.id && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  if (selected && !open) {
    return (
      <>
        <div
          ref={containerRef}
          className="flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => setOpen(true)}
        >
          <div className="h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 flex items-center justify-center shrink-0">
            <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{selected.name}</div>
            {selected.owner_name && (
              <div className="text-[10px] text-muted-foreground truncate">Líder: {selected.owner_name}</div>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            aria-label="Quitar área"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {dropdown}
      </>
    );
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-lg border bg-background pl-8 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      {dropdown}
    </>
  );
}
