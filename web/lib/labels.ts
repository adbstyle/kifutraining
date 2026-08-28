import { JUNIOREN_BLOCK_SLUGS, NACHARBEIT } from "@/lib/junioren";
import {
  kategorien,
  trainingsteil as trainingsteilLabels,
  junioren_heimat as juniorenHeimatLabels,
} from "@/lib/vocab";

// Schweizer Juniorenstufen — nur die offiziellen Stufennamen als Tooltip/Hint.
export const kategorieStufe: Record<keyof typeof kategorien, string> = {
  G: "G-Junior:innen",
  F: "F-Junior:innen",
  E: "E-Junior:innen",
  D: "D-Junior:innen",
  C: "C-Junior:innen",
  B: "B-Junior:innen",
  A: "A-Junior:innen",
};

// Einordnungen mit methodischem Fahrplan (vs. flachem Aufbau-Text). Eine
// Quelle für alle Schichten. Die Junioren-Heimaten Aufwärmen und Spielform
// zum Trainingsziel tragen ihn ebenfalls — dort ist allerdings nur die Stufe
// «Offen starten» Pflicht (Story 5b AC 3/4).
export const FAHRPLAN_TEILE = new Set<string>([
  "einleitung",
  "hauptteil",
  "jun-aufwaermen",
  "jun-spielform-trainingsziel",
]);

/** Heimaten, bei denen vom Fahrplan nur «Offen starten» Pflicht ist: das
 *  Aufwärmen umfasst fachlich auch Körperstabilität und Prävention, und solche
 *  Drills haben keinen natürlichen Wettkampf-Abschluss. */
export const FAHRPLAN_NUR_OFFEN = new Set<string>([
  "jun-aufwaermen",
  "jun-spielform-trainingsziel",
]);

/** Einordnungen und Heimaten, die Erscheinungsformen tragen dürfen. Auffangen
 *  und Ausklang bleiben ausgeschlossen — auch der Junioren-Ausklang (Story 12
 *  Out of Scope 5). Ohne dieses eigene Set würde die Fahrplan-Menge hier
 *  zweckentfremdet und jede Bearbeitung einer Junioren-Fassung löschte ihre
 *  Erscheinungsformen still.
 *
 *  Verhältnis zum DB-Constraint `erscheinungsform_nur_haupt_einleitung`: Der
 *  deckt die HEIMATEN ab — die vier Kinderfussball-Teile und die drei
 *  Einstiegs-Unterblöcke, mehr kann eine Bibliotheks-Übung nicht tragen. Diese
 *  Menge ist grösser, weil eine FASSUNG auch in `jun-spielformen` oder
 *  `jun-spiel` liegen kann; für Fassungen gilt der Constraint nicht. Die beiden
 *  Listen sind also nicht redundant, sondern beschreiben verschiedene Orte. */
export const ERSCHEINUNGSFORM_TEILE = new Set<string>([
  "einleitung",
  "hauptteil",
  "jun-aufwaermen",
  "jun-spielform-trainingsziel",
  "jun-explosivitaet",
  "jun-spielformen",
  "jun-spiel",
]);

// Das freie Spiel am Ende des Hauptteils. Es folgt keiner methodischen
// Progression und trägt darum eine Beschreibung statt des Fahrplans.
export const FREIES_SPIEL = "fussball-spielen";

/** Braucht diese Einordnung den methodischen Fahrplan? Die Kategorie
 *  «Fussball spielen» trägt stattdessen eine Beschreibung im Feld `aufbau`
 *  (Epic #72, Story 2). Eine Quelle für Formular, Validierung und Anzeige;
 *  spiegelt den DB-Constraint `ablauf_je_einordnung`.
 *
 *  Die Kategorie wird nur im Hauptteil ausgewertet — ausserhalb trägt eine
 *  Übung ohnehin keine, und ein stehengebliebener Formularwert darf die
 *  Einleitung nicht um ihren Fahrplan bringen. */
export function brauchtFahrplan(
  trainingsteil: string,
  hauptteilkategorie: string | null,
): boolean {
  if (!FAHRPLAN_TEILE.has(trainingsteil)) return false;
  return !(trainingsteil === "hauptteil" && hauptteilkategorie === FREIES_SPIEL);
}

/** Welche Ablauf-Form gilt für eine Fassung in ihrem Training?
 *
 *  Für die Kinderfussball-Teile und die beiden Fahrplan-Heimaten entscheidet
 *  die Einordnung — wie bei einer Bibliotheks-Übung. Für die übrigen
 *  Junioren-Blöcke gibt es keine eigene Regel: dort kann eine Fassung liegen,
 *  ohne dass der Block je eine Heimat wäre. Dann entscheidet, was sie
 *  mitbringt: eine aus einer Hauptteil-Übung entstandene Fassung hat ihren
 *  Fahrplan, eine aus dem freien Spiel ihren Aufbau-Text. Sonst zeigte das
 *  Formular ein leeres Aufbau-Feld und der Fahrplan ginge beim Speichern
 *  verloren (Epic #71).
 *
 *  Formular und Server müssen dieselbe Antwort geben — darum eine Funktion. */
