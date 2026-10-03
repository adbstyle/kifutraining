/** Obergrenze eines Teamnamens in Zeichen (getrimmt gezählt). Gilt beim
 *  Anlegen wie beim Umbenennen. */
export const TEAM_NAME_MAX = 60;

/** Was einem Teamnamen im Weg steht — `null`, wenn er sich speichern lässt.
 *  Eine Regel für beide Seiten: Das Feld weist vor dem Speichern ab, die
 *  Server Action prüft als Trust-Boundary dasselbe noch einmal. */
export function teamNameProblem(name: string): string | null {
  const getrimmt = name.trim();
  if (!getrimmt) return "Bitte einen Teamnamen angeben.";
  if (getrimmt.length > TEAM_NAME_MAX)
    return `Der Teamname darf höchstens ${TEAM_NAME_MAX} Zeichen lang sein.`;
  return null;
}
