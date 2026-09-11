"use client";

import { useActionState, useState, useTransition } from "react";
import { TextField, TextArea, Button, AltersstufeField } from "@/components/ui";
import { StufenField } from "./StufenField";
import { kategorienFuer, type Altersstufe } from "@/lib/altersstufe";
import { ZIEL_MAX } from "@/lib/training";
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
        // Farbe trägt die Meldung, sie füllt sie nicht: Kontur und Schrift in
        // Error, der Grund bleibt der Seitengrund.
        <p className="kontur rounded-flaeche border-error bg-transparent px-4 py-3 type-body-medium text-error">
          {state.message}
        </p>
      )}

      <TextField
        label="Name des Trainings"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
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

      <div>
        <p className="mb-2 type-label-large text-on-surface">Alterskategorien</p>
        {/* Mindestens eine Alterskategorie, ab dem Anlegen (PO 2026-08-30,
            Epic Übungswelten). Bestehende Trainings ohne bleiben bearbeitbar,
            ein neues entsteht nicht mehr ohne. */}
        <p className="mb-3 type-body-small text-on-surface-mittel">
          {altersstufe
            ? "Für welche Alterskategorien ist das Training gedacht? Mindestens eine ist nötig; du kannst die Auswahl später jederzeit ändern."
            : "Wähle zuerst die Altersstufe — sie bestimmt, welche Alterskategorien es hier gibt."}
        </p>
        {altersstufe && (
          <StufenField
            value={stufen}
            onChange={setStufen}
            kategorien={kategorienFuer(altersstufe)}
          />
        )}
        {fehler.stufen && (
          <p className="mt-2 type-body-small text-error">{fehler.stufen}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="filled" disabled={pending}>
          {pending ? "Wird angelegt…" : "Training anlegen"}
        </Button>
      </div>
    </form>
  );
}