export function brauchtFahrplanFuerFassung(
  einordnung: string,
  hauptteilkategorie: string | null,
  hatFahrplanInhalt: boolean,
): boolean {
  // Eine eigene Ablauf-Regel haben nur die Kinderfussball-Teile und die beiden
  // Fahrplan-Heimaten. Alle übrigen Junioren-Blöcke UND die Nacharbeit sind
  // Orte, an denen eine Fassung liegen kann, ohne dass der Ort etwas über ihre
  // Form aussagt — dort entscheidet ihr Inhalt. Die Nacharbeit ausgerechnet
  // auszunehmen hiesse, den Fahrplan einer dorthin gefallenen Fassung
  // stillschweigend zu verwerfen.
  const eigeneRegel =
    einordnung !== NACHARBEIT &&
    (!(JUNIOREN_BLOCK_SLUGS as readonly string[]).includes(einordnung) ||
      FAHRPLAN_TEILE.has(einordnung));
  return eigeneRegel
    ? brauchtFahrplan(einordnung, hauptteilkategorie)
    : hatFahrplanInhalt;
}

/** Befüllte Fahrplan-Stufen zu einem Text: in ihrer Reihenfolge als getrennte
 *  Absätze, ohne Textverlust (PO-Entscheid 2026-08-22). Dient als Ausgangstext
 *  beim Wechsel in eine Einordnung mit einem einzelnen Textfeld. */
export function fahrplanZuText(
  offenStarten: string,
  ueben: string,
  wetteifern: string,
): string {
  return [offenStarten, ueben, wetteifern]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Die Ablauf-Felder eines Erfassungsformulars. */
export type AblaufFelder = {
  offenStarten: string;
  ueben: string;
  wetteifern: string;
  aufbau: string;
};

/** Den Ablauftext beim Wechsel der Einordnung in die neue Form überführen
 *  (Story 2 AK 3). Immer genau eine Form trägt den Ablauf: die alte wird
 *  geleert. Bliebe dort eine Zweitfassung stehen, würde sie beim Zurückwechseln
 *  die zwischenzeitliche Bearbeitung überschreiben. */
export function ueberfuehreAblauf(
  nachFahrplan: boolean,
  felder: AblaufFelder,
): AblaufFelder {
  const text = nachFahrplan
    ? felder.aufbau
    : fahrplanZuText(felder.offenStarten, felder.ueben, felder.wetteifern);
  return {
    offenStarten: nachFahrplan ? text : "",
    ueben: "",
    wetteifern: "",
    aufbau: nachFahrplan ? "" : text,
  };
}

/** Kurzdefinition je Übungstyp, sichtbar beim Zuweisen (Story 9 AC 4).
 *
 *  Quellenlage: Das Manual Fussball Jugendliche führt die drei Typen als
 *  Gliederung seines Good-Practice-Teils, definiert sie aber nicht einzeln.
 *  Belegt ist nur die Aussage zur Basisspielform (S. 56): «Die Basisspielform
 *  eignet sich besonders gut, um die Prinzipien sichtbar zu machen und zu
 *  beobachten. Für weitere Trainingsinhalte bedienst du dich der Spielformen
 *  und Übungen, wobei die Spielformen zu bevorzugen sind.» Die beiden übrigen
 *  Texte fassen diese Stelle und den Trainingsformen-Abschnitt (S. 24)
 *  zusammen; sie sind Paraphrase, kein Zitat. */
export const UEBUNGSTYP_DEFINITION: Record<string, string> = {
  basisspielform:
    "Die Referenzform eines Themas. Sie eignet sich besonders gut, um die Prinzipien sichtbar zu machen und zu beobachten.",
  spielform:
    "Spielnahe Form mit Gegner und Entscheidungen. Das Manual zieht sie der isolierten Übung vor.",
  "isolierte-form":
    "Übungsform ohne Spielsituation. Im Manual heisst sie schlicht «Übung» — hier umbenannt, weil die Applikation dieses Wort für das Objekt selbst braucht.",
};

/** Klartext jeder Heimat — die vier Kinderfussball-Trainingsteile und die drei
 *  Einstiegs-Unterblöcke des Juniorenschemas. Eine Quelle für Katalogkarten,
 *  Detailseiten, Breadcrumbs und Picker; ohne sie zeigten Übungen mit
 *  Junioren-Heimat dort ihren Roh-Slug (Epic #71). */
export const HEIMAT_LABEL: Record<string, string> = {
  ...trainingsteilLabels,
  ...juniorenHeimatLabels,
};
