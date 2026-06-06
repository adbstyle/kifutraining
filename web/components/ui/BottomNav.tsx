"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface BottomNavItem<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/* M3 Bottom Navigation Bar — horizontale Hauptnavigation für kompakte Fenster
   (Mobil). Pendant zur Navigation Rail: dieselben --nav-*-Tokens, gleiches
   aktives Ziel als Indicator-Pille (secondary-container) — hier hinter dem
   Icon, mit Label darunter. Drei bis fünf gleich breite Ziele. */
export function BottomNav<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: ReadonlyArray<BottomNavItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex items-stretch justify-around border-t border-outline-variant bg-(--nav-rail-container) px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(item.value)}
            className="focus-ring group flex flex-1 flex-col items-center gap-1 rounded-2xl py-1 transition-colors"
          >
            <span
              className={cn(
                "flex h-8 w-16 items-center justify-center rounded-full transition-colors",
                active
                  ? "bg-(--nav-indicator) text-(--nav-item-active-icon)"
                  : "text-(--nav-item-inactive-icon) group-hover:bg-on-surface/8 group-hover:text-on-surface",
              )}
            >
              <Icon size={24} strokeWidth={2} aria-hidden />
            </span>
            <span
              className={cn(
                "type-label-medium",
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
