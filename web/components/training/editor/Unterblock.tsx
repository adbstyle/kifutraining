"use client";

import { Plus } from "lucide-react";
import { IconButton, Tooltip } from "@/components/ui";
import { ZeitAbgleich } from "../ZeitAbgleich";
import { ExerciseList, type ZeilenKontext } from "./ExerciseList";
import { formatDuration, type EditorBlock } from "@/lib/training";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/** Ein Block innerhalb einer Trainingsteil-Karte: Überschrift, Dauer, Richtwert,
 *  Hinzufügen-Knopf und die Übungsliste.
 *
 *  Trägt sein Teil mehr als einen Block, steht er auf einer eigenen Fläche —
 *  eine Stufe die Rasen-Leiter hoch (`surface-container`), während die
 *  Übungszeilen auf `surface-container-low` bleiben und sich dadurch als Inhalt
 *  IM Block lesen. Die Fläche ist der Grund dieser Story: In einer dichten
 *  Karte war ohne sie nicht zu sehen, wo eine Unterkategorie aufhört und die
 *  nächste beginnt, und ein leerer Block ging ganz unter (#174).
 *
 *  Ein einblockiger Teil bekommt keine Fläche: Er ist keine Verschachtelung —
 *  Rahmen und Überschrift wiederholten bloss die Karte (Story #127). */
export function Unterblock({
  block,
  kontext,
  onAdd,
}: {
  block: EditorBlock<TrainingExerciseItem>;
  kontext: ZeilenKontext;
  onAdd: () => void;
}) {
  const liste = (
    <ExerciseList
      items={block.items}
      showDuration={block.traegtDauer}
      showGruppen={block.traegtGruppen}
      leerHinweis={block.leerHinweis}
      kontext={kontext}
    />
  );

  if (!block.flaeche) return liste;

  return (
    <div className="rounded-[4px] border border-outline-variant bg-surface-container p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="type-title-small text-on-surface">
          {block.label}
          {block.sum > 0 && (
            <span className="ml-2 type-label-medium text-on-surface-variant">
              {formatDuration(block.sum)}
            </span>
          )}
          {block.richtwertSlug && (
            <span className="ml-2">
              <ZeitAbgleich slug={block.richtwertSlug} sum={block.sum} />
            </span>
          )}
        </h3>
        <Tooltip label="Übung hinzufügen">
          <IconButton
            icon={Plus}
            label={`Übung zu ${block.label} hinzufügen`}
            size="sm"
            onClick={onAdd}
          />
        </Tooltip>
      </div>
      {/* Ist der Block leer und sieht ihn das Lehrmittel als gesetzt an, tritt
          der Hinweis an die Stelle der neutralen Zeile — eine Meldung, im Block
          selbst (Story 5a AC 8/9, Story #126). */}
      {liste}
    </div>
  );
}
