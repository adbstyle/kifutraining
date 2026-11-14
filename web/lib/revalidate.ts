// Eine Quelle für die Pfad-Revalidierung nach Trainings-Mutationen — geteilt
// zwischen den Trainings- und den Fassungs-Actions, damit eine neue Route nur
// an einer Stelle nachgetragen werden muss (und keine der beiden Listen die
// Übersichtsseite vergisst).
//
// Was `revalidatePath(pfad, "layout")` trifft (Next 15, geprüft an
// next/dist/server/lib/implicit-tags.js und spec-extension/revalidate.js):
// Jede Seite trägt implizite Tags aus ihrem App-Pfad MIT Routengruppe
// («/(app)/team/[id]/layout», …) und dazu die konkrete URL ohne Zusatz
// («/team/abc»). `revalidatePath("/team/abc", "layout")` ergibt das Tag
// «/team/abc/layout» und trifft damit keines; wirksam ist ein Layout-Muster
// nur mit Gruppe («/(app)/team/[id]», "layout"), ein Pfad ohne Typ trifft die
// URL einer Seite («/teams»). Frisch sind die Seiten trotzdem: Sie rendern
// dynamisch (Cookies, `force-dynamic` im Team-Layout), und jede
// Revalidierung in einer Server Action verwirft den Router-Cache des
// Browsers und rendert die offene Seite in der Antwort neu.
import { revalidatePath } from "next/cache";

/** Alle Ansichten eines Teams neu validieren — Trainingsplan, Trainings und
 *  Verwaltung.
 *
 *  Gemeint ist der Rahmen samt aller Unteransichten in einem Aufruf.
 *  `/team/<id>` mit `"layout"` trifft aber kein implizites Tag (die Tags
 *  tragen die Routengruppe, siehe Kopf); wirksam sind `/teams` und das
 *  Verwerfen des Router-Caches, frisch bleibt das Team, weil sein Layout
 *  `force-dynamic` ist. */
export function revalidiereTeam(teamId: string) {
  revalidatePath("/teams");
  revalidatePath(`/team/${teamId}`, "layout");
}

/** Die Ansichten aller Teams neu validieren — wo eine Änderung einer
 *  Spieler:in alle ihre Teams trifft und die Antwort der Datenebene sie nicht
 *  nennt (Ändern, Link erneuern durch die Verwaltung). Das Muster mit
 *  Routengruppe trifft das implizite Layout-Tag jeder Team-Seite (siehe
 *  Kopf); solange das Team-Layout `force-dynamic` ist, zeigt sich davon nur
 *  das Verwerfen des Router-Caches. */
export function revalidiereAlleTeams() {
  revalidatePath("/teams");
  revalidatePath("/(app)/team/[id]", "layout");
}

/** Alle Ansichten des Vereins neu validieren — der Spielerbestand und was
 *  daran hängt. Nach Zuordnen und Herausnehmen. Gemeint ist der Bereich
 *  samt aller Unterseiten; `/verein` mit `"layout"` trifft aber kein
 *  implizites Tag (Routengruppe, siehe Kopf). Wirksam sind `/teams` und das
 *  Verwerfen des Router-Caches; die Seiten des Vereins rendern dynamisch. */
export function revalidiereVerein() {
  revalidatePath("/verein", "layout");
  revalidatePath("/teams");
}

/** Das Wurzel-Layout neu rendern: Der Bereich-Wechsler der Seitenleiste
 *  (eigene Teams, Verein) liest die Mitgliedschaften dort. Nötig nach jeder
 *  Änderung von Team- oder Verwaltungsmitgliedschaften und nach dem Anlegen
 *  oder Auflösen eines Teams. */
export function revalidiereMitgliedschaften() {
  revalidatePath("/", "layout");
}

/** Alle Ansichten eines Trainings (inkl. der Übersicht) neu validieren; mit
 *  `fassungId` zusätzlich die Bearbeiten-Seite dieser Fassung. */
export function revalidiereTraining(trainingId: string, fassungId?: string) {
  revalidatePath("/trainings");
  revalidatePath(`/training/${trainingId}/edit`);
  revalidatePath(`/training/${trainingId}`);
  revalidatePath(`/training/${trainingId}/durchfuehren`);
  revalidatePath(`/training/${trainingId}/druck`);
  if (fassungId) {
    revalidatePath(`/training/${trainingId}/uebung/${fassungId}/edit`);
  }
}
