// Das Kalender-Abo einer Spielervertretung (Epic #506): Status und Einträge.
//
// Das Abo folgt dem privaten Link — die Datenebene liefert dieselben Termine
// wie er (ohne ausgefallene), hier wird daraus, wie ein Termin im
// Kalenderprogramm erscheint. Der Status steht vorn im Titel als Zeichen
// (PO 2026-10-24): So unterscheidet die Spielervertretung zugesagt und
// abgesagt schon in der Kalenderübersicht, in allen vier Programmen (#507
// AK 6). Kein Name der Spieler:in, kein Verweis auf den Link (PC 2, 6).
//
// REIN: reine Helfer; aus `privater-link` nur Typen.

import { aboUrl, type AboTermin } from "./ical";
import type { LinkTermin } from "./privater-link";
import { treffpunktAnzeige } from "./spiel";

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
  | "ort_link"
  | "art"
  | "bezeichnung"
  | "begonnen"
  | "abgemeldet"
  | "meldung"
  | "frist_abgelaufen"
  | "nicht_aufgeboten"
  | "hinweis_eltern"
  | "treffpunkte"
>;

/** `probe`: Die Spieler:in ist im Probe-Modus (#555 PC 11); fehlt bei einer
 *  Datenebene vor der Migration. */
export type AboFeed =
  | { gueltig: false }
  | { gueltig: true; abo: string; team: string; probe?: boolean; termine: AboFeedTermin[] };

/** Der Status der Spieler:in an einem Termin.
 *  - Training (#507 PC 3): angemeldet = zugesagt, abgemeldet = abgesagt;
 *    «vielleicht» gibt es nicht — ausser im Probe-Modus (#555 PC 11): Dort
 *    heisst nicht angemeldet vielleicht, auch wenn sie sich nicht mehr
 *    anmelden kann.
 *  - Spiel (#508 PC 3–6): nicht aufgeboten = abgesagt, auch wenn angemeldet;
 *    angemeldet = zugesagt; ohne Meldung = vielleicht, bis die Meldefrist
 *    abläuft (`frist_abgelaufen`, ohne Frist nie) — ohne Frist gilt der
 *    Anpfiff; sonst abgesagt. */
export function aboStatus(t: AboFeedTermin, probe = false): AboStatus {
  if (t.art !== "spiel") return t.abgemeldet ? (probe ? "vielleicht" : "abgesagt") : "zugesagt";
  if (t.nicht_aufgeboten || t.meldung === "abgemeldet") return "abgesagt";
  if (t.meldung === "angemeldet") return "zugesagt";
  return t.begonnen || t.frist_abgelaufen ? "abgesagt" : "vielleicht";
}

/** Ein Termin, wie er ins Abo geht (#507 PC 2, #508 PC 2): Terminart bzw.
 *  Bezeichnung, Teamname, Beginn, Ende, Ort und der Status — im Titel als
 *  Zeichen, in der Beschreibung als Wort. Bei Spielen dazu die Treffpunkte,
 *  bei Trainings und Spielen der Hinweis für Eltern (#590 AK 12). Vielleicht
 *  ist vorläufig, abgesagt belegt keine Zeit. */
export function aboEintrag(t: AboFeedTermin, team: string, probe = false): AboTermin {
  const status = aboStatus(t, probe);
  const { zeichen, wort } = ABO_STATUS[status];
  const art = t.art === "spiel" ? (t.bezeichnung ?? "Spiel") : "Training";
  return {
    id: t.id,
    datum: t.datum,
    beginn: t.beginn,
    ende: t.ende,
    ort: t.ort,
    ortLink: t.ort_link ?? null,
    titel: `${zeichen} ${art} · ${team}`,
    beschreibung: [wort, ...treffpunktAbschnitt(t, status), ...(t.hinweis_eltern ? [t.hinweis_eltern] : [])].join("\n\n"),
    status: status === "vielleicht" ? "TENTATIVE" : "CONFIRMED",
    frei: status === "abgesagt",
  };
}

/** Die Treffpunkte eines Spiels, wie die Spielkarte am Link sie zeigt
 *  (#508 PC 2): nur, solange es nicht begonnen hat und die Spieler:in
 *  mitkommt — ein abgesagtes Spiel ist am Link gedämpft und nennt keine. Der
 *  Ort von «vor Ort» ist der des Spiels. Der Hinweis für Eltern folgt immer,
 *  so wie das Team ihn geschrieben hat (#590 AK 12; OoS 6). */
function treffpunktAbschnitt(t: AboFeedTermin, status: AboStatus): string[] {
  const treffpunkte = t.art === "spiel" && !t.begonnen && status !== "abgesagt" ? (t.treffpunkte ?? []) : [];
  if (treffpunkte.length === 0) return [];
  const zeilen = treffpunkte.map((tp) => {
    const a = treffpunktAnzeige(tp, t.datum, t.ort);
    return [a.zeit, a.anreise, a.ort].filter(Boolean).join(" · ");
  });
  return [["Treffpunkte", ...zeilen].join("\n")];
}

/** Der Kalender heisst nach dem Team (#507 PC 6) — wie das Abo der Mitglieder. */
export const aboKalenderName = (team: string) => `Trainings und Spiele · ${team}`;

/** Die Adresse des Feeds neben der der Mitglieder: `/api/kalender/spieler/…`. */
export const spielerAboUrl = (origin: string, token: string) => aboUrl(origin, token, "spieler/");

export const ABO_TEXT = {
  /** Was die Zeichen im Titel bedeuten — damit die Spielervertretung sie im Kalender liest. */
  legende: `Im Kalender steht vor jedem Termin ${ABO_STATUS.zugesagt.zeichen} zugesagt, ${ABO_STATUS.vielleicht.zeichen} vielleicht (noch nicht angemeldet) oder ${ABO_STATUS.abgesagt.zeichen} abgesagt.`,
  /** #507 AK 2. */
  nurAnzeigen: "Das Abo zeigt nur an: Ab- und anmelden geht weiterhin hier über diesen Link.",
  /** #507 AK 3. */
  verzoegerung: "Dein Kalenderprogramm übernimmt Änderungen erst nach einer Weile; wie oft es nachsieht, bestimmt es selbst.",
  /** #509 AK 3: vor dem Bestätigen. */
  widerrufen:
    "Die bisherige Abo-Adresse liefert danach für alle, die sie nutzen, keine Termine mehr. Dieser Link und deine Ab- und Anmeldungen bleiben. Eine neue Abo-Adresse holst du jederzeit hier.",
  /** #509 PC 1; OoS 1. */
  widerrufenOk:
    "Abo widerrufen: Die bisherige Abo-Adresse liefert keine Termine mehr. Den abonnierten Kalender selbst entfernst du in deinem Kalenderprogramm.",
} as const;
