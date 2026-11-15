"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { IconButton, Tooltip } from "@/components/ui";
import { useBestandStufe } from "@/components/konto/BestandStufe";
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
 * PO-Entscheid 2026-08-30) — dort sagen Entwurf-Lozenge und Eigentümer-
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
  // Für ein Konto ohne Verein erst der frisch gelesene Stand (#588); sonst wie bisher ein Klick.
  const { starte, laeuft, dialog } = useBestandStufe({
    art: "uebungen",
    titel: "Übung kopieren",
    aktion: "Kopieren",
    hinweis: "Die Kopie ist ein privater Entwurf in deinem Bestand.",
    ausfuehren: async () => {
      const res = await kopiereUebung(exerciseId);
      if (!res.ok) return res;
      router.push(`/uebung/${res.slug}?kopiert=1`);
      return null;
    },
  });

  return (
    <>
      <Tooltip label="Kopieren">
        <IconButton
          icon={Copy}
          label={`„${name}" in meinen Bestand kopieren`}
          aria-disabled={laeuft || undefined}
          onClick={starte}
        />
      </Tooltip>
      {dialog}
    </>
  );
}
