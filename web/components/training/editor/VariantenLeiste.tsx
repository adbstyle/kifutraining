"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, ChipMenu, type MenuItemDef } from "@/components/ui";
import type { Variante } from "@/lib/varianten";

/** Fokus-Ziel «der Hinzufügen-Knopf». Keine Varianten-ID kann so heissen —
 *  Varianten-IDs sind UUIDs (Muster `DurchlaufZeile`). */
const HINZU = " hinzu";

/**
 * Die Variantenleiste der Hauptteil-Karte (#201 AK 6, #209 AK 1/5).
 *
 * Eine eigene Zeile unter dem Kartenkopf und ÜBER den Gruppen, weil die
 * Variante die grössere Klammer ist: Sie entscheidet, WELCHE Übungen darunter
 * stehen; die Gruppen gelten für alle.
 *
 * Am Chip statt im Verwalten-Dialog (#209): Umbenennen, Ordnen und Entfernen
 * geschehen jetzt dort, wo die Variante steht. Der eigene Dialog von #202 hatte
 * seinen Grund darin, dass ein Chip nicht zweierlei bedeuten könne — das löst
 * der GETEILTE Chip: links wählen (ein Klick, die häufigste Handlung der
 * Leiste), rechts das Menü. Zwei Bedienelemente, ein Umriss. Und die Gruppen
 * darunter werden seither auf dieselbe Art bedient, statt in einer zweiten
 * Bauform.
 *
 * Chips gibt es erst ab ZWEI Varianten (Epic EK 7, #201 PC 5): Ein Training
 * ohne zweite Variante sieht aus wie vor dem Epic — die Bezeichnung der einen
 * hat der Trainer nie vergeben, und eine Wahl aus einem Wert ist eine Frage
 * ohne Alternative. Das Ebenen-Zeichen bleibt trotzdem stehen (#209 AK 1); es
 * sagt, wovon die Zeile handelt.
 */
