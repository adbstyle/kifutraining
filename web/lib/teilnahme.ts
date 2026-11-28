import { adresseMitWerten, liesListe, type AdressParameter } from "@/lib/adresse";
import { istKalendertag } from "@/lib/termin";
import { plusTage } from "@/lib/serie";

/* Teilnahme-Statistik einer Spieler:in (#700): wie oft sie in einem Zeitraum
   an Trainings und Spielen ihres Teams da war und aus welchem Grund nicht.
   Gezählt wird in der Datenbank (`spieler_teilnahme`); hier stehen die
   Schlüssel der Ergebnisse, der Zeitraum in der Adresse und alle Texte, die
   App und KI-Werkzeug teilen. Rein: keine Importe aus `next/*`, die
   Prüfskripte laden die Datei ohne Server. */

/** Die Ergebnisse je Art, in der Reihenfolge der Anzeige. Zwilling: die
 *  Werte von `ergebnis` in `spieler_teilnahme`
 *  (supabase/migrations/20261127100000_spieler_teilnahme.sql). */
export const TEILNAHME_ERGEBNISSE = {
  training: ["da", "abgemeldet", "nicht_erschienen"],
  spiel: ["da", "abgemeldet", "nicht_erschienen", "nicht_aufgeboten", "meldefrist_verpasst", "ohne_meldung"],
} as const;

export type TeilnahmeArt = keyof typeof TEILNAHME_ERGEBNISSE;
export type TeilnahmeErgebnis = (typeof TEILNAHME_ERGEBNISSE)["spiel"][number];
/** Die Gründe für «nicht da». */
export type TeilnahmeGrund = Exclude<TeilnahmeErgebnis, "da">;

export const TEILNAHME_GRUND_TEXT: Record<TeilnahmeGrund, string> = {
  abgemeldet: "Abgemeldet",
  nicht_erschienen: "Angemeldet, nicht erschienen",
  nicht_aufgeboten: "Nicht aufgeboten",
  meldefrist_verpasst: "Meldefrist verpasst",
  ohne_meldung: "Ohne Meldung",
};

/** Die Zahlen einer Art: alle gezählten Termine, davon da, und je Grund die
 *  übrigen — die Gründe ergeben zusammen «nicht da» (PO 2026-11-27). */
export type TeilnahmeZahlen = {
  gesamt: number;
  da: number;
  nichtDa: number;
  gruende: { grund: TeilnahmeGrund; anzahl: number }[];
};

export type TeilnahmeZeile = { art: string; ergebnis: string; anzahl: number };

/** Die Zeilen der Datenbank als Zahlen je Art. Jeder Grund der Art steht da,
 *  auch mit 0; unbekannte Zeilen fallen weg. */
export function teilnahmeZahlen(zeilen: readonly TeilnahmeZeile[]): Record<TeilnahmeArt, TeilnahmeZahlen> {
  const fuer = (art: TeilnahmeArt): TeilnahmeZahlen => {
    const anzahl = (e: string) =>
      zeilen.filter((z) => z.art === art && z.ergebnis === e).reduce((s, z) => s + z.anzahl, 0);
    const gruende = (TEILNAHME_ERGEBNISSE[art] as readonly TeilnahmeErgebnis[])
      .filter((e): e is TeilnahmeGrund => e !== "da")
      .map((grund) => ({ grund, anzahl: anzahl(grund) }));
    const da = anzahl("da");
    const nichtDa = gruende.reduce((s, g) => s + g.anzahl, 0);
    return { gesamt: da + nichtDa, da, nichtDa, gruende };
  };
  return { training: fuer("training"), spiel: fuer("spiel") };
}

/** Der Adressparameter der Spieler:in, deren Teilnahme neben der
 *  Spielerliste offen ist (`?spieler=`). */
export const SPIELER_AUSWAHL_PARAM = "spieler";

/** Die Parameter der Teilnahme-Spalte; das Zurücksetzen der Spielerliste
 *  lässt sie stehen. */
export const TEILNAHME_PARAMETER = [SPIELER_AUSWAHL_PARAM, "von", "bis"] as const;

// ── Zeitraum ────────────────────────────────────────────────────────────────

/** Der Zeitraum der Statistik: beide Tage eingeschlossen, `null` lässt die
 *  Seite offen — ohne beide zählt die ganze Zeit im Team (AK 2, 7). */
export type Zeitraum = { von: string | null; bis: string | null };

export const ZEITRAUM_FEHLER = {
  von: "«von» ist kein Kalendertag. Gib ihn als JJJJ-MM-TT an.",
  bis: "«bis» ist kein Kalendertag. Gib ihn als JJJJ-MM-TT an.",
  bisVorVon: "Der Bis-Tag darf nicht vor dem Von-Tag liegen.",
} as const;

/** Was am Zeitraum nicht stimmt — oder `null`. Leere Angaben sind offen. */
export function zeitraumFehler(z: { von?: string | null; bis?: string | null }): { feld: "von" | "bis"; text: string } | null {
  if (z.von && !istKalendertag(z.von)) return { feld: "von", text: ZEITRAUM_FEHLER.von };
  if (z.bis && !istKalendertag(z.bis)) return { feld: "bis", text: ZEITRAUM_FEHLER.bis };
  if (z.von && z.bis && z.bis < z.von) return { feld: "bis", text: ZEITRAUM_FEHLER.bisVorVon };
  return null;
}

