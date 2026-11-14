"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, ClipboardList, LayoutGrid, ListChecks, Settings, Shield, Users } from "lucide-react";
import { Seitenleiste } from "@/components/ui";
import type { BereichOption, SeitenleisteGruppe } from "@/components/ui";
import {
  bereichCookie,
  bereichSchluessel,
  gleicherBereich,
  leseBereich,
  waehleBereich,
  type Bereich,
} from "@/lib/bereich";
import { aktiveBereiche, bereichAusPfad } from "@/lib/navigation";
import { useFeedback } from "@/components/feedback/FeedbackKontext";
import { FEEDBACK_TITEL } from "@/components/feedback/FeedbackGespraech";
import { useSeitenleiste } from "./AppRahmen";
import { useDarstellung } from "./DarstellungKontext";
import { useTeamBereich } from "./TeamKontext";
import { useVersionen } from "./VersionenKontext";

/* App-Chrome, Client-Teil: baut aus Adresse und Team-Kontext die Einträge
   der Seitenleiste. Der Server-Teil (AppNav) liefert Konto, Teams, Verein und
   welchem Team das geöffnete Training gehört; Breite und Drawer hält der
   AppRahmen.

   Bereiche (#581): oben wählt der Wechsler eines der eigenen Teams oder den
   Verein; darunter stehen nur die Einträge dieses Bereichs, die Bibliotheken
   immer. Welcher Bereich offen ist, folgt aus der Adresse; auf Seiten ohne
   Bereich bleibt der zuletzt gewählte (Cookie). Reine Navigation — Rechte
   hängen daran keine.

   Alle Einträge sind Links — die Warnung vor ungesicherten Angaben (#246)
   fängt sie von sich aus ab. */
