"use client";

import { useRouter } from "next/navigation";
import { VorlagePicker } from "./VorlagePicker";
import { kopiereVorlage } from "@/lib/actions/diagramm";
import type { VorlageItem } from "@/lib/queries/exercises";

/**
 * Einstieg „Aus Vorlage kopieren" auf der Bearbeiten-Seite (Epic #58,
 * Story #61). Kopiert die gewählte Vorlage serverseitig in die Zielübung und
 * öffnet danach den Editor zum Weiterbearbeiten.
 */
export function VorlageKopierenButton({
  zielId,
  slug,
  zielHatDiagramm,
  vorlagen,
}: {
  zielId: string;
  slug: string;
  zielHatDiagramm: boolean;
  vorlagen: VorlageItem[];
}) {
  const router = useRouter();
  return (
    <VorlagePicker
      vorlagen={vorlagen}
      zielHatDiagramm={zielHatDiagramm}
      triggerLabel="Aus Vorlage kopieren"
      onPick={async (vorlage) => {
        const res = await kopiereVorlage(zielId, vorlage.id);
        if (res.ok) {
          router.push(`/uebung/${slug}/diagramm`);
          return null;
        }
        return res.error;
      }}
    />
  );
}
