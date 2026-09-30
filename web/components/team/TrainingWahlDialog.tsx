"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ChoiceChip, ChoiceChipGroup, Dialog } from "@/components/ui";
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einem Termin ein Training wählen (Team-Kalender #323 AK 5, 6, 10, 11).
   Noch nicht eingeplante Trainings stehen zuerst; bei eingeplanten steht,
   für welchen Termin. Gehört das gewählte schon einem ANSTEHENDEN Termin,
   muss zwischen Kopie und Verschieben gewählt werden; bei einem vergangenen
   entsteht immer eine Kopie. */
export type TrainingWahl = { trainingId: string; art?: "kopie" | "verschieben"; trainingTermin: string | null };

export function TrainingWahlDialog({
  termin,
  trainings,
  heute,
  pending,
  onClose,
  onWahl,
}: {
  termin: TerminZeile | null;
  trainings: TeamTrainingRow[];
  heute: string;
  pending?: boolean;
  onClose: () => void;
  onWahl: (w: TrainingWahl) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [art, setArt] = useState<"kopie" | "verschieben" | null>(null);
  useEffect(() => { setGewaehlt(null); setArt(null); }, [termin]);

  const liste = useMemo(
    () =>
      trainings
        .filter((t) => t.id !== termin?.training?.id)
        // Stabil: innerhalb der Gruppen bleibt die Reihenfolge des Bestands.
        .sort((a, b) => Number(a.termin !== null) - Number(b.termin !== null)),
    [trainings, termin],
  );
  const wahl = liste.find((t) => t.id === gewaehlt) ?? null;
  const anstehend = wahl?.termin ? wahl.termin.datum >= heute : false;
  const bereit = wahl !== null && (!anstehend || art !== null);

  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title={termin?.training ? "Training ersetzen" : "Training zuordnen"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="filled"
            disabled={!bereit || pending}
            onClick={() =>
              wahl && onWahl({
                trainingId: wahl.id,
                art: wahl.termin ? (anstehend ? art! : "kopie") : undefined,
                trainingTermin: wahl.termin?.id ?? null,
              })
            }
          >
            Zuordnen
          </Button>
        </>
      }
    >
      {termin?.training && (
        <p className="mb-3">
          «{termin.training.name}» bleibt ohne Termin im Team-Bestand.
        </p>
      )}
      {liste.length === 0 ? (
        <p>Im Team-Bestand gibt es noch kein weiteres Training.</p>
      ) : (
        <ul role="listbox" aria-label="Trainings des Teams" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {liste.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={t.id === gewaehlt}
                onClick={() => { setGewaehlt(t.id); setArt(null); }}
                className={`focus-ring w-full rounded-flaeche px-3 py-2 text-left ${t.id === gewaehlt ? "bg-elev-08" : "hover:bg-elev-04"}`}
              >
                <span className="block text-on-surface">{t.name}</span>
                <span className="type-body-small text-on-surface-mittel">
                  {t.termin ? `Eingeplant · ${datumKurz(t.termin.datum)}` : "Noch nicht eingeplant"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {wahl?.termin && anstehend && (
        <div className="mt-4">
          <p className="mb-2">
            «{wahl.name}» ist schon für {datumKurz(wahl.termin.datum)} eingeplant.
          </p>
          <ChoiceChipGroup ariaLabel="Kopieren oder verschieben">
            <ChoiceChip tabStop selected={art === "kopie"} onSelect={() => setArt("kopie")} look="nutzertext">
              Kopie für diesen Termin
            </ChoiceChip>
            <ChoiceChip selected={art === "verschieben"} onSelect={() => setArt("verschieben")} look="nutzertext">
              Auf diesen Termin verschieben
            </ChoiceChip>
          </ChoiceChipGroup>
        </div>
      )}
      {wahl?.termin && !anstehend && (
        <p className="mt-4">
          «{wahl.name}» gehört zum vergangenen Termin {datumKurz(wahl.termin.datum)}. Für diesen
          Termin entsteht eine eigenständige Kopie.
        </p>
      )}
    </Dialog>
  );
}
