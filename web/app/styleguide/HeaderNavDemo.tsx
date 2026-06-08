"use client";

import { useState } from "react";
import {
  LayoutGrid,
  Star,
  UserRound,
  ListChecks,
  CalendarRange,
  LogOut,
  Settings,
  Plus,
} from "lucide-react";
import { Header, Snackbar } from "@/components/ui";
import type { HeaderNavItem, HeaderAccount } from "@/components/ui";

const nav: HeaderNavItem[] = [
  {
    label: "Übungen",
    current: true,
    items: [
      { label: "Alle Übungen", description: "Den ganzen Katalog durchsuchen", href: "/", icon: LayoutGrid },
      { label: "Meine Übungen", description: "Eigene Entwürfe & Veröffentlichungen", href: "/meine-uebungen", icon: UserRound },
      { label: "Favoriten", description: "Gemerkte Übungen", href: "/", icon: Star },
    ],
  },
  {
    label: "Trainingspläne",
    items: [
      { label: "Meine Pläne", description: "Trainings zusammenstellen", href: "#", icon: ListChecks },
      { label: "Saisonplanung", description: "Über die Saison verteilen", href: "#", icon: CalendarRange },
    ],
  },
  { label: "Methodik", href: "#" },
  { label: "Styleguide", href: "/styleguide" },
];

const account: HeaderAccount = {
  name: "Trainer Demo",
  email: "trainer@ki-fu.ch",
  items: [
    { label: "Konto", icon: UserRound, onSelect: () => {} },
    { label: "Einstellungen", icon: Settings, onSelect: () => {} },
    { label: "Abmelden", icon: LogOut, danger: true, onSelect: () => {} },
  ],
};

export function HeaderNavDemo() {
  const [snack, setSnack] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-[6px] border border-outline-variant">
      {/* Im Styleguide in einem Rahmen gezeigt — in echt klebt der Header oben
          am Viewport. Die Suche feuert hier nur eine Snackbar (Demo). */}
      <Header
        nav={nav}
        onSearch={() => setSnack("Suche geöffnet (⌘K)")}
        notifications={2}
        account={account}
        cta={{ label: "Neue Übung", href: "/neu", icon: Plus }}
        className="!static"
      />
      <div className="chalk-hatch relative grid h-64 place-items-center">
        <span className="type-label-small text-on-surface-variant">Seiteninhalt</span>
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <Snackbar
            open={!!snack}
            message={snack ?? ""}
            actionLabel="OK"
            onAction={() => setSnack(null)}
            onClose={() => setSnack(null)}
          />
        </div>
      </div>
    </div>
  );
}
