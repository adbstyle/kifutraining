// Richtmasse von Kleinfeld und Grossfeld je Alterskategorie des
// Kinderfussballs (Story #392, Epic #388 PO-Entscheid 12).
//
// Kleinfeld und Grossfeld sind in KiFu nach den TOREN einer Übung eingestuft,
// nicht nach ihrer Fläche (`docs/produkt/uebungen.md`), und tragen darum keine
// Meter. Damit der KI-Assistent den Platzbedarf einer solchen Übung trotzdem
// mit den Feldern eines Termins vergleichen kann, legt der Betreiber hier ihre
// Richtmasse fest.
//
// Quelle: SFV «Kinder- und Jugendfussball Ausführungsbestimmungen», gültig
// 2026/27 (https://org.football.ch/portaldata/28/Resources/dokumente/de/
// 05_junioren_breitenfussball/5.1_Ausfuehrungsbestimmungen_Kinder_und_Jugendfussball_2026_27.pdf):
// - Kleinfeld: G ca. 20 × 15 m, F ca. 25 × 20 m, E 25–30 × 20–25 m (Minitore)
// - Grossfeld: F ca. 30 × 25 m, E 43–48 × 25–30 m (Tore 5 × 2 m)
// Die Bestimmungen kennen in G kein Grossfeld; für G gilt das Grossfeld-
// Richtmass von F (PO-Entscheid). Es steht darum nur EINMAL hier und wird für
// G abgeleitet, nicht abgeschrieben.
//
// Reine Daten, nur für den KI-Assistenten (Werkzeug «vokabular»). Die
// Übungen selbst bleiben unberührt: kein erfassbarer Flächenbedarf, Feldtyp
// und Spielfeldgrösse unverändert (#392 PC 1, OoS 1).
//
// REIN: keine Server-Importe.

/** Eine Spanne in ganzen Metern. «ca. 20» ist die Spanne 20 bis 20. */
export type Spanne = { min: number; max: number };

export type Richtmass = {
  laenge_m: Spanne;
  breite_m: Spanne;
  /** Nennt die Quelle das Mass nur ungefähr («ca.»)? */
  ungefaehr: boolean;
};

/** Die Feldtypen mit Richtmass. Das freie Feld hat keins: Seine Grösse ist
 *  die Spielfeldgrösse der Übung — oder unbekannt. */
export const FELDTYPEN_MIT_RICHTMASS = ["kleinfeld", "grossfeld"] as const;
export type FeldtypMitRichtmass = (typeof FELDTYPEN_MIT_RICHTMASS)[number];

/** Die Alterskategorien des Kinderfussballs — dieselben wie
 *  `kategorienFuer("kinderfussball")` in lib/altersstufe.ts; `check:ki-zugang`
 *  hält beide gleich. */
export type RichtmassKategorie = "G" | "F" | "E";

const ca = (laenge: number, breite: number): Richtmass => ({
  laenge_m: { min: laenge, max: laenge },
  breite_m: { min: breite, max: breite },
  ungefaehr: true,
});

const spanne = (laenge: [number, number], breite: [number, number]): Richtmass => ({
  laenge_m: { min: laenge[0], max: laenge[1] },
  breite_m: { min: breite[0], max: breite[1] },
  ungefaehr: false,
});

const GROSSFELD_F = ca(30, 25);

/** Die Tore, auf die ein Feldtyp spielt — dieselbe Torregel, nach der Kleinfeld
 *  und Grossfeld eingestuft sind. Ein grosses Tor einer Kinderfussball-Übung
 *  meint ein 5-m-Tor (Epic #388 PO-Entscheid 3). */
export const FELDTYP_TORE: Record<FeldtypMitRichtmass, string> = {
  kleinfeld: "Minitore",
  grossfeld: "5-m-Tore (5 × 2 m)",
};

/** Das Richtmass je Feldtyp und Alterskategorie, samt der Kategorie, deren
 *  Mass übernommen ist (`null` = eigenes Mass der Quelle). */
export const FELDTYP_RICHTMASSE: Record<
  FeldtypMitRichtmass,
  Record<RichtmassKategorie, Richtmass & { wie_kategorie: RichtmassKategorie | null }>
> = {
  kleinfeld: {
    G: { ...ca(20, 15), wie_kategorie: null },
    F: { ...ca(25, 20), wie_kategorie: null },
    E: { ...spanne([25, 30], [20, 25]), wie_kategorie: null },
  },
  grossfeld: {
    // Die SFV-Bestimmungen kennen in G kein Grossfeld → Mass von F.
    G: { ...GROSSFELD_F, wie_kategorie: "F" },
    F: { ...GROSSFELD_F, wie_kategorie: null },
    E: { ...spanne([43, 48], [25, 30]), wie_kategorie: null },
  },
};

const spanneText = (s: Spanne) => (s.min === s.max ? `${s.min}` : `${s.min}–${s.max}`);

/** Klartext eines Richtmasses, wie die Quelle es schreibt:
 *  «ca. 20 × 15 m» bzw. «25–30 × 20–25 m». */
export function richtmassText(r: Richtmass): string {
  return `${r.ungefaehr ? "ca. " : ""}${spanneText(r.laenge_m)} × ${spanneText(r.breite_m)} m`;
}
