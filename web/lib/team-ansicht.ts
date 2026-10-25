// Die Adresse des Trainingsplans eines Teams: mit oder ohne Eingrenzung auf
// die eigenen Termine (#325 AK 11, #518 PO 12). Rein, weil Server und Client
// sie aufrufen.
import type { Eingrenzung } from "@/lib/trainer";

/** Wie die Eingrenzung in der Adresse steht: `?meine=1` = wo du dabei bist
 *  (auch alte Links), `?eingeladen=1` = wozu du eingeladen bist. Höchstens eine. */
const PARAM: Record<Eingrenzung, string> = { dabei: "meine", eingeladen: "eingeladen" };

/** Die Eingrenzung aus der Adresse; `?meine=1` geht vor. */
export function eingrenzungAus(sp: { meine?: string; eingeladen?: string }): Eingrenzung | null {
  if (sp.meine === "1") return "dabei";
  if (sp.eingeladen === "1") return "eingeladen";
  return null;
}

/** Die Adresse des Trainingsplans; nur die Eingrenzung reist in ihr mit. */
export function planHref(teamId: string, eingrenzung: Eingrenzung | null): string {
  return `/team/${teamId}${eingrenzung ? `?${PARAM[eingrenzung]}=1` : ""}`;
}

/** Die Reiter eines geöffneten Termins (#435, Trainer:innen #519). */
export type TerminReiter = "termin" | "training" | "spieler" | "trainer";
export const TERMIN_REITER: readonly TerminReiter[] = ["termin", "training", "spieler", "trainer"];

/** Die Adresse des Trainingsplans mit geöffnetem Termin und Reiter (#435). */
export function terminHref(
  teamId: string,
  eingrenzung: Eingrenzung | null,
  terminId: string,
  reiter: TerminReiter = "termin",
): string {
  const q = new URLSearchParams();
  if (eingrenzung) q.set(PARAM[eingrenzung], "1");
  q.set("termin", terminId);
  if (reiter !== "termin") q.set("tab", reiter);
  return `/team/${teamId}?${q.toString()}`;
}
