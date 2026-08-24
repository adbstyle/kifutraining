// Eine Quelle für die Pfad-Revalidierung nach Trainings-Mutationen — geteilt
// zwischen den Trainings- und den Fassungs-Actions, damit eine neue Route nur
// an einer Stelle nachgetragen werden muss (und keine der beiden Listen die
// Übersichtsseite vergisst).
import { revalidatePath } from "next/cache";

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
