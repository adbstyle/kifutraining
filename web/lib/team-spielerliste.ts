import { adresseMitWerten, liesListe, type AdressParameter } from "@/lib/adresse";
import { istUuid } from "@/lib/kennung";
import { LINK_STAENDE, type LinkStand, type Spieler } from "@/lib/spieler";
import { teamSpielerPfad } from "@/lib/team-bereiche";
import { bereinigeSuche, liesJahrgaenge } from "@/lib/verein-spielerliste";

/* Suche und Eingrenzung der Spielerliste eines Teams in der Adresse (Story
   #601): `?q=` die Suche, `?kader=` Kader und «ohne Kader», `?jahrgang=` die
   Jahrgänge, `?link=` der Stand des privaten Links (je kommagetrennt, die
   Schlüssel aus `FILTER_SCHLUESSEL` in lib/team-bereiche.ts, die die Reiter
   unter «Spieler:innen» weitertragen, AK 9, #704 AK 5). Muster: die Spieler:innen des Vereins
   (lib/verein-spielerliste.ts) — was nicht stimmt, fällt mit einer
   Weiterleitung weg, statt als unsichtbarer Filter stehenzubleiben.

   Anders als im Verein filtert nicht die Datenebene: Die Seite hat die ganze
   Liste des Teams ohnehin (höchstens 100 Spieler:innen), die Liste grenzt im
   Browser ein (`filtereSpieler`). Rein: keine Importe aus `next/*`, die
   Prüfskripte laden die Datei ohne Server. */

/** Der Wert in `?kader=` für «Ohne Kader». */
export const OHNE_KADER_WERT = "ohne";

export type TeamEingrenzung = {
  suche: string;
  kaderIds: string[];
  ohneKader: boolean;
  jahrgaenge: number[];
  /** In der Folge von `LINK_STAENDE`. */
  linkStaende: LinkStand[];
};

/** Was die Seite über die Liste des Teams weiss. */
type TeamBestand = { kader: readonly { id: string }[]; jahrgaenge: readonly number[] };

/** Die Eingrenzung aus der Adresse: die Suche bereinigt wie im Verein
 *  (`bereinigeSuche`); Kader nur als Kennung oder «ohne»; Jahrgänge wie im
 *  Verein (`liesJahrgaenge`); Link-Stände nur aus `LINK_STAENDE`; jeder Wert
 *  höchstens einmal. */
export function liesTeamEingrenzung(sp: AdressParameter): TeamEingrenzung {
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const kader = liesListe(sp.kader);
  const link = liesListe(sp.link);
  return {
    suche: bereinigeSuche(q ?? ""),
    kaderIds: [...new Set(kader.filter(istUuid))],
    ohneKader: kader.includes(OHNE_KADER_WERT),
    jahrgaenge: liesJahrgaenge(sp.jahrgang),
    linkStaende: LINK_STAENDE.filter((s) => link.includes(s)),
  };
}

/** Wirft weg, was es im Team nicht gibt: fremde oder entfernte Kader,
 *  Jahrgänge, die auf der Liste niemand trägt (AK 3) — und «Ohne Kader»,
 *  solange das Team keine Kader führt: Die Leiste zeigt den Filter dann
 *  nicht, er stünde unsichtbar da. Aus demselben Grund fällt bei leerer
 *  Liste (keine Jahrgänge) alles weg, auch Suche und Link-Stand. */
export function bereinigeTeamEingrenzung(e: TeamEingrenzung, bestand: TeamBestand): TeamEingrenzung {
  const kader = new Set(bestand.kader.map((k) => k.id));
  const jahre = new Set(bestand.jahrgaenge);
  const leer = jahre.size === 0;
  return {
    ...e,
    suche: leer ? "" : e.suche,
    linkStaende: leer ? [] : e.linkStaende,
    kaderIds: e.kaderIds.filter((id) => kader.has(id)),
    ohneKader: e.ohneKader && kader.size > 0,
    jahrgaenge: e.jahrgaenge.filter((j) => jahre.has(j)),
  };
}

/** Die Adresse, die dieselbe Eingrenzung sagt wie `e` — oder `null`, wenn
 *  `sp` das schon tut. Verglichen werden `?kader=`, `?jahrgang=` und
 *  `?link=` in der Schreibweise der Leiste («ohne» vor den Kennungen in der
 *  Folge der Adresse, Jahrgänge aufsteigend, Stände in der Folge von
 *  `LINK_STAENDE`); `?q=` nur, wenn `e` keine Suche mehr hat (so wird
 *  der Tippstand nie umgeschrieben); alles übrige reist unverändert mit. */
export function bereinigteTeamAdresse(pfad: string, sp: AdressParameter, e: TeamEingrenzung): string | null {
  return adresseMitWerten(pfad, sp, teamEingrenzungWerte(e));
}

/** Die Adresswerte, die `bereinigteTeamAdresse` vergleicht — für Seiten, die
 *  sie mit weiteren Werten in einer einzigen Weiterleitung bereinigen. */
