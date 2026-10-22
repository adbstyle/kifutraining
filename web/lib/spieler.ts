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
import { SPIEL_TEXT } from "@/lib/spiel";

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
  /** Der Import trifft eine andere Liste als seine Vorschau (#455 AK 27). */
  SPIELERLISTE_GEAENDERT: "Die Spielerliste hat sich inzwischen geändert. Wähle die Datei erneut.",
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
  /** Die Kader, denen sie angehört (#452 AK 5). */
  kaderIds: string[];
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
 *  `null`, wenn die Liste leer ist bzw. bei Beginn leer war. `anwesend`: ab
 *  Beginn die Anwesenden samt Nachträgen (#475 AK 9), vorher `null`. */
export type Spielstand = {
  gesamt: number;
  angemeldet: number;
  eingefroren: boolean;
  anwesend?: number | null;
  /** Nur an einem Spiel (#463): die Abgemeldeten und die ohne Meldung. */
  abgemeldet?: number;
  ohne_meldung?: number;
  /** Nur an einem Spiel (#464): die nicht Aufgebotenen — sie zählen nur so,
   *  nicht nach ihrer Meldung —, und alle Meldungen samt ihrer. */
  nicht_aufgeboten?: number;
  meldungen?: number;
} | null;

/** Woher die Spielerzahl eines Termins kommt (#434 AK 8, 12; #435 AK 6).
 *  `anwesend`: ab Beginn die Anwesenden, die dann gezählt werden (#475 AK 10). */
export type Spielerzahl =
  | { quelle: "liste"; angemeldet: number; gesamt: number; anwesend: number | null }
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
  if (t.spielstand)
    return {
      quelle: "liste",
      angemeldet: t.spielstand.angemeldet,
      gesamt: t.spielstand.gesamt,
      anwesend: t.spielstand.anwesend ?? null,
    };
  return t.spielerzahl !== null ? { quelle: "erwartet", zahl: t.spielerzahl } : { quelle: "unbekannt" };
}

/** Knapp für die Zeile im Trainingsplan: «12/15» oder «12» — ab Beginn die
 *  Anwesenden von allen (#475 AK 10). */
export function spielerzahlKurz(z: Spielerzahl): string | null {
  if (z.quelle === "liste") return `${z.anwesend ?? z.angemeldet}/${z.gesamt}`;
  return z.quelle === "erwartet" ? String(z.zahl) : null;
}

/** Ausgeschrieben: «12 von 15 angemeldet», ab Beginn «11 von 15 da», oder
 *  «12 Spieler:innen erwartet». */
export function spielerzahlLang(z: Spielerzahl): string | null {
  if (z.quelle === "liste")
    return z.anwesend !== null ? `${z.anwesend} von ${z.gesamt} da` : `${z.angemeldet} von ${z.gesamt} angemeldet`;
  if (z.quelle === "erwartet") return `${z.zahl} ${z.zahl === 1 ? "Spieler:in" : "Spieler:innen"} erwartet`;
  return null;
}

// ── Ab- und Anmelden (#435) ─────────────────────────────────────────────────

/** Warum die Datenebene ein Ab- oder Anmelden (`abmeldung_anwenden`) oder
 *  einen Nachtrag (`termin_anwesenheit_setzen`, #475) abweist. */
export type AbmeldeGrund =
  | "nicht_gefunden"
  | "verlegt"
  | "ausgefallen"
  | "begonnen"
  | "gilt_nicht"
  | "nicht_begonnen"
  | "nicht_dabei"
  /** Ein Spiel (#448): Für Spiele gilt diese Abmeldung nicht. */
  | "ist_spiel";

/** Der Stand des Termins, gegen den abgewiesen wurde. */
export type AbmeldeStand = { datum: string; beginn: string; ende: string; ausgefallen: boolean };

export const ABMELDUNG_TEXT = {
  nichtGefunden: "Diesen Termin oder diese Spieler:in gibt es nicht mehr. Sieh dir den Trainingsplan noch einmal an.",
  begonnen: "Der Termin hat begonnen. An- und abmelden geht nur bis zum Beginn.",
  ausgefallen: "Der Termin fällt aus. Für ihn lässt sich niemand an- oder abmelden.",
  /** Der Termin gilt nicht (mehr) für die Spieler:in — ihre Kader (#453 AK 9, #454 AK 5). */
  giltNicht: "Dieser Termin gilt nicht mehr für diese Spieler:in. Sieh dir die Termine noch einmal an.",
  /** Ein Termin, der begann, als die Spielerliste leer war. */
  ohneListe: "Bei Beginn führte das Team keine Spielerliste. Für diesen Termin gilt die erwartete Spielerzahl.",
  /** Ein Nachtrag vor Beginn (#475 AK 4). */
  nichtBegonnen: "Der Termin hat noch nicht begonnen. Wer da war, lässt sich erst ab Beginn nachtragen.",
  /** Ein Nachtrag für jemanden, der bei Beginn nicht zum Termin gehörte (#475 AK 5). */
  nichtDabei: "Diese Spieler:in gehörte bei Beginn nicht zu diesem Termin. Nachtragen lässt sich nur, wer da auf der Liste stand.",
  /** An einem ausgefallenen Termin (#475 AK 6). */
  ausgefallenNachtrag: "Der Termin fällt aus. Für ihn lässt sich nicht nachtragen, wer da war.",
} as const;

