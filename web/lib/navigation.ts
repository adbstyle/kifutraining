/* Welcher Navigationseintrag gerade offen ist — rein aus Adresse und
   Team-Kontext abgeleitet, ohne React. */

export type AktiveBereiche = {
  uebungen: boolean;
  meineUebungen: boolean;
  trainings: boolean;
  meineTrainings: boolean;
  /** Genau die Teams-Übersicht. */
  teamsSeite: boolean;
  /** Irgendwo im Team-Bereich: ein Team, seine Unterseiten oder ein
   *  geöffnetes Team-Training. */
  teamsBereich: boolean;
};

/**
 * @param pfad    `usePathname()`
 * @param mine    `?mine=1` — „Meine Übungen" und „Meine Trainings" sind
 *                derselbe Pool wie „Übungen" und „Trainings", vorgefiltert.
 * @param imTeamBereich  Das geöffnete Training gehört einem Team (#156). Es
 *                liegt unter `/training/…`, gehört aber zu „Teams" und in
 *                keine Trainingsübersicht.
 */
export function aktiveBereiche(pfad: string, mine: boolean, imTeamBereich: boolean): AktiveBereiche {
  const meineUebungen = pfad === "/" && mine;
  const meineTrainings = pfad === "/trainings" && mine;
  return {
    // Katalog und Detailseiten.
    uebungen: (pfad === "/" || pfad.startsWith("/uebung")) && !meineUebungen,
    meineUebungen,
    // Pool, Editor, Einzel-, Durchführungs- und Druckansicht — `/training`
    // deckt als Präfix auch `/trainings` ab.
    trainings: pfad.startsWith("/training") && !imTeamBereich && !meineTrainings,
    meineTrainings,
    teamsSeite: pfad === "/teams",
    teamsBereich: pfad === "/teams" || pfad.startsWith("/team/") || imTeamBereich,
  };
}

/** Ist dieses Team (oder eine seiner Unterseiten) offen? */
export function teamOffen(pfad: string, teamId: string): boolean {
  return pfad === `/team/${teamId}` || pfad.startsWith(`/team/${teamId}/`);
}
