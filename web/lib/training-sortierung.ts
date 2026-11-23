/* Sortierung der Trainingsübersicht (#629) und des Team-Bestands (#637).
   Nach der Altersstufe sortiert man nicht mehr (#636): Sie steht nicht mehr
   in der Zeile, und eine alte Adresse mit `sort=stufe` fällt still auf die
   Vorgabe zurück (`leseSortierung`). Die Wahl steht in der Adresse
   (`?sort=<spalte>&dir=<auf|ab>`), damit sie das Neuladen und einen geteilten
   Link übersteht (PC 1) und jede Such- oder Filteränderung mitnimmt (PC 2).
   Ohne Wahl: zuletzt Geändertes zuerst, auch mit Suchbegriff (AK 7).

   Sortiert wird auf dem Server, nach dem Mappen der Zeilen: Die Kennzahlen
   (Übungen und Dauer der vordersten Variante) entstehen erst in `mapListRow`,
   die Datenbank kennt sie nicht. Bei einigen hundert Zeilen ist das eine
   Sache von Millisekunden (NFR 1). */

export const SORTIER_SPALTEN = ["name", "uebungen", "dauer", "geaendert"] as const;
export type SortierSpalte = (typeof SORTIER_SPALTEN)[number];
type SortierRichtung = "auf" | "ab";
export type TrainingSortierung = { spalte: SortierSpalte; richtung: SortierRichtung };

/** Ohne Wahl: das Datum der letzten Änderung, absteigend (#629 AK 7). */
const SORTIERUNG_VORGABE: TrainingSortierung = { spalte: "geaendert", richtung: "ab" };

/** Die Beschriftung jeder Spalte — Spaltenkopf und kompakte Sortierwahl. */
export const SORTIER_LABEL: Record<SortierSpalte, string> = {
  name: "Name",
  uebungen: "Übungen",
  dauer: "Dauer",
  geaendert: "Geändert",
};

/** Womit eine Spalte beginnt, wenn man sie neu wählt: Text von A nach Z,
 *  Zahlen und Datum vom Grössten bzw. Neusten her — das, wonach man meist
 *  sucht. */
export function ersteRichtung(spalte: SortierSpalte): SortierRichtung {
  return spalte === "name" ? "auf" : "ab";
}

function istSpalte(wert: string | undefined): wert is SortierSpalte {
  return SORTIER_SPALTEN.includes(wert as SortierSpalte);
}

/** Die Sortierung aus den Adressparametern. Eine unbekannte Spalte fällt auf
 *  die Vorgabe zurück, eine unbekannte Richtung auf die erste der Spalte —
 *  eine verstümmelte Adresse zeigt so immer eine sinnvolle Ordnung. */
export function leseSortierung(sort: string | undefined, dir: string | undefined): TrainingSortierung {
  if (!istSpalte(sort)) return SORTIERUNG_VORGABE;
  const richtung = dir === "auf" || dir === "ab" ? dir : ersteRichtung(sort);
  return { spalte: sort, richtung };
}

/** Was ein Klick auf einen Spaltenkopf wählt: die aktive Spalte kehrt ihre
 *  Richtung um, eine andere beginnt mit ihrer ersten Richtung. */
export function naechsteSortierung(aktuell: TrainingSortierung, spalte: SortierSpalte): TrainingSortierung {
  if (aktuell.spalte === spalte) {
    return { spalte, richtung: aktuell.richtung === "auf" ? "ab" : "auf" };
  }
  return { spalte, richtung: ersteRichtung(spalte) };
}

/** Die Adresse mit einer Sortierung; alle übrigen Parameter (Suche, Filter,
 *  die Auswahl des Detail #630) bleiben stehen. Die Vorgabe schreibt keine
 *  Parameter — sie ist die nackte Ordnung. */
export function sortierHref(
  pfad: string,
  parameter: Record<string, string>,
  s: TrainingSortierung,
): string {
  const p = new URLSearchParams(parameter);
  p.delete("sort");
  p.delete("dir");
  if (s.spalte !== SORTIERUNG_VORGABE.spalte || s.richtung !== SORTIERUNG_VORGABE.richtung) {
    p.set("sort", s.spalte);
    p.set("dir", s.richtung);
  }
  const qs = p.toString();
  return qs ? `${pfad}?${qs}` : pfad;
}

/** Was die Sortierung von einer Zeile braucht — `TrainingListRow` erfüllt es. */
type SortierbareZeile = {
  id: string;
  name: string;
  exerciseCount: number;
  totalDuration: number;
  hasAnyDuration: boolean;
  updatedAt: string;
};

const namen = new Intl.Collator("de");

/** Die Zeilen in der gewählten Ordnung, als neue Liste.
 *
 *  - Trainings ohne erfasste Dauer stehen beim Sortieren nach Dauer in BEIDEN
 *    Richtungen am Ende (#629 AK 9) — «keine Dauer» ist keine kurze Dauer.
 *  - Gleichstand: zuletzt Geändertes zuerst (AK 8), danach die Kennung, damit
 *    die Ordnung bei jedem Laden dieselbe ist. */
export function sortiereTrainings<T extends SortierbareZeile>(zeilen: readonly T[], s: TrainingSortierung): T[] {
  const faktor = s.richtung === "auf" ? 1 : -1;

  function vergleicheSpalte(a: T, b: T): number {
    switch (s.spalte) {
      case "name":
        return faktor * namen.compare(a.name, b.name);
      case "uebungen":
        return faktor * (a.exerciseCount - b.exerciseCount);
      case "dauer":
        // Ohne Dauer ans Ende, unabhängig von der Richtung.
        if (a.hasAnyDuration !== b.hasAnyDuration) return a.hasAnyDuration ? -1 : 1;
        return faktor * (a.totalDuration - b.totalDuration);
      case "geaendert":
        return faktor * vergleicheDatum(a.updatedAt, b.updatedAt);
    }
  }

  return zeilen.slice().sort(
    (a, b) =>
      vergleicheSpalte(a, b) ||
      vergleicheDatum(b.updatedAt, a.updatedAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

function vergleicheDatum(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b);
}
