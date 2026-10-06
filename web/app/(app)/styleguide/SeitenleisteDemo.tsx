"use client";

import { useState } from "react";
import { ClipboardCheck, ClipboardList, LayoutGrid, ListChecks, Users } from "lucide-react";
import { Breadcrumbs, ChoiceChip, ChoiceChipGroup, Seitenleiste, SeitenleistenKnopf, leisteStil } from "@/components/ui";
import type { SeitenleisteGruppe } from "@/components/ui";

/* Beispieldaten; die Ziele bleiben auf der Seite. */
function gruppen(angemeldet: boolean): SeitenleisteGruppe[] {
  return [
    {
      titel: "Bibliothek",
      eintraege: [
        { label: "Übungen", href: "#uebungen", icon: LayoutGrid },
        { label: "Trainings", href: "#trainings", icon: ClipboardList },
      ],
    },
    ...(angemeldet
      ? [
          {
            titel: "Mein Bereich",
            eintraege: [
              { label: "Meine Übungen", href: "#meine-uebungen", icon: ListChecks },
              { label: "Meine Trainings", href: "#meine-trainings", icon: ClipboardCheck },
              {
                label: "Teams",
                href: "#teams",
                icon: Users,
                bereichAktiv: true,
                unterpunkte: [
                  { label: "D-Junioren Db", href: "#team-db" },
                  { label: "E-Junioren Ea", href: "#team-ea", current: true },
                ],
              },
            ],
          },
        ]
      : []),
  ];
}

/* Demonstriert die Seitenleiste eingebettet: in einem Rahmen statt am Fenster,
   immer in der Desktop-Form. Der Drawer (unter lg) braucht das Fenster und
   zeigt sich nur in echt beim Verkleinern. */
export function SeitenleisteDemo() {
  const [slim, setSlim] = useState(false);
  const [angemeldet, setAngemeldet] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <ChoiceChipGroup ariaLabel="Zustand">
        <ChoiceChip selected={angemeldet} onSelect={() => setAngemeldet(true)}>
          Angemeldet
        </ChoiceChip>
        <ChoiceChip selected={!angemeldet} onSelect={() => setAngemeldet(false)}>
          Anonym
        </ChoiceChip>
      </ChoiceChipGroup>

      <div
        className="flex h-[37rem] overflow-hidden rounded-flaeche border border-linie"
        style={leisteStil(slim)}
      >
        <Seitenleiste
          eingebettet
          gruppen={gruppen(angemeldet)}
          konto={
            angemeldet
              ? { name: "Trainer Demo", email: "trainer@ki-fu.ch", href: "#konto" }
              : undefined
          }
          anmeldenHref="#anmelden"
          version={{ nummer: "1.27.0", href: "#versionen" }}
          slim={slim}
        />
        <div className="schraffur flex min-w-0 flex-1 flex-col p-4">
          <div className="flex items-center gap-3">
            <SeitenleistenKnopf slim={slim} onClick={() => setSlim(!slim)} immer />
            <Breadcrumbs
              items={[
                { label: "Teams", href: "#teams" },
                { label: "E-Junioren Ea" },
              ]}
            />
          </div>
          <span className="type-label-small m-auto text-on-surface-mittel">Seiteninhalt</span>
        </div>
      </div>
    </div>
  );
}
