"use client";

import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { Card } from "@/components/ui";
import { DiagrammZeichnen } from "@/components/diagramm/DiagrammZeichnen";
import { LEERES_DIAGRAMM, type DiagrammData } from "@/lib/diagramm";
import type { VorlageItem } from "@/lib/queries/exercises";
import { ladeVorlagen } from "@/lib/actions/diagramm";

/** Ab hier zeigt die Maske die Fläche — Tailwinds `sm`, wie die Klassen unten. */
const BREIT = "(min-width: 40rem)";

/**
 * Das Feld-Diagramm in der Erfassungsmaske einer neuen Übung (#246): dieselbe
 * Zeichenfläche wie im Diagramm-Editor, nur ohne laufendes Sichern — der Stand
 * geht mit dem Speichern der Übung mit (AK 5, Out of Scope 3). Es sitzt im
 * Abschnitt «Feld-Diagramm», an der Stelle der Diagramm-Kachel beim Bearbeiten.
 *
 * Unter `sm` zeigt es statt der Fläche den Hinweis, dass Zeichnen mehr Platz
 * braucht (AK 9). Die Weiche ist reines CSS: Wer das Fenster verkleinert,
 * verliert eine begonnene Zeichnung nicht, sie wird nur nicht angezeigt.
 *
 * Die Vorlagen (AK 3) tragen jedes Diagramm vollständig mit. Geholt werden
 * sie darum erst, sobald die Fläche zu sehen ist, und nicht mit der Seite.
 */
export function DiagrammFeld({ onChange }: { onChange: (data: DiagrammData) => void }) {
  const [vorlagen, setVorlagen] = useState<VorlageItem[]>([]);

  useEffect(() => {
    const breit = window.matchMedia(BREIT);
    let geholt = false;
    const holen = () => {
      if (geholt || !breit.matches) return;
      geholt = true;
      ladeVorlagen().then(setVorlagen, () => {
        geholt = false;
      });
    };
    holen();
    breit.addEventListener("change", holen);
    return () => breit.removeEventListener("change", holen);
  }, []);

  return (
    <div>
      <div className="hidden sm:block">
        <DiagrammZeichnen
          initial={LEERES_DIAGRAMM}
          vorlagen={vorlagen}
          onChange={onChange}
          // Die Überschrift trägt der Abschnitt «Feld-Diagramm» der Maske.
          kopf={(aktionen) => <div className="flex justify-end">{aktionen}</div>}
          fuss={
            <p className="type-body-small text-on-surface-mittel">
              Wird mit der Übung gespeichert.
            </p>
          }
        />
      </div>
      <Card className="flex items-start gap-3 p-4 sm:hidden">
        <PenLine size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <p className="type-body-medium text-on-surface-mittel">
          Zum Zeichnen braucht es einen breiteren Bildschirm. Erfasse die Übung hier
          ohne Diagramm — zeichnen kannst du es später beim Bearbeiten.
        </p>
      </Card>
    </div>
  );
}
