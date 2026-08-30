import {
  kategorien,
  trainingsteil as trainingsteilLabels,
  junioren_block as juniorenBlockLabels,
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

/** Das freie Spiel am Ende des Kinderfussball-Hauptteils. Es folgt keiner
 *  methodischen Progression und trägt darum eine Beschreibung statt des
 *  Fahrplans.
 *
 *  Wer und wann den Fahrplan trägt, steht nicht mehr hier: das Feld-Gating
 *  hängt seit dem Epic Übungswelten an der Altersstufe und lebt geschlossen in
 *  `web/lib/altersstufe.ts` (`brauchtFahrplan`, `traegtErscheinungsform`, …).
 *  Die drei früheren Wertemengen dieser Datei sind damit ersatzlos entfallen —
 *  sie beschrieben eine Welt, in der eine Übung beiden Lehrmitteln zugleich
 *  dienen konnte. */
export const FREIES_SPIEL = "fussball-spielen";

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

/** Klartext jeder Einordnung — die vier Trainingsteile des Manuals Fussball
 *  Kinder und die sechs Blöcke des Manuals Fussball Jugendliche. Eine Quelle
 *  für Katalogkarten, Detailseiten, Breadcrumbs und Picker; ohne sie zeigte
 *  eine Junioren-Übung dort ihren Roh-Slug.
 *
 *  Deckte bis zum Epic Übungswelten nur die drei Einstiegs-Blöcke ab. Mit der
 *  Trennung der Altersstufen ist jeder der sechs Blöcke ein möglicher Ort einer
 *  Junioren-Übung. */
export const EINORDNUNG_LABEL: Record<string, string> = {
  ...trainingsteilLabels,
  ...juniorenBlockLabels,
};
