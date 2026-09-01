import {
  junioren_block as blockLabels,
  junioren_trainingsteil as jTeilLabels,
  type JuniorenBlockSlug,
  type TrainingsteilSlug,
} from "@/lib/vocab";
/**
 * Fachliches Fundament des Juniorenschemas (Epic #71): Struktur,
 * Zeitbandbreiten und Abbildungsregel.
 *
 * Quelle der Abbildungsregel ist das abgenommene Entscheidungsdokument
 * `docs/superpowers/specs/2026-08-15-junioren-abbildungsregel.md`; die
 * Zeilenverweise Z1–Z7 unten zeigen auf dessen Abschnitt 2.
 *
 * Welchem Schema ein Training folgt, steht seit Story 1 (Übungswelten) als
 * geführte Angabe an der Zeile selbst (`trainings.altersstufe`) — es wird
 * nicht mehr aus Alterskategorien oder Trainingsteil erraten. Die
 * Schema-Bestimmung, die früher hier lag, ist damit ersatzlos entfallen.
 */

/** Wo eine Fassung in einem Training liegt: ein Kinderfussball-Trainingsteil
 *  oder ein Junioren-Unterblock. Welche der beiden Mengen gilt, entscheidet die
 *  Altersstufe des Trainings — gemischt wird nie, und einen dritten Zustand
 *  ausserhalb beider Schemata gibt es nicht. */
export type Einordnung = TrainingsteilSlug | JuniorenBlockSlug;

/** Die Junioren-Trainingsteile mit ihren Unterblöcken in fester Reihenfolge
 *  (Manual Fussball Jugendliche Abb. 19 für die Teile, J+S-Lernbaustein «Der
 *  Einstieg» für dessen drei Phasen; Story 4 AC 1, Story 5a AC 1/2).
 *
 *  Dem Manual vorangestellt ist das «Auffangen»: die Zeit, in der die
 *  Jugendlichen gestaffelt eintreffen. Das Manual Fussball Jugendliche kennt
 *  diesen Teil nicht — er ist eine bewusste Erweiterung darüber hinaus
 *  (PO-Entscheid 2026-08-31, Story #128) und bleibt in jeder Hinsicht
 *  freiwillig: keine Veröffentlichungspflicht, kein Leer-Hinweis, kein
 *  Zeitrichtwert. Wie sein Kinderfussball-Namensvetter zählt er nicht zur
 *  Trainingszeit und trägt darum keine Dauer (`OHNE_DAUER_TEILE` in
 *  web/lib/training.ts).
 *
 *  Ein Teil mit genau EINEM Block ist nicht untergliedert: Er erscheint überall
 *  ohne Block-Untertitel und ohne zweiten Richtwert (Story #127, PO-Entscheid
 *  2026-08-31). Gespeichert wird trotzdem der Block-Slug — die Einordnung
 *  bleibt einheitlich, bloss die Darstellung spart die leere Ebene. Kriterium
 *  ist `bloecke.length === 1`, siehe `istEinblockig()`. */
export const JUNIOREN_TEILE: {
  slug: "auffangen" | "einstieg" | "hauptteil" | "abschluss";
  label: string;
  bloecke: { slug: JuniorenBlockSlug; label: string }[];
}[] = [
  {
    slug: "auffangen",
    label: jTeilLabels.auffangen,
    bloecke: [{ slug: "jun-auffangen", label: blockLabels["jun-auffangen"] }],
  },
  {
    slug: "einstieg",
    label: jTeilLabels.einstieg,
    bloecke: [
      { slug: "jun-aufwaermen", label: blockLabels["jun-aufwaermen"] },
      {
        slug: "jun-spielform-trainingsziel",
        label: blockLabels["jun-spielform-trainingsziel"],
      },
      { slug: "jun-explosivitaet", label: blockLabels["jun-explosivitaet"] },
    ],
  },
  {
    slug: "hauptteil",
    label: jTeilLabels.hauptteil,
    bloecke: [
      { slug: "jun-spielformen", label: blockLabels["jun-spielformen"] },
      { slug: "jun-spiel", label: blockLabels["jun-spiel"] },
    ],
  },
  {
    slug: "abschluss",
    label: jTeilLabels.abschluss,
    bloecke: [{ slug: "jun-abschluss", label: blockLabels["jun-abschluss"] }],
  },
];

/** Alle sieben Blöcke in der flachen Reihenfolge des Schemas. */
export const JUNIOREN_BLOCK_SLUGS: JuniorenBlockSlug[] = JUNIOREN_TEILE.flatMap((t) =>
  t.bloecke.map((b) => b.slug),
);

