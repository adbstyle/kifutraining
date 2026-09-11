"use client";

import { Eye, Layers, Plus } from "lucide-react";
import { Button, ChipMenu, type MenuItemDef } from "@/components/ui";
import type { Variante } from "@/lib/varianten";
import { ordnungsEintraege, useChipFokus } from "./useChipFokus";

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
 * Bauform — bis hin zur Fokusführung, die sich beide Leisten teilen
 * (`useChipFokus`).
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
  const fokus = useChipFokus({
    ids: varianten.map((v) => v.id),
    onVerschieben,
    // Der Hook ordnet den Fokus und kennt dafür nur IDs; die Rückfrage des
    // Editors braucht die Variante samt ihrem Namen.
    onEntfernen: (id) => {
      const variante = varianten.find((v) => v.id === id);
      if (variante) onEntfernen(variante);
    },
  });

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
          // «Anzeigen» steht vor dem, was jede Leiste kann — und fehlt an der
          // angezeigten Variante, wo es erledigt ist (AK 5).
          const eintraege: MenuItemDef[] = [
            ...(angezeigt
              ? []
              : [{ label: "Anzeigen", icon: Eye, onSelect: () => onWechsel(v.id) }]),
            // Auch die vorletzte lässt sich entfernen (AK 7) — die Regel «die
            // letzte bleibt» setzt die Datenbank durch, indem sie die
            // verbleibende auflöst. Hier steht darum keine Sperre mehr.
            ...ordnungsEintraege({
              erster: i === 0,
              letzter: i === varianten.length - 1,
              onBearbeiten: () => onBearbeiten(v),
              onVorne: () => fokus.schiebe(v.id, -1, v.name),
              onHinten: () => fokus.schiebe(v.id, 1, v.name),
              onEntfernen: () => fokus.entferne(v.id),
            }),
          ];

          return (
            <ChipMenu
              key={v.id}
              ref={fokus.chipRef(v.id)}
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
      <Button ref={fokus.hinzuRef} variant="quiet" onClick={onHinzufuegen}>
        <Plus size={16} strokeWidth={2} aria-hidden />
        Variante hinzufügen
      </Button>

      <span className="sr-only" role="status">
        {fokus.meldung}
      </span>
    </div>
  );
}