/** Die Abweisung mit dem aktuellen Stand (#435 AK 4, #437 AK 5) — an
 *  Oberfläche, Link und KI wortgleich. */
export function abweisungText(grund: AbmeldeGrund, stand?: AbmeldeStand): string {
  if (grund === "verlegt" && stand)
    return `Der Termin wurde inzwischen verlegt, neu auf ${datumKurz(stand.datum)} um ${stand.beginn}. Sieh ihn dir noch einmal an.`;
  if (grund === "ausgefallen") return ABMELDUNG_TEXT.ausgefallen;
  if (grund === "begonnen") return ABMELDUNG_TEXT.begonnen;
  if (grund === "gilt_nicht") return ABMELDUNG_TEXT.giltNicht;
  if (grund === "nicht_begonnen") return ABMELDUNG_TEXT.nichtBegonnen;
  if (grund === "nicht_dabei") return ABMELDUNG_TEXT.nichtDabei;
  if (grund === "ist_spiel") return SPIEL_TEXT.istSpiel;
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
  /** Die Kader, über die der Termin für sie gilt (#453 AK 15); leer bei einem Termin für alle. */
  kader: string[];
  /** Wann ihr Status zuletzt zwischen angemeldet und abgemeldet wechselte
   *  (ISO-Zeitpunkt, #467); `null`, wenn sie dort nie gewechselt hat. */
  gewechseltAm: string | null;
  /** Ab Beginn: Ihre Anwesenheit weicht vom Stand bei Beginn ab (#475) —
   *  angemeldet heisst dann nicht erschienen, abgemeldet doch erschienen. */
  nachgetragen: boolean;
};

/** Der Stand einer Spieler:in an einem Termin, samt Nachtrag (#475 AK 8). */
export type TeilnahmeStatus = "angemeldet" | "abgemeldet" | "nicht_erschienen" | "doch_erschienen";

export function teilnahmeStatus(t: { abgemeldet: boolean; nachgetragen: boolean }): TeilnahmeStatus {
  if (t.nachgetragen) return t.abgemeldet ? "doch_erschienen" : "nicht_erschienen";
  return t.abgemeldet ? "abgemeldet" : "angemeldet";
}

/** Was der Schalter am Termin bedeutet: vor Beginn angemeldet, ab Beginn da
 *  — dann trägt er gegen den Stand bei Beginn nach (#475). */
export function statusNachSchalter(t: { abgemeldet: boolean }, an: boolean, abBeginn: boolean): TeilnahmeStatus {
  return abBeginn
    ? teilnahmeStatus({ abgemeldet: t.abgemeldet, nachgetragen: an === t.abgemeldet })
    : teilnahmeStatus({ abgemeldet: !an, nachgetragen: false });
}

/** Anwesend ist, wer angemeldet oder doch erschienen ist (#475 AK 9). */
export function istAnwesend(t: { abgemeldet: boolean; nachgetragen: boolean }): boolean {
  return t.abgemeldet === t.nachgetragen;
}

/** Wie der Stand überall heisst. */
export const TEILNAHME_TEXT: Record<TeilnahmeStatus, string> = {
  angemeldet: "angemeldet",
  abgemeldet: "abgemeldet",
  nicht_erschienen: "angemeldet, nicht erschienen",
  doch_erschienen: "abgemeldet, doch erschienen",
};

/** Wie eine ehemalige Spieler:in überall heisst. */
export const EHEMALIGE_SPIELERIN = "Ehemalige Spieler:in";

