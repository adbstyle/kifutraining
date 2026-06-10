import {
  trainingsteil as trainingsteilLabels,
  type TrainingsteilSlug,
  type KategorieSlug,
} from "@/lib/vocab";

/**
 * Domänen-Konstanten des Trainingsplaners — eine Quelle für alle Schichten
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

/** Für die Veröffentlichung zwingend belegte Trainingsteile (Story #14 AC3,
 *  Enabler #26 AC3). */
export const PFLICHT_TEILE: TrainingsteilSlug[] = ["einleitung", "hauptteil"];

/** Trainingsteile, die keine Dauer tragen. „Auffangen" ist der Teil vor dem
 *  eigentlichen Trainingsbeginn — es wird aufgesetzt, die Spielerinnen machen
 *  mit oder nicht; es zählt nicht zur Trainingsdauer. Diese Invariante wird auf
 *  DB-Ebene per CHECK erzwungen. */
export const OHNE_DAUER_TEILE = new Set<TrainingsteilSlug>(["auffangen"]);

/** Trägt dieser Trainingsteil eine erfassbare Dauer? */
export function teilTraegtDauer(slug: TrainingsteilSlug): boolean {
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

/** Granularität der Dauer-Eingabe in Minuten (Story #11 AC1). */
export const DAUER_SCHRITT = 5;

/** Deckt eine Übung (mit ihren Stufen) mindestens eine der Plan-Stufen ab?
 *  Trägt der Plan keine Stufe, gibt es keinen Abgleich (immer abgedeckt). */
export function stufenAbgedeckt(
  planStufen: readonly string[],
  uebungKategorien: readonly string[],
): boolean {
  if (planStufen.length === 0) return true;
  return planStufen.some((s) => uebungKategorien.includes(s));
}

/** Stabile Reihenfolge der Stufen-Anzeige (G, F, E). */
export function sortStufen(stufen: readonly string[]): KategorieSlug[] {
  const order: KategorieSlug[] = ["G", "F", "E"];
  return order.filter((s) => stufen.includes(s));
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
