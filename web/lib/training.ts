import { JUNIOREN_TEILE } from "@/lib/junioren";
import type { Altersstufe } from "@/lib/altersstufe";
import type { JuniorenBlockSlug } from "@/lib/vocab";
import {
  trainingsteil as trainingsteilLabels,
  hauptteilkategorie as hauptteilkategorieLabels,
  type TrainingsteilSlug,
  type HauptteilkategorieSlug,
  type KategorieSlug,
  kategorienSlugs,
} from "@/lib/vocab";

/**
 * Domänen-Konstanten des Trainings-Moduls — eine Quelle für alle Schichten
 * (Query, Action, UI). Die Reihenfolge der vier Trainingsteile ist fix und
 * unveränderlich (Epic #8 EK1, Story #9 AC4).
 */

/** Die vier Trainingsteile in fester Durchführungsreihenfolge. */
export const TRAININGSTEILE: { slug: TrainingsteilSlug; label: string }[] = [
  { slug: "auffangen", label: trainingsteilLabels.auffangen },
  { slug: "einleitung", label: trainingsteilLabels.einleitung },
  { slug: "hauptteil", label: trainingsteilLabels.hauptteil },
  { slug: "ausklang", label: trainingsteilLabels.ausklang },
];

export const TRAININGSTEIL_SLUGS = TRAININGSTEILE.map((t) => t.slug);

/** Die drei Hauptteilkategorien in fester methodischer Reihenfolge (SFV-Manual,
 *  Abb. 14): vom geführten Lernen über die Vielseitigkeit zum freien Spiel
 *  (Story #23). Reihenfolge und Bezeichnungen stammen aus dem Vokabular. */
export const HAUPTTEILKATEGORIEN: {
  slug: HauptteilkategorieSlug;
  label: string;
}[] = [
  { slug: "fussball-spielen-lernen", label: hauptteilkategorieLabels["fussball-spielen-lernen"] },
  { slug: "vielseitigkeit-erleben", label: hauptteilkategorieLabels["vielseitigkeit-erleben"] },
  { slug: "fussball-spielen", label: hauptteilkategorieLabels["fussball-spielen"] },
];

export const HAUPTTEILKATEGORIE_SLUGS = HAUPTTEILKATEGORIEN.map((h) => h.slug);

/** Für die Veröffentlichung zwingend belegte Trainingsteile (Story #14 AC3,
 *  Enabler #26 AC3). */
export const PFLICHT_TEILE: TrainingsteilSlug[] = ["einleitung", "hauptteil"];

/** Einordnungen, die keine Dauer tragen. „Auffangen" ist der Teil vor dem
 *  eigentlichen Trainingsbeginn — es wird aufgesetzt, die Spielerinnen machen
 *  mit oder nicht; es zählt nicht zur Trainingsdauer. Diese Invariante wird auf
 *  DB-Ebene per CHECK erzwungen (`dauer_nicht_auffangen`).
 *
 *  Im Juniorenschema gibt es dazu kein Gegenstück: alle drei Trainingsteile
 *  tragen eine Dauer, ein Pendant zum Auffangen kennt es nicht. */
export const OHNE_DAUER_TEILE = new Set<string>(["auffangen"]);

/** Trägt diese Einordnung eine erfassbare Dauer? Gilt für beide Schemata. */
export function teilTraegtDauer(slug: string): boolean {
  return !OHNE_DAUER_TEILE.has(slug);
}

/** Schwellenwerte für den „ungewöhnlich viele Übungen"-Hinweis je Trainingsteil
 *  (Story #10 AC9 / Lösungsansatz 1). Mehr als dieser Wert ⇒ Hinweis, keine
 *  Blockade. */
export const ANZAHL_HINWEIS: Record<TrainingsteilSlug, number> = {
  auffangen: 3,
  einleitung: 3,
  hauptteil: 5,
  ausklang: 3,
};

/** Obergrenze des Trainingsziels in Zeichen (Story 10 AC 6). Entspricht der
 *  einzigen bereits bestehenden Textbegrenzung der Applikation. */
