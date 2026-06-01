"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface NavRailItem<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/* M3 Navigation Rail — vertikale Hauptnavigation (medium+ Fenster).
   Zwei Konfigurationen (M3): collapsed (schmal, Icon + kleines Label gestapelt)
   und expanded (breit, Icon + Label nebeneinander in voller Indicator-Pille).
   Aktives Ziel über secondary-container (Lucide ist outline-only).
   Pfeiltasten-Navigation; gespeist aus --nav-*-Component-Tokens. */
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
  /** Expanded: breite Leiste mit horizontalen Items + Labels. */
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
        "flex flex-col gap-2 border-r border-outline-variant bg-(--nav-rail-container) py-4 transition-[width] duration-200 ease-out",
        expanded ? "w-64 items-stretch px-3" : "w-20 items-center",
        className,
      )}
    >
      {header && (
        <div
          className={cn(
            "mb-2 flex",
            expanded ? "px-1" : "flex-col items-center",
          )}
        >
          {header}
        </div>
      )}

      {items.map((item, i) => {
        const active = item.value === value;
        const Icon = item.icon;

        // Expanded: ganze Zeile ist die Indicator-Pille (Icon + Label nebeneinander)
        if (expanded) {
          return (
            <button
              key={item.value}
              type="button"
              aria-current={active ? "page" : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.value)}
              onKeyDown={(e) => handleKey(e, i)}
              className={cn(
                "flex h-14 w-full items-center gap-3 rounded-full px-4 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                active
                  ? "bg-(--nav-indicator) text-(--nav-item-active-icon)"
                  : "text-(--nav-item-inactive-icon) hover:bg-on-surface/8 hover:text-on-surface",
              )}
            >
              <Icon size={24} strokeWidth={2} aria-hidden />
              <span className="type-label-large">{item.label}</span>
            </button>
          );
        }

        // Collapsed: Icon in Indicator-Pille, kleines Label darunter
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
