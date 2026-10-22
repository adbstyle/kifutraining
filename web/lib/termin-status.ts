import type { LozengeAppearance } from "./farben";
import {
  AUFGEBOT_TEXT,
  MELDUNG_TEXT,
  NACHTRAG_TEXT,
  fristAbgelaufen,
  meldefristVerpasst,
  richtwertStufe,
  type Meldung,
  type RichtwertStufe,
} from "./spiel";
import type { TerminZeile } from "./queries/termine-fuer";

/* Der Status eines Termins in einem Wort (Epic #490): als Lozenge über
   seinem Namen, überall, wo Mitglieder Termine sehen. Die Farbe unterstreicht
   nur das Wort, die Zahl daneben steht immer ungefärbt.

   - Training: «Vorbereitet» (grün), «Nicht vorbereitet» (grau) — so bleibt
     der Plan ruhig, wo die meisten Trainings noch offen sind (PO 2026-10-22).
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
  vorbereitet: { wort: "Vorbereitet", appearance: "success" },
  nichtVorbereitet: { wort: "Nicht vorbereitet", appearance: "neutral" },
  faelltAus: { wort: "Fällt aus", appearance: "neutral" },
} as const satisfies Record<string, TerminStatus>;

/** Der Status einer Spieler:in an einem Spiel (#495, #496): grün angemeldet
 *  und doch erschienen, gelb ohne Meldung, rot abgemeldet, nicht aufgeboten,
 *  nicht erschienen und Meldefrist verpasst. */
export const MELDE_STATUS = {
  ohne: { wort: MELDUNG_TEXT.ohne, appearance: "warning" },
  verpasst: { wort: MELDUNG_TEXT.verpasst, appearance: "danger" },
  angemeldet: { wort: MELDUNG_TEXT.angemeldet, appearance: "success" },
  abgemeldet: { wort: MELDUNG_TEXT.abgemeldet, appearance: "danger" },
  nichtAufgeboten: { wort: AUFGEBOT_TEXT.nichtAufgeboten, appearance: "danger" },
  nichtErschienen: { wort: NACHTRAG_TEXT.nichtErschienen, appearance: "danger" },
  dochErschienen: { wort: NACHTRAG_TEXT.dochErschienen, appearance: "success" },
} as const satisfies Record<string, TerminStatus>;

/** Der Stand vor dem Anpfiff bzw. beim Anpfiff, ohne Nachtrag. */
export function meldeStatus(m: Meldung, nichtAufgeboten: boolean, fristAbgelaufen: boolean): TerminStatus {
  if (nichtAufgeboten) return MELDE_STATUS.nichtAufgeboten;
  if (m !== null) return MELDE_STATUS[m];
  return meldefristVerpasst(m, nichtAufgeboten, fristAbgelaufen) ? MELDE_STATUS.verpasst : MELDE_STATUS.ohne;
}

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

/** Wie das Kalenderblatt eines Termins steht: ein bevorstehendes Spiel weiss,
 *  ein bevorstehendes Training leiser — nur umrandet, damit die Spiele
 *  hervortreten (PO 2026-10-22); grau ab dem Folgetag; grau und
 *  durchgestrichen, wenn er ausfällt. */
export type BlattStand = "aktiv" | "leise" | "vergangen" | "gestrichen";

export function blattStand(t: Pick<TerminZeile, "datum" | "ausgefallen" | "art">, heute: string): BlattStand {
  if (t.ausgefallen) return "gestrichen";
  if (t.datum < heute) return "vergangen";
  return t.art === "spiel" ? "aktiv" : "leise";
}

/** Hat das Spiel gerade Handlungsbedarf (#494)? Die Meldefrist ist
 *  abgelaufen, der Anpfiff noch nicht da, und das Spiel hat Richtwert und
 *  Spielerliste — dann meldet sich niemand mehr von selbst, und es steht bis
 *  zum Anpfiff als grosse Karte im Plan. Ausgefallen nie. `jetzt` als
 *  `YYYY-MM-DDTHH:MM` am Trainingsort. */
export function nachMeldefrist(t: TerminZeile, jetzt: string): boolean {
  if (!t.spiel || t.ausgefallen || !t.spielstand || !t.spiel.meldefrist) return false;
  if (t.spiel.richtwertMin === null && t.spiel.richtwertMax === null) return false;
  return fristAbgelaufen(t.spiel.meldefrist, jetzt) && jetzt < `${t.datum}T${t.beginn.slice(0, 5)}`;
}

/** Was nach der Meldefrist zu tun ist (#494 AK 6–9): rot bei zu wenig und zu
 *  viel, gelb bei knapp, nichts bei genügend. */
export function handlungsMeldung(t: TerminZeile): { appearance: "error" | "warning"; text: string } | null {
  if (!t.spiel || !t.spielstand) return null;
  const { richtwertMin: min, richtwertMax: max } = t.spiel;
  const zahl = t.spielstand.angemeldet;
  const stufe = richtwertStufe(zahl, min, max);
  if (stufe === "unter" && min !== null)
    return { appearance: "error", text: `Es fehlen ${min - zahl} bis zur Mindestzahl ${min}. Spieler:innen direkt anfragen.` };
  if (stufe === "knapp")
    return { appearance: "warning", text: `Genau die Mindestzahl ${min} ist erreicht. Fällt jemand aus, reicht es nicht mehr. Ersatz bereithalten.` };
  if (stufe === "ueber" && max !== null)
    return { appearance: "error", text: `${zahl - max} über der Höchstzahl ${max}. Aufgebot klären.` };
  return null;
}
