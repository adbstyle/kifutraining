import {
  junioren_block as blockLabels,
  junioren_trainingsteil as jTeilLabels,
  type JuniorenBlockSlug,
  type TrainingsteilSlug,
} from "@/lib/vocab";
import { kategorienFuer } from "@/lib/altersstufe";

/**
 * Fachliches Fundament des Juniorenschemas (Epic #71): Schema-Bestimmung,
 * Abbildungsregel, Struktur und Zeitbandbreiten.
 *
 * Quelle der Abbildungsregel ist das abgenommene Entscheidungsdokument
 * `docs/superpowers/specs/2026-08-15-junioren-abbildungsregel.md`; die
 * Zeilenverweise Z1–Z7 unten zeigen auf dessen Abschnitt 2.
 *
 * Eine Quelle für Editor, Server Actions und Ausgabe-Ansichten. Das
 * SQL-Pendant lebt in der Migration `junioren_schema` (Funktionen
 * `training_schema` und `set_training_stufen`) und MUSS inhaltlich identisch
 * bleiben — die Datenbank ist die Trust-Boundary, diese Datei die Sicht der
 * Applikation auf dieselbe Regel.
 */

export type Schema = "kifu" | "junioren";

// Die Aufteilung der Alterskategorien steht seit Story 1 (Übungswelten) in
// web/lib/altersstufe.ts — einmal, für Übung wie Training. Bewusst IN den
// Funktionen abgerufen statt als Modul-Konstante: `altersstufe.ts` greift
// seinerseits auf JUNIOREN_TEILE zu, und ein Aufruf zur Modul-Initialisierung
// liefe je nach Ladereihenfolge in die temporale Totzone dieser Datei.

/** Schema aus den Stufen: mindestens eine Junioren-Kategorie ⇒ Juniorenschema;
 *  sonst — auch ohne jede Stufe — Kinderfussball (Story 3 AC 1/2). */
export function schemaAusStufen(stufen: readonly string[]): Schema {
  const juniorenStufen = kategorienFuer("juniorenfussball");
  return stufen.some((s) => juniorenStufen.includes(s)) ? "junioren" : "kifu";
}

/** Trägt diese Stufen-Auswahl Kategorien BEIDER Schemata? Ein Training darf
 *  das nie (Story 3 AC 4) — eine Übung dagegen schon, sie kann beiden
 *  Schemata dienen (Story 2, Anmerkung). */
export function stufenMischen(stufen: readonly string[]): boolean {
  const kifuStufen = kategorienFuer("kinderfussball");
  const juniorenStufen = kategorienFuer("juniorenfussball");
  const kifu = stufen.some((s) => kifuStufen.includes(s));
  const jun = stufen.some((s) => juniorenStufen.includes(s));
  return kifu && jun;
}

/** Zuordnungs-Zustand «ohne Entsprechung im aktuellen Schema» (Story 3 PC 3).
 *
 *  Bewusst kein Vokabularwert: das ist kein Trainingsteil, sondern ein
 *  technischer Übergangszustand nach einem Schema-Wechsel. Er blockiert die
 *  Veröffentlichung, nie das Speichern, und löst sich auf, sobald der Trainer
 *  die Fassung einordnet oder entfernt (Story 3 PC 4). */
export const NACHARBEIT = "nacharbeit" as const;

/** Wo eine Fassung in einem Training liegt: ein Kinderfussball-Trainingsteil,
 *  ein Junioren-Unterblock oder die Nacharbeit. */
export type Einordnung = TrainingsteilSlug | JuniorenBlockSlug | typeof NACHARBEIT;

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

/** Die vier Kinderfussball-Trainingsteile — hier als Wertemenge für die
 *  Schema-Zuordnung einer Einordnung. */
const TRAININGSTEIL_SLUGS_KIFU: readonly string[] = [
  "auffangen",
  "einleitung",
  "hauptteil",
  "ausklang",
];

/** Alle sechs Blöcke in der flachen Reihenfolge des Schemas. */
export const JUNIOREN_BLOCK_SLUGS: JuniorenBlockSlug[] = JUNIOREN_TEILE.flatMap((t) =>
  t.bloecke.map((b) => b.slug),
);

/** Zu welchem Schema gehört eine Einordnung? `nacharbeit` und Unbekanntes
 *  gehören zu keinem und liefern `null`. SQL-Pendant:
 *  `training_schema_der_einordnung`. */
export function schemaDerEinordnung(einordnung: string): Schema | null {
  if ((TRAININGSTEIL_SLUGS_KIFU as readonly string[]).includes(einordnung)) return "kifu";
  if ((JUNIOREN_BLOCK_SLUGS as readonly string[]).includes(einordnung)) return "junioren";
  return null;
}

