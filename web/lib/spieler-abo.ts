// Das Kalender-Abo einer Spielervertretung (Epic #506): Status und Einträge.
//
// Das Abo folgt dem privaten Link — die Datenebene liefert dieselben Termine
// wie er (ohne ausgefallene), hier wird daraus, wie ein Termin im
// Kalenderprogramm erscheint. Der Status steht vorn im Titel als Zeichen
// (PO 2026-10-24): So unterscheidet die Spielervertretung zugesagt und
// abgesagt schon in der Kalenderübersicht, in allen vier Programmen (#507
// AK 6). Kein Name der Spieler:in, kein Verweis auf den Link (PC 2, 6).
//
// REIN: nur Typen und reine Helfer.

import { abonnierLinks, type AboTermin } from "./ical";
import type { LinkTermin } from "./privater-link";

/** Wie ein Termin im Kalender der Spielervertretung erscheint (Begriff 2);
 *  in KiFu bleiben angemeldet, abgemeldet, ohne Meldung, nicht aufgeboten. */
export type AboStatus = "zugesagt" | "vielleicht" | "abgesagt";

export const ABO_STATUS: Record<AboStatus, { zeichen: string; wort: string }> = {
  zugesagt: { zeichen: "✅", wort: "Zugesagt" },
  vielleicht: { zeichen: "❔", wort: "Vielleicht" },
  abgesagt: { zeichen: "❌", wort: "Abgesagt" },
};

/** Was die Datenebene je Termin ins Abo gibt (`spieler_abo_termine`). */
export type AboFeedTermin = Pick<
  LinkTermin,
  | "id"
  | "datum"
  | "beginn"
  | "ende"
  | "ort"
  | "art"
  | "bezeichnung"
  | "begonnen"
  | "abgemeldet"
  | "meldung"
  | "frist"
  | "frist_abgelaufen"
  | "nicht_aufgeboten"
  | "bemerkung"
  | "treffpunkte"
>;

export type AboFeed = { gueltig: false } | { gueltig: true; abo: string; team: string; termine: AboFeedTermin[] };

/** Der Status eines Trainings (#507 PC 3): angemeldet = zugesagt,
 *  abgemeldet = abgesagt. «Vielleicht» gibt es bei Trainings nicht. */
export function aboStatus(t: AboFeedTermin): AboStatus {
  return t.abgemeldet ? "abgesagt" : "zugesagt";
}

/** Ein Termin, wie er ins Abo geht (#507 PC 2): Terminart, Teamname, Beginn,
 *  Ende, Ort und der Status — im Titel als Zeichen, in der Beschreibung als
 *  Wort. Vielleicht ist vorläufig, abgesagt belegt keine Zeit. */
export function aboEintrag(t: AboFeedTermin, team: string): AboTermin {
  const status = aboStatus(t);
  const { zeichen, wort } = ABO_STATUS[status];
  return {
    id: t.id,
    datum: t.datum,
    beginn: t.beginn,
    ende: t.ende,
    ort: t.ort,
    titel: `${zeichen} Training · ${team}`,
    beschreibung: wort,
    status: status === "vielleicht" ? "TENTATIVE" : "CONFIRMED",
    frei: status === "abgesagt",
  };
}

/** Der Kalender heisst nach dem Team (#507 PC 6) — wie das Abo der Mitglieder. */
export const aboKalenderName = (team: string) => `Trainings und Spiele · ${team}`;

/** Der Pfad des Feeds zu einer Abo-Adresse — neben dem der Mitglieder. */
export const spielerAboPfad = (token: string) => `/api/kalender/spieler/${token}.ics`;

export function spielerAboLinks(origin: string, token: string) {
  return abonnierLinks(`${origin.replace(/\/+$/, "")}${spielerAboPfad(token)}`);
}

export const ABO_TEXT = {
  /** Die Zeichen im Titel — damit die Spielervertretung sie im Kalender liest. */
  zeichen: `Im Kalender steht vor jedem Termin ${ABO_STATUS.zugesagt.zeichen} zugesagt, ${ABO_STATUS.vielleicht.zeichen} vielleicht (Spiel ohne Meldung) oder ${ABO_STATUS.abgesagt.zeichen} abgesagt.`,
  /** #507 AK 2. */
  nurAnzeigen: "Das Abo zeigt nur an: Ab- und anmelden geht weiterhin hier über diesen Link.",
  /** #507 AK 3. */
  verzoegerung: "Dein Kalenderprogramm übernimmt Änderungen erst nach einer Weile; wie oft es nachsieht, bestimmt es selbst.",
  fehler: "Die Abo-Adresse liess sich gerade nicht holen. Versuch es noch einmal.",
} as const;
