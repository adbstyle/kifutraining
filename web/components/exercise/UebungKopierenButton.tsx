"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { IconButton, Snackbar, Tooltip } from "@/components/ui";
import { kopiereUebung } from "@/lib/actions/exercises";

/**
 * „Kopieren" an einer kuratierten oder fremden Übung (Story 7, Übungswelten).
 *
 * Es entsteht eine eigene, zunächst private Übung — eine Kopie, die mit dem
 * Original nicht verbunden bleibt. Mehrfaches Kopieren ist erlaubt und erzeugt
 * jedes Mal eine weitere Kopie (AK 3); im Namen erkennbar gemacht wird nur die
 * Kopie einer EIGENEN Übung (#171 OOS 5) — dafür steht der Eintrag im
 * Eigentümer-Menü.
 *
 * Nach dem Kopieren führt der Weg unmittelbar zur eigenen Kopie (AK 5,
 * PO-Entscheid 2026-08-30) — dort sagen Entwurf-Plakette und Eigentümer-
 * Aktionen, dass sie ihm gehört (AK 4). Der Hinweis dazu kommt als Flash über
 * `?kopiert=1`, wie nach dem Erstellen und Bearbeiten. Icon-Knopf statt
 * beschriftetem Button, weil der Aktions-Cluster der Detailseite durchgehend
 * aus Icons besteht.
 */
export function UebungKopierenButton({
  exerciseId,
  name,
}: {
  exerciseId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function kopieren() {
    setError(null);
    startTransition(async () => {
      const res = await kopiereUebung(exerciseId);
      if (res.ok) router.push(`/uebung/${res.slug}?kopiert=1`);
      else setError(res.error);
    });
  }

  return (
    <>
      <Tooltip label="Kopieren">
        <IconButton
          icon={Copy}
          label={`„${name}" in meinen Bestand kopieren`}
          size="sm"
          disabled={pending}
          onClick={kopieren}
        />
      </Tooltip>
      <Snackbar open={!!error} message={error ?? ""} onClose={() => setError(null)} />
    </>
  );
}
