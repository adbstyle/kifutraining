// Die Regeln der Kader eines Teams (Epic #447, Story #452).
//
// Ein Kader ist ein vom Team benanntes Merkmal wie «Stärkeklasse 1»,
// «Torhüterinnen» oder «Aushilfe»; eine Spieler:in gehört keinem, einem oder
// mehreren an. Eine Regelquelle für die Karte «Kader» im Team-Bereich und die
// KI-Werkzeuge «kader_*» — der Fachkern (lib/kern/kader.ts) prüft damit vor
// jedem Schreiben, und die Datenebene meldet mit denselben Markern
// (KADER_MELDUNG), wenn sie trotzdem abweist.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
import { bereinigeName } from "@/lib/spieler";

/** Zwillinge des Checks `kader_name` und des Triggers `kader_grenze`. */
export const KADER_NAME_MAX = 30;
export const KADER_MAX = 20;

export const KADER_TEXT = {
  name: `Bitte einen Namen mit höchstens ${KADER_NAME_MAX} Zeichen angeben.`,
  /** AK 13: beim Anlegen und Umbenennen — KiFu prüft die Namen nicht (OoS 7). */
  heikel:
    "Eltern sehen die Kader ihres Kindes. Nenne darum keine Angaben zur Gesundheit oder vergleichbar heikle Einstufungen wie «verletzt» oder «Förderbedarf».",
  /** Was ein Kader bewirkt — über der Liste der Kader. */
  wirkung:
    "Ein Termin mit Kadern gilt für die Spieler:innen seiner Kader, ein Termin ohne Kader für alle. Wer keinem Kader angehört, sieht nur Termine ohne Kader.",
  einleitung:
    "Ein Kader fasst Spieler:innen zusammen, für die eigene Termine gelten, etwa «Stärkeklasse 1», «Torhüterinnen» oder «Aushilfe».",
  leer:
    "Noch keine Kader. Ohne Kader gilt jeder Termin für alle Spieler:innen. Mit Kadern wie «Stärkeklasse 1» oder «Torhüterinnen» bestimmst du, für wen ein Termin gilt.",
  /** Die Eingrenzung der Spielerliste auf Spieler:innen ohne Kader (AK 9). */
  ohneKader: "Ohne Kader",
} as const;

/** Die Sätze zu den Markern der Datenebene (Migration kader). */
export const KADER_MELDUNG = {
  KADER_DOPPELT: "Diesen Namen trägt im Team schon ein Kader.",
  KADER_VOLL: `Ein Team führt höchstens ${KADER_MAX} Kader.`,
  KADER_NICHT_GEFUNDEN: "Kader nicht gefunden.",
} as const;

/** Der CHECK des Kader-Namens, samt Anführungszeichen gesucht (wie
 *  `SPIELER_CHECKS`). Der Fachkern prüft vorab. */
export const KADER_CHECKS: [string, string][] = [['"kader_name"', KADER_TEXT.name]];

/** Länge wie Postgres `char_length`: in Code Points. */
function laenge(s: string): number {
  return [...s].length;
}

/** Was an einem Kader-Namen nicht stimmt, sonst `null` (AK 10). */
export function kaderNameProblem(name: string | null | undefined): string | null {
  const n = laenge(bereinigeName(name));
  return n < 1 || n > KADER_NAME_MAX ? KADER_TEXT.name : null;
}

/** Ob zwei Namen derselbe Kader sind: Gross/Klein und überzählige Leerzeichen
 *  unterscheiden nicht (AK 10). Zwilling von `kader_schluessel`. */
export function kaderSchluessel(name: string): string {
  return bereinigeName(name).toLowerCase();
}

// ── Abmeldungen verfallen (#453 AK 10, 12, 16) ───────────────────────────────

/** Der Marker, mit dem die Datenebene eine Änderung abweist, die Abmeldungen
 *  verfallen liesse, ohne dass genau diese Zahl bestätigt ist — dahinter die
 *  Zahl (`kader_nachher`). */
export const VERFALL_MARKER = "ABMELDUNGEN_VERFALLEN";

/** Die Zahl hinter dem Marker, sonst `null`. */
export function verfallAusFehler(message: string): number | null {
  const m = message.match(new RegExp(`${VERFALL_MARKER} (\\d+)`));
  return m ? Number(m[1]) : null;
}

/** Was eine Änderung an Kadern mit den Abmeldungen tut — vor dem Speichern. */
export function kaderVerfallText(n: number): string {
  return n === 1
    ? "Damit verfällt 1 Abmeldung: Der Termin gilt für diese Spieler:in nicht mehr. Gilt er später wieder für sie, ist sie angemeldet."
    : `Damit verfallen ${n} Abmeldungen: Die Termine gelten für diese Spieler:innen nicht mehr. Gilt ein Termin später wieder für sie, sind sie dort angemeldet.`;
}

/** Die vorab genannte Zahl stimmt nicht mehr (AK 12): der aktuelle Stand. */
export function kaderVerfallGeaendert(n: number): string {
  return `Inzwischen hat sich etwas geändert. ${kaderVerfallText(n)}`;
}

/** Dasselbe für den KI-Weg, mit dem Weg zur Bestätigung (AK 16). */
export function kaderVerfallBestaetigen(n: number): string {
  return `${kaderVerfallText(n)} Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}

/** Ein Kader, wie die Karte und die KI-Werkzeuge ihn führen. */
export type Kader = {
  id: string;
  name: string;
  /** Wer ihm angehört. */
  spielerIds: string[];
};

/** Nach Namen — so, wie sie dastehen. */
export function nachKaderName<T extends { name: string }>(liste: T[]): T[] {
  return [...liste].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Die Namen der Kader einer Spieler:in, in der Reihenfolge der Kader. */
export function kaderVon(spielerId: string, kader: Kader[]): Kader[] {
  return kader.filter((k) => k.spielerIds.includes(spielerId));
}

/** Wie sich eine Auswahl von Spieler:innen zu einem Kader verhält — für die
 *  Mehrfachauswahl der Spielerliste (AK 6): alle, einige oder keine gehören
 *  ihm an. */
export type Zugehoerigkeit = "alle" | "teil" | "keine";

export function zugehoerigkeit(kader: Kader, auswahl: readonly string[]): Zugehoerigkeit {
  const n = auswahl.filter((id) => kader.spielerIds.includes(id)).length;
  return n === 0 ? "keine" : n === auswahl.length ? "alle" : "teil";
}
