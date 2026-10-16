// Die Regeln der Spielerliste eines Teams (Epic #433, Story #434) und die
// Spielerzahl, die aus ihr folgt.
//
// Eine Regelquelle für die Spielerliste der Oberfläche und die KI-Werkzeuge
// «spieler_*» — der Fachkern (lib/kern/spieler.ts) prüft damit vor jedem
// Schreiben, und die Datenebene meldet mit denselben Markern
// (SPIELER_MELDUNG), wenn sie trotzdem abweist. Ob zwei Angaben dieselbe
// Spieler:in meinen (Gross/Klein, Bindestrich, Apostroph), entscheidet allein
// die Datenebene (`spieler_text_schluessel`, Unique-Index `spieler_eindeutig`).
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

/** Zwillinge der Checks `spieler_vorname`, `spieler_nachname`, `spieler_js`,
 *  `spieler_jahrgang` und der Obergrenze im Trigger `spieler_vorher`. */
export const NAME_MAX = 60;
export const JS_MAX = 20;
export const JAHRGANG_MIN = 1000;
export const JAHRGANG_MAX = 9999;
export const SPIELER_MAX = 200;

export const SPIELER_TEXT = {
  vorname: `Bitte einen Vornamen mit höchstens ${NAME_MAX} Zeichen angeben.`,
  nachname: `Bitte einen Nachnamen mit höchstens ${NAME_MAX} Zeichen angeben.`,
  jahrgang: "Den Jahrgang als vierstellige Jahreszahl eingeben, etwa 2017.",
  jsNummer: `Die J+S-Nummer darf höchstens ${JS_MAX} Zeichen lang sein.`,
} as const;

/** Die Sätze zu den Markern der Datenebene (Migration spielerliste). */
export const SPIELER_MELDUNG = {
  SPIELER_DOPPELT:
    "Diese Spieler:in steht schon auf der Liste. Unterscheide zwei Gleichnamige mit einem Zusatz im Vornamen.",
  SPIELERLISTE_VOLL: `Eine Spielerliste fasst höchstens ${SPIELER_MAX} Spieler:innen.`,
  SPIELER_NICHT_GEFUNDEN: "Spieler:in nicht gefunden.",
  SPIELERLISTE_FUEHRT_ZAHL:
    "Das Team führt eine Spielerliste: Die Spielerzahl anstehender Termine kommt aus ihr und lässt sich nicht von Hand festlegen.",
} as const;

/** Die CHECKs der Spielerliste, samt Anführungszeichen gesucht (wie
 *  `TERMIN_CHECKS`). Der Fachkern prüft vorab; die Meldung trifft nur, wer
 *  ihn umgeht. */
export const SPIELER_CHECKS: [string, string][] = [
  ['"spieler_vorname"', SPIELER_TEXT.vorname],
  ['"spieler_nachname"', SPIELER_TEXT.nachname],
  ['"spieler_jahrgang"', SPIELER_TEXT.jahrgang],
  ['"spieler_js"', SPIELER_TEXT.jsNummer],
];

/** Die gespeicherte Form eines Namens: NFC, jeder Leerraum ein Leerzeichen,
 *  aussen keiner. Zwilling von `spieler_text_bereinigt`. */
export function bereinigeName(s: string | null | undefined): string {
  return (s ?? "").normalize("NFC").replace(/[\s   ]+/g, " ").trim();
}

/** Länge wie Postgres `char_length`: in Code Points, nicht in UTF-16-Einheiten. */
function laenge(s: string): number {
  return [...s].length;
}

export type SpielerEingabe = {
  vorname: string;
  nachname: string;
  /** Wie getippt: «2017». */
  jahrgang: string | number;
  /** Optional; leer heisst keine. */
  jsNummer?: string | null;
};

export type SpielerFeld = "vorname" | "nachname" | "jahrgang" | "js_nummer";

