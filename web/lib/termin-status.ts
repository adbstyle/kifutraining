import type { LozengeAppearance } from "./farben";
import { richtwertStufe, type RichtwertStufe } from "./spiel";
import type { TerminZeile } from "./queries/termine-fuer";

/* Der Status eines Termins in einem Wort (Epic #490): als Lozenge über
   seinem Namen, überall, wo Mitglieder Termine sehen. Die Farbe unterstreicht
   nur das Wort, die Zahl daneben steht immer ungefärbt.

   - Training: «Vorbereitet» (grau), «Nicht vorbereitet» (gelb).
   - Spiel: wie seine Spielerzahl zum Richtwert steht — «Zu wenig» und «Zu
     viel» rot, «Knapp» gelb, «Genügend» grün. Ohne Richtwert oder ohne
     Spielerliste gibt es keinen.
   - Ausgefallen: «Fällt aus» (grau), geht allem vor.
   - Vergangen (ab dem Folgetag): keiner. */
export type TerminStatus = { wort: string; appearance: LozengeAppearance };

export const SPIEL_STATUS: Record<RichtwertStufe, TerminStatus> = {
  unter: { wort: "Zu wenig", appearance: "danger" },
  knapp: { wort: "Knapp", appearance: "warning" },
  im: { wort: "Genügend", appearance: "success" },
  ueber: { wort: "Zu viel", appearance: "danger" },
};

export const TERMIN_STATUS = {
  vorbereitet: { wort: "Vorbereitet", appearance: "neutral" },
  nichtVorbereitet: { wort: "Nicht vorbereitet", appearance: "warning" },
  faelltAus: { wort: "Fällt aus", appearance: "neutral" },
} as const satisfies Record<string, TerminStatus>;

/** Der Status eines Spiels aus seiner Spielerzahl; ohne Richtwert `null`. */
export function spielStatus(zahl: number, min: number | null, max: number | null): TerminStatus | null {
  const stufe = richtwertStufe(zahl, min, max);
  return stufe ? SPIEL_STATUS[stufe] : null;
}

/** Der Status eines Termins im Plan; `null`, wo keiner steht. Ab dem Anpfiff
 *  bewertet ein Spiel die Anwesenden, davor die Angemeldeten. */
export function terminStatus(t: TerminZeile, heute: string): TerminStatus | null {
  if (t.datum < heute) return null;
  if (t.ausgefallen) return TERMIN_STATUS.faelltAus;
  if (t.spiel) {
    if (!t.spielstand) return null;
    const zahl = t.spielstand.anwesend ?? t.spielstand.angemeldet;
    return spielStatus(zahl, t.spiel.richtwertMin, t.spiel.richtwertMax);
  }
  return t.training ? TERMIN_STATUS.vorbereitet : TERMIN_STATUS.nichtVorbereitet;
}

/** Wie das Kalenderblatt eines Termins steht: weiss, solange er bevorsteht;
 *  grau ab dem Folgetag; grau und durchgestrichen, wenn er ausfällt. */
export type BlattStand = "aktiv" | "vergangen" | "gestrichen";

export function blattStand(t: Pick<TerminZeile, "datum" | "ausgefallen">, heute: string): BlattStand {
  if (t.ausgefallen) return "gestrichen";
  return t.datum < heute ? "vergangen" : "aktiv";
}
