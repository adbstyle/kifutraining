/**
 * Die Gesamt-Materialliste eines Trainings (Story #271) — reine Fachlogik.
 *
 * Gesucht ist, was das Training zu einem Zeitpunkt HÖCHSTENS gleichzeitig
 * braucht, nicht die Summe über alle Übungen: Material einer beendeten Übung
 * ist für die nächste wieder frei. Dafür zerfällt das Training in Zeitfenster:
 *
 *   - Jede Übung ausserhalb des Hauptteils ist ein eigenes Fenster — diese
 *     Teile laufen nacheinander, für alle Kinder gemeinsam.
 *   - Im Hauptteil ist jeder Wechsel ein Fenster: Alle Übungen, an denen in
 *     diesem Wechsel eine Gruppe steht, laufen parallel und zählen zusammen
 *     (lib/gruppen.ts: der Index der Gruppenfolge IST der Wechsel). Eine Übung,
 *     die mehrere Gruppen nacheinander durchlaufen, steht in einem Fenster
 *     einmal — sie ist eine Station, nicht eine je Gruppe.
 *   - Eine Hauptteil-Übung ohne Gruppen machen alle gemeinsam — ein eigenes
 *     Fenster. (Ein Hauptteil ganz ohne Gruppen läuft also nacheinander ab.)
 *   - Die Varianten des Hauptteils sind Alternativen: Jede bildet ihre eigenen
 *     Fenster, gespielt wird eine davon.
 *
 * Je Art und Farbe gilt dann das Maximum über alle Fenster — so reicht die
 * Liste für jede Variante und jeden Moment. Die freie Ergänzung wird nicht
 * verrechnet (Epic Out of Scope 4), sondern je Übung aufgeführt.
 */
import { istHauptteil } from "@/lib/gruppen";
import { normalisiere, schluessel, type MaterialPosten } from "@/lib/material";

/** Was die Gesamtliste von einer Fassung braucht — der Ausschnitt von
 *  `TrainingExerciseItem`, den Editor, Ansichten und KI-Auskunft haben. */
export type MaterialFassung = {
  id: string;
  name: string;
  trainingsteil: string;
  varianteId: string | null;
  materialListe: readonly MaterialPosten[];
  material: readonly string[];
  gruppen: readonly { id: string }[];
};

export type GesamtMaterial = {
  /** Höchster gleichzeitiger Bedarf je Art und Farbe, in Normalform. */
  liste: MaterialPosten[];
  /** Die freien Ergänzungen, je Übung in Trainingsreihenfolge (Story #271
   *  AK 7) — über alle Varianten. */
  ergaenzungen: { fassungId: string; uebung: string; texte: string[] }[];
};

function summe(fassungen: readonly MaterialFassung[]): MaterialPosten[] {
  return normalisiere(fassungen.flatMap((f) => f.materialListe));
}

export function gesamtMaterial(
  exercises: readonly MaterialFassung[],
  varianten: readonly { id: string }[],
): GesamtMaterial {
  const fenster: MaterialPosten[][] = [];

  for (const f of exercises) if (!istHauptteil(f.trainingsteil)) fenster.push(summe([f]));

  // Ohne geführte Variante (Altbestand) ist der ganze Hauptteil eine.
  const zusammenstellungen: (string | null)[] =
    varianten.length > 0 ? varianten.map((v) => v.id) : [null];
  for (const v of zusammenstellungen) {
    const hauptteil = exercises.filter(
      (f) => istHauptteil(f.trainingsteil) && (v === null || f.varianteId === v),
    );
    const wechsel = hauptteil.reduce((max, f) => Math.max(max, f.gruppen.length), 0);
    for (let w = 0; w < wechsel; w++)
      fenster.push(summe(hauptteil.filter((f) => f.gruppen.length > w)));
    for (const f of hauptteil) if (f.gruppen.length === 0) fenster.push(summe([f]));
  }

  const hoechst = new Map<string, MaterialPosten>();
  for (const posten of fenster)
    for (const p of posten) {
      const k = schluessel(p);
      if ((hoechst.get(k)?.menge ?? 0) < p.menge) hoechst.set(k, p);
    }

  return {
    liste: normalisiere([...hoechst.values()]),
    ergaenzungen: exercises
      .filter((f) => f.material.length > 0)
      .map((f) => ({ fassungId: f.id, uebung: f.name, texte: [...f.material] })),
  };
}
