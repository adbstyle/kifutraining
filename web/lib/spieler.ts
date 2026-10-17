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
import { datumKurz } from "@/lib/zeit";
import { tagOhneJahr } from "@/lib/monat";

/** Zwillinge der Checks `spieler_vorname`, `spieler_nachname`, `spieler_js`,
 *  `spieler_jahrgang` und der Obergrenze im Trigger `spieler_vorher`. */
export const NAME_MAX = 60;
export const JS_MAX = 20;
export const JAHRGANG_MIN = 1000;
export const JAHRGANG_MAX = 9999;
/** So viele Ziffern hat ein Jahrgang — für `maxLength` der Felder. */
export const JAHRGANG_STELLEN = 4;
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

/** Was in ein Jahrgang-Feld getippt wird, ohne Nicht-Ziffern. */
export function nurZiffern(s: string): string {
  return s.replace(/\D/g, "");
}

/** Eine Spieler:in, wie die Liste sie führt. */
export type Spieler = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  jsNummer: string | null;
  /** Der aktuelle Link wurde über die Selbstabholung herausgegeben (#438 PC 2). */
  linkBezogen: boolean;
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

// ── Ab- und Anmelden (#435) ─────────────────────────────────────────────────

/** Warum die Datenebene ein Ab- oder Anmelden abweist (`abmeldung_anwenden`). */
export type AbmeldeGrund = "nicht_gefunden" | "verlegt" | "ausgefallen" | "begonnen";

/** Der Stand des Termins, gegen den abgewiesen wurde. */
export type AbmeldeStand = { datum: string; beginn: string; ende: string; ausgefallen: boolean };

export const ABMELDUNG_TEXT = {
  nichtGefunden: "Diesen Termin oder diese Spieler:in gibt es nicht mehr. Sieh dir den Trainingsplan noch einmal an.",
  begonnen: "Der Termin hat begonnen. An- und abmelden geht nur bis zum Beginn.",
  ausgefallen: "Der Termin fällt aus. Für ihn lässt sich niemand an- oder abmelden.",
  /** Ein Termin, der begann, als die Spielerliste leer war. */
  ohneListe: "Bei Beginn führte das Team keine Spielerliste. Für diesen Termin gilt die erwartete Spielerzahl.",
} as const;

/** Die Abweisung mit dem aktuellen Stand (#435 AK 4, #437 AK 5) — an
 *  Oberfläche, Link und KI wortgleich. */
export function abweisungText(grund: AbmeldeGrund, stand?: AbmeldeStand): string {
  if (grund === "verlegt" && stand)
    return `Der Termin wurde inzwischen verlegt, neu auf ${datumKurz(stand.datum)} um ${stand.beginn}. Sieh ihn dir noch einmal an.`;
  if (grund === "ausgefallen") return ABMELDUNG_TEXT.ausgefallen;
  if (grund === "begonnen") return ABMELDUNG_TEXT.begonnen;
  return ABMELDUNG_TEXT.nichtGefunden;
}

/** Eine Spieler:in an einem Termin. `null`-Name: eine ehemalige Spieler:in an
 *  einem vergangenen Termin (#435 PC 4). */
export type Teilnehmer = {
  spielerId: string | null;
  vorname: string | null;
  nachname: string | null;
  abgemeldet: boolean;
  ehemalig: boolean;
};

/** Wie eine ehemalige Spieler:in überall heisst. */
export const EHEMALIGE_SPIELERIN = "Ehemalige Spieler:in";

/** Nach Name; ehemalige zuletzt. */
export function nachTeilnehmer(liste: Teilnehmer[]): Teilnehmer[] {
  const benannt = liste.filter((t) => t.vorname !== null) as (Teilnehmer & { vorname: string; nachname: string })[];
  return [...nachSpielerName(benannt), ...liste.filter((t) => t.vorname === null)];
}

// ── Privater Link (#436) ────────────────────────────────────────────────────

/** Der Pfad der Seite hinter dem privaten Link: `/abmelden/<token>`. */
export const LINK_PFAD = "abmelden";

/** 64 Hex-Zeichen wie das Kalender-Abo — vorab geprüft, bevor die Datenebene fragt. */
export function istLinkToken(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
}

/** Ein Fehler der Datenebene hinter einem privaten Link — ohne Einzelheiten. */
export const LINK_FEHLER = "Das ging gerade nicht. Versuch es noch einmal.";

