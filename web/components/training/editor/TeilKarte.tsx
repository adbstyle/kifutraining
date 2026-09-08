"use client";

import { Plus, Info } from "lucide-react";
import { Card, IconButton, Tooltip } from "@/components/ui";
import { ZeitAbgleich } from "../ZeitAbgleich";
import { Unterblock } from "./Unterblock";
import type { ZeilenKontext } from "./ExerciseList";
import { formatDuration, type EditorBlock, type EditorTeil } from "@/lib/training";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

/** Eine Karte je Trainingsteil — dieselbe für beide Altersstufen, weil die
 *  Gliederung (`editorGliederung`) die Unterschiede bereits aufgelöst hat.
 *
 *  Kopf: Teil, Dauer-Summe und — nur im Juniorenschema — der Zeit-Abgleich.
 *  Darunter die Blöcke, jeder mit eigener Fläche, sobald es mehr als einen gibt.
 *  Fuss: die zählenden Meldungen der ganzen Karte.
 *
 *  Der Hinzufügen-Knopf hängt am Teil, solange dieser einen einzigen Block hat —
 *  es gibt darunter keine Ebene, an der er hängen könnte (Story #127). Sonst
 *  trägt ihn jeder Block selbst. */
export function TeilKarte({
  teil,
  kontext,
  onAdd,
}: {
  teil: EditorTeil<TrainingExerciseItem>;
  kontext: ZeilenKontext;
  onAdd: (block: EditorBlock<TrainingExerciseItem>) => void;
}) {
  const einblockig = teil.bloecke.length === 1;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="type-title-medium text-on-surface">{teil.label}</h2>
          {teil.sum > 0 && (
            <span className="type-label-medium text-on-surface-variant">
              {formatDuration(teil.sum)}
            </span>
          )}
          {/* Die Zeit-Orientierung gilt nur im Juniorenschema — das
              Kinderfussball-Manual gibt bewusst keine Zeiten vor (Story 6
              AC 5 / Out of Scope 1). */}
          {teil.richtwertSlug && (
            <ZeitAbgleich slug={teil.richtwertSlug} sum={teil.sum} />
          )}
        </div>
        {einblockig && (
          <Tooltip label="Übung hinzufügen">
            <IconButton
              icon={Plus}
              label={`Übung zu ${teil.label} hinzufügen`}
              size="sm"
              onClick={() => onAdd(teil.bloecke[0])}
            />
          </Tooltip>
        )}
      </div>

      {/* Alle Blöcke bleiben sichtbar, auch die leeren: Beim Planen ist gerade
          die Lücke die Information (Story 4 AC 1, Story 5a AC 1–3). */}
      <div className="mt-4 flex flex-col gap-4">
        {teil.bloecke.map((b) => (
          <Unterblock
            key={b.hkat ?? b.einordnung}
            block={b}
            kontext={kontext}
            onAdd={() => onAdd(b)}
          />
        ))}
      </div>

      {(teil.tooMany || teil.missing > 0) && (
        <div className="mt-3 flex flex-col gap-1">
          {teil.tooMany && (
            <p className="flex items-center gap-2 type-label-medium text-on-surface-variant">
              <Info size={15} className="shrink-0 text-signal" aria-hidden />
              Ungewöhnlich viele Übungen für diesen Trainingsteil — erlaubt, achte
              nur auf die Gesamtdauer.
            </p>
          )}
          {teil.missing > 0 && (
            <p className="type-label-medium text-on-surface-variant">
              {teil.missing} {teil.missing === 1 ? "Übung" : "Übungen"} ohne erfasste
              Dauer (zählt nicht zur Summe).
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
