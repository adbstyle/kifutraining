"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ClipboardCheck, ClipboardList, LayoutGrid, ListChecks, Users } from "lucide-react";
import { Seitenleiste } from "@/components/ui";
import type { SeitenleisteGruppe } from "@/components/ui";
import { aktiveBereiche, teamOffen } from "@/lib/navigation";
import { useSeitenleiste } from "./AppRahmen";
import { useTeamBereich } from "./TeamKontext";
import {
  GESEHEN_EREIGNIS,
  gesehenImBrowser,
  merkeGesehen,
  spaeter,
} from "@/lib/versionen-gesehen";

/* App-Chrome, Client-Teil: baut aus Adresse und Team-Kontext die Einträge
   der Seitenleiste. Der Server-Teil (AppNav) liefert Konto, Teams und ob das
   geöffnete Training einem Team gehört; Breite und Drawer hält der AppRahmen.

   Alle Einträge sind Links — die Warnung vor ungesicherten Angaben (#246)
   fängt sie von sich aus ab. */
export function AppNavClient({
  konto,
  teams,
  imTeamBereich: imTeamBereichVomServer,
  version,
  neuesteVersion,
  gesehenVersion,
}: {
  konto: { name: string; email?: string } | null;
  teams: { id: string; name: string }[];
  /** Ist das geöffnete Training ein Team-Training? Der Server schlägt das
   *  nach — der Adresse ist es nicht anzusehen (#156). Der Wert stimmt für
   *  den Erstaufbau; ab der ersten Client-Navigation gilt, was das Layout
   *  unter `/training/[id]` gemeldet hat. */
  imTeamBereich: boolean;
  /** Die laufende Versionsnummer (#408). */
  version: string;
  /** Wann der neueste Release erschien und wann der zuletzt gesehene (#410). */
  neuesteVersion: string | null;
  gesehenVersion: string | null;
}) {
  const pfad = usePathname();
  const suche = useSearchParams();
  const mine = suche.get("mine") === "1";
  const imTeamBereich = useTeamBereich(imTeamBereichVomServer);
  const { slim, drawerOffen, setzeDrawerOffen } = useSeitenleiste();

  // Jeder Seitenwechsel schliesst den Drawer — auch der über die Marke oder
  // das Zurück des Browsers, die nicht über einen Eintrag laufen.
  const adresse = `${pfad}?${suche.toString()}`;
  useEffect(() => setzeDrawerOffen(false), [adresse, setzeDrawerOffen]);

  // Neue Releases (#410): Der Stand vom Server gilt bis zum nächsten Laden;
  // nur das Ansehen der Versionen nimmt die Markierung sofort ab. Beim
  // ersten Besuch gilt alles Erschienene als bekannt.
  const [gesehen, setzeGesehen] = useState(gesehenVersion);
  useEffect(() => {
    const onGesehen = (e: Event) => setzeGesehen((e as CustomEvent<string>).detail);
    window.addEventListener(GESEHEN_EREIGNIS, onGesehen);
    if (neuesteVersion && !gesehenImBrowser()) merkeGesehen(neuesteVersion);
    return () => window.removeEventListener(GESEHEN_EREIGNIS, onGesehen);
  }, [neuesteVersion]);
  const neu = spaeter(neuesteVersion, gesehen);

  const aktiv = aktiveBereiche(pfad, mine, imTeamBereich);

  const gruppen: SeitenleisteGruppe[] = [
    {
      titel: "Bibliothek",
      eintraege: [
        { label: "Übungen", href: "/", icon: LayoutGrid, current: aktiv.uebungen },
        { label: "Trainings", href: "/trainings", icon: ClipboardList, current: aktiv.trainings },
      ],
    },
  ];
  // „Mein Bereich" nur angemeldet: Eigenes und Teams gibt es nur mit Konto.
  if (konto) {
    gruppen.push({
      titel: "Mein Bereich",
      eintraege: [
        { label: "Meine Übungen", href: "/?mine=1", icon: ListChecks, current: aktiv.meineUebungen },
        {
          label: "Meine Trainings",
          href: "/trainings?mine=1",
          icon: ClipboardCheck,
          current: aktiv.meineTrainings,
        },
        {
          label: "Teams",
          href: "/teams",
          icon: Users,
          current: aktiv.teamsSeite,
          bereichAktiv: aktiv.teamsBereich,
          unterpunkte: teams.map((t) => ({
            label: t.name,
            href: `/team/${t.id}`,
            current: teamOffen(pfad, t.id),
          })),
        },
      ],
    });
  }

  return (
    <Seitenleiste
      gruppen={gruppen}
      konto={konto ? { ...konto, href: "/konto", current: pfad === "/konto" } : undefined}
      version={{ nummer: version, href: "/versionen", current: pfad === "/versionen", neu }}
      slim={slim}
      drawerOffen={drawerOffen}
      onDrawerOffenChange={setzeDrawerOffen}
    />
  );
}
