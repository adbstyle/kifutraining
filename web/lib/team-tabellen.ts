import type { AdressParameter } from "@/lib/adresse";
import { MELDE_TEXT, type Meldeart } from "@/lib/meldezeitpunkte";
import { TEILNAHME_TEXT, type TeilnahmeUebersichtZeile } from "@/lib/teilnahme";

/* Sortierbare Tabellen unter «Spieler:innen» (#702): welche Spalten eine
   Tabelle hat, nach welcher sie sortiert ist und wie die Zeilen geordnet
   werden. Die Wahl steht in der Adresse (`?sort=<spalte>&dir=<auf|ab>`) wie
   in der Trainingsübersicht (lib/training-sortierung.ts): Sie übersteht
   Neuladen und geteilte Links, die Seite sortiert auf dem Server, die
   Spaltenköpfe sind Links (`SortierKopf`). Beim Wechsel des Reiters reist sie
   nicht mit (lib/team-bereiche.ts) — jede Tabelle hat ihre eigenen Spalten.

   Sortieren ohne Wertung (#702 OoS 1): keine Rangliste, keine Markierung;
   die Ordnung ist nur, was man gewählt hat.

   Rein: keine Importe aus `next/*`, die Prüfskripte laden die Datei ohne
   Server. */

export type Richtung = "auf" | "ab";

/** Eine Spalte einer sortierbaren Tabelle. Die erste Spalte eines Katalogs
 *  ist der Name — die Vorgabe, aufsteigend. */
export type TabellenSpalte<K extends string> = {
  schluessel: K;
  label: string;
  /** Die Gruppe der zweiten Kopfzeile (`GruppenTabelle`); ohne: keine. */
  gruppe?: string;
  /** Zahlen beginnen beim Grössten, Text bei A (wie die Trainingsübersicht). */
  ersteRichtung: Richtung;
};

export type TabellenSortierung<K extends string> = { spalte: K; richtung: Richtung };

export type TeilnahmeSpalte = "name" | keyof TeilnahmeUebersichtZeile;

const T = TEILNAHME_TEXT;
const ZAHL = { ersteRichtung: "ab" } as const;

/** Die Spalten der Teilnahme-Übersicht (#702, Prototyp «702 Teamübersicht»):
 *  der Name, dann die Gruppen «Trainings» und «Spiele». */
export const TEILNAHME_SPALTEN: readonly TabellenSpalte<TeilnahmeSpalte>[] = [
  { schluessel: "name", label: T.spielerin, ersteRichtung: "auf" },
  { schluessel: "tDa", label: T.spalte.tDa, gruppe: T.training, ...ZAHL },
  { schluessel: "tNicht", label: T.spalte.tNicht, gruppe: T.training, ...ZAHL },
  { schluessel: "tOhne", label: T.spalte.tOhne, gruppe: T.training, ...ZAHL },
  { schluessel: "gDa", label: T.spalte.gDa, gruppe: T.spiel, ...ZAHL },
  { schluessel: "gNicht", label: T.spalte.gNicht, gruppe: T.spiel, ...ZAHL },
  { schluessel: "gOhne", label: T.spalte.gOhne, gruppe: T.spiel, ...ZAHL },
  { schluessel: "gNa", label: T.spalte.gNa, gruppe: T.spiel, ...ZAHL },
  { schluessel: "gNg", label: T.spalte.gNg, gruppe: T.spiel, ...ZAHL },
];

export type MeldeSpalte = "name" | Meldeart;

/** Die Spalten der Meldezeitpunkte (#703, Variante M2): der Name, dann die
 *  drei Mediane unter «Median vor Beginn» (AK 11). Sie beginnen beim
 *  kürzesten Abstand — wer sich kurzfristig meldet, steht oben; «keine
 *  Angabe» steht in beiden Richtungen zuletzt (`sortiereZeilen`). */
export const MELDE_SPALTEN: readonly TabellenSpalte<MeldeSpalte>[] = [
  { schluessel: "name", label: T.spielerin, ersteRichtung: "auf" },
  { schluessel: "training_abmeldung", label: MELDE_TEXT.spalte.training_abmeldung, gruppe: MELDE_TEXT.gruppe, ersteRichtung: "auf" },
  { schluessel: "spiel_anmeldung", label: MELDE_TEXT.spalte.spiel_anmeldung, gruppe: MELDE_TEXT.gruppe, ersteRichtung: "auf" },
  { schluessel: "spiel_abmeldung", label: MELDE_TEXT.spalte.spiel_abmeldung, gruppe: MELDE_TEXT.gruppe, ersteRichtung: "auf" },
];

