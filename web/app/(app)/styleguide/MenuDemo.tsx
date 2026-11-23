"use client";

import { useRef, useState } from "react";
import { Button, Menu } from "@/components/ui";
import type { MenuItemDef } from "@/components/ui";
import { Copy, Share2, Trash2, ChevronDown, Settings, Rows3, Rows4 } from "lucide-react";

export function MenuDemo() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Zweites Menü: ein Ziel (`href`, hier als offene Seite: `current`) und eine Wahl in einer
  // Gruppe (`gruppe`), wie im Konto-Menü (#661).
  const [offen2, setOffen2] = useState(false);
  const [dichte, setDichte] = useState<"normal" | "kompakt">("normal");
  const trigger2Ref = useRef<HTMLButtonElement>(null);

  const items: MenuItemDef[] = [
    { label: "Duplizieren", icon: Copy, onSelect: () => setLast("Duplizieren") },
    { label: "Teilen", icon: Share2, trailing: "⌘S", onSelect: () => setLast("Teilen") },
    { label: "Löschen", icon: Trash2, danger: true, onSelect: () => setLast("Löschen") },
  ];

  const items2: MenuItemDef[] = [
    { label: "Einstellungen", icon: Settings, href: "#menue", current: true },
    {
      label: "Normal",
      icon: Rows3,
      gruppe: "Dichte",
      trenner: true,
      gewaehlt: dichte === "normal",
      onSelect: () => setDichte("normal"),
    },
    {
      label: "Kompakt",
      icon: Rows4,
      gruppe: "Dichte",
      gewaehlt: dichte === "kompakt",
      hinweis: "Gilt in diesem Browser.",
      onSelect: () => setDichte("kompakt"),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        <Button ref={triggerRef} variant="outlined" onClick={() => setOpen((o) => !o)}>
          Aktionen
          <ChevronDown size={18} strokeWidth={2} aria-hidden />
        </Button>
        <Menu
          open={open}
          onClose={() => setOpen(false)}
          triggerRef={triggerRef}
          items={items}
        />
      </div>
      <div className="relative">
        <Button ref={trigger2Ref} variant="outlined" onClick={() => setOffen2((o) => !o)}>
          Ziel und Gruppe
          <ChevronDown size={18} strokeWidth={2} aria-hidden />
        </Button>
        <Menu
          open={offen2}
          onClose={() => setOffen2(false)}
          triggerRef={trigger2Ref}
          items={items2}
        />
      </div>
      {last && (
        <span className="type-label-small text-on-surface-mittel">
          gewählt: {last}
        </span>
      )}
    </div>
  );
}
