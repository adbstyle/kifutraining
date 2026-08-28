"use client";

import { useActionState, useState, useTransition } from "react";
import { TextField, Button } from "@/components/ui";
import { StufenField } from "./StufenField";
import { stufenMischen } from "@/lib/junioren";
import { createTraining, type TrainingFormState } from "@/lib/actions/trainings";

/* Formular „Neues Training anlegen" (Story #10 AC1/AC2/AC3). FormData wird
   im onSubmit selbst aufgebaut (zuverlässige Serialisierung der Stufen-Auswahl),
   dann an die Server-Action übergeben. */
export function TrainingCreateForm() {
  const [state, formAction] = useActionState<TrainingFormState, FormData>(createTraining, {
    status: "idle",
  });
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [stufen, setStufen] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", name);
    fd.set("stufen", stufen.join(","));
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {state.status === "error" && state.message && (
        <p className="rounded-[4px] border border-error/40 bg-error/10 px-4 py-3 type-body-medium text-error">
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

      <div>
        <p className="mb-2 type-label-large text-on-surface">Stufen (optional)</p>
        <p className="mb-3 type-body-small text-on-surface-variant">
          Für welche Alterskategorien ist das Training gedacht? Du kannst dies
          später jederzeit ändern.
        </p>
        {/* Ein Training folgt genau einem Trainingsschema: die Wahl einer
            Stufe des anderen ersetzt die bisherige Auswahl, statt zu mischen
            (Story 3 AC 4). Die Datenebene weist die Mischung ohnehin ab. */}
        <StufenField
          value={stufen}
          onChange={(next) =>
            setStufen(stufenMischen(next) ? next.filter((k) => !stufen.includes(k)) : next)
          }
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="filled" disabled={pending}>
          {pending ? "Wird angelegt…" : "Training anlegen"}
        </Button>
      </div>
    </form>
  );
}