/** Ohne Wahl: die erste Spalte (der Name), aufsteigend. */
export function tabellenVorgabe<K extends string>(katalog: readonly TabellenSpalte<K>[]): TabellenSortierung<K> {
  return { spalte: katalog[0].schluessel, richtung: katalog[0].ersteRichtung };
}

/** Die Sortierung aus der Adresse. Eine unbekannte Spalte fällt auf die
 *  Vorgabe zurück, eine unbekannte Richtung auf die erste der Spalte. */
export function leseTabellenSortierung<K extends string>(
  sp: AdressParameter,
  katalog: readonly TabellenSpalte<K>[],
): TabellenSortierung<K> {
  const erster = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const sort = erster(sp.sort);
  const dir = erster(sp.dir);
  const spalte = katalog.find((s) => s.schluessel === sort);
  if (!spalte) return tabellenVorgabe(katalog);
  return { spalte: spalte.schluessel, richtung: dir === "auf" || dir === "ab" ? dir : spalte.ersteRichtung };
}

/** Die Adresswerte einer Sortierung — leer für die Vorgabe, damit sie die
 *  nackte Adresse ist. Für die Bereinigung (`adresseMitWerten`) und die Links. */
export function tabellenSortierWerte<K extends string>(
  s: TabellenSortierung<K>,
  katalog: readonly TabellenSpalte<K>[],
): { sort: string; dir: string } {
  const v = tabellenVorgabe(katalog);
  return s.spalte === v.spalte && s.richtung === v.richtung ? { sort: "", dir: "" } : { sort: s.spalte, dir: s.richtung };
}

/** Was ein Klick auf einen Kopf wählt: die aktive Spalte kehrt um, eine
 *  andere beginnt mit ihrer ersten Richtung. */
export function naechsteTabellenSortierung<K extends string>(
  aktuell: TabellenSortierung<K>,
  spalte: K,
  katalog: readonly TabellenSpalte<K>[],
): TabellenSortierung<K> {
  if (aktuell.spalte === spalte) return { spalte, richtung: aktuell.richtung === "auf" ? "ab" : "auf" };
  return { spalte, richtung: katalog.find((s) => s.schluessel === spalte)?.ersteRichtung ?? "auf" };
}

/** Die Adresse mit einer Sortierung; alles übrige (Eingrenzung, Zeitraum,
 *  die offene Spieler:in) bleibt stehen. */
export function tabellenSortierHref<K extends string>(
  pfad: string,
  sp: AdressParameter,
  s: TabellenSortierung<K>,
  katalog: readonly TabellenSpalte<K>[],
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "sort" || k === "dir" || v === undefined) continue;
    for (const w of Array.isArray(v) ? v : [v]) p.append(k, w);
  }
  const werte = tabellenSortierWerte(s, katalog);
  if (werte.sort) {
    p.set("sort", werte.sort);
    p.set("dir", werte.dir);
  }
  const qs = p.toString();
  return qs ? `${pfad}?${qs}` : pfad;
}

const namen = new Intl.Collator("de");

/** Was die Ordnung von einer Zeile braucht. */
type SortierbareZeile = { id: string; vorname: string; nachname: string };

function nachName(a: SortierbareZeile, b: SortierbareZeile): number {
  return namen.compare(a.vorname, b.vorname) || namen.compare(a.nachname, b.nachname);
}

/** Die Zeilen in der gewählten Ordnung, als neue Liste.
 *
 *  - Der Name ordnet nach Vorname, dann Nachname — so, wie er dasteht und
 *    wie die Liste ordnet (`nachSpielerName`).
 *  - `null` (keine Angabe) steht in BEIDEN Richtungen am Ende: «keine
 *    Angabe» ist kein kleiner Wert.
 *  - Gleichstand: nach Name aufsteigend, dann nach Kennung — dieselbe
 *    Ordnung bei jedem Laden. */
export function sortiereZeilen<Z extends SortierbareZeile, K extends string>(
  zeilen: readonly Z[],
  s: TabellenSortierung<K | "name">,
  wert: (zeile: Z, spalte: K) => number | null,
): Z[] {
  const faktor = s.richtung === "auf" ? 1 : -1;
  function vergleicheSpalte(a: Z, b: Z): number {
    if (s.spalte === "name") return faktor * nachName(a, b);
    const x = wert(a, s.spalte as K);
    const y = wert(b, s.spalte as K);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return faktor * (x - y);
  }
  return zeilen.slice().sort((a, b) => vergleicheSpalte(a, b) || nachName(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
