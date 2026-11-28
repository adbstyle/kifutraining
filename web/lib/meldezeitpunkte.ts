/* Meldezeitpunkte der Spieler:innen eines Teams (#703): wie lange vor Beginn
   bzw. Anpfiff sie sich von Trainings abmelden und zu Spielen an- und
   abmelden. Gezählt wird in `team_meldezeitpunkte`
   (supabase/migrations/20261128110000_team_meldezeitpunkte.sql) auf derselben
   Zählbasis wie die Teilnahme; hier stehen die Meldearten, die Zeitfenster,
   die Anzeige der Dauer und was die Seite und der KI-Assistent aus den
   Zeilen machen.

   Massstab ist der Median, Bezug Beginn bzw. Anpfiff, nicht die Meldefrist
   (PO 2026-11-28). Keine Wertung: Es gibt keine Grenze, ab der eine
   Meldung «zu spät» wäre.

   Rein: keine Importe aus `next/*`, die Prüfskripte laden die Datei ohne
   Server. */

/** Die Meldearten in der Folge der Karten und Spalten. SQL-Zwilling: der
 *  Ausdruck `art || '_' || meldung` in `team_meldezeitpunkte` (Trainings:
 *  nur Abmeldungen). */
export const MELDEARTEN = ["training_abmeldung", "spiel_anmeldung", "spiel_abmeldung"] as const;
export type Meldeart = (typeof MELDEARTEN)[number];

/** Die fünf Zeitfenster, vom frühesten zum kurzfristigsten (Prototyp «702
 *  Teamübersicht»). `ueber`: die untere Grenze in Sekunden, streng
 *  darüber; ein Grenzwert zählt ins Fenster, das dort endet (genau 3 Tage →
 *  «1–3 Tage», PO 2026-11-28). SQL-Zwilling: die `filter`-Bedingungen in
 *  `team_meldezeitpunkte`. */
export const MELDE_FENSTER = [
  { label: "mehr als 7 Tage", ueber: 7 * 86400 },
  { label: "3–7 Tage", ueber: 3 * 86400 },
  { label: "1–3 Tage", ueber: 86400 },
  { label: "6–24 Stunden", ueber: 6 * 3600 },
  { label: "höchstens 6 Stunden", ueber: -Infinity },
] as const;

/** Das Fenster einer Meldung (Index in `MELDE_FENSTER`). */
export function fensterIndex(sekunden: number): number {
  return MELDE_FENSTER.findIndex((f) => sekunden > f.ueber);
}

/** Eine Zeile aus `team_meldezeitpunkte`. */
export type MeldeZeile = {
  spieler_id: string;
  meldeart: string;
  anzahl: number;
  median_sekunden: number | null;
  fenster: number[];
};

const istMeldeart = (s: string): s is Meldeart => (MELDEARTEN as readonly string[]).includes(s);

/** Je Meldeart der Median in Sekunden; `null`: keine Meldung mit
 *  festgehaltenem Zeitpunkt (AK 4). */
export type MeldeMediane = Record<Meldeart, number | null>;
/** Je Meldeart, auf wie vielen Meldungen der Median beruht. */
export type MeldeAnzahlen = Record<Meldeart, number>;

const leereMediane = (): MeldeMediane => ({ training_abmeldung: null, spiel_anmeldung: null, spiel_abmeldung: null });
const leereAnzahlen = (): MeldeAnzahlen => ({ training_abmeldung: 0, spiel_anmeldung: 0, spiel_abmeldung: 0 });

/** Die Mediane und Anzahlen je Spieler:in. Wer fehlt, hat keine Angabe. */
export function meldeMediane(
  zeilen: readonly MeldeZeile[],
): Map<string, { mediane: MeldeMediane; anzahl: MeldeAnzahlen }> {
  const je = new Map<string, { mediane: MeldeMediane; anzahl: MeldeAnzahlen }>();
  for (const z of zeilen) {
    if (!istMeldeart(z.meldeart)) continue;
    const e = je.get(z.spieler_id) ?? { mediane: leereMediane(), anzahl: leereAnzahlen() };
    e.mediane[z.meldeart] = z.median_sekunden;
    e.anzahl[z.meldeart] = z.anzahl;
    je.set(z.spieler_id, e);
  }
  return je;
}

/** Ohne Meldung: keine Angabe in allen drei Arten. */
export function keineMediane(): { mediane: MeldeMediane; anzahl: MeldeAnzahlen } {
  return { mediane: leereMediane(), anzahl: leereAnzahlen() };
}

/** Die Verteilung auf die Fenster für das Team (AK 5): je Meldeart fünf
 *  Zähler, summiert über die Spieler:innen `ids` (aktuell im Team und
 *  eingegrenzt, AK 9). */
