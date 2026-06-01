"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface NavRailItem<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/* M3 Navigation Rail — vertikale Hauptnavigation (medium+ Fenster).
   Aktives Ziel: Indicator-Pille (secondary-container) hinter dem Icon, da
   Lucide outline-only ist (kein Filled-Wechsel). Pfeiltasten-Navigation (a11y).
   Gespeist aus --nav-*-Component-Tokens. */
export function NavigationRail<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  header,
  className,
}: {
  items: ReadonlyArray<NavRailItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Optionaler Kopfbereich (z. B. Menü-IconButton oder FAB). */
  header?: React.ReactNode;
  className?: string;
}) {
  function handleKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const dir = e.key === "ArrowDown" ? 1 : -1;
    const next = (index + dir + items.length) % items.length;
    onChange(items[next].value);
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex w-20 flex-col items-center gap-3 border-r border-outline-variant bg-(--nav-rail-container) py-4",
        className,
      )}
    >
      {header && (
        <div className="mb-2 flex flex-col items-center gap-3">{header}</div>
      )}
      {items.map((item, i) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={active ? "page" : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => handleKey(e, i)}
            className="group flex w-full flex-col items-center gap-1 focus-visible:outline-none"
          >
            <span
              className={cn(
                "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                "group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface",
                active
                  ? "bg-(--nav-indicator) text-(--nav-item-active-icon)"
                  : "text-(--nav-item-inactive-icon) group-hover:bg-on-surface/8 group-hover:text-on-surface",
              )}
            >
              <Icon size={24} strokeWidth={2} aria-hidden />
            </span>
            <span
              className={cn(
                "type-label-small",
                active
                  ? "text-(--nav-item-active-label)"
                  : "text-(--nav-item-inactive-label)",
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
