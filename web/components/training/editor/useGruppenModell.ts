"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  istHauptteil,
  konfliktBefund,
  wechselZahl,
  zeitJeGruppe,
  type Befund,
  type Verteilung,
  type Zeitsumme,
} from "@/lib/gruppen";
import {
  benenneGruppe,
  entferneGruppe,
  legeGruppeAn,
  setzeGruppenfolge,
} from "@/lib/actions/gruppen";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/** Meldung einer Gruppen-Aktion: `null` heisst „gespeichert". */
type Antwort = Promise<string | null>;

/**
 * Das Gruppen-Modell des Editors (Stories #149/#150): die Gruppen eines
 * Trainings, ihre Verteilung auf die Übungen des Hauptteils und was daran
 * nicht aufgeht.
 *
 * Eigener Hook, weil das ein zusammenhängendes Stück ist: ein Zustand
 * (Gruppen + Folgen), fünf Aktionen darauf und drei Ableitungen daraus. Im
 * Editor stünde es zwischen Dauern, Stufen und Dialogen — der Editor bleibt
 * so bei dem, was er ist: Verdrahtung und Darstellung.
 *
 * Beides ist eine OPTIMISTISCHE ÜBERLAGERUNG der Serverdaten, wie die Dauern:
 * Keine Gruppen-Aktion ändert die Gliederung, und keine frischt darum die
 * Serverdaten auf. Ein `router.refresh()` nach jedem Chip-Klick risse den
 * Fokus aus der Zeile, in der der Trainer gerade arbeitet.
 */
