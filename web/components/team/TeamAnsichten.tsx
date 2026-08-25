"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { TabNav } from "@/components/ui";

/* Der Umschalter zwischen den drei Ansichten eines Teams (Story 17).

   Welche Ansicht offen ist, verrät das gewählte Routen-Segment — `null` steht
   für die Basis-Adresse und damit für den Trainingsplan. Nur deshalb ist diese
   Hülle eine Client-Komponente; alles Übrige bleibt serverseitig.

   Die Anzahl der Einträge steht in der Überschrift der jeweiligen Ansicht und
   NICHT an den Reitern: sonst müsste jeder Aufruf die Daten aller drei
   Ansichten laden — genau das, was die Aufteilung vermeiden soll. */
export function TeamAnsichten({ teamId }: { teamId: string }) {
  const segment = useSelectedLayoutSegment();
  const basis = `/team/${teamId}`;
  const offen = segment ?? "plan";

  return (
    <TabNav
      ariaLabel="Ansichten des Teams"
      className="mb-6"
      items={[
        { label: "Trainingsplan", href: basis, current: offen === "plan" },
        {
          label: "Trainings",
          href: `${basis}/trainings`,
          current: offen === "trainings",
        },
        {
          label: "Team",
          href: `${basis}/verwaltung`,
          current: offen === "verwaltung",
        },
      ]}
    />
  );
}
