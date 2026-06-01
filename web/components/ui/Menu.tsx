"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MenuItemDef {
  label: string;
  icon?: LucideIcon;
  trailing?: string;
  danger?: boolean;
  onSelect?: () => void;
}

/* M3 Menu — verankertes Dropdown. In einen `relative` Wrapper neben den
   Trigger setzen. Schliesst bei Outside-Click und Escape. Gespeist aus
   --menu-*-Component-Tokens. */
export function Menu({
  open,
  onClose,
  items,
  className,
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItemDef[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        "absolute z-50 mt-1 min-w-48 rounded-(--menu-shape) border border-outline-variant bg-(--menu-container) py-1 shadow-e4",
        className,
      )}
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            role="menuitem"
            type="button"
            onClick={() => {
              item.onSelect?.();
              onClose();
            }}
            className={cn(
              "type-body-medium flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-on-surface/8 focus-visible:bg-on-surface/8 focus-visible:outline-none",
              item.danger ? "text-error" : "text-(--menu-label)",
            )}
          >
            {Icon && (
              <Icon
                size={18}
                strokeWidth={2}
                className={item.danger ? undefined : "text-(--menu-leading)"}
                aria-hidden
              />
            )}
            <span className="flex-1">{item.label}</span>
            {item.trailing && (
              <span className="type-label-small text-on-surface-variant">
                {item.trailing}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
