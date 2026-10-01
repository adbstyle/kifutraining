// Sagt eine Meldung «deine Auswahl ist veraltet»? (Team-Kalender, PO 17)
//
// Eigenes Modul, weil die Meldungstabellen in lib/termin.ts (Termine) und
// lib/serie.ts (Serien) liegen und serie.ts termin.ts importiert: Läge die
// Funktion in termin.ts, müsste dieses serie.ts laden — ein Zyklus. Spätere
// Teile mit eigener Tabelle von Konflikt-Sätzen ergänzen sie hier. Beim Ausfall
// ist nur AUSFALL_GEAENDERT veraltet (steht in KONFLIKT_MARKER);
// TERMIN_AUSGEFALLEN ist bewusst eine Regel — ein erneuter Versuch mit anderer
// Wahl (Ausfall zuerst zurücknehmen) gelingt.
//
// REIN: importiert nur die reinen Regelmodule — `check:kern` lädt sie mit tsx.
import { KONFLIKT_MARKER, TERMIN_MELDUNG } from "@/lib/termin";
import { SERIE_MELDUNG } from "@/lib/serie";

/** Der Satz zu einem Marker aus den Meldungstabellen des Kalenders. */
export function kalenderMeldung(marker: string): string | undefined {
  return ({ ...TERMIN_MELDUNG, ...SERIE_MELDUNG } as Record<string, string>)[marker];
}

/** Sagt die Meldung «seit deiner Auswahl hat sich etwas geändert» (PO 17) oder
 *  «gibt es nicht mehr»? Dann trägt die Auswahl veraltete Angaben, und ein
 *  erneuter Versuch scheiterte immer wieder — die Oberfläche schliesst den
 *  Dialog und meldet per Snackbar. Gebaut aus `KONFLIKT_MARKER` (auch die der
 *  Serien) und den beiden «nicht gefunden»-Sätzen. Eine Meldung kann einen
 *  Zusatz tragen (Kopie geblieben), darum Präfix-Vergleich. */
export function istVeraltet(meldung: string | undefined): boolean {
  if (!meldung) return false;
  return [...KONFLIKT_MARKER, "TERMIN_NICHT_GEFUNDEN", "TRAINING_NICHT_GEFUNDEN"].some((m) => {
    const satz = kalenderMeldung(m);
    return !!satz && meldung.startsWith(satz);
  });
}
