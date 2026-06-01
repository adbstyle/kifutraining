"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface NavRailItem<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/* M3 Navigation Rail — vertikale Hauptnavigation (medium+ Fenster).
   Collapsed (schmal, Icon-only) <-> expanded (breit, Icon + Label) über EINE
   morphende Struktur: das Icon bleibt in beiden States vertikal zentriert
   (kein Versatz), das Label blendet rechts via max-width/opacity ein.
   Aktives Ziel = Indicator-Pille (secondary-container). Pfeiltasten-Navigation;
   gespeist aus --nav-*-Component-Tokens. Label bleibt im DOM (a11y). */
export function NavigationRail<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  header,
  expanded = false,
  className,
}: {
  items: ReadonlyArray<NavRailItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Optionaler Kopfbereich (z. B. Menü-IconButton oder FAB). */
  header?: React.ReactNode;
  /** Expanded: breite Leiste mit Labels neben den Icons. */
  expanded?: boolean;
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
        "flex flex-col gap-2 border-r border-outline-variant bg-(--nav-rail-container) px-3 py-4 transition-[width] duration-300 ease-in-out",
        expanded ? "w-64" : "w-20",
        className,
      )}
    >
      {header && (
        <div
          className={cn(
            "mb-2 flex h-11 items-center",
            expanded ? "justify-start" : "justify-center",
          )}
        >
          {header}
        </div>
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
            className={cn(
              "focus-ring flex h-14 w-full items-center rounded-full transition-[background-color,color,gap,padding] duration-300 ease-in-out",
              expanded ? "justify-start gap-3 px-4" : "justify-center gap-0 px-0",
              active
                ? "bg-(--nav-indicator) text-(--nav-item-active-icon)"
                : "text-(--nav-item-inactive-icon) hover:bg-on-surface/8 hover:text-on-surface",
            )}
          >
            <Icon size={24} strokeWidth={2} className="shrink-0" aria-hidden />
            <span
              className={cn(
                "type-label-large overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
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