/** Kommt dieser Trainingsteil ohne Untergliederung aus — trägt er also genau
 *  einen Block? Dann führen Editor, Formular und Leseansichten ihn als eine
 *  Ebene: kein Block-Untertitel, kein zweiter Richtwert, keine zweite Wahl
 *  (Story #127). */
export function istEinblockig(teilSlug: string): boolean {
  return JUNIOREN_TEILE.find((t) => t.slug === teilSlug)?.bloecke.length === 1;
}

/** Abbildungsregel Kinderfussball → Juniorenschema (Entscheidungsdokument §2).
 *
 *  Sie ist ein VORSCHLAG beim Überführen einer Übung in die andere Altersstufe
 *  (Story 4 PC 3), keine automatische Umordnung mehr: `null` heisst «keine
 *  Entsprechung», dort wählt der Trainer selbst.
 *
 *  Lückenlos und überlappungsfrei: `trainingsteil` ist skalar, die
 *  Hauptteilkategorie je Zeile eindeutig, und die letzte Zeile fängt jede
 *  übrige Kombination. */
export function abbildungKifuZuJunioren(
  trainingsteil: string,
  hauptteilkategorie: string | null,
): JuniorenBlockSlug | null {
  // Z1 (revidiert, PO 2026-08-31, Story #128): Das Auffangen hat neu eine
  // Entsprechung. Es steht in beiden Altersstufen für dasselbe — die Zeit vor
  // dem eigentlichen Trainingsbeginn, ohne Dauer —, seit das Juniorenschema um
  // ebendiesen Teil erweitert wurde. Die ursprüngliche Regel «ohne
  // Entsprechung» galt, solange das Juniorenschema keinen Vor-Trainings-Teil
  // kannte; siehe Errata 8 des Entscheidungsdokuments.
  if (trainingsteil === "auffangen") return "jun-auffangen";
  // Z2: Das Manual verwendet «Einleitung» und «Einstieg» synonym (Abb. 17).
  if (trainingsteil === "einleitung") return "jun-aufwaermen";
  if (trainingsteil === "hauptteil") {
    // Z5: «Fussball spielen» ist das freie Spiel — Begriffsbrücke in Abb. 19.
    if (hauptteilkategorie === "fussball-spielen") return "jun-spiel";
    // Z3/Z4: zielgerichtete und polysportive Formen sind im Juniorenschema
    // beide «Spielformen und unterstützende Übungen».
    if (
      hauptteilkategorie === "fussball-spielen-lernen" ||
      hauptteilkategorie === "vielseitigkeit-erleben"
    )
      return "jun-spielformen";
  }
  // Z6: Der Ausklang des Kinderfussballs entspricht dem Abschluss. Abb. 19
  // nennt dessen Inhalt selbst «Ausklang»; seit Story #127 ist der Abschluss
  // ein Block ohne Untergliederung und trägt darum den Namen des Teils.
  if (trainingsteil === "ausklang") return "jun-abschluss";
  // Z7: jede andere Kombination, damit die Regel deterministisch bleibt.
  return null;
}

/** Rückrichtung Juniorenschema → Kinderfussball.
 *
 *  Ebenfalls ein Vorschlag beim Überführen einer Übung (Story 4 PC 3); `null`
 *  heisst «keine Entsprechung». Die verlassene Altersstufe bewahrt nichts auf —
 *  die Konserve am Training ist mit dem Wechsel entfallen.
 *
 *  Hergeleitet aus der Heimat-Rückabbildung (Entscheidungsdokument §4.3) und
 *  der Umkehrung von Z1/Z3/Z5/Z6. `jun-spielformen` normalisiert dabei auf
 *  «Fussball spielen lernen»: Z3 und Z4 laufen hin zusammen und sind
 *  nachträglich nicht mehr trennbar. Die Einordnung bleibt frei änderbar. */
export function abbildungJuniorenZuKifu(
  block: string,
): { trainingsteil: TrainingsteilSlug; hauptteilkategorie: string | null } | null {
  switch (block) {
    // Umkehrung von Z1 (revidiert, PO 2026-08-31, Story #128).
    case "jun-auffangen":
      return { trainingsteil: "auffangen", hauptteilkategorie: null };
    case "jun-aufwaermen":
    case "jun-spielform-trainingsziel":
      return { trainingsteil: "einleitung", hauptteilkategorie: null };
    case "jun-spielformen":
      return { trainingsteil: "hauptteil", hauptteilkategorie: "fussball-spielen-lernen" };
    case "jun-spiel":
      return { trainingsteil: "hauptteil", hauptteilkategorie: "fussball-spielen" };
    case "jun-abschluss":
      return { trainingsteil: "ausklang", hauptteilkategorie: null };
    default:
      // Explosivität hat im Kinderfussball keine Entsprechung: diese
      // Trainingsform kennt das Kinderfussball-Manual nicht (§4.3).
      return null;
  }
}

