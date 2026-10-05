"use client";

import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { updateFassungInSpalte } from "@/lib/actions/fassung";
import type { Altersstufe } from "@/lib/altersstufe";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/**
 * Eine Übung des Trainings in der Spalte bearbeiten (Epic #369, Story #372) —
 * dieselbe Maske wie auf der eigenen Bearbeitungsseite, mit denselben Feldern
 * und Regeln, aber in der Reihenfolge des Detail und ohne Weiterleitung.
 *
 * Die Angaben kommen aus der Übung, wie das Training sie bereits geladen hat;
 * eine eigene Abfrage braucht es nicht. Was nach dem Sichern, Verwerfen und
 * Schliessen geschieht, entscheidet der Aufrufer.
 *
 * `variante`: die angezeigte Variante des Hauptteils. Wandert die Übung von
 * ausserhalb in den Hauptteil, landet sie in ihr — dort, wo der Trainer sie
 * gleich wieder sieht.
 */
export function FassungInSpalte({
  item,
  altersstufe,
  variante,
  onUngesichert,
  onGesichert,
  onVerwerfen,
  onSchliessen,
}: {
  item: TrainingExerciseItem;
  altersstufe: Altersstufe;
  variante: string | undefined;
  onUngesichert: (ungesichert: boolean) => void;
  onGesichert: () => void;
  onVerwerfen: () => void;
  onSchliessen: () => void;
}) {
  return (
    <ExerciseForm
      action={updateFassungInSpalte.bind(null, item.id, variante)}
      diagramm={item.diagramm}
      altersstufe={altersstufe}
      stufenWahl="fest"
      kontext="fassung"
      materialBasis={item.materialBasis}
      initial={{
        name: item.name,
        trainingsteil: item.trainingsteil,
        kategorien: item.kategorien,
        feldtyp: item.feldtyp,
        spielfeld_laenge_m: item.spielfeldLaengeM,
        spielfeld_breite_m: item.spielfeldBreiteM,
        erscheinungsform: item.erscheinungsform,
        hauptteilkategorie: item.hauptteilkategorie,
        uebungstyp: item.uebungstyp,
        anzahl_kinder: item.anzahlKinder,
        material: item.material,
        materialListe: item.materialListe,
        methodischer_fahrplan: item.fahrplan,
        aufbau: item.aufbau,
        varianten: item.uebungsvarianten,
        bildUrl: item.bildUrl,
      }}
      submitLabel="Sichern"
      bildEntfernenMoeglich
      fussnote="Änderungen gelten nur für dieses Training."
      spalte={{ onUngesichert, onGesichert, onVerwerfen, onSchliessen }}
    />
  );
}
