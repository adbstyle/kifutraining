"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { IconButton, Snackbar, Tooltip } from "@/components/ui";
import { uebernimmUebung } from "@/lib/actions/exercises";

/**
 * „Übernehmen" an einer kuratierten oder fremden Übung (Story 7,
 * Übungswelten).
 *
 * Es entsteht eine eigene, zunächst private Übung — eine Kopie, die mit dem
 * Original nicht verbunden bleibt. Mehrfaches Übernehmen ist erlaubt und
 * erzeugt jedes Mal eine weitere Kopie (AK 3).
 *
 * Nach der Übernahme führt der Weg unmittelbar zur eigenen Kopie (AK 5,
 * PO-Entscheid 2026-08-30) — dort sagen Entwurf-Plakette und Eigentümer-
 * Aktionen, dass sie ihm gehört (AK 4). Der Hinweis dazu kommt als Flash über
 * `?uebernommen=1`, wie nach dem Erstellen und Bearbeiten. Icon-Knopf statt
 * beschriftetem Button, weil der Aktions-Cluster der Detailseite durchgehend
 * aus Icons besteht; der Tooltip trägt dieselbe Wortwahl wie das
 * Trainings-Pendant.
 */
export function UebungUebernehmenButton({
  exerciseId,
  name,
}: {
  exerciseId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function uebernehmen() {
    setError(null);
    startTransition(async () => {
      const res = await uebernimmUebung(exerciseId);
      if (res.ok) router.push(`/uebung/${res.slug}?uebernommen=1`);
      else setError(res.error);
    });
  }

  return (
    <>
      <Tooltip label="Übernehmen">
        <IconButton
          icon={Download}
          label={`„${name}" in meinen Bestand übernehmen`}
          size="sm"
          disabled={pending}
          onClick={uebernehmen}
        />
      </Tooltip>
      <Snackbar open={!!error} message={error ?? ""} onClose={() => setError(null)} />
    </>
  );
}
