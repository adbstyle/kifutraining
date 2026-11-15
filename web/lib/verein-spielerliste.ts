import { liesListe, liesPositiveZahl, type AdressParameter } from "@/lib/adresse";
import { istUuid } from "@/lib/kennung";
import { JAHRGANG_MIN, NAME_MAX } from "@/lib/spieler";

/* Suche und Eingrenzung der Spieler:innen des Vereins in der Adresse (Story
   #580): `?q=` die Suche, `?team=` Teams und «ohne Team» (kommagetrennt),
   `?jahrgang=` die Jahrgänge, `?anzahl=` wie viele Zeilen stehen. Die Seite
   liest sie hier und prüft sie; was nicht stimmt, fällt weg, statt als
   unsichtbarer Filter stehenzubleiben (Muster Übungskatalog, Story #129 PC 3).
   Rein: keine Importe aus `next/*` oder `server-only`, die Prüfskripte laden
   die Datei ohne Server. */

/** So viele Zeilen zeigt die Liste auf einmal; «Weitere anzeigen» hebt
 *  `?anzahl=` um eine Seite an. Die Daten kommen immer ganz (AK 10). */
export const SPIELER_SEITE = 50;

/** Der Wert in `?team=` für «Ohne Team». */
export const OHNE_TEAM_WERT = "ohne";

/** Die längste Suche: Vorname, Leerzeichen, Nachname. */
export const SPIELER_SUCHE_MAX = 2 * NAME_MAX + 1;

export type SpielerEingrenzung = {
  suche: string;
  teamIds: string[];
  ohneTeam: boolean;
  jahrgaenge: number[];
};

/** Was die Antwort der Datenebene über den Bestand des Vereins weiss. */
export type SpielerBestand = { teams: readonly { id: string }[]; jahrgaenge: readonly number[] };

/** Die Eingrenzung aus der Adresse: Suche ohne Rand- und Mehrfach-Leerzeichen,
 *  höchstens `SPIELER_SUCHE_MAX` Zeichen; Teams nur als Kennung oder «ohne»;
 *  Jahrgänge nur als vierstellige Zahl ab `JAHRGANG_MIN`; jeder Wert höchstens einmal. */
export function liesSpielerEingrenzung(sp: AdressParameter): SpielerEingrenzung {
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const teams = liesListe(sp.team);
  return {
    suche: (q ?? "").trim().replace(/\s+/g, " ").slice(0, SPIELER_SUCHE_MAX).trim(),
    teamIds: [...new Set(teams.filter(istUuid))],
    ohneTeam: teams.includes(OHNE_TEAM_WERT),
    jahrgaenge: [...new Set(liesListe(sp.jahrgang).filter((j) => /^\d{4}$/.test(j)).map(Number))]
      .filter((j) => j >= JAHRGANG_MIN)
      .sort((a, b) => a - b),
  };
}

/** Wirft weg, was es im Verein nicht gibt: Teams, die nicht zu ihm gehören,
 *  und Jahrgänge, die niemand trägt. Sie träfen nie und stünden doch als
 *  Filter da, den die Leiste nicht zeigt. */
export function bereinigeEingrenzung(e: SpielerEingrenzung, bestand: SpielerBestand): SpielerEingrenzung {
  const teams = new Set(bestand.teams.map((t) => t.id));
  const jahre = new Set(bestand.jahrgaenge);
  return {
    ...e,
    teamIds: e.teamIds.filter((id) => teams.has(id)),
    jahrgaenge: e.jahrgaenge.filter((j) => jahre.has(j)),
  };
}

export function gleicheEingrenzung(a: SpielerEingrenzung, b: SpielerEingrenzung): boolean {
  return (
    a.suche === b.suche &&
    a.ohneTeam === b.ohneTeam &&
    a.teamIds.join() === b.teamIds.join() &&
    a.jahrgaenge.join() === b.jahrgaenge.join()
  );
}

/** Ist etwas gesetzt — Suche oder irgendeine Eingrenzung? */
export function eingrenzungGesetzt(e: SpielerEingrenzung): boolean {
  return e.suche !== "" || e.ohneTeam || e.teamIds.length > 0 || e.jahrgaenge.length > 0;
}

/** Die gewählten Werte des Filters «Team», wie `AuswahlFilter` sie führt
 *  und `?team=` sie schreibt: «ohne» und die Kennungen. */
export function teamFilterWerte(e: SpielerEingrenzung): string[] {
  return [...(e.ohneTeam ? [OHNE_TEAM_WERT] : []), ...e.teamIds];
}

/** Wie viele Zeilen stehen: eine Seite, oder so viele, wie `?anzahl=` nennt. */
export function liesSpielerAnzahl(sp: AdressParameter): number {
  return Math.max(SPIELER_SEITE, liesPositiveZahl(sp.anzahl) ?? 0);
}
