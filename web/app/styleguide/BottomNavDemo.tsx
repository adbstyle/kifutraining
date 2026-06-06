"use client";

import { useState } from "react";
import { BottomNav } from "@/components/ui";
import type { BottomNavItem } from "@/components/ui";
import { LayoutGrid, Bookmark, UserRound } from "lucide-react";

type NavKey = "uebungen" | "meine" | "konto";

const ITEMS: BottomNavItem<NavKey>[] = [
  { value: "uebungen", label: "Übungen", icon: LayoutGrid },
  { value: "meine", label: "Meine Übungen", icon: Bookmark },
  { value: "konto", label: "Konto", icon: UserRound },
];

/* Demonstriert die Bottom Navigation (kompakte Fenster) interaktiv. */
export function BottomNavDemo() {
  const [active, setActive] = useState<NavKey>("uebungen");

  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-[4px] border border-outline">
      <div className="flex h-40 items-center justify-center bg-surface-container-low">
        <span className="type-headline-small text-on-surface-variant">
          {ITEMS.find((i) => i.value === active)!.label}
        </span>
      </div>
      <BottomNav
        items={ITEMS}
        value={active}
        onChange={setActive}
        ariaLabel="Hauptnavigation (Demo)"
      />
    </div>
  );
}
