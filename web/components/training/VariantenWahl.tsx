"use client";

import { ChoiceChip, ChoiceChipGroup } from "@/components/ui";
import type { Variante } from "@/lib/varianten";

/**
 * Zwischen den Varianten des Hauptteils wechseln (#201 AK 6).
 *
 * `ChoiceChipGroup` statt `SegmentedControl`, weil die Werte NUTZERTEXT sind:
 * Eine Bezeichnung darf bis vierzig Zeichen lang sein («21 Kinder, zwei
 * Trainer»), und die Segmentleiste hielte das nicht — sie scrollte, und der
 * Trainer sähe seine Varianten nicht mehr nebeneinander. Es ist ausserdem eine
 * Einfachauswahl aus n gleichrangigen Werten, genau die Semantik der
 * Radiogroup.
 *
 * Aus demselben Grund `look="nutzertext"`: Auf den Chips steht, was die
 * Trainerin selbst geschrieben hat, und das setzt die Anwendung normal statt
 * mono/versal — «21 Kinder, zwei Trainer» in Versalien läse sich als Rubrik,
 * nicht als ihre Bezeichnung. Dieselbe Regel, aus der schon `ChipMenu`
 * `type-body-medium` trägt; so steht die Varianten-Reihe auf dem Platz in
 * derselben Schreibweise wie im Editor.
 *
 * Abgrenzung zum Editor: Dort trägt ein Varianten-Chip zusätzlich sein Menü
 * (umbenennen, verschieben, entfernen) und ist darum GETEILT — links wählen,
 * rechts verwalten —, was `role=radio` ausschliesst (eine Radiogroup verlangt
 * genau ein fokussierbares Element je Wert und beansprucht die Pfeiltasten).
 * Hier gibt es nur die Wahl: ein Bedienelement je Variante, ein wandernder
 * Tabstopp, Pfeiltasten der Gruppe — die Radiogroup bleibt.
 *
 * Bei genau einer Variante rendert der Baustein NICHTS (Epic EK 7, #201 PC 5):
 * Ein Training ohne zweite Variante soll unverändert aussehen — eine
 * Einfachauswahl mit einem einzigen Wert wäre eine Frage ohne Alternative.
 * Deshalb steht die Prüfung hier und nicht bei jedem Aufrufer.
 *
 * Bewusst ohne eigene Beschriftungszeile: Wo die Leiste steht, sagt der
 * Kontext (die Hauptteil-Karte, der Trainingskopf beim Durchführen), und der
 * a11y-Name der Gruppe nennt sie für alle, die den Kontext nicht sehen.
 */
export function VariantenWahl({
  varianten,
  aktiv,
  onWechsel,
  className,
}: {
  varianten: readonly Variante[];
  /** Die angezeigte Variante. `undefined` nur im Grenzfall eines Trainings
   *  ohne Varianten — dann ist ohnehin nichts zu wählen. */
  aktiv: string | undefined;
  onWechsel: (varianteId: string) => void;
  className?: string;
}) {
  if (varianten.length < 2) return null;

  const gewaehlt = varianten.some((v) => v.id === aktiv);

  return (
    <ChoiceChipGroup ariaLabel="Variante des Hauptteils" className={className}>
      {varianten.map((v, i) => (
        <ChoiceChip
          key={v.id}
          selected={v.id === aktiv}
          // Trägt den Tabstopp, solange keine Variante als gewählt gilt — sonst
          // wäre die Gruppe per Tastatur unerreichbar.
          tabStop={i === 0 && !gewaehlt}
          onSelect={() => onWechsel(v.id)}
          look="nutzertext"
        >
          {v.name}
        </ChoiceChip>
      ))}
    </ChoiceChipGroup>
  );
}