/** Zeitbandbreiten in Minuten je Trainingsteil und Unterblock
 *  (Entscheidungsdokument §5: Manual Abb. 19 für die Teile, J+S-Lernbaustein
 *  für die Einstiegsphasen).
 *
 *  Orientierung, nie Speicher- oder Veröffentlichungsbedingung (Story 6
 *  AC 6). Die Ebenen dürfen rechnerisch auseinandergehen — die Summe der
 *  Einstiegs-Unterblöcke ergibt 24–30, der Trainingsteil nennt 20–30; beide
 *  Werte sind unverbindliche Richtwerte der Quelle.
 *
 *  Der Abschluss steht bewusst nur einmal hier — als Trainingsteil. Er ist
 *  einblockig, sein Block wird nirgends eigens überschrieben, und ein zweiter
 *  Eintrag `jun-abschluss` nennte denselben Richtwert 5–10 ein zweites Mal
 *  (Story #127). Ein fehlender Eintrag lässt `ZeitAbgleich` nichts rendern.
 *
 *  Das Auffangen fehlt hier ganz — weder als Teil `auffangen` noch als Block
 *  `jun-auffangen`. Es zählt nicht zur Trainingszeit (Story #128) und hat
 *  darum keinen Richtwert: Die 90 Minuten des Manuals gelten für das Training
 *  ab dem Einstieg, und ein Teil ohne Dauer hätte nichts, wogegen sich ein
 *  Richtwert abgleichen liesse. */
export const BANDBREITEN: Record<string, { min: number; max: number }> = {
  einstieg: { min: 20, max: 30 },
  "jun-aufwaermen": { min: 10, max: 12 },
  "jun-spielform-trainingsziel": { min: 6, max: 8 },
  "jun-explosivitaet": { min: 8, max: 10 },
  hauptteil: { min: 45, max: 65 },
  "jun-spielformen": { min: 30, max: 45 },
  "jun-spiel": { min: 15, max: 20 },
  abschluss: { min: 5, max: 10 },
};

/** Vorgesehene Gesamtdauer eines Junioren-Trainings (Manual S. 43). */
export const GESAMTDAUER_JUNIOREN = 90;

/** Für die Veröffentlichung zwingend belegte Blöcke (Story 7 AC 1).
 *
 *  Drei Blöcke fehlen bewusst: das Spiel, weil es als freies Spiel von der
 *  Pflicht ausgenommen ist (Story 7 AC 2), seit Story #127 der Abschluss — der
 *  PO hat ihm die Veröffentlichungspflicht am 2026-08-31 genommen —, und das
 *  Auffangen, das gar nicht zum Training gehört (Story #128). Die ersten
 *  beiden behalten den Leer-Hinweis, das Auffangen auch den nicht: Es bleibt
 *  in jeder Hinsicht freiwillig. Spiegel des Junioren-Zweigs der DB-Funktion
 *  `training_fehlende_bedingungen`. */
export const JUNIOREN_PFLICHT_BLOECKE = [
  "jun-aufwaermen",
  "jun-spielform-trainingsziel",
  "jun-explosivitaet",
  "jun-spielformen",
] as const;


/** Blöcke, deren Leere im Editor einen Hinweis erzeugt (Story 5a AC 8) —
 *  analog zum bestehenden Kinderfussball-Hinweis beim leeren freien Spiel.
 *  Der Hinweis blockiert nichts (AC 9). Der Abschluss ist seit Story #127
 *  dabei: An die Stelle seiner Veröffentlichungspflicht tritt der Hinweis.
 *  Das Auffangen fehlt bewusst — ein leeres Auffangen ist der Normalfall, kein
 *  Mangel (Story #128, Out of Scope 3). */
export const LEER_HINWEIS_BLOECKE: JuniorenBlockSlug[] = [
  "jun-spiel",
  "jun-spielform-trainingsziel",
  "jun-explosivitaet",
  "jun-abschluss",
];

// Was ein Trainingsblock aufnehmen darf, steht nicht hier, sondern in
// `vorlagenFilterFuer()` in web/lib/altersstufe.ts. Die Abbildungsregel oben
// dient allein noch als Vorschlag beim Überführen einer Übung in die andere
// Altersstufe (Story 4).
