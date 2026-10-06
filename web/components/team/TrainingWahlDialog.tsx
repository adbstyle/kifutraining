"use client";

import { useEffect, useMemo, useState } from "react";
import { AuswahlListe, Button, ChoiceChip, ChoiceChipGroup, Dialog, SectionMessage } from "@/components/ui";
import { zaehle } from "@/lib/labels";
import { PERSOENLICH_KOPIE_HINWEIS } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow, TrainingListRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einem Termin ein Training wählen (Team-Kalender #323 AK 5, 6, 10, 11).
   Noch nicht eingeplante Trainings stehen zuerst; bei eingeplanten steht,
   für welchen Termin. Gehört das gewählte schon einem ANSTEHENDEN Termin,
   muss zwischen Kopie und Verschieben gewählt werden; bei einem vergangenen
   entsteht immer eine Kopie.

   Darunter stehen die eigenen persönlichen Trainings (#328 AK 5), getrennt
   durch eine Überschrift. Ein persönliches Training hat keinen Termin und
   kommt immer als Kopie ins Team: Die Wahl Kopie/Verschieben entfällt, und
   ein Hinweis sagt, was geschieht (AK 6). */
export type TrainingWahl = {
  trainingId: string;
  /** Woher das Training stammt: aus dem Bestand des Teams oder aus «Meine Trainings». */
  quelle: "team" | "persoenlich";
  art?: "kopie" | "verschieben";
  trainingTermin: string | null;
};

export function TrainingWahlDialog({
  termin,
  trainings,
  persoenliche,
  heute,
  pending,
  fehler,
  onClose,
  onWahl,
}: {
  termin: TerminZeile | null;
  trainings: TeamTrainingRow[];
  /** Die eigenen persönlichen Trainings des USERS, Entwürfe und öffentliche. */
  persoenliche: TrainingListRow[];
  heute: string;
  pending?: boolean;
  /** Die Meldung des Servers; der Dialog bleibt dann offen. */
  fehler?: string;
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
  // Die Kennungen beider Listen sind verschieden (ein Training gehört dem Team
  // ODER einer Person); die Quelle ergibt sich daraus, in welcher Liste es steht.
  const teamWahl = liste.find((t) => t.id === gewaehlt) ?? null;
  const eigeneWahl = persoenliche.find((t) => t.id === gewaehlt) ?? null;
  const anstehend = teamWahl?.termin ? teamWahl.termin.datum >= heute : false;
  const bereit = (teamWahl !== null && (!anstehend || art !== null)) || eigeneWahl !== null;

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
            onClick={() => {
              if (eigeneWahl)
                return onWahl({ trainingId: eigeneWahl.id, quelle: "persoenlich", art: "kopie", trainingTermin: null });
              if (teamWahl)
                onWahl({
                  trainingId: teamWahl.id,
                  quelle: "team",
                  art: teamWahl.termin ? (anstehend ? art! : "kopie") : undefined,
                  trainingTermin: teamWahl.termin?.id ?? null,
                });
            }}
          >
            Zuordnen
          </Button>
        </>
      }
    >
      {fehler && <SectionMessage appearance="error" className="mb-4">{fehler}</SectionMessage>}
      {termin?.training && (
        <p className="mb-3">
          «{termin.training.name}» bleibt ohne Termin im Team-Bestand.
        </p>
      )}
      <h3 className="type-title-small mb-2 text-on-surface">Aus dem Team-Bestand</h3>
      {liste.length === 0 ? (
        <p>Im Team-Bestand gibt es noch kein weiteres Training.</p>
      ) : (
        <AuswahlListe
          ariaLabel="Trainings des Teams"
          items={liste.map((t) => ({
            id: t.id,
            titel: t.name,
            untertitel: t.termin ? `Eingeplant · ${datumKurz(t.termin.datum)}` : "Noch nicht eingeplant",
          }))}
          wert={gewaehlt}
          onWahl={(id) => { setGewaehlt(id); setArt(null); }}
        />
      )}
      <h3 className="type-title-small mb-2 mt-6 text-on-surface">Meine Trainings</h3>
      {persoenliche.length === 0 ? (
        <p>Du hast noch kein persönliches Training.</p>
      ) : (
        <AuswahlListe
          ariaLabel="Meine Trainings"
          items={persoenliche.map((t) => ({
            id: t.id,
            titel: t.name,
            untertitel: `${t.visibility === "public" ? "Öffentlich" : "Entwurf"} · ${zaehle(t.exerciseCount, "Übung", "Übungen")}`,
          }))}
          wert={gewaehlt}
          onWahl={(id) => { setGewaehlt(id); setArt(null); }}
        />
      )}
      {teamWahl?.termin && anstehend && (
        <div className="mt-4">
          <p className="mb-2">
            «{teamWahl.name}» ist schon für {datumKurz(teamWahl.termin.datum)} eingeplant.
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
      {teamWahl?.termin && !anstehend && (
        <p className="mt-4">
          «{teamWahl.name}» gehört zum vergangenen Termin {datumKurz(teamWahl.termin.datum)}. Für diesen
          Termin entsteht eine eigenständige Kopie.
        </p>
      )}
      {eigeneWahl && <p className="mt-4">{PERSOENLICH_KOPIE_HINWEIS}</p>}
    </Dialog>
  );
}
