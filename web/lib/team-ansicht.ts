// Die Adressen der Ansichten im Kalender eines Teams (#329): Liste oder
// Monatsüberblick, dazu die Eingrenzung auf die eigenen Termine. Eine
// Quelle für Seite und Oberfläche, damit die Eingrenzung auf JEDEM Link
// mitreist (PC 4) — und rein, weil Server und Client sie aufrufen.
import { monatVon } from "@/lib/monat";

export type Ansicht = "liste" | "monat";

/** Die Adresse einer Ansicht des Trainingsplans. Die Liste trägt nur die
 *  Eingrenzung; der Monat zusätzlich seine Ansicht und, sofern er nicht der
 *  heutige ist, den Monat (so bleibt «Heute» immer heute). */
export function planHref(
  teamId: string,
  o: { ansicht: Ansicht; monat?: string; meine: boolean },
  heute: string,
): string {
  const q = new URLSearchParams();
  if (o.ansicht === "monat") {
    q.set("ansicht", "monat");
    if (o.monat && o.monat !== monatVon(heute)) q.set("monat", o.monat);
  }
  if (o.meine) q.set("meine", "1");
  const s = q.toString();
  return `/team/${teamId}${s ? `?${s}` : ""}`;
}
