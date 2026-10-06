// Die Adresse des Trainingsplans eines Teams: mit oder ohne Eingrenzung auf
// die eigenen Termine (#325 AK 11). Rein, weil Server und Client sie aufrufen.

/** Die Adresse des Trainingsplans; nur die Eingrenzung reist in ihr mit. */
export function planHref(teamId: string, meine: boolean): string {
  return `/team/${teamId}${meine ? "?meine=1" : ""}`;
}