/** Abbildungsregel Kinderfussball → Juniorenschema (Entscheidungsdokument §2).
 *
 *  Lückenlos und überlappungsfrei: `trainingsteil` ist skalar, die
 *  Hauptteilkategorie je Zeile eindeutig, und die letzte Zeile fängt jede
 *  übrige Kombination. */
export function abbildungKifuZuJunioren(
  trainingsteil: string,
  hauptteilkategorie: string | null,
): JuniorenBlockSlug | typeof NACHARBEIT {
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
  return NACHARBEIT;
}

/** Rückrichtung Juniorenschema → Kinderfussball.
 *
 *  Fallback für den Schema-Wechsel: Der Regelfall ist die Konserve
 *  (`training_exercises.einordnung_vorher`), die die tatsächlich verlassene
 *  Einordnung zurückgibt und den Wechsel damit verlustfrei macht. Diese
 *  Tabelle greift nur, wo es keine Konserve gibt — bei einem von Beginn an
 *  als Junioren-Training angelegten Plan.
 *
 *  Hergeleitet aus der Heimat-Rückabbildung (Entscheidungsdokument §4.3) und
 *  der Umkehrung von Z3/Z5/Z6. `jun-spielformen` normalisiert dabei auf
 *  «Fussball spielen lernen»: Z3 und Z4 laufen hin zusammen und sind ohne
 *  Konserve nicht mehr trennbar. Die Einordnung bleibt frei änderbar. */
export function abbildungJuniorenZuKifu(
  block: string,
):
  | { trainingsteil: TrainingsteilSlug; hauptteilkategorie: string | null }
  | typeof NACHARBEIT {
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
      return NACHARBEIT;
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

/** Welche Übungs-Heimaten darf ein Block aufnehmen? Die Umkehrung der
 *  Abbildungsregel (Entscheidungsdokument §2/§4) — sie bestimmt, was der
 *  Picker anbietet UND was die Server Action beim Zuordnen akzeptiert. Beide
 *  müssen dieselbe Antwort geben, sonst zeigt der Picker Treffer, die das
 *  Hinzufügen abweist.
 *
 *  `hauptteilkategorien: null` heisst: keine Einschränkung auf dieser Achse. */
export function heimatFilterFuerEinordnung(einordnung: string): {
  trainingsteile: string[];
  hauptteilkategorien: string[] | null;
} {
  switch (einordnung) {
    // Kinderfussball-Teile: der gleichnamige Trainingsteil. Die Einleitung
    // nimmt zusätzlich die rückabgebildeten Junioren-Heimaten auf (§4.3,
    // Story 5b PC 2) — Explosivität bleibt aussen vor (PC 3).
    case "einleitung":
      return {
        trainingsteile: ["einleitung", "jun-aufwaermen", "jun-spielform-trainingsziel"],
        hauptteilkategorien: null,
      };
    case "auffangen":
    case "hauptteil":
    case "ausklang":
      return { trainingsteile: [einordnung], hauptteilkategorien: null };
    // Junioren-Blöcke gemäss Abbildungsregel.
    case "jun-aufwaermen":
      return { trainingsteile: ["einleitung", "jun-aufwaermen"], hauptteilkategorien: null };
    case "jun-spielform-trainingsziel":
      return { trainingsteile: ["jun-spielform-trainingsziel"], hauptteilkategorien: null };
    case "jun-explosivitaet":
      return { trainingsteile: ["jun-explosivitaet"], hauptteilkategorien: null };
    case "jun-spielformen":
      return {
        trainingsteile: ["hauptteil"],
        hauptteilkategorien: ["fussball-spielen-lernen", "vielseitigkeit-erleben"],
      };
    case "jun-spiel":
      return { trainingsteile: ["hauptteil"], hauptteilkategorien: ["fussball-spielen"] };
    case "jun-ausklang":
      return { trainingsteile: ["ausklang"], hauptteilkategorien: null };
    default:
      // Die Nacharbeit ist kein Zuordnungsziel.
      return { trainingsteile: [], hauptteilkategorien: null };
  }
}

// Die gültigen Zuordnungsziele eines Trainings standen bis zum Epic
// Übungswelten hier (`zuordnungsZiele`). Sie folgen jetzt aus der Altersstufe
// und kommen aus `einordnungsSlugsFuer()` in web/lib/altersstufe.ts — derselben
// Quelle, aus der auch eine Bibliotheks-Übung ihre Einordnung wählt.
