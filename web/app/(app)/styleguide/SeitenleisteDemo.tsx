"use client";

import { useState } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  History,
  House,
  LayoutGrid,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Settings,
  Shield,
  Sun,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Breadcrumbs,
  ChoiceChip,
  ChoiceChipGroup,
  Lozenge,
  Seitenleiste,
  SeitenleistenKnopf,
  leisteStil,
} from "@/components/ui";
import type { BereichOption, MenuItemDef, SeitenleisteGruppe } from "@/components/ui";
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
    // Eigene Inhalte ohne eigenen Eintrag (#660): der Chip in der Bibliothek grenzt ein.
    {
      titel: "Bibliothek",
      eintraege: [
        { label: "Übungen", href: "#uebungen", icon: LayoutGrid },
        { label: "Trainings", href: "#trainings", icon: ClipboardList },
      ],
    },
  ];
}

const DARSTELLUNGEN: { wert: Darstellung; label: string; icon: typeof Monitor }[] = [
  { wert: "geraet", label: "Wie das Gerät", icon: Monitor },
  { wert: "hell", label: "Hell", icon: Sun },
  { wert: "dunkel", label: "Dunkel", icon: Moon },
];

/* Das Konto-Menü wie in der Anwendung (AppNavClient, #661); die Ziele
   bleiben auf der Seite, die Aktionen tun nichts. */
function kontoMenue(
  angemeldet: boolean,
  neu: boolean,
  darstellung: Darstellung,
  waehle: (d: Darstellung) => void,
): MenuItemDef[] {
  const wasIstNeu: MenuItemDef = {
    label: "Was ist neu",
    icon: History,
    href: "#versionen",
    trailing: neu ? (
      <>
        <Lozenge appearance="discovery">
          <span aria-hidden>Neu</span>
        </Lozenge>
        <span className="sr-only">, neue Version erschienen</span>
      </>
    ) : (
      <>
        <span className="sr-only">Version </span>1.51.0
      </>
    ),
  };
  if (!angemeldet) {
    return [
      { label: "Anmelden", icon: LogIn, href: "#anmelden" },
      { label: "Konto erstellen", icon: UserPlus, href: "#registrieren" },
      { ...wasIstNeu, trenner: true },
      { label: "Startseite", icon: House, href: "#startseite" },
    ];
  }
  return [
    { label: "Konto und Einstellungen", icon: Settings, href: "#konto" },
    ...DARSTELLUNGEN.map(
      (d, i): MenuItemDef => ({
        label: d.label,
        icon: d.icon,
        gruppe: "Darstellung",
        trenner: i === 0,
        gewaehlt: d.wert === darstellung,
        hinweis: i === DARSTELLUNGEN.length - 1 ? "Gilt in diesem Browser." : undefined,
        onSelect: () => waehle(d.wert),
      }),
    ),
    { label: "Fragen und Feedback", icon: MessageSquare, trenner: true, onSelect: () => {} },
    wasIstNeu,
    { label: "Startseite", icon: House, href: "#startseite" },
    { label: "Abmelden", icon: LogOut, trenner: true, onSelect: () => {} },
  ];
}

/* Demonstriert die Seitenleiste eingebettet: in einem Rahmen statt am Fenster,
   immer in der Desktop-Form. Der Drawer (unter lg) braucht das Fenster und
   zeigt sich nur in echt beim Verkleinern. */
export function SeitenleisteDemo() {
  const [slim, setSlim] = useState(false);
  const [angemeldet, setAngemeldet] = useState(true);
  const [bereich, setBereich] = useState("team-ea");
  const [neu, setNeu] = useState(true);
  // Nur die Demo: Die Wahl hier schaltet die Anwendung nicht um.
  const [darstellung, setDarstellung] = useState<Darstellung>("geraet");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <ChoiceChipGroup ariaLabel="Zustand">
          <ChoiceChip selected={angemeldet} onSelect={() => setAngemeldet(true)}>
            Angemeldet
          </ChoiceChip>
          <ChoiceChip selected={!angemeldet} onSelect={() => setAngemeldet(false)}>
            Anonym
          </ChoiceChip>
        </ChoiceChipGroup>
        <ChoiceChipGroup ariaLabel="Version">
          <ChoiceChip selected={neu} onSelect={() => setNeu(true)}>
            Neue Version
          </ChoiceChip>
          <ChoiceChip selected={!neu} onSelect={() => setNeu(false)}>
            Gesehen
          </ChoiceChip>
        </ChoiceChipGroup>
      </div>

      <div
        className="flex h-[37rem] overflow-hidden rounded-flaeche border border-linie"
        style={leisteStil(slim)}
      >
        <Seitenleiste
          eingebettet
          bereich={angemeldet ? { optionen: BEREICHE, aktiv: bereich, onWahl: setBereich } : undefined}
          gruppen={gruppen(angemeldet, bereich)}
          konto={{
            ...(angemeldet
              ? { name: "Trainer Demo", email: "trainer@ki-fu.ch" }
              : { name: "Nicht angemeldet", email: "Anmelden oder Konto erstellen", anonym: true }),
            neu,
            menue: kontoMenue(angemeldet, neu, darstellung, setDarstellung),
          }}
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
