"use client";

import { useState } from "react";
import { Button, Menu } from "@/components/ui";
import type { MenuItemDef } from "@/components/ui";
import { Copy, Share2, Trash2, ChevronDown } from "lucide-react";

export function MenuDemo() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const items: MenuItemDef[] = [
    { label: "Duplizieren", icon: Copy, onSelect: () => setLast("Duplizieren") },
    { label: "Teilen", icon: Share2, trailing: "⌘S", onSelect: () => setLast("Teilen") },
    { label: "Löschen", icon: Trash2, danger: true, onSelect: () => setLast("Löschen") },
  ];

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Button variant="tonal" onClick={() => setOpen((o) => !o)}>
          Aktionen
          <ChevronDown size={18} strokeWidth={2} aria-hidden />
        </Button>
        <Menu open={open} onClose={() => setOpen(false)} items={items} />
      </div>
      {last && (
        <span className="type-label-small text-on-surface-variant">
          gewählt: {last}
        </span>
      )}
    </div>
  );
}