export const ZIEL_MAX = 200;

/** Granularität der Dauer-Eingabe in Minuten (Story #11 AC1). */
export const DAUER_SCHRITT = 5;

/** Deckt eine Übung (mit ihren Stufen) mindestens eine der Trainings-Stufen ab?
 *  Trägt das Training keine Stufe, gibt es keinen Abgleich (immer abgedeckt). */
export function stufenAbgedeckt(
  trainingStufen: readonly string[],
  uebungKategorien: readonly string[],
): boolean {
  if (trainingStufen.length === 0) return true;
  return trainingStufen.some((s) => uebungKategorien.includes(s));
}

/** Stabile Reihenfolge der Stufen-Anzeige — die fachliche Reihenfolge des
 *  Vokabulars (G, F, E, D, C, B, A; Story 2 AC 6). */
export function sortStufen(stufen: readonly string[]): KategorieSlug[] {
  return kategorienSlugs.filter((s) => stufen.includes(s));
}

/** Zuordnungen nach Trainingsteil gruppieren (feste Reihenfolge) und je Teil
 *  die Summe der erfassten Dauern bilden. Teile ohne Dauer (Auffangen) tragen
 *  immer `sum = 0` und `traegtDauer = false`. Generisch über die Item-Form, um
 *  Importzyklen mit dem Query-Layer zu vermeiden. Reihenfolge der Items bleibt
 *  erhalten (kommen bereits positionssortiert). */
export function groupByTeil<
  T extends { trainingsteil: string; durationMin: number | null },
>(items: T[]): {
  slug: TrainingsteilSlug;
  label: string;
  items: T[];
  sum: number;
  traegtDauer: boolean;
}[] {
  return TRAININGSTEILE.map(({ slug, label }) => {
    const teilItems = items.filter((i) => i.trainingsteil === slug);
    const traegtDauer = teilTraegtDauer(slug);
    const sum = traegtDauer
      ? teilItems.reduce((a, i) => a + (i.durationMin ?? 0), 0)
      : 0;
    return { slug, label, items: teilItems, sum, traegtDauer };
  });
}

/** Junioren-Zuordnungen nach Trainingsteil und Unterblock gruppieren (feste
 *  Reihenfolge des Schemas; Story 4 AC 1, Story 5a AC 1–3). Items kommen
 *  positionssortiert. Die Teil-Summe ist die Summe seiner Blöcke. */
export function groupJunioren<
  T extends { trainingsteil: string; durationMin: number | null },
>(
  items: T[],
): {
  slug: string;
  label: string;
  sum: number;
  bloecke: { slug: JuniorenBlockSlug; label: string; items: T[]; sum: number }[];
}[] {
  return JUNIOREN_TEILE.map((teil) => {
    const bloecke = teil.bloecke.map(({ slug, label }) => {
      const blockItems = items.filter((i) => i.trainingsteil === slug);
      return {
        slug,
        label,
        items: blockItems,
        sum: blockItems.reduce((a, i) => a + (i.durationMin ?? 0), 0),
      };
    });
    return {
      slug: teil.slug,
      label: teil.label,
      sum: bloecke.reduce((a, b) => a + b.sum, 0),
      bloecke,
    };
  });
}

/** Rang einer Hauptteilkategorie für die stabile Sortierung (−1 ⇒ unbekannt,
 *  z. B. Platzhalter ohne Kategorie → ans Ende). */
export function hkatRank(slug: string | null): number {
  if (slug == null) return HAUPTTEILKATEGORIEN.length;
  const i = HAUPTTEILKATEGORIE_SLUGS.indexOf(slug as HauptteilkategorieSlug);
  return i === -1 ? HAUPTTEILKATEGORIEN.length : i;
}

/** Hauptteil-Zuordnungen nach Unterkategorie gruppieren (feste methodische
 *  Reihenfolge) und je Unterkategorie die Dauer-Summe bilden. Items kommen
 *  bereits positionssortiert. Generisch über die Item-Form (Importzyklen
 *  vermeiden). */
