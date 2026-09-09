"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { TrainingExerciseRow } from "./TrainingExerciseRow";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/** Was jede Übungszeile ausser ihrer eigenen Zuordnung braucht. Als ein Bündel,
 *  damit es unverändert durch Karte und Block bis zur Zeile durchreicht. */
export type ZeilenKontext = {
  trainingId: string;
  /** Alterskategorien des Trainings — Grundlage des Stufen-Abgleichs der Zeile. */
  trainingStufen: string[];
  /** Das zweite Geschoss einer Zeile (der Durchlauf, Story #150); `null`, wo
   *  es nichts zu zeigen gibt. Wird nur in Blöcken abgerufen, die Gruppen
   *  tragen — `showGruppen` an der Liste. */
  etage: (item: TrainingExerciseItem) => ReactNode;
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
   *  wird es (`EditorBlock.traegtGruppen`). */
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
      <p className="flex items-start gap-2 type-body-small text-on-surface-variant">
        <Info size={15} className="mt-0.5 shrink-0 text-signal" aria-hidden />
        {leerHinweis}
      </p>
    ) : (
      <p className="type-body-small text-on-surface-variant">
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
          trainingStufen={kontext.trainingStufen}
          showDuration={showDuration}
          dauerWarnung={kontext.dauerWarnung(item)}
          etage={showGruppen ? kontext.etage(item) : null}
          onDuration={(next) => kontext.onDuration(item, next)}
          onMove={(d) => kontext.onMove(item, d)}
          onRemove={() => kontext.onRemove(item)}
        />
      ))}
    </ol>
  );
}
