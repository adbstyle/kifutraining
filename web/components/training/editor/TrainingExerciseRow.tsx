"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { TriangleAlert, ChevronUp, ChevronDown, X, Pencil, PackageSearch } from "lucide-react";
import { IconButton, IconButtonLink, KategorieChip, Tooltip } from "@/components/ui";
import { ExerciseThumb } from "../ExerciseThumb";
import { InBibliothekButton } from "../InBibliothekButton";
import { DauerFeld } from "./DauerFeld";
import { STUFE_ABWEICHEND_TEXT, stufenAbgedeckt } from "@/lib/training";
import { varianteAnhang } from "@/lib/varianten";
import { cn } from "@/lib/cn";
import { UebungsName } from "../UebungsName";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";
import { materialAenderungen, materialBasisAusDiagramm } from "@/lib/material";

/** Der Hinweis an der Zeile, wenn eine Diagrammänderung das Material dieser
 *  Übung verändert hat (Story #269). Beantwortet wird er im Bearbeiten. */
export const MATERIAL_GEAENDERT_TEXT =
  "Das Feld-Diagramm zeigt inzwischen anderes Material - beim Bearbeiten übernehmen oder beibehalten.";

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
  isFirst,
  isLast,
  trainingId,
  varianteId,
  trainingStufen,
  showDuration,
  dauerWarnung,
  etage,
  offen = false,
  onOeffnen,
  onBearbeiten,
  onDuration,
  onMove,
  onRemove,
}: {
  item: TrainingExerciseItem;
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
  /** Steht diese Übung in der Spalte offen (Epic #369)? */
  offen?: boolean;
  onOeffnen: () => void;
  onBearbeiten: () => void;
  onDuration: (next: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  // Ohne Kategorien gibt es nichts abzudecken (z. B. eine inhaltsleere Fassung
  // aus der Bestand-Überführung) — dieselbe Regel wie in setTrainingStufen,
  // sonst stünde ein Warndreieck, das keine Stufenwahl je entfernt.
  const mismatch =
    item.kategorien.length > 0 && !stufenAbgedeckt(trainingStufen, item.kategorien);
  const materialGeaendert =
    materialAenderungen(item.materialBasis, materialBasisAusDiagramm(item.diagramm)).length > 0;

  return (
    <li
      className={cn(
        // Breit hellt die ganze Zeile auf und öffnet die Übung (`UebungsName`);
        // was in ihr bedienbar ist, liegt mit `relative` über dieser Fläche.
        "relative flex flex-col rounded-flaeche border border-linie bg-elev-01 px-3 py-2.5 xl:state",
        offen && "xl:border-primary",
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hoch/Runter */}
        <span className="relative z-10 flex shrink-0 flex-col">
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

        <ExerciseThumb
          bildUrl={item.bildUrl}
          diagramm={item.diagramm}
          bildQuelle={item.bildQuelle}
          name={item.name}
          className="hidden sm:block"
        />

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <UebungsName name={item.name} offen={offen} onOeffnen={onOeffnen} />
            {mismatch && (
              <span title={STUFE_ABWEICHEND_TEXT} className="relative">
                <TriangleAlert size={15} className="shrink-0 text-primary" aria-hidden />
              </span>
            )}
            {materialGeaendert && (
              <>
                {/* Der Hinweis führt dorthin, wo er beantwortet wird: schmal in
                    die Maske, breit in die Spalte zum Bearbeiten (#373 AK 7). */}
                <Link
                  href={`/training/${trainingId}/uebung/${item.id}/edit${varianteAnhang(varianteId)}`}
                  title={MATERIAL_GEAENDERT_TEXT}
                  aria-label={MATERIAL_GEAENDERT_TEXT}
                  className="focus-ring inline-flex shrink-0 rounded-flaeche text-primary xl:hidden"
                >
                  <PackageSearch size={15} aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={onBearbeiten}
                  title={MATERIAL_GEAENDERT_TEXT}
                  aria-label={MATERIAL_GEAENDERT_TEXT}
                  className="focus-ring relative hidden shrink-0 rounded-flaeche text-primary xl:inline-flex"
                >
                  <PackageSearch size={15} aria-hidden />
                </button>
              </>
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
            Dauerfeld trägt seinen Namen über sich, in einer Reihe mit drei
            Icon-Knöpfen liesse es die Zeile auseinanderfallen. Rechtsbündig,
            damit die Felder aller Zeilen eine Kante bilden. */}
        <span className="relative flex shrink-0 flex-col items-end gap-2">
          <span className="flex items-center">
            <InBibliothekButton fassungId={item.id} name={item.name} className="xl:hidden" />

            {/* Schmal führt der Stift in die Bearbeitungsmaske. Breit steht er
                im Detail der geöffneten Übung, nicht an der Zeile (PO
                2026-10-05): Die Zeile öffnet die Übung, bearbeitet wird, was
                man vor sich hat — breit gibt es dafür nur diesen einen Ort
                (Epic #369 EK 5). Die Weiche ist CSS wie beim Namen. */}
            <Tooltip label="Übung bearbeiten" className="xl:hidden">
              <IconButtonLink
                icon={Pencil}
                // Die Variante fährt mit: Nach dem Speichern führt
                // `updateFassung` in genau diese zurück, und eine Fassung, die
                // von aussen in den Hauptteil wandert, landet in ihr statt in
                // der ersten (#201 AK 6).
                href={`/training/${trainingId}/uebung/${item.id}/edit${varianteAnhang(varianteId)}`}
                label={`${item.name} bearbeiten`}
              />
            </Tooltip>

            {/* Der einzige Knopf der Zeile, der etwas wegnimmt — er färbt sich
                beim Überfahren ein. Nicht dauerhaft rot: An jeder Zeile stünde
                sonst ein Alarm, und die Zeile hat nichts Alarmierendes. Die
                Zustands-Ebene nimmt die Farbe des Zeichens mit, der Overlay
                wird damit im selben Zug rötlich. Ein X und kein Papierkorb
                (PO 2026-10-05): Die Übung verlässt nur dieses Training, gelöscht
                wird nichts. */}
            <Tooltip label="Übung entfernen">
              <IconButton
                icon={X}
                label="Übung entfernen"
                onClick={onRemove}
                className="hover:text-error"
              />
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

      {etage && <div className="relative">{etage}</div>}
    </li>
  );
}
