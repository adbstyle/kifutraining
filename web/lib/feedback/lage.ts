// Der dritte Block des Systemprompts im Feedback-Dialog (Epic #541): was je
// Gespräch oder Nachricht wechselt — Rolle, Kontext, Hinweis zum Limit.
//
// REIN: kein `server-only` — `check:feedback` prüft die Sätze ohne Server
// (#583 AK 19: an einem Link ohne Team gehört Dringendes zur
// Vereinsverwaltung). Die Gesprächsregeln und das Produktwissen bleiben in
// `prompt.ts`.
import { KORREKTUREN_MAX, NACHRICHTEN_MAX, RUECKFRAGEN_ZIEL, type Zusammenfassung } from "./regeln";

export type Rolle = "trainer" | "spielervertretung";

/** Was sich je Gespräch und Nachricht ändert. */
export type Lage = {
  rolle: Rolle;
  seite: string;
  version: string;
  geraet: string;
  /** Am privaten Link: Die Spieler:in ist keinem Team zugeordnet (#583 AK 19) —
   *  Dringendes gehört dann zur Vereinsverwaltung. Aus der Datenbank. */
  ohneTeam?: boolean;
  /** Die wievielte Nachricht der Person das ist. */
  nachricht: number;
  /** Mit welcher Nachricht die erste Zusammenfassung kam, sonst `null`. */
  vorschlagBei: number | null;
  /** Die zuletzt vorgelegte Zusammenfassung, sonst `null`. */
  zusammenfassung: Zusammenfassung | null;
};

const ROLLEN: Record<Rolle, string> = {
  trainer: "Die Person ist Trainer:in und mit ihrem Konto angemeldet.",
  spielervertretung:
    "Die Person nutzt KiFu ohne Konto über den privaten Link einer Spieler:in: Es sind die Eltern oder die Spieler:in selbst. Erkläre ihr nur, was hinter dem privaten Link sichtbar ist (im Produktwissen die Zeile «Eltern» der Sichtbarkeitsmatrix und was über den privaten Link steht). Funktionen, die nur Trainer:innen haben, erklärst du ihr nicht und sagst auch nicht, wo oder wie sie bei Trainer:innen gehen: Fragt sie danach, sag nur, dass das über den privaten Link nicht geht und die Trainer:innen des Teams dafür zuständig sind. Bei etwas Dringendem, etwa wenn das Abmelden kurz vor einem Termin nicht geht, verweise sie an die Trainer:innen des Teams.",
};

/** Die Spieler:in hinter dem Link ist keinem Team zugeordnet: Es gibt keine
 *  Trainer:innen, an die man verweist (#583 AK 19). */
const OHNE_TEAM =
  "Die Spieler:in hinter dem Link ist zurzeit keinem Team zugeordnet. Verweise Fragen zu Terminen und bei etwas Dringendem an die Vereinsverwaltung, nicht an Trainer:innen eines Teams. Termine erscheinen am Link, sobald die Spieler:in einem Team zugeordnet ist.";

function hinweisZumLimit(l: Lage): string | null {
  if (l.vorschlagBei === null) {
    if (l.nachricht >= NACHRICHTEN_MAX) {
      return "Das ist die letzte Nachricht vor der Zusammenfassung: Leg sie jetzt vor, ohne neue Fragen.";
    }
    // Etwa fünf Rückfragen, dann die Zusammenfassung (PO 18) — mit
    // Erklärungen dazwischen darf es länger dauern, darum nur ein Anstoss.
    return l.nachricht >= RUECKFRAGEN_ZIEL
      ? "Du hast genug gefragt: Leg jetzt die Zusammenfassung vor, Fehlendes als «Unbekannt», ausser die Person hat gerade eine neue Frage gestellt."
      : null;
  }
  return l.nachricht >= l.vorschlagBei + KORREKTUREN_MAX
    ? "Das ist die letzte Korrektur: Leg die endgültige Zusammenfassung vor und stell keine Fragen mehr."
    : null;
}

/** Der dritte Block: Rolle, bei einer Spieler:in ohne Team der Verweis an die
 *  Vereinsverwaltung, Kontext, bisherige Zusammenfassung, Hinweis zum Limit. */
export function lageText(l: Lage): string {
  return [
    ROLLEN[l.rolle],
    l.rolle === "spielervertretung" && l.ohneTeam ? OHNE_TEAM : null,
    `Kontext ohne Nachfrage: Seite ${l.seite}, KiFu-Version ${l.version}, Gerät und Browser: ${l.geraet || "unbekannt"}.`,
    l.zusammenfassung ? `Bisher vorgelegte Zusammenfassung: ${JSON.stringify(l.zusammenfassung)}` : null,
    hinweisZumLimit(l),
  ]
    .filter(Boolean)
    .join("\n\n");
}
