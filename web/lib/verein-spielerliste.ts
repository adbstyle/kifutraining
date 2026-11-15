import { liesListe, liesPositiveZahl, type AdressParameter } from "@/lib/adresse";
import { istUuid } from "@/lib/kennung";
import { JAHRGANG_MIN } from "@/lib/spieler";

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

/** Der Leerraum, den `spieler_text_bereinigt` zu einem Leerzeichen macht
 *  (`[[:space:]]` unter en_US.UTF-8 samt geschütztem und schmalem
 *  Leerzeichen; gemessen, geprüft in `pruefe-kern-db.ts`). Nicht `\s`: Das
 *  nähme U+FEFF dazu und liesse U+001C–U+001F und U+0085 stehen. */
const LEERRAUM = /[\t-\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

export type SpielerEingrenzung = {
  suche: string;
  teamIds: string[];
  ohneTeam: boolean;
  jahrgaenge: number[];
};

/** Was die Antwort der Datenebene über den Bestand des Vereins weiss. */
type SpielerBestand = { teams: readonly { id: string }[]; jahrgaenge: readonly number[] };

/** Die Suche so bereinigt, wie die Datenebene sie bereinigt
 *  (`spieler_text_bereinigt`: NFC, Leerraum zu einem Leerzeichen, Rand weg) —
 *  ungekappt: Eine Eingabe, die länger ist als jeder Name, trifft eben
 *  niemanden. Dieselbe Bereinigung schreibt das Suchfeld in die Adresse und
 *  erkennt daran das Echo der Seite (`FilterSuche`, `bereinige`). */
export function bereinigeSuche(q: string): string {
  return q.normalize("NFC").replace(LEERRAUM, " ").replace(/^ | $/g, "");
}

/** Die Eingrenzung aus der Adresse: die Suche bereinigt (`bereinigeSuche`),
 *  damit im Suchfeld genau steht, wonach gesucht wird; Teams nur als Kennung oder «ohne»;
 *  Jahrgänge nur als vierstellige Zahl ab `JAHRGANG_MIN`; jeder Wert höchstens einmal. */
export function liesSpielerEingrenzung(sp: AdressParameter): SpielerEingrenzung {
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const teams = liesListe(sp.team);
  return {
    suche: bereinigeSuche(q ?? ""),
    teamIds: [...new Set(teams.filter(istUuid))],
    ohneTeam: teams.includes(OHNE_TEAM_WERT),
    jahrgaenge: [...new Set(liesListe(sp.jahrgang).filter((j) => /^\d{4}$/.test(j)).map(Number))]
      .filter((j) => j >= JAHRGANG_MIN)
      .sort((a, b) => a - b),
  };
}

/** Wirft weg, was es im Verein nicht gibt: Teams, die nicht zu ihm gehören,
 *  und Jahrgänge, die niemand trägt. Sie träfen nie und stünden doch als
 *  Filter da, den die Leiste nicht zeigt (die Seite leitet dann auf
 *  `bereinigteAdresse` weiter). */
export function bereinigeEingrenzung(e: SpielerEingrenzung, bestand: SpielerBestand): SpielerEingrenzung {
  const teams = new Set(bestand.teams.map((t) => t.id));
  const jahre = new Set(bestand.jahrgaenge);
  return {
    ...e,
    teamIds: e.teamIds.filter((id) => teams.has(id)),
    jahrgaenge: e.jahrgaenge.filter((j) => jahre.has(j)),
  };
}

/** Die Adresse, die dieselbe Eingrenzung sagt wie `e` — oder `null`, wenn
 *  `sp` das schon tut. Verglichen werden `?team=` und `?jahrgang=` mit ihrer
 *  Schreibweise aus der Leiste (Kennungen in der Folge der Adresse,
 *  Jahrgänge aufsteigend, jeder Wert einmal); was davon abweicht —
 *  Unbrauchbares, Doppeltes, im Verein Unbekanntes —, verschwindet mit einer
 *  Weiterleitung, damit Adresse, Leiste und Abfrage dasselbe sagen und
 *  «Weitere anzeigen» oder ein Filterwechsel nichts Altes mitschleppen.
 *  Alles übrige (`q`, `anzahl`, …) reist unverändert mit. */
export function bereinigteAdresse(pfad: string, sp: AdressParameter, e: SpielerEingrenzung): string | null {
  const roh = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(",") : v ?? "");
  const team = teamFilterWerte(e).join(",");
  const jahrgang = e.jahrgaenge.join(",");
  if (roh(sp.team) === team && roh(sp.jahrgang) === jahrgang) return null;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "team" || k === "jahrgang" || v === undefined) continue;
    for (const w of Array.isArray(v) ? v : [v]) p.append(k, w);
  }
  if (team) p.set("team", team);
  if (jahrgang) p.set("jahrgang", jahrgang);
  const qs = p.toString();
  return qs ? `${pfad}?${qs}` : pfad;
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
