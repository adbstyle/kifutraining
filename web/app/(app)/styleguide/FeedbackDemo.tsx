"use client";

import { FeedbackFlaeche, FeedbackGespraech } from "@/components/feedback/FeedbackGespraech";
import type { FeedbackGespraech as Gespraech } from "@/components/feedback/useFeedbackGespraech";
import { dialogStand } from "@/lib/feedback/regeln";

const keineAktion = () => {};

/* «Fragen und Feedback» im Stand nach der Zusammenfassung — gerendert aus den
   Bausteinen der App, mit einem festen Gespräch statt des Modells. */
const BEISPIEL: Gespraech = {
  phase: "gespraech",
  verlauf: [
    { von: "person", text: "Ich hab einen Termin verschoben, jetzt stehen alle Donnerstage auf 18 Uhr." },
    { von: "ki", text: "Danke. Hast du beim Verschieben «nur diesen Termin» gewählt oder die ganze Serie?" },
    { von: "person", text: "Nur diesen, den am 30. Oktober." },
    { von: "ki", text: "Hier meine Zusammenfassung. Stimmt das so?" },
  ],
  unterwegs: null,
  zusammenfassung: {
    einordnung: "fehler",
    titel: "Terminänderung wirkt auf die ganze Serie",
    punkte: [
      { bezeichnung: "Absicht", text: "Den Termin am 30. Oktober auf 18:00 verlegen." },
      { bezeichnung: "Schritte", text: "Termin bearbeitet, «nur diesen Termin» gewählt." },
      { bezeichnung: "Ergebnis", text: "Alle Donnerstagstrainings stehen auf 18:00." },
      { bezeichnung: "Erwartung", text: "Nur der eine Termin ändert sich." },
      { bezeichnung: "Wiederholbarkeit", text: "Unbekannt" },
    ],
  },
  stand: dialogStand(2, 2),
  fehler: null,
  wartet: false,
  kannZusammenfassen: false,
  senden: keineAktion,
  zusammenfassen: keineAktion,
  bestaetigen: keineAktion,
};

export function FeedbackDemo() {
  return (
    <div className="h-[44rem] w-full max-w-sm">
      <FeedbackFlaeche form="eingebettet" onSchliessen={keineAktion}>
        <FeedbackGespraech
          g={BEISPIEL}
          seite={() => "/styleguide"}
          onSchliessen={keineAktion}
          fokussieren={false}
        />
      </FeedbackFlaeche>
    </div>
  );
}
