import { JUNIOREN_TEILE, istEinblockig, type Einordnung } from "@/lib/junioren";
import { istHauptteil } from "@/lib/gruppen";
import { FREIES_SPIEL, type Altersstufe } from "@/lib/altersstufe";
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

/** Einordnungen, die keine Dauer tragen. „Auffangen" ist der Teil vor dem
 *  eigentlichen Trainingsbeginn — es wird aufgesetzt, die Spielerinnen machen
 *  mit oder nicht; es zählt nicht zur Trainingsdauer. Diese Invariante wird auf
 *  DB-Ebene per CHECK erzwungen (`dauer_nicht_auffangen`).
 *
 *  Beide Altersstufen kennen ihn: `auffangen` im Kinderfussball, seit
 *  Story #128 der Block `jun-auffangen` im Juniorenfussball — dort als
 *  bewusste Erweiterung über das Manual Fussball Jugendliche hinaus. Weil die
 *  Einordnung eines Junioren-Trainings der BLOCK ist, steht hier der
 *  Block-Slug; sein Teil `auffangen` ist einblockig und teilt den Namen mit dem
 *  Kinderfussball-Teil, weshalb dieser Eintrag beide Ebenen abdeckt. */
export const OHNE_DAUER_TEILE = new Set<string>(["auffangen", "jun-auffangen"]);

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

/** Was der Editor zu einem leeren Abschnitt meldet, den das Lehrmittel als
 *  gesetzt ansieht — der VOLLSTÄNDIGE Wortlaut, an einem Ort und für beide
 *  Altersstufen (Story #126).
 *
 *  Jeder Text nennt zweierlei: dass der Abschnitt noch leer ist UND warum er
 *  ins Training gehört. Die neutrale Zeile «Noch keine Übung zugeordnet.»
 *  entfällt dort — dieselbe Sachlage zweimal untereinander und in zwei
 *  Schriftschnitten war der Mangel, den diese Story behebt. Wer hier steht,
 *  bekommt genau eine Meldung; wer fehlt, die neutrale Zeile.
 *
 *  Der Schlüssel ist die Stelle, an der die Meldung erscheint: im
 *  Juniorenschema der Block, im Kinderfussball die Hauptteilkategorie des
 *  freien Spiels (`FREIES_SPIEL`) — dort liegt die einzige Kinderfussball-Stelle
 *  mit einem solchen Hinweis. Die beiden Wertemengen überschneiden sich nicht.
 *
 *  Bewusst NICHT hier: das Auffangen beider Altersstufen (leer ist dort der
 *  Normalfall, kein Mangel — Story #128) sowie das Junioren-Aufwärmen, die
 *  Spielformen und alle übrigen Kinderfussball-Teile. Massgebend ist allein
 *  der PO-Entscheid, welche Blöcke einen Hinweis tragen (Story #126,
 *  Refinement 2026-08-31) — nicht die Veröffentlichungspflicht: Spielform zum
 *  Trainingsziel und Explosivität tragen beides.
 *
 *  Der Hinweis blockiert nichts: Speichern und Weiterbearbeiten bleiben
 *  unberührt (Story 5a AC 9). */
