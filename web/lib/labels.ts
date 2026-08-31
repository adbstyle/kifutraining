import {
  kategorien,
  trainingsteil as trainingsteilLabels,
  junioren_block as juniorenBlockLabels,
  erscheinungsform as erscheinungsformLabels,
  erscheinungsform_junioren as erscheinungsformJuniorenLabels,
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
 *  eine Junioren-Übung dort ihren Roh-Slug. */
export const EINORDNUNG_LABEL: Record<string, string> = {
  ...trainingsteilLabels,
  ...juniorenBlockLabels,
};

/** Klartext jeder Erscheinungsform beider Manuals. Angeboten wird immer nur
 *  das Vokabular EINER Altersstufe (`erscheinungsformenFuer`) — hier geht es
 *  ausschliesslich darum, einen bereits gespeicherten Slug zu beschriften, und
 *  dafür braucht es beide Kataloge. Eine Quelle statt dreier lokaler
 *  Zusammenführungen in Formular, Picker und Detailseite. */
export const ERSCHEINUNGSFORM_LABEL: Record<string, string> = {
  ...erscheinungsformLabels,
  ...erscheinungsformJuniorenLabels,
};
