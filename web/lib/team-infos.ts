// Infos zum Team (#598): Regeln und Texte für die Karte im Team, den privaten
// Link und die KI-Werkzeuge — eine Quelle, wortgleich. Die Regeln selbst
// stehen in der Datenebene (20261118100000_team_infos.sql); hier stehen ihre
// Zwillinge und Sätze. Die Gliederung liest `gliederung.ts`.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

import { infoTextBereinigt, infoTextLaenge } from "./info-text";

/** Zwilling des Checks `team_infos_text` und der Prüfung in
 *  `team_infos_festlegen` (AK 3): samt Gliederung, in Zeichen wie `char_length`. */
export const TEAM_INFOS_MAX = 10000;

/** Die Infos eines Teams; `text` leer = keine. `stand` ist der Tag der letzten
 *  Textänderung als «YYYY-MM-DD» (AK 7). */
export type TeamInfos = { text: string | null; stand: string | null };

/** «1'486» wie in der Schweiz — bewusst nicht `Intl.NumberFormat("de-CH")`,
 *  das den typografischen Apostroph «’» setzt. */
export function zahlCh(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/** «2026-11-12» → «12.11.2026». */
export function standDatum(stand: string): string {
  const [j, m, t] = stand.split("-");
  return `${t}.${m}.${j}`;
}

export const TEAM_INFOS_TEXT = {
  titel: "Infos zum Team",
  /** AK 4: wer sie sieht — unter dem Titel der Karte. */
  wer: "Für die Eltern am privaten Link, nicht beim Schnuppern",
  /** AK 4: ausführlich im Dialog. */
  werDialog:
    "Die Eltern aller Spieler:innen des Teams lesen das an ihrem privaten Link, und alle, denen sie den Link weitergeben. Wer schnuppert, sieht stattdessen das Info-Schreiben.",
  leerTitel: "Noch keine Infos zum Team",
  leer: "Schreib auf, wie euer Team trainiert, abmeldet und was mitkommt. Die Eltern lesen es an ihrem privaten Link.",
  verfassen: "Infos verfassen",
  bearbeiten: "Infos zum Team bearbeiten",
  feld: "Infos zum Team",
  unter: "Webadressen werden anklickbar. Leer gespeichert, sind die Infos entfernt.",
  zuLang: `Die Infos zum Team dürfen samt Gliederung höchstens ${zahlCh(TEAM_INFOS_MAX)} Zeichen lang sein.`,
  gespeichert: "Infos zum Team gespeichert.",
  entfernt: "Infos zum Team entfernt.",
  schreiben: "Schreiben",
  vorschau: "Vorschau",
  vorschauLeer: "Noch nichts geschrieben.",
  leiste: "Formatieren",
  titelKnopf: "Zwischentitel",
  fettKnopf: "Fett",
  aufzaehlungKnopf: "Aufzählung",
  nummerierungKnopf: "Nummerierung",
} as const;

/** «Stand 12.11.2026» (AK 7). */
export function teamInfosStand(stand: string): string {
  return `Stand ${standDatum(stand)}`;
}

/** «Zuletzt geändert am 12.11.2026» — im Dialog. */
export function teamInfosZuletzt(stand: string): string {
  return `Zuletzt geändert am ${standDatum(stand)}`;
}

/** Der Abschnitt am privaten Link (AK 6): «Infos zum Team FF11». */
export function teamInfosLinkTitel(team: string): string {
  return `${TEAM_INFOS_TEXT.titel} ${team}`;
}

/** Die Infos, wie die Datenebene sie speichert: Zeilenenden als \n,
 *  Leerraum am Anfang und Ende weg, leer = keine (Zwilling von
 *  `team_infos_festlegen`). */
export function teamInfosBereinigt(text: string | null | undefined): string | null {
  return infoTextBereinigt(text);
}

/** Zeichen wie `char_length`. */
export function teamInfosLaenge(text: string | null | undefined): number {
  return infoTextLaenge(text);
}

/** Was an den Infos nicht stimmt, sonst `null` (AK 3). */
export function teamInfosProblem(text: string | null | undefined): string | null {
  return teamInfosLaenge(text) > TEAM_INFOS_MAX ? TEAM_INFOS_TEXT.zuLang : null;
}