/** Was an einer Spieler:in nicht stimmt, sonst `null` (#434 AK 6, 14). */
export function spielerProblem(e: SpielerEingabe): { feld: SpielerFeld; text: string } | null {
  const vorname = bereinigeName(e.vorname);
  const nachname = bereinigeName(e.nachname);
  if (laenge(vorname) < 1 || laenge(vorname) > NAME_MAX) return { feld: "vorname", text: SPIELER_TEXT.vorname };
  if (laenge(nachname) < 1 || laenge(nachname) > NAME_MAX) return { feld: "nachname", text: SPIELER_TEXT.nachname };
  if (jahrgangAus(e.jahrgang) === null) return { feld: "jahrgang", text: SPIELER_TEXT.jahrgang };
  if (laenge((e.jsNummer ?? "").trim()) > JS_MAX) return { feld: "js_nummer", text: SPIELER_TEXT.jsNummer };
  return null;
}

/** Der Jahrgang als Zahl, wenn er vierstellig ist, sonst `null`. */
export function jahrgangAus(j: string | number): number | null {
  const t = String(j).trim();
  if (!/^\d{4}$/.test(t)) return null;
  const n = Number(t);
  return n >= JAHRGANG_MIN && n <= JAHRGANG_MAX ? n : null;
}

/** Eine Spieler:in, wie die Liste sie führt. */
export type Spieler = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  jsNummer: string | null;
};

/** Überall Vor- und Nachname (Epic PO 2). */
export function spielerName(s: { vorname: string; nachname: string }): string {
  return `${s.vorname} ${s.nachname}`;
}

/** Nach Vorname, dann Nachname — so, wie die Namen dastehen. */
export function nachSpielerName<T extends { vorname: string; nachname: string }>(liste: T[]): T[] {
  return [...liste].sort(
    (a, b) => a.vorname.localeCompare(b.vorname, "de") || a.nachname.localeCompare(b.nachname, "de"),
  );
}

// ── Spielerzahl eines Termins ───────────────────────────────────────────────

/** Was die Datenebene zu einem Termin zählt (berechnetes Feld `spielstand`):
 *  `null`, wenn die Liste leer ist bzw. bei Beginn leer war. */
export type Spielstand = { gesamt: number; angemeldet: number; eingefroren: boolean } | null;

/** Woher die Spielerzahl eines Termins kommt (#434 AK 8, 12; #435 AK 6). */
export type Spielerzahl =
  | { quelle: "liste"; angemeldet: number; gesamt: number }
  | { quelle: "erwartet"; zahl: number }
  | { quelle: "unbekannt" };

/** Die Liste geht vor, sobald sie jemanden enthält (bzw. bei Beginn enthielt);
 *  sonst gilt die erwartete Zahl. Ein ausgefallener Termin zeigt keine
 *  (#437 AK 4). */
export function spielerzahlVon(t: {
  spielerzahl: number | null;
  spielstand: Spielstand;
  ausgefallen?: boolean;
}): Spielerzahl {
  if (t.ausgefallen) return { quelle: "unbekannt" };
  if (t.spielstand) return { quelle: "liste", angemeldet: t.spielstand.angemeldet, gesamt: t.spielstand.gesamt };
  return t.spielerzahl !== null ? { quelle: "erwartet", zahl: t.spielerzahl } : { quelle: "unbekannt" };
}

/** Knapp für die Zeile im Trainingsplan: «12/15» oder «12». */
export function spielerzahlKurz(z: Spielerzahl): string | null {
  if (z.quelle === "liste") return `${z.angemeldet}/${z.gesamt}`;
  return z.quelle === "erwartet" ? String(z.zahl) : null;
}

/** Ausgeschrieben: «12 von 15 angemeldet» oder «12 Spieler:innen erwartet». */
export function spielerzahlLang(z: Spielerzahl): string | null {
  if (z.quelle === "liste") return `${z.angemeldet} von ${z.gesamt} angemeldet`;
  if (z.quelle === "erwartet") return `${z.zahl} ${z.zahl === 1 ? "Spieler:in" : "Spieler:innen"} erwartet`;
  return null;
}
