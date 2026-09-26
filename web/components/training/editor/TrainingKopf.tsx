"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Card, Badge, HeadlineField, TextArea } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { StufenField } from "../StufenField";
import { useBlurSpeichern } from "./useBlurSpeichern";
import { kategorienFuer } from "@/lib/altersstufe";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { TRAINING_NAME_MAX, ZIEL_MAX, trainingNameProblem } from "@/lib/training";
import type { TrainingDetail } from "@/lib/queries/trainings";

/** Kopf des Editors: Name, Zugehörigkeit, Ziel und Alterskategorien.
 *
 *  Der Name ist hier das Feld und nicht mehr eine Überschrift mit einem Stift
 *  daneben (#250): geändert wird er dort, wo er steht. Die Aktionen AM
 *  Training stehen bewusst nicht in dieser Karte, sondern eine Zeile höher
 *  neben den Brotkrumen (#249 AK 8) — sie betreffen das Training als Ganzes
 *  und nicht seine Angaben. */
export function TrainingKopf({
  training,
  oeffentlich,
  stufen,
  onStufen,
  ziel,
  onZielChange,
  onZielSpeichern,
  name,
  onNameSpeichern,
}: {
  training: TrainingDetail;
  oeffentlich: boolean;
  stufen: string[];
  onStufen: (next: string[]) => void;
  ziel: string;
  onZielChange: (next: string) => void;
  onZielSpeichern: () => void;
  /** Der laufende Name — im Editor optimistisch überlagert. */
  name: string;
  onNameSpeichern: (next: string) => void;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <NameFeld name={name} onSpeichern={onNameSpeichern} />
      {/* Team-Training oder persönliches? Die Marke sagt, wem es gehört — und
          bei persönlichen zusätzlich, ob es öffentlich ist. Daneben, in
          derselben Zeile, welchem Lehrmittel es folgt (Story 5 AK 3): beide
          Schemata teilen Begriffe wie „Hauptteil", der Trainer muss jederzeit
          sehen, in welchem er plant. Neutral statt in einer Kategorie-Farbe —
          die Altersstufe ist keine Alterskategorie. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {training.team ? (
          <Link
            href={`/team/${training.team.id}`}
            className="focus-ring inline-flex items-center gap-1.5 rounded-flaeche type-label-medium text-on-surface-mittel hover:text-primary"
          >
            <Users size={16} strokeWidth={2} aria-hidden />
            Team-Training von {training.team.name}
          </Link>
        ) : (
          <Badge tone={oeffentlich ? "oeffentlich" : "entwurf"}>
            {oeffentlich ? "Öffentlich" : "✎ Entwurf"}
          </Badge>
        )}
        <Badge tone="neutral">{altersstufeLabels[training.altersstufe]}</Badge>
      </div>

      {/* Ziel: optional, jederzeit änder- und entfernbar (Story 10 AC 3).
          Gespeichert wird beim Verlassen des Felds — wie der Trainingsname
          direkt darüber. */}
      <div className="mt-4">
        <TextArea
          label="Ziel (optional)"
          rows={2}
          maxLength={ZIEL_MAX}
          value={ziel}
          onChange={(e) => onZielChange(e.target.value)}
          onBlur={onZielSpeichern}
          supportingText={`Woran das Team in diesem Training arbeitet. Höchstens ${ZIEL_MAX} Zeichen.`}
        />
      </div>

      {/* Nur die Kategorien der Altersstufe dieses Trainings: Sie folgen ihr,
          statt sie zu bestimmen (Story 5 AK 4). Ein Wechsel der Altersstufe
          ist bewusst nirgends vorgesehen (AK 5) — wer für die andere plant,
          legt ein neues Training an. */}
      <div className="mt-4">
        <StufenField
          value={stufen}
          onChange={onStufen}
          kategorien={kategorienFuer(training.altersstufe)}
          supportingText="Für welche Alterskategorien dieses Training gedacht ist."
        />
      </div>
    </Card>
  );
}

/**
 * Das Namensfeld im Kopf (#250).
 *
 * Gespeichert wird beim Verlassen des Felds — ohne Eingabetaste und ohne
 * Bestätigung (Entscheid 2). Eine leere oder nur aus Leerzeichen bestehende
 * Eingabe fällt auf den zuletzt gespeicherten Namen zurück und meldet sich am
 * Bildschirmrand (PC 2/3); am Feld stünde die Meldung neben einem Wert, der
 * bereits wieder der alte ist. Die Mechanik dahinter teilt es sich mit dem
 * Notizfeld (`useBlurSpeichern`), die Regel nicht.
 *
 * Daneben steht eine echte, nur vorgelesene Überschrift: Ein `<input>` ist
 * keine, und ohne sie verlöre die Editor-Seite ihre Gliederung — wer mit einer
 * Vorlesehilfe über Überschriften navigiert, fände den Trainingsnamen nicht
 * mehr. Sichtbar wäre sie doppelt gemoppelt, denn das Feld zeigt denselben
 * Text in derselben Schrift.
 */
function NameFeld({
  name,
  onSpeichern,
}: {
  name: string;
  onSpeichern: (next: string) => void;
}) {
  const melde = useSnackbar();
  const { entwurf, setEntwurf, beiVerlassen } = useBlurSpeichern({
    wert: name,
    pruefe: trainingNameProblem,
    speichere: onSpeichern,
    onFehler: melde,
  });

  return (
    <>
      <h1 className="sr-only">{name}</h1>
      <HeadlineField
        aria-label="Name des Trainings"
        maxLength={TRAINING_NAME_MAX}
        value={entwurf}
        onChange={(e) => setEntwurf(e.target.value)}
        onBlur={beiVerlassen}
      />
    </>
  );
}
