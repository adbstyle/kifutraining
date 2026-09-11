"use client";

import { Layers, Plus } from "lucide-react";
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
 * nichts als diesen einen Knopf (Epic EK 7, PC 5).
 */
export function VariantenLeiste({
  varianten,
  aktiv,
  onWechsel,
  onHinzufuegen,
}: {
  varianten: readonly Variante[];
  aktiv: string | undefined;
  onWechsel: (varianteId: string) => void;
  onHinzufuegen: () => void;
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
    </div>
  );
}
