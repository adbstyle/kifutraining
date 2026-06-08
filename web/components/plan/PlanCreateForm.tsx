"use client";

import { useActionState, useState, useTransition } from "react";
import { TextField, Button } from "@/components/ui";
import { StufenField } from "./StufenField";
import { createPlan, type PlanFormState } from "@/lib/actions/plans";

/* Formular „Neuen Trainingsplan anlegen" (Story #10 AC1/AC2/AC3). FormData wird
   im onSubmit selbst aufgebaut (zuverlässige Serialisierung der Stufen-Auswahl),
   dann an die Server-Action übergeben. */
export function PlanCreateForm() {
  const [state, formAction] = useActionState<PlanFormState, FormData>(createPlan, {
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
        label="Name des Trainingsplans"
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
        <StufenField value={stufen} onChange={setStufen} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="filled" disabled={pending}>
          {pending ? "Wird angelegt…" : "Plan anlegen"}
        </Button>
      </div>
    </form>
  );
}
