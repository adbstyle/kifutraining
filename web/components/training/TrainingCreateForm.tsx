"use client";

import { useActionState, useState, useTransition } from "react";
import { TextField, TextArea, Button, AltersstufeField, Meldung } from "@/components/ui";
import { StufenField } from "./StufenField";
import { kategorienFuer, type Altersstufe } from "@/lib/altersstufe";
import { TRAINING_NAME_MAX, ZIEL_MAX } from "@/lib/training";
import { createTraining, type TrainingFormState } from "@/lib/actions/trainings";

/* Formular „Neues Training anlegen" (Story #10 AC1/AC2/AC3, Story 5 AK 1/2/4).
   FormData wird im onSubmit selbst aufgebaut (zuverlässige Serialisierung der
   Auswahl-Felder), dann an die Server-Action übergeben. */
export function TrainingCreateForm() {
  const [state, formAction] = useActionState<TrainingFormState, FormData>(createTraining, {
    status: "idle",
  });
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [ziel, setZiel] = useState("");
  // Bewusst OHNE Vorbelegung: Die Altersstufe eines Trainings bindet lebenslang
  // (Story 5 AK 5) — sie darf nicht durchrutschen, weil ein Wert schon dastand.
  // Das ist der Unterschied zur Übung, die sich umwandeln lässt (Story 4).
  const [altersstufe, setAltersstufe] = useState<Altersstufe | null>(null);
  const [stufen, setStufen] = useState<string[]>([]);
  const [fehler, setFehler] = useState<{ altersstufe?: string; stufen?: string }>({});

  /** Altersstufe wählen. Ein Wechsel vor dem Absenden verwirft die bereits
   *  gewählten Alterskategorien — sie gehören zur verlassenen Stufe und wären
   *  in der neuen gar nicht wählbar. */
  function waehleAltersstufe(next: Altersstufe) {
    setAltersstufe(next);
    setStufen([]);
    setFehler({});
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!altersstufe) {
      setFehler({ altersstufe: "Bitte die Altersstufe wählen." });
      return;
    }
    if (stufen.length === 0) {
      setFehler({ stufen: "Bitte mindestens eine Alterskategorie wählen." });
      return;
    }
    setFehler({});
    const fd = new FormData();
    fd.set("name", name);
    fd.set("ziel", ziel);
    fd.set("altersstufe", altersstufe);
    fd.set("stufen", stufen.join(","));
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {state.status === "error" && state.message && (
        <Meldung tone="fehler">{state.message}</Meldung>
      )}

      <TextField
        label="Name des Trainings"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={TRAINING_NAME_MAX}
        error={!!state.errors?.name}
        supportingText={state.errors?.name}
        required
        autoFocus
      />

      {/* Das Ziel begleitet das Training von der Planung bis auf den Platz.
          Es ist optional und schon beim Anlegen erfassbar (Story 10 AC 2). */}
      <TextArea
        label="Ziel (optional)"
        name="ziel"
        rows={2}
        maxLength={ZIEL_MAX}
        value={ziel}
        onChange={(e) => setZiel(e.target.value)}
        supportingText={`Woran das Team in diesem Training arbeitet. Höchstens ${ZIEL_MAX} Zeichen.`}
      />

      <AltersstufeField
        wert={altersstufe}
        onChange={waehleAltersstufe}
        hinweis="Nach welchem Manual du planst. Bestimmt Trainingsteile, Gliederung und Alterskategorien — und steht danach fest."
        fehler={fehler.altersstufe}
      />

      {/* Mindestens eine Alterskategorie, ab dem Anlegen (PO 2026-08-30,
          Epic Übungswelten). Bestehende Trainings ohne bleiben bearbeitbar,
          ein neues entsteht nicht mehr ohne.
          Ohne gewählte Altersstufe gibt es das Feld nicht — welche Kategorien
          es überhaupt gibt, folgt aus ihr. Dann steht nur der Satz da, der das
          sagt; ein leeres Auswahlfeld wäre ein Angebot ohne Inhalt. */}
      {altersstufe ? (
        <StufenField
          value={stufen}
          onChange={setStufen}
          kategorien={kategorienFuer(altersstufe)}
          error={fehler.stufen}
          supportingText="Für welche Alterskategorien ist das Training gedacht? Mindestens eine ist nötig; du kannst die Auswahl später jederzeit ändern."
        />
      ) : (
        <p className="type-body-small text-on-surface-mittel">
          Wähle zuerst die Altersstufe — sie bestimmt, welche Alterskategorien
          es hier gibt.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="filled" disabled={pending}>
          {pending ? "Wird angelegt…" : "Training anlegen"}
        </Button>
      </div>
    </form>
  );
}
