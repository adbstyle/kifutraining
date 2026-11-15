// Die Grenzen eines Kontos ohne Verein (Epic Vereine #575, Story #588): höchstens
// 50 eigene Übungen und 30 eigene Trainings — und die Sätze dazu.
//
// Eine Regelquelle für Oberfläche und KI-Werkzeuge: Die Datenebene weist mit
// den Markern `KONTO_UEBUNGEN_VOLL <bestand>` und `KONTO_TRAININGS_VOLL
// <bestand>` ab (Trigger `konto_grenze_vorher` an `exercises` und `trainings`),
// und `fachlicheMeldung` (lib/training-bedingungen.ts) übersetzt sie über
// `kontoGrenzeMeldung` in diese Sätze. Die Anzeige entscheidet nie: Sie zeigt
// den Stand, die Datenbank weist ab.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

/** Zwilling der Grenze für Übungen in der Datenebene (Funktion, die der Trigger
 *  `konto_grenze_vorher` fragt). `check:kern-db` vergleicht ihn mit dem `max`
 *  aus `meine_vereinslage()`. */
export const KONTO_UEBUNGEN_MAX = 50;
/** Zwilling der Grenze für Trainings, wie oben. */
export const KONTO_TRAININGS_MAX = 30;

export type KontoArt = "uebungen" | "trainings";

/** Der Stand einer Art: `bestand` darf über `max` liegen (Altbestand, PC 1). */
export type KontoGrenze = { bestand: number; max: number };

/** Die Grenzen eines Kontos ohne Verein, wie `meine_vereinslage()` sie liefert. */
export type KontoGrenzen = { uebungen: KontoGrenze; trainings: KontoGrenze };

/** Die Marker der Datenebene, dahinter der Bestand (`KONTO_UEBUNGEN_VOLL 50`).
 *  Keiner steckt im anderen (`check:kern`): Die `includes`-Suche bleibt eindeutig. */
export const KONTO_MARKER: Record<KontoArt, string> = {
  uebungen: "KONTO_UEBUNGEN_VOLL",
  trainings: "KONTO_TRAININGS_VOLL",
};

const NOMEN: Record<KontoArt, { eins: string; viele: string }> = {
  uebungen: { eins: "Übung", viele: "Übungen" },
  trainings: { eins: "Training", viele: "Trainings" },
};

/** Wie viele Übungen bzw. Trainings: «1 Übung», «50 Übungen». */
function mitNomen(art: KontoArt, n: number): string {
  return `${n} ${n === 1 ? NOMEN[art].eins : NOMEN[art].viele}`;
}

/** Der Bestand hinter dem Marker, samt Art; `null`, wenn die Meldung keinen trägt. */
export function kontoGrenzeAusFehler(message: string): { art: KontoArt; bestand: number } | null {
  for (const art of ["uebungen", "trainings"] as const) {
    const m = message.match(new RegExp(`${KONTO_MARKER[art]} (\\d+)`));
    if (m) return { art, bestand: Number(m[1]) };
  }
  return null;
}

/** Der feste Schluss jeder Abweisung: wie Platz entsteht und für wen die Grenze
 *  nicht gilt (Story #588 AK 6). Kein Verweis auf ein Werkzeug des KI-Assistenten:
 *  Er löscht keine Übungen (OoS 3), und Trainings löscht er nur auf ausdrücklichen
 *  Wunsch der Person. */
export const KONTO_GRENZE_SCHLUSS =
  "In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.";

/** «Du besitzt 50 von 50 Übungen.» — über der Grenze (Altbestand) «Du besitzt 60
 *  Übungen, höchstens 50 sind erlaubt.», nie «60 von 50». */
function besitztSatz(art: KontoArt, bestand: number, max: number): string {
  return bestand <= max
    ? `Du besitzt ${bestand} von ${max} ${NOMEN[art].viele}.`
    : `Du besitzt ${mitNomen(art, bestand)}, höchstens ${max} sind erlaubt.`;
}

const MAX: Record<KontoArt, number> = { uebungen: KONTO_UEBUNGEN_MAX, trainings: KONTO_TRAININGS_MAX };

/** Der Satz zu einer Abweisung der Datenebene (AK 6; für den KI-Assistenten
 *  derselbe, AK 7): wie viele die Person besitzt, wie Platz entsteht, für wen
 *  die Grenze nicht gilt. */
export function kontoGrenzeText(art: KontoArt, bestand: number): string {
  return `${besitztSatz(art, bestand, MAX[art])} ${KONTO_GRENZE_SCHLUSS}`;
}

/** Die Meldung zu einem DB-Fehler mit Marker der Kontogrenze, sonst `null`. */
export function kontoGrenzeMeldung(message: string): string | null {
  const g = kontoGrenzeAusFehler(message);
  return g ? kontoGrenzeText(g.art, g.bestand) : null;
}

/** Für den KI-Assistenten, bei einer Abweisung der Kontogrenze: Es ist nichts
 *  entstanden. Bewusst ohne Aufforderung zu einem zweiten Versuch — er ändert
 *  nichts, solange die Person keinen Platz geschaffen hat (AK 7). */
export const KONTO_GRENZE_HINWEIS = "Es ist nichts entstanden.";

