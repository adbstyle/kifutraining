"use client";

import { useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconButton } from "./IconButton";
import { Tooltip } from "./Tooltip";
import { Menu, type MenuItemDef } from "./Menu";
import { cn } from "@/lib/cn";

/* ⋮-Überlaufmenü: der Ort für Aktionen, die NICHT offen in einer Reihe stehen
   sollen — allen voran die destruktiven. Ein Klick daneben soll nichts
   Unwiderrufliches auslösen; darum ist Löschen/Entfernen zweistufig (⋮ → Eintrag
   → Bestätigungsdialog) statt ein rotes Icon in der Reihe. Deshalb hat
   `IconButton` bewusst keine danger-Variante.

   Trigger-Zustand und -Ref liegen hier drin, damit mehrere Menüs nebeneinander
   (eine Karte je Listeneintrag) sich nicht in die Quere kommen: ein geteilter
   Ref zeigte sonst stets auf den zuletzt gerenderten Trigger, und der
   Outside-Click-Handler schlösse das falsche Menü.

   Verwendung:
     <OverflowMenu items={[{ label: "Entfernen", icon: Trash2, danger: true,
                             onSelect: () => setLoeschen(t) }]} /> */
export function OverflowMenu({
  items,
  label = "Weitere Aktionen",
  tooltip = "Weitere Aktionen",
  size = "sm",
  disabled,
  className,
}: {
  items: MenuItemDef[];
  /** a11y-Name des Triggers. In Listen den Gegenstand mitgeben („Weitere
   *  Aktionen zu {Name}"), sonst hört man ihn je Eintrag identisch. */
  label?: string;
  /** Tooltip-Text; bleibt bewusst kurz, auch wenn `label` ausführlich ist. */
  tooltip?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn("relative", className)}>
      <Tooltip label={tooltip}>
        <IconButton
          ref={triggerRef}
          icon={MoreVertical}
          label={label}
          size={size}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={offen}
          onClick={() => setOffen((o) => !o)}
        />
      </Tooltip>
      <Menu
        open={offen}
        onClose={() => setOffen(false)}
        triggerRef={triggerRef}
        className="right-0"
        items={items}
      />
    </div>
  );
}
