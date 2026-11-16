import { istUuid } from "@/lib/kennung";
import { VARIANTE_PARAM } from "@/lib/varianten";

/* Das ausgewählte Training der Übersicht (#630). Die Auswahl steht in der
   Adresse wie Suche, Filter und Sortierung (`?training=<id>`, dazu die
   angezeigte Variante `variante=<id>` und die offene Ansicht
   `ansicht=eigenschaften`), damit Neuladen und ein geteilter Link dasselbe
   Detail zeigen (PC 1). Die übrigen Parameter bleiben dabei stehen.

   REIN: keine Server-Bezüge. */

export const AUSWAHL_PARAM = "training";
export const ANSICHT_PARAM = "ansicht";

/** Die beiden Ansichten des Detail: die Trainingsteile mit ihren Übungen
 *  (Vorgabe) oder die Eigenschaften (AK 5). */
export type DetailAnsicht = "uebungen" | "eigenschaften";

export type TrainingAuswahl = {
  training: string;
  variante?: string;
  ansicht: DetailAnsicht;
};

/** Die Auswahl aus den Adressparametern — nur eine Kennung ist eine Auswahl;
 *  alles andere bleibt ohne Wirkung. */
export function leseAuswahl(sp: Record<string, string | undefined>): TrainingAuswahl | null {
  const training = sp[AUSWAHL_PARAM];
  if (!istUuid(training)) return null;
  return {
    training,
    variante: sp[VARIANTE_PARAM] || undefined,
    ansicht: sp[ANSICHT_PARAM] === "eigenschaften" ? "eigenschaften" : "uebungen",
  };
}

/** Die Adresse der Übersicht mit einer Auswahl (oder ohne, `null` = Detail
 *  schliessen). Suche, Filter und Sortierung bleiben stehen; die Angaben der
 *  vorigen Auswahl fallen weg und werden neu gesetzt. */
export function auswahlHref(
  pfad: string,
  parameter: Record<string, string>,
  auswahl: { training: string; variante?: string; ansicht?: DetailAnsicht } | null,
): string {
  const p = new URLSearchParams(parameter);
  p.delete(AUSWAHL_PARAM);
  p.delete(VARIANTE_PARAM);
  p.delete(ANSICHT_PARAM);
  if (auswahl) {
    p.set(AUSWAHL_PARAM, auswahl.training);
    if (auswahl.variante) p.set(VARIANTE_PARAM, auswahl.variante);
    if (auswahl.ansicht === "eigenschaften") p.set(ANSICHT_PARAM, "eigenschaften");
  }
  const qs = p.toString();
  return qs ? `${pfad}?${qs}` : pfad;
}

/** Wohin das Löschen aus dem Detail zurückführt (#630 PC 4): dieselbe
 *  Übersicht mit Suche, Filter und Sortierung, ohne Auswahl, mit der
 *  einmaligen Meldung. `null`, wenn die Angabe nicht auf die Übersicht zeigt —
 *  sie kommt vom Client und darf nirgends sonst hinführen. */
export function rueckwegNachLoeschen(angabe: unknown): string | null {
  if (typeof angabe !== "string" || !angabe.startsWith("/trainings")) return null;
  let url: URL;
  try {
    url = new URL(angabe, "http://intern.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://intern.invalid" || url.pathname !== "/trainings") return null;
  const p = url.searchParams;
  p.delete(AUSWAHL_PARAM);
  p.delete(VARIANTE_PARAM);
  p.delete(ANSICHT_PARAM);
  p.set("deleted", "1");
  return `/trainings?${p.toString()}`;
}
