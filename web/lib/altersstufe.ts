import {
  altersstufeSlugs,
  erscheinungsformSlugs,
  erscheinungsform_juniorenSlugs,
  trainingsteil as trainingsteilLabels,
  trainingsteilSlugs,
  junioren_blockSlugs,
  type AltersstufeSlug,
} from "@/lib/vocab";
import { JUNIOREN_TEILE } from "@/lib/junioren";

/**
 * Die Altersstufe — nach welchem Lehrmittel eine Übung und ein Training
 * geführt werden: Manual Fussball Kinder oder Manual Fussball Jugendliche
 * (Story 1, Epic Übungswelten).
 *
 * Sie ist die oberste Dimension: Alterskategorien, Einordnung,
 * Erscheinungsformen, Übungstyp, Feldtyp bzw. Spielfeldgrösse,
 * Hauptteilkategorie und die Ablaufform folgen aus ihr. Bis zu diesem Epic
 * wurden sie aus Alterskategorie und Trainingsteil erraten — diese Datei löst
 * das Raten ab und ist die EINE Quelle des Feld-Gatings für Formular, Server
 * Action und Ausgabe.
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
 *  `te_erscheinungsform_je_altersstufe`. WELCHE Einordnungen überhaupt eine
 *  tragen dürfen, steht in `traegtErscheinungsform()`. */
export function erscheinungsformenFuer(stufe: Altersstufe): readonly string[] {
  return stufe === "juniorenfussball"
    ? erscheinungsform_juniorenSlugs
    : erscheinungsformSlugs;
}

/** Zu welcher Altersstufe gehört eine Einordnung? `null` für alles, was in
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

// ── Einordnung ──────────────────────────────────────────────────────────────

/** Eine wählbare Einordnung: der Slug und sein Klartext. */
export type EinordnungsOption = { slug: string; label: string };

/** Ein Trainingsteil des Juniorenschemas mit seinen Blöcken. Der
 *  Kinderfussball kennt diese zweite Ebene nicht — dort ist die Liste der
 *  Blöcke leer und der Teil selbst die Einordnung. */
export type EinordnungsGruppe = {
  teil: string;
  label: string;
  bloecke: EinordnungsOption[];
};

/** Die Einordnungen, unter denen eine Übung dieser Altersstufe wählen kann.
 *
 *  Kinderfussball: die vier Trainingsteile des Manuals Fussball Kinder, flach
 *  — dort gibt es keine zweite Ebene, `bloecke` bleibt leer.
 *  Juniorenfussball: die drei Trainingsteile mit ihren insgesamt sechs Blöcken.
 *  Gewählt wird der Block; der Teil bleibt sichtbar, damit die Zugehörigkeit
 *  erkennbar ist (Story 3 AK 3).
 *
 *  Spiegelt die CHECKs `ex_trainingsteil_je_altersstufe` und
 *  `te_trainingsteil_je_altersstufe`: die Vereinigung aller hier genannten
 *  Slugs ist genau deren erlaubte Wertemenge. */
export function einordnungenFuer(stufe: Altersstufe): EinordnungsGruppe[] {
  if (stufe === "juniorenfussball")
    return JUNIOREN_TEILE.map((t) => ({
      teil: t.slug,
      label: t.label,
      bloecke: t.bloecke.map((b) => ({ slug: b.slug, label: b.label })),
    }));
  return trainingsteilSlugs.map((t) => ({
    teil: t,
    label: trainingsteilLabels[t],
    bloecke: [],
  }));
}

/** Alle wählbaren Einordnungs-Slugs einer Altersstufe, flach. Das ist die
 *  Wertemenge, gegen die die Server-Validierung prüft. */
export function einordnungsSlugsFuer(stufe: Altersstufe): string[] {
  return einordnungenFuer(stufe).flatMap((g) =>
    g.bloecke.length > 0 ? g.bloecke.map((b) => b.slug) : [g.teil],
  );
}

// ── Feld-Gating ─────────────────────────────────────────────────────────────

/** Das freie Spiel am Ende des Kinderfussball-Hauptteils. Es folgt keiner
 *  methodischen Progression und trägt darum eine Beschreibung statt des
 *  Fahrplans. */
const FREIES_SPIEL = "fussball-spielen";

/** Trägt diese Einordnung Erscheinungsformen?
 *
 *  Kinderfussball: nur Einleitung und Hauptteil — Auffangen und Ausklang
 *  bleiben aussen vor. Juniorenfussball: alle sechs Blöcke, den Ausklang
 *  eingeschlossen. Er ist im Manual mehr als das Ausklingen des
 *  Kinderfussballs — Cool-down, Mobilität und Austausch, und der Austausch
 *  trifft «Positiv miteinander umgehen» (PO 2026-08-30).
 *
 *  Spiegelt die CHECKs `erscheinungsform_je_altersstufe` und
 *  `te_erscheinungsform_je_altersstufe`. */
