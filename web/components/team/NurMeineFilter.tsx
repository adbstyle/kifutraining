"use client";

import { useRouter } from "next/navigation";
import { FilterChip } from "@/components/ui";

/** Den Trainingsplan auf die eigenen Termine eingrenzen (#325 AK 11). Die
 *  Eingrenzung steht in der Adresse (`?meine=1`), nicht im Zustand: So
 *  überlebt sie den Wechsel zwischen Liste und Monatsüberblick (#329 PC 4)
 *  und fällt beim erneuten Öffnen des Teams weg, weil dessen Adresse sie nicht
 *  trägt. Derselbe Filter-Chip wie «Meine Übungen» im Katalog, der seine
 *  Auswahl ebenso in die Adresse schreibt. */
export function NurMeineFilter({ aktiv, href }: { aktiv: boolean; href: string }) {
  const router = useRouter();
  return (
    <FilterChip selected={aktiv} onClick={() => router.push(href, { scroll: false })}>
      Meine Termine
    </FilterChip>
  );
}
