"use client";

import { useEffect, useState } from "react";
import { AuswahlListe, Button, Dialog, SectionMessage } from "@/components/ui";
import { zaehle } from "@/lib/labels";
import type { TeamTrainingRow, TrainingListRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einem Termin ein Training wählen (Team-Kalender #323 AK 5, 6; #328 AK 5).
   Zur Wahl stehen der Bestand des Teams und darunter, getrennt durch eine
   Überschrift, die eigenen persönlichen Trainings. Was immer gewählt wird:
   Der Termin bekommt still eine eigene Kopie, ein Termin-Training, und die
   Quelle bleibt unberührt — es gibt nichts zu fragen (PO 2026-10-06).

   Trägt der Termin schon ein Training, sagt der Dialog, was mit ihm
   geschieht: Ein Termin-Training wird ersetzt und gelöscht, ein älteres aus
   dem Bestand bleibt dort. */
export type TrainingWahl = {
  trainingId: string;
};

export function TrainingWahlDialog({
  termin,
  trainings,
  persoenliche,
  pending,
  fehler,
  onClose,
  onWahl,
}: {
  termin: TerminZeile | null;
  /** Der Bestand des Teams (ohne Termin-Trainings). */
  trainings: TeamTrainingRow[];
  /** Die eigenen persönlichen Trainings des USERS, Entwürfe und öffentliche. */
  persoenliche: TrainingListRow[];
  pending?: boolean;
  /** Die Meldung des Servers; der Dialog bleibt dann offen. */
  fehler?: string;
  onClose: () => void;
  onWahl: (w: TrainingWahl) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  useEffect(() => setGewaehlt(null), [termin]);
  const bisher = termin?.training ?? null;

  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title={bisher ? "Training ersetzen" : "Training zuordnen"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={!gewaehlt || pending} onClick={() => gewaehlt && onWahl({ trainingId: gewaehlt })}>
            Zuordnen
          </Button>
        </>
      }
    >
      {fehler && <SectionMessage appearance="error" className="mb-4">{fehler}</SectionMessage>}
      {bisher && (
        <p className="mb-3">
          {bisher.terminTraining ? (
            <>«{bisher.name}» wird dabei gelöscht — es gehört nur zu diesem Termin.</>
          ) : (
            <>«{bisher.name}» bleibt im Team-Bestand.</>
          )}
        </p>
      )}
      <h3 className="type-title-small mb-2 text-on-surface">Aus dem Team-Bestand</h3>
      {trainings.length === 0 ? (
        <p>Im Team-Bestand gibt es noch kein Training.</p>
      ) : (
        <AuswahlListe
          ariaLabel="Trainings des Teams"
          items={trainings.map((t) => ({ id: t.id, titel: t.name, untertitel: zaehle(t.exerciseCount, "Übung", "Übungen") }))}
          wert={gewaehlt}
          onWahl={setGewaehlt}
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
          onWahl={setGewaehlt}
        />
      )}
    </Dialog>
  );
}
