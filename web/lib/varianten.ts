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
import { zaehle } from "@/lib/labels";

/** Längstmögliche Bezeichnung einer Variante (getrimmt gezählt).
 *  SQL-Zwilling: `tv_name_laenge` an `training_varianten`. */
export const VARIANTE_NAME_MAX = 40;

/** Der Name, den ein Training seinem einzigen Hauptteil trägt — beim Anlegen
 *  (Trigger `trainings_erste_variante`) und wieder, sobald die vorletzte
 *  Variante entfernt wird (Auflösung, #209).
 *
 *  Er steuert in der Oberfläche nichts: Bei genau einer Variante zeigt sie gar
 *  keine Bezeichnung (#201 PC 5). Sichtbar wird er erst, wenn eine zweite
 *  dazukommt — der Anlege-Dialog bietet ihn dann als bisherigen Namen an.
 *
 *  SQL-Zwilling: `variante_vorgabename()` (Migration `gruppen_ordnung`). */
export const VARIANTE_VORGABENAME = "Variante 1";

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

/**
 * Die Fassungen GENAU dieser Variante — was mit ihr wegfällt (#202 AK 6).
 *
 * Das Gegenstück zu `sichtbareZuordnungen`: Dort gehört alles ausserhalb des
 * Hauptteils dazu, weil es für alle Varianten gilt; hier gehört es gerade
 * nicht dazu, weil es bleibt.
 */
export function fassungenVon<T extends { varianteId: string | null }>(
  fassungen: readonly T[],
  varianteId: string,
): T[] {
  return fassungen.filter((f) => f.varianteId === varianteId);
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

/**
 * Was das Entfernen einer Variante kostet, als ein Satz (#202 AK 6).
 *
 * Genannt wird nicht nur die Anzahl der Übungen: Notiz und Gruppenzuweisung
 * sind die Arbeit, die in dieser Variante steckt und die nirgends sonst steht.
 * Und was NICHT wegfällt, gehört in denselben Satz — die
 * Gruppen-Definitionen gehören dem Training und gelten für alle Varianten
 * (#202 PC 2); ohne den Nachsatz läse der Trainer die Rückfrage als Angriff
 * auf sein ganzes Training.
 */
export function wegfallSatz(
  variante: Variante,
  fassungen: readonly { notiz: string | null; gruppen: readonly unknown[] }[],
  // Gibt es nach dem Entfernen noch mehrere Varianten? Bei der VORLETZTEN
  // nicht — dann folgt `aufloesungSatz`, und «die übrigen Varianten bleiben»
  // spräche von etwas, das es gleich nicht mehr gibt (#209).
  { uebrigeVarianten = true }: { uebrigeVarianten?: boolean } = {},
): string {
  const n = fassungen.length;
  const mitNotiz = fassungen.filter((f) => f.notiz != null && f.notiz !== "").length;
  const mitGruppen = fassungen.filter((f) => f.gruppen.length > 0).length;

  const teile: string[] = [];
  // In der Einzahl ist die Zahl überflüssig: „1 Übung, davon 1 mit Notiz" sähe
  // aus wie ein Zählfehler. Der Satz wechselt dann die Wendung — „sie trägt
  // eine Notiz" statt eines Aufzählungs-Nachsatzes über ein einziges Stück.
  if (mitNotiz > 0) teile.push(n === 1 ? "eine Notiz" : `${mitNotiz} mit Notiz`);
  if (mitGruppen > 0)
    teile.push(n === 1 ? "eine Gruppenzuweisung" : `${mitGruppen} mit Gruppenzuweisung`);
  const davon =
    teile.length > 0 ? `, ${n === 1 ? "sie trägt" : "davon"} ${teile.join(" und ")}` : "";

  return (
    `Mit „${variante.name}" ${n === 1 ? "fällt" : "fallen"} ` +
    `${zaehle(n, "Übung", "Übungen")} weg${davon}. ` +
    (uebrigeVarianten
      ? "Die Gruppen selbst und die übrigen Varianten bleiben."
      : "Die Gruppen selbst bleiben.")
  );
}

/**
 * Der Zusatz zur Rückfrage, wenn die VORLETZTE Variante entfernt wird (#209).
 *
 * Danach führt das Training wieder genau eine — und verhält sich überall wie
 * vor dem Epic (Epic EK 7): Die Bezeichnung verschwindet aus der Ansicht, die
 * Variantenleiste schrumpft auf den Knopf zum Hinzufügen. Das ist kein
 * Nebeneffekt, den der Trainer hinterher entdecken soll, sondern Teil dessen,
 * was er gerade bestätigt.
 *
 * SQL-Zwilling: der Auflösungs-`update` in `entferne_variante()`, der der
 * bleibenden Variante `variante_vorgabename()` und Position 0 zurückgibt.
 */
export function aufloesungSatz(bleibende: Variante): string {
  return (
    "Danach bleibt eine einzige Variante übrig — sie wird aufgelöst: " +
    `„${bleibende.name}" heisst dann wieder schlicht Hauptteil, ` +
    "und die Leiste zeigt nur noch „Variante hinzufügen\"."
  );
}
