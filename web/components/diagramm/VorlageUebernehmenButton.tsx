"use client";

import { useRouter } from "next/navigation";
import { VorlagePicker } from "./VorlagePicker";
import { uebernimmVorlage } from "@/lib/actions/diagramm";
import type { VorlageItem } from "@/lib/queries/exercises";

/**
 * Einstieg „Aus Vorlage übernehmen" auf der Bearbeiten-Seite (Epic #58,
 * Story #61). Übernimmt die gewählte Vorlage serverseitig als Kopie in die
 * Zielübung und öffnet danach den Editor zum Weiterbearbeiten.
 */
export function VorlageUebernehmenButton({
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
      triggerLabel="Aus Vorlage übernehmen"
      onPick={async (vorlage) => {
        const res = await uebernimmVorlage(zielId, vorlage.id);
        if (res.ok) {
          router.push(`/uebung/${slug}/diagramm`);
          return null;
        }
        return res.error;
      }}
    />
  );
}