/** Der Zeitraum aus der Adresse (`?von=`, `?bis=`). Ein unlesbarer Tag fällt
 *  weg, ein Bis vor dem Von ebenfalls (`bereinigteAdresse` schreibt die
 *  Adresse dann um). */
export function liesZeitraum(sp: AdressParameter): Zeitraum {
  const erster = (v: string | string[] | undefined) => liesListe(v)[0] ?? null;
  const z: Zeitraum = { von: erster(sp.von), bis: erster(sp.bis) };
  if (zeitraumFehler({ von: z.von })) z.von = null;
  if (zeitraumFehler(z)) z.bis = null;
  return z;
}

/** Die Adresse ohne das, was nicht stimmt — oder `null`, wenn alles stimmt:
 *  `spieler` ist die geltende Spieler:in (`null`: keine oder eine, die nicht
 *  im Team ist — sie fällt samt Spalte weg); ein unlesbarer Tag oder ein Bis vor dem Von wird
 *  wie `liesZeitraum` bereinigt. Alles übrige reist unverändert mit. */
export function bereinigteTeilnahmeAdresse(pfad: string, sp: AdressParameter, spieler: string | null): string | null {
  return adresseMitWerten(pfad, sp, teilnahmeWerte(sp, spieler));
}

/** Die Adresswerte, die `bereinigteTeilnahmeAdresse` vergleicht — für
 *  Seiten, die sie mit weiteren Werten in einer einzigen Weiterleitung
 *  bereinigen. */
export function teilnahmeWerte(sp: AdressParameter, spieler: string | null): Record<string, string> {
  const z = liesZeitraum(sp);
  return { [SPIELER_AUSWAHL_PARAM]: spieler ?? "", von: z.von ?? "", bis: z.bis ?? "" };
}

/** Die Spieler:in in der Adresse (`?spieler=`) — genau eine, sonst `null`. */
export function liesSpielerAuswahl(sp: AdressParameter): string | null {
  const v = sp[SPIELER_AUSWAHL_PARAM];
  return typeof v === "string" && v !== "" ? v : null;
}

/** Die Kurzwahl im Zeitraum-Filter: der Von-Tag, gerechnet ab heute am
 *  Trainingsort; der Bis-Tag bleibt offen (bis heute). */
export const ZEITRAUM_KURZWAHL = [
  { id: "30-tage", label: "Letzte 30 Tage", von: (heute: string) => plusTage(heute, -29) },
  { id: "3-monate", label: "Letzte 3 Monate", von: (heute: string) => monateZurueck(heute, 3) },
  { id: "jahr", label: "Seit 1. Januar", von: (heute: string) => `${heute.slice(0, 4)}-01-01` },
] as const;

/** Derselbe Kalendertag `n` Monate früher; fehlt er (31. Mai → Februar),
 *  der letzte Tag jenes Monats. */
function monateZurueck(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 - n, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Welche Kurzwahl der Zeitraum ist — oder `null`. */
export function kurzwahlVon(z: Zeitraum, heute: string): (typeof ZEITRAUM_KURZWAHL)[number] | null {
  if (!z.von || z.bis) return null;
  return ZEITRAUM_KURZWAHL.find((k) => k.von(heute) === z.von) ?? null;
}

/** Ein Tag als `TT.MM.JJJJ`. */
export function tagKurz(iso: string): string {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

/** Was der aktive Filterknopf nennt (PO 2026-11-27, wie in Jira): die
 *  Kurzwahl oder die Tage — `null` ohne Zeitraum. */
export function zeitraumWert(z: Zeitraum, heute: string): string | null {
  const kurz = kurzwahlVon(z, heute);
  if (kurz) return kurz.label;
  if (z.von && z.bis) return `${tagKurz(z.von)} – ${tagKurz(z.bis)}`;
  if (z.von) return `ab ${tagKurz(z.von)}`;
  if (z.bis) return `bis ${tagKurz(z.bis)}`;
  return null;
}

// ── Texte ───────────────────────────────────────────────────────────────────

export const TEILNAHME_TEXT = {
  titel: "Teilnahme",
  zeitraum: "Zeitraum",
  kurzwahl: "Kurzwahl",
  vonBis: "Von–Bis",
  von: "Von",
  bis: "Bis",
  zuruecksetzen: "Zurücksetzen",
  training: "Trainings",
  spiel: "Spiele",
  da: "Da",
  nichtDa: "Nicht da",
  /** Ohne gezählten Termin dieser Art — mit oder ohne gewählten Zeitraum. */
  leer: (art: "training" | "spiel", mitZeitraum: boolean) =>
    `${mitZeitraum ? "Im gewählten Zeitraum" : "Bisher"} zählt ${art === "training" ? "kein Training" : "kein Spiel"}.`,
  /** «6 von 7 da» als Satz für Vorlesehilfen und KI. */
  vonDa: (da: number, gesamt: number) => `${da} von ${gesamt} da`,
  /** AK 8: nach welcher Regel gezählt wird und wann jemand als da gilt. */
  regel: (vorname: string) =>
    `Gezählt sind begonnene Termine, die nicht ausgefallen sind und für ${vorname} galten, solange ${vorname} auf der Spielerliste stand. ` +
    "Da ist, wer bei Beginn angemeldet war und nicht als «nicht erschienen» nachgetragen ist, oder wer als «doch erschienen» nachgetragen ist. " +
    "Ob jemand die Anwesenheit geprüft hat, hält die Anwendung nicht fest.",
} as const;