export function AppNavClient({
  konto,
  teams,
  verein,
  gemerkt: gemerktVomServer,
  teamImTraining: teamImTrainingVomServer,
  version,
}: {
  konto: { name: string; email?: string } | null;
  /** Die eigenen Teams, nach Namen. */
  teams: { id: string; name: string }[];
  /** Der Verein des Kontos; `null` ohne Verein (oder wenn die Lage nicht zu
   *  lesen war — dann zeigt der Wechsler nur die Teams). */
  verein: { name: string; istVerwaltung: boolean } | null;
  /** Der Wert des Cookies `kifu-bereich` (BEREICH_COOKIE), roh (fremde Werte fängt `leseBereich`). */
  gemerkt: string | null;
  /** Welchem Team gehört das geöffnete Training? Der Server schlägt das
   *  nach — der Adresse ist es nicht anzusehen (#156). Der Wert stimmt für
   *  den Erstaufbau; ab der ersten Client-Navigation gilt, was das Layout
   *  unter `/training/[id]` gemeldet hat. */
  teamImTraining: string | null;
  /** Die laufende Versionsnummer (#408). */
  version: string;
}) {
  const pfad = usePathname();
  const suche = useSearchParams();
  const mine = suche.get("mine") === "1";
  const teamImTraining = useTeamBereich(teamImTrainingVomServer);
  const imTeamBereich = teamImTraining !== null;
  const { slim, drawerOffen, setzeDrawerOffen } = useSeitenleiste();

  // Jeder Seitenwechsel schliesst den Drawer — auch der über die Marke oder
  // das Zurück des Browsers, die nicht über einen Eintrag laufen.
  const adresse = `${pfad}?${suche.toString()}`;
  useEffect(() => setzeDrawerOffen(false), [adresse, setzeDrawerOffen]);

  const { neu } = useVersionen();
  const feedback = useFeedback();
  const { darstellung, waehle, umschaltbar } = useDarstellung();

  const aktiv = aktiveBereiche(pfad, mine, imTeamBereich);

  // Die Bereiche dieses Kontos: erst die eigenen Teams, dann der Verein.
  const bereiche: Bereich[] = [
    ...teams.map((t): Bereich => ({ art: "team", id: t.id })),
    ...(verein ? [{ art: "verein" } as Bereich] : []),
  ];
  // Der gemerkte Bereich: zuerst das Cookie vom Server, danach, was hier
  // gewählt oder betreten wurde (der Server rendert das Layout bei einer
  // Client-Navigation nicht neu).
  const [gemerkt, setGemerkt] = useState<Bereich | null>(() => leseBereich(gemerktVomServer ?? undefined));
  const ausPfad = bereichAusPfad(pfad, teamImTraining);
  const offen = waehleBereich(bereiche, ausPfad, gemerkt);
  const ausPfadSchluessel = ausPfad ? bereichSchluessel(ausPfad) : null;
  const hatAusPfad = ausPfad !== null && bereiche.some((b) => gleicherBereich(b, ausPfad));
  useEffect(() => {
    // Wer einen Bereich betritt (Link, Adresse, Zurück), merkt ihn sich.
    // Das Cookie ausserhalb des State-Updaters schreiben: React darf Updater
    // mehrfach aufrufen, sie müssen frei von Nebenwirkungen sein.
    if (!ausPfad || !hatAusPfad || gleicherBereich(gemerkt, ausPfad)) return;
    document.cookie = bereichCookie(ausPfad);
    setGemerkt(ausPfad);
    // `ausPfad` ist durch den Schlüssel bestimmt; `gemerkt` ändert sich nur
    // hier und in `wahl`, die das Cookie selbst schreibt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ausPfadSchluessel, hatAusPfad]);

  const wahl = (schluessel: string) => {
    const b = bereiche.find((x) => bereichSchluessel(x) === schluessel);
    if (!b) return;
    setGemerkt(b);
    document.cookie = bereichCookie(b);
  };

  const optionen: BereichOption[] = bereiche.map((b) =>
    b.art === "team"
      ? {
          schluessel: bereichSchluessel(b),
          href: `/team/${b.id}`,
          label: teams.find((t) => t.id === b.id)?.name ?? "Team",
          kopf: verein ? `${verein.name} · Team` : "Team",
          untertitel: "Trainer:in",
          icon: Shield,
          // Ein Strich zwischen den Teams und dem Verein.
        }
      : {
          schluessel: bereichSchluessel(b),
          href: "/verein",
          label: verein?.name ?? "Verein",
          kopf: "Verein",
          untertitel: "Teams und Spieler:innen des Vereins",
          icon: Building2,
          trenner: teams.length > 0,
        },
  );

  const bibliotheken: SeitenleisteGruppe = {
    titel: "Bibliothek",
    eintraege: [
      { label: "Übungen", href: "/", icon: LayoutGrid, current: aktiv.uebungen },
      { label: "Trainings", href: "/trainings", icon: ClipboardList, current: aktiv.trainings },
    ],
  };
  const gruppen: SeitenleisteGruppe[] = [];

  // Die Einträge des offenen Bereichs — nur angemeldet, nur mit Bereich.
  if (konto && offen?.art === "team") {
    const basis = `/team/${offen.id}`;
    gruppen.push({
      titel: "Team",
      eintraege: [
        // Ein geöffnetes Team-Training gehört zum Plan, aus dem man es öffnet.
        {
          label: "Trainingsplan",
          href: basis,
          icon: CalendarDays,
          current: pfad === basis,
          bereichAktiv: imTeamBereich,
        },
        { label: "Trainings", href: `${basis}/trainings`, icon: ListChecks, current: pfad === `${basis}/trainings` },
        { label: "Team", href: `${basis}/verwaltung`, icon: Users, current: pfad === `${basis}/verwaltung` },
      ],
    });
  } else if (konto && offen?.art === "verein") {
    gruppen.push({
      titel: "Verein",
      eintraege: [
        {
          label: "Teams",
          href: "/verein",
          icon: Shield,
          current: pfad === "/verein" || pfad.startsWith("/verein/team/"),
        },
        // Bis die Spielerliste für alle Mitglieder des Vereins steht (Story
        // #580), gehört der Eintrag nur zur Verwaltung: Die Seite zeigt den
        // Bestand und das Zuordnen, beides nur ihr.
        ...(verein?.istVerwaltung
          ? [
              {
                label: "Spieler:innen",
                href: "/verein/spieler",
                icon: Users,
                current: pfad.startsWith("/verein/spieler"),
              },
              {
                label: "Verwaltung",
                href: "/verein/verwaltung",
                icon: Settings,
                current: pfad.startsWith("/verein/verwaltung"),
              },
            ]
          : []),
      ],
    });
  } else if (konto) {
    // Kein Verein, kein Team: der Einstieg liegt unter /teams (Verein gründen,
    // sich aufnehmen lassen).
    gruppen.push({
      titel: "Start",
      eintraege: [{ label: "Teams", href: "/teams", icon: Shield, current: pfad === "/teams" }],
    });
  }
  gruppen.push(bibliotheken);
  // „Meine Bibliothek" nur angemeldet: Eigenes gibt es nur mit Konto.
  if (konto) {
    gruppen.push({
      titel: "Meine Bibliothek",
      eintraege: [
        { label: "Meine Übungen", href: "/?mine=1", icon: LayoutGrid, current: aktiv.meineUebungen },
        {
          label: "Meine Trainings",
          href: "/trainings?mine=1",
          icon: ClipboardList,
          current: aktiv.meineTrainings,
        },
      ],
    });
  }

  return (
    <Seitenleiste
      bereich={konto && offen && optionen.length > 0 ? { optionen, aktiv: bereichSchluessel(offen), onWahl: wahl } : undefined}
      gruppen={gruppen}
      konto={konto ? { ...konto, href: "/konto", current: pfad === "/konto" } : undefined}
      version={{ nummer: version, href: "/versionen", current: pfad === "/versionen", neu }}
      // Feedback nur mit Konto (#542); Spielervertretungen melden am privaten Link.
      feedback={
        konto ? { label: FEEDBACK_TITEL, offen: feedback.offen, onOeffnen: feedback.oeffnen } : undefined
      }
      // Wählen nur mit Konto (#567) und nur, wo der Browser umschalten kann.
      darstellung={konto && umschaltbar ? { wahl: darstellung, onWahl: waehle } : undefined}
      slim={slim}
      drawerOffen={drawerOffen}
      onDrawerOffenChange={setzeDrawerOffen}
    />
  );
}
