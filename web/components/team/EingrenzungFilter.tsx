"use client";

import { useRouter } from "next/navigation";
import { FilterChip } from "@/components/ui";
import { planHref } from "@/lib/team-ansicht";
import type { Eingrenzung } from "@/lib/trainer";

/** Den Trainingsplan auf die eigenen Termine eingrenzen (#518 PO 12): «Meine
 *  Termine» = wo du dabei bist, «Eingeladen» = alle, zu denen du eingeladen
 *  bist. Es gilt höchstens eine; ein Klick auf die gewählte hebt sie auf. Die
 *  Eingrenzung steht in der Adresse, nicht im Zustand: So lässt sie sich
 *  weitergeben und fällt beim erneuten Öffnen des Teams weg, weil dessen
 *  Adresse sie nicht trägt. Derselbe Filter-Chip wie «Meine Übungen» im
 *  Katalog, der seine Auswahl ebenso in die Adresse schreibt. */
export function EingrenzungFilter({ teamId, aktiv }: { teamId: string; aktiv: Eingrenzung | null }) {
  const router = useRouter();
  const chip = (e: Eingrenzung, label: string) => (
    <FilterChip selected={aktiv === e} onClick={() => router.push(planHref(teamId, aktiv === e ? null : e), { scroll: false })}>
      {label}
    </FilterChip>
  );
  return (
    <>
      {chip("dabei", "Meine Termine")}
      {chip("eingeladen", "Eingeladen")}
    </>
  );
}
