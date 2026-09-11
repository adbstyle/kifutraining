/**
 * Varianten des Hauptteils (Epic #200) — reine Fachlogik ohne Server-Bezug.
 *
 * Eine Variante ist eine benannte Zusammenstellung des GANZEN Hauptteils: im
 * Kinderfussball über alle drei Unterkategorien, im Juniorenfussball über die
 * Blöcke «Spielformen» und «Spiel» (#201 PC 4). Genau dort, wo auch Gruppen
 * gelten — `istHauptteil()` ist die eine Quelle dafür.
 *
 * Nicht zu verwechseln mit dem Übungsfeld `varianten` (alternative
 * Ausführungsformen einer Übung, `FASSUNG_INHALT_FELDER`). Im Kontext des
 * Hauptteils ist «Variante» laut PO eindeutig; die beiden berühren sich nicht.
 *
 * Jede Regel nennt ihren SQL-Zwilling aus der Migration
 * `20260911100000_hauptteil_varianten.sql`. Die Datenbank ist die
 * Trust-Boundary — was hier steht, ist die frühe, sprechende Antwort.
 */
import { bezeichnungProblem } from "@/lib/bezeichnung";

/** Längstmögliche Bezeichnung einer Variante (getrimmt gezählt).
 *  SQL-Zwilling: `tv_name_laenge` an `training_varianten`. */
export const VARIANTE_NAME_MAX = 40;

/** Was einer Variantenbezeichnung im Weg steht — `null`, wenn sie sich
 *  speichern lässt (#201 AK 4/5). Dieselbe Regel wie bei den Gruppen, darum
 *  dieselbe Funktion; `eigeneId` schaltet beim Umbenennen die eigene Zeile aus
 *  der Kollisionsprüfung aus.
 *
 *  SQL-Zwillinge: `tv_name_laenge` und `tv_name_je_training`. */
export function varianteNameProblem(
  name: string,
  bestehende: readonly { id: string; name: string }[],
  eigeneId?: string,
): string | null {
  return bezeichnungProblem(name, bestehende, { eigeneId, max: VARIANTE_NAME_MAX });
}

/** Eine Variante, so weit die Anzeige sie braucht. */
export type Variante = { id: string; name: string };

/**
 * Die Fassungen, die in einer Variante sichtbar sind (#201 AK 6).
 *
 * `varianteId === null` heisst «ausserhalb des Hauptteils» — diese Fassungen
 * gelten für alle Varianten gemeinsam (#201 PC 3) und sind darum immer dabei.
 * Alles andere gehört genau einer Variante.
 *
 * SQL-Zwilling: der CHECK `te_variante_genau_bei_hauptteil`, der genau diese
 * beiden Fälle zulässt.
 */
export function sichtbareZuordnungen<T extends { varianteId: string | null }>(
  zuordnungen: readonly T[],
  varianteId: string | undefined,
): T[] {
  return zuordnungen.filter((z) => z.varianteId === null || z.varianteId === varianteId);
}

/** Die anzuzeigende Variante aus einem Suchparameter: die genannte, wenn es sie
 *  gibt, sonst die erste. Ein Link auf eine entfernte oder fremde Variante
 *  landet damit auf dem Hauptteil statt auf einer leeren Seite.
 *
 *  «Die erste» ist die vorderste der Liste und nichts Gemerktes (#201 AK 7,
 *  Epic Out of Scope 7) — sortiert nach `position` kommt sie so aus dem
 *  Query-Layer. `undefined` kann es nach Lage der Daten nicht geben (jedes
 *  Training führt mindestens eine Variante); der Typ bleibt trotzdem ehrlich,
 *  damit kein Aufrufer eine leere Liste unbemerkt durchreicht. */
export function varianteAus(
  param: string | undefined,
  varianten: readonly Variante[],
): Variante | undefined {
  return varianten.find((v) => v.id === param) ?? varianten[0];
}

/** Der Name des Suchparameters, über den jede Ansicht ihre Variante trägt.
 *  Eine Variante hat damit eine Adresse — nötig für die Server-Ansichten
 *  (Ansehen, Drucken), die ihre Wahl nicht im State halten können. */
export const VARIANTE_PARAM = "variante";

/**
 * Eine Adresse um die Varianten-Angabe ergänzen — aber nur, wenn es überhaupt
 * etwas zu wählen gibt.
 *
 * Bei genau einer Variante bleibt der Link unverändert: Ein Training ohne
 * zweite Variante soll auch in der Adresszeile unverändert aussehen (#201
 * PC 5 / Epic EK 7).
 */
export function mitVariante(
  href: string,
  varianteId: string | undefined,
  varianten: readonly Variante[],
): string {
  if (varianten.length < 2) return href;
  return `${href}${varianteAnhang(varianteId, href.includes("?") ? "&" : "?")}`;
}

/** Dieselbe Angabe für Aufrufer, die die Schranke «mehr als eine Variante»
 *  bereits gezogen haben: die Editor-Zeile (sie kennt nur die angezeigte
 *  Variante) und die Fassungs-Seiten (sie geben weiter, womit sie aufgerufen
 *  wurden). Ohne Variante bleibt der Anhang leer — eine Quelle für die
 *  Schreibweise, damit sie nicht an vier Orten auseinanderläuft. */
export function varianteAnhang(varianteId: string | undefined, trenner = "?"): string {
  return varianteId
    ? `${trenner}${VARIANTE_PARAM}=${encodeURIComponent(varianteId)}`
    : "";
}

/**
 * Der Titel eines Abschnitts der Leseansicht, um die angezeigte Variante
 * ergänzt — «Hauptteil · 21 Kinder» (#203 AK 5).
 *
 * Der Zusatz steht am Hauptteil und nur dort: Er ist der einzige Teil, der sich
 * je Variante unterscheidet (#201 PC 3). Führt das Training bloss eine
 * Variante, bleibt der Titel unverändert — die Bezeichnung ist dann eine
 * Angabe ohne Aussage (Epic EK 7).
 *
 * In BEIDEN Schemata trägt der Hauptteil-Abschnitt den Schlüssel `hauptteil`
 * (Kinderfussball: der Trainingsteil; Juniorenfussball: der gleichnamige Teil
 * mit den Blöcken «Spielformen» und «Spiel»). Darum genügt hier ein Vergleich
 * und keine Fallunterscheidung — dieselbe Annahme wie im Editor
 * (`teil.key === "hauptteil"`).
 *
 * Die drei Leseansichten (Ansehen, Durchführen, Drucken) rufen dieselbe
 * Funktion, damit der Zusatz nicht an drei Orten auseinanderläuft.
 */
export function abschnittMitVariante(
  abschnittKey: string,
  label: string,
  variante: Variante | undefined,
  varianten: readonly Variante[],
): string {
  if (abschnittKey !== "hauptteil" || varianten.length < 2 || !variante) return label;
  return `${label} · ${variante.name}`;
}
