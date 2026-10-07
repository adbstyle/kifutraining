// Monate und Tage im Trainingsplan (#329, Epic #401) und der Zeitraum des
// KI-Abrufs. Eine Regelquelle für Oberfläche und «team_plan_abrufen».
//
// REIN: importiert nur lib/serie.ts und lib/termin.ts (ebenfalls rein) —
// `check:kern` lädt sie mit tsx.
import { WOCHENTAG_KURZ, WOCHENTAG_LANG, maxEnddatum, plusTage, wochentagVon } from "@/lib/serie";
import { TERMIN_TEXT, istKalendertag } from "@/lib/termin";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
/** Die Monate abgekürzt, wie der Duden sie kürzt; kurze Namen bleiben ganz. */
const MONATE_KURZ = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

/** Der Monat (`YYYY-MM`) eines Kalendertags. */
export const monatVon = (iso: string): string => iso.slice(0, 7);

/** Der Monat `n` Monate vor oder nach `monat` (`YYYY-MM`); n darf negativ sein. */
export function plusMonate(monat: string, n: number): string {
  const [j, m] = monat.split("-").map(Number);
  const i = j * 12 + (m - 1) + n;
  return `${String(Math.floor(i / 12)).padStart(4, "0")}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export function monatsName(monat: string): string {
  const [j, m] = monat.split("-").map(Number);
  return `${MONATE[m - 1]} ${j}`;
}

/** Ein Kalendertag ausgeschrieben, wie ihn ein Screenreader liest: «7. Oktober 2026». */
export function tagText(iso: string): string {
  const [j, m, t] = iso.split("-").map(Number);
  return `${t}. ${MONATE[m - 1]} ${j}`;
}

/** Das Kalenderblatt eines Tages im Trainingsplan (#402 AK 1, PO 2):
 *  Wochentag, Tageszahl und Monat, kurz und nie mit Jahr — das Jahr steht in
 *  der Überschrift des Monats. Selbst gerechnet statt über `Intl`, damit
 *  Server und Browser Zeichen für Zeichen dasselbe rendern. */
export function kalenderblatt(iso: string): { wochentag: string; tag: number; monat: string } {
  const [, m, t] = iso.split("-").map(Number);
  return { wochentag: WOCHENTAG_KURZ[wochentagVon(iso)], tag: t, monat: MONATE_KURZ[m - 1] };
}

/** Ein Tag ausgeschrieben, ohne Jahr: «Dienstag, 6. Oktober» — der nächste
 *  Termin (#403 AK 8, OoS 4). */
export function tagOhneJahr(iso: string): string {
  const [, m, t] = iso.split("-").map(Number);
  return `${WOCHENTAG_LANG[wochentagVon(iso)]}, ${t}. ${MONATE[m - 1]}`;
}

/** Die Wochen eines Monats, Montag bis Sonntag, samt den Tagen des Vor- und
 *  Folgemonats: immer sechs, beginnend mit der Woche des 1. — so springt die
 *  Höhe beim Blättern nicht, wie im Google und Proton Kalender (PO
 *  2026-10-07). Sechs reichen für jeden Monat. */
export function monatsRaster(monat: string): { tag: string; imMonat: boolean }[][] {
  const erster = `${monat}-01`;
  const start = plusTage(erster, 1 - wochentagVon(erster));
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const tag = plusTage(start, w * 7 + i);
      return { tag, imMonat: monatVon(tag) === monat };
    }),
  );
}

export const ZEITRAUM_TEXT = {
  beideTage: "Gib «von» und «bis» zusammen an.",
  bisVorVon: "Der Bis-Tag darf nicht vor dem Von-Tag liegen.",
  zuLang: "Ein Zeitraum reicht höchstens bis zum gleichen Kalendertag im Folgejahr (nach einem 29. Februar bis zum 28. Februar).",
} as const;

/** Der Zeitraum des KI-Abrufs: beide Tage eingeschlossen, höchstens bis zum
 *  gleichen Kalendertag im Folgejahr — dieselbe Regel wie bei Serien (#329 AK 14). */
export function zeitraumProblem(von: string, bis: string): { feld: "von" | "bis"; text: string } | null {
  if (!istKalendertag(von)) return { feld: "von", text: TERMIN_TEXT.datum };
  if (!istKalendertag(bis)) return { feld: "bis", text: TERMIN_TEXT.datum };
  if (bis < von) return { feld: "bis", text: ZEITRAUM_TEXT.bisVorVon };
  if (bis > maxEnddatum(von)) return { feld: "bis", text: ZEITRAUM_TEXT.zuLang };
  return null;
}