/** Die vollständige Adresse des privaten Links. */
export function spielerLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/${LINK_PFAD}/${token}`;
}

export const LINK_TEXT = {
  /** AK 2: was der Link kann — beim Holen, in der Oberfläche wie beim KI-Assistenten. */
  warnung: "Wer diesen Link hat, kann diese Spieler:in für Trainings ab- und anmelden. Gib ihn nur ihren Eltern oder ihr selbst.",
  /** Was Erneuern bewirkt (AK 3, PC 3). */
  erneuern: "Erneuern macht den bisherigen Link sofort ungültig. Abmeldungen bleiben.",
  /** AK 10: ein erneuerter, unbekannter oder entfernter Link. */
  ungueltigTitel: "Dieser Link gilt nicht mehr",
  ungueltig:
    "Vielleicht hat das Trainerteam ihn erneuert. Hol den aktuellen Link über die Abholadresse deines Teams ab oder frag deine Trainerin oder deinen Trainer.",
  erneuert: "Link erneuert. Der bisherige gilt nicht mehr.",
  /** Mit eingeschalteter Selbstabholung (#438): woher die Eltern den neuen holen. */
  erneuertAbholen: "Die Eltern holen den neuen Link wieder über die Abholadresse ab.",
} as const;

// ── Verlegen lässt Abmeldungen verfallen (#437) ─────────────────────────────

/** Was beim Verlegen mit den Abmeldungen geschieht (AK 1) — vor dem Speichern. */
export function verfallText(n: number): string {
  return n === 1
    ? "Damit verfällt 1 Abmeldung: Die Spieler:in gilt wieder als angemeldet."
    : `Damit verfallen ${n} Abmeldungen: Diese Spieler:innen gelten wieder als angemeldet.`;
}

/** Dasselbe für den KI-Weg, mit dem Weg zur Bestätigung. */
/** Dasselbe in der Rückfrage der Oberfläche, mit dem Weg danach. */
export function verfallDialogText(n: number): string {
  return `${verfallText(n)} Wer am neuen Zeitpunkt nicht kann, meldet sich neu ab.`;
}

export function verfallBestaetigen(n: number): string {
  return `${verfallText(n)} Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
}

/** Am privaten Link: Der Termin wurde verlegt, seit sie abgemeldet wurde (AK 2). */
export function verfallenHinweis(vorher: { datum: string; beginn: string }): string {
  return `Verlegt, vorher ${tagOhneJahr(vorher.datum)} um ${vorher.beginn}. Deine Abmeldung gilt nicht mehr.`;
}

// ── Selbstabholung (#438) ───────────────────────────────────────────────────

/** Der Pfad der Abholseite: `/abholen/<token>`. */
export const ABHOL_PFAD = "abholen";

/** Die vollständige Abholadresse eines Teams. */
export function abholUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/${ABHOL_PFAD}/${token}`;
}

/** Fehlversuche bis zur Sperre und ihre Dauer (AK 15) — Zwilling in
 *  `abholung_abholen` (Migration selbstabholung). */
export const ABHOL_VERSUCHE = 5;
export const ABHOL_SPERRE_MINUTEN = 15;

export const ABHOLUNG_TEXT = {
  /** AK 3, 5: was die Adresse kann und was Ausschalten bewirkt. */
  beschreibung:
    "Über diese Adresse können Spieler:innen-Links mit Vorname, Nachname und Jahrgang abgeholt werden. Wer die Abholadresse hat und die Angaben der Spieler:in kennt, kann die Spieler:in ab- und anmelden; teile sie nur teamintern. Ausschalten stoppt neue Abholungen, bezogene Spieler:innen-Links gelten weiter.",
  aus: "Ausgeschaltet. Eltern erhalten ihren Link nur von euch. Beim Einschalten gilt die bisherige Abholadresse wieder.",
  /** AK 4, 5: vor dem Erneuern. */
  erneuern:
    "Die bisherige Adresse gilt danach nie mehr, auch nicht im Eltern-Chat. Spieler-Links, die Eltern schon bezogen haben, gelten weiter. Teile danach die neue Adresse im Eltern-Chat.",
  eingeschaltet: "Selbstabholung eingeschaltet.",
  ausgeschaltet: "Selbstabholung ausgeschaltet. Bezogene Links gelten weiter.",
  erneuert: "Abholadresse erneuert. Teile die neue im Eltern-Chat.",
  // ── Die Abholseite ──
  titel: "Spieler:in-Link abholen",
  einleitung:
    "Gib Vorname, Nachname und Jahrgang der Spieler:in ein. Du erhältst den privaten Link, mit dem du die Spieler:in für Trainings ab- und wieder anmelden kannst.",
  /** AK 7: was KiFu speichert, wer es sieht, wann es verschwindet. */
  speichertTitel: "Was KiFu speichert",
  speichert:
    "Zu jedem Kind nur Vorname, Nachname, Jahrgang, falls eingetragen die J+S-Nummer, und Abmeldungen. Das sehen die Trainer:innen des Teams, KI-Assistenten, die sie mit KiFu verbunden haben, und wer den Link des Kindes hat. Nimmt das Team ein Kind aus der Liste, verschwinden seine Angaben überall.",
  /** AK 13, 14: immer derselbe Satz. */
  passtNicht: "Dazu finden wir keinen Link. Prüf die Schreibweise oder frag beim Team nach.",
  /** AK 16. */
  gesperrtTitel: "Zu viele Versuche",
  gesperrt: `Du kannst in ${ABHOL_SPERRE_MINUTEN} Minuten wieder eingeben. Passt es dann immer noch nicht, frag beim Team nach.`,
  fehlt: "Bitte Vorname, Nachname und den Jahrgang als vierstellige Jahreszahl eingeben.",
  /** AK 17. */
  ungueltigTitel: "Diese Abholadresse gilt nicht",
  ungueltig: "Frag deine Trainerin oder deinen Trainer nach der aktuellen Abholadresse oder direkt nach dem Link für dein Kind.",
} as const;

/** AK 10: wozu der Link dient, dass er privat ist, und wo es ihn wieder gibt. */
export function abholErhaltText(name: string): { wozu: string; privat: string } {
  return {
    wozu: `Mit diesem Link meldest du ${name} für Trainings ab und wieder an, ohne Konto. Speichere ihn am besten als Lesezeichen.`,
    privat: `Der Link ist privat. Wer ihn hat, kann ${name} ab- und anmelden. Geht er verloren, holst du ihn hier wieder ab.`,
  };
}