/** Nach Name; ehemalige zuletzt — an Trainings und an Spielen. */
export function nachTeilnehmer<T extends { vorname: string | null; nachname: string | null }>(liste: T[]): T[] {
  const benannt = liste.filter((t) => t.vorname !== null) as (T & { vorname: string; nachname: string })[];
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
  warnung:
    "Wer diesen Link hat, kann diese Spieler:in für Trainings und Spiele ab- und anmelden. Für ein Spiel ist sie erst nach ihrer Meldung angemeldet. Gib ihn nur ihren Eltern oder ihr selbst.",
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

/** Was beim Verlegen mit den Abmeldungen geschieht (AK 1) — vor dem
 *  Speichern. Wird ein begonnener Termin wieder offen, verfallen auch seine
 *  Nachträge (#475 AK 12). */
export function verfallText(n: number, nachtraege = 0): string {
  const abmeldungen =
    n === 0
      ? null
      : n === 1
        ? "Damit verfällt 1 Abmeldung: Die Spieler:in gilt wieder als angemeldet."
        : `Damit verfallen ${n} Abmeldungen: Diese Spieler:innen gelten wieder als angemeldet.`;
  // Ohne Abmeldungen sind es nur Nicht-Erschienene (Doch-Erschienene waren
  // abgemeldet): Auch sie gelten wieder als angemeldet.
  const nachtrag =
    nachtraege === 0
      ? null
      : n > 0
        ? `Damit ${nachtraege === 1 ? "verfällt auch 1 Nachtrag" : `verfallen auch ${nachtraege} Nachträge`} zur Anwesenheit.`
        : nachtraege === 1
          ? "Damit verfällt 1 Nachtrag zur Anwesenheit: Die Spieler:in gilt wieder als angemeldet."
          : `Damit verfallen ${nachtraege} Nachträge zur Anwesenheit: Diese Spieler:innen gelten wieder als angemeldet.`;
  return [abmeldungen, nachtrag].filter(Boolean).join(" ");
}

/** Dasselbe in der Rückfrage der Oberfläche, mit dem Weg danach. */
export function verfallDialogText(n: number, nachtraege = 0): string {
  return n > 0
    ? `${verfallText(n, nachtraege)} Wer am neuen Zeitpunkt nicht kann, meldet sich neu ab.`
    : verfallText(n, nachtraege);
}

/** Dasselbe für den KI-Weg, mit dem Weg zur Bestätigung. */
export function verfallBestaetigen(n: number, nachtraege = 0): string {
  return `${verfallText(n, nachtraege)} Wiederhole den Aufruf mit «bestaetigt: true», wenn das so gewollt ist.`;
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
    "Gib Vorname, Nachname und Jahrgang der Spieler:in ein. Du erhältst den privaten Link, mit dem du die Spieler:in für Trainings und Spiele ab- und anmelden kannst.",
  /** AK 7: was KiFu speichert, wer es sieht, wann es verschwindet. */
  speichertTitel: "Was KiFu speichert",
  speichert:
    "Zu jeder Spieler:in nur Vorname, Nachname, Jahrgang, falls eingetragen die J+S-Nummer, Abmeldungen, An- und Abmeldungen zu Spielen und ob sie für ein Spiel nicht aufgeboten ist. Das sehen die Trainer:innen des Teams, KI-Assistenten, die sie mit KiFu verbunden haben, und wer den Link der Spieler:in hat. Wann sich eine Spieler:in zuletzt ab- oder wieder angemeldet hat, sehen nur die Trainer:innen und ihre KI-Assistenten. Nimmt das Team eine Spieler:in aus der Liste, verschwinden ihre Angaben überall.",
  /** AK 13, 14: immer derselbe Satz. */
  passtNicht: "Dazu finden wir keinen Link. Prüf die Schreibweise oder frag beim Team nach.",
  /** AK 16. */
  gesperrtTitel: "Zu viele Versuche",
  gesperrt: `Du kannst in ${ABHOL_SPERRE_MINUTEN} Minuten wieder eingeben. Passt es dann immer noch nicht, frag beim Team nach.`,
  fehlt: "Bitte Vorname, Nachname und den Jahrgang als vierstellige Jahreszahl eingeben.",
  /** AK 17. */
  ungueltigTitel: "Diese Abholadresse gilt nicht",
  ungueltig: "Frag deine Trainerin oder deinen Trainer nach der aktuellen Abholadresse oder direkt nach dem Link der Spieler:in.",
} as const;

/** AK 10: wozu der Link dient, dass er privat ist, und wo es ihn wieder gibt. */
export function abholErhaltText(name: string): { wozu: string; privat: string } {
  return {
    wozu: `Mit diesem Link meldest du ${name} für Trainings ab und wieder an und für Spiele an oder ab, ohne Konto. Speichere ihn am besten als Lesezeichen.`,
    privat: `Der Link ist privat. Wer ihn hat, kann ${name} ab- und anmelden. Geht er verloren, holst du ihn hier wieder ab.`,
  };
}
