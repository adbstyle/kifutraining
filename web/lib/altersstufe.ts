import {
  altersstufeSlugs,
  erscheinungsformSlugs,
  erscheinungsform_juniorenSlugs,
  trainingsteilSlugs,
  junioren_blockSlugs,
  type AltersstufeSlug,
} from "@/lib/vocab";

/**
 * Die Altersstufe — nach welchem Lehrmittel eine Übung und ein Training
 * geführt werden: Manual Fussball Kinder oder Manual Fussball Jugendliche
 * (Story 1, Epic Übungswelten).
 *
 * Sie ist die oberste Dimension: Alterskategorien, Trainingsteile,
 * Erscheinungsformen und die Ablaufform folgen aus ihr. Bis zu dieser Story
 * wurden sie aus Alterskategorie und Trainingsteil erraten — diese Datei löst
 * das Raten ab.
 *
 * Jede Funktion nennt den SQL-Constraint, den sie spiegelt. Die Datenbank ist
 * die Trust-Boundary, diese Datei die Sicht der Applikation auf dieselbe
 * Regel; beide MÜSSEN inhaltlich identisch bleiben.
 */

export type Altersstufe = AltersstufeSlug;

/** Beide Altersstufen in fachlicher Reihenfolge (Kinderfussball zuerst). */
export const ALTERSSTUFEN: readonly Altersstufe[] = altersstufeSlugs;

/** Ist dieser Wert eine Altersstufe? Guard für alles, was aus DB oder Formular
 *  als roher String kommt. */
export function istAltersstufe(wert: string | null | undefined): wert is Altersstufe {
  return !!wert && (altersstufeSlugs as readonly string[]).includes(wert);
}

/** Die Alterskategorien SFV-Kinderfussball (G–E) bzw. -Juniorenfussball (D–A).
 *  Die Aufteilung ist überschneidungsfrei und deckt das ganze Vokabular ab.
 *
 *  Spiegelt die CHECKs `ex_kategorien_je_altersstufe`,
 *  `training_stufen_je_altersstufe` und `te_kategorien_je_altersstufe`. */
const KATEGORIEN: Record<Altersstufe, readonly string[]> = {
  kinderfussball: ["G", "F", "E"],
  juniorenfussball: ["D", "C", "B", "A"],
};

export function kategorienFuer(stufe: Altersstufe): readonly string[] {
  return KATEGORIEN[stufe];
}

/** Die Erscheinungsformen des jeweiligen Manuals. Die beiden Kataloge sind
 *  getrennt: was im Kinderfussball gilt, kennt das Junioren-Manual nicht und
 *  umgekehrt.
 *
 *  Spiegelt die CHECKs `erscheinungsform_je_altersstufe` und
 *  `te_erscheinungsform_je_altersstufe`. Welche Trainingsteile überhaupt eine
 *  tragen dürfen, steht davon getrennt in `ERSCHEINUNGSFORM_TEILE`
 *  (web/lib/labels.ts). */
export function erscheinungsformenFuer(stufe: Altersstufe): readonly string[] {
  return stufe === "juniorenfussball"
    ? erscheinungsform_juniorenSlugs
    : erscheinungsformSlugs;
}

/** Zu welcher Altersstufe gehört ein Trainingsteil? `null` für alles, was in
 *  keinem der beiden Lehrmittel vorkommt.
 *
 *  Spiegelt die CHECKs `ex_trainingsteil_je_altersstufe` und
 *  `te_trainingsteil_je_altersstufe`. */
export function altersstufeDerEinordnung(trainingsteil: string): Altersstufe | null {
  if ((trainingsteilSlugs as readonly string[]).includes(trainingsteil))
    return "kinderfussball";
  if ((junioren_blockSlugs as readonly string[]).includes(trainingsteil))
    return "juniorenfussball";
  return null;
}
