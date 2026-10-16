// Die Adresse des Trainingsplans eines Teams: mit oder ohne Eingrenzung auf
// die eigenen Termine (#325 AK 11). Rein, weil Server und Client sie aufrufen.

/** Die Adresse des Trainingsplans; nur die Eingrenzung reist in ihr mit. */
export function planHref(teamId: string, meine: boolean): string {
  return `/team/${teamId}${meine ? "?meine=1" : ""}`;
}

/** Die Reiter eines geöffneten Termins (#435). */
export type TerminReiter = "termin" | "training" | "spieler";
export const TERMIN_REITER: readonly TerminReiter[] = ["termin", "training", "spieler"];

/** Die Adresse des Trainingsplans mit geöffnetem Termin und Reiter (#435). */
export function terminHref(teamId: string, meine: boolean, terminId: string, reiter: TerminReiter = "termin"): string {
  const q = new URLSearchParams();
  if (meine) q.set("meine", "1");
  q.set("termin", terminId);
  if (reiter !== "termin") q.set("tab", reiter);
  return `/team/${teamId}?${q.toString()}`;
}
