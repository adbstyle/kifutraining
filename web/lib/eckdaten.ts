import {
  feldtyp as feldtypLabels,
  hauptteilkategorie as hauptteilkategorieLabels,
} from "@/lib/vocab";
import { traegtFeldtyp, traegtSpielfeldgroesse } from "@/lib/altersstufe";
import {
  EINORDNUNG_LABEL,
  SPIELER_BEGRIFF,
  SPIELER_KURZ,
  anzahlSpielerText,
  spielfeldText,
} from "@/lib/labels";
import { sortStufen } from "@/lib/training";
import type { ExerciseListRow } from "@/lib/queries/uebungen-fuer";
import type { Eckdatum } from "@/components/ui";

/** Was Karte und Übungsseite von einer Übung brauchen, um ihre Eckdaten zu
 *  beschriften — Listen- wie Detailzeile tragen es. */
export type EckdatenQuelle = Pick<
  ExerciseListRow,
  | "altersstufe"
  | "trainingsteil"
  | "hauptteilkategorie"
  | "feldtyp"
  | "spielfeld_laenge_m"
  | "spielfeld_breite_m"
  | "kategorien"
  | "anzahl_kinder"
>;

/** Das Feld einer Übung als Klartext, je `null`, wo nichts zu zeigen ist.
 *  Die Spielfeldgrösse führt das Junioren-Manual an Stelle des Feldtyps
 *  (Story 3 AK 8/10); im Kinderfussball ergänzt sie das freie Feld (#272).
 *  Eine Regel für Übungsseite und Übungskarte (#305 NFR 2). */
export function feldAngaben(ex: EckdatenQuelle): {
  feldtyp: string | null;
  spielfeld: string | null;
} {
  return {
    feldtyp:
      traegtFeldtyp(ex.altersstufe) && ex.feldtyp
        ? feldtypLabels[ex.feldtyp as keyof typeof feldtypLabels] ?? ex.feldtyp
        : null,
    spielfeld: traegtSpielfeldgroesse(ex.altersstufe, ex.feldtyp)
      ? spielfeldText(ex.spielfeld_laenge_m, ex.spielfeld_breite_m)
      : null,
  };
}

/** Die Eckdaten einer Übungskarte (#305): Alterskategorien · Einordnung ·
 *  Feld · Spieler:innen. Nicht erfasste Angaben fallen ohne Platzhalter weg.
 *
 *  - Alterskategorien als Buchstaben, aufsteigend G bis A — auch unter
 *    aktivem Alterskategorien-Filter (PO 2026-09-29).
 *  - Einordnung nur auf der feinsten Ebene: im Kinderfussball-Hauptteil die
 *    Hauptteilkategorie, sonst Trainingsteil bzw. Junioren-Block.
 *  - Feld: die Spielfeldgrösse, wo die Übung eine trägt und sie erfasst ist,
 *    sonst der Feldtyp einer Kinderfussball-Übung. Beim freien Feld mit
 *    Massen genügen die Masse. */
export function uebungEckdaten(ex: EckdatenQuelle): Eckdatum[] {
  const einordnung = ex.hauptteilkategorie
    ? hauptteilkategorieLabels[
        ex.hauptteilkategorie as keyof typeof hauptteilkategorieLabels
      ] ?? ex.hauptteilkategorie
    : EINORDNUNG_LABEL[ex.trainingsteil] ?? ex.trainingsteil;
  const { feldtyp, spielfeld } = feldAngaben(ex);
  const feld = spielfeld ?? feldtyp;
  const anzahl = anzahlSpielerText(ex.anzahl_kinder);

  return [
    ex.kategorien.length > 0 ? { text: zusammen(sortStufen(ex.kategorien).join(" ")) } : null,
    { text: einordnung },
    feld ? { text: zusammen(feld) } : null,
    // Auf der schmalen Karte abgekürzt; vorgelesen wird der volle Begriff.
    anzahl
      ? {
          text: zusammen(`${anzahl} ${SPIELER_KURZ}`),
          vorgelesen: `${anzahl} ${SPIELER_BEGRIFF}`,
        }
      : null,
  ].filter((e): e is Eckdatum => e != null);
}

/** Kurze Angaben umbrechen nie in sich («ab 4 Sp.», «25 × 18 m»), sondern
 *  nur an den Trennern; umbrechen darf allein die Einordnung, die auf einer
 *  schmalen Karte länger als eine Zeile sein kann. */
function zusammen(text: string): string {
  return text.replace(/ /g, " ");
}