/** Für die Werkzeugbeschreibungen des KI-Assistenten: die Grenze und wie eine
 *  Abweisung zu lesen ist (AK 7). Kein Verweis auf ein Löschwerkzeug und keine
 *  Aufforderung zum Wiederholen: Ein zweiter Versuch ändert nichts, solange die
 *  Person in der Anwendung keinen Platz geschaffen hat. */
export const KONTO_GRENZE_WERKZEUG: Record<KontoArt, string> = {
  uebungen:
    `Ein Konto ohne Verein besitzt höchstens ${KONTO_UEBUNGEN_MAX} Übungen (Entwürfe, veröffentlichte und Kopien zählen alle). ` +
    "Ist die Grenze erreicht, entsteht nichts: Die Fehlerart ist «regel», die Meldung nennt den Bestand, und " +
    "«hinweis» sagt, dass nichts entstanden ist. Ein zweiter Versuch ändert daran nichts - gib der Person die " +
    "Meldung weiter, statt den Aufruf zu wiederholen. In einem Verein gilt die Grenze nicht.",
  trainings:
    `Ein Konto ohne Verein besitzt höchstens ${KONTO_TRAININGS_MAX} Trainings (Entwürfe, veröffentlichte, Kopien und übernommene zählen alle, Team-Trainings nicht). ` +
    "Ist die Grenze erreicht, entsteht nichts: Die Fehlerart ist «regel», die Meldung nennt den Bestand, und " +
    "«hinweis» sagt, dass nichts entstanden ist. Ein zweiter Versuch ändert daran nichts - gib der Person die " +
    "Meldung weiter, statt den Aufruf zu wiederholen. In einem Verein gilt die Grenze nicht.",
};

// ── Anzeige ─────────────────────────────────────────────────────────────────

/** Ist nichts mehr frei? Auch bei Bestand über der Grenze. */
export function istVoll(g: KontoGrenze): boolean {
  return g.bestand >= g.max;
}

/** Die Plakette der Seitenleiste: «12/50». */
export function bestandKurz(g: KontoGrenze): string {
  return `${g.bestand}/${g.max}`;
}

/** Die Zeile der Übersicht und der Dialoge: «12 von 50 Übungen»; an der Grenze
 *  «50 von 50 Übungen · nichts mehr frei»; darüber «60 Übungen (höchstens 50) ·
 *  nichts mehr frei». Nie ein negativer Rest (Vorlage `spielerVonText`). */
export function bestandText(art: KontoArt, g: KontoGrenze): string {
  const stand =
    g.bestand <= g.max ? `${g.bestand} von ${g.max} ${NOMEN[art].viele}` : `${mitNomen(art, g.bestand)} (höchstens ${g.max})`;
  return istVoll(g) ? `${stand} · nichts mehr frei` : stand;
}

/** Die Meldung an der Grenze, bevor die Person Angaben macht (AK 5): Titel,
 *  Text und der Link zurück zur eigenen Übersicht. */
export function bestandVollMeldung(art: KontoArt, g: KontoGrenze): { titel: string; text: string; link: string; linkText: string } {
  const titel =
    g.bestand <= g.max
      ? `Nichts mehr frei: ${g.bestand} von ${g.max} ${NOMEN[art].viele}`
      : `Nichts mehr frei: ${mitNomen(art, g.bestand)}, höchstens ${g.max}`;
  return art === "uebungen"
    ? {
        titel,
        text: `Ohne Verein besitzt du höchstens ${g.max} Übungen. Lösche eine, um Platz zu schaffen. In einem Verein gilt die Grenze nicht.`,
        link: "/?mine=1",
        linkText: "Zu meinen Übungen",
      }
    : {
        titel,
        text: `Ohne Verein besitzt du höchstens ${g.max} Trainings. Lösche eines, um Platz zu schaffen. In einem Verein gilt die Grenze nicht.`,
        link: "/trainings?mine=1",
        linkText: "Zu meinen Trainings",
      };
}

/** Der Stand unter der Grenze für Dialog und Seite: «Du besitzt 12 von 50
 *  Übungen.» */
export function bestandSatz(art: KontoArt, g: KontoGrenze): string {
  return besitztSatz(art, g.bestand, g.max);
}

// ── Form der Antwort ────────────────────────────────────────────────────────

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const istZahl = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0;

function grenzeAus(x: unknown): KontoGrenze | null {
  if (!istObjekt(x) || !istZahl(x.bestand) || !istZahl(x.max) || x.max === 0) return null;
  return { bestand: x.bestand, max: x.max };
}

/** Das Feld `grenzen` von `meine_vereinslage()`, auf seine Form geprüft:
 *  `null` mit Verein (PC 3), die beiden Stände ohne; `undefined`, wenn die
 *  Antwort nicht dem Vertrag entspricht — das ist ein technischer Fehler, keine
 *  halbe Auskunft (Muster lib/verein-antwort.ts). */
export function kontoGrenzenAus(x: unknown): KontoGrenzen | null | undefined {
  if (x === null) return null;
  if (!istObjekt(x)) return undefined;
  const uebungen = grenzeAus(x.uebungen);
  const trainings = grenzeAus(x.trainings);
  return uebungen && trainings ? { uebungen, trainings } : undefined;
}
