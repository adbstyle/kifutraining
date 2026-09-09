"use client";

import { useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { ChevronDown } from "lucide-react";
import { Menu, type MenuItemDef } from "./Menu";
import { cn } from "@/lib/cn";

/* Chip mit Menü — ein Chip, der auf Klick ein Menü öffnet. Gedacht für Werte,
   die man an ihrem Ort umsortieren oder entfernen können muss (Sequenz-Chips)
   und deren Beschriftung NUTZERTEXT ist.

   Warum kein bestehender Chip: `InputChip` kennt nur ein Entfernen-X (16 px,
   kein Touch-Ziel) und kann „nach vorne/nach hinten schieben" gar nicht
   ausdrücken; `AssistChip` löst genau eine Aktion aus. Beide tragen ausserdem
   `type-label-medium` — mono/versal —, was einen Gruppennamen verfälscht.
   Darum hier `type-body-medium normal-case`.

   Der Chip ist EIN Bedienelement mit EINEM Tabstopp: kein Chip-plus-Knopf,
   sondern ein Button, der das Menü trägt (`aria-haspopup="menu"`).

   Eigene Datei statt in `Chip.tsx`, weil Chip.tsx hook-frei bleiben muss — es
   wird auch von Server-Komponenten importiert. Trigger-State und -Ref liegen
   wie beim `OverflowMenu` je Instanz hier drin, damit mehrere Chips
   nebeneinander sich nicht in die Quere kommen.

   Verwendung:
     <ChipMenu label={gruppe.name} ariaLabel={`Gruppe ${gruppe.name}, Wechsel 2 von 3`}
               items={[{ label: "Nach vorne", icon: ChevronLeft, onSelect: … }]} /> */
export function ChipMenu({
  ref,
  label,
  items,
  leading,
  ariaLabel,
  tone = "neutral",
  disabled,
  menuClassName,
  className,
}: {
  /** Ref auf den Chip selbst. Ein Chip in einer Sequenz muss von aussen
   *  fokussierbar sein: Wer ihn per Menü verschiebt, soll ihn danach an seiner
   *  neuen Stelle unter dem Fokus behalten — und das Verschieben rendert die
   *  Liste neu, bevor der Fokus zurückkommt (React 19: `ref` ist eine
   *  gewöhnliche Prop). */
  ref?: Ref<HTMLButtonElement>;
  /** Beschriftung des Chips — in der Regel Nutzertext (z. B. ein Gruppenname). */
  label: string;
  items: MenuItemDef[];
  /** Führender Inhalt vor dem Label, meist ein Icon. Farbe bestimmt der Aufrufer. */
  leading?: ReactNode;
  /** a11y-Name, wenn das blosse Label zu wenig sagt („Gruppe 2, Wechsel 2 von 3"). */
  ariaLabel?: string;
  /** `warning`: etwas stimmt nicht, lässt sich aber speichern. Färbt nur Rahmen
   *  und Chevron — nie die Fläche (siehe Warnrolle in globals.css). */
  tone?: "neutral" | "warning";
  disabled?: boolean;
  /** Ausrichtung/Breite des Menüs, z. B. `right-0`. */
  menuClassName?: string;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Ohne Einträge zeigt `Menu` nichts an — dann darf der Chip auch kein
  // geöffnetes Menü behaupten.
  const hatEintraege = items.length > 0;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        // Zwei Interessenten an einem Element: das Menü braucht seinen Anker,
        // der Aufrufer den Fokus. Beide bekommen dasselbe Element.
        //
        // Die Aufräumfunktion des Aufrufers wird durchgereicht: Eine
        // Ref-Callback darf seit React 19 eine zurückgeben, und wer hier eine
        // Registratur führt (`DurchlaufZeile` merkt sich die Chips je
        // Gruppen-ID), räumte sonst nie auf. Weil diese Weitergabe selbst eine
        // Aufräumfunktion ist, ruft React die Callback nicht mehr mit `null` —
        // das Zurücksetzen der eigenen Refs gehört darum ebenfalls hinein.
        ref={(el) => {
          triggerRef.current = el;
          const aufraeumen = typeof ref === "function" ? ref(el) : undefined;
          if (ref && typeof ref !== "function") ref.current = el;
          return () => {
            triggerRef.current = null;
            if (typeof aufraeumen === "function") aufraeumen();
            else if (ref && typeof ref !== "function") ref.current = null;
          };
        }}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={offen && hatEintraege}
        aria-label={ariaLabel}
        onClick={() => setOffen((o) => !o)}
        className={cn(
          "focus-ring type-body-medium inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 normal-case text-on-surface transition-colors",
          tone === "warning" ? "border-warning" : "border-outline",
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-on-surface/8",
        )}
      >
        {leading}
        {label}
        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden
          className={cn("shrink-0", tone === "warning" && "text-warning")}
        />
      </button>
      <Menu
        open={offen}
        onClose={() => setOffen(false)}
        triggerRef={triggerRef}
        items={items}
        className={menuClassName}
      />
    </div>
  );
}
