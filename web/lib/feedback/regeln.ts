// Die Regeln des KI-geführten Feedbacks (Epic #541): Grenzen, Formen der
// Nachrichten und der Zusammenfassung, Meldungen.
//
// Die drei Grenzen haben einen SQL-Zwilling (`feedback_grenzen()` in der
// Migration `feedback_dialog`); `check:feedback` prüft, dass beide Seiten
// dieselben Zahlen tragen. Die Datenbank setzt sie durch, die Oberfläche
// zeigt sie nur an.
//
// REIN: keine Server-Importe — die Oberfläche liest dieselben Werte.
import { z } from "zod";

/** Höchstens so viele Dialoge je Konto bzw. privatem Link und Kalendertag
 *  (PO 15). SQL-Zwilling: `dialoge_je_tag`. */
export const DIALOGE_JE_TAG = 5;
/** Höchstens so viele Nachrichten der Person bis zur Zusammenfassung (PO 13).
 *  SQL-Zwilling: `nachrichten`. */
export const NACHRICHTEN_MAX = 10;
/** Nach der ersten Zusammenfassung noch so viele Nachrichten zum Korrigieren
 *  oder Bestätigen (PO 13). SQL-Zwilling: `korrekturen`. */
export const KORREKTUREN_MAX = 2;
/** Höchstens so viele Zeichen je Nachricht (PO 22). Das Feld nimmt nicht mehr
 *  an; die Server Action prüft es trotzdem. */
export const NACHRICHT_MAX = 1000;
/** Eine Antwort der KI ist nie länger; was länger zurückkäme, kürzt der
 *  Server. Hält auch einen Verlauf aus dem Browser klein. */
export const ANTWORT_MAX = 2000;

/** So viele Monate nach dem Eingang löscht KiFu ein Feedback (#545).
 *  SQL-Zwilling: `feedback_frist_loeschen()`. */
export const AUFBEWAHRUNG_MONATE = 12;

/** Was die Person schickt, wenn sie die Zusammenfassung verlangt (PO 29). Es
 *  ist eine gewöhnliche Nachricht und zählt wie jede andere. */
export const ZUSAMMENFASSUNG_VERLANGEN = "Bitte fass jetzt zusammen.";

export const nachrichtSchema = z.object({
  von: z.enum(["person", "ki"]),
  text: z.string().min(1).max(ANTWORT_MAX),
});
export type Nachricht = z.infer<typeof nachrichtSchema>;

/** Der Verlauf, wie ihn der Browser hält: abwechselnd Person und KI, mit der
 *  Person zuerst. Mehr als die Grenzen erlauben kann er nicht enthalten. */
export const verlaufSchema = z
  .array(nachrichtSchema)
  .max(2 * (NACHRICHTEN_MAX + KORREKTUREN_MAX))
  .refine((v) => v.every((n, i) => n.von === (i % 2 === 0 ? "person" : "ki")), "Verlauf ungültig")
  .refine((v) => v.every((n) => n.von === "ki" || n.text.length <= NACHRICHT_MAX), "Nachricht zu lang");

/** Grenzen der Zusammenfassung — der Titel hat einen SQL-Zwilling (CHECK an
 *  `feedback.titel`). Was das Modell länger liefert, kürzt der Server. */
export const TITEL_MAX = 200;
export const PUNKTE_MAX = 8;
export const BEZEICHNUNG_MAX = 60;
export const PUNKT_TEXT_MAX = 1000;

export const EINORDNUNGEN = ["fehler", "wunsch", "frage"] as const;
export type Einordnung = (typeof EINORDNUNGEN)[number];

/** Die Zusammenfassung, die die Person bestätigt: ein Titel und die Punkte,
 *  je nach Einordnung andere (bei einem Fehler etwa Absicht, Schritte,
 *  Ergebnis, Erwartung, Wiederholbarkeit). Was fehlt, steht als «Unbekannt». */
export const zusammenfassungSchema = z.object({
  einordnung: z.enum(EINORDNUNGEN),
  titel: z.string().min(1).max(TITEL_MAX),
  punkte: z
    .array(
      z.object({
        bezeichnung: z.string().min(1).max(BEZEICHNUNG_MAX),
        text: z.string().min(1).max(PUNKT_TEXT_MAX),
      }),
    )
    .min(1)
    .max(PUNKTE_MAX),
});
export type Zusammenfassung = z.infer<typeof zusammenfassungSchema>;

/** Wie weit der Dialog ist — für den Zähler unter dem Feld (PO 27) und dafür,
 *  ob noch geschrieben werden darf. `nachricht` ist die Zahl der bisher
 *  geschickten Nachrichten der Person, `vorschlagBei` die, mit der die erste
 *  Zusammenfassung kam. */
export function dialogStand(nachricht: number, vorschlagBei: number | null) {
  if (vorschlagBei === null) {
    // Ohne Zusammenfassung bleibt das Feld auch nach der zehnten Nachricht
    // offen: Das Modell muss sie dann vorlegen; vergisst es sie, verlangt die
    // Person sie im Rahmen der Korrekturen (dieselbe Grenze in der Datenbank).
    const offen = nachricht < NACHRICHTEN_MAX + KORREKTUREN_MAX;
    return { offen, zaehler: `Nachricht ${Math.min(nachricht + 1, NACHRICHTEN_MAX)} von ${NACHRICHTEN_MAX}` };
  }
  // Kam die Zusammenfassung spät, kappt die feste Obergrenze die Korrekturen
  // — wie in der Datenbank.
  const ende = Math.min(vorschlagBei + KORREKTUREN_MAX, NACHRICHTEN_MAX + KORREKTUREN_MAX);
  const rest = Math.max(0, ende - nachricht);
  return {
    offen: rest > 0,
    zaehler: rest === 0 ? "Keine Korrektur mehr möglich" : `Noch ${rest === 1 ? "1 Korrektur" : `${rest} Korrekturen`} möglich`,
  };
}

/** Die Seite, wie sie gespeichert und dem Modell genannt wird: nur der Pfad,
 *  ohne Suche und Anker — dort kann stehen, was nicht ins Feedback gehört. */
export function seiteAus(eingabe: unknown): string {
  const roh = typeof eingabe === "string" ? eingabe : "";
  const pfad = roh.split(/[?#]/)[0];
  return pfad.startsWith("/") ? pfad.slice(0, 500) : "/";
}

/* ── Meldungen ─────────────────────────────────────────────────────────── */

/** Ausfall der KI, Ausgabenlimit oder ein anderer Fehler: immer dieselbe
 *  allgemeine Meldung (PO 10). */
export const MELDUNG_NICHT_MOEGLICH = "Feedback ist gerade nicht möglich. Versuch es später nochmals.";
/** Das Tageslimit nennt KiFu als Grund (PO 10). */
export const MELDUNG_TAGESLIMIT = `Du hast heute schon ${DIALOGE_JE_TAG} Feedbacks begonnen. Morgen geht es wieder.`;
export const MELDUNG_SPEICHERN = "Dein Feedback liess sich nicht speichern. Versuch es nochmals.";
