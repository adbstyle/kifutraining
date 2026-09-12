import { TriangleAlert } from "lucide-react";
import type { Konflikt } from "@/lib/gruppen";

/** Was an der Gruppenverteilung nicht aufgeht — am Fuss der Hauptteil-Karte
 *  (Story #150 AK 13/14).
 *
 *  Dort, weil ein Konflikt nie an einer einzelnen Zeile hängt: Er entsteht aus
 *  dem Verhältnis zweier Übungen zueinander, und der Fuss ist der Ort, an dem
 *  die Karte ohnehin über ihren ganzen Inhalt spricht (zu viele Übungen, Dauer
 *  fehlt).
 *
 *  Gemeldet, nie gesperrt (AK 15): Der Trainer weiss Dinge, die die Anwendung
 *  nicht weiss — vielleicht laufen zwei Stationen bewusst unterschiedlich lang.
 *  Der Befund trägt darum dieselbe Farbe wie eine Fehleingabe: Unterschieden
 *  sind die beiden im Verhalten — der Befund lässt sich speichern und sperrt
 *  nichts —, nicht im Bild. Eine dritte Signalfarbe nur für «gemeldet, aber
 *  erlaubt» wäre eine Vokabel mehr zu lernen, ohne dass sie etwas sagte. */
export function KonfliktListe({ konflikte }: { konflikte: Konflikt[] }) {
  if (konflikte.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1">
      {konflikte.map((k) => (
        <p
          key={k.text}
          className="flex items-center gap-2 type-label-medium text-on-surface-mittel"
        >
          <TriangleAlert
            size={15}
            strokeWidth={2}
            className="shrink-0 text-error"
            aria-hidden
          />
          {k.text}
        </p>
      ))}
    </div>
  );
}
