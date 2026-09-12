"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { TriangleAlert, ChevronUp, ChevronDown, Trash2, Pencil } from "lucide-react";
import { KategorieChip, Tooltip } from "@/components/ui";
import { ExerciseThumb } from "../ExerciseThumb";
import { InBibliothekButton } from "../InBibliothekButton";
import { DauerFeld } from "./DauerFeld";
import { stufenAbgedeckt } from "@/lib/training";
import { varianteAnhang } from "@/lib/varianten";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/** Eine Zuordnung im Editor: Reihenfolge, Bild, Name, Stufen, Dauer und die
 *  Aktionen an ihr.
 *
 *  Die Zeile ist in Geschosse gebaut, nicht als eine lange Reihe: Die Kopfzeile
 *  trägt alles, was jede Zuordnung hat, darunter das zweite Geschoss — die
 *  Etage mit Notiz und, im Hauptteil, dem Durchlauf (Stories #150/#152).
 *  Getrennt sind die beiden durch Abstand und nicht durch eine Haarlinie: Es
 *  ist eine Zeile, kein Kasten mit zwei Fächern.
 *
 *  Die Zeile bleibt auf der Stufe der Karte (`elev-01`) — sie ist deren
 *  Inhalt und nicht etwas, das darüber schwebt. Getrennt wird sie darum von
 *  der Haarlinie: Auf der Karte trüge eine höhere Fläche die Zeile optisch
 *  hinaus, und im Block (`elev-02`) liest sie sich als das, was IM Block
 *  liegt. Eine Stufe, die überall gleich aussieht, statt zweier, die je nach
 *  Ort kippen. */
export function TrainingExerciseRow({
  item,
  index,
  isFirst,
  isLast,
  trainingId,
  varianteId,
  trainingStufen,
  showDuration,
  dauerWarnung,
  etage,
  onDuration,
  onMove,
  onRemove,
}: {
  item: TrainingExerciseItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  trainingId: string;
  /** Die angezeigte Variante des Hauptteils (#201), sonst `undefined`. */
  varianteId?: string;
  trainingStufen: string[];
  showDuration: boolean;
  /** Steht die Dauer dieser Übung in einem ungleich langen Wechsel? Färbt den
   *  Rahmen des Dauerfelds rot (Story #150 `dauerWarnung`) — ein Befund, keine
   *  Fehleingabe: Er trägt dieselbe Farbe, bleibt aber speicherbar. */
  dauerWarnung?: boolean;
  /** Das zweite Geschoss der Zeile (`UebungsEtage`). */
  etage?: ReactNode;
  onDuration: (next: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  // Ohne Kategorien gibt es nichts abzudecken (z. B. eine inhaltsleere Fassung
  // aus der Bestand-Überführung) — dieselbe Regel wie in setTrainingStufen,
  // sonst stünde ein Warndreieck, das keine Stufenwahl je entfernt.
  const mismatch =
    item.kategorien.length > 0 && !stufenAbgedeckt(trainingStufen, item.kategorien);

  return (
    <li className="flex flex-col rounded-flaeche border border-linie bg-elev-01 px-3 py-2.5 [--feld-grund:var(--color-elev-01)]">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hoch/Runter */}
        <span className="flex shrink-0 flex-col">
          <button
            type="button"
            aria-label="Nach oben"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="state focus-ring inline-flex h-5 w-6 items-center justify-center rounded-flaeche text-on-surface-mittel disabled:opacity-30"
          >
            <ChevronUp size={16} strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Nach unten"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="state focus-ring inline-flex h-5 w-6 items-center justify-center rounded-flaeche text-on-surface-mittel disabled:opacity-30"
          >
            <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </span>

        <span className="w-4 shrink-0 text-center type-label-medium text-on-surface-mittel">
          {index + 1}
        </span>

        <ExerciseThumb
          bildUrl={item.bildUrl}
          diagramm={item.diagramm}
          bildQuelle={item.bildQuelle}
          name={item.name}
          className="hidden sm:block"
        />

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate type-body-medium text-on-surface">{item.name}</span>
            {mismatch && (
              <span title="Deckt keine der Trainings-Stufen ab">
                <TriangleAlert size={15} className="shrink-0 text-primary" aria-hidden />
              </span>
            )}
          </span>
          {item.kategorien.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {item.kategorien.map((k) => (
                <KategorieChip key={k} k={k as never} />
              ))}
            </span>
          )}
        </span>

        {/* Aktionen und Dauer stehen übereinander, nicht nebeneinander: Das
            Dauerfeld ist ein 48px hohes Feld, in einer Reihe mit drei runden
            Knöpfen liesse es die Zeile auseinanderfallen. Rechtsbündig, damit
            die Felder aller Zeilen eine Kante bilden. */}
        <span className="flex shrink-0 flex-col items-end gap-2">
          <span className="flex items-center">
            <InBibliothekButton fassungId={item.id} name={item.name} />

            <Tooltip label="Übung bearbeiten">
              <Link
                // Die Variante fährt mit: Nach dem Speichern führt
                // `updateFassung` in genau diese zurück, und eine Fassung, die
                // von aussen in den Hauptteil wandert, landet in ihr statt in
                // der ersten (#201 AK 6).
                href={`/training/${trainingId}/uebung/${item.id}/edit${varianteAnhang(varianteId)}`}
                aria-label={`${item.name} bearbeiten`}
                className="state focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-mittel"
              >
                <Pencil size={16} strokeWidth={2.5} aria-hidden />
              </Link>
            </Tooltip>

            {/* Der einzige Knopf der Zeile, der etwas wegnimmt — er färbt sich
                beim Überfahren ein. Nicht dauerhaft rot: An jeder Zeile stünde
                sonst ein Alarm, und die Zeile hat nichts Alarmierendes. Die
                Zustands-Ebene nimmt die Farbe des Zeichens mit, der Overlay
                wird damit im selben Zug rötlich. */}
            <Tooltip label="Übung entfernen">
              <button
                type="button"
                aria-label="Übung entfernen"
                onClick={onRemove}
                className="state focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-mittel transition-colors hover:text-error"
              >
                <Trash2 size={16} strokeWidth={2.5} aria-hidden />
              </button>
            </Tooltip>
          </span>

          {showDuration && (
            <DauerFeld
              value={item.durationMin}
              warnung={dauerWarnung}
              onChange={onDuration}
            />
          )}
        </span>
      </div>

      {etage}
    </li>
  );
}