export function useGruppenModell({
  trainingId,
  gruppenInitial,
  zuordnungen,
  alleZuordnungen,
  melde,
}: {
  trainingId: string;
  /** Die Gruppen, wie sie vom Server kamen (Anlegereihenfolge). */
  gruppenInitial: { id: string; name: string }[];
  /** Die Zuordnungen der ANGEZEIGTEN Variante, Dauern bereits überlagert. Muss
   *  stabil sein (memoisiert) — an ihr hängt die Konflikt-Rechnung. Verteilung,
   *  Zeitsummen, Wechsel und Konflikte gelten je Variante (#201 AK 9): Was in
   *  einer anderen Variante steht, findet an diesem Trainingstag nicht statt. */
  zuordnungen: TrainingExerciseItem[];
  /** Dieselben Zuordnungen über ALLE Varianten. Grundlage von allem, was die
   *  Gruppe als Ganzes betrifft — die Rückfrage vor dem Entfernen (#201 AK 10)
   *  und die Überlagerung danach: Die Datenbank räumt die Zuweisungen per
   *  Kaskade in jeder Variante weg, nicht nur in der sichtbaren. */
  alleZuordnungen: TrainingExerciseItem[];
  /** Was in die Snackbar geht: abgelehnte Aktionen, quittierte Entfernungen. */
  melde: (text: string) => void;
}) {
  const router = useRouter();
  const [gruppen, setGruppen] = useState(gruppenInitial);
  // Die lokal gesetzten Folgen je Fassung. Fehlt ein Eintrag, gilt der
  // Serverstand der Fassung — darum ein `Record` und keine Vollkopie.
  const [folgen, setFolgen] = useState<Record<string, string[]>>({});
  const [, startTransition] = useTransition();
  // Der letzte laufende Speichervorgang je Fassung. Siehe `setzeFolge`.
  const kette = useRef(new Map<string, Promise<void>>());

  /** Die Folge einer Fassung: lokal gesetzt oder wie vom Server geliefert. */
  const folgeVon = (fassung: TrainingExerciseItem): string[] =>
    folgen[fassung.id] ?? fassung.gruppen.map((g) => g.id);

  /** Die Verteilung des ganzen Hauptteils — im Juniorenfussball über BEIDE
   *  Blöcke hinweg (AK 5). Genau darum steht sie hier und nicht je Block: Der
   *  Wechsel ist eine Aussage über das ganze Training, und blockweise gerechnet
   *  bliebe die Doppelbelegung über die Blockgrenze unentdeckt. */
  const verteilung: Verteilung = useMemo(
    () =>
      zuordnungen
        .filter((f) => istHauptteil(f.trainingsteil))
        .map((f) => ({
          id: f.id,
          name: f.name,
          einordnung: f.trainingsteil,
          dauer: f.durationMin,
          gruppen: folgen[f.id] ?? f.gruppen.map((g) => g.id),
        })),
    [zuordnungen, folgen],
  );

  const befund: Befund = useMemo(
    () => konfliktBefund(verteilung, gruppen),
    [verteilung, gruppen],
  );

  const wechselGesamt = useMemo(() => wechselZahl(verteilung), [verteilung]);

  /** Wie lange jede Gruppe beschäftigt ist (Story #151). Aus derselben
   *  Verteilung wie die Konflikte — darum steht die Summe nach jedem Zuweisen,
   *  jeder Dauer-Änderung und jedem Entfernen sofort richtig da (AK 2), ohne
   *  dass die Serverdaten aufgefrischt werden müssten. */
  const zeiten: Map<string, Zeitsumme> = useMemo(
    () => zeitJeGruppe(verteilung),
    [verteilung],
  );

  /** Die Zuweisungen des GANZEN Trainings — über alle Varianten, jede mit
   *  ihrer Herkunft. Die Verteilung oben kennt nur die angezeigte Variante;
   *  eine Gruppe gehört aber dem Training und steht womöglich in Varianten, die
   *  der Trainer gerade nicht sieht (#201 AK 10). */
  const alleFolgen = useMemo(
    () =>
      alleZuordnungen
        .filter((f) => istHauptteil(f.trainingsteil))
        .map((f) => ({
          id: f.id,
          varianteId: f.varianteId,
          gruppen: folgen[f.id] ?? f.gruppen.map((g) => g.id),
        })),
    [alleZuordnungen, folgen],
  );

  /** An wie vielen Übungen des Hauptteils steht diese Gruppe? Grundlage der
   *  Rückfrage vor dem Entfernen (AK 8) — über alle Varianten gezählt, denn
   *  genau so viele Zuweisungen fallen weg. */
  const zuweisungenVon = (gruppeId: string): number =>
    alleFolgen.filter((f) => f.gruppen.includes(gruppeId)).length;

  /** Dieselbe Zahl, aufgeteilt nach Varianten — damit die Rückfrage sagen kann,
   *  was ausserhalb des Sichtbaren wegfällt (#201 AK 10). Nur Varianten mit
   *  Zuweisungen stehen darin; die Reihenfolge ist die der Fassungen und wird
   *  vom Aufrufer an der Variantenliste ausgerichtet. */
  const zuweisungenJeVariante = (
    gruppeId: string,
  ): { varianteId: string; anzahl: number }[] => {
    const je = new Map<string, number>();
    for (const f of alleFolgen) {
      // Eine Hauptteil-Fassung trägt immer eine Variante (CHECK
      // `te_variante_genau_bei_hauptteil`); der Typ lässt `null` trotzdem zu.
      if (!f.varianteId || !f.gruppen.includes(gruppeId)) continue;
      je.set(f.varianteId, (je.get(f.varianteId) ?? 0) + 1);
    }
    return [...je].map(([varianteId, anzahl]) => ({ varianteId, anzahl }));
  };

  /** Wie viele Gruppen trägt diese Übung? Grundlage der Rückfrage vor dem
   *  Entfernen der Übung (AK 16). */
  const gruppenAn = (fassungId: string): number =>
    alleFolgen.find((f) => f.id === fassungId)?.gruppen.length ?? 0;

  /** Den lokalen Stand einer Fassung vergessen — nach einer Aktion, die die
   *  Serverdaten auffrischt. Ab dann gilt wieder, was der Server sagt. */
  const vergissFolge = (fassungId: string) =>
    setFolgen((prev) => {
      if (!(fassungId in prev)) return prev;
      const rest = { ...prev };
      delete rest[fassungId];
      return rest;
    });

  /**
   * Die Folge einer Übung setzen (AK 1/2/3) — Zuweisen, Umsortieren und
   * Entfernen sind dieselbe Aktion.
   *
   * Die Aufrufe einer Fassung laufen VERKETTET, einer nach dem anderen. Der
   * Aufruf ersetzt die ganze Folge, ist also kein Zuwachs, sondern eine
   * Ansage: Zwei rasche Chip-Klicks nebeneinander abgeschickt, und die
   * Datenbank behält die Folge, deren Antwort zuletzt eintrifft — das kann die
   * ältere sein. Eine Kette je Fassung genügt dagegen (ein Zähler, der nur die
   * jüngste Antwort gelten liesse, ordnete bloss die Anzeige und liesse die
   * ältere Folge in der Datenbank stehen); Fassungen untereinander sind
   * unabhängig und dürfen weiter nebeneinander laufen.
   *
   * Wird eine Änderung abgelehnt, fällt die Zeile auf den Serverstand zurück:
   * Er ist der einzige Stand, von dem sicher ist, dass er gilt. Weil die
   * Serverdaten seit dem Seitenaufbau veraltet sein können — eine frühere
   * Änderung derselben Zeile ist ja gespeichert —, wird zugleich
   * aufgefrischt. Nur hier: Im Erfolgsfall risse ein `router.refresh()` den
   * Fokus aus der Chip-Zeile, in der der Trainer gerade arbeitet.
   */
  function setzeFolge(fassungId: string, next: string[]) {
    setFolgen((prev) => ({ ...prev, [fassungId]: next }));
    const vorher = kette.current.get(fassungId) ?? Promise.resolve();
    // Die Kette darf nicht reissen: Ein geworfener Fehler — etwa ein
    // Netzabbruch — würde sonst jede spätere Änderung dieser Fassung
    // überspringen. Darum endet jeder Lauf gleich, ob abgelehnt oder geworfen.
    const lauf = vorher.then(async () => {
      let fehler: string | null = null;
      try {
        const r = await setzeGruppenfolge(fassungId, next);
        if (r.ok) return;
        fehler = r.error ?? "Speichern fehlgeschlagen.";
      } catch {
        fehler = "Speichern fehlgeschlagen.";
      }
      vergissFolge(fassungId);
      router.refresh();
      melde(fehler);
    });
    kette.current.set(fassungId, lauf);
    startTransition(async () => {
      await lauf;
    });
  }

  /** Eine Gruppe anlegen (#149 AK 1). Liefert die Meldung zurück, statt sie in
   *  die Snackbar zu schicken: sie gehört an das Feld, in das der Trainer
   *  gerade geschrieben hat. */
  async function anlegen(name: string): Antwort {
    const r = await legeGruppeAn(trainingId, name);
    if (!r.ok) return r.error;
    setGruppen((prev) => [...prev, r.gruppe]);
    return null;
  }

  /** Eine Gruppe umbenennen (#149 AK 2). Optimistisch, mit Rücknahme. */
  async function umbenennen(id: string, name: string): Antwort {
    const vorher = gruppen;
    setGruppen((prev) => prev.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)));
    const r = await benenneGruppe(id, name);
    if (!r.ok) {
      setGruppen(vorher);
      return r.error ?? "Umbenennen fehlgeschlagen.";
    }
    return null;
  }

  /**
   * Eine Gruppe entfernen (#149 AK 3, #150 PC 1). Die Rückfrage davor stellt
   * der Editor — hier wird sie nur noch ausgeführt.
   *
   * Die Datenbank räumt die Zuweisungen per Kaskade weg; die Anzeige muss
   * nachziehen, ohne aufzufrischen. Darum bekommt JEDE betroffene Fassung eine
   * Überlagerung ohne diese Gruppe — auch eine, die bisher keine hatte, und
   * auch eine aus einer Variante, die gerade nicht angezeigt wird (#201): Beim
   * Wechsel dorthin stünde die Gruppe sonst wieder da, obwohl sie weg ist.
   */
  function entferne(gruppe: { id: string; name: string }) {
    const vorherGruppen = gruppen;
    const vorherFolgen = folgen;
    setGruppen((prev) => prev.filter((g) => g.id !== gruppe.id));
    setFolgen((prev) => {
      const next = { ...prev };
      for (const f of alleFolgen) {
        if (!f.gruppen.includes(gruppe.id)) continue;
        next[f.id] = f.gruppen.filter((id) => id !== gruppe.id);
      }
      return next;
    });
    startTransition(async () => {
      const r = await entferneGruppe(gruppe.id);
      if (!r.ok) {
        setGruppen(vorherGruppen);
        setFolgen(vorherFolgen);
        melde(r.error ?? "Entfernen fehlgeschlagen.");
        return;
      }
      melde(`Gruppe „${gruppe.name}" entfernt.`);
    });
  }

  return {
    gruppen,
    folgeVon,
    befund,
    wechselGesamt,
    zeiten,
    zuweisungenVon,
    zuweisungenJeVariante,
    gruppenAn,
    vergissFolge,
    setzeFolge,
    anlegen,
    umbenennen,
    entferne,
  };
}
