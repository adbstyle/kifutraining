"use client";

import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { Card } from "@/components/ui";
import { DiagrammZeichnen } from "@/components/diagramm/DiagrammZeichnen";
import { DiagrammView } from "@/components/diagramm/DiagrammView";
import type { DiagrammData } from "@/lib/diagramm";
import type { VorlageItem } from "@/lib/queries/exercises";
import { ladeVorlagen } from "@/lib/actions/diagramm";

/** Ab hier zeigt die Maske die Fläche — Tailwinds `sm`, wie die Klassen unten. */
const BREIT = "(min-width: 40rem)";

/**
 * Das Feld-Diagramm in der Maske einer Übung — beim Erfassen (#246) wie beim
 * Bearbeiten (#247), in der Bibliothek wie im Training. Die Zeichenfläche
 * sichert nichts selbst: Der Stand geht mit dem Speichern der Übung mit. Es
 * sitzt im Abschnitt «Feld-Diagramm» der Maske.
 *
 * Unter `sm` zeigt es statt der Fläche den Hinweis, dass Zeichnen mehr Platz
 * braucht (#246 AK 9), beim Bearbeiten darüber die bisherige Zeichnung
 * (#247 AK 9). Die Weiche ist reines CSS: Wer das Fenster verkleinert,
 * verliert eine begonnene Zeichnung nicht, sie wird nur nicht angezeigt.
 *
 * Die Vorlagen (#246 AK 3) tragen jedes Diagramm vollständig mit. Geholt werden
 * sie darum erst, sobald die Fläche zu sehen ist, und nicht mit der Seite.
 */
export function DiagrammFeld({
  initial,
  name,
  vorlagenAusser,
  schmalHinweis,
  onChange,
}: {
  /** Die gespeicherte Zeichnung, beim Erfassen die leere Fläche. */
  initial: DiagrammData;
  /** Der Name der Übung, für die Beschriftung der Vorschau. */
  name?: string;
  /** Die Übung selbst taugt nicht als ihre eigene Vorlage. */
  vorlagenAusser?: string;
  /** Was der Trainer auf einem schmalen Bildschirm liest. */
  schmalHinweis: string;
  onChange: (data: DiagrammData, info: { ausVorlage: boolean }) => void;
}) {
  const [vorlagen, setVorlagen] = useState<VorlageItem[]>([]);

  useEffect(() => {
    const breit = window.matchMedia(BREIT);
    let geholt = false;
    const holen = () => {
      if (geholt || !breit.matches) return;
      geholt = true;
      ladeVorlagen(vorlagenAusser).then(setVorlagen, () => {
        geholt = false;
      });
    };
    holen();
    breit.addEventListener("change", holen);
    return () => breit.removeEventListener("change", holen);
  }, [vorlagenAusser]);

  return (
    <div>
      <div className="hidden sm:block">
        <DiagrammZeichnen
          initial={initial}
          vorlagen={vorlagen}
          onChange={onChange}
        />
      </div>
      <div className="flex flex-col gap-3 sm:hidden">
        {initial.elemente.length > 0 && (
          <div className="aspect-[16/10] w-full overflow-hidden rounded-flaeche border border-linie">
            <DiagrammView diagramm={initial} title={`Feld-Diagramm: ${name ?? "Übung"}`} />
          </div>
        )}
        <Card className="flex items-start gap-3 p-4">
          <PenLine size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="type-body-medium text-on-surface-mittel">{schmalHinweis}</p>
        </Card>
      </div>
    </div>
  );
}
