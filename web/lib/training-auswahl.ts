import { istUuid } from "@/lib/kennung";
import { VARIANTE_PARAM } from "@/lib/varianten";

/* Das ausgewählte Training der Übersicht (#630) und des Team-Bestands
   (#637). Die Auswahl steht in der
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

type TrainingAuswahl = {
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

/** Die Adressparameter als einfache Werte, ohne die genannten — was Sortier-,
 *  Auswahl- und Schliessen-Links mitnehmen. Mehrfachwerte zählen nicht. */
export function adressParameter(
  sp: Record<string, string | string[] | undefined>,
  ohne: readonly string[] = [],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && !ohne.includes(e[0])),
  );
}

/** Was eine Übersicht mit Detail aus Adresse, Liste und geladenem Training
 *  macht — EINE Regel für die Trainingsübersicht (#630) und den Bestand
 *  eines Teams (#637):
 *  - nicht zugänglich (fremder Entwurf, gelöscht) → kein Detail, Hinweis
 *    (`nichtVerfuegbar`, PC 2);
 *  - zugänglich, aber nicht in der Liste (ausgefiltert, anderswo zu Hause) →
 *    die Auswahl schliesst samt Adresse (`schliessenZu`, PC 3) — sonst kehrte
 *    sie mit dem Zurücknehmen des Filters ungefragt wieder;
 *  - `parameter`: was Sortier- und Zeilen-Links mitnehmen — ohne die
 *    einmalige Meldung, und ohne eine geschlossene Auswahl. */
export function auswahlLage<D extends { training: { id: string } }>(
  sp: Record<string, string | string[] | undefined>,
  pfad: string,
  auswahl: TrainingAuswahl | null,
  geladen: D | null,
  liste: readonly { id: string }[],
) {
  const schliessenZu =
    geladen && !liste.some((t) => t.id === geladen.training.id) ? auswahlHref(pfad, adressParameter(sp), null) : null;
  const detail = schliessenZu ? null : geladen;
  const parameter = adressParameter(
    sp,
    detail ? ["deleted"] : ["deleted", AUSWAHL_PARAM, VARIANTE_PARAM, ANSICHT_PARAM],
  );
  const detailHref = (wahl: { variante?: string; ansicht: DetailAnsicht } | null) =>
    auswahlHref(pfad, parameter, wahl && detail ? { training: detail.training.id, ...wahl } : null);
  return { detail, nichtVerfuegbar: !!auswahl && !geladen, schliessenZu, parameter, detailHref };
}

/** Wohin das Löschen aus dem Detail zurückführt (#630 PC 4, #637 PC 5):
 *  dieselbe Übersicht — die Trainingsübersicht oder der Bestand eines Teams,
 *  `pfad` — mit Suche, Filter und Sortierung, ohne Auswahl, mit der
 *  einmaligen Meldung. `null`, wenn die Angabe nicht auf genau diese Seite
 *  zeigt — sie kommt vom Client und darf nirgends sonst hinführen. */
export function rueckwegNachLoeschen(angabe: unknown, pfad: string): string | null {
  if (typeof angabe !== "string" || !angabe.startsWith(pfad)) return null;
  let url: URL;
  try {
    url = new URL(angabe, "http://intern.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://intern.invalid" || url.pathname !== pfad) return null;
  const ohneAuswahl = auswahlHref(pfad, Object.fromEntries(url.searchParams), null);
  const p = new URLSearchParams(ohneAuswahl.split("?")[1] ?? "");
  p.set("deleted", "1");
  return `${pfad}?${p.toString()}`;
}
