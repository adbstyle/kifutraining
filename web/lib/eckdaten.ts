import { feldtyp as feldtypLabels } from "@/lib/vocab";
import {
  traegtErscheinungsform,
  traegtFeldtyp,
  traegtSpielfeldgroesse,
  traegtUebungstyp,
} from "@/lib/altersstufe";
import {
  EINORDNUNG_LABEL,
  SPIELER_BEGRIFF,
  hauptteilkategorieText,
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
    ? hauptteilkategorieText(ex.hauptteilkategorie)
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

/** Fachliche Einordnung, die eine Übung tragen kann, aber nicht erfasst hat
 *  (#352): die freiwilligen Angaben Erscheinungsform, Übungstyp, Feldtyp und
 *  Spielfeldgrösse — je nur, wo Altersstufe, Trainingsteil oder Block und
 *  Feldtyp sie vorsehen (die Regeln aus `lib/altersstufe.ts`). Die ersten drei
 *  sind zugleich Filter des Katalogs. Pflichtangaben fehlen bei einer
 *  gesicherten Übung nie; Material und Anzahl Spieler:innen dürfen leer sein,
 *  ohne zu fehlen (PO 2026-10-01). */
export type FehlendeAngabe = "erscheinungsform" | "uebungstyp" | "feldtyp" | "spielfeld";

export function fehlendeEinordnung(
  ex: Pick<
    EckdatenQuelle,
    "altersstufe" | "trainingsteil" | "feldtyp" | "spielfeld_laenge_m" | "spielfeld_breite_m"
  > & { uebungstyp: string | null; erscheinungsform: readonly string[] },
): ReadonlySet<FehlendeAngabe> {
  const fehlt = new Set<FehlendeAngabe>();
  if (traegtErscheinungsform(ex.altersstufe, ex.trainingsteil) && ex.erscheinungsform.length === 0)
    fehlt.add("erscheinungsform");
  if (traegtUebungstyp(ex.altersstufe, ex.trainingsteil) && !ex.uebungstyp) fehlt.add("uebungstyp");
  if (traegtFeldtyp(ex.altersstufe) && !ex.feldtyp) fehlt.add("feldtyp");
  if (
    traegtSpielfeldgroesse(ex.altersstufe, ex.feldtyp) &&
    (ex.spielfeld_laenge_m == null || ex.spielfeld_breite_m == null)
  )
    fehlt.add("spielfeld");
  return fehlt;
}
