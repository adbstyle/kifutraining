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

/** Die drei Junioren-Trainingsteile mit ihren Unterblöcken in fester
 *  Reihenfolge (Manual Fussball Jugendliche Abb. 19 für die Teile, J+S-
 *  Lernbaustein «Der Einstieg» für dessen drei Phasen; Story 4 AC 1,
 *  Story 5a AC 1/2). */
export const JUNIOREN_TEILE: {
  slug: "einstieg" | "hauptteil" | "abschluss";
  label: string;
  bloecke: { slug: JuniorenBlockSlug; label: string }[];
}[] = [
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
    bloecke: [{ slug: "jun-ausklang", label: blockLabels["jun-ausklang"] }],
  },
];

/** Alle sechs Blöcke in der flachen Reihenfolge des Schemas. */
export const JUNIOREN_BLOCK_SLUGS: JuniorenBlockSlug[] = JUNIOREN_TEILE.flatMap((t) =>
  t.bloecke.map((b) => b.slug),
);

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
  // Z6: Der Unterblock des Abschlusses heisst in Abb. 19 selbst «Ausklang».
  if (trainingsteil === "ausklang") return "jun-ausklang";
  // Z1: Auffangen ist Betreuung vor dem Training und zählt nicht zur
  // Trainingszeit — das Juniorenschema kennt keinen Vor-Trainings-Teil.
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
 *  der Umkehrung von Z3/Z5/Z6. `jun-spielformen` normalisiert dabei auf
 *  «Fussball spielen lernen»: Z3 und Z4 laufen hin zusammen und sind
 *  nachträglich nicht mehr trennbar. Die Einordnung bleibt frei änderbar. */
export function abbildungJuniorenZuKifu(
  block: string,
): { trainingsteil: TrainingsteilSlug; hauptteilkategorie: string | null } | null {
  switch (block) {
    case "jun-aufwaermen":
    case "jun-spielform-trainingsziel":
      return { trainingsteil: "einleitung", hauptteilkategorie: null };
    case "jun-spielformen":
      return { trainingsteil: "hauptteil", hauptteilkategorie: "fussball-spielen-lernen" };
    case "jun-spiel":
      return { trainingsteil: "hauptteil", hauptteilkategorie: "fussball-spielen" };
    case "jun-ausklang":
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
 *  Werte sind unverbindliche Richtwerte der Quelle. */
export const BANDBREITEN: Record<string, { min: number; max: number }> = {
  einstieg: { min: 20, max: 30 },
  "jun-aufwaermen": { min: 10, max: 12 },
  "jun-spielform-trainingsziel": { min: 6, max: 8 },
  "jun-explosivitaet": { min: 8, max: 10 },
  hauptteil: { min: 45, max: 65 },
  "jun-spielformen": { min: 30, max: 45 },
  "jun-spiel": { min: 15, max: 20 },
  abschluss: { min: 5, max: 10 },
  "jun-ausklang": { min: 5, max: 10 },
};

/** Vorgesehene Gesamtdauer eines Junioren-Trainings (Manual S. 43). */
export const GESAMTDAUER_JUNIOREN = 90;

/** Für die Veröffentlichung zwingend belegte Blöcke (Story 7 AC 1).
 *
 *  Der Spiel-Block fehlt bewusst: als freies Spiel ist er von der Pflicht
 *  ausgenommen und behält nur den Hinweis (Story 7 AC 2). */
export const JUNIOREN_PFLICHT_BLOECKE = [
  "jun-aufwaermen",
  "jun-spielform-trainingsziel",
  "jun-explosivitaet",
  "jun-spielformen",
  "jun-ausklang",
] as const;


/** Blöcke, deren Leere im Editor einen Hinweis erzeugt (Story 5a AC 8) —
 *  analog zum bestehenden Kinderfussball-Hinweis beim leeren freien Spiel.
 *  Der Hinweis blockiert nichts (AC 9). */
export const LEER_HINWEIS_BLOECKE: JuniorenBlockSlug[] = [
  "jun-spiel",
  "jun-spielform-trainingsziel",
  "jun-explosivitaet",
];

// Die gültigen Zuordnungsziele eines Trainings standen bis zum Epic
// Übungswelten hier (`zuordnungsZiele`). Sie folgen jetzt aus der Altersstufe
// und kommen aus `einordnungsSlugsFuer()` in web/lib/altersstufe.ts — derselben
// Quelle, aus der auch eine Bibliotheks-Übung ihre Einordnung wählt.
//
// Ebenfalls entfallen ist `heimatFilterFuerEinordnung`: die Verwendungs-Brücke
// der Abbildungsregel, die eine Kinderfussball-Übung in einen Junioren-Block
// liess, solange es dort keinen eigenen Bestand gab. Der Picker filtert seit
// Story 6 (Übungswelten) auf die Altersstufe des Trainings — was ein Block
// aufnimmt, sagt `vorlagenFilterFuer()` in web/lib/altersstufe.ts. Die
// Abbildungsregel selbst lebt weiter, aber nur noch als Vorschlag beim
// Überführen einer Übung (Story 4).