export function groupHauptteil<
  T extends { hauptteilkategorie: string | null; durationMin: number | null },
>(items: T[]): {
  slug: HauptteilkategorieSlug;
  label: string;
  items: T[];
  sum: number;
}[] {
  return HAUPTTEILKATEGORIEN.map(({ slug, label }) => {
    const katItems = items.filter((i) => i.hauptteilkategorie === slug);
    const sum = katItems.reduce((a, i) => a + (i.durationMin ?? 0), 0);
    return { slug, label, items: katItems, sum };
  });
}

/** Render-Blöcke eines Kinderfussball-Trainingsteils: der Hauptteil wird in
 *  seine belegten Unterkategorien aufgeteilt (jeweils mit Unter-Überschrift und
 *  Dauer-Summe), alle übrigen Trainingsteile bleiben ein einzelner Block ohne
 *  Unter-Überschrift (`label = null`). Leere Unterkategorien erscheinen nicht
 *  (Story #23). Modul-intern: nach aussen führt einzig `leseGliederung`. */
function leseBloecke<
  T extends { hauptteilkategorie: string | null; durationMin: number | null },
>(section: {
  slug: TrainingsteilSlug;
  items: T[];
}): { key: string; label: string | null; sum: number; items: T[] }[] {
  if (section.slug !== "hauptteil")
    return [{ key: section.slug, label: null, sum: 0, items: section.items }];
  return groupHauptteil(section.items)
    .filter((g) => g.items.length > 0)
    .map((g) => ({ key: g.slug, label: g.label, sum: g.sum, items: g.items }));
}

/** Die Lese-Gliederung eines Trainings — eine Form für beide Schemata, damit
 *  Detailansicht, Durchführung und Druck nicht je zweimal verzweigen müssen.
 *
 *  Massgebend ist die Altersstufe des Trainings, nicht mehr seine
 *  Alterskategorien (Story 5 PC 2): Ein Junioren-Training ohne Alterskategorie
 *  ist möglich und folgt trotzdem der Junioren-Gliederung.
 *
 *  Kinderfussball: die vier Trainingsteile, der Hauptteil in seine belegten
 *  Unterkategorien geteilt, die übrigen Teile als ein Block ohne
 *  Unterüberschrift (`label: null`). Juniorenfussball: die drei Trainingsteile
 *  mit ihren belegten Unterblöcken. Leere Teile und Blöcke erscheinen in
 *  beiden Fällen nicht (Story 8 PC 1). */
export function leseGliederung<
  T extends {
    trainingsteil: string;
    hauptteilkategorie: string | null;
    durationMin: number | null;
  },
>(
  altersstufe: Altersstufe,
  items: T[],
): {
  key: string;
  label: string;
  sum: number;
  traegtDauer: boolean;
  bloecke: { key: string; label: string | null; sum: number; items: T[] }[];
}[] {
  if (altersstufe === "juniorenfussball") {
    return groupJunioren(items)
      .map((teil) => ({
        key: teil.slug,
        label: teil.label,
        sum: teil.sum,
        // Im Juniorenschema trägt jeder Trainingsteil eine Dauer; ein Pendant
        // zum dauerlosen Auffangen kennt es nicht.
        traegtDauer: true,
        bloecke: teil.bloecke
          .filter((b) => b.items.length > 0)
          .map((b) => ({ key: b.slug, label: b.label, sum: b.sum, items: b.items })),
      }))
      .filter((teil) => teil.bloecke.length > 0);
  }
  return groupByTeil(items)
    .filter((s) => s.items.length > 0)
    .map((s) => ({
      key: s.slug,
      label: s.label,
      sum: s.sum,
      traegtDauer: s.traegtDauer,
      bloecke: leseBloecke(s),
    }));
}

/** Datum lesbar formatieren (de-CH, z. B. "8. Juni 2026"). */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Dauer in Minuten lesbar formatieren ("45 min", "1 h", "1 h 15 min"). */
export function formatDuration(min: number): string {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
