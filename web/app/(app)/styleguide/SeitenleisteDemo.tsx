"use client";

import { useState } from "react";
import { Building2, CalendarDays, ClipboardList, LayoutGrid, ListChecks, Settings, Shield, Users } from "lucide-react";
import { Breadcrumbs, ChoiceChip, ChoiceChipGroup, Seitenleiste, SeitenleistenKnopf, leisteStil } from "@/components/ui";
import type { BereichOption, SeitenleisteGruppe } from "@/components/ui";
import type { Darstellung } from "@/lib/darstellung";

/* Beispieldaten; die Ziele bleiben auf der Seite. */
const BEREICHE: BereichOption[] = [
  { schluessel: "team-db", href: "#team-db", label: "D-Junioren Db", kopf: "FC Beispiel · Team", untertitel: "Trainer:in", icon: Shield },
  { schluessel: "team-ea", href: "#team-ea", label: "E-Junioren Ea", kopf: "FC Beispiel · Team", untertitel: "Trainer:in", icon: Shield },
  {
    schluessel: "verein",
    href: "#verein",
    label: "FC Beispiel",
    kopf: "Verein",
    untertitel: "Teams und Spieler:innen des Vereins",
    icon: Building2,
    trenner: true,
  },
];

function gruppen(angemeldet: boolean, bereich: string): SeitenleisteGruppe[] {
  const imVerein = bereich === "verein";
  return [
    ...(angemeldet
      ? [
          imVerein
            ? {
                titel: "Verein",
                eintraege: [
                  { label: "Teams", href: "#verein-teams", icon: Shield, current: true },
                  { label: "Spieler:innen", href: "#verein-spieler", icon: Users },
                  { label: "Verwaltung", href: "#verein-verwaltung", icon: Settings },
                ],
              }
            : {
                titel: "Team",
                eintraege: [
                  { label: "Trainingsplan", href: "#plan", icon: CalendarDays, current: true },
                  { label: "Trainings", href: "#team-trainings", icon: ListChecks },
                  { label: "Team", href: "#team", icon: Users },
                ],
              },
        ]
      : []),
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
            titel: "Meine Bibliothek",
            eintraege: [
              { label: "Meine Übungen", href: "#meine-uebungen", icon: LayoutGrid },
              { label: "Meine Trainings", href: "#meine-trainings", icon: ClipboardList },
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
  const [bereich, setBereich] = useState("team-ea");
  // Nur die Demo: Die Wahl hier schaltet die Anwendung nicht um.
  const [darstellung, setDarstellung] = useState<Darstellung>("geraet");

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
          bereich={angemeldet ? { optionen: BEREICHE, aktiv: bereich, onWahl: setBereich } : undefined}
          gruppen={gruppen(angemeldet, bereich)}
          konto={
            angemeldet
              ? { name: "Trainer Demo", email: "trainer@ki-fu.ch", href: "#konto" }
              : undefined
          }
          anmeldenHref="#anmelden"
          version={{ nummer: "1.27.0", href: "#versionen", neu: true }}
          feedback={angemeldet ? { label: "Fragen und Feedback", offen: false, onOeffnen: () => {} } : undefined}
          darstellung={angemeldet ? { wahl: darstellung, onWahl: setDarstellung } : undefined}
          slim={slim}
        />
        <div className="schraffur flex min-w-0 flex-1 flex-col p-4">
          <div className="flex items-center gap-3">
            <SeitenleistenKnopf slim={slim} onClick={() => setSlim(!slim)} immer />
            <Breadcrumbs
              items={[
                { label: "FC Beispiel", href: "#verein" },
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
