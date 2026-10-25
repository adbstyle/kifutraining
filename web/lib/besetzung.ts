// Die Mindestbesetzung eines Termins oder einer Terminserie (#521): eine
// feste Zahl an Trainer:innen oder ein Verhältnis Spieler:innen je
// Trainer:in. Die nötige Zahl rechnet allein diese Datei — sie folgt der
// Spielerzahl, die der Termin anzeigt (PC 2); die Datenebene hält nur die
// Angabe fest (Migration mindestbesetzung, CHECK tt_besetzung/ts_besetzung).
//
// REIN: nur lib/spieler — Oberfläche, Fachkern, KI und `check:kern` teilen
// dieselben Regeln und Sätze.
import type { Spielerzahl } from "@/lib/spieler";

export type BesetzungArt = "fest" | "verhaeltnis";
/** `null`: keine Mindestbesetzung. */
export type Mindestbesetzung = { art: BesetzungArt; zahl: number } | null;

/** Grenzen der Zahl (AK 5); Zwilling des CHECKs der Datenebene. */
export const BESETZUNG_MIN = 1;
export const BESETZUNG_MAX = 99;
export const BESETZUNG_ARTEN: readonly BesetzungArt[] = ["fest", "verhaeltnis"];

/** Dieselbe Angabe? */
export function gleicheBesetzung(a: Mindestbesetzung, b: Mindestbesetzung): boolean {
  return (a?.art ?? null) === (b?.art ?? null) && (a?.zahl ?? null) === (b?.zahl ?? null);
}

/** Aus den beiden Spalten der Datenebene. */
export function besetzungAus(art: string | null, zahl: number | null): Mindestbesetzung {
  return art && zahl !== null ? { art: art as BesetzungArt, zahl } : null;
}

/** Die Spielerzahl, die der Termin anzeigt: ab Beginn die Anwesenden, sonst die
 *  Angemeldeten bzw. die erwartete Zahl; `null`, wenn sie unbekannt ist. */
export function angezeigteSpielerzahl(z: Spielerzahl): number | null {
  if (z.quelle === "liste") return z.anwesend ?? z.angemeldet;
  return z.quelle === "erwartet" ? z.zahl : null;
}

/** Wie viele Trainer:innen nötig sind (AK 6, 7, 10); `null`: keine Bewertung —
 *  ohne Mindestbesetzung oder mit Verhältnis und unbekannter Spielerzahl. Das
 *  Verhältnis rundet kaufmännisch und verlangt mindestens eine, sobald
 *  Spieler:innen da sind. */
export function noetigeTrainer(m: Mindestbesetzung, spielerzahl: number | null): number | null {
  if (!m) return null;
  if (m.art === "fest") return m.zahl;
  if (spielerzahl === null) return null;
  if (spielerzahl <= 0) return 0;
  return Math.max(1, Math.round(spielerzahl / m.zahl));
}

/** Wie viele fehlen (AK 8); 0, wenn genug oder nicht bewertet. */
export function fehlendeTrainer(noetig: number | null, dabei: number): number {
  return noetig === null ? 0 : Math.max(0, noetig - dabei);
}

export const BESETZUNG_TEXT = {
  zahl: `Bitte eine ganze Zahl von ${BESETZUNG_MIN} bis ${BESETZUNG_MAX} angeben.`,
  art: "Wähle «Feste Zahl» oder «Verhältnis».",
  /** AK 15: Verhältnis ohne bekannte Spielerzahl. */
  ohneZahl: "Gerechnet wird, sobald eine Spielerzahl bekannt ist.",
} as const;

/** Was an der Angabe nicht stimmt, sonst `null` (AK 5). */
export function besetzungProblem(m: Mindestbesetzung | undefined): string | null {
  if (!m) return null;
  if (!BESETZUNG_ARTEN.includes(m.art)) return BESETZUNG_TEXT.art;
  if (!Number.isInteger(m.zahl) || m.zahl < BESETZUNG_MIN || m.zahl > BESETZUNG_MAX) return BESETZUNG_TEXT.zahl;
  return null;
}

/** Die Angabe in Worten: «mindestens 3 Trainer:innen» oder «1 Trainer:in je 17 Spieler:innen». */
export function besetzungText(m: NonNullable<Mindestbesetzung>): string {
  if (m.art === "fest") return `mindestens ${m.zahl} ${m.zahl === 1 ? "Trainer:in" : "Trainer:innen"}`;
  return `1 Trainer:in je ${m.zahl} ${m.zahl === 1 ? "Spieler:in" : "Spieler:innen"}`;
}

/** Der Hinweis beim Festlegen eines Verhältnisses (AK 14, 15). */
export function verhaeltnisHinweis(m: NonNullable<Mindestbesetzung>, spielerzahl: number | null, wort = "angemeldeten"): string {
  const n = noetigeTrainer(m, spielerzahl);
  if (n === null || spielerzahl === null) return BESETZUNG_TEXT.ohneZahl;
  return `Bei ${spielerzahl} ${wort} Spieler:innen ${n === 1 ? "ist" : "sind"} ${n} ${n === 1 ? "Trainer:in" : "Trainer:innen"} nötig. Die Zahl folgt den Ab- und Anmeldungen.`;
}

/** Der Satz der Lücke im Trainingsplan (Secondary Lozenge, AK 8). */
export function fehlenText(n: number): string {
  return n === 1 ? "1 Trainer:in fehlt" : `${n} Trainer:innen fehlen`;
}