export const LEER_HINWEIS: Record<string, string> = {
  "jun-spielform-trainingsziel":
    "Die Spielform zum Trainingsziel ist noch leer — sie führt das Trainingsziel ein und spannt den roten Faden zum Hauptteil.",
  "jun-explosivitaet":
    "Die Explosivität ist noch leer — kurze, intensive Aktionen mit vollständiger Erholung gehören im Juniorenfussball in jeden Einstieg.",
  "jun-spiel":
    "Das Spiel ist noch leer — im Juniorenfussball gehört das freie Spiel in jedes Training.",
  "jun-abschluss":
    "Der Abschluss ist noch leer — Cool-down und gemeinsamer Austausch beenden jedes Training.",
  [FREIES_SPIEL]:
    "Das freie Spiel ist noch leer — im Kinderfussball gehört es in jedes Training.",
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
 *  positionssortiert. Die Teil-Summe ist die Summe seiner Blöcke.
 *
 *  `einblockig` markiert einen Teil, der genau einen Block trägt: Er ist nicht
 *  untergliedert und wird ohne Block-Überschrift und ohne zweiten Richtwert
 *  dargestellt (Story #127). Die Marke steht hier, weil sie aus der Struktur
 *  des Schemas folgt und nicht aus dem Inhalt — sie überlebt darum auch das
 *  Wegfiltern leerer Blöcke in den Leseansichten.
 *
 *  `traegtDauer` folgt dem Block, nicht dem Schema: Seit Story #128 gibt es
 *  auch im Juniorenfussball ein Auffangen, und das trägt keine Dauer. Wie in
 *  `groupByTeil` ist die Summe eines dauerlosen Blocks 0 statt der Summe
 *  seiner Zeilen — dort könnte ohnehin keine stehen (DB-CHECK). */
function groupJunioren<
  T extends { trainingsteil: string; durationMin: number | null },
>(
  items: T[],
): {
  slug: string;
  label: string;
  sum: number;
  traegtDauer: boolean;
  einblockig: boolean;
  bloecke: {
    slug: JuniorenBlockSlug;
    label: string;
    items: T[];
    sum: number;
    traegtDauer: boolean;
  }[];
}[] {
  return JUNIOREN_TEILE.map((teil) => {
    const bloecke = teil.bloecke.map(({ slug, label }) => {
      const blockItems = items.filter((i) => i.trainingsteil === slug);
      const traegtDauer = teilTraegtDauer(slug);
      return {
        slug,
        label,
        items: blockItems,
        sum: traegtDauer ? blockItems.reduce((a, i) => a + (i.durationMin ?? 0), 0) : 0,
        traegtDauer,
      };
    });
    return {
      slug: teil.slug,
      label: teil.label,
      sum: bloecke.reduce((a, b) => a + b.sum, 0),
      // Ein Teil trägt eine Dauer, sobald einer seiner Blöcke eine trägt.
      traegtDauer: bloecke.some((b) => b.traegtDauer),
      einblockig: istEinblockig(teil.slug),
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
function groupHauptteil<
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
 *  (Story #23). Modul-intern: nach aussen führt hier einzig `leseGliederung`. */
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
 *  Unterüberschrift (`label: null`). Juniorenfussball: die vier Trainingsteile
 *  mit ihren belegten Unterblöcken — ein Teil mit nur einem Block bleibt
 *  ebenfalls ohne Unterüberschrift (`label: null`), sonst stünde derselbe Name
 *  zweimal untereinander (Story #127). Leere Teile und Blöcke erscheinen in
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
        // Auch im Juniorenschema gibt es einen dauerlosen Teil: das Auffangen
        // (Story #128). Die Antwort kommt darum aus der Einordnung selbst,
        // nicht aus dem Schema.
        traegtDauer: teil.traegtDauer,
        bloecke: teil.bloecke
          .filter((b) => b.items.length > 0)
          .map((b) => ({
            key: b.slug,
            label: teil.einblockig ? null : b.label,
            sum: b.sum,
            items: b.items,
          })),
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

/** Ein Block der Editor-Gliederung: die kleinste Ebene, an der der Trainer eine
 *  Übung hinzufügt — eine Hauptteil-Unterkategorie im Kinderfussball, ein
 *  Unterblock im Juniorenfussball, sonst der Trainingsteil selbst. */
export type EditorBlock<T> = {
  /** Wohin eine hier hinzugefügte Übung eingeordnet wird: der
   *  Kinderfussball-Trainingsteil oder der Junioren-Block. */
  einordnung: Einordnung;
  /** Nur im Kinderfussball-Hauptteil: die Unterkategorie des Blocks. */
  hkat?: HauptteilkategorieSlug;
  label: string;
  /** Trägt der Block eine eigene Fläche mit Überschrift? Genau dann, wenn sein
   *  Teil mehr als einen Block hat — ein einblockiger Teil ist keine
   *  Verschachtelung und bekommt weder Rahmen noch zweite Überschrift
   *  (Story #127, PO-Entscheid #174). */
  flaeche: boolean;
  items: T[];
  sum: number;
  traegtDauer: boolean;
  /** Wogegen sich die Summe abgleicht (`BANDBREITEN`). Nur im Juniorenschema
   *  gesetzt: Das Kinderfussball-Manual gibt bewusst keine Zeiten vor, und sein
   *  Teil-Slug `hauptteil` träfe sonst den gleichnamigen Junioren-Richtwert. */
  richtwertSlug?: string;
  /** Was zu melden ist, wenn der Block leer bleibt (`LEER_HINWEIS`). */
  leerHinweis?: string;
  /** Ob die Übungen dieses Blocks auf Gruppen verteilt werden (Story #150).
   *  Wahr allein im Hauptteil — im Kinderfussball in allen drei
   *  Unterkategorien, im Juniorenfussball in den Blöcken «Spielformen» und
   *  «Spiel». Quelle ist `istHauptteil`, damit die Antwort nicht an zwei
   *  Orten steht. */
  traegtGruppen: boolean;
};

/** Ein Trainingsteil der Editor-Gliederung — eine Karte im Editor. */
export type EditorTeil<T> = {
  key: string;
  label: string;
  sum: number;
  traegtDauer: boolean;
  /** Richtwert des Teils; nur im Juniorenschema gesetzt (siehe EditorBlock). */
  richtwertSlug?: string;
  /** Ungewöhnlich viele Übungen für diesen Teil (`ANZAHL_HINWEIS`). */
  tooMany: boolean;
  /** Zuordnungen des Teils ohne erfasste Dauer. */
  missing: number;
  bloecke: EditorBlock<T>[];
};

/** Die Editor-Gliederung eines Trainings — das Gegenstück zu `leseGliederung`
 *  für die Bearbeitung, eine Form für beide Schemata.
 *
 *  Der Unterschied zur Leseansicht ist die Vollständigkeit: Hier bleibt jeder
 *  Teil und jeder Block stehen, auch der leere. Beim Planen ist gerade die
 *  Lücke die Information — die Leseansicht darf sie wegfiltern, der Editor
 *  nicht (Story 4 AC 1, Story 5a AC 1–3).
 *
 *  Dauern kommen aus `durationMin` der übergebenen Zuordnungen. Der Editor
 *  überlagert sie vor dem Aufruf mit dem lokal Erfassten, damit Summen und
 *  «ohne Dauer»-Zählungen sofort mitgehen statt erst nach der Server-Antwort.
 *
 *  Die Summe eines Kinderfussball-Teils zählt ALLE seine Zuordnungen — auch
 *  eine Hauptteil-Fassung ohne Unterkategorie, die in keinem Block erscheint;
 *  sie soll in der Rechnung nicht verschwinden. */
export function editorGliederung<
  T extends {
    trainingsteil: string;
    hauptteilkategorie: string | null;
    durationMin: number | null;
  },
>(altersstufe: Altersstufe, items: T[]): EditorTeil<T>[] {
  // Die Fläche folgt allein der Anzahl Blöcke — an einer Stelle entschieden,
  // damit die beiden Schemata darin nicht auseinanderlaufen können.
  const mitFlaeche = (bloecke: Omit<EditorBlock<T>, "flaeche">[]): EditorBlock<T>[] =>
    bloecke.map((b) => ({ ...b, flaeche: bloecke.length > 1 }));

  if (altersstufe === "juniorenfussball") {
    return groupJunioren(items).map((teil) => ({
      key: teil.slug,
      label: teil.label,
      sum: teil.sum,
      traegtDauer: teil.traegtDauer,
      richtwertSlug: teil.slug,
      // Den «ungewöhnlich viele Übungen»-Hinweis gibt es nur im
      // Kinderfussball (`ANZAHL_HINWEIS`); im Juniorenschema übernimmt die
      // Zeit-Orientierung diese Rolle.
      tooMany: false,
      missing: teil.bloecke
        .filter((b) => b.traegtDauer)
        .reduce((a, b) => a + b.items.filter((i) => i.durationMin == null).length, 0),
      bloecke: mitFlaeche(
        teil.bloecke.map((b) => ({
          einordnung: b.slug,
          label: b.label,
          items: b.items,
          sum: b.sum,
          traegtDauer: b.traegtDauer,
          richtwertSlug: b.slug,
          leerHinweis: LEER_HINWEIS[b.slug],
          traegtGruppen: istHauptteil(b.slug),
        })),
      ),
    }));
  }

  return TRAININGSTEILE.map(({ slug, label }) => {
    const teilItems = items.filter((i) => i.trainingsteil === slug);
    const traegtDauer = teilTraegtDauer(slug);
    const summe = (xs: T[]) =>
      traegtDauer ? xs.reduce<number>((a, i) => a + (i.durationMin ?? 0), 0) : 0;
    return {
      key: slug,
      label,
      sum: summe(teilItems),
      traegtDauer,
      tooMany: teilItems.length > ANZAHL_HINWEIS[slug],
      missing: traegtDauer ? teilItems.filter((i) => i.durationMin == null).length : 0,
      bloecke: mitFlaeche(
        // Der Hauptteil ist in seine drei Unterkategorien gegliedert
        // (Story #23), alle übrigen Teile bleiben ein einzelner Block.
        slug === "hauptteil"
          ? groupHauptteil(teilItems).map((g) => ({
              einordnung: slug,
              hkat: g.slug,
              label: g.label,
              items: g.items,
              sum: g.sum,
              traegtDauer,
              leerHinweis: LEER_HINWEIS[g.slug],
              traegtGruppen: istHauptteil(slug),
            }))
          : [
              {
                einordnung: slug,
                label,
                items: teilItems,
                sum: summe(teilItems),
                traegtDauer,
                leerHinweis: LEER_HINWEIS[slug],
                traegtGruppen: istHauptteil(slug),
              },
            ],
      ),
    };
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
