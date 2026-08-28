import { kategorien } from "@/lib/vocab";

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

// Trainingsteile mit methodischem Fahrplan + Themen-/Erscheinungsform-Feldern
// (vs. auffangen/ausklang mit flachem Aufbau). Eine Quelle für alle Schichten.
export const FAHRPLAN_TEILE = new Set<string>(["einleitung", "hauptteil"]);

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