export function fasseFensterZusammen(zeilen: readonly MeldeZeile[], ids: Iterable<string>): Record<Meldeart, number[]> {
  const nur = new Set(ids);
  const summe = Object.fromEntries(MELDEARTEN.map((m) => [m, MELDE_FENSTER.map(() => 0)])) as Record<Meldeart, number[]>;
  for (const z of zeilen) {
    if (!istMeldeart(z.meldeart) || !nur.has(z.spieler_id)) continue;
    const zaehler = summe[z.meldeart];
    z.fenster.forEach((n, i) => {
      if (i < zaehler.length) zaehler[i] += n;
    });
  }
  return summe;
}

/** Eine Dauer vor Beginn als Text (Prototyp `dauer()`): unter einer Stunde
 *  «unter 1 Std.», unter einem Tag in ganzen Stunden, sonst in halben Tagen;
 *  `null` ist «keine Angabe». */
export function dauerText(sekunden: number | null): string {
  if (sekunden === null) return MELDE_TEXT.keineAngabe;
  const stunden = sekunden / 3600;
  if (stunden < 1) return "unter 1 Std.";
  if (stunden < 24) return `${Math.round(stunden)} Std.`;
  const tage = Math.round((stunden / 24) * 2) / 2;
  return tage === 1 ? "1 Tag" : `${String(tage).replace(".", ",")} Tage`;
}

/** Ein Median in Stunden mit einer Nachkommastelle — für den KI-Assistenten. */
export function stundenGerundet(sekunden: number | null): number | null {
  return sekunden === null ? null : Math.round(sekunden / 360) / 10;
}

export const MELDE_TEXT = {
  keineAngabe: "keine Angabe",
  /** Im Team stehen noch keine Spieler:innen. */
  keineSpielerText: "Sobald Spieler:innen im Team sind, steht hier, wie früh sie sich ab- und anmelden.",
  /** Die Karten über den Fenstern (AK 5). */
  karte: {
    training_abmeldung: "Abmeldungen von Trainings",
    spiel_anmeldung: "Anmeldungen zu Spielen",
    spiel_abmeldung: "Abmeldungen von Spielen",
  } satisfies Record<Meldeart, string>,
  /** Die Spalten der Tabelle «Median vor Beginn» (AK 1–3). */
  spalte: {
    training_abmeldung: "Abmeldung vom Training",
    spiel_anmeldung: "Anmeldung zum Spiel",
    spiel_abmeldung: "Abmeldung vom Spiel",
  } satisfies Record<Meldeart, string>,
  gruppe: "Median vor Beginn",
  unter: (m: Meldeart) => `Anzahl je Abstand ${m === "training_abmeldung" ? "zum Beginn" : "zum Anpfiff"}`,
  liste: (m: Meldeart) =>
    `${MELDE_TEXT.karte[m]} nach Abstand ${m === "training_abmeldung" ? "zum Beginn" : "zum Anpfiff"}`,
  teamTitel: "Meldungen im Team",
  teamUnter: "Wie lange vor Beginn bzw. Anpfiff gemeldet wurde.",
  /** Die Eingrenzung trifft nicht alle (AK 9). */
  umfang: (n: number, von: number) => `${n} von ${von} Spieler:innen`,
  karteLeer: "Im Zeitraum keine Meldung mit festgehaltenem Zeitpunkt.",
  ohneAbmeldung: "Ohne Abmeldung gefehlt",
  ohneAbmeldungUnter: "Angemeldet und nicht erschienen",
  nichtGemeldet: "Nicht gemeldet",
  nichtGemeldetUnter: "Spiele: Meldefrist verpasst oder ohne Meldung",
  trainings: "Trainings",
  spiele: "Spiele",
  eigeneGruppen: "«Ohne Abmeldung gefehlt» und «Nicht gemeldet» zählen weder in die Fenster noch in die Mediane.",
  jeSpielerin: "Je Spieler:in",
  /** Der Hinweis hinter ⓘ (Prototyp): wie gezählt wird. */
  hinweisLabel: "Meldungen im Team",
  hinweis: [
    ["Median:", "die mittlere Meldung. Die Hälfte der Meldungen lag früher, die Hälfte später. Gemessen bis Beginn bzw. Anpfiff, nicht bis zur Meldefrist."],
    ["Fenster:", "Eine Meldung genau auf einer Grenze zählt zum Fenster, das dort endet: genau 3 Tage vor Beginn zählt zu «1–3 Tage», genau 24 Stunden zu «6–24 Stunden»."],
    ["Was zählt:", "je Termin nur der zuletzt gültige Wechsel, egal wer ihn gesetzt hat. Meldungen ab Beginn und Meldungen ohne festgehaltenen Zeitpunkt zählen nicht."],
  ] as const,
  /** Die Beschriftung der Tabelle für Vorlesehilfen. */
  tabelle: (zeitraum: string | null) =>
    `Meldezeitpunkte der Spieler:innen, ${zeitraum ? `Zeitraum: ${zeitraum}` : "ganze Zeit im Team"}`,
  fussnote:
    "Median aus den Meldungen mit festgehaltenem Zeitpunkt, gemessen bis Beginn bzw. Anpfiff. «keine Angabe»: keine solche Meldung im Zeitraum.",
} as const;
