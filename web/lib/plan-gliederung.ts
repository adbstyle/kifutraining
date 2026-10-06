// Die Gliederung des Trainingsplans (Epic #401, #402 AK 2, 19, 20): Monate,
// darin Tage, darin die Termine eines Tages.
//
// REIN: importiert nur lib/monat.ts (ebenfalls rein) — `check:kern` lädt sie mit tsx.
import { monatVon } from "@/lib/monat";

type Datiert = { datum: string; beginn: string | null };

type TagGruppe<T> = { datum: string; termine: T[] };
type MonatGruppe<T> = { monat: string; tage: TagGruppe<T>[] };

/** Nach Beginn aufsteigend, Termine ohne Beginn zuletzt; bei gleichem Beginn
 *  bleibt die Reihenfolge der Eingabe (`Array.sort` ist stabil). */
function nachBeginn(a: Datiert, b: Datiert): number {
  if (a.beginn === b.beginn) return 0;
  if (a.beginn === null) return 1;
  if (b.beginn === null) return -1;
  return a.beginn < b.beginn ? -1 : 1;
}

/** Termine nach Monat und Tag gliedern, in der Reihenfolge, in der die Tage
 *  ankommen — aufsteigend für das Anstehende, absteigend für den Rückblick.
 *  Innerhalb eines Tages gilt immer der Beginn aufsteigend (AK 19), auch im
 *  Rückblick; bei gleichem Beginn die Reihenfolge der Eingabe, die aus der
 *  Datenbank nach dem Anlegen geordnet kommt. */
export function nachMonatUndTag<T extends Datiert>(termine: readonly T[]): MonatGruppe<T>[] {
  const monate: MonatGruppe<T>[] = [];
  for (const t of termine) {
    let monat = monate.at(-1);
    if (monat?.monat !== monatVon(t.datum)) {
      monat = { monat: monatVon(t.datum), tage: [] };
      monate.push(monat);
    }
    let tag = monat.tage.at(-1);
    if (tag?.datum !== t.datum) {
      tag = { datum: t.datum, termine: [] };
      monat.tage.push(tag);
    }
    tag.termine.push(t);
  }
  for (const m of monate) for (const tag of m.tage) tag.termine.sort(nachBeginn);
  return monate;
}
