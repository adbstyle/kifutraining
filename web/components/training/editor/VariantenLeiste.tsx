"use client";

import { Layers, ListOrdered, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { VariantenWahl } from "../VariantenWahl";
import type { Variante } from "@/lib/varianten";

/**
 * Die Variantenzeile der Hauptteil-Karte (#201 AK 1/6).
 *
 * Eine eigene Zeile unter dem Kartenkopf — nicht IM Kopf: Dort sitzt bereits
 * der Einstieg in die Gruppen, und zwei Bedienelemente plus eine umbrechende
 * Chip-Reihe rissen die Kopfzeile auseinander. Die Zeile steht über dem
 * Gruppen-Abschnitt, weil die Variante die grössere Klammer ist: Sie entscheidet,
 * WELCHE Übungen darunter stehen; die Gruppen gelten für alle.
 *
 * Bei genau einer Variante steht hier nur der Knopf. Die Wahl selbst
 * verschwindet (`VariantenWahl` rendert nichts) — ein Training ohne zweite
 * Variante sieht aus wie vorher, und wer nie eine zweite braucht, stösst auf
 * nichts als diesen einen Knopf (Epic EK 7, PC 5). Aus demselben Grund kommt
 * «Varianten verwalten» (#202) erst mit der zweiten dazu: Bei einer einzigen
 * gäbe es nichts zu ordnen, nichts zu entfernen — und ihre Bezeichnung hat der
 * Trainer nie vergeben.
 *
 * «Verwalten» ist ein offener Text-Knopf und kein ⋮-Menü, obwohl der Plan es
 * so vorsah: Das Überlaufmenü ist laut Kit der Ort für das Destruktive, und
 * Umbenennen und Ordnen sind es nicht. Destruktiv ist allein das Entfernen —
 * und das bleibt zweistufig, weil es im Dialog hinter dem X eine Rückfrage
 * trägt (#202 AK 5).
 */
export function VariantenLeiste({
  varianten,
  aktiv,
  onWechsel,
  onHinzufuegen,
  onVerwalten,
}: {
  varianten: readonly Variante[];
  aktiv: string | undefined;
  onWechsel: (varianteId: string) => void;
  onHinzufuegen: () => void;
  onVerwalten: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      {varianten.length > 1 && (
        <Layers
          size={18}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 text-on-surface-variant"
        />
      )}
      <VariantenWahl varianten={varianten} aktiv={aktiv} onWechsel={onWechsel} />
      <Button variant="text" size="sm" onClick={onHinzufuegen}>
        {/* Bei einer Variante ist das Plus der ganze Anlass der Zeile, bei
            mehreren führt es die Chips fort — dasselbe Zeichen wie am
            Übungs-Hinzufügen. */}
        <Plus size={18} strokeWidth={2} aria-hidden />
        Variante hinzufügen
      </Button>
      {varianten.length > 1 && (
        <Button variant="text" size="sm" onClick={onVerwalten}>
          {/* Die Liste als Zeichen: Umbenennen, Ordnen und Entfernen geschehen
              alle an derselben Aufzählung. */}
          <ListOrdered size={18} strokeWidth={2} aria-hidden />
          Varianten verwalten
        </Button>
      )}
    </div>
  );
}