export function traegtErscheinungsform(stufe: Altersstufe, einordnung: string): boolean {
  if (stufe === "juniorenfussball")
    return (junioren_blockSlugs as readonly string[]).includes(einordnung);
  return einordnung === "einleitung" || einordnung === "hauptteil";
}

/** Trägt diese Einordnung einen Übungstyp?
 *
 *  Nur im Juniorenfussball, und dort nur in den Blöcken, in denen eine
 *  Spielform vorkommen kann. Explosivität und Ausklang tragen keinen, weil die
 *  Typologie des Manuals spielnahe taktische Trainingsformen gliedert
 *  (PO 2026-08-30). Der Kinderfussball kennt den Übungstyp gar nicht.
 *
 *  Spiegelt den CHECK `ex_uebungstyp_nur_junioren` (gleichnamig auf beiden
 *  Tabellen). */
export function traegtUebungstyp(stufe: Altersstufe, einordnung: string): boolean {
  return (
    stufe === "juniorenfussball" &&
    [
      "jun-aufwaermen",
      "jun-spielform-trainingsziel",
      "jun-spielformen",
      "jun-spiel",
    ].includes(einordnung)
  );
}

/** Trägt eine Übung dieser Altersstufe einen Feldtyp?
 *
 *  Kleinfeld/Grossfeld/Freies Feld ist eine Kategorie des Manuals Fussball
 *  Kinder; das Junioren-Manual führt stattdessen eine Spielfeldgrösse in
 *  Metern.
 *
 *  Spiegelt den CHECK `ex_feldtyp_nur_kifu` (gleichnamig auf beiden Tabellen). */
export function traegtFeldtyp(stufe: Altersstufe): boolean {
  return stufe === "kinderfussball";
}

/** Trägt eine Übung dieser Altersstufe eine Spielfeldgrösse?
 *
 *  Das Gegenstück zum Feldtyp: nur im Juniorenfussball, wo das Manual sie zu
 *  praktisch jeder Trainingsform als eigene Angabe führt. Optional, aber
 *  paarweise — Länge und Breite in Metern.
 *
 *  Spiegelt die CHECKs `ex_spielfeld_nur_junioren` und
 *  `te_spielfeld_nur_junioren`. */
export function traegtSpielfeldgroesse(stufe: Altersstufe): boolean {
  return stufe === "juniorenfussball";
}

/** Trägt diese Einordnung eine Hauptteilkategorie?
 *
 *  Genau im Kinderfussball-Hauptteil, dort Pflicht. Der Juniorenfussball
 *  kennt sie nicht: er gliedert seinen Hauptteil bereits in die Blöcke
 *  «Spielformen und unterstützende Übungen» und «Spiel»; eine zweite
 *  Gliederungsebene wäre doppelt (PO 2026-08-30).
 *
 *  Spiegelt den CHECK `hauptteilkategorie_genau_bei_hauptteil` zusammen mit dem
 *  Trainingsteil-Wertebereich aus `ex_trainingsteil_je_altersstufe`: «hauptteil»
 *  ist im Juniorenfussball gar kein zulässiger Wert. */
export function traegtHauptteilkategorie(
  stufe: Altersstufe,
  einordnung: string,
): boolean {
  return stufe === "kinderfussball" && einordnung === "hauptteil";
}

/** Trägt der Ablauf hier den methodischen Fahrplan (statt eines
 *  zusammenhängenden Beschreibungstexts)?
 *
 *  Der Fahrplan «Offen starten – Üben – Wett-eifern» ist Didaktik des Manuals
 *  Fussball Kinder und bleibt ihm vorbehalten: eine Junioren-Übung trägt in
 *  allen sechs Blöcken einen Beschreibungstext, und zwar zwingend. Am Manual
 *  belegt — die Wörter «offen starten», «üben» und «wetteifern» kommen im
 *  Manual Fussball Jugendliche kein einziges Mal vor (PO 2026-08-30).
 *
 *  Im Kinderfussball gilt unverändert: Einleitung und Hauptteil tragen den
 *  Fahrplan, ausser das freie Spiel — es folgt keiner methodischen Progression
 *  und trägt eine Beschreibung. Die Kategorie wird nur im Hauptteil
 *  ausgewertet; ausserhalb trägt eine Übung ohnehin keine, und ein
 *  stehengebliebener Formularwert darf die Einleitung nicht um ihren Fahrplan
 *  bringen.
 *
 *  Spiegelt die CHECKs `ablauf_je_einordnung` und `te_ablauf_je_einordnung`. */
export function brauchtFahrplan(
  stufe: Altersstufe,
  einordnung: string,
  hauptteilkategorie: string | null,
): boolean {
  if (stufe === "juniorenfussball") return false;
  if (einordnung !== "einleitung" && einordnung !== "hauptteil") return false;
  return !(einordnung === "hauptteil" && hauptteilkategorie === FREIES_SPIEL);
}
