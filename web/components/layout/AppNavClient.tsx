"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ClipboardCheck, ClipboardList, LayoutGrid, ListChecks, Users } from "lucide-react";
import { Seitenleiste } from "@/components/ui";
import type { SeitenleisteGruppe } from "@/components/ui";
import { aktiveBereiche, teamOffen } from "@/lib/navigation";
import { useSeitenleiste } from "./AppRahmen";
import { useTeamBereich } from "./TeamKontext";

/* App-Chrome, Client-Teil: baut aus Adresse und Team-Kontext die Einträge
   der Seitenleiste. Der Server-Teil (AppNav) liefert Konto, Teams und ob das
   geöffnete Training einem Team gehört; Breite und Drawer hält der AppRahmen.

   Alle Einträge sind Links — die Warnung vor ungesicherten Angaben (#246)
   fängt sie von sich aus ab. */
export function AppNavClient({
  konto,
  teams,
  imTeamBereich: imTeamBereichVomServer,
}: {
  konto: { name: string; email: string | null } | null;
  teams: { id: string; name: string }[];
  /** Ist das geöffnete Training ein Team-Training? Der Server schlägt das
   *  nach — der Adresse ist es nicht anzusehen (#156). Der Wert stimmt für
   *  den Erstaufbau; ab der ersten Client-Navigation gilt, was das Layout
   *  unter `/training/[id]` gemeldet hat. */
  imTeamBereich: boolean;
}) {
  const pfad = usePathname();
  const mine = useSearchParams().get("mine") === "1";
  const imTeamBereich = useTeamBereich(imTeamBereichVomServer);
  const { slim, drawerOffen, setzeDrawerOffen } = useSeitenleiste();
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
      konto={
        konto
          ? {
              name: konto.name,
              email: konto.email ?? undefined,
              href: "/konto",
              current: pfad === "/konto",
            }
          : undefined
      }
      slim={slim}
      drawerOffen={drawerOffen}
      onDrawerOffenChange={setzeDrawerOffen}
    />
  );
}
