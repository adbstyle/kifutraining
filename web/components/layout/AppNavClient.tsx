"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Contact,
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
import { Lozenge, Seitenleiste } from "@/components/ui";
import type { BereichOption, MenuItemDef, SeitenleisteGruppe } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import type { Darstellung } from "@/lib/darstellung";
import {
  bereichCookie,
  bereichSchluessel,
  gleicherBereich,
  leseBereich,
  waehleBereich,
  type Bereich,
} from "@/lib/bereich";
import { aktiveBereiche, bereichAusPfad, STARTSEITE_PFAD, UEBUNGEN_PFAD } from "@/lib/navigation";
import { useFeedback } from "@/components/feedback/FeedbackKontext";
import { FEEDBACK_TITEL } from "@/components/feedback/FeedbackGespraech";
import { useSeitenleiste } from "./AppRahmen";
import { useDarstellung } from "./DarstellungKontext";
import { useTeamBereich } from "./TeamKontext";
import { nachRueckfrage } from "./VerlassenWarnung";
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
   fängt sie von sich aus ab. Im Konto-Menü (#661) sind es die Ziele ebenso;
   Aktionen (Feedback, Abmelden) und die Wahl der Darstellung sind Knöpfe.
   Abmelden gibt es nur dort; es verlässt die Seite ohne Link und fragt die
   Warnung darum selbst (`nachRueckfrage`). */
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
  /** Die laufende Versionsnummer (#408): im Konto-Menü bei «Was ist neu»,
   *  solange keine neue Version ungesehen ist. */
  version: string;
}) {
  const pfad = usePathname();
  const suche = useSearchParams();
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

  const aktiv = aktiveBereiche(pfad, imTeamBereich);

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

  // Eigene Übungen und Trainings haben keinen Eintrag (#660): Der Chip
  // «Meine Übungen» bzw. «Meine Trainings» grenzt die Bibliothek ein.
  const bibliotheken: SeitenleisteGruppe = {
    titel: "Bibliothek",
    eintraege: [
      { label: "Übungen", href: UEBUNGEN_PFAD, icon: LayoutGrid, current: aktiv.uebungen },
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
        // «Spieler:innen» öffnet immer die Liste, ohne Eingrenzung (#704 AK 2),
        // und bleibt in jedem ihrer Reiter markiert.
        {
          label: "Spieler:innen",
          href: `${basis}/spieler`,
          icon: Users,
          current: pfad === `${basis}/spieler` || pfad.startsWith(`${basis}/spieler/`),
        },
        { label: "Trainings", href: `${basis}/trainings`, icon: ListChecks, current: pfad === `${basis}/trainings` },
        // «Team»: was das Team selbst betrifft, ohne Reiter (#704 AK 4).
        {
          label: "Team",
          href: `${basis}/trainer`,
          icon: Contact,
          current: pfad === `${basis}/trainer` || pfad.startsWith(`${basis}/trainer/`),
        },
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
        {
          label: "Spieler:innen",
          href: "/verein/spieler",
          icon: Users,
          current: pfad.startsWith("/verein/spieler"),
        },
        // Die Seite «Verwaltung» sieht nur die Vereinsverwaltung.
        ...(verein?.istVerwaltung
          ? [
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

  // «Was ist neu» führt zur Release-History (#408): bei einer ungesehenen
  // Version mit der Plakette «Neu», sonst mit der laufenden Nummer.
  const wasIstNeu: MenuItemDef = {
    label: "Was ist neu",
    icon: History,
    href: "/versionen",
    current: pfad === "/versionen",
    trailing: neu ? (
      <>
        <Lozenge appearance="discovery">
          <span aria-hidden>Neu</span>
        </Lozenge>
        <span className="sr-only">, neue Version erschienen</span>
      </>
    ) : (
      <>
        <span className="sr-only">Version </span>
        {version}
      </>
    ),
  };
  // Die Startseite bewusst (#671 AK 1, Entscheid 4): «/» und die Marke führen
  // angemeldet in den Arbeitsbereich, darum ein eigener Verweis.
  const startseite: MenuItemDef = { label: "Startseite", icon: House, href: STARTSEITE_PFAD };
  // Eine Seite des Kontos ist offen: die Karte hervorgehoben, im Menü die Zeile.
  const imKonto = pfad === "/konto" || pfad.startsWith("/konto/");
  const menue: MenuItemDef[] = konto
    ? [
        { label: "Konto und Einstellungen", icon: Settings, href: "/konto", current: imKonto },
        // Wählen nur, wo der Browser umschalten kann (#567).
        ...(umschaltbar
          ? DARSTELLUNGEN.map(
              (d, i): MenuItemDef => ({
                label: d.label,
                icon: d.icon,
                gruppe: "Darstellung",
                trenner: i === 0,
                gewaehlt: d.wert === darstellung,
                hinweis: i === DARSTELLUNGEN.length - 1 ? "Gilt in diesem Browser." : undefined,
                onSelect: () => waehle(d.wert),
              }),
            )
          : []),
        // Ein Knopf, kein Link: öffnet den Dialog neben der Seite (#542).
        { label: FEEDBACK_TITEL, icon: MessageSquare, trenner: umschaltbar, onSelect: feedback.oeffnen },
        wasIstNeu,
        startseite,
        {
          label: "Abmelden",
          icon: LogOut,
          trenner: true,
          onSelect: () =>
            nachRueckfrage(() => {
              void signOut();
            }),
        },
      ]
    : // Ohne Konto weder Feedback (Spielervertretungen melden am privaten
      // Link) noch Darstellung (nach aussen immer hell, #569).
      [
        { label: "Anmelden", icon: LogIn, href: "/login" },
        { label: "Konto erstellen", icon: UserPlus, href: "/registrieren" },
        { ...wasIstNeu, trenner: true },
        startseite,
      ];

  return (
    <Seitenleiste
      bereich={konto && offen && optionen.length > 0 ? { optionen, aktiv: bereichSchluessel(offen), onWahl: wahl } : undefined}
      gruppen={gruppen}
      konto={
        konto
          ? {
              ...konto,
              current: imKonto,
              neu,
              menue,
            }
          : { name: "Nicht angemeldet", email: "Anmelden oder Konto erstellen", anonym: true, neu, menue }
      }
      slim={slim}
      drawerOffen={drawerOffen}
      onDrawerOffenChange={setzeDrawerOffen}
    />
  );
}

const DARSTELLUNGEN: { wert: Darstellung; label: string; icon: typeof Monitor }[] = [
  { wert: "geraet", label: "Wie das Gerät", icon: Monitor },
  { wert: "hell", label: "Hell", icon: Sun },
  { wert: "dunkel", label: "Dunkel", icon: Moon },
];