export function VariantenLeiste({
  varianten,
  aktiv,
  onWechsel,
  onHinzufuegen,
  onBearbeiten,
  onVerschieben,
  onEntfernen,
}: {
  /** Die Varianten in ihrer gespeicherten Reihenfolge — sie entscheidet, welche
   *  beim Öffnen des Trainings gilt (#202 PC 3). */
  varianten: readonly Variante[];
  /** Die angezeigte Variante. */
  aktiv: string | undefined;
  onWechsel: (varianteId: string) => void;
  onHinzufuegen: () => void;
  onBearbeiten: (variante: Variante) => void;
  onVerschieben: (varianteId: string, dir: -1 | 1) => void;
  onEntfernen: (variante: Variante) => void;
}) {
  // Was der Screenreader nach einer Änderung hört (AK 8) — der Fokus allein
  // liest den Chip nicht erneut vor.
  const [meldung, setMeldung] = useState("");
  // Welcher Chip nach dem nächsten Rendern den Fokus bekommt. Registriert wird
  // die MENÜ-Hälfte: Von dort kam der Fokus zurück, und dort soll er nach dem
  // Verschieben bleiben, damit sich weiterschieben lässt.
  const fokusZiel = useRef<string | null>(null);
  // Beim Entfernen steht zwischen Klick und Wegfall eine Rückfrage, die den
  // Fokus für sich will — darum wird erst zugegriffen, wenn die Variante
  // wirklich weg ist.
  const wegZiel = useRef<{ id: string; ziel: string } | null>(null);
  const chips = useRef(new Map<string, HTMLButtonElement | null>());
  const hinzuKnopf = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const weg = wegZiel.current;
    // Solange die Variante noch steht, ist die Rückfrage offen (oder wurde
    // abgebrochen) — dann gilt hier nichts, und der Fokus nach einer
    // Verschiebung kommt trotzdem zu seinem Recht.
    if (weg && !varianten.some((v) => v.id === weg.id)) {
      wegZiel.current = null;
      // Bleibt nur eine Variante übrig, zeigt die Leiste gar keinen Chip mehr
      // (Auflösung, AK 7) — dann trägt der Knopf den Fokus.
      (chips.current.get(weg.ziel) ?? hinzuKnopf.current)?.focus();
      return;
    }
    const ziel = fokusZiel.current;
    if (!ziel) return;
    fokusZiel.current = null;
    chips.current.get(ziel)?.focus();
  });

  function schiebe(i: number, dir: -1 | 1) {
    const variante = varianten[i];
    // Eine abgebrochene Rückfrage lässt ihr Ziel stehen; es zeigte nach dem
    // Umsortieren auf die falsche Stelle.
    wegZiel.current = null;
    fokusZiel.current = variante.id;
    setMeldung(`„${variante.name}" steht jetzt an ${i + dir + 1}. Stelle.`);
    onVerschieben(variante.id, dir);
  }

  function entferne(i: number) {
    const variante = varianten[i];
    const rest = varianten.filter((_, j) => j !== i);
    wegZiel.current = { id: variante.id, ziel: rest[i]?.id ?? rest[i - 1]?.id ?? HINZU };
    onEntfernen(variante);
  }

  return (
    // Das Zeichen benennt die Leiste für die Sehenden; `role="group"` samt Name
    // tut dasselbe für alle anderen (wie `VariantenWahl` es hält).
    <div
      role="group"
      aria-label="Varianten des Hauptteils"
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <Layers
        size={18}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-on-surface-variant"
      />

      {varianten.length > 1 &&
        varianten.map((v, i) => {
          const angezeigt = v.id === aktiv;
          const eintraege: MenuItemDef[] = [];
          // Nicht Anwendbares fehlt, statt ausgegraut dazustehen: An der
          // angezeigten Variante ist «Anzeigen» erledigt, am ersten Chip gibt
          // es kein «nach vorne» (AK 5).
          if (!angezeigt)
            eintraege.push({
              label: "Anzeigen",
              icon: Eye,
              onSelect: () => onWechsel(v.id),
            });
          eintraege.push({
            label: "Bearbeiten",
            icon: Pencil,
            onSelect: () => onBearbeiten(v),
          });
          if (i > 0)
            eintraege.push({
              label: "Nach vorne",
              icon: ChevronLeft,
              onSelect: () => schiebe(i, -1),
            });
          if (i < varianten.length - 1)
            eintraege.push({
              label: "Nach hinten",
              icon: ChevronRight,
              onSelect: () => schiebe(i, 1),
            });
          // Auch die vorletzte lässt sich entfernen (AK 7) — die Regel «die
          // letzte bleibt» setzt die Datenbank durch, indem sie die
          // verbleibende auflöst. Hier steht darum keine Sperre mehr.
          eintraege.push({
            label: "Entfernen",
            icon: Trash2,
            danger: true,
            onSelect: () => entferne(i),
          });

          return (
            <ChipMenu
              key={v.id}
              ref={(el) => {
                chips.current.set(v.id, el);
                return () => {
                  chips.current.delete(v.id);
                };
              }}
              label={v.name}
              onSelect={() => onWechsel(v.id)}
              selected={angezeigt}
              selectAriaLabel={`Variante „${v.name}" anzeigen`}
              items={eintraege}
            />
          );
        })}

      {/* Leise statt mono/versal: Der Knopf steht neben Chips, die Nutzertext
          tragen — in Versalien zerfiele die Leiste in zwei Stimmen (AK 2). Bei
          einer einzigen Variante ist er der ganze Anlass der Zeile. */}
      <Button ref={hinzuKnopf} variant="quiet" onClick={onHinzufuegen}>
        <Plus size={16} strokeWidth={2} aria-hidden />
        Variante hinzufügen
      </Button>

      <span className="sr-only" role="status">
        {meldung}
      </span>
    </div>
  );
}
