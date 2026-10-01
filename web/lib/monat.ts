// Der Monatsüberblick des Team-Kalenders (#329) und der Zeitraum des
// KI-Abrufs. Eine Regelquelle für Oberfläche und «team_plan_abrufen».
//
// REIN: importiert nur lib/serie.ts und lib/termin.ts (ebenfalls rein) —
// `check:kern` lädt sie mit tsx.
import { maxEnddatum, plusTage, wochentagVon } from "@/lib/serie";
import { TERMIN_TEXT, istKalendertag } from "@/lib/termin";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Ein Monat als `YYYY-MM`. */
export const istMonat = (s: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const monatVon = (iso: string): string => iso.slice(0, 7);

export function plusMonate(monat: string, n: number): string {
  const [j, m] = monat.split("-").map(Number);
  const i = j * 12 + (m - 1) + n;
  return `${String(Math.floor(i / 12)).padStart(4, "0")}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export function monatsName(monat: string): string {
  const [j, m] = monat.split("-").map(Number);
  return `${MONATE[m - 1]} ${j}`;
}

/** Die Wochen eines Monats, Montag bis Sonntag, samt den Tagen des Vor- und
 *  Folgemonats, die die erste und letzte Woche füllen. */
export function monatsRaster(monat: string): { tag: string; imMonat: boolean }[][] {
  const erster = `${monat}-01`;
  const letzter = plusTage(`${plusMonate(monat, 1)}-01`, -1);
  const start = plusTage(erster, 1 - wochentagVon(erster));
  const ende = plusTage(letzter, 7 - wochentagVon(letzter));
  const wochen: { tag: string; imMonat: boolean }[][] = [];
  for (let d = start; d <= ende; d = plusTage(d, 7))
    wochen.push(
      Array.from({ length: 7 }, (_, i) => {
        const tag = plusTage(d, i);
        return { tag, imMonat: monatVon(tag) === monat };
      }),
    );
  return wochen;
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
