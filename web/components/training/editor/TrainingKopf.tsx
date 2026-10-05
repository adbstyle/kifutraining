"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import {
  Card,
  Badge,
  EigenschaftAuswahl,
  EigenschaftText,
  HeadlineField,
  KategorieChip,
  TextArea,
} from "@/components/ui";
import { kategorieStufe } from "@/lib/labels";
import type { KategorieSlug } from "@/lib/vocab";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { StufenField } from "../StufenField";
import { useBlurSpeichern } from "@/lib/use-blur-speichern";
import { kategorienFuer, type Altersstufe } from "@/lib/altersstufe";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { TRAINING_NAME_MAX, ZIEL_MAX, sortStufen, trainingNameProblem } from "@/lib/training";
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
  zielFeld,
  stufenFeld,
  name,
  onNameSpeichern,
}: {
  training: TrainingDetail;
  oeffentlich: boolean;
  /** Ziel und Alterskategorien als fertige Felder — dieselben, die breit in
   *  der Spalte stehen (`ZielFeld`, `TrainingStufenFeld`). */
  zielFeld: ReactNode;
  stufenFeld: ReactNode;
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
            className="focus-ring inline-flex items-center gap-1.5 rounded-flaeche type-body-small text-on-surface-mittel hover:text-primary"
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

      <div className="mt-4">{zielFeld}</div>
      <div className="mt-4">{stufenFeld}</div>
    </Card>
  );
}

/** Das Ziel des Trainings: optional, jederzeit änder- und entfernbar (Story 10
 *  AC 3). Gespeichert wird beim Verlassen des Felds — wie der Trainingsname.
 *  Im Kopf (schmal) wie in den Eigenschaften der Spalte (breit, #370 AK 10). */
export function ZielFeld({
  ziel,
  onChange,
  onSpeichern,
}: {
  ziel: string;
  onChange: (next: string) => void;
  onSpeichern: () => void;
}) {
  return (
    <TextArea
      label="Ziel (optional)"
      rows={2}
      maxLength={ZIEL_MAX}
      value={ziel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onSpeichern()}
      info={`Woran das Team in diesem Training arbeitet. Höchstens ${ZIEL_MAX} Zeichen.`}
    />
  );
}

/** Die Alterskategorien des Trainings — nur die seiner Altersstufe: Sie folgen
 *  ihr, statt sie zu bestimmen (Story 5 AK 4). Ein Wechsel der Altersstufe ist
 *  bewusst nirgends vorgesehen (AK 5) — wer für die andere plant, legt ein
 *  neues Training an. */
export function TrainingStufenFeld({
  altersstufe,
  stufen,
  onStufen,
}: {
  altersstufe: Altersstufe;
  stufen: string[];
  onStufen: (next: string[]) => void;
}) {
  return (
    <StufenField
      value={stufen}
      onChange={onStufen}
      kategorien={kategorienFuer(altersstufe)}
      info="Für welche Alterskategorien dieses Training gedacht ist."
    />
  );
}

/** Das Ziel als bearbeitbare Eigenschaft in der Spalte (#370 AK 10, #375) —
 *  derselbe Wert wie im `ZielFeld`, nach dem Vorbild von Jira mit ✓/✕. */
export function ZielEigenschaft({
  ziel,
  onSpeichern,
}: {
  ziel: string;
  onSpeichern: (neu: string) => void;
}) {
  return (
    <EigenschaftText
      label="Ziel"
      wert={ziel}
      leerText="Ziel hinzufügen"
      maxLength={ZIEL_MAX}
      onSpeichern={onSpeichern}
    />
  );
}

/** Die Alterskategorien als bearbeitbare Eigenschaft in der Spalte — ruhend
 *  als Plaketten in ihrer Farbe, im Bearbeiten die Liste der Altersstufe. */
export function StufenEigenschaft({
  altersstufe,
  stufen,
  onStufen,
  zusatz,
}: {
  altersstufe: Altersstufe;
  stufen: string[];
  onStufen: (next: string[]) => void;
  /** Siehe `EigenschaftAuswahl` — die Rückmeldung zu nicht mehr passenden
   *  Übungen in der Ansicht. */
  zusatz?: ReactNode;
}) {
  return (
    <EigenschaftAuswahl
      zusatz={zusatz}
      label="Alterskategorien"
      options={(kategorienFuer(altersstufe) as KategorieSlug[]).map((k) => ({
        value: k,
        label: kategorieStufe[k],
      }))}
      wert={stufen}
      anzeige={
        <span className="flex flex-wrap gap-1.5">
          {sortStufen(stufen).map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
        </span>
      }
      leerText="Alterskategorie wählen"
      onChange={onStufen}
    />
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
export function NameFeld({
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
