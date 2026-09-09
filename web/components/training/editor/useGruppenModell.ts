"use client";

import { useMemo, useState, useTransition } from "react";
import {
  istHauptteil,
  konfliktBefund,
  wechselZahl,
  type Befund,
  type Verteilung,
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
  melde,
}: {
  trainingId: string;
  /** Die Gruppen, wie sie vom Server kamen (Anlegereihenfolge). */
  gruppenInitial: { id: string; name: string }[];
  /** Alle Zuordnungen des Trainings, Dauern bereits überlagert. Muss stabil
   *  sein (memoisiert) — an ihr hängt die Konflikt-Rechnung. */
  zuordnungen: TrainingExerciseItem[];
  /** Was in die Snackbar geht: abgelehnte Aktionen, quittierte Entfernungen. */
  melde: (text: string) => void;
}) {
  const [gruppen, setGruppen] = useState(gruppenInitial);
  // Die lokal gesetzten Folgen je Fassung. Fehlt ein Eintrag, gilt der
  // Serverstand der Fassung — darum ein `Record` und keine Vollkopie.
  const [folgen, setFolgen] = useState<Record<string, string[]>>({});
  const [, startTransition] = useTransition();

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

  /** An wie vielen Übungen des Hauptteils steht diese Gruppe? Grundlage der
   *  Rückfrage vor dem Entfernen (AK 8). */
  const zuweisungenVon = (gruppeId: string): number =>
    verteilung.filter((f) => f.gruppen.includes(gruppeId)).length;

  /** Wie viele Gruppen trägt diese Übung? Grundlage der Rückfrage vor dem
   *  Entfernen der Übung (AK 16). */
  const gruppenAn = (fassungId: string): number =>
    verteilung.find((f) => f.id === fassungId)?.gruppen.length ?? 0;

  /** Den lokalen Stand einer Fassung vergessen — nach einer Aktion, die die
   *  Serverdaten auffrischt. Ab dann gilt wieder, was der Server sagt. */
  const vergissFolge = (fassungId: string) =>
    setFolgen((prev) => {
      if (!(fassungId in prev)) return prev;
      const rest = { ...prev };
      delete rest[fassungId];
      return rest;
    });

  /** Alle lokalen Stände vergessen — nach einem Auffrischen, das jede Zeile
   *  betreffen kann (eine neu hinzugefügte Übung verschiebt die Positionen). */
  const alleVergessen = () => setFolgen({});

  /**
   * Die Folge einer Übung setzen (AK 1/2/3) — Zuweisen, Umsortieren und
   * Entfernen sind dieselbe Aktion.
   *
   * Wird sie abgelehnt, fällt die Zeile auf den Serverstand zurück: Ihn kennt
   * die Fassung selbst, und er ist der einzige Stand, von dem sicher ist, dass
   * er in der Datenbank steht.
   */
  function setzeFolge(fassungId: string, next: string[]) {
    setFolgen((prev) => ({ ...prev, [fassungId]: next }));
    startTransition(async () => {
      const r = await setzeGruppenfolge(fassungId, next);
      if (r.ok) return;
      vergissFolge(fassungId);
      melde(r.error ?? "Speichern fehlgeschlagen.");
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
   * Überlagerung ohne diese Gruppe — auch eine, die bisher keine hatte.
   */
  function entferne(gruppe: { id: string; name: string }) {
    const vorherGruppen = gruppen;
    const vorherFolgen = folgen;
    setGruppen((prev) => prev.filter((g) => g.id !== gruppe.id));
    setFolgen((prev) => {
      const next = { ...prev };
      for (const f of verteilung) {
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
    zuweisungenVon,
    gruppenAn,
    vergissFolge,
    alleVergessen,
    setzeFolge,
    anlegen,
    umbenennen,
    entferne,
  };
}
