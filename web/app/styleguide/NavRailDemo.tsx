"use client";

import { useState } from "react";
import { NavigationRail, IconButton } from "@/components/ui";
import type { NavRailItem } from "@/components/ui";
import { Home, BookOpen, ClipboardList, User, Menu, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

type NavKey = "start" | "uebungen" | "plaene" | "profil";

const ITEMS: NavRailItem<NavKey>[] = [
  { value: "start", label: "Start", icon: Home },
  { value: "uebungen", label: "Übungen", icon: BookOpen },
  { value: "plaene", label: "Pläne", icon: ClipboardList },
  { value: "profil", label: "Profil", icon: User },
];

/* Demonstriert die Navigation Rail interaktiv (aktives Ziel + Inhalt). */
export function NavRailDemo() {
  const [active, setActive] = useState<NavKey>("uebungen");
  const [expanded, setExpanded] = useState(false);
  const current = ITEMS.find((i) => i.value === active)!;

  return (
    <div className="flex h-96 overflow-hidden rounded-[4px] border border-outline">
      <NavigationRail
        items={ITEMS}
        value={active}
        onChange={setActive}
        expanded={expanded}
        ariaLabel="Hauptnavigation"
        header={
          <IconButton
            icon={Menu}
            label={expanded ? "Navigation einklappen" : "Navigation ausklappen"}
            onClick={() => setExpanded((e) => !e)}
          />
        }
        footer={
          <button
            type="button"
            className={cn(
              "focus-ring type-label-large flex h-14 items-center rounded-full text-on-surface-variant transition-[gap,padding] duration-300 ease-in-out hover:bg-on-surface/8 hover:text-on-surface",
              expanded ? "w-full justify-start gap-3 px-4" : "w-14 justify-center px-0",
            )}
          >
            <LogOut size={24} strokeWidth={2} className="shrink-0" aria-hidden />
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
              )}
            >
              Abmelden
            </span>
          </button>
        }
        className="h-full"
      />
      <div className="flex flex-1 items-center justify-center bg-surface-container-low">
        <span className="type-headline-small text-on-surface-variant">
          {current.label}
        </span>
      </div>
    </div>
  );
}
