"use client";

import { useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LozengeAppearance } from "@/lib/farben";
import { Lozenge, lozengeKlassen } from "./Lozenge";
import { Menu, type MenuItemDef } from "./Menu";

/** Ein möglicher Wechsel: die Handlung und, rechts mit Pfeil, der Zustand,
 *  zu dem sie führt. */
export type Wechsel = {
  handlung: string;
  ziel: { wort: string; appearance: LozengeAppearance };
  /** Ein Strich davor: Seltenes steht nach einem Trenner. */
  trenner?: boolean;
  hinweis?: string;
  onSelect: () => void;
};

/* Eine Lozenge, die zugleich der Knopf für ein Menü ist (Epic #490, wie
   Jiras Status-Lozenge): für Zustände, die man direkt in der Zeile ändert —
   Meldung, Aufgebot und Nachtrag einer Spieler:in an einem Spiel. Sie
   ersetzt dort den Status-Chip mit Punkt.

   - Sieht aus wie die Lozenge (Form, Farbe des Zustands) und ist genauso
     klein; dazu ein kleiner Chevron. Die Trefferfläche ist unsichtbar auf
     mindestens 24 × 24 px vergrössert (WCAG 2.5.8).
   - Das Menü bietet nur die möglichen Wechsel, nie den aktuellen Zustand:
     links die Handlung, rechts Pfeil und Ziel-Lozenge («Anmelden →
     Angemeldet»). Seltenes steht nach einem Trenner, ein Hinweis darf darunter
     stehen.
   - Ohne Wechsel (ausgefallen, ehemalig) ist sie eine gewöhnliche Lozenge.
   - Barrierefrei wie das Menü (`Menu`): Knopf mit `aria-haspopup="menu"`,
     Name «Status <Person>: <Zustand>», ↑/↓ im Menü, Escape zurück. */
export function LozengeAuswahl({
  wort,
  appearance,
  wechsel,
  ariaLabel,
  disabled,
  className,
}: {
  wort: string;
  appearance: LozengeAppearance;
  wechsel: readonly Wechsel[];
  /** Der Name des Knopfs, etwa «Status Mia Keller: ohne Meldung». */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (wechsel.length === 0)
    return (
      <Lozenge appearance={appearance} className={className}>
        {wort}
      </Lozenge>
    );
  const items: MenuItemDef[] = wechsel.map((w) => ({
    label: w.handlung,
    trenner: w.trenner,
    hinweis: w.hinweis,
    onSelect: w.onSelect,
    trailing: (
      <span className="flex items-center gap-2">
        <ArrowRight size={16} aria-hidden />
        <Lozenge appearance={w.ziel.appearance}>{w.ziel.wort}</Lozenge>
      </span>
    ),
  }));
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-label={ariaLabel}
        onClick={() => setOffen((o) => !o)}
        className={cn(
          lozengeKlassen(appearance),
          // Unsichtbar grösser: mindestens 24 × 24 px Trefferfläche.
          "focus-ring relative cursor-pointer gap-0.5 pr-0.5 before:absolute before:-inset-x-1 before:-inset-y-1 before:content-['']",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {wort}
        <ChevronDown size={12} strokeWidth={2.5} aria-hidden className="shrink-0" />
      </button>
      <Menu open={offen} onClose={() => setOffen(false)} triggerRef={trigger} items={items} className="right-0 top-full w-72" />
    </span>
  );
}