export function teamEingrenzungWerte(e: TeamEingrenzung): Record<string, string> {
  return {
    kader: kaderFilterWerte(e).join(","),
    jahrgang: e.jahrgaenge.join(","),
    link: e.linkStaende.join(","),
    ...(e.suche === "" ? { q: "" } : {}),
  };
}

/** Die Adresse der Spielerliste mit einer Eingrenzung, in der Schreibweise
 *  der Leiste — etwa der Sprung aus der Übersicht der Link-Stände auf die
 *  offenen (#658 AK 2). Was `e` nicht nennt, bleibt ungesetzt. */
export function teamSpielerHref(teamId: string, e: Partial<TeamEingrenzung> = {}): string {
  const voll: TeamEingrenzung = { suche: "", kaderIds: [], ohneKader: false, jahrgaenge: [], linkStaende: [], ...e };
  const p = new URLSearchParams();
  const werte: [string, string][] = [
    ["q", voll.suche],
    ["kader", kaderFilterWerte(voll).join(",")],
    ["jahrgang", [...new Set(voll.jahrgaenge)].sort((a, b) => a - b).join(",")],
    ["link", LINK_STAENDE.filter((s) => voll.linkStaende.includes(s)).join(",")],
  ];
  for (const [k, v] of werte) if (v) p.set(k, v);
  const qs = p.toString();
  return `${teamSpielerPfad(teamId)}${qs ? `?${qs}` : ""}`;
}

/** Ist etwas gesetzt — Suche oder irgendeine Eingrenzung (AK 6, 8)? */
export function teamEingrenzungGesetzt(e: TeamEingrenzung): boolean {
  return e.suche !== "" || e.ohneKader || e.kaderIds.length > 0 || e.jahrgaenge.length > 0 || e.linkStaende.length > 0;
}

/** Die gewählten Werte des Filters «Kader», wie `AuswahlFilter` sie führt
 *  und `?kader=` sie schreibt: «ohne» und die Kennungen. */
export function kaderFilterWerte(e: TeamEingrenzung): string[] {
  return [...(e.ohneKader ? [OHNE_KADER_WERT] : []), ...e.kaderIds];
}

/** Ersatz für Zeichen, die NFD nicht zerlegt, `unaccent` aber umschreibt. */
const ERSATZ: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i" };

/** Ein Text für den Vergleich ohne Gross/Klein und Akzente (AK 1): bereinigt
 *  wie die Suche, zerlegt (NFD), ohne Zeichen für Akzente, klein. Eine
 *  Näherung an `lower(unaccent(…))`, mit dem der Verein auf der Datenebene
 *  sucht (verein_spielerliste); keine Umschreibung wie «ue» für «ü». */
export function falteSuchtext(text: string): string {
  return bereinigeSuche(text)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[ßæœøłđðþı]/g, (z) => ERSATZ[z]);
}

type Filterbar = Pick<Spieler, "vorname" | "nachname" | "jsNummer" | "jahrgang" | "kaderIds" | "linkStand">;

/** Die Spieler:innen, die die Eingrenzung erfüllen (AK 1–5): innerhalb eines
 *  Filters genügt ein gewählter Wert (oder), zwischen den Filtern gelten alle
 *  (und). Die Suche trifft Vorname, Nachname, beide in jeder Reihenfolge und
 *  die J+S-Nummer als Teiltext. Die Folge bleibt die der Liste. */
export function filtereSpieler<T extends Filterbar>(spieler: readonly T[], e: TeamEingrenzung): T[] {
  const suche = falteSuchtext(e.suche);
  const mitKader = e.ohneKader || e.kaderIds.length > 0;
  return spieler.filter((s) => {
    if (suche) {
      const texte = [`${s.vorname} ${s.nachname}`, `${s.nachname} ${s.vorname}`, s.jsNummer ?? ""];
      if (!texte.some((t) => falteSuchtext(t).includes(suche))) return false;
    }
    if (mitKader && !(s.kaderIds.some((k) => e.kaderIds.includes(k)) || (e.ohneKader && s.kaderIds.length === 0))) return false;
    if (e.jahrgaenge.length > 0 && !e.jahrgaenge.includes(s.jahrgang)) return false;
    if (e.linkStaende.length > 0 && !e.linkStaende.includes(s.linkStand)) return false;
    return true;
  });
}

/** Die Auswahl zum Zuteilen, beschnitten auf die sichtbaren Spieler:innen
 *  (AK 10): Wer ausgewählt war und aus der eingegrenzten Liste fällt, bekommt
 *  keinen Kader. */
export function sichtbareAuswahl(auswahl: readonly string[], sichtbar: readonly { id: string }[]): string[] {
  const ids = new Set(sichtbar.map((s) => s.id));
  return auswahl.filter((id) => ids.has(id));
}

/** Die Jahrgänge, die auf der ganzen Liste vorkommen (AK 3), aufsteigend. */
export function jahrgaengeDerListe(spieler: readonly { jahrgang: number }[]): number[] {
  return [...new Set(spieler.map((s) => s.jahrgang))].sort((a, b) => a - b);
}
