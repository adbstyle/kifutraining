"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { MenuItemDef } from "@/components/ui";

/** Fokus-Ziel «der Hinzufügen-Knopf». Keine ID kann so heissen — Gruppen- und
 *  Varianten-IDs sind UUIDs (Muster `DurchlaufZeile`). */
const HINZU = " hinzu";

/**
 * Die Bedienmechanik einer Chip-Leiste (#209 AK 3/5/8): wohin der Fokus nach
 * dem Verschieben und nach dem Entfernen wandert, und was der Screenreader
 * dabei hört.
 *
 * EIN Hook für beide Leisten, weil Gruppen- und Variantenleiste in dieser
 * Hinsicht dasselbe sind: eine Reihe benannter Werte, die der Trainer am Chip
 * ordnet und entfernt. Zweimal geschrieben liefen sie auseinander — und
 * ausgerechnet die Fokusführung fällt niemandem auf, der mit der Maus
 * arbeitet. Was die Leisten wirklich unterscheidet, bleibt bei ihnen: das JSX
 * und der Inhalt der Menüs.
 *
 * Die Refs sind bewusst Refs und kein Zustand: Das Menü gibt den Fokus an
 * seinen Trigger zurück, BEVOR React die Leiste neu ordnet — der Chip wandert
 * danach im DOM und verlöre ihn dabei. Ein Anzeigezustand ist das nicht, und
 * ein zusätzliches Rendern brächte nichts.
 */
export function useChipFokus({
  ids,
  onVerschieben,
  onEntfernen,
}: {
  /** Die Chips in ihrer aktuellen Reihenfolge. Aus ihr folgen die Ansage nach
   *  dem Verschieben und der Nachrücker nach dem Entfernen. */
  ids: readonly string[];
  onVerschieben: (id: string, dir: -1 | 1) => void;
  /** Nur die ID: Wer den Wert dahinter braucht — für eine Rückfrage etwa —,
   *  schlägt ihn in der Leiste nach, die ihn ohnehin führt. */
  onEntfernen: (id: string) => void;
}) {
  // Was der Screenreader nach einer Änderung hört. Die Chips sagen es nicht:
  // Nach dem Verschieben liegt der Fokus zwar auf dem Chip, sein Name wird aber
  // nicht erneut vorgelesen.
  const [meldung, setMeldung] = useState("");
  // Welcher Chip nach dem nächsten Rendern den Fokus bekommt. Registriert wird
  // beim geteilten Chip die MENÜ-Hälfte: Von dort kam der Fokus zurück, und
  // dort soll er bleiben, damit sich weiterschieben lässt.
  const fokusZiel = useRef<string | null>(null);
  // Dasselbe für das Entfernen, aber an eine Bedingung geknüpft: Zwischen Klick
  // und Wegfall kann eine Rückfrage stehen, und die will den Fokus für sich.
  // Darum wird erst zugegriffen, wenn der Wert wirklich weg ist.
  const wegZiel = useRef<{ id: string; ziel: string } | null>(null);
  const chips = useRef(new Map<string, HTMLButtonElement | null>());
  const hinzuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const weg = wegZiel.current;
    // Solange der Wert noch steht, ist die Rückfrage offen (oder wurde
    // abgebrochen) — dann gilt hier nichts, und der Fokus nach einer
    // Verschiebung kommt trotzdem zu seinem Recht.
    if (weg && !ids.includes(weg.id)) {
      wegZiel.current = null;
      // Der Knopf fängt zweierlei auf: den Sentinel HINZU (es war der letzte
      // Chip) und einen Nachrücker, den es auch nicht mehr gibt — bei den
      // Varianten zeigt die Leiste nach der Auflösung gar keinen Chip mehr
      // (AK 7).
      (chips.current.get(weg.ziel) ?? hinzuRef.current)?.focus();
      return;
    }
    const ziel = fokusZiel.current;
    if (!ziel) return;
    fokusZiel.current = null;
    chips.current.get(ziel)?.focus();
  });

  /** Die Registratur der Chips. Räumt beim Abhängen auf — sonst zeigte der
   *  Fokus später auf ein Element, das es nicht mehr gibt. */
  const chipRef = (id: string) => (el: HTMLButtonElement | null) => {
    chips.current.set(id, el);
    return () => {
      chips.current.delete(id);
    };
  };

  /** Einen Chip mit seinem Nachbarn tauschen. `name` steht nur in der Ansage —
   *  gelesen wird sie, weil der Fokus den Chip nicht erneut vorlesen lässt. */
  function schiebe(id: string, dir: -1 | 1, name: string) {
    const i = ids.indexOf(id);
    if (i < 0) return;
    // Eine abgebrochene Rückfrage lässt ihr Ziel stehen; es zeigte nach dem
    // Umsortieren auf die falsche Stelle.
    wegZiel.current = null;
    fokusZiel.current = id;
    setMeldung(`„${name}" steht jetzt an ${i + dir + 1}. Stelle.`);
    onVerschieben(id, dir);
  }

  /** Einen Chip entfernen (lassen). Der Fokus darf nicht ins Nichts fallen: Er
   *  geht an den Wert, der an die Stelle nachrückt, sonst an den davor — und
   *  war es der letzte, an den Hinzufügen-Knopf (Muster `DurchlaufZeile`). */
  function entferne(id: string) {
    const i = ids.indexOf(id);
    if (i < 0) return;
    const rest = ids.filter((_, j) => j !== i);
    wegZiel.current = { id, ziel: rest[i] ?? rest[i - 1] ?? HINZU };
    onEntfernen(id);
  }

  return { meldung, chipRef, hinzuRef, schiebe, entferne };
}

/**
 * Die Menüeinträge, die an jedem Chip einer Leiste gleich sind: bearbeiten,
 * nach vorne, nach hinten, entfernen — in dieser Reihenfolge.
 *
 * Nicht Anwendbares wird WEGGELASSEN, nicht ausgegraut: Am ersten Chip gibt es
 * kein «nach vorne», und ein totes Menü-Element zu zeigen hiesse, es erst lesen
 * und dann verwerfen zu lassen (AK 3/5). Was eine Leiste darüber hinaus
 * anbietet, stellt sie selbst voran — die Varianten ihr «Anzeigen».
 */
export function ordnungsEintraege({
  erster,
  letzter,
  onBearbeiten,
  onVorne,
  onHinten,
  onEntfernen,
}: {
  erster: boolean;
  letzter: boolean;
  onBearbeiten: () => void;
  onVorne: () => void;
  onHinten: () => void;
  onEntfernen: () => void;
}): MenuItemDef[] {
  const eintraege: MenuItemDef[] = [
    { label: "Bearbeiten", icon: Pencil, onSelect: onBearbeiten },
  ];
  if (!erster)
    eintraege.push({ label: "Nach vorne", icon: ChevronLeft, onSelect: onVorne });
  if (!letzter)
    eintraege.push({ label: "Nach hinten", icon: ChevronRight, onSelect: onHinten });
  eintraege.push({
    label: "Entfernen",
    icon: Trash2,
    danger: true,
    onSelect: onEntfernen,
  });
  return eintraege;
}
