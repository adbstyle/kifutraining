// Eine Quelle für die Pfad-Revalidierung nach Trainings-Mutationen — geteilt
// zwischen den Trainings- und den Fassungs-Actions, damit eine neue Route nur
// an einer Stelle nachgetragen werden muss (und keine der beiden Listen die
// Übersichtsseite vergisst).
import { revalidatePath } from "next/cache";

/** Alle Ansichten eines Teams neu validieren — Trainingsplan, Trainings und
 *  Verwaltung.
 *
 *  `"layout"` erfasst den Rahmen samt aller Unteransichten in einem Aufruf.
 *  Einzelne Pfade aufzuzählen wäre die Fehlerquelle: eine neue Ansicht würde
 *  irgendwo vergessen und zeigte dann veralteten Stand. */
export function revalidiereTeam(teamId: string) {
  revalidatePath("/teams");
  revalidatePath(`/team/${teamId}`, "layout");
}

/** Alle Ansichten eines Trainings (inkl. der Übersicht) neu validieren; mit
 *  `fassungId` zusätzlich die Bearbeiten-Seiten dieser Fassung. */
export function revalidiereTraining(trainingId: string, fassungId?: string) {
  revalidatePath("/trainings");
  revalidatePath(`/training/${trainingId}/edit`);
  revalidatePath(`/training/${trainingId}`);
  revalidatePath(`/training/${trainingId}/durchfuehren`);
  revalidatePath(`/training/${trainingId}/druck`);
  if (fassungId) {
    revalidatePath(`/training/${trainingId}/uebung/${fassungId}/edit`);
    revalidatePath(`/training/${trainingId}/uebung/${fassungId}/diagramm`);
  }
}
