"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { TrainingExerciseRow } from "./TrainingExerciseRow";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/** Was jede Übungszeile ausser ihrer eigenen Zuordnung braucht. Als ein Bündel,
 *  damit es unverändert durch Karte und Block bis zur Zeile durchreicht. */
export type ZeilenKontext = {
  trainingId: string;
  /** Die angezeigte Variante des Hauptteils — nur gesetzt, wenn es überhaupt
   *  etwas zu wählen gibt (#201 AK 6). Sie hängt an den Links auf die
   *  Fassungs-Seiten, damit der Rückweg von dort in derselben Variante landet;
   *  bei genau einer Variante bleibt die Adresse unverändert. */
  varianteId?: string;
  /** Alterskategorien des Trainings — Grundlage des Stufen-Abgleichs der Zeile. */
  trainingStufen: string[];
  /** Das zweite Geschoss einer Zeile (Durchlauf und Notiz, Stories #150/#152).
   *  Steht an JEDER Zeile — die Notiz gilt überall. `traegtGruppen` sagt bloss,
   *  ob die Etage auch den Durchlauf zeigt: Er ist dem Hauptteil vorbehalten. */
  etage: (item: TrainingExerciseItem, traegtGruppen: boolean) => ReactNode;
  /** Steht die Dauer dieser Übung in einem ungleich langen Wechsel? (Story #151) */
  dauerWarnung: (item: TrainingExerciseItem) => boolean;
  onDuration: (item: TrainingExerciseItem, next: number | null) => void;
  onMove: (item: TrainingExerciseItem, dir: -1 | 1) => void;
  onRemove: (item: TrainingExerciseItem) => void;
};

/** Geordnete Übungsliste eines Blocks: leerer Zustand oder die Zuordnungen als
 *  umsortierbare Zeilen. Wird von jedem Block beider Altersstufen gleichermassen
 *  genutzt — darum stellen beide ihre leeren Abschnitte zwangsläufig gleich dar
 *  (Story #126 NFR 3). */
export function ExerciseList({
  items,
  showDuration,
  showGruppen,
  leerHinweis,
  kontext,
}: {
  items: TrainingExerciseItem[];
  showDuration: boolean;
  /** Werden die Übungen dieses Blocks auf Gruppen verteilt? Nur der Hauptteil
   *  wird es (`EditorBlock.traegtGruppen`). Entscheidet allein über den
   *  Durchlauf in der Etage, nicht über die Etage selbst. */
  showGruppen: boolean;
  /** Was zu melden ist, wenn dieser Abschnitt leer bleibt und das Lehrmittel
   *  ihn als gesetzt ansieht (`LEER_HINWEIS`). Gesetzt, ersetzt die Meldung die
   *  neutrale Zeile — nie beides, sonst stünde dieselbe Sachlage doppelt da. */
  leerHinweis?: string;
  kontext: ZeilenKontext;
}) {
  if (items.length === 0)
    // Derselbe Schriftschnitt wie die neutrale Zeile: Es ist dieselbe Aussage,
    // bloss begründet. Das Icon trägt das Signal — ohne Farbwahrnehmung bleibt
    // der Hinweis vom neutralen Leerzustand unterscheidbar (NFR 4).
    return leerHinweis ? (
      <p className="flex items-start gap-2 type-body-small text-on-surface-mittel">
        <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        {leerHinweis}
      </p>
    ) : (
      <p className="type-body-small text-on-surface-mittel">
        Noch keine Übung zugeordnet.
      </p>
    );
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <TrainingExerciseRow
          key={item.id}
          item={item}
          index={i}
          isFirst={i === 0}
          isLast={i === items.length - 1}
          trainingId={kontext.trainingId}
          varianteId={kontext.varianteId}
          trainingStufen={kontext.trainingStufen}
          showDuration={showDuration}
          dauerWarnung={kontext.dauerWarnung(item)}
          etage={kontext.etage(item, showGruppen)}
          onDuration={(next) => kontext.onDuration(item, next)}
          onMove={(d) => kontext.onMove(item, d)}
          onRemove={() => kontext.onRemove(item)}
        />
      ))}
    </ol>
  );
}
