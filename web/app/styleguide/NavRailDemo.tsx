"use client";

import { useState } from "react";
import { NavigationRail, IconButton } from "@/components/ui";
import type { NavRailItem } from "@/components/ui";
import { Home, BookOpen, ClipboardList, User, Menu } from "lucide-react";

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
  const current = ITEMS.find((i) => i.value === active)!;

  return (
    <div className="flex h-96 overflow-hidden rounded-[4px] border border-outline">
      <NavigationRail
        items={ITEMS}
        value={active}
        onChange={setActive}
        ariaLabel="Hauptnavigation"
        header={<IconButton icon={Menu} label="Menü öffnen" />}
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
