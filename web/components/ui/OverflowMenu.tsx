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
  disabled,
  gesperrt,
  className,
}: {
  items: MenuItemDef[];
  /** a11y-Name des Triggers. In Listen den Gegenstand mitgeben („Weitere
   *  Aktionen zu {Name}"), sonst hört man ihn je Eintrag identisch. */
  label?: string;
  /** Tooltip-Text; bleibt bewusst kurz, auch wenn `label` ausführlich ist. */
  tooltip?: string;
  disabled?: boolean;
  /** Gesperrt, solange eine Aktion aus dem Menü läuft: `aria-disabled` statt
   *  `disabled` — der Trigger behält den Fokus, den das Menü ihm nach der Wahl
   *  zurückgibt (und den ein Dialog danach wieder an ihn gibt); das Menü öffnet
   *  dann nicht. */
  gesperrt?: boolean;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn("relative", className)}>
      {/* Rechtsbündig wie das Menü: Das ⋮ steht meist am rechten Rand. */}
      <Tooltip label={tooltip} ende>
        <IconButton
          ref={triggerRef}
          icon={MoreVertical}
          label={label}
          disabled={disabled}
          aria-disabled={gesperrt || undefined}
          aria-haspopup="menu"
          aria-expanded={offen}
          onClick={() => {
            if (gesperrt) return;
            setOffen((o) => !o);
          }}
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
